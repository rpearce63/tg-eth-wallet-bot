#!/usr/bin/env node

// Simple test that mimics the working debug script
const TelegramBot = require("node-telegram-bot-api");

const TELEGRAM_BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN ||
  "5560564745:AAGItPTaoQQyxxnm7bAavxofMKN3z4ieAM0";
const DEV_CHAT_ID = process.env.DEV_CHAT_ID || "-1002545365231";

async function testSimpleAnimation() {
  console.log("🎬 Testing simple animation...");

  const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
  const imageUrl =
    "https://tg-eth-wallet-bot-v2-prod-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.gif";
  const testMsg = "🧪 TEST MESSAGE - Simple animation test";

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
    console.log("Message ID:", result.message_id);
  } catch (error) {
    console.error("❌ Animation failed:", error.message);
  }
}

testSimpleAnimation();
