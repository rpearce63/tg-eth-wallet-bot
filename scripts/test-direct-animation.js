#!/usr/bin/env node

// Direct test of sendTestMessageToDev function
const { sendTestMessageToDev } = require("../index.js");

async function testDirectAnimation() {
  console.log("🎬 Testing direct sendTestMessageToDev call...");

  try {
    // Call sendTestMessageToDev directly with explicit parameters
    await sendTestMessageToDev(
      "ETH",
      "0.1",
      "0x1234567890123456789012345678901234567890",
      "0x9876543210987654321098765432109876543210",
      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
    );

    console.log("✅ Direct test message sent successfully!");
    console.log("📱 Check your dev chat to see the animated GIF notification");
  } catch (error) {
    console.error("❌ Error in direct test:");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
  }
}

testDirectAnimation();
