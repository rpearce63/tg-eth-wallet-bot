const { ethers } = require("ethers");

// Import the main functions from index.js without triggering main execution
let logDeposit, sendDepositMessage, initializeDB;

try {
  // Temporarily override process.argv to prevent index.js from parsing our arguments
  const originalArgv = process.argv;
  process.argv = ["node", "index.js"]; // Minimal argv to prevent parsing

  const mainModule = require("../index.js");
  logDeposit = mainModule.logDeposit;
  sendDepositMessage = mainModule.sendDepositMessage;
  initializeDB = mainModule.initializeDB;

  // Restore original argv
  process.argv = originalArgv;

  if (!logDeposit || !sendDepositMessage || !initializeDB) {
    throw new Error("Required functions not found in main module");
  }
} catch (error) {
  console.error(
    "[Scan] Error importing functions from main module:",
    error.message
  );
  console.error(
    "[Scan] This might be due to missing exports. Please check the main index.js file."
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

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  maxRequestsPerSecond: 6,
  minDelayBetweenRequests: 200,
  maxDelayBetweenRequests: 2000,
  exponentialBackoffBase: 2,
  maxRetries: 5,
  retryDelayMultiplier: 1.5,
};

// Rate limiting state
let lastRequestTime = 0;
let requestCount = 0;
let requestWindowStart = Date.now();
let consecutiveErrors = 0;
let currentDelay = RATE_LIMIT_CONFIG.minDelayBetweenRequests;

// Rate limiting functions (same as back-scan script)
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
  let baseDelay = 2000;

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
    console.log(`[Scan] Processing block ${blockNumber}...`);

    // Get block with full transaction objects using prefetchedTransactions
    const block = await rateLimitedRequest(
      () => provider.getBlock(blockNumber, true),
      `getBlock(${blockNumber}, true)`
    );

    if (!block) {
      console.log(`[Scan] Block ${blockNumber} not found`);
      return { ethDeposits: 0, erc20Deposits: 0 };
    }

    // Use prefetchedTransactions for full transaction objects (ethers v6)
    const transactions = block.prefetchedTransactions || [];
    console.log(
      `[Scan] Block ${blockNumber} has ${transactions.length} prefetched transactions`
    );
    console.log(
      `[Scan] Monitored addresses: ${MONITORED_ADDRESSES.join(", ")}`
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
          `[Scan] ✅ FOUND ETH TRANSFER! Transaction ${i}: ${ethAmount} ETH from ${tx.from} to ${tx.to}`
        );

        // Always process (ignore duplicate checks for back-scanning)
        const depositResult = await logDeposit({
          token: "ETH",
          amount: ethAmount,
          from: tx.from,
          to: tx.to,
          txHash: tx.hash,
        });

        await sendDepositMessage("ETH", ethAmount, tx.from, tx.to, tx.hash);
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
                `[Scan] No transaction hash found for ${symbol} event in block ${blockNumber}`
              );
              continue;
            }

            console.log(
              `[Scan] ✅ FOUND ${symbol} TRANSFER! ${amount} ${symbol} from ${from} to ${to}`
            );

            // Always process (ignore duplicate checks for back-scanning)
            const depositResult = await logDeposit({
              token: symbol,
              amount,
              from,
              to,
              txHash: txHash,
            });

            await sendDepositMessage(symbol, amount, from, to, txHash);
            erc20Deposits++;
          }
        }
      } catch (error) {
        console.error(
          `[Scan] Failed to process ${symbol} events in block ${blockNumber}:`,
          error.message
        );
      }
    }

    if (ethDeposits > 0 || erc20Deposits > 0) {
      console.log(
        `[Scan] Block ${blockNumber}: Found ${ethDeposits} ETH deposits and ${erc20Deposits} ERC-20 deposits`
      );
    }

    // Return the deposit counts
    return { ethDeposits, erc20Deposits };
  } catch (error) {
    console.error(
      `[Scan] Error processing block ${blockNumber}:`,
      error.message
    );
    // Return zero counts on error
    return { ethDeposits: 0, erc20Deposits: 0 };
  }
}

// Main scanning function
async function scanSpecificBlocks(startBlock, endBlock) {
  console.log("=== ETH Wallet Bot - Specific Block Scanner ===");
  console.log(`[Scan] Starting scan of blocks ${startBlock} to ${endBlock}...`);

  await initializeDB();
  const provider = new ethers.JsonRpcProvider(ETHEREUM_RPC);

  try {
    const blocksToScan = endBlock - startBlock + 1;
    console.log(
      `[Scan] Scanning ${blocksToScan} blocks from ${startBlock} to ${endBlock}`
    );

    let totalEthDeposits = 0;
    let totalErc20Deposits = 0;
    let processedBlocks = 0;

    // Scan blocks in ascending order
    for (let blockNumber = startBlock; blockNumber <= endBlock; blockNumber++) {
      const result = await processBlockForDeposits(blockNumber, provider);
      totalEthDeposits += result.ethDeposits;
      totalErc20Deposits += result.erc20Deposits;
      processedBlocks++;

      // Progress update every 5 blocks
      if (processedBlocks % 5 === 0) {
        const progress = (
          ((blockNumber - startBlock + 1) / blocksToScan) *
          100
        ).toFixed(1);
        console.log(
          `[Scan] Progress: ${progress}% (${processedBlocks}/${blocksToScan} blocks processed)`
        );
      }

      // Small delay between blocks
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`[Scan] Scan completed!`);
    console.log(`[Scan] Total blocks processed: ${processedBlocks}`);
    console.log(`[Scan] Total ETH deposits found: ${totalEthDeposits}`);
    console.log(`[Scan] Total ERC-20 deposits found: ${totalErc20Deposits}`);
    console.log(
      `[Scan] Total deposits found: ${totalEthDeposits + totalErc20Deposits}`
    );

    if (totalEthDeposits + totalErc20Deposits > 0) {
      console.log(`[Scan] ✅ Found and processed deposits!`);
    } else {
      console.log(`[Scan] ℹ️  No deposits found in the scanned range`);
    }

    console.log(`[Scan] Scan completed successfully. Exiting.`);
    process.exit(0);
  } catch (error) {
    console.error("[Scan] Error during scan:", error.message);
    process.exit(1);
  }
}

// Get command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log("=== ETH Wallet Bot - Specific Block Scanner ===");
  console.log(
    "Usage: node scripts/scan-specific-blocks.js <startBlock> <endBlock>"
  );
  console.log(
    "Example: node scripts/scan-specific-blocks.js 22998618 22998625"
  );
  console.log(
    "Example: node scripts/scan-specific-blocks.js 22998618 22998618 (single block)"
  );
  process.exit(1);
}

const startBlock = parseInt(args[0]);
const endBlock = parseInt(args[1]);

if (isNaN(startBlock) || isNaN(endBlock)) {
  console.error("Error: startBlock and endBlock must be valid numbers");
  process.exit(1);
}

if (startBlock > endBlock) {
  console.error("Error: startBlock must be less than or equal to endBlock");
  process.exit(1);
}

// Run the scan
if (require.main === module) {
  scanSpecificBlocks(startBlock, endBlock).catch(console.error);
}

module.exports = { scanSpecificBlocks };
