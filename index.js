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
const ETHEREUM_RPC =
  "wss://ethereum-mainnet.core.chainstack.com/b6dbac3a0035889f4fe0ecba93817555";
const MONITORED_ADDRESSES = [
  "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3".toLowerCase(),
];

// --- Mode Configuration ---
// Check for environment variables or command line arguments
const MODE = process.env.BOT_MODE || process.argv[2] || "websocket"; // "websocket", "polling", or "once"
const POLLING_INTERVAL =
  parseInt(process.env.POLLING_INTERVAL) || parseInt(process.argv[3]) || 60000; // 60 seconds default
const BLOCKS_TO_SCAN =
  parseInt(process.env.BLOCKS_TO_SCAN) || parseInt(process.argv[4]) || 7; // Number of blocks to scan in polling mode

console.log(
  `[Config] Mode: ${MODE}, Polling Interval: ${POLLING_INTERVAL}ms, Blocks to Scan: ${BLOCKS_TO_SCAN}`
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

// --- Token videos (MP4) ---
const TOKEN_VIDEOS = {
  ETH:
    process.env.STAGE === "prod"
      ? "https://tg-eth-wallet-bot-prod-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.mp4"
      : "https://tg-eth-wallet-bot-dev-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.mp4",
  USDC:
    process.env.STAGE === "prod"
      ? "https://tg-eth-wallet-bot-prod-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.mp4"
      : "https://tg-eth-wallet-bot-dev-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.mp4",
  USDT:
    process.env.STAGE === "prod"
      ? "https://tg-eth-wallet-bot-prod-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.mp4"
      : "https://tg-eth-wallet-bot-dev-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.mp4",
  XIAOBAI:
    process.env.STAGE === "prod"
      ? "https://tg-eth-wallet-bot-prod-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.mp4"
      : "https://tg-eth-wallet-bot-dev-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.mp4",
};

// --- Token images (GIF fallback from same video) ---
const TOKEN_IMAGES = {
  ETH:
    process.env.STAGE === "prod"
      ? "https://tg-eth-wallet-bot-prod-assets.s3.amazonaws.com/xiaobai_ani.gif"
      : "https://tg-eth-wallet-bot-dev-assets.s3.amazonaws.com/xiaobai_ani.gif",
  USDC:
    process.env.STAGE === "prod"
      ? "https://tg-eth-wallet-bot-prod-assets.s3.amazonaws.com/xiaobai_ani.gif"
      : "https://tg-eth-wallet-bot-dev-assets.s3.amazonaws.com/xiaobai_ani.gif",
  USDT:
    process.env.STAGE === "prod"
      ? "https://tg-eth-wallet-bot-prod-assets.s3.amazonaws.com/xiaobai_ani.gif"
      : "https://tg-eth-wallet-bot-dev-assets.s3.amazonaws.com/xiaobai_ani.gif",
  XIAOBAI:
    process.env.STAGE === "prod"
      ? "https://tg-eth-wallet-bot-prod-assets.s3.amazonaws.com/xiaobai_ani.gif"
      : "https://tg-eth-wallet-bot-dev-assets.s3.amazonaws.com/xiaobai_ani.gif",
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
    const { ScanCommand } = await import("@aws-sdk/client-dynamodb");

    // Get stage from environment variable or default to 'dev'
    const stage = process.env.STAGE || "dev";
    const tableName = `tg-eth-wallet-bot-deposits-${stage}`;

    const command = new ScanCommand({
      TableName: tableName,
    });

    const response = await dynamoClient.send(command);

    // Convert DynamoDB format to plain objects
    const deposits = (response.Items || []).map((item) => ({
      txHash: item.txHash?.S || "",
      token: item.token?.S || "",
      amount: item.amount?.S || "",
      from: item.from?.S || "",
      to: item.to?.S || "",
      timestamp: parseInt(item.timestamp?.N || "0"),
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
    const { PutCommand } = await import("@aws-sdk/client-dynamodb");

    // Get stage from environment variable or default to 'dev'
    const stage = process.env.STAGE || "dev";
    const tableName = `tg-eth-wallet-bot-deposits-${stage}`;

    const command = new PutCommand({
      TableName: tableName,
      Item: {
        txHash: { S: deposit.txHash },
        token: { S: deposit.token },
        amount: { S: deposit.amount },
        from: { S: deposit.from },
        to: { S: deposit.to },
        timestamp: { N: deposit.timestamp.toString() },
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
  if (to.toLowerCase() !== MARKETING_WALLET) return;

  const isLambda = process.env.AWS_LAMBDA_FUNCTION_NAME;

  // Check for duplicate transaction hash
  const isDuplicate = db.data.deposits.some(
    (deposit) => deposit.txHash === txHash
  );

  if (isDuplicate) {
    console.log(`[Duplicate] Skipping duplicate transaction: ${txHash}`);
    return false; // Indicate this was a duplicate
  }

  const deposit = {
    token,
    amount,
    from,
    to,
    txHash,
    timestamp: Date.now(),
  };

  if (isLambda) {
    // Save to DynamoDB in Lambda environment
    const saved = await saveDepositToDynamoDB(deposit);
    if (saved) {
      db.data.deposits.push(deposit);
      console.log(`[DB] Saved deposit to DynamoDB: ${txHash}`);
    } else {
      console.error(`[DB] Failed to save deposit to DynamoDB: ${txHash}`);
      return false;
    }
  } else {
    // Save to local file in development
    await db.read();
    db.data.deposits.push(deposit);
    await db.write();
  }

  return true; // Indicate this was a new deposit
}

// Helper function to check if a transaction hash already exists
async function isTransactionProcessed(txHash) {
  await initializeDB(); // Ensure db is initialized
  return db.data.deposits.some((deposit) => deposit.txHash === txHash);
}

function setupProviderAndListeners() {
  provider = new ethers.WebSocketProvider(ETHEREUM_RPC);

  // --- WebSocket connection status logging ---
  if (provider._websocket) {
    provider._websocket.on("open", () => {
      console.log("[WebSocket] Connection opened to Ethereum node.");
    });
    provider._websocket.on("close", (code, reason) => {
      console.log(
        `[WebSocket] Connection closed. Code: ${code}, Reason: ${reason}`
      );
      wsReconnects++;
      cleanupListeners();
      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        console.log("[WebSocket] Attempting to reconnect...");
        setupProviderAndListeners();
      }, 5000);
    });
    provider._websocket.on("error", (err) => {
      console.error("[WebSocket] Connection error:", err);
    });
  }

  // --- Listen for ETH deposits in new blocks ---
  const ethListener = async (blockNumber) => {
    try {
      const block = await provider.getBlock(blockNumber, true);
      if (!block) return;
      let ethDeposits = 0;
      for (const tx of block.transactions) {
        if (
          tx.to &&
          MONITORED_ADDRESSES.includes(tx.to.toLowerCase()) &&
          tx.value &&
          tx.value > 0
        ) {
          const ethAmount = ethers.formatEther(tx.value);
          const wasNewDeposit = await logDeposit({
            token: "ETH",
            amount: ethAmount,
            from: tx.from,
            to: tx.to,
            txHash: tx.hash,
          });

          if (wasNewDeposit) {
            await sendDepositMessage("ETH", ethAmount, tx.from, tx.to, tx.hash);
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
            const wasNewDeposit = await logDeposit({
              token: symbol,
              amount,
              from,
              to,
              txHash: event.log.transactionHash,
            });

            if (wasNewDeposit) {
              await sendDepositMessage(
                symbol,
                amount,
                from,
                to,
                event.log.transactionHash
              );
              erc20Notifications++;
              const now = new Date();
              console.log(
                `[${now.toISOString()}] ERC-20 ${symbol} deposit: ${amount} from ${from} to ${to}`
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

  // Try to send video first, fallback to image, then text
  const videoUrl = TOKEN_VIDEOS[token];
  const imageUrl = TOKEN_IMAGES[token];

  if (videoUrl) {
    try {
      console.log(
        `[Deposit] Sending ${token} deposit video to Telegram (${
          isTestMode ? "TEST" : "PROD"
        } mode)...`
      );

      // Construct the actual URL that would be called
      const encodedMsg = encodeURIComponent(msg);
      const actualUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo?chat_id=${targetChat}&video=${encodeURIComponent(
        videoUrl
      )}&caption=${encodedMsg}&parse_mode=HTML&disable_web_page_preview=true&width=${
        sizeConfig.width
      }&height=${sizeConfig.height}&supports_streaming=true`;

      console.log(
        `[Deposit] Actual API URL (truncated for security):`,
        actualUrl.substring(0, 100) + "..."
      );
      console.log(`[Deposit] Target Chat ID: ${targetChat}`);
      console.log(`[Deposit] Video URL: ${videoUrl}`);
      console.log(`[Deposit] Message length: ${msg.length} characters`);
      console.log(
        `[Deposit] Message content (first 200 chars):`,
        msg.substring(0, 200) + "..."
      );

      // Get token-specific size or use default
      const sizeConfig = IMAGE_SIZE_CONFIG.tokenSpecific[token] || {
        width: IMAGE_SIZE_CONFIG.width,
        height: IMAGE_SIZE_CONFIG.height,
      };

      await bot.sendVideo(targetChat, videoUrl, {
        caption: msg,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        width: sizeConfig.width,
        height: sizeConfig.height,
        supports_streaming: true, // Enable streaming for better performance
      });
      console.log(
        `[Deposit] ${token} deposit video sent successfully to ${
          isTestMode ? "DEV" : "PROD"
        } chat!`
      );

      // Mirror to dev chat if enabled and not in test mode
      if (MIRROR_TO_DEV && !isTestMode && targetChat !== DEV_CHAT_ID) {
        console.log(`[Mirror] Mirroring ${token} deposit video to dev chat`);
        try {
          await bot.sendVideo(DEV_CHAT_ID, videoUrl, {
            caption: msg,
            parse_mode: "HTML",
            disable_web_page_preview: true,
            width: sizeConfig.width,
            height: sizeConfig.height,
            supports_streaming: true,
          });
          console.log(
            `[Mirror] ${token} deposit video successfully mirrored to dev chat`
          );
        } catch (mirrorError) {
          console.error(
            `[Mirror] Error mirroring ${token} deposit video to dev chat:`,
            mirrorError
          );
        }
      }
    } catch (error) {
      console.log(
        `[Video] Failed to send video for ${token}, falling back to image`
      );
      // Fallback to image
      if (imageUrl) {
        console.log(
          `[Deposit] Falling back to ${token} deposit photo (${
            isTestMode ? "TEST" : "PROD"
          } mode)...`
        );

        // Construct the actual URL that would be called
        const encodedMsg = encodeURIComponent(msg);
        const actualUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto?chat_id=${targetChat}&photo=${encodeURIComponent(
          imageUrl
        )}&caption=${encodedMsg}&parse_mode=HTML&disable_web_page_preview=true&width=${
          sizeConfig.width
        }&height=${sizeConfig.height}`;

        console.log(
          `[Deposit] Actual API URL (truncated for security):`,
          actualUrl.substring(0, 100) + "..."
        );
        console.log(`[Deposit] Target Chat ID: ${targetChat}`);
        console.log(`[Deposit] Image URL: ${imageUrl}`);
        console.log(`[Deposit] Message length: ${msg.length} characters`);
        console.log(
          `[Deposit] Message content (first 200 chars):`,
          msg.substring(0, 200) + "..."
        );

        // Get token-specific size or use default
        const sizeConfig = IMAGE_SIZE_CONFIG.tokenSpecific[token] || {
          width: IMAGE_SIZE_CONFIG.width,
          height: IMAGE_SIZE_CONFIG.height,
        };

        await bot.sendPhoto(targetChat, imageUrl, {
          caption: msg,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          width: sizeConfig.width,
          height: sizeConfig.height,
        });
        console.log(
          `[Deposit] ${token} deposit photo sent successfully to ${
            isTestMode ? "DEV" : "PROD"
          } chat!`
        );

        // Mirror to dev chat if enabled and not in test mode
        if (MIRROR_TO_DEV && !isTestMode && targetChat !== DEV_CHAT_ID) {
          console.log(`[Mirror] Mirroring ${token} deposit photo to dev chat`);
          try {
            await bot.sendPhoto(DEV_CHAT_ID, imageUrl, {
              caption: msg,
              parse_mode: "HTML",
              disable_web_page_preview: true,
              width: sizeConfig.width,
              height: sizeConfig.height,
            });
            console.log(
              `[Mirror] ${token} deposit photo successfully mirrored to dev chat`
            );
          } catch (mirrorError) {
            console.error(
              `[Mirror] Error mirroring ${token} deposit photo to dev chat:`,
              mirrorError
            );
          }
        }
      } else {
        console.log(
          `[Deposit] Final fallback: sending ${token} deposit text message (${
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
          `[Deposit] ${token} deposit text message sent successfully to ${
            isTestMode ? "DEV" : "PROD"
          } chat!`
        );

        // Mirror to dev chat if enabled and not in test mode
        if (MIRROR_TO_DEV && !isTestMode && targetChat !== DEV_CHAT_ID) {
          console.log(
            `[Mirror] Mirroring ${token} deposit text message to dev chat`
          );
          try {
            await bot.sendMessage(DEV_CHAT_ID, msg, {
              parse_mode: "HTML",
              disable_web_page_preview: true,
            });
            console.log(
              `[Mirror] ${token} deposit text message successfully mirrored to dev chat`
            );
          } catch (mirrorError) {
            console.error(
              `[Mirror] Error mirroring ${token} deposit text message to dev chat:`,
              mirrorError
            );
          }
        }
      }
    }
  } else if (imageUrl) {
    console.log(
      `[Deposit] Sending ${token} deposit photo to Telegram (${
        isTestMode ? "TEST" : "PROD"
      } mode)...`
    );

    // Construct the actual URL that would be called
    const encodedMsg = encodeURIComponent(msg);
    const actualUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto?chat_id=${targetChat}&photo=${encodeURIComponent(
      imageUrl
    )}&caption=${encodedMsg}&parse_mode=HTML&disable_web_page_preview=true&width=${
      sizeConfig.width
    }&height=${sizeConfig.height}`;

    console.log(
      `[Deposit] Actual API URL (truncated for security):`,
      actualUrl.substring(0, 100) + "..."
    );
    console.log(`[Deposit] Target Chat ID: ${targetChat}`);
    console.log(`[Deposit] Image URL: ${imageUrl}`);
    console.log(`[Deposit] Message length: ${msg.length} characters`);
    console.log(
      `[Deposit] Message content (first 200 chars):`,
      msg.substring(0, 200) + "..."
    );

    // Get token-specific size or use default
    const sizeConfig = IMAGE_SIZE_CONFIG.tokenSpecific[token] || {
      width: IMAGE_SIZE_CONFIG.width,
      height: IMAGE_SIZE_CONFIG.height,
    };

    await bot.sendPhoto(targetChat, imageUrl, {
      caption: msg,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      width: sizeConfig.width,
      height: sizeConfig.height,
    });
    console.log(
      `[Deposit] ${token} deposit photo sent successfully to ${
        isTestMode ? "DEV" : "PROD"
      } chat!`
    );

    // Mirror to dev chat if enabled and not in test mode
    if (MIRROR_TO_DEV && !isTestMode && targetChat !== DEV_CHAT_ID) {
      console.log(`[Mirror] Mirroring ${token} deposit photo to dev chat`);
      try {
        await bot.sendPhoto(DEV_CHAT_ID, imageUrl, {
          caption: msg,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          width: sizeConfig.width,
          height: sizeConfig.height,
        });
        console.log(
          `[Mirror] ${token} deposit photo successfully mirrored to dev chat`
        );
      } catch (mirrorError) {
        console.error(
          `[Mirror] Error mirroring ${token} deposit photo to dev chat:`,
          mirrorError
        );
      }
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
    const currentBlock = await provider.getBlockNumber();
    const startBlock = Math.max(
      lastProcessedBlock + 1,
      currentBlock - BLOCKS_TO_SCAN
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
    console.error("[Polling] Error scanning blocks:", error);
  }
}

async function processBlock(blockNumber) {
  await initializeDB(); // Ensure db is initialized
  try {
    // Minimal delay to respect RPC rate limits
    await new Promise((resolve) => setTimeout(resolve, 10));

    const block = await provider.getBlock(blockNumber, true);
    if (!block) return;

    let ethDeposits = 0;

    // Process ETH transactions
    for (const tx of block.transactions) {
      if (
        tx.to &&
        MONITORED_ADDRESSES.includes(tx.to.toLowerCase()) &&
        tx.value &&
        tx.value > 0
      ) {
        const ethAmount = ethers.formatEther(tx.value);
        const wasNewDeposit = await logDeposit({
          token: "ETH",
          amount: ethAmount,
          from: tx.from,
          to: tx.to,
          txHash: tx.hash,
        });

        if (wasNewDeposit) {
          await sendDepositMessage("ETH", ethAmount, tx.from, tx.to, tx.hash);
          ethNotifications++;
          ethDeposits++;
        }
      }
    }

    // Process ERC-20 transfers
    for (const [symbol, { address, decimals }] of Object.entries(TOKENS)) {
      try {
        // Minimal delay between contract queries
        await new Promise((resolve) => setTimeout(resolve, 5));

        const contract = new ethers.Contract(address, ERC20_ABI, provider);
        const filter = contract.filters.Transfer(null, null);
        const events = await contract.queryFilter(
          filter,
          blockNumber,
          blockNumber
        );

        for (const event of events) {
          const { from, to, value } = event.args;
          if (to && MONITORED_ADDRESSES.includes(to.toLowerCase())) {
            const amount = ethers.formatUnits(value, decimals);
            const txHash = event.transactionHash || event.log?.transactionHash;

            if (!txHash) {
              console.warn(
                `[Warning] No transaction hash found for ${symbol} event in block ${blockNumber}`
              );
              continue;
            }

            const wasNewDeposit = await logDeposit({
              token: symbol,
              amount,
              from,
              to,
              txHash: txHash,
            });

            if (wasNewDeposit) {
              await sendDepositMessage(symbol, amount, from, to, txHash);
              erc20Notifications++;
              const now = new Date();
              console.log(
                `[${now.toISOString()}] ERC-20 ${symbol} deposit: ${amount} from ${from} to ${to}`
              );
            }
          }
        }
      } catch (error) {
        console.error(
          `[Error] Failed to process ${symbol} events in block ${blockNumber}:`,
          error
        );
      }
    }

    const now = new Date();
    if (ethDeposits > 0) {
      console.log(
        `[${now.toISOString()}] Block ${blockNumber}: ETH deposits: ${ethDeposits}`
      );
    }
  } catch (error) {
    // Check if it's an RPC rate limit error
    if (error.error && error.error.code === -32005) {
      const retryDelay = Math.min(
        parseInt(error.error.data?.try_again_in) || 1000,
        1000
      );
      console.log(
        `[Rate Limit] RPC rate limit hit for block ${blockNumber}, retrying in ${retryDelay}ms`
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      // Retry once
      try {
        await processBlock(blockNumber);
        return;
      } catch (retryError) {
        console.error(
          `[Polling] Retry failed for block ${blockNumber}:`,
          retryError
        );
      }
    } else {
      console.error(`[Polling] Error processing block ${blockNumber}:`, error);
    }
  }
}

// --- Mode-specific setup functions ---
function setupWebSocketMode() {
  console.log("[Mode] Setting up WebSocket mode...");
  setupProviderAndListeners();
}

function setupPollingMode() {
  console.log("[Mode] Setting up polling mode...");
  provider = new ethers.JsonRpcProvider(
    ETHEREUM_RPC.replace("wss://", "https://")
  );

  // Initialize lastProcessedBlock
  provider.getBlockNumber().then((blockNumber) => {
    lastProcessedBlock = blockNumber - 1;
  });

  // Start polling interval
  setInterval(scanBlocksForDeposits, POLLING_INTERVAL);

  // Initial scan
  setTimeout(scanBlocksForDeposits, 5000);
}

async function setupOnceMode() {
  console.log("[Mode] Setting up 'once' mode...");
  provider = new ethers.JsonRpcProvider(
    ETHEREUM_RPC.replace("wss://", "https://")
  );

  await initializeDB(); // Ensure db is initialized

  try {
    // Get current block number
    const currentBlock = await provider.getBlockNumber();
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

    console.log("[Once] Scan complete. Exiting.");
    process.exit(0);
  } catch (error) {
    console.error("[Once] Error during scan:", error);
    process.exit(1);
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
  // ETH balance
  const ethBalance = await provider.getBalance(MARKETING_WALLET);
  balances.ETH = ethers.formatEther(ethBalance);
  // ERC-20 balances
  for (const [symbol, { address, decimals }] of Object.entries(TOKENS)) {
    const contract = new ethers.Contract(address, ERC20_ABI, provider);
    const bal = await contract.balanceOf(MARKETING_WALLET);
    balances[symbol] = ethers.formatUnits(bal, decimals);
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

// Test functions for each token type
async function sendTestEthMessage() {
  console.log("[Test] Sending test ETH message...");
  try {
    await sendDepositMessage(
      "ETH",
      "0.05", // 0.05 ETH (~$150)
      "0x1111111111111111111111111111111111111111",
      MARKETING_WALLET,
      "0x3333333333333333333333333333333333333333333333333333333333333333"
    );
    console.log("[Test] Test ETH message sent successfully!");
  } catch (error) {
    console.error("[Test] Error sending ETH test message:", error);
  }
}

async function sendTestUsdcMessage() {
  console.log("[Test] Sending test USDC message...");
  try {
    await sendDepositMessage(
      "USDC",
      "150", // 150 USDC
      "0x1111111111111111111111111111111111111111",
      MARKETING_WALLET,
      "0x3333333333333333333333333333333333333333333333333333333333333333"
    );
    console.log("[Test] Test USDC message sent successfully!");
  } catch (error) {
    console.error("[Test] Error sending USDC test message:", error);
  }
}

async function sendTestUsdtMessage() {
  console.log("[Test] Sending test USDT message...");
  try {
    await sendDepositMessage(
      "USDT",
      "250", // 250 USDT
      "0x1111111111111111111111111111111111111111",
      MARKETING_WALLET,
      "0x3333333333333333333333333333333333333333333333333333333333333333"
    );
    console.log("[Test] Test USDT message sent successfully!");
  } catch (error) {
    console.error("[Test] Error sending USDT test message:", error);
  }
}

async function sendTestXiaobaiMessage() {
  console.log("[Test] Sending test XIAOBAI message...");
  try {
    await sendDepositMessage(
      "XIAOBAI",
      "50000000", // 50 million XIAOBAI tokens (~$7.50)
      "0x1111111111111111111111111111111111111111",
      MARKETING_WALLET,
      "0x3333333333333333333333333333333333333333333333333333333333333333"
    );
    console.log("[Test] Test XIAOBAI message sent successfully!");
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
  isTransactionProcessed,
  sendHourlySummary,
  sendTestEthMessage,
  sendTestUsdcMessage,
  sendTestUsdtMessage,
  sendTestXiaobaiMessage,
  sendAllTestMessages,
};

// Main execution based on mode - only run if this file is executed directly
if (require.main === module) {
  if (MODE === "websocket") {
    setupWebSocketMode();
    console.log(
      "Bot is running in WebSocket mode and listening for deposits via subscriptions..."
    );
  } else if (MODE === "polling") {
    setupPollingMode();
    console.log(
      `Bot is running in polling mode, scanning every ${POLLING_INTERVAL}ms...`
    );
  } else if (MODE === "once") {
    setupOnceMode();
  } else {
    console.error(
      `[Main] Invalid mode: ${MODE}. Use 'websocket', 'polling', or 'once'. Exiting.`
    );
    process.exit(1);
  }
}
