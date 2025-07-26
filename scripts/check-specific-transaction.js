const { ethers } = require("ethers");

// Configuration
const ETHEREUM_RPC =
  "https://ethereum-mainnet.core.chainstack.com/b6dbac3a0035889f4fe0ecba93817555";
const MONITORED_ADDRESS =
  "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3".toLowerCase();

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

// Check specific transaction
async function checkTransaction(txHash) {
  console.log(`[Check] Examining transaction: ${txHash}`);

  const provider = new ethers.JsonRpcProvider(ETHEREUM_RPC);

  try {
    const tx = await rateLimitedRequest(
      () => provider.getTransaction(txHash),
      `getTransaction(${txHash})`
    );

    if (!tx) {
      console.log(`[Check] Transaction ${txHash} not found`);
      return;
    }

    console.log(`\n[Check] Transaction Details:`);
    console.log(`  Hash: ${tx.hash}`);
    console.log(`  From: ${tx.from}`);
    console.log(`  To: ${tx.to}`);
    console.log(`  Value: ${tx.value}`);
    console.log(`  Value type: ${typeof tx.value}`);
    console.log(`  Value > 0: ${tx.value > 0}`);

    if (tx.value && tx.value > 0) {
      const ethAmount = ethers.formatEther(tx.value);
      console.log(`  ETH Amount: ${ethAmount} ETH`);
    }

    console.log(`  Gas: ${tx.gasLimit}`);
    console.log(`  Gas Price: ${tx.gasPrice}`);
    console.log(`  Nonce: ${tx.nonce}`);
    console.log(`  Data: ${tx.data}`);
    console.log(`  Block Number: ${tx.blockNumber}`);

    // Check if it's to our monitored address
    if (tx.to) {
      const txToLower = tx.to.toLowerCase();
      const monitoredLower = MONITORED_ADDRESS.toLowerCase();

      console.log(`\n[Check] Address Comparison:`);
      console.log(`  Transaction 'to': ${tx.to}`);
      console.log(`  Transaction 'to' (lowercase): ${txToLower}`);
      console.log(`  Monitored address: ${MONITORED_ADDRESS}`);
      console.log(`  Monitored address (lowercase): ${monitoredLower}`);
      console.log(`  Match: ${txToLower === monitoredLower}`);

      if (txToLower === monitoredLower) {
        console.log(`  ✅ This transaction IS to our monitored address!`);
      } else {
        console.log(`  ❌ This transaction is NOT to our monitored address`);

        // Check for partial matches
        if (txToLower.includes(monitoredLower.substring(0, 10))) {
          console.log(`  🔍 Partial match found (first 10 chars)`);
        }

        // Check if addresses are the same but different case
        if (txToLower === monitoredLower) {
          console.log(`  🔍 Case-insensitive match found`);
        }
      }
    } else {
      console.log(
        `\n[Check] ⚠️ Transaction has no 'to' address (contract creation)`
      );
    }
  } catch (error) {
    console.error(
      `[Check] Error examining transaction ${txHash}:`,
      error.message
    );
  }
}

// Get command line arguments
const args = process.argv.slice(2);

if (args.length < 1) {
  console.log(
    "Usage: node scripts/check-specific-transaction.js <transactionHash>"
  );
  console.log(
    "Example: node scripts/check-specific-transaction.js 0x5fef794eadc4090f161d1e71ad7f55ee387939369c2370fdc653b7cf44973569"
  );
  process.exit(1);
}

const txHash = args[0];

if (!txHash.startsWith("0x") || txHash.length !== 66) {
  console.error(
    "Error: transactionHash must be a valid 32-byte hex string starting with 0x"
  );
  process.exit(1);
}

// Run the check
if (require.main === module) {
  checkTransaction(txHash).catch(console.error);
}

module.exports = { checkTransaction };
