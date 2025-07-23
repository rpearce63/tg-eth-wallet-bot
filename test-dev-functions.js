// Test script for dev environment only
const {
  sendTestEthMessage,
  sendTestUsdcMessage,
  sendTestUsdtMessage,
  sendTestXiaobaiMessage,
  sendAllTestMessages,
} = require("./index.js");

// Environment validation - ensure tests only run in dev
function validateEnvironment() {
  const stage = process.env.STAGE || "dev";
  if (stage === "prod") {
    console.error("❌ ERROR: Tests cannot be run in production environment!");
    console.error("Please set STAGE=dev or remove STAGE environment variable.");
    process.exit(1);
  }
  console.log(`✅ Running tests in ${stage} environment`);
}

// Validate environment before proceeding
validateEnvironment();

async function runDevTests() {
  console.log("🧪 Starting dev environment tests...");

  try {
    // Test individual token messages
    console.log("\n📤 Testing individual token messages...");

    console.log("\n1️⃣ Testing ETH message...");
    await sendTestEthMessage();
    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log("\n2️⃣ Testing USDC message...");
    await sendTestUsdcMessage();
    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log("\n3️⃣ Testing USDT message...");
    await sendTestUsdtMessage();
    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log("\n4️⃣ Testing XIAOBAI message...");
    await sendTestXiaobaiMessage();
    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log("\n✅ All individual tests completed!");

    // Optionally test all messages at once
    const testAll = process.argv.includes("--all");
    if (testAll) {
      console.log("\n🔄 Testing all messages at once...");
      await sendAllTestMessages();
      console.log("\n✅ All messages test completed!");
    }
  } catch (error) {
    console.error("❌ Error during testing:", error);
    process.exit(1);
  }

  console.log("\n🎉 Dev environment tests completed successfully!");
  process.exit(0);
}

// Run tests
runDevTests();
