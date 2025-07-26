#!/usr/bin/env node

const { ethers } = require("ethers");

// Curated list of reliable RPC providers
const RELIABLE_RPC_PROVIDERS = [
  {
    name: "Chainstack",
    url: "https://ethereum-mainnet.core.chainstack.com/b6dbac3a0035889f4fe0ecba93817555",
    priority: 1,
  },
  {
    name: "Ankr",
    url: "https://rpc.ankr.com/eth",
    priority: 2,
  },
  {
    name: "1RPC",
    url: "https://1rpc.io/eth",
    priority: 2,
  },
  {
    name: "Ethereum Foundation",
    url: "https://eth.llamarpc.com",
    priority: 3,
  },
  {
    name: "PublicNode",
    url: "https://ethereum.publicnode.com",
    priority: 3,
  },
  {
    name: "Gateway.fm",
    url: "https://gateway.tenderly.co/public",
    priority: 2,
  },
  {
    name: "POKT Network",
    url: "https://eth-mainnet.gateway.pokt.network/v1/lb/",
    priority: 2,
  },
  {
    name: "OnFinality",
    url: "https://ethereum.api.onfinality.io/public",
    priority: 2,
  },
  {
    name: "Bware Labs",
    url: "https://mainnet.bwarelabs.com",
    priority: 2,
  },
  {
    name: "GetBlock",
    url: "https://eth.getblock.io/mainnet/",
    priority: 2,
  },
];

async function testProvider(provider, timeout = 3000) {
  console.log(`🔍 Testing ${provider.name}...`);

  try {
    const startTime = Date.now();
    const providerInstance = new ethers.JsonRpcProvider(provider.url);

    // Test: Get block number with timeout
    const blockNumber = await Promise.race([
      providerInstance.getBlockNumber(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), timeout)
      ),
    ]);

    const responseTime = Date.now() - startTime;

    console.log(`✅ ${provider.name}: Block ${blockNumber}, ${responseTime}ms`);

    return {
      ...provider,
      working: true,
      responseTime,
      blockNumber,
    };
  } catch (error) {
    console.log(`❌ ${provider.name}: ${error.message}`);
    return {
      ...provider,
      working: false,
      error: error.message,
    };
  }
}

async function discoverProviders() {
  console.log("🚀 Starting RPC Provider Discovery...\n");
  console.log(
    `Testing ${RELIABLE_RPC_PROVIDERS.length} reliable providers with 3-second timeout\n`
  );

  const results = [];

  // Test providers sequentially to avoid overwhelming them
  for (const provider of RELIABLE_RPC_PROVIDERS) {
    const result = await testProvider(provider);
    results.push(result);

    // Small delay between tests
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Separate working and failed providers
  const workingProviders = results.filter((r) => r.working);
  const failedProviders = results.filter((r) => !r.working);

  console.log("\n" + "=".repeat(60));
  console.log("📊 DISCOVERY RESULTS");
  console.log("=".repeat(60));

  console.log(`\n✅ WORKING PROVIDERS (${workingProviders.length}):`);
  workingProviders
    .sort((a, b) => a.responseTime - b.responseTime)
    .forEach((provider, index) => {
      console.log(`${index + 1}. ${provider.name}`);
      console.log(`   URL: ${provider.url}`);
      console.log(`   Response Time: ${provider.responseTime}ms`);
      console.log(`   Block: ${provider.blockNumber}`);
      console.log(`   Priority: ${provider.priority}`);
      console.log("");
    });

  console.log(`\n❌ FAILED PROVIDERS (${failedProviders.length}):`);
  failedProviders.forEach((provider, index) => {
    console.log(`${index + 1}. ${provider.name}: ${provider.error}`);
  });

  // Generate configuration code
  console.log("\n" + "=".repeat(60));
  console.log("🔧 CONFIGURATION CODE");
  console.log("=".repeat(60));

  console.log("\n// Replace your current RPC_PROVIDERS with this:");
  console.log("const RPC_PROVIDERS = {");
  console.log("  primary: [");

  const primary = workingProviders.filter((p) => p.priority === 1);
  primary.forEach((provider) => {
    console.log(`    {`);
    console.log(`      name: "${provider.name}",`);
    console.log(`      http: "${provider.url}",`);
    console.log(`      priority: ${provider.priority},`);
    console.log(`      rateLimit: { rps: 5, monthly: 100000 },`);
    console.log(`      features: ["http"],`);
    console.log(`      cost: "free",`);
    console.log(`    },`);
  });

  console.log("  ],");
  console.log("  secondary: [");

  const secondary = workingProviders.filter((p) => p.priority === 2);
  secondary.forEach((provider) => {
    console.log(`    {`);
    console.log(`      name: "${provider.name}",`);
    console.log(`      http: "${provider.url}",`);
    console.log(`      priority: ${provider.priority},`);
    console.log(`      rateLimit: { rps: 3, monthly: 50000 },`);
    console.log(`      features: ["http"],`);
    console.log(`      cost: "free",`);
    console.log(`    },`);
  });

  console.log("  ],");
  console.log("  fallback: [");

  const fallback = workingProviders.filter((p) => p.priority === 3);
  fallback.forEach((provider) => {
    console.log(`    {`);
    console.log(`      name: "${provider.name}",`);
    console.log(`      http: "${provider.url}",`);
    console.log(`      priority: ${provider.priority},`);
    console.log(`      rateLimit: { rps: 1, monthly: 10000 },`);
    console.log(`      features: ["http"],`);
    console.log(`      cost: "free",`);
    console.log(`    },`);
  });

  console.log("  ],");
  console.log("};");

  console.log("\n" + "=".repeat(60));
  console.log("📈 SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total tested: ${RELIABLE_RPC_PROVIDERS.length}`);
  console.log(
    `Working: ${workingProviders.length} (${(
      (workingProviders.length / RELIABLE_RPC_PROVIDERS.length) *
      100
    ).toFixed(1)}%)`
  );
  console.log(
    `Failed: ${failedProviders.length} (${(
      (failedProviders.length / RELIABLE_RPC_PROVIDERS.length) *
      100
    ).toFixed(1)}%)`
  );

  if (workingProviders.length > 0) {
    const avgResponseTime =
      workingProviders.reduce((sum, p) => sum + p.responseTime, 0) /
      workingProviders.length;
    console.log(`Average response time: ${avgResponseTime.toFixed(0)}ms`);
    console.log(
      `Fastest: ${workingProviders[0].name} (${workingProviders[0].responseTime}ms)`
    );
    console.log(
      `Slowest: ${workingProviders[workingProviders.length - 1].name} (${
        workingProviders[workingProviders.length - 1].responseTime
      }ms)`
    );
  }

  console.log("\n🎉 Discovery complete!");
}

// Run the discovery
discoverProviders().catch(console.error);
