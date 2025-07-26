// Required dependencies
const { ethers } = require("ethers");
const TelegramBot = require("node-telegram-bot-api");
const path = require("path");
const fetch = require("node-fetch");

// --- Configuration ---
const TELEGRAM_BOT_TOKEN = "5560564745:AAGItPTaoQQyxxnm7bAavxofMKN3z4ieAM0";
const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT || -1002753827191; // Use environment variable or fallback to test chat

// Test mode and mirroring configuration for safe testing
const isTestMode = process.env.TEST_MODE === "true";
const MIRROR_TO_DEV = process.env.MIRROR_TO_DEV === "true";
const DEV_CHAT_ID = process.env.DEV_CHAT_ID || -1002545365231;
const targetChat = isTestMode ? DEV_CHAT_ID : TELEGRAM_CHAT;

// Debug: Log test mode and mirroring configuration
console.log("[Config] TEST_MODE environment variable:", process.env.TEST_MODE);
console.log("[Config] TEST_MODE type:", typeof process.env.TEST_MODE);
console.log("[Config] isTestMode:", isTestMode);
console.log(
  "[Config] MIRROR_TO_DEV environment variable:",
  process.env.MIRROR_TO_DEV
);
console.log("[Config] MIRROR_TO_DEV type:", typeof process.env.MIRROR_TO_DEV);
console.log("[Config] MIRROR_TO_DEV:", MIRROR_TO_DEV);

// Debug: Log the chat ID being used
console.log(
  "[Config] TELEGRAM_CHAT environment variable:",
  process.env.TELEGRAM_CHAT
);
console.log("[Config] Using chat ID:", TELEGRAM_CHAT);
console.log("[Config] Test mode:", isTestMode);
console.log("[Config] Target chat ID:", targetChat);
console.log("[Config] Dev chat ID:", DEV_CHAT_ID);

// --- RPC Provider Configuration ---
const RPC_PROVIDERS = {
  primary: [
    {
      name: "Chainstack",
      ws: "wss://ethereum-mainnet.core.chainstack.com/b6dbac3a0035889f4fe0ecba93817555",
      http: "https://ethereum-mainnet.core.chainstack.com/b6dbac3a0035889f4fe0ecba93817555",
      priority: 1,
      rateLimit: { rps: 10, monthly: 1000000 },
      features: ["websocket", "archive"],
      cost: "paid",
    },
    {
      name: "QuickNode",
      http: "https://late-hidden-river.quiknode.pro/1d06846dc558e409813ae371237433298f9d13ec/",
      priority: 1,
      rateLimit: { rps: 10, monthly: 1000000 },
      features: ["http", "archive"],
      cost: "paid",
    },
  ],
  secondary: [],
  fallback: [
    {
      name: "Ethereum Foundation",
      http: "https://eth.llamarpc.com",
      priority: 3,
      rateLimit: { rps: 1, monthly: 10000 },
      features: ["http"],
      cost: "free",
    },
    {
      name: "PublicNode",
      http: "https://ethereum.publicnode.com",
      priority: 3,
      rateLimit: { rps: 1, monthly: 10000 },
      features: ["http"],
      cost: "free",
    },
  ],
};

// RPC Configuration
const RPC_CONFIG = {
  // Enable/disable rotation
  enableRotation: process.env.ENABLE_RPC_ROTATION !== "false", // Default to true

  // Round-robin rotation (for Lambda environments)
  enableRoundRobin: process.env.ENABLE_ROUND_ROBIN !== "false", // Default to true

  // Health check interval
  healthCheckInterval: parseInt(process.env.RPC_HEALTH_CHECK_INTERVAL) || 60000, // 1 minute

  // Provider-specific settings
  maxConcurrentFailures: parseInt(process.env.RPC_MAX_FAILURES) || 3,

  // Custom provider endpoints (comma-separated)
  customProviders: process.env.CUSTOM_RPC_PROVIDERS
    ? process.env.CUSTOM_RPC_PROVIDERS.split(",").map((p) => p.trim())
    : [],
};

// Add custom providers if specified
if (RPC_CONFIG.customProviders.length > 0) {
  RPC_PROVIDERS.primary.push(
    ...RPC_CONFIG.customProviders.map((url, index) => ({
      name: `Custom-${index + 1}`,
      http: url,
      priority: 1,
      rateLimit: { rps: 5, monthly: 10000 },
      features: ["http"],
      cost: "custom",
    }))
  );
}

// RPC Provider Manager Class
class RPCProviderManager {
  constructor() {
    this.providers = [];
    this.currentProvider = null;
    this.currentProviderIndex = 0; // For round-robin rotation
    this.providerStats = new Map();
    this.failedProviders = new Set();
    this.healthCheckInterval = RPC_CONFIG.healthCheckInterval;
    this.healthCheckTimer = null;
  }

  // Initialize provider pool
  initialize() {
    // Load all providers from configuration
    this.providers = [
      ...RPC_PROVIDERS.primary,
      ...RPC_PROVIDERS.secondary,
      ...RPC_PROVIDERS.fallback,
    ];

    console.log(`[RPC] Initialized with ${this.providers.length} providers`);

    // Initialize stats for each provider
    this.providers.forEach((provider) => {
      this.providerStats.set(provider.name, {
        requests: 0,
        errors: 0,
        lastUsed: 0,
        lastError: 0,
        avgResponseTime: 0,
        isHealthy: true,
        consecutiveFailures: 0,
      });
    });

    // Start health monitoring if rotation is enabled
    if (RPC_CONFIG.enableRotation) {
      this.startHealthMonitoring();
      console.log(
        `[RPC] Round-robin rotation enabled - will switch providers on each invocation`
      );
    }
  }

  // Get next provider using round-robin
  async getProvider(mode = "auto") {
    const availableProviders = this.providers.filter(
      (p) =>
        !this.failedProviders.has(p.name) &&
        this.providerStats.get(p.name)?.isHealthy
    );

    if (availableProviders.length === 0) {
      console.error(
        "[RPC] No healthy providers available, resetting failed providers"
      );
      this.failedProviders.clear();
      return this.providers[0]; // Return first provider as fallback
    }

    // Round-robin: get next healthy provider
    let attempts = 0;
    while (attempts < availableProviders.length) {
      const provider =
        availableProviders[
          this.currentProviderIndex % availableProviders.length
        ];
      this.currentProviderIndex =
        (this.currentProviderIndex + 1) % availableProviders.length;

      // Check if this provider is healthy
      if (
        !this.failedProviders.has(provider.name) &&
        this.providerStats.get(provider.name)?.isHealthy
      ) {
        return provider;
      }
      attempts++;
    }

    // Fallback to first available provider
    return availableProviders[0];
  }

  // Create provider instance
  async createProvider(providerConfig, mode = "auto") {
    if (mode === "websocket" && providerConfig.ws) {
      return new ethers.WebSocketProvider(providerConfig.ws);
    } else if (providerConfig.http) {
      return new ethers.JsonRpcProvider(providerConfig.http);
    } else {
      throw new Error(`No suitable endpoint for mode: ${mode}`);
    }
  }

  // Record provider usage
  recordUsage(providerName, success = true, responseTime = 0) {
    const stats = this.providerStats.get(providerName);
    if (stats) {
      stats.requests++;
      stats.lastUsed = Date.now();
      stats.avgResponseTime = (stats.avgResponseTime + responseTime) / 2;

      if (!success) {
        stats.errors++;
        stats.lastError = Date.now();
        stats.consecutiveFailures++;

        // Mark as failed if too many consecutive failures
        if (stats.consecutiveFailures >= RPC_CONFIG.maxConcurrentFailures) {
          console.log(
            `[RPC] Provider ${providerName} marked as failed due to ${stats.consecutiveFailures} consecutive failures`
          );
          this.failedProviders.add(providerName);
        }
      } else {
        stats.consecutiveFailures = 0;
      }
    }
  }

  // Health check provider
  async healthCheck(providerConfig) {
    try {
      const startTime = Date.now();
      const provider = await this.createProvider(providerConfig, "http");
      const blockNumber = await provider.getBlockNumber();
      const responseTime = Date.now() - startTime;

      this.recordUsage(providerConfig.name, true, responseTime);
      return true;
    } catch (error) {
      this.recordUsage(providerConfig.name, false);
      console.error(
        `[RPC] Health check failed for ${providerConfig.name}:`,
        error.message
      );
      return false;
    }
  }

  // Start health monitoring
  startHealthMonitoring() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      for (const provider of this.providers) {
        const isHealthy = await this.healthCheck(provider);
        const stats = this.providerStats.get(provider.name);
        if (stats) {
          stats.isHealthy = isHealthy;
        }
      }
    }, this.healthCheckInterval);

    console.log(
      `[RPC] Health monitoring started (${this.healthCheckInterval}ms interval)`
    );
  }

  // Rotate to next healthy provider (for rate limit handling)
  async rotateProvider() {
    const currentName = this.currentProvider?.config?.name;
    const nextProvider = await this.getProvider();

    if (nextProvider && nextProvider.name !== currentName) {
      console.log(
        `[RPC] Rotating from ${currentName || "none"} to ${
          nextProvider.name
        } (round-robin)`
      );
      await this.switchProvider(nextProvider);
    }
  }

  // Switch to new provider
  async switchProvider(providerConfig) {
    try {
      // Cleanup current provider
      if (this.currentProvider) {
        await this.cleanupProvider();
      }

      // Create new provider
      const mode = this.getCurrentMode();
      const newProvider = await this.createProvider(providerConfig, mode);

      this.currentProvider = {
        config: providerConfig,
        instance: newProvider,
      };

      console.log(`[RPC] Switched to ${providerConfig.name} (${mode} mode)`);

      // Reinitialize listeners if in WebSocket mode
      if (mode === "websocket") {
        this.setupWebSocketListeners(newProvider);
      }
    } catch (error) {
      console.error(
        `[RPC] Failed to switch to ${providerConfig.name}:`,
        error.message
      );
      this.failedProviders.add(providerConfig.name);
    }
  }

  // Get current mode
  getCurrentMode() {
    return MODE === "websocket" ? "websocket" : "http";
  }

  // Cleanup current provider
  async cleanupProvider() {
    if (this.currentProvider?.instance) {
      try {
        if (this.currentProvider.instance._websocket) {
          this.currentProvider.instance._websocket.close();
        }
      } catch (error) {
        console.error("[RPC] Error cleaning up provider:", error.message);
      }
    }
  }

  // Setup WebSocket listeners
  setupWebSocketListeners(provider) {
    if (provider._websocket) {
      provider._websocket.on("open", () => {
        console.log(
          `[RPC] WebSocket connected to ${this.currentProvider.config.name}`
        );
      });

      provider._websocket.on("close", () => {
        console.log(
          `[RPC] WebSocket disconnected from ${this.currentProvider.config.name}`
        );
        this.handleProviderFailure(this.currentProvider.config.name);
      });

      provider._websocket.on("error", (error) => {
        console.error(
          `[RPC] WebSocket error on ${this.currentProvider.config.name}:`,
          error
        );
        this.handleProviderFailure(this.currentProvider.config.name);
      });
    }
  }

  // Handle provider failure
  async handleProviderFailure(providerName) {
    console.log(`[RPC] Provider ${providerName} failed, switching to backup`);
    this.failedProviders.add(providerName);

    // Try to switch to next available provider
    const nextProvider = await this.getProvider();
    if (nextProvider) {
      await this.switchProvider(nextProvider);
    }
  }

  // Get provider statistics
  getStats() {
    const stats = {};
    for (const [name, data] of this.providerStats) {
      stats[name] = {
        ...data,
        errorRate:
          data.requests > 0
            ? ((data.errors / data.requests) * 100).toFixed(2) + "%"
            : "0%",
        lastUsedAgo:
          data.lastUsed > 0
            ? Math.floor((Date.now() - data.lastUsed) / 1000) + "s ago"
            : "never",
        status: this.failedProviders.has(name)
          ? "failed"
          : data.isHealthy
          ? "healthy"
          : "unhealthy",
      };
    }
    return stats;
  }

  // Get current provider instance
  getCurrentProviderInstance() {
    return this.currentProvider?.instance;
  }

  // Stop all timers
  stop() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }
}

// Initialize RPC manager
const rpcManager = new RPCProviderManager();

// Legacy ETHEREUM_RPC for backward compatibility (will be replaced by rpcManager)
const ETHEREUM_RPC =
  "wss://ethereum-mainnet.core.chainstack.com/b6dbac3a0035889f4fe0ecba93817555";

const MONITORED_ADDRESSES = [
  "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3".toLowerCase(),
];

// --- Rate Limiting Configuration ---
const RATE_LIMIT_CONFIG = {
  // Chainstack free tier: ~10 RPS, paid tiers: 50-200 RPS
  maxRequestsPerSecond: process.env.MAX_RPS || 5, // Reduced from 8 to 5 for more conservative approach
  minDelayBetweenRequests: 250, // Increased from 150ms to 250ms between requests (4 RPS)
  maxDelayBetweenRequests: 2000, // Increased from 1000ms to 2000ms max delay
  exponentialBackoffBase: 2,
  maxRetries: 3,
  retryDelayMultiplier: 1.5,
};

// --- Rate Limiting State ---
let lastRequestTime = 0;
let requestCount = 0;
let requestWindowStart = Date.now();
let consecutiveErrors = 0;
let currentDelay = RATE_LIMIT_CONFIG.minDelayBetweenRequests;

// --- Rate Limiting Functions ---
async function rateLimitedRequest(requestFn, context = "unknown") {
  const maxRetries = RATE_LIMIT_CONFIG.maxRetries;
  let retryCount = 0;

  while (retryCount <= maxRetries) {
    try {
      // Enforce rate limiting
      await enforceRateLimit();

      // Execute the request
      const startTime = Date.now();
      const result = await requestFn();
      const responseTime = Date.now() - startTime;

      // Record successful usage with RPC manager
      if (rpcManager.currentProvider) {
        rpcManager.recordUsage(
          rpcManager.currentProvider.config.name,
          true,
          responseTime
        );
      }

      // Reset error counter on success
      consecutiveErrors = 0;
      currentDelay = Math.max(
        currentDelay / RATE_LIMIT_CONFIG.retryDelayMultiplier,
        RATE_LIMIT_CONFIG.minDelayBetweenRequests
      );

      return result;
    } catch (error) {
      retryCount++;
      consecutiveErrors++;

      // Record failed usage with RPC manager
      if (rpcManager.currentProvider) {
        rpcManager.recordUsage(rpcManager.currentProvider.config.name, false);
      }

      // Check if it's a rate limit error
      if (isRateLimitError(error)) {
        const retryDelay = calculateRetryDelay(error, retryCount);
        console.log(
          `[Rate Limit] ${context} hit rate limit on ${
            rpcManager.currentProvider?.config?.name || "unknown"
          } (attempt ${retryCount}/${
            maxRetries + 1
          }), retrying in ${retryDelay}ms`
        );

        // Try switching provider on rate limit
        if (RPC_CONFIG.enableRotation) {
          await rpcManager.rotateProvider();
          provider = rpcManager.getCurrentProviderInstance();
          console.log(
            `[Rate Limit] Switched to ${
              rpcManager.currentProvider?.config?.name || "unknown"
            } provider`
          );
        }

        // Increase delay for next requests
        currentDelay = Math.min(
          currentDelay * RATE_LIMIT_CONFIG.exponentialBackoffBase,
          RATE_LIMIT_CONFIG.maxDelayBetweenRequests
        );

        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        continue;
      }

      // For non-rate-limit errors, log and potentially retry
      console.error(
        `[Rate Limit] ${context} error on ${
          rpcManager.currentProvider?.config?.name || "unknown"
        } (attempt ${retryCount}/${maxRetries + 1}):`,
        error.message
      );

      if (retryCount <= maxRetries) {
        const retryDelay =
          currentDelay *
          Math.pow(RATE_LIMIT_CONFIG.exponentialBackoffBase, retryCount);
        console.log(`[Rate Limit] ${context} retrying in ${retryDelay}ms`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        continue;
      }

      // Max retries reached
      throw error;
    }
  }
}

function isRateLimitError(error) {
  return (
    error.error?.code === -32005 ||
    error.code === -32005 ||
    (error.message && error.message.includes("RPS limit")) ||
    (error.message && error.message.includes("rate limit"))
  );
}

function calculateRetryDelay(error, retryCount) {
  // Try to extract retry delay from error response
  let baseDelay = 1000; // Default 1 second

  if (error.error?.data?.try_again_in) {
    const suggestedDelay = parseFloat(error.error.data.try_again_in);
    if (!isNaN(suggestedDelay)) {
      baseDelay = Math.max(suggestedDelay * 1000, baseDelay); // Convert to milliseconds
    }
  }

  // Apply exponential backoff
  return Math.min(
    baseDelay * Math.pow(RATE_LIMIT_CONFIG.exponentialBackoffBase, retryCount),
    RATE_LIMIT_CONFIG.maxDelayBetweenRequests
  );
}

async function enforceRateLimit() {
  const now = Date.now();

  // Reset window if needed
  if (now - requestWindowStart >= 1000) {
    requestCount = 0;
    requestWindowStart = now;
  }

  // Check if we're at the limit
  if (requestCount >= RATE_LIMIT_CONFIG.maxRequestsPerSecond) {
    const waitTime = 1000 - (now - requestWindowStart);
    if (waitTime > 0) {
      console.log(`[Rate Limit] Rate limit reached, waiting ${waitTime}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return enforceRateLimit(); // Recursive call after waiting
    }
  }

  // Enforce minimum delay between requests
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < currentDelay) {
    const waitTime = currentDelay - timeSinceLastRequest;
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  // Update state
  lastRequestTime = Date.now();
  requestCount++;
}

// --- Mode Configuration ---
// Check for environment variables or command line arguments
const MODE = process.env.BOT_MODE || process.argv[2] || "websocket"; // "websocket", "polling", or "once"
const POLLING_INTERVAL =
  parseInt(process.env.POLLING_INTERVAL) || parseInt(process.argv[3]) || 120000; // 120 seconds default (increased from 60s)
const BLOCKS_TO_SCAN =
  parseInt(process.env.BLOCKS_TO_SCAN) || parseInt(process.argv[4]) || 10; // Optimized for 50% overlap between scans

console.log(
  `[Config] Mode: ${MODE}, Polling Interval: ${POLLING_INTERVAL}ms, Blocks to Scan: ${BLOCKS_TO_SCAN}`
);
console.log(
  `[Config] Rate Limit: ${RATE_LIMIT_CONFIG.maxRequestsPerSecond} RPS, Min Delay: ${RATE_LIMIT_CONFIG.minDelayBetweenRequests}ms`
);
console.log(
  `[Config] Conservative settings: ${
    POLLING_INTERVAL / 1000
  }s interval, ${BLOCKS_TO_SCAN} blocks per scan (50% overlap)`
);
console.log(
  `[Config] RPC Rotation: ${RPC_CONFIG.enableRotation ? "ENABLED" : "DISABLED"}`
);
console.log(
  `[Config] RPC Round-Robin: ${
    RPC_CONFIG.enableRoundRobin ? "ENABLED" : "DISABLED"
  }`
);
console.log(
  `[Config] RPC Providers: ${
    RPC_PROVIDERS.primary.length +
    RPC_PROVIDERS.secondary.length +
    RPC_PROVIDERS.fallback.length
  } total`
);
console.log(
  `[Config] RPC Health Check Interval: ${
    RPC_CONFIG.healthCheckInterval / 1000
  }s`
);

// ERC-20 token contract addresses
const TOKENS = {
  USDC: {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
  },
  USDT: {
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    decimals: 6,
  },
  XIAOBAI: {
    address: "0xcb69E5750f8dC3b69647B9d8B1f45466ace0A027",
    decimals: 9,
  },
};

// Minimal ERC-20 ABI for Transfer event
const ERC20_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function balanceOf(address owner) view returns (uint256)",
];

// --- Token icons ---
const TOKEN_ICONS = {
  ETH: "🦄",
  USDC: "🪙",
  USDT: "💲",
  XIAOBAI: "��",
};

// --- Token media (Animated GIFs - optimized for Telegram) ---
const TOKEN_IMAGES = {
  ETH:
    process.env.STAGE === "prod"
      ? "https://tg-eth-wallet-bot-prod-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.gif"
      : "https://tg-eth-wallet-bot-dev-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.gif",
  USDC:
    process.env.STAGE === "prod"
      ? "https://tg-eth-wallet-bot-prod-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.gif"
      : "https://tg-eth-wallet-bot-dev-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.gif",
  USDT:
    process.env.STAGE === "prod"
      ? "https://tg-eth-wallet-bot-prod-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.gif"
      : "https://tg-eth-wallet-bot-dev-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.gif",
  XIAOBAI:
    process.env.STAGE === "prod"
      ? "https://tg-eth-wallet-bot-prod-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.gif"
      : "https://tg-eth-wallet-bot-dev-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.gif",
};

// --- Image size configuration ---
const IMAGE_SIZE_CONFIG = {
  width: 400, // Width in pixels
  height: 300, // Height in pixels
  // You can also specify different sizes for different tokens
  tokenSpecific: {
    ETH: { width: 450, height: 338 },
    USDC: { width: 400, height: 300 },
    USDT: { width: 400, height: 300 },
    XIAOBAI: { width: 500, height: 375 },
  },
};

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });

let provider;
let ethListeners = [];
let erc20Listeners = [];

// --- Lowdb setup for deposit logging ---
let db = null;
let dbInitialized = false;

// DynamoDB client for Lambda environment
let dynamoClient = null;

async function initializeDB() {
  if (dbInitialized) return db;

  const isLambda = process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (isLambda) {
    // Use DynamoDB in Lambda environment
    try {
      const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
      const { DynamoDBDocumentClient } = await import("@aws-sdk/lib-dynamodb");

      dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient());

      // Load deposits from DynamoDB
      const deposits = await loadDepositsFromDynamoDB();

      db = {
        data: { deposits },
        read: async () => {}, // No-op for DynamoDB
        write: async () => {}, // No-op for DynamoDB
      };

      console.log(`[DB] Loaded ${deposits.length} deposits from DynamoDB`);
      dbInitialized = true;
      return db;
    } catch (error) {
      console.error("[DB] Error initializing DynamoDB:", error);
      // Fallback to empty in-memory data if DynamoDB fails
      db = {
        data: { deposits: [] },
        read: async () => {},
        write: async () => {},
      };
      dbInitialized = true;
      return db;
    }
  } else {
    // Use local file storage for development
    try {
      const { Low } = await import("lowdb");
      const { JSONFile } = await import("lowdb/node");

      const dbFile = path.join(__dirname, "deposits.json");
      const adapter = new JSONFile(dbFile);
      db = new Low(adapter, { deposits: [] });

      try {
        await db.read();
        console.log(
          `[DB] Loaded ${db.data.deposits.length} deposits from file`
        );
      } catch (readError) {
        console.log("[DB] Could not read from file, using empty data");
        db.data = { deposits: [] };
      }

      dbInitialized = true;
      return db;
    } catch (error) {
      console.error("[DB] Error initializing database:", error);
      db = {
        data: { deposits: [] },
        read: async () => {},
        write: async () => {},
      };
      dbInitialized = true;
      return db;
    }
  }
}

// Load deposits from DynamoDB
async function loadDepositsFromDynamoDB() {
  if (!dynamoClient) return [];

  try {
    const { ScanCommand } = await import("@aws-sdk/lib-dynamodb");

    // Get stage from environment variable or default to 'dev'
    const stage = process.env.STAGE || "dev";
    const tableName = `tg-eth-wallet-bot-deposits-${stage}`;

    const command = new ScanCommand({
      TableName: tableName,
    });

    const response = await dynamoClient.send(command);

    // DynamoDBDocumentClient returns plain objects, no conversion needed
    const deposits = (response.Items || []).map((item) => ({
      txHash: item.txHash || "",
      token: item.token || "",
      amount: item.amount || "",
      from: item.from || "",
      to: item.to || "",
      timestamp: parseInt(item.timestamp || "0"),
    }));

    return deposits;
  } catch (error) {
    console.error("[DB] Error loading from DynamoDB:", error);
    return [];
  }
}

// Save deposit to DynamoDB
async function saveDepositToDynamoDB(deposit) {
  if (!dynamoClient) return false;

  try {
    const { PutCommand } = await import("@aws-sdk/lib-dynamodb");

    // Get stage from environment variable or default to 'dev'
    const stage = process.env.STAGE || "dev";
    const tableName = `tg-eth-wallet-bot-deposits-${stage}`;

    const command = new PutCommand({
      TableName: tableName,
      Item: {
        txHash: deposit.txHash,
        token: deposit.token,
        amount: deposit.amount,
        from: deposit.from,
        to: deposit.to,
        timestamp: deposit.timestamp,
      },
    });

    await dynamoClient.send(command);
    return true;
  } catch (error) {
    console.error("[DB] Error saving to DynamoDB:", error);
    return false;
  }
}

// In logDeposit, only log if to === MARKETING_WALLET
async function logDeposit({ token, amount, from, to, txHash }) {
  await initializeDB(); // Ensure db is initialized
  if (to.toLowerCase() !== MARKETING_WALLET)
    return { shouldSend: false, reason: "not_marketing_wallet" };

  // Check for duplicate transaction hash
  const isDuplicate = db.data.deposits.some(
    (deposit) => deposit.txHash === txHash
  );

  if (isDuplicate) {
    console.log(`[Duplicate] Skipping duplicate transaction: ${txHash}`);
    return { shouldSend: false, reason: "duplicate" };
  }

  // Return success without saving to database yet
  return { shouldSend: true, reason: "new_deposit" };
}

// New function to save deposit to database after successful message sending
async function saveDepositToDatabase({ token, amount, from, to, txHash }) {
  await initializeDB(); // Ensure db is initialized

  const deposit = {
    token,
    amount,
    from,
    to,
    txHash,
    timestamp: Date.now(),
  };

  const isLambda = process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (isLambda) {
    // Save to DynamoDB in Lambda environment
    const saved = await saveDepositToDynamoDB(deposit);
    if (saved) {
      db.data.deposits.push(deposit);
      console.log(`[DB] Saved deposit to DynamoDB: ${txHash}`);
      return true;
    } else {
      console.error(`[DB] Failed to save deposit to DynamoDB: ${txHash}`);
      return false;
    }
  } else {
    // Save to local file in development
    try {
      await db.read();
      db.data.deposits.push(deposit);
      await db.write();
      console.log(`[DB] Saved deposit to local file: ${txHash}`);
      return true;
    } catch (error) {
      console.error(
        `[DB] Failed to save deposit to local file: ${txHash}`,
        error
      );
      return false;
    }
  }
}

// New function to process deposit with message sending and database saving
async function processDeposit({ token, amount, from, to, txHash }) {
  // First check if we should process this deposit
  const depositResult = await logDeposit({ token, amount, from, to, txHash });

  if (!depositResult.shouldSend) {
    return { success: false, reason: depositResult.reason };
  }

  try {
    // Try to send the message first
    await sendDepositMessage(token, amount, from, to, txHash);

    // Only save to database if message was sent successfully
    const saved = await saveDepositToDatabase({
      token,
      amount,
      from,
      to,
      txHash,
    });

    if (saved) {
      console.log(
        `[Process] Successfully processed and saved deposit: ${txHash}`
      );
      return { success: true, reason: "message_sent_and_saved" };
    } else {
      console.log(
        `[Process] Message sent but failed to save to database: ${txHash}`
      );
      return { success: true, reason: "message_sent_db_failed" };
    }
  } catch (error) {
    console.error(
      `[Process] Failed to send message for deposit: ${txHash}`,
      error
    );
    // Don't save to database if message failed - it will be retried on next scan
    return { success: false, reason: "message_failed" };
  }
}

// Helper function to check if a transaction hash already exists
async function isTransactionProcessed(txHash) {
  await initializeDB(); // Ensure db is initialized
  return db.data.deposits.some((deposit) => deposit.txHash === txHash);
}

async function setupProviderAndListeners() {
  // Initialize RPC manager and get WebSocket provider
  await rpcManager.initialize();
  const providerConfig = await rpcManager.getProvider("websocket");
  await rpcManager.switchProvider(providerConfig);

  // Use the RPC manager's current provider instance
  provider = rpcManager.getCurrentProviderInstance();

  // --- WebSocket connection status logging ---
  if (provider._websocket) {
    provider._websocket.on("open", () => {
      console.log(
        `[WebSocket] Connection opened to ${rpcManager.currentProvider.config.name}.`
      );
    });
    provider._websocket.on("close", (code, reason) => {
      console.log(
        `[WebSocket] Connection closed to ${rpcManager.currentProvider.config.name}. Code: ${code}, Reason: ${reason}`
      );
      wsReconnects++;
      cleanupListeners();
      // Attempt to reconnect after 5 seconds
      setTimeout(async () => {
        console.log("[WebSocket] Attempting to reconnect...");
        await setupProviderAndListeners();
      }, 5000);
    });
    provider._websocket.on("error", (err) => {
      console.error(
        `[WebSocket] Connection error on ${rpcManager.currentProvider.config.name}:`,
        err
      );
    });
  }

  // --- Listen for ETH deposits in new blocks ---
  const ethListener = async (blockNumber) => {
    try {
      // Get block with full transaction objects
      const block = await provider.getBlock(blockNumber, true);
      if (!block) return;
      let ethDeposits = 0;

      // Use prefetchedTransactions for full transaction objects (ethers v6)
      const transactions = block.prefetchedTransactions || [];
      console.log(
        `[WebSocket] Block ${blockNumber} has ${transactions.length} prefetched transactions`
      );

      // First, check for ERC-20 transfers (these are in logs, not direct transactions)
      const monitoredAddress = MONITORED_ADDRESSES[0];

      for (const [symbol, { address, decimals }] of Object.entries(TOKENS)) {
        try {
          const contract = new ethers.Contract(address, ERC20_ABI, provider);
          const filter = contract.filters.Transfer(null, monitoredAddress);

          // Query events
          const events = await contract.queryFilter(
            filter,
            blockNumber,
            blockNumber
          );

          if (events.length > 0) {
            console.log(
              `[WebSocket] Found ${events.length} ${symbol} transfers to monitored address in block ${blockNumber}`
            );

            for (const event of events) {
              const { from, to, value } = event.args;
              const amount = ethers.formatUnits(value, decimals);
              const txHash =
                event.transactionHash || event.log?.transactionHash;

              if (!txHash) {
                console.warn(
                  `[Warning] No transaction hash found for ${symbol} event in block ${blockNumber}`
                );
                continue;
              }

              console.log(
                `[WebSocket] ✅ Found ${symbol} transfer in block ${blockNumber}: ${amount} ${symbol} from ${from} to ${to}`
              );

              const processResult = await processDeposit({
                token: symbol,
                amount,
                from,
                to,
                txHash: txHash,
              });

              if (processResult && processResult.success) {
                erc20Notifications++;
                const now = new Date();
                console.log(
                  `[${now.toISOString()}] ERC-20 ${symbol} deposit: ${amount} from ${from} to ${to} (${
                    processResult.reason
                  })`
                );
              }
            }
          }
        } catch (error) {
          console.error(
            `[Error] Failed to process ${symbol} events in block ${blockNumber}:`,
            error.message
          );
        }
      }

      // Now check for ETH transfers using the prefetched transaction objects
      for (let i = 0; i < transactions.length; i++) {
        const tx = transactions[i];

        if (
          tx.to &&
          MONITORED_ADDRESSES.includes(tx.to.toLowerCase()) &&
          tx.value &&
          tx.value > 0
        ) {
          const ethAmount = ethers.formatEther(tx.value);
          console.log(
            `[WebSocket] ✅ Found ETH transfer in block ${blockNumber} (position ${i}): ${ethAmount} ETH from ${tx.from} to ${tx.to}`
          );

          const processResult = await processDeposit({
            token: "ETH",
            amount: ethAmount,
            from: tx.from,
            to: tx.to,
            txHash: tx.hash,
          });

          if (processResult && processResult.success) {
            ethNotifications++;
            ethDeposits++;
          }
        }
      }

      const now = new Date();
      if (ethDeposits > 0) {
        console.log(
          `[${now.toISOString()}] Block ${blockNumber}: ETH deposits: ${ethDeposits}`
        );
      }
    } catch (e) {
      console.error("Block event error:", e);
    }
  };
  provider.on("block", ethListener);
  ethListeners.push(() => provider.off("block", ethListener));

  // --- Listen for ERC-20 deposits using Transfer event subscriptions ---
  for (const [symbol, { address, decimals }] of Object.entries(TOKENS)) {
    const contract = new ethers.Contract(address, ERC20_ABI, provider);
    const erc20Listener = async (from, to, value, event) => {
      try {
        for (const monitored of MONITORED_ADDRESSES) {
          if (to && to.toLowerCase() === monitored) {
            const amount = ethers.formatUnits(value, decimals);
            const processResult = await processDeposit({
              token: symbol,
              amount,
              from,
              to,
              txHash: event.log.transactionHash,
            });

            if (processResult && processResult.success) {
              erc20Notifications++;
              const now = new Date();
              console.log(
                `[${now.toISOString()}] ERC-20 ${symbol} deposit: ${amount} from ${from} to ${to} (${
                  processResult.reason
                })`
              );
            }
          }
        }
      } catch (e) {
        console.error("ERC-20 event error:", e);
      }
    };
    contract.on("Transfer", erc20Listener);
    erc20Listeners.push(() => contract.off("Transfer", erc20Listener));
  }
}

function cleanupListeners() {
  ethListeners.forEach((off) => off());
  erc20Listeners.forEach((off) => off());
  ethListeners = [];
  erc20Listeners = [];
  if (provider && provider._websocket) {
    provider._websocket.terminate && provider._websocket.terminate();
  }
}

// --- Helper: Send Telegram message ---
function truncateAddress(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

// Helper function to send messages with mirroring support
async function sendMessageWithMirroring(chatId, message, options = {}) {
  try {
    // Send to primary chat
    console.log(`[Mirror] Sending message to primary chat: ${chatId}`);
    const result = await bot.sendMessage(chatId, message, options);

    // Mirror to dev chat if enabled and not already in test mode
    if (MIRROR_TO_DEV && !isTestMode && chatId !== DEV_CHAT_ID) {
      console.log(`[Mirror] Mirroring message to dev chat: ${DEV_CHAT_ID}`);
      try {
        await bot.sendMessage(DEV_CHAT_ID, message, options);
        console.log(`[Mirror] Message successfully mirrored to dev chat`);
      } catch (mirrorError) {
        console.error(`[Mirror] Error mirroring to dev chat:`, mirrorError);
        // Don't fail the main message if mirroring fails
      }
    }

    return result;
  } catch (error) {
    console.error(`[Mirror] Error sending message:`, error);
    throw error;
  }
}

async function sendDepositMessage(token, amount, from, to, txHash) {
  await initializeDB(); // Ensure db is initialized

  // Get token-specific size or use default (moved to top to fix scoping issue)
  const sizeConfig = IMAGE_SIZE_CONFIG.tokenSpecific[token] || {
    width: IMAGE_SIZE_CONFIG.width,
    height: IMAGE_SIZE_CONFIG.height,
  };

  // Fetch USD prices for tokens that aren't USD-pegged
  let usdValue = null;
  if (token !== "USDC" && token !== "USDT") {
    try {
      const prices = await fetchPrices();
      if (token === "ETH") {
        usdValue = Number(amount) * prices.eth;
      } else if (token === "XIAOBAI") {
        usdValue = Number(amount) * prices.xiaobai;
      }
    } catch (error) {
      console.log(`[Price] Error fetching price for ${token}:`, error);
    }
  }

  // Format amount with USD value if available
  let formattedAmount = `<b>🟢 ${Number(amount).toLocaleString("en-US", {
    maximumFractionDigits: 18,
  })} ${token}</b>`;

  if (usdValue && usdValue > 0) {
    // Use more decimal places for very small values
    let decimalPlaces = 2;
    if (usdValue < 0.01) {
      decimalPlaces = 6; // Show up to 6 decimal places for very small values
    } else if (usdValue < 1) {
      decimalPlaces = 4; // Show up to 4 decimal places for small values
    }

    formattedAmount += ` <b>($${usdValue.toLocaleString("en-US", {
      maximumFractionDigits: decimalPlaces,
    })})</b>`;
  }

  const fromLink = `<a href="https://etherscan.io/address/${from}">${truncateAddress(
    from
  )}</a>`;
  const toLink = `<a href="https://etherscan.io/address/${to}">${truncateAddress(
    to
  )}</a>`;
  let msg = `<b>New contribution detected!</b>\n\n<b>Token:</b> ${token}\n<b>Amount:</b> ${formattedAmount}\n\n<b>From:</b> ${fromLink}\n<b>To:</b> ${toLink}\n`;
  if (txHash) {
    msg += `\n<a href=\"https://etherscan.io/tx/${txHash}\">View Transaction</a>`;
  }
  // Always add the XIAOBAI chart link
  msg += `\n<a href=\"https://www.dextools.io/app/en/token/xiaobaictoeth?t=1753120925113\">View Chart</a>`;

  // Send animated GIF (optimized for Telegram notifications)
  const imageUrl = TOKEN_IMAGES[token];

  if (imageUrl) {
    try {
      const isGif = imageUrl.toLowerCase().endsWith(".gif");
      const mediaType = isGif ? "animation" : "photo";
      console.log(
        `[Deposit] Sending ${token} deposit ${mediaType} to Telegram (${
          isTestMode ? "TEST" : "PROD"
        } mode)...`
      );

      // Construct the actual URL that would be called
      const encodedMsg = encodeURIComponent(msg);
      const apiMethod = isGif ? "sendAnimation" : "sendPhoto";
      const actualUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${apiMethod}?chat_id=${targetChat}&${
        isGif ? "animation" : "photo"
      }=${encodeURIComponent(
        imageUrl
      )}&caption=${encodedMsg}&parse_mode=HTML&disable_web_page_preview=true&width=${
        sizeConfig.width
      }&height=${sizeConfig.height}`;

      console.log(
        `[Deposit] Actual API URL (truncated for security):`,
        actualUrl.substring(0, 100) + "..."
      );
      console.log(`[Deposit] Target Chat ID: ${targetChat}`);
      console.log(`[Deposit] ${mediaType} URL: ${imageUrl}`);
      console.log(`[Deposit] Message length: ${msg.length} characters`);
      console.log(
        `[Deposit] Message content (first 200 chars):`,
        msg.substring(0, 200) + "..."
      );

      // Use sendAnimation for GIFs to preserve animation, sendPhoto for static images
      const sendMethod = isGif ? bot.sendAnimation : bot.sendPhoto;
      const methodName = isGif ? "animation" : "photo";

      await sendMethod(targetChat, imageUrl, {
        caption: msg,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        width: sizeConfig.width,
        height: sizeConfig.height,
      });
      console.log(
        `[Deposit] ${token} deposit ${methodName} sent successfully to ${
          isTestMode ? "DEV" : "PROD"
        } chat!`
      );

      // Mirroring logic
      if (MIRROR_TO_DEV && !isTestMode && targetChat !== DEV_CHAT_ID) {
        console.log(
          `[Mirror] Mirroring ${token} deposit ${methodName} to dev chat`
        );
        try {
          await sendMethod(DEV_CHAT_ID, imageUrl, {
            caption: msg,
            parse_mode: "HTML",
            disable_web_page_preview: true,
            width: sizeConfig.width,
            height: sizeConfig.height,
          });
          console.log(
            `[Mirror] ${token} deposit ${methodName} successfully mirrored to dev chat`
          );
        } catch (mirrorError) {
          console.error(
            `[Mirror] Error mirroring ${token} deposit ${methodName} to dev chat:`,
            mirrorError
          );
        }
      }
    } catch (error) {
      console.log(
        `[${mediaType}] Failed to send ${mediaType} for ${token}, falling back to text message`
      );
      // Fallback to text message
      console.log(
        `[Deposit] Falling back to text message for ${token} (${
          isTestMode ? "TEST" : "PROD"
        } mode)...`
      );
      await sendMessageWithMirroring(targetChat, msg, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
      console.log(
        `[Deposit] ${token} deposit text message sent successfully to ${
          isTestMode ? "DEV" : "PROD"
        } chat!`
      );
    }
  } else {
    console.log(
      `[Deposit] Sending ${token} deposit message to Telegram (${
        isTestMode ? "TEST" : "PROD"
      } mode)...`
    );

    // Construct the actual URL that would be called
    const encodedMsg = encodeURIComponent(msg);
    const actualUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${targetChat}&text=${encodedMsg}&parse_mode=HTML&disable_web_page_preview=true`;

    console.log(
      `[Deposit] Actual API URL (truncated for security):`,
      actualUrl.substring(0, 100) + "..."
    );
    console.log(`[Deposit] Target Chat ID: ${targetChat}`);
    console.log(`[Deposit] Message length: ${msg.length} characters`);
    console.log(
      `[Deposit] Message content (first 200 chars):`,
      msg.substring(0, 200) + "..."
    );

    await bot.sendMessage(targetChat, msg, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
    console.log(
      `[Deposit] ${token} deposit message sent successfully to ${
        isTestMode ? "DEV" : "PROD"
      } chat!`
    );

    // Mirror to dev chat if enabled and not in test mode
    if (MIRROR_TO_DEV && !isTestMode && targetChat !== DEV_CHAT_ID) {
      console.log(`[Mirror] Mirroring ${token} deposit message to dev chat`);
      try {
        await bot.sendMessage(DEV_CHAT_ID, msg, {
          parse_mode: "HTML",
          disable_web_page_preview: true,
        });
        console.log(
          `[Mirror] ${token} deposit message successfully mirrored to dev chat`
        );
      } catch (mirrorError) {
        console.error(
          `[Mirror] Error mirroring ${token} deposit message to dev chat:`,
          mirrorError
        );
      }
    }
  }
}

// --- Metrics counters ---
let ethNotifications = 0;
let erc20Notifications = 0;
let wsReconnects = 0;
let lastProcessedBlock = 0;

// --- Polling Mode Functions ---
async function scanBlocksForDeposits() {
  await initializeDB(); // Ensure db is initialized
  try {
    // Get current block number with rate limiting
    const currentBlock = await rateLimitedRequest(
      () => provider.getBlockNumber(),
      "getBlockNumber"
    );

    const startBlock = Math.max(
      lastProcessedBlock + 1,
      currentBlock - BLOCKS_TO_SCAN
    );

    // Use mode-aware logging
    const logPrefix = MODE === "once" ? "[Once]" : "[Polling]";
    console.log(
      `${logPrefix} Scanning blocks ${startBlock} to ${currentBlock} (${
        currentBlock - startBlock + 1
      } blocks)`
    );

    for (
      let blockNumber = startBlock;
      blockNumber <= currentBlock;
      blockNumber++
    ) {
      await processBlock(blockNumber);
    }

    lastProcessedBlock = currentBlock;
  } catch (error) {
    const logPrefix = MODE === "once" ? "[Once]" : "[Polling]";
    console.error(`${logPrefix} Error scanning blocks:`, error.message);
  }
}

async function processBlock(blockNumber) {
  await initializeDB(); // Ensure db is initialized

  try {
    // Get block with full transaction objects
    const block = await rateLimitedRequest(
      () => provider.getBlock(blockNumber, true),
      `getBlock(${blockNumber}, true)`
    );

    if (!block) return;

    let ethDeposits = 0;

    // Use prefetchedTransactions for full transaction objects (ethers v6)
    const transactions = block.prefetchedTransactions || [];
    const logPrefix = MODE === "once" ? "[Once]" : "[Polling]";
    console.log(
      `${logPrefix} Block ${blockNumber} has ${transactions.length} prefetched transactions`
    );

    // First, check for ERC-20 transfers (these are in logs, not direct transactions)
    const monitoredAddress = MONITORED_ADDRESSES[0];

    for (const [symbol, { address, decimals }] of Object.entries(TOKENS)) {
      try {
        const contract = new ethers.Contract(address, ERC20_ABI, provider);
        const filter = contract.filters.Transfer(null, monitoredAddress);

        // Query events with rate limiting
        const events = await rateLimitedRequest(
          () => contract.queryFilter(filter, blockNumber, blockNumber),
          `${symbol} queryFilter(${blockNumber})`
        );

        if (events.length > 0) {
          const logPrefix = MODE === "once" ? "[Once]" : "[Polling]";
          console.log(
            `${logPrefix} Found ${events.length} ${symbol} transfers to monitored address in block ${blockNumber}`
          );

          for (const event of events) {
            const { from, to, value } = event.args;
            const amount = ethers.formatUnits(value, decimals);
            const txHash = event.transactionHash || event.log?.transactionHash;

            if (!txHash) {
              console.warn(
                `[Warning] No transaction hash found for ${symbol} event in block ${blockNumber}`
              );
              continue;
            }

            const logPrefix = MODE === "once" ? "[Once]" : "[Polling]";
            console.log(
              `${logPrefix} ✅ Found ${symbol} transfer in block ${blockNumber}: ${amount} ${symbol} from ${from} to ${to}`
            );

            const processResult = await processDeposit({
              token: symbol,
              amount,
              from,
              to,
              txHash: txHash,
            });

            if (processResult && processResult.success) {
              erc20Notifications++;
              const now = new Date();
              console.log(
                `[${now.toISOString()}] ERC-20 ${symbol} deposit: ${amount} from ${from} to ${to} (${
                  processResult.reason
                })`
              );
            }
          }
        }
      } catch (error) {
        console.error(
          `[Error] Failed to process ${symbol} events in block ${blockNumber}:`,
          error.message
        );
      }
    }

    // Now check for ETH transfers using the prefetched transaction objects
    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];

      if (
        tx.to &&
        MONITORED_ADDRESSES.includes(tx.to.toLowerCase()) &&
        tx.value &&
        tx.value > 0
      ) {
        const ethAmount = ethers.formatEther(tx.value);
        const logPrefix = MODE === "once" ? "[Once]" : "[Polling]";
        console.log(
          `${logPrefix} ✅ Found ETH transfer in block ${blockNumber} (position ${i}): ${ethAmount} ETH from ${tx.from} to ${tx.to}`
        );

        const processResult = await processDeposit({
          token: "ETH",
          amount: ethAmount,
          from: tx.from,
          to: tx.to,
          txHash: tx.hash,
        });

        if (processResult && processResult.success) {
          ethNotifications++;
          ethDeposits++;
        }
      }
    }

    const now = new Date();
    if (ethDeposits > 0) {
      console.log(
        `[${now.toISOString()}] Block ${blockNumber}: ETH deposits: ${ethDeposits}`
      );
    }
  } catch (error) {
    const logPrefix = MODE === "once" ? "[Once]" : "[Polling]";
    console.error(
      `${logPrefix} Error processing block ${blockNumber}:`,
      error.message
    );
    // Don't retry here - let the rate limiting system handle retries
  }
}

// --- Mode-specific setup functions ---
function setupWebSocketMode() {
  console.log("[Mode] Setting up WebSocket mode...");
  setupProviderAndListeners();
}

async function setupPollingMode() {
  console.log("[Mode] Setting up polling mode...");

  // Initialize RPC manager and get HTTP provider
  await rpcManager.initialize();
  const providerConfig = await rpcManager.getProvider("http");
  await rpcManager.switchProvider(providerConfig);
  provider = rpcManager.getCurrentProviderInstance();

  // Initialize lastProcessedBlock with rate limiting
  rateLimitedRequest(() => provider.getBlockNumber(), "getBlockNumber")
    .then((blockNumber) => {
      lastProcessedBlock = blockNumber - 1;
      console.log(
        `[Polling] Initialized lastProcessedBlock to ${lastProcessedBlock} using ${rpcManager.currentProvider.config.name}`
      );
    })
    .catch((error) => {
      console.error(
        "[Polling] Error initializing lastProcessedBlock:",
        error.message
      );
      lastProcessedBlock = 0;
    });

  // Start polling interval
  setInterval(scanBlocksForDeposits, POLLING_INTERVAL);

  // Initial scan
  setTimeout(scanBlocksForDeposits, 5000);
}

async function setupOnceMode() {
  console.log("[Mode] Setting up 'once' mode...");

  // Initialize RPC manager and get HTTP provider
  await rpcManager.initialize();
  const providerConfig = await rpcManager.getProvider("http");
  await rpcManager.switchProvider(providerConfig);
  provider = rpcManager.getCurrentProviderInstance();

  await initializeDB(); // Ensure db is initialized

  try {
    // Get current block number with rate limiting
    const currentBlock = await rateLimitedRequest(
      () => provider.getBlockNumber(),
      "getBlockNumber"
    );
    lastProcessedBlock = currentBlock - BLOCKS_TO_SCAN;

    console.log(
      `[Once] Scanning blocks ${lastProcessedBlock + 1} to ${currentBlock}`
    );

    // Store initial notification counts
    const initialEthNotifications = ethNotifications;
    const initialErc20Notifications = erc20Notifications;

    // Perform single scan
    await scanBlocksForDeposits();

    // Calculate results
    const ethFound = ethNotifications - initialEthNotifications;
    const erc20Found = erc20Notifications - initialErc20Notifications;
    const totalFound = ethFound + erc20Found;

    console.log(`[Once] Scan Results:`);
    console.log(`  - ETH deposits found: ${ethFound}`);
    console.log(`  - ERC-20 deposits found: ${erc20Found}`);
    console.log(`  - Total deposits found: ${totalFound}`);
    console.log(`  - Blocks scanned: ${BLOCKS_TO_SCAN}`);
    console.log(`  - Scan range: ${lastProcessedBlock + 1} to ${currentBlock}`);

    if (totalFound > 0) {
      console.log(`[Once] ✅ New deposits detected and notifications sent!`);
    } else {
      console.log(`[Once] ℹ️  No new deposits found in scanned blocks.`);
    }

    console.log("[Once] Scan complete.");

    // Return result instead of calling process.exit()
    return {
      success: true,
      ethFound,
      erc20Found,
      totalFound,
      blocksScanned: BLOCKS_TO_SCAN,
      scanRange: `${lastProcessedBlock + 1} to ${currentBlock}`,
    };
  } catch (error) {
    console.error("[Once] Error during scan:", error.message);

    // Return error result instead of calling process.exit()
    return {
      success: false,
      error: error.message,
    };
  }
}

// --- Metrics logging interval ---
// setInterval(() => {
//   const total = ethNotifications + erc20Notifications;
//   const avgPerSec = (total / 60).toFixed(2);
//   console.log(
//     `[Metrics] Last 60s: ETH notifications: ${ethNotifications}, ERC-20 notifications: ${erc20Notifications}, Total: ${total}, Avg/sec: ${avgPerSec}, WS reconnects: ${wsReconnects}`
//   );
//   ethNotifications = 0;
//   erc20Notifications = 0;
//   wsReconnects = 0;
// }, 60 * 1000);

// --- Configuration for periodic summary ---
const MARKETING_WALLET =
  "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3".toLowerCase();

// Helper to get current balances for the marketing wallet
async function getMarketingWalletBalances() {
  await initializeDB(); // Ensure db is initialized
  const balances = {};

  // ETH balance with rate limiting
  const ethBalance = await rateLimitedRequest(
    () => provider.getBalance(MARKETING_WALLET),
    "getBalance"
  );
  balances.ETH = ethers.formatEther(ethBalance);

  // ERC-20 balances with rate limiting
  for (const [symbol, { address, decimals }] of Object.entries(TOKENS)) {
    try {
      const contract = new ethers.Contract(address, ERC20_ABI, provider);
      const bal = await rateLimitedRequest(
        () => contract.balanceOf(MARKETING_WALLET),
        `${symbol} balanceOf`
      );
      balances[symbol] = ethers.formatUnits(bal, decimals);
    } catch (error) {
      console.error(
        `[Balance] Error getting ${symbol} balance:`,
        error.message
      );
      balances[symbol] = "0";
    }
  }

  return balances;
}

// Helper to sum deposits by time window (ms)
async function sumDeposits(deposits, sinceMs) {
  await initializeDB(); // Ensure db is initialized
  const now = Date.now();
  return deposits
    .filter((d) => now - d.timestamp <= sinceMs)
    .reduce((acc, d) => {
      acc[d.token] = (acc[d.token] || 0) + Number(d.amount);
      return acc;
    }, {});
}

// Helper to fetch prices from CoinGecko
async function fetchPrices() {
  const url =
    "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,xiaobai&vs_currencies=usd";
  try {
    const res = await fetch(url);
    const data = await res.json();
    return {
      eth: data.ethereum?.usd || 0,
      xiaobai: data.xiaobai?.usd || 0,
    };
  } catch (e) {
    console.error("Error fetching prices from CoinGecko:", e);
    return { eth: 0, xiaobai: 0 };
  }
}

// Update sendHourlySummary to include USD values for ETH and XIAOBAI
async function sendHourlySummary() {
  console.log("[Summary] Starting hourly summary generation...");
  await initializeDB(); // Ensure db is initialized

  // Initialize provider if not already set (for Lambda calls)
  if (!provider) {
    console.log("[Summary] Initializing provider for Lambda...");
    provider = new ethers.JsonRpcProvider(
      ETHEREUM_RPC.replace("wss://", "https://")
    );
  }

  const deposits = db.data.deposits.filter(
    (d) => d.to && d.to.toLowerCase() === MARKETING_WALLET
  );
  console.log(
    `[Summary] Found ${deposits.length} deposits for marketing wallet`
  );

  console.log("[Summary] Fetching wallet balances...");
  const balances = await getMarketingWalletBalances();
  console.log("[Summary] Balances:", balances);

  console.log("[Summary] Fetching token prices...");
  const prices = await fetchPrices();
  console.log("[Summary] Prices:", prices);

  console.log("[Summary] Calculating deposit totals...");
  const dayTotals = await sumDeposits(deposits, 24 * 60 * 60 * 1000);
  const weekTotals = await sumDeposits(deposits, 7 * 24 * 60 * 60 * 1000);
  const monthTotals = await sumDeposits(deposits, 30 * 24 * 60 * 60 * 1000);
  console.log("[Summary] Day totals:", dayTotals);
  console.log("[Summary] Week totals:", weekTotals);
  console.log("[Summary] Month totals:", monthTotals);

  // Helper function to calculate total USD value for a time period
  function calculateTotalUsdValue(totals, prices) {
    let totalUsd = 0;

    // ETH value
    if (totals.ETH) {
      totalUsd += Number(totals.ETH) * prices.eth;
    }

    // USDC and USDT (assumed $1 each)
    if (totals.USDC) {
      totalUsd += Number(totals.USDC);
    }
    if (totals.USDT) {
      totalUsd += Number(totals.USDT);
    }

    // XIAOBAI value
    if (totals.XIAOBAI) {
      totalUsd += Number(totals.XIAOBAI) * prices.xiaobai;
    }

    return totalUsd;
  }

  function fmt(val, token, usd) {
    const amount = Number(val || 0);
    let str = `<b>${amount.toLocaleString("en-US", {
      maximumFractionDigits: 8,
    })} ${token}</b>`;
    if (usd) {
      str += ` ($${Number(usd).toLocaleString("en-US", {
        maximumFractionDigits: 2,
      })})`;
    }
    return str;
  }

  let msg = `<b>📊 Marketing Wallet Summary</b>\n\n`;
  msg += `<b>Current Balances:</b>\n`;
  // ETH with USD value
  const ethUsd = Number(balances.ETH) * prices.eth;
  msg += `ETH: ${fmt(balances.ETH, "ETH", ethUsd)}\n`;
  // USDC and USDT (no price fetch, assumed $1)
  msg += `USDC: ${fmt(balances.USDC, "USDC", Number(balances.USDC))}\n`;
  msg += `USDT: ${fmt(balances.USDT, "USDT", Number(balances.USDT))}\n`;
  // XIAOBAI with USD value
  const xiaobaiUsd = Number(balances.XIAOBAI) * prices.xiaobai;
  msg += `XIAOBAI: ${fmt(balances.XIAOBAI, "XIAOBAI", xiaobaiUsd)}\n`;
  msg += `\n<b>Total Contributions:</b>\n`;

  // Calculate total USD values for each period
  const dayTotalUsd = calculateTotalUsdValue(dayTotals, prices);
  const weekTotalUsd = calculateTotalUsdValue(weekTotals, prices);
  const monthTotalUsd = calculateTotalUsdValue(monthTotals, prices);

  msg += `Last 24h: `;
  for (const symbol of ["ETH", ...Object.keys(TOKENS)]) {
    const amount = dayTotals[symbol] || 0;
    msg += `${fmt(amount, symbol)}; `;
  }
  msg += `<b>TOTAL</b> ($${dayTotalUsd.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })})`;

  msg += `\n\nLast 7d: `;
  for (const symbol of ["ETH", ...Object.keys(TOKENS)]) {
    const amount = weekTotals[symbol] || 0;
    msg += `${fmt(amount, symbol)}; `;
  }
  msg += `<b>TOTAL</b> ($${weekTotalUsd.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })})`;

  msg += `\n\nLast 30d: `;
  for (const symbol of ["ETH", ...Object.keys(TOKENS)]) {
    const amount = monthTotals[symbol] || 0;
    msg += `${fmt(amount, symbol)}; `;
  }
  msg += `<b>TOTAL</b> ($${monthTotalUsd.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })})`;
  msg += `\n\nKeep contributing to beat the previous records! 🚀\n`;
  // Always add the XIAOBAI chart link
  msg += `<a href=\"https://www.dextools.io/app/en/token/xiaobaictoeth?t=1753120925113\">View Chart</a>`;

  console.log("[Summary] Generated message length:", msg.length, "characters");
  // Log a simple preview without emojis to avoid encoding issues
  const plainPreview = msg.replace(/[^\x00-\x7F]/g, "?").substring(0, 200);
  console.log("[Summary] Message preview (plain):", plainPreview + "...");

  try {
    console.log(
      `[Summary] Sending summary message to Telegram (${
        isTestMode ? "TEST" : "PROD"
      } mode)...`
    );

    // Construct the actual URL that would be called
    const encodedMsg = encodeURIComponent(msg);
    const actualUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${targetChat}&text=${encodedMsg}&parse_mode=HTML&disable_web_page_preview=true`;

    console.log(
      "[Summary] Actual API URL (truncated for security):",
      actualUrl.substring(0, 100) + "..."
    );
    console.log("[Summary] Target Chat ID:", targetChat);
    console.log("[Summary] Message length:", msg.length, "characters");
    console.log(
      "[Summary] Message content (first 200 chars):",
      msg.substring(0, 200) + "..."
    );

    await sendMessageWithMirroring(targetChat, msg, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
    console.log(
      `[Summary] Summary message sent successfully to ${
        isTestMode ? "DEV" : "PROD"
      } chat!`
    );
  } catch (error) {
    console.error("[Summary] Error sending summary message:", error);
    console.error("[Summary] Error details:", {
      message: error.message,
      code: error.code,
      statusCode: error.response?.statusCode,
      statusMessage: error.response?.statusMessage,
    });
    throw error; // Re-throw to ensure Lambda knows about the failure
  }
}

// Schedule periodic summary (only for local development, Lambda uses CloudWatch Events)
const SUMMARY_INTERVAL = process.env.SUMMARY_INTERVAL || 3 * 60 * 60 * 1000; // Default 3 hours
setInterval(sendHourlySummary, SUMMARY_INTERVAL);
// Optionally, send one immediately on startup
//sendHourlySummary();

// Helper function to send test messages to DEV chat only
async function sendTestMessageToDev(token, amount, from, to, txHash) {
  console.log(`[Test] Sending test ${token} message to DEV chat only...`);

  // Get token-specific size or use default
  const sizeConfig = IMAGE_SIZE_CONFIG.tokenSpecific[token] || {
    width: IMAGE_SIZE_CONFIG.width,
    height: IMAGE_SIZE_CONFIG.height,
  };

  // Fetch USD prices for tokens that aren't USD-pegged
  let usdValue = null;
  if (token !== "USDC" && token !== "USDT") {
    try {
      const prices = await fetchPrices();
      if (token === "ETH") {
        usdValue = Number(amount) * prices.eth;
      } else if (token === "XIAOBAI") {
        usdValue = Number(amount) * prices.xiaobai;
      }
    } catch (error) {
      console.log(`[Price] Error fetching price for ${token}:`, error);
    }
  }

  // Format amount with USD value if available
  let formattedAmount = `<b>🟢 ${Number(amount).toLocaleString("en-US", {
    maximumFractionDigits: 18,
  })} ${token}</b>`;

  if (usdValue && usdValue > 0) {
    // Use more decimal places for very small values
    let decimalPlaces = 2;
    if (usdValue < 0.01) {
      decimalPlaces = 6; // Show up to 6 decimal places for very small values
    } else if (usdValue < 1) {
      decimalPlaces = 4; // Show up to 4 decimal places for small values
    }

    formattedAmount += ` <b>($${usdValue.toLocaleString("en-US", {
      maximumFractionDigits: decimalPlaces,
    })})</b>`;
  }

  const fromLink = `<a href="https://etherscan.io/address/${from}">${truncateAddress(
    from
  )}</a>`;
  const toLink = `<a href="https://etherscan.io/address/${to}">${truncateAddress(
    to
  )}</a>`;
  let msg = `<b>🧪 TEST MESSAGE - New contribution detected!</b>\n\n<b>Token:</b> ${token}\n<b>Amount:</b> ${formattedAmount}\n\n<b>From:</b> ${fromLink}\n<b>To:</b> ${toLink}\n`;
  if (txHash) {
    msg += `\n<a href=\"https://etherscan.io/tx/${txHash}\">View Transaction</a>`;
  }
  // Always add the XIAOBAI chart link
  msg += `\n<a href=\"https://www.dextools.io/app/en/token/xiaobaictoeth?t=1753120925113\">View Chart</a>`;

  // Send animated GIF (optimized for Telegram notifications)
  const imageUrl = TOKEN_IMAGES[token];

  if (imageUrl) {
    try {
      const isGif = imageUrl.toLowerCase().endsWith(".gif");
      const mediaType = isGif ? "animation" : "photo";
      console.log(`[Test] Sending ${token} test ${mediaType} to DEV chat...`);

      // Use sendAnimation for GIFs to preserve animation, sendPhoto for static images
      const sendMethod = isGif ? bot.sendAnimation : bot.sendPhoto;
      const methodName = isGif ? "animation" : "photo";

      await sendMethod(DEV_CHAT_ID, imageUrl, {
        caption: msg,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        width: sizeConfig.width,
        height: sizeConfig.height,
      });
      console.log(
        `[Test] ${token} test ${methodName} sent successfully to DEV chat!`
      );
      return;
    } catch (error) {
      const mediaType = imageUrl.toLowerCase().endsWith(".gif")
        ? "animation"
        : "photo";
      console.log(
        `[Test] Failed to send ${mediaType} for ${token}, falling back to text`
      );
    }
  }

  // Final fallback to text message
  console.log(`[Test] Sending ${token} test text message to DEV chat...`);
  await bot.sendMessage(DEV_CHAT_ID, msg, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
  console.log(
    `[Test] ${token} test text message sent successfully to DEV chat!`
  );
}

// Test functions for each token type
async function sendTestEthMessage() {
  try {
    await sendTestMessageToDev(
      "ETH",
      "0.05", // 0.05 ETH (~$150)
      "0x1111111111111111111111111111111111111111",
      MARKETING_WALLET,
      "0x3333333333333333333333333333333333333333333333333333333333333333"
    );
  } catch (error) {
    console.error("[Test] Error sending ETH test message:", error);
  }
}

async function sendTestUsdcMessage() {
  try {
    await sendTestMessageToDev(
      "USDC",
      "150", // 150 USDC
      "0x1111111111111111111111111111111111111111",
      MARKETING_WALLET,
      "0x3333333333333333333333333333333333333333333333333333333333333333"
    );
  } catch (error) {
    console.error("[Test] Error sending USDC test message:", error);
  }
}

async function sendTestUsdtMessage() {
  try {
    await sendTestMessageToDev(
      "USDT",
      "250", // 250 USDT
      "0x1111111111111111111111111111111111111111",
      MARKETING_WALLET,
      "0x3333333333333333333333333333333333333333333333333333333333333333"
    );
  } catch (error) {
    console.error("[Test] Error sending USDT test message:", error);
  }
}

async function sendTestXiaobaiMessage() {
  try {
    await sendTestMessageToDev(
      "XIAOBAI",
      "50000000", // 50 million XIAOBAI tokens (~$7.50)
      "0x1111111111111111111111111111111111111111",
      MARKETING_WALLET,
      "0x3333333333333333333333333333333333333333333333333333333333333333"
    );
  } catch (error) {
    console.error("[Test] Error sending XIAOBAI test message:", error);
  }
}

// Combined test function to send all token types
async function sendAllTestMessages() {
  console.log("[Test] Sending test messages for all token types...");
  try {
    await sendTestEthMessage();
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds

    await sendTestUsdcMessage();
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds

    await sendTestUsdtMessage();
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds

    await sendTestXiaobaiMessage();

    console.log("[Test] All test messages sent successfully!");
  } catch (error) {
    console.error("[Test] Error sending test messages:", error);
  }
}

// Send a test message on startup
// (async () => {
//   await sendDepositMessage(
//     "XIAOBAI",
//     "123456.789",
//     "0x1111111111111111111111111111111111111111",
//     "0x2222222222222222222222222222222222222222",
//     "0x3333333333333333333333333333333333333333333333333333333333333333"
//   );
// })();

// Export functions for Lambda
module.exports = {
  setupOnceMode,
  setupWebSocketMode,
  setupPollingMode,
  sendDepositMessage,
  logDeposit,
  saveDepositToDatabase,
  processDeposit,
  isTransactionProcessed,
  sendHourlySummary,
  sendTestMessageToDev,
  sendTestEthMessage,
  sendTestUsdcMessage,
  sendTestUsdtMessage,
  sendTestXiaobaiMessage,
  sendAllTestMessages,
  initializeDB,
  // Export RPC manager and related functions
  rpcManager,
  getRPCStats: () => rpcManager.getStats(),
  // Export utility functions for testing
  truncateAddress,
  isRateLimitError,
  calculateRetryDelay,
  rateLimitedRequest,
  enforceRateLimit,
};

// Main execution based on mode - only run if this file is executed directly
if (require.main === module) {
  (async () => {
    try {
      if (MODE === "websocket") {
        await setupWebSocketMode();
        console.log(
          "Bot is running in WebSocket mode and listening for deposits via subscriptions..."
        );
      } else if (MODE === "polling") {
        await setupPollingMode();
        console.log(
          `Bot is running in polling mode, scanning every ${POLLING_INTERVAL}ms...`
        );
      } else if (MODE === "once") {
        await setupOnceMode();
      } else {
        console.error(
          `[Main] Invalid mode: ${MODE}. Use 'websocket', 'polling', or 'once'. Exiting.`
        );
        process.exit(1);
      }
    } catch (error) {
      console.error("[Main] Error during setup:", error);
      process.exit(1);
    }
  })();
}
