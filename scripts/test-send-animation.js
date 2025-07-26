#!/usr/bin/env node

// Test script to verify sendAnimation functionality
const { sendTestMessageToDev } = require("../index.js");

async function testSendAnimation() {
  console.log("🎬 Testing sendAnimation functionality...");

  try {
    // Test with ETH deposit (should use sendAnimation for GIF)
    await sendTestMessageToDev(
      "ETH",
      "0.1",
      "0x1234567890123456789012345678901234567890",
      "0x9876543210987654321098765432109876543210",
      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
    );

    console.log("✅ ETH test message sent successfully");

    // Test with USDC deposit
    await sendTestMessageToDev(
      "USDC",
      "100",
      "0x1234567890123456789012345678901234567890",
      "0x9876543210987654321098765432109876543210",
      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567891"
    );

    console.log("✅ USDC test message sent successfully");

    // Test with USDT deposit
    await sendTestMessageToDev(
      "USDT",
      "50",
      "0x1234567890123456789012345678901234567890",
      "0x9876543210987654321098765432109876543210",
      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567892"
    );

    console.log("✅ USDT test message sent successfully");

    // Test with XIAOBAI deposit
    await sendTestMessageToDev(
      "XIAOBAI",
      "1000000",
      "0x1234567890123456789012345678901234567890",
      "0x9876543210987654321098765432109876543210",
      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567893"
    );

    console.log("✅ XIAOBAI test message sent successfully");

    console.log("\n🎉 All test messages sent successfully!");
    console.log("📱 Check your dev chat to see the animated GIF notifications");
  } catch (error) {
    console.error("❌ Error sending test messages:", error);
  }
}

testSendAnimation();
