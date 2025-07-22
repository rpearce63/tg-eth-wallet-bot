// Required dependencies
const { ethers } = require("ethers");
const TelegramBot = require("node-telegram-bot-api");
const path = require("path");
const fetch = require("node-fetch");

// --- Configuration ---
const TELEGRAM_BOT_TOKEN = "5560564745:AAGItPTaoQQyxxnm7bAavxofMKN3z4ieAM0";
const TELEGRAM_CHAT = -1002545365231; // Supergroup chat ID
const ETHEREUM_RPC =
  "wss://ethereum-mainnet.core.chainstack.com/b6dbac3a0035889f4fe0ecba93817555";
const MONITORED_ADDRESSES = [
  "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3".toLowerCase(),
];

// --- Mode Configuration ---
// Check for environment variables or command line arguments
const MODE = process.env.BOT_MODE || process.argv[2] || "websocket"; // "websocket", "polling", or "once"
const POLLING_INTERVAL =
  parseInt(process.env.POLLING_INTERVAL) || parseInt(process.argv[3]) || 30000; // 30 seconds default
const BLOCKS_TO_SCAN =
  parseInt(process.env.BLOCKS_TO_SCAN) || parseInt(process.argv[4]) || 10; // Number of blocks to scan in polling mode

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
  ETH: "https://tg-eth-wallet-bot-dev-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.mp4",
  USDC: "https://tg-eth-wallet-bot-dev-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.mp4",
  USDT: "https://tg-eth-wallet-bot-dev-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.mp4",
  XIAOBAI:
    "https://tg-eth-wallet-bot-dev-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.mp4",
};

// --- Token images ---
const TOKEN_IMAGES = {
  ETH: "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif", // Ethereum animated
  USDC: "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif", // USDC animated
  USDT: "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif", // USDT animated
  XIAOBAI: "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif", // XIAOBAI animated
};

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });

let provider;
let ethListeners = [];
let erc20Listeners = [];

// --- Lowdb setup for deposit logging ---
let db = null;
let dbInitialized = false;

async function initializeDB() {
  if (dbInitialized) return db;

  try {
    const { Low } = await import("lowdb");
    const { JSONFile } = await import("lowdb/node");

    // Use deployment file in Lambda, local file for development
    const isLambda = process.env.AWS_LAMBDA_FUNCTION_NAME;
    const dbFile = isLambda
      ? path.join(__dirname, "deposits-deploy.json")
      : path.join(__dirname, "deposits.json");

    const adapter = new JSONFile(dbFile);
    db = new Low(adapter, { deposits: [] });

    // Try to read from file
    try {
      await db.read();
      console.log(`[DB] Loaded ${db.data.deposits.length} deposits from file`);
    } catch (readError) {
      console.log("[DB] Could not read from file, using fallback data");
      // Fallback to in-memory with historical data for Lambda
      if (isLambda) {
        db.data = {
          deposits: [
            {
              token: "USDT",
              amount: "100",
              from: "0x3F3aA3Bd1E0D80a2470689D0cDf19f7a97c16123",
              to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
              txHash:
                "0xa266d3a138d48b0f6034883c8b1b7625134653933a961c789170091d203e4f20",
              timestamp: 1753014587000,
            },
            {
              token: "XIAOBAI",
              amount: "56189253406.28855",
              from: "0xad91e2a2CFa185B2b37eCa4D10b6E7A56c6Ae517",
              to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
              txHash:
                "0x2c250cff8c0dc97daa18beaa2498b4e6dbbf43188c0afa10b2bcba9673385562",
              timestamp: 1753015787000,
            },
            {
              token: "XIAOBAI",
              amount: "97566128924.69758",
              from: "0x75426b3dA78B556ea4692F0A3BdEcC7aE33772eC",
              to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
              txHash:
                "0xeaf40b888e9ad5a40b3f3454d9c700201e21a9fa2c26dcbdf934bc481a4c19b2",
              timestamp: 1753015943000,
            },
            {
              token: "USDC",
              amount: "2244",
              from: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
              to: "0x9008D19f58AAbD9eD0D60971565AA8510560ab41",
              txHash:
                "0xa718c88e8c331fd38f419a354d5e116f4ec6c5cdfd4fb88d0c0e5ce79b4939c1",
              timestamp: 1752938231000,
            },
            {
              token: "USDT",
              amount: "100",
              from: "0x3F3aA3Bd1E0D80a2470689D0cDf19f7a97c16123",
              to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
              txHash:
                "0xb5f9fbd6330aa51f19f48dbdf24379668b9b06e77f66bc14141d826c652b9bff",
              timestamp: 1752844787000,
            },
            {
              token: "USDC",
              amount: "200",
              from: "0x1cA5aa5b1dd8D948bB0971A5fB1762FE172E0040",
              to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
              txHash:
                "0x85a314299e4edc624a2b2fdad91456d9a9d0aa8662700de3c427ddbfc5bfadcb",
              timestamp: 1752812231000,
            },
            {
              token: "USDC",
              amount: "547",
              from: "0x1cA5aa5b1dd8D948bB0971A5fB1762FE172E0040",
              to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
              txHash:
                "0x4d6c10fa45e0cde5ececdb1f77a5b1d4c1ca4dba2a34341cb74e31358b184112",
              timestamp: 1752671579000,
            },
            {
              token: "USDC",
              amount: "497",
              from: "0x1cA5aa5b1dd8D948bB0971A5fB1762FE172E0040",
              to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
              txHash:
                "0x5aca7d2398e6837c754a2abf98445b133993d80505590651eabfe54089f9b03a",
              timestamp: 1752666647000,
            },
            {
              token: "XIAOBAI",
              amount: "22884466554",
              from: "0x4FBBd22D32b21a6f98f7F4CDB730b433682Eb676",
              to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
              txHash:
                "0xf0c2d5533eb8e15cad7ac14dd79953f5194b6450231a7a51ae189205099f5577",
              timestamp: 1752595415000,
            },
            {
              token: "XIAOBAI",
              amount: "20000000000",
              from: "0x97D7d3cB92188770D1C76DdB0AB225cE64AD5411",
              to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
              txHash:
                "0x1989c0e74abb7c88ec543ad7f4274c2f54aa31d76e841b40e5a19b5b580a63a7",
              timestamp: 1752595187000,
            },
            {
              token: "USDC",
              amount: "396",
              from: "0x1cA5aa5b1dd8D948bB0971A5fB1762FE172E0040",
              to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
              txHash:
                "0x142aaf39497bb36a7820ed4a7242aaddc8dc8078f76a22b22884deffcb823607",
              timestamp: 1752582647000,
            },
            {
              token: "USDC",
              amount: "302",
              from: "0x1cA5aa5b1dd8d948bB0971A5fB1762FE172E0040",
              to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
              txHash:
                "0x1d452de45dd430a4dbe2df730091843d3784d3996731fb51b9a9d93f97dfaaa3",
              timestamp: 1752574487000,
            },
          ],
        };
        console.log(
          `[DB] Loaded ${db.data.deposits.length} historical deposits for Lambda`
        );
      } else {
        db.data = { deposits: [] };
      }
    }

    dbInitialized = true;
    return db;
  } catch (error) {
    console.error("[DB] Error initializing database:", error);
    // Fallback to in-memory storage
    db = {
      data: { deposits: [] },
      read: async () => {},
      write: async () => {},
    };
    dbInitialized = true;
    return db;
  }
}

// In logDeposit, only log if to === MARKETING_WALLET
async function logDeposit({ token, amount, from, to, txHash }) {
  await initializeDB(); // Ensure db is initialized
  if (to.toLowerCase() !== MARKETING_WALLET) return;

  await db.read();

  // Check for duplicate transaction hash
  const isDuplicate = db.data.deposits.some(
    (deposit) => deposit.txHash === txHash
  );

  if (isDuplicate) {
    console.log(`[Duplicate] Skipping duplicate transaction: ${txHash}`);
    return false; // Indicate this was a duplicate
  }

  db.data.deposits.push({
    token,
    amount,
    from,
    to,
    txHash,
    timestamp: Date.now(),
  });
  await db.write();
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
  let msg = `New contribution detected!\n<b>Token:</b> ${token}\n<b>Amount:</b> ${formattedAmount}\n<b>From:</b> ${fromLink}\n<b>To:</b> ${toLink}`;
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
      await bot.sendVideo(TELEGRAM_CHAT, videoUrl, {
        caption: msg,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
    } catch (error) {
      console.log(
        `[Video] Failed to send video for ${token}, falling back to image`
      );
      // Fallback to image
      if (imageUrl) {
        await bot.sendPhoto(TELEGRAM_CHAT, imageUrl, {
          caption: msg,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        });
      } else {
        await bot.sendMessage(TELEGRAM_CHAT, msg, {
          parse_mode: "HTML",
          disable_web_page_preview: true,
        });
      }
    }
  } else if (imageUrl) {
    await bot.sendPhoto(TELEGRAM_CHAT, imageUrl, {
      caption: msg,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  } else {
    await bot.sendMessage(TELEGRAM_CHAT, msg, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
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
    }

    const now = new Date();
    if (ethDeposits > 0) {
      console.log(
        `[${now.toISOString()}] Block ${blockNumber}: ETH deposits: ${ethDeposits}`
      );
    }
  } catch (error) {
    console.error(`[Polling] Error processing block ${blockNumber}:`, error);
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

// --- Configuration for hourly summary ---
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
  await initializeDB(); // Ensure db is initialized

  // Initialize provider if not already set (for Lambda calls)
  if (!provider) {
    provider = new ethers.JsonRpcProvider(
      ETHEREUM_RPC.replace("wss://", "https://")
    );
  }

  const deposits = db.data.deposits.filter(
    (d) => d.to.toLowerCase() === MARKETING_WALLET
  );
  const balances = await getMarketingWalletBalances();
  const prices = await fetchPrices();
  const dayTotals = await sumDeposits(deposits, 24 * 60 * 60 * 1000);
  const weekTotals = await sumDeposits(deposits, 7 * 24 * 60 * 60 * 1000);
  const monthTotals = await sumDeposits(deposits, 30 * 24 * 60 * 60 * 1000);

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
    let str = `<b>${Number(val || 0).toLocaleString("en-US", {
      maximumFractionDigits: 8,
    })} ${token}</b>`;
    if (usd) {
      str += ` ($${Number(usd).toLocaleString("en-US", {
        maximumFractionDigits: 2,
      })})`;
    }
    return str;
  }

  let msg = `<b>📊 Hourly Summary for Marketing Wallet</b>\n\n`;
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
    msg += `${fmt(amount, symbol)} `;
  }
  msg += `($${dayTotalUsd.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })})`;

  msg += `\nLast 7d: `;
  for (const symbol of ["ETH", ...Object.keys(TOKENS)]) {
    const amount = weekTotals[symbol] || 0;
    msg += `${fmt(amount, symbol)} `;
  }
  msg += `($${weekTotalUsd.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })})`;

  msg += `\nLast 30d: `;
  for (const symbol of ["ETH", ...Object.keys(TOKENS)]) {
    const amount = monthTotals[symbol] || 0;
    msg += `${fmt(amount, symbol)} `;
  }
  msg += `($${monthTotalUsd.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })})`;
  msg += `\n\nKeep contributing to beat the previous records! 🚀`;
  // Always add the XIAOBAI chart link
  msg += `\n<a href=\"https://www.dextools.io/app/en/token/xiaobaictoeth?t=1753120925113\">View Chart</a>`;

  await bot.sendMessage(TELEGRAM_CHAT, msg, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

// Schedule hourly summary
setInterval(sendHourlySummary, 60 * 60 * 1000);
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
