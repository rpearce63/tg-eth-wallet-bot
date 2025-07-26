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

// Debug function to examine a specific block
async function debugBlock(blockNumber) {
  console.log(`[Debug] Examining block ${blockNumber}...`);

  const provider = new ethers.JsonRpcProvider(ETHEREUM_RPC);

  try {
    const block = await rateLimitedRequest(
      () => provider.getBlock(blockNumber, true),
      `getBlock(${blockNumber})`
    );

    if (!block) {
      console.log(`[Debug] Block ${blockNumber} not found`);
      return;
    }

    console.log(
      `[Debug] Block ${blockNumber} has ${block.transactions.length} transactions`
    );
    console.log(`[Debug] Monitored address: ${MONITORED_ADDRESS}`);

    let foundTransactions = 0;
    const targetTxHash =
      "0x5fef794eadc4090f161d1e71ad7f55ee387939369c2370fdc653b7cf44973569";

    // Check if block.transactions contains full objects or just hashes
    if (block.transactions.length > 0) {
      const firstTx = block.transactions[0];
      console.log(`\n[Debug] First transaction structure:`);
      console.log(`  Keys: ${Object.keys(firstTx).join(", ")}`);
      console.log(`  Type: ${typeof firstTx}`);
      console.log(`  Is array: ${Array.isArray(firstTx)}`);
      console.log(`  Value: ${firstTx}`);
    }

    // If block.transactions contains hashes, we need to fetch each transaction individually
    if (typeof block.transactions[0] === "string") {
      console.log(
        `\n[Debug] Block contains transaction hashes, fetching individual transactions...`
      );

      // Check more transactions - up to 100 to find the target transaction
      const transactionsToCheck = block.transactions.slice(0, 100);
      console.log(
        `[Debug] Checking first ${transactionsToCheck.length} transactions out of ${block.transactions.length} total`
      );

      for (let i = 0; i < transactionsToCheck.length; i++) {
        const txHash = transactionsToCheck[i];

        // Show progress every 10 transactions
        if (i % 10 === 0) {
          console.log(
            `[Debug] Progress: ${i}/${transactionsToCheck.length} transactions checked`
          );
        }

        try {
          const tx = await rateLimitedRequest(
            () => provider.getTransaction(txHash),
            `getTransaction(${txHash})`
          );

          if (!tx) {
            console.log(`[Debug] Could not fetch transaction ${i}: ${txHash}`);
            continue;
          }

          // Check if this is the specific transaction we're looking for
          if (tx.hash === targetTxHash) {
            console.log(`\n[Debug] 🎯 FOUND TARGET TRANSACTION!`);
            console.log(`[Debug] Transaction ${i}:`);
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

            // Check if it's to our monitored address
            if (tx.to && tx.to.toLowerCase() === MONITORED_ADDRESS) {
              console.log(`  ✅ This transaction IS to our monitored address!`);
            } else {
              console.log(
                `  ❌ This transaction is NOT to our monitored address`
              );
              console.log(`  Expected: ${MONITORED_ADDRESS}`);
              console.log(`  Actual: ${tx.to ? tx.to.toLowerCase() : "null"}`);
            }
          }

          // Check if this transaction is to our monitored address
          if (tx.to) {
            const txToLower = tx.to.toLowerCase();

            if (txToLower === MONITORED_ADDRESS) {
              foundTransactions++;
              console.log(
                `\n[Debug] ✅ FOUND TRANSACTION TO MONITORED ADDRESS!`
              );
              console.log(`[Debug] Transaction ${i}:`);
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
            } else if (txToLower.includes(MONITORED_ADDRESS.substring(0, 10))) {
              console.log(
                `[Debug] 🔍 Close match: ${tx.to} (our: ${MONITORED_ADDRESS})`
              );
            }
          } else {
            // Only log a few of these to avoid spam
            if (i < 5) {
              console.log(
                `[Debug] Transaction ${i} has no 'to' address (contract creation): ${tx.hash}`
              );
            }
          }
        } catch (error) {
          console.log(
            `[Debug] Error fetching transaction ${i}: ${error.message}`
          );
        }
      }

      // If we didn't find the target transaction in the first 100, let's search for it specifically
      console.log(
        `\n[Debug] Searching specifically for target transaction hash: ${targetTxHash}`
      );
      try {
        const targetTx = await rateLimitedRequest(
          () => provider.getTransaction(targetTxHash),
          `getTransaction(${targetTxHash})`
        );

        if (targetTx) {
          console.log(
            `\n[Debug] 🎯 FOUND TARGET TRANSACTION via direct lookup!`
          );
          console.log(`[Debug] Transaction details:`);
          console.log(`  Hash: ${targetTx.hash}`);
          console.log(`  From: ${targetTx.from}`);
          console.log(`  To: ${targetTx.to}`);
          console.log(`  Value: ${targetTx.value}`);
          console.log(`  Value type: ${typeof targetTx.value}`);
          console.log(`  Value > 0: ${targetTx.value > 0}`);

          if (targetTx.value && targetTx.value > 0) {
            const ethAmount = ethers.formatEther(targetTx.value);
            console.log(`  ETH Amount: ${ethAmount} ETH`);
          }

          console.log(`  Gas: ${targetTx.gasLimit}`);
          console.log(`  Gas Price: ${targetTx.gasPrice}`);
          console.log(`  Nonce: ${targetTx.nonce}`);
          console.log(`  Data: ${targetTx.data}`);
          console.log(`  Block Number: ${targetTx.blockNumber}`);

          // Check if it's to our monitored address
          if (targetTx.to && targetTx.to.toLowerCase() === MONITORED_ADDRESS) {
            console.log(`  ✅ This transaction IS to our monitored address!`);
            foundTransactions++;
          } else {
            console.log(
              `  ❌ This transaction is NOT to our monitored address`
            );
            console.log(`  Expected: ${MONITORED_ADDRESS}`);
            console.log(
              `  Actual: ${targetTx.to ? targetTx.to.toLowerCase() : "null"}`
            );
          }
        } else {
          console.log(
            `[Debug] Could not find target transaction via direct lookup`
          );
        }
      } catch (error) {
        console.log(
          `[Debug] Error fetching target transaction: ${error.message}`
        );
      }
    } else {
      // Original logic for when block.transactions contains full objects
      for (let i = 0; i < block.transactions.length; i++) {
        const tx = block.transactions[i];

        // Check if this is the specific transaction we're looking for
        if (tx.hash === targetTxHash) {
          console.log(`\n[Debug] 🎯 FOUND TARGET TRANSACTION!`);
          console.log(`[Debug] Transaction ${i}:`);
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

          // Check if it's to our monitored address
          if (tx.to && tx.to.toLowerCase() === MONITORED_ADDRESS) {
            console.log(`  ✅ This transaction IS to our monitored address!`);
          } else {
            console.log(
              `  ❌ This transaction is NOT to our monitored address`
            );
            console.log(`  Expected: ${MONITORED_ADDRESS}`);
            console.log(`  Actual: ${tx.to ? tx.to.toLowerCase() : "null"}`);
          }
        }

        // Check if this transaction is to our monitored address
        if (tx.to) {
          const txToLower = tx.to.toLowerCase();

          if (txToLower === MONITORED_ADDRESS) {
            foundTransactions++;
            console.log(`\n[Debug] ✅ FOUND TRANSACTION TO MONITORED ADDRESS!`);
            console.log(`[Debug] Transaction ${i}:`);
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
          } else if (txToLower.includes(MONITORED_ADDRESS.substring(0, 10))) {
            console.log(
              `[Debug] 🔍 Close match: ${tx.to} (our: ${MONITORED_ADDRESS})`
            );
          }
        } else {
          // Only log a few of these to avoid spam
          if (i < 5) {
            console.log(
              `[Debug] Transaction ${i} has no 'to' address (contract creation): ${tx.hash}`
            );
          }
        }
      }
    }

    console.log(
      `\n[Debug] Summary: Found ${foundTransactions} transactions to monitored address in block ${blockNumber}`
    );

    if (foundTransactions === 0) {
      console.log(
        `[Debug] ⚠️ No transactions found to monitored address. This might indicate:`
      );
      console.log(`[Debug]   1. The transactions are in a different block`);
      console.log(`[Debug]   2. The address format is different`);
      console.log(
        `[Debug]   3. The transactions are contract interactions, not direct ETH transfers`
      );
      console.log(
        `[Debug]   4. There's an issue with how we're accessing transaction data from the block`
      );
    }
  } catch (error) {
    console.error(
      `[Debug] Error examining block ${blockNumber}:`,
      error.message
    );
  }
}

// Get command line arguments
const args = process.argv.slice(2);

if (args.length < 1) {
  console.log("Usage: node scripts/debug-transaction.js <blockNumber>");
  console.log("Example: node scripts/debug-transaction.js 22998618");
  process.exit(1);
}

const blockNumber = parseInt(args[0]);

if (isNaN(blockNumber)) {
  console.error("Error: blockNumber must be a valid number");
  process.exit(1);
}

// Run the debug
if (require.main === module) {
  debugBlock(blockNumber).catch(console.error);
}

module.exports = { debugBlock };
