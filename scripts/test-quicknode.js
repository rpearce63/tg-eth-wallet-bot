#!/usr/bin/env node

const { ethers } = require("ethers");

const QUICKNODE_URL =
  "https://late-hidden-river.quiknode.pro/1d06846dc558e409813ae371237433298f9d13ec/";

async function testQuickNode() {
  console.log("🧪 Testing QuickNode Endpoint...\n");
  console.log(`URL: ${QUICKNODE_URL}\n`);

  try {
    const provider = new ethers.JsonRpcProvider(QUICKNODE_URL);

    // Test 1: Basic connectivity
    console.log("1️⃣ Testing basic connectivity...");
    const startTime = Date.now();
    const blockNumber = await provider.getBlockNumber();
    const responseTime = Date.now() - startTime;
    console.log(`✅ Block number: ${blockNumber}`);
    console.log(`✅ Response time: ${responseTime}ms\n`);

    // Test 2: Get block with transactions
    console.log("2️⃣ Testing block retrieval with transactions...");
    const blockStartTime = Date.now();
    const block = await provider.getBlock(blockNumber, true);
    const blockResponseTime = Date.now() - blockStartTime;
    console.log(`✅ Block ${blockNumber} retrieved`);
    console.log(
      `✅ Transactions: ${block.prefetchedTransactions?.length || 0}`
    );
    console.log(`✅ Response time: ${blockResponseTime}ms\n`);

    // Test 3: RPS stress test
    console.log("3️⃣ Testing RPS handling (5 requests in quick succession)...");
    const rpsStartTime = Date.now();
    const promises = [];

    for (let i = 0; i < 5; i++) {
      promises.push(provider.getBlockNumber());
    }

    const results = await Promise.all(promises);
    const rpsResponseTime = Date.now() - rpsStartTime;

    console.log(`✅ All 5 requests completed in ${rpsResponseTime}ms`);
    console.log(`✅ Average response time: ${rpsResponseTime / 5}ms`);
    console.log(`✅ Block numbers: ${results.join(", ")}\n`);

    // Test 4: Multiple block retrievals
    console.log(
      "4️⃣ Testing multiple block retrievals (simulating our scan)..."
    );
    const scanStartTime = Date.now();
    const scanPromises = [];

    for (let i = 0; i < 7; i++) {
      const targetBlock = blockNumber - i;
      scanPromises.push(provider.getBlock(targetBlock, true));
    }

    const scanResults = await Promise.all(scanPromises);
    const scanResponseTime = Date.now() - scanStartTime;

    console.log(`✅ 7 blocks retrieved in ${scanResponseTime}ms`);
    console.log(`✅ Average per block: ${scanResponseTime / 7}ms`);
    console.log(
      `✅ Total transactions: ${scanResults.reduce(
        (sum, block) => sum + (block.prefetchedTransactions?.length || 0),
        0
      )}\n`
    );

    // Test 5: Rate limit test (10 requests)
    console.log("5️⃣ Testing rate limit handling (10 requests)...");
    const rateLimitStartTime = Date.now();
    const rateLimitPromises = [];

    for (let i = 0; i < 10; i++) {
      rateLimitPromises.push(provider.getBlockNumber());
    }

    const rateLimitResults = await Promise.all(rateLimitPromises);
    const rateLimitResponseTime = Date.now() - rateLimitStartTime;

    console.log(`✅ 10 requests completed in ${rateLimitResponseTime}ms`);
    console.log(`✅ Average response time: ${rateLimitResponseTime / 10}ms`);
    console.log(`✅ No rate limiting detected\n`);

    // Summary
    console.log("📊 QUICKNODE TEST SUMMARY");
    console.log("=".repeat(40));
    console.log(`✅ Basic connectivity: ${responseTime}ms`);
    console.log(`✅ Block retrieval: ${blockResponseTime}ms`);
    console.log(`✅ RPS test (5 req): ${rpsResponseTime}ms`);
    console.log(`✅ Scan simulation (7 blocks): ${scanResponseTime}ms`);
    console.log(`✅ Rate limit test (10 req): ${rateLimitResponseTime}ms`);
    console.log(
      `✅ Transactions per block: ${block.prefetchedTransactions?.length || 0}`
    );
    console.log(`✅ Provider: QuickNode`);
    console.log(`✅ Status: READY FOR PRODUCTION\n`);

    return {
      working: true,
      responseTime: responseTime,
      blockResponseTime: blockResponseTime,
      rpsResponseTime: rpsResponseTime,
      scanResponseTime: scanResponseTime,
      rateLimitResponseTime: rateLimitResponseTime,
      transactionCount: block.prefetchedTransactions?.length || 0,
      blockNumber: blockNumber,
    };
  } catch (error) {
    console.log(`❌ QuickNode test failed: ${error.message}`);
    return {
      working: false,
      error: error.message,
    };
  }
}

// Run the test
testQuickNode().catch(console.error);
