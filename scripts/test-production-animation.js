#!/usr/bin/env node

// Test that mimics the working simple test but through production pattern
const TelegramBot = require("node-telegram-bot-api");

const TELEGRAM_BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN ||
  "5560564745:AAGItPTaoQQyxxnm7bAavxofMKN3z4ieAM0";
const DEV_CHAT_ID = process.env.DEV_CHAT_ID || "-1002545365231";

async function testProductionAnimation() {
  console.log("🎬 Testing production animation pattern...");

  const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
  const imageUrl =
    "https://tg-eth-wallet-bot-v2-prod-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.gif";

  // Test all token types like the production test does
  const tokens = ["ETH", "USDC", "USDT", "XIAOBAI"];

  for (const token of tokens) {
    const testMsg = `🧪 TEST MESSAGE - ${token} production animation test`;

    try {
      console.log(`🎬 Testing ${token} animation...`);

      const result = await bot.sendAnimation(DEV_CHAT_ID, imageUrl, {
        caption: testMsg,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        width: 480,
        height: 270,
      });

      console.log(
        `✅ ${token} animation sent successfully! Message ID: ${result.message_id}`
      );

      // Wait 2 seconds between messages like the production test
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`❌ ${token} animation failed:`, error.message);
    }
  }

  console.log("🎉 Production animation test completed!");
}

testProductionAnimation();
