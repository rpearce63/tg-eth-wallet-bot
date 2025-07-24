const TelegramBot = require("node-telegram-bot-api");

// Configuration
const TELEGRAM_BOT_TOKEN = "5560564745:AAGItPTaoQQyxxnm7bAavxofMKN3z4ieAM0";
const TELEGRAM_CHAT =
  process.env.STAGE === "prod" ? -1002753827191 : -1002545365231;

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });

async function testTelegramAPI() {
  console.log("🧪 Testing Telegram API...");
  console.log("📱 Chat ID:", TELEGRAM_CHAT);
  console.log("🤖 Bot Token:", TELEGRAM_BOT_TOKEN.substring(0, 20) + "...");

  try {
    console.log("📤 Sending test message...");
    const result = await bot.sendMessage(
      TELEGRAM_CHAT,
      "🧪 Test message from API test script - " + new Date().toISOString(),
      {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }
    );

    console.log("✅ Message sent successfully!");
    console.log("📋 Message ID:", result.message_id);
    console.log("📅 Date:", result.date);
    console.log("💬 Chat ID:", result.chat.id);

    return true;
  } catch (error) {
    console.error("❌ Error sending message:", error);
    console.error("📊 Error details:", {
      message: error.message,
      code: error.code,
      statusCode: error.response?.statusCode,
      statusMessage: error.response?.statusMessage,
      description: error.response?.description,
    });
    return false;
  }
}

// Run the test
testTelegramAPI().then((success) => {
  if (success) {
    console.log("🎉 Telegram API test passed!");
    process.exit(0);
  } else {
    console.log("💥 Telegram API test failed!");
    process.exit(1);
  }
});
