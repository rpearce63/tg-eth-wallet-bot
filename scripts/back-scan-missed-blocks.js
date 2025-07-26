const { ethers } = require("ethers");

// Import the main functions from index.js
let logDeposit, sendDepositMessage, initializeDB;

try {
  const mainModule = require("../index.js");
  logDeposit = mainModule.logDeposit;
  sendDepositMessage = mainModule.sendDepositMessage;
  initializeDB = mainModule.initializeDB;

  if (!logDeposit || !sendDepositMessage || !initializeDB) {
    throw new Error("Required functions not found in main module");
  }
} catch (error) {
  console.error(
    "[Back Scan] Error importing functions from main module:",
    error.message
  );
  console.error(
    "[Back Scan] This might be due to missing exports. Please check the main index.js file."
  );
  process.exit(1);
}

// Configuration
const ETHEREUM_RPC =
  "https://ethereum-mainnet.core.chainstack.com/b6dbac3a0035889f4fe0ecba93817555";
const MONITORED_ADDRESSES = [
  "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3".toLowerCase(),
];

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

// Rate limiting configuration (conservative for back-scanning)
const RATE_LIMIT_CONFIG = {
  maxRequestsPerSecond: 6, // Even more conservative for back-scanning
  minDelayBetweenRequests: 200, // 200ms between requests (5 RPS)
  maxDelayBetweenRequests: 2000, // 2 seconds max delay
  exponentialBackoffBase: 2,
  maxRetries: 5, // More retries for back-scanning
  retryDelayMultiplier: 1.5,
};

// Rate limiting state
let lastRequestTime = 0;
let requestCount = 0;
let requestWindowStart = Date.now();
let consecutiveErrors = 0;
let currentDelay = RATE_LIMIT_CONFIG.minDelayBetweenRequests;

// Rate limiting functions
async function rateLimitedRequest(requestFn, context = "unknown") {
  const maxRetries = RATE_LIMIT_CONFIG.maxRetries;
  let retryCount = 0;

  while (retryCount <= maxRetries) {
    try {
      await enforceRateLimit();
      const result = await requestFn();

      consecutiveErrors = 0;
      currentDelay = Math.max(
        currentDelay / RATE_LIMIT_CONFIG.retryDelayMultiplier,
        RATE_LIMIT_CONFIG.minDelayBetweenRequests
      );

      return result;
    } catch (error) {
      retryCount++;
      consecutiveErrors++;

      if (isRateLimitError(error)) {
        const retryDelay = calculateRetryDelay(error, retryCount);
        console.log(
          `[Rate Limit] ${context} hit rate limit (attempt ${retryCount}/${
            maxRetries + 1
          }), retrying in ${retryDelay}ms`
        );

        currentDelay = Math.min(
          currentDelay * RATE_LIMIT_CONFIG.exponentialBackoffBase,
          RATE_LIMIT_CONFIG.maxDelayBetweenRequests
        );

        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        continue;
      }

      console.error(
        `[Rate Limit] ${context} error (attempt ${retryCount}/${
          maxRetries + 1
        }):`,
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
  let baseDelay = 2000; // Higher base delay for back-scanning

  if (error.error?.data?.try_again_in) {
    const suggestedDelay = parseFloat(error.error.data.try_again_in);
    if (!isNaN(suggestedDelay)) {
      baseDelay = Math.max(suggestedDelay * 1000, baseDelay);
    }
  }

  return Math.min(
    baseDelay * Math.pow(RATE_LIMIT_CONFIG.exponentialBackoffBase, retryCount),
    RATE_LIMIT_CONFIG.maxDelayBetweenRequests
  );
}

async function enforceRateLimit() {
  const now = Date.now();

  if (now - requestWindowStart >= 1000) {
    requestCount = 0;
    requestWindowStart = now;
  }

  if (requestCount >= RATE_LIMIT_CONFIG.maxRequestsPerSecond) {
    const waitTime = 1000 - (now - requestWindowStart);
    if (waitTime > 0) {
      console.log(`[Rate Limit] Rate limit reached, waiting ${waitTime}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return enforceRateLimit();
    }
  }

  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < currentDelay) {
    const waitTime = currentDelay - timeSinceLastRequest;
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
  requestCount++;
}

// Process a single block for deposits
async function processBlockForDeposits(blockNumber, provider) {
  try {
    console.log(`[BackScan] Processing block ${blockNumber}...`);

    // Get block with full transaction objects using prefetchedTransactions
    const block = await rateLimitedRequest(
      () => provider.getBlock(blockNumber, true),
      `getBlock(${blockNumber}, true)`
    );

    if (!block) {
      console.log(`[BackScan] Block ${blockNumber} not found`);
      return;
    }

    // Use prefetchedTransactions for full transaction objects (ethers v6)
    const transactions = block.prefetchedTransactions || [];
    console.log(
      `[BackScan] Block ${blockNumber} has ${transactions.length} prefetched transactions`
    );
    console.log(
      `[BackScan] Monitored addresses: ${MONITORED_ADDRESSES.join(", ")}`
    );

    let ethDeposits = 0;
    let erc20Deposits = 0;

    // Process ETH transfers using prefetched transaction objects
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
          `[BackScan] ✅ FOUND ETH TRANSFER! Transaction ${i}: ${ethAmount} ETH from ${tx.from} to ${tx.to}`
        );

        // Always process (ignore duplicate checks for back-scanning)
        const depositResult = await logDeposit({
          token: "ETH",
          amount: ethAmount,
          from: tx.from,
          to: tx.to,
          txHash: tx.hash,
        });

        // await sendDepositMessage("ETH", ethAmount, tx.from, tx.to, tx.hash);
        ethDeposits++;
      }
    }

    // Process ERC-20 transfers
    for (const [symbol, { address, decimals }] of Object.entries(TOKENS)) {
      try {
        const contract = new ethers.Contract(address, ERC20_ABI, provider);
        const filter = contract.filters.Transfer(null, null);

        // Query events with rate limiting
        const events = await rateLimitedRequest(
          () => contract.queryFilter(filter, blockNumber, blockNumber),
          `${symbol} queryFilter(${blockNumber})`
        );

        for (const event of events) {
          const { from, to, value } = event.args;
          if (to && MONITORED_ADDRESSES.includes(to.toLowerCase())) {
            const amount = ethers.formatUnits(value, decimals);
            const txHash = event.transactionHash || event.log?.transactionHash;

            if (!txHash) {
              console.warn(
                `[BackScan] No transaction hash found for ${symbol} event in block ${blockNumber}`
              );
              continue;
            }

            console.log(
              `[BackScan] ✅ FOUND ${symbol} TRANSFER! ${amount} ${symbol} from ${from} to ${to}`
            );

            // Always process (ignore duplicate checks for back-scanning)
            const depositResult = await logDeposit({
              token: symbol,
              amount,
              from,
              to,
              txHash: txHash,
            });

            //await sendDepositMessage(symbol, amount, from, to, txHash);
            erc20Deposits++;
          }
        }
      } catch (error) {
        console.error(
          `[BackScan] Failed to process ${symbol} events in block ${blockNumber}:`,
          error.message
        );
      }
    }

    if (ethDeposits > 0 || erc20Deposits > 0) {
      console.log(
        `[BackScan] Block ${blockNumber}: Found ${ethDeposits} ETH deposits and ${erc20Deposits} ERC-20 deposits`
      );
    }

    // Return the deposit counts
    return { ethDeposits, erc20Deposits };
  } catch (error) {
    console.error(
      `[BackScan] Error processing block ${blockNumber}:`,
      error.message
    );
    // Return zero counts on error
    return { ethDeposits: 0, erc20Deposits: 0 };
  }
}

// Main back-scanning function
async function backScanMissedBlocks() {
  console.log("[Back Scan] Starting back-scan for missed transactions...");

  // Initialize database
  await initializeDB();

  // Create provider
  const provider = new ethers.JsonRpcProvider(ETHEREUM_RPC);

  try {
    // Get current block number
    const currentBlock = await rateLimitedRequest(
      () => provider.getBlockNumber(),
      "getBlockNumber"
    );

    const targetBlock = 22998618;

    if (currentBlock < targetBlock) {
      console.log(
        `[Back Scan] Current block (${currentBlock}) is before target block (${targetBlock}), nothing to scan`
      );
      return;
    }

    const blocksToScan = currentBlock - targetBlock + 1;
    console.log(
      `[Back Scan] Scanning ${blocksToScan} blocks from ${targetBlock} to ${currentBlock}`
    );
    console.log(`[Back Scan] This may take a while due to rate limiting...`);

    let totalEthDeposits = 0;
    let totalErc20Deposits = 0;
    let processedBlocks = 0;

    // Scan blocks in reverse order (newest to oldest)
    for (
      let blockNumber = currentBlock;
      blockNumber >= targetBlock;
      blockNumber--
    ) {
      const result = await processBlockForDeposits(blockNumber, provider);
      totalEthDeposits += result.ethDeposits;
      totalErc20Deposits += result.erc20Deposits;
      processedBlocks++;

      // Progress update every 10 blocks
      if (processedBlocks % 10 === 0) {
        const progress = (
          ((currentBlock - blockNumber + 1) / blocksToScan) *
          100
        ).toFixed(1);
        console.log(
          `[Back Scan] Progress: ${progress}% (${processedBlocks}/${blocksToScan} blocks processed)`
        );
      }

      // Small delay between blocks to be extra conservative
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`[Back Scan] Back-scan completed!`);
    console.log(`[Back Scan] Total blocks processed: ${processedBlocks}`);
    console.log(`[Back Scan] Total ETH deposits found: ${totalEthDeposits}`);
    console.log(
      `[Back Scan] Total ERC-20 deposits found: ${totalErc20Deposits}`
    );
    console.log(
      `[Back Scan] Total deposits found: ${
        totalEthDeposits + totalErc20Deposits
      }`
    );

    if (totalEthDeposits + totalErc20Deposits > 0) {
      console.log(`[Back Scan] ✅ Found and processed missed deposits!`);
    } else {
      console.log(
        `[Back Scan] ℹ️  No missed deposits found in the scanned range`
      );
    }
  } catch (error) {
    console.error("[Back Scan] Error during back-scan:", error.message);
  }
}

// Run the back-scan
if (require.main === module) {
  backScanMissedBlocks().catch(console.error);
}

module.exports = { backScanMissedBlocks };
