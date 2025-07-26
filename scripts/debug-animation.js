#!/usr/bin/env node

// Debug script to test animation with detailed error logging
const TelegramBot = require("node-telegram-bot-api");

const TELEGRAM_BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN ||
  "5560564745:AAGItPTaoQQyxxnm7bAavxofMKN3z4ieAM0";
const DEV_CHAT_ID = process.env.DEV_CHAT_ID || "-1002545365231";

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });

async function debugAnimation() {
  console.log("🔍 Debugging animation issue...");
  console.log(`Bot Token: ${TELEGRAM_BOT_TOKEN ? "Set" : "NOT SET"}`);
  console.log(`Dev Chat ID: ${DEV_CHAT_ID}`);

  const imageUrl =
    "https://tg-eth-wallet-bot-v2-prod-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.gif";
  const testMsg = "🧪 TEST MESSAGE - Testing sendAnimation functionality";

  console.log(`Image URL: ${imageUrl}`);

  try {
    console.log("🎬 Attempting to send animation...");

    const result = await bot.sendAnimation(DEV_CHAT_ID, imageUrl, {
      caption: testMsg,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      width: 480,
      height: 270,
    });

    console.log("✅ Animation sent successfully!");
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("❌ Animation failed with error:");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error code:", error.code);
    console.error("Full error:", error);

    // Try with sendPhoto as fallback
    try {
      console.log("📷 Trying sendPhoto as fallback...");
      const photoResult = await bot.sendPhoto(DEV_CHAT_ID, imageUrl, {
        caption: testMsg + " (Photo fallback)",
        parse_mode: "HTML",
        disable_web_page_preview: true,
        width: 480,
        height: 270,
      });
      console.log("✅ Photo sent successfully!");
      console.log("Photo result:", JSON.stringify(photoResult, null, 2));
    } catch (photoError) {
      console.error("❌ Photo also failed:");
      console.error("Photo error:", photoError.message);
    }
  }
}

debugAnimation();
