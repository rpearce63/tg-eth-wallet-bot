#!/usr/bin/env node

// Debug the sendTestMessageToDev function specifically
const TelegramBot = require("node-telegram-bot-api");

const TELEGRAM_BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN ||
  "5560564745:AAGItPTaoQQyxxnm7bAavxofMKN3z4ieAM0";
const DEV_CHAT_ID = process.env.DEV_CHAT_ID || "-1002545365231";

// Simulate the exact TOKEN_IMAGES configuration from index.js
const TOKEN_IMAGES = {
  ETH: "https://tg-eth-wallet-bot-v2-prod-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.gif",
  USDC: "https://tg-eth-wallet-bot-v2-prod-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.gif",
  USDT: "https://tg-eth-wallet-bot-v2-prod-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.gif",
  XIAOBAI:
    "https://tg-eth-wallet-bot-v2-prod-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.gif",
};

async function debugTestFunction() {
  console.log("🔍 Debugging sendTestMessageToDev function...");

  const testBot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });

  // Test with ETH token (like the production function does)
  const token = "ETH";
  const imageUrl = TOKEN_IMAGES[token];

  console.log(`🔍 Token: ${token}`);
  console.log(`🔍 Image URL: ${imageUrl}`);

  // Check if URL is accessible
  try {
    const response = await fetch(imageUrl);
    console.log(`🔍 URL Status: ${response.status} ${response.statusText}`);
    if (response.ok) {
      console.log("✅ URL is accessible");
    } else {
      console.log("❌ URL is not accessible");
    }
  } catch (error) {
    console.log(`❌ URL fetch error: ${error.message}`);
  }

  // Test the exact logic from sendTestMessageToDev
  const isGif = imageUrl.toLowerCase().endsWith(".gif");
  const mediaType = isGif ? "animation" : "photo";
  console.log(`🔍 Is GIF: ${isGif}`);
  console.log(`🔍 Media Type: ${mediaType}`);

  const testMsg = `🧪 DEBUG TEST - ${token} animation test`;

  try {
    console.log(`🔍 Attempting to send ${mediaType}...`);

    const sendMethod = isGif ? testBot.sendAnimation : testBot.sendPhoto;
    const methodName = isGif ? "animation" : "photo";

    console.log(`🔍 Using method: ${methodName}`);
    console.log(`🔍 Method exists: ${typeof sendMethod}`);

    const result = await sendMethod(DEV_CHAT_ID, imageUrl, {
      caption: testMsg,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      width: 480,
      height: 270,
    });

    console.log(
      `✅ ${methodName} sent successfully! Message ID: ${result.message_id}`
    );
  } catch (error) {
    console.error(`❌ ${mediaType} failed:`, error.message);
    console.error(`❌ Full error:`, error);

    // Try fallback to text
    console.log("🔍 Attempting text fallback...");
    try {
      const textResult = await testBot.sendMessage(DEV_CHAT_ID, testMsg, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
      console.log(
        `✅ Text fallback sent successfully! Message ID: ${textResult.message_id}`
      );
    } catch (textError) {
      console.error(`❌ Text fallback also failed:`, textError.message);
    }
  }
}

debugTestFunction();
