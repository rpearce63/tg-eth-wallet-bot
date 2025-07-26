#!/usr/bin/env node

// Simple test script to verify sendAnimation functionality
const { sendTestEthMessage } = require("../index.js");

async function testSingleAnimation() {
  console.log("🎬 Testing single sendAnimation message...");

  try {
    await sendTestEthMessage();
    console.log("✅ ETH test message sent successfully!");
    console.log("📱 Check your dev chat to see the animated GIF notification");
  } catch (error) {
    console.error("❌ Error sending test message:", error);
  }
}

testSingleAnimation();
