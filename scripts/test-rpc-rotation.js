#!/usr/bin/env node

// Test script for RPC rotation functionality
const { rpcManager, getRPCStats } = require("../index.js");

async function testRPCRotation() {
  console.log("🧪 Testing RPC Rotation System...\n");

  try {
    // Initialize RPC manager
    console.log("1️⃣ Initializing RPC manager...");
    await rpcManager.initialize();
    console.log("✅ RPC manager initialized\n");

    // Get initial provider
    console.log("2️⃣ Getting initial provider...");
    const initialProvider = await rpcManager.getProvider("http");
    console.log(
      `✅ Initial provider: ${initialProvider.name} (${initialProvider.http})`
    );

    // Switch to provider
    console.log("3️⃣ Switching to provider...");
    await rpcManager.switchProvider(initialProvider);
    console.log(`✅ Switched to: ${rpcManager.currentProvider.config.name}\n`);

    // Test a simple request
    console.log("4️⃣ Testing provider with getBlockNumber...");
    const provider = rpcManager.getCurrentProviderInstance();
    const blockNumber = await provider.getBlockNumber();
    console.log(`✅ Block number: ${blockNumber}\n`);

    // Show initial stats
    console.log("5️⃣ Initial provider statistics:");
    const initialStats = getRPCStats();
    Object.entries(initialStats).forEach(([name, stats]) => {
      console.log(
        `   ${name}: ${stats.requests} requests, ${stats.errors} errors, ${stats.status}`
      );
    });
    console.log();

    // Test rotation
    console.log("6️⃣ Testing provider rotation...");
    await rpcManager.rotateProvider();
    console.log(`✅ Rotated to: ${rpcManager.currentProvider.config.name}\n`);

    // Test another request
    console.log("7️⃣ Testing new provider...");
    const newProvider = rpcManager.getCurrentProviderInstance();
    const newBlockNumber = await newProvider.getBlockNumber();
    console.log(`✅ Block number: ${newBlockNumber}\n`);

    // Show updated stats
    console.log("8️⃣ Updated provider statistics:");
    const updatedStats = getRPCStats();
    Object.entries(updatedStats).forEach(([name, stats]) => {
      console.log(
        `   ${name}: ${stats.requests} requests, ${stats.errors} errors, ${stats.status}`
      );
    });
    console.log();

    // Test health check
    console.log("9️⃣ Testing health check...");
    const healthResults = await Promise.all(
      rpcManager.providers.map(async (provider) => {
        const isHealthy = await rpcManager.healthCheck(provider);
        return { name: provider.name, healthy: isHealthy };
      })
    );

    healthResults.forEach(({ name, healthy }) => {
      console.log(`   ${name}: ${healthy ? "✅" : "❌"}`);
    });
    console.log();

    console.log("🎉 RPC rotation test completed successfully!");

    // Cleanup
    rpcManager.stop();
  } catch (error) {
    console.error("❌ Error during RPC rotation test:", error);
    process.exit(1);
  }
}

// Run the test
testRPCRotation();
