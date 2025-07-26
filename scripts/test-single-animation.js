#!/usr/bin/env node

// Simple test script to verify sendAnimation functionality
const { sendTestEthMessage } = require("../index.js");

async function testSingleAnimation() {
  console.log("🎬 Testing single sendAnimation message...");

  try {
    console.log("📞 Calling sendTestEthMessage...");
    await sendTestEthMessage();
    console.log("✅ ETH test message sent successfully!");
    console.log("📱 Check your dev chat to see the animated GIF notification");
  } catch (error) {
    console.error("❌ Error sending test message:");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
  }
}

testSingleAnimation();
