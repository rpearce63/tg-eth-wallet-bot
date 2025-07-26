const { ethers } = require("ethers");

// Test rate limiting configuration
const RATE_LIMIT_CONFIG = {
  maxRequestsPerSecond: 8,
  minDelayBetweenRequests: 150,
  maxDelayBetweenRequests: 1000,
  exponentialBackoffBase: 2,
  maxRetries: 3,
  retryDelayMultiplier: 1.5,
};

// Rate limiting state
let lastRequestTime = 0;
let requestCount = 0;
let requestWindowStart = Date.now();
let consecutiveErrors = 0;
let currentDelay = RATE_LIMIT_CONFIG.minDelayBetweenRequests;

// Rate limiting functions (copied from main file)
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
  let baseDelay = 1000;

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

// Test function
async function testRateLimiting() {
  console.log("Testing rate limiting with Chainstack RPC...");

  const ETHEREUM_RPC =
    "https://ethereum-mainnet.core.chainstack.com/b6dbac3a0035889f4fe0ecba93817555";
  const provider = new ethers.JsonRpcProvider(ETHEREUM_RPC);

  const testAddress = "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3";

  console.log(`[Test] Making 20 rapid requests to test rate limiting...`);

  const startTime = Date.now();

  for (let i = 0; i < 20; i++) {
    try {
      const balance = await rateLimitedRequest(
        () => provider.getBalance(testAddress),
        `getBalance(${i + 1})`
      );

      const ethBalance = ethers.formatEther(balance);
      console.log(`[Test] Request ${i + 1}: Balance = ${ethBalance} ETH`);
    } catch (error) {
      console.error(`[Test] Request ${i + 1} failed:`, error.message);
    }
  }

  const endTime = Date.now();
  const totalTime = (endTime - startTime) / 1000;

  console.log(
    `[Test] Completed 20 requests in ${totalTime.toFixed(2)} seconds`
  );
  console.log(
    `[Test] Average time per request: ${(totalTime / 20).toFixed(2)} seconds`
  );
  console.log(`[Test] Effective RPS: ${(20 / totalTime).toFixed(2)}`);
}

// Run the test
testRateLimiting().catch(console.error);
