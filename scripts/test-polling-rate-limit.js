const { ethers } = require("ethers");

// Import the main functions from index.js
const { setupPollingMode, scanBlocksForDeposits } = require("../index.js");

// Test configuration
const TEST_CONFIG = {
  pollingInterval: 30000, // 30 seconds for testing
  blocksToScan: 2, // Only scan 2 blocks for testing
  maxRps: 6, // Conservative RPS limit
};

async function testPollingWithRateLimit() {
  console.log("Testing polling mode with rate limiting...");
  console.log(
    `[Test] Configuration: ${TEST_CONFIG.pollingInterval / 1000}s interval, ${
      TEST_CONFIG.blocksToScan
    } blocks`
  );

  // Override environment variables for testing
  process.env.POLLING_INTERVAL = TEST_CONFIG.pollingInterval.toString();
  process.env.BLOCKS_TO_SCAN = TEST_CONFIG.blocksToScan.toString();
  process.env.MAX_RPS = TEST_CONFIG.maxRps.toString();
  process.env.TEST_MODE = "true";

  try {
    // Set up polling mode
    setupPollingMode();

    console.log("[Test] Polling mode set up successfully");
    console.log("[Test] Waiting for first scan to complete...");

    // Wait for the initial scan to complete
    await new Promise((resolve) => setTimeout(resolve, 10000));

    console.log("[Test] Initial scan should be complete");
    console.log("[Test] Test completed successfully!");
  } catch (error) {
    console.error("[Test] Error during polling test:", error.message);
  }
}

// Run the test
testPollingWithRateLimit().catch(console.error);
