#!/usr/bin/env node

// Test using direct HTTP requests to Telegram Bot API
const https = require("https");

const TELEGRAM_BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN ||
  "5560564745:AAGItPTaoQQyxxnm7bAavxofMKN3z4ieAM0";
const DEV_CHAT_ID = process.env.DEV_CHAT_ID || "-1002545365231";

function makeTelegramRequest(method, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);

    const options = {
      hostname: "api.telegram.org",
      port: 443,
      path: `/bot${TELEGRAM_BOT_TOKEN}/${method}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let responseData = "";

      res.on("data", (chunk) => {
        responseData += chunk;
      });

      res.on("end", () => {
        try {
          const result = JSON.parse(responseData);
          if (result.ok) {
            resolve(result.result);
          } else {
            reject(new Error(`Telegram API error: ${result.description}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function testDirectAPI() {
  console.log("🌐 Testing direct Telegram Bot API...");

  const imageUrl =
    "https://tg-eth-wallet-bot-v2-prod-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.gif";
  const testMsg = `🧪 TEST - Direct API call for animated GIF`;

  try {
    console.log("🌐 Attempting to send document via direct API...");

    const result = await makeTelegramRequest("sendDocument", {
      chat_id: DEV_CHAT_ID,
      document: imageUrl,
      caption: testMsg,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });

    console.log(
      `✅ Document sent successfully via direct API! Message ID: ${result.message_id}`
    );
  } catch (error) {
    console.error(`❌ Direct API failed:`, error.message);

    // Try text fallback
    try {
      console.log("🌐 Attempting text fallback via direct API...");
      const textResult = await makeTelegramRequest("sendMessage", {
        chat_id: DEV_CHAT_ID,
        text: testMsg,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
      console.log(
        `✅ Text fallback sent successfully via direct API! Message ID: ${textResult.message_id}`
      );
    } catch (textError) {
      console.error(`❌ Text fallback also failed:`, textError.message);
    }
  }
}

testDirectAPI();
