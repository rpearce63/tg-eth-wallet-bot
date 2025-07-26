#!/usr/bin/env node

// Test sendDocument as alternative to sendAnimation
const TelegramBot = require("node-telegram-bot-api");

const TELEGRAM_BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN ||
  "5560564745:AAGItPTaoQQyxxnm7bAavxofMKN3z4ieAM0";
const DEV_CHAT_ID = process.env.DEV_CHAT_ID || "-1002545365231";

async function testSendDocument() {
  console.log("📄 Testing sendDocument method...");

  const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
  const imageUrl =
    "https://tg-eth-wallet-bot-v2-prod-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.gif";

  const testMsg = `🧪 TEST - sendDocument method for animated GIF`;

  try {
    console.log("📄 Attempting to send document...");

    const result = await bot.sendDocument(DEV_CHAT_ID, imageUrl, {
      caption: testMsg,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });

    console.log(
      `✅ Document sent successfully! Message ID: ${result.message_id}`
    );
  } catch (error) {
    console.error(`❌ Document failed:`, error.message);

    // Try text fallback
    try {
      const textResult = await bot.sendMessage(DEV_CHAT_ID, testMsg, {
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

testSendDocument();
