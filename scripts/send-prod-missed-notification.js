#!/usr/bin/env node

const { ethers } = require("ethers");
const TelegramBot = require("node-telegram-bot-api");

// Configuration - Production settings
const ETHEREUM_RPC =
  process.env.ETHEREUM_RPC ||
  "https://ethereum-mainnet.core.chainstack.com/b6dbac3a0035889f4fe0ecba93817555";
const TELEGRAM_BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN ||
  "5560564745:AAGItPTaoQQyxxnm7bAavxofMKN3z4ieAM0";
const TELEGRAM_CHAT = "-1002753827191"; // Production chat ID
const MARKETING_WALLET = "0xe453b6ba7d8a4b402dff9c1b2da18226c5c2a9d3";

// Token configurations (same as index.js)
const TOKENS = {
  USDT: {
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    decimals: 6,
  },
  USDC: {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
  },
  XIAOBAI: {
    address: "0xcb69E5750f8dC3b69647B9d8B1f45466ace0A027",
    decimals: 9,
  },
};

// Token videos (same as index.js)
const TOKEN_VIDEOS = {
  ETH: "https://tg-eth-wallet-bot-prod-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.mp4",
  USDC: "https://tg-eth-wallet-bot-prod-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.mp4",
  USDT: "https://tg-eth-wallet-bot-prod-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.mp4",
  XIAOBAI:
    "https://tg-eth-wallet-bot-prod-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.mp4",
};

// Token images (same as index.js)
const TOKEN_IMAGES = {
  ETH: "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif",
  USDC: "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif",
  USDT: "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif",
  XIAOBAI: "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif",
};

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });

// Function to truncate address (same as index.js)
function truncateAddress(addr) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// Function to fetch prices (same as index.js)
async function fetchPrices() {
  const url =
    "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,xiaobai&vs_currencies=usd";
  try {
    const res = await fetch(url);
    const data = await res.json();
    return {
      eth: data.ethereum?.usd || 0,
      xiaobai: data.xiaobai?.usd || 0,
    };
  } catch (e) {
    console.error("Error fetching prices from CoinGecko:", e);
    return { eth: 0, xiaobai: 0 };
  }
}

// Function to send deposit message (exact same as index.js)
async function sendDepositMessage(token, amount, from, to, txHash) {
  // Fetch USD prices for tokens that aren't USD-pegged
  let usdValue = null;
  if (token !== "USDC" && token !== "USDT") {
    try {
      const prices = await fetchPrices();
      if (token === "ETH") {
        usdValue = Number(amount) * prices.eth;
      } else if (token === "XIAOBAI") {
        usdValue = Number(amount) * prices.xiaobai;
      }
    } catch (error) {
      console.log(`[Price] Error fetching price for ${token}:`, error);
    }
  }

  // Format amount with USD value if available
  let formattedAmount = `<b>🟢 ${Number(amount).toLocaleString("en-US", {
    maximumFractionDigits: 18,
  })} ${token}</b>`;

  if (usdValue && usdValue > 0) {
    // Use more decimal places for very small values
    let decimalPlaces = 2;
    if (usdValue < 0.01) {
      decimalPlaces = 6; // Show up to 6 decimal places for very small values
    } else if (usdValue < 1) {
      decimalPlaces = 4; // Show up to 4 decimal places for small values
    }

    formattedAmount += ` <b>($${usdValue.toLocaleString("en-US", {
      maximumFractionDigits: decimalPlaces,
    })})</b>`;
  }

  const fromLink = `<a href="https://etherscan.io/address/${from}">${truncateAddress(
    from
  )}</a>`;
  const toLink = `<a href="https://etherscan.io/address/${to}">${truncateAddress(
    to
  )}</a>`;

  let msg = `New contribution detected!\n<b>Token:</b> ${token}\n<b>Amount:</b> ${formattedAmount}\n<b>From:</b> ${fromLink}\n<b>To:</b> ${toLink}`;

  if (txHash) {
    msg += `\n<a href="https://etherscan.io/tx/${txHash}">View Transaction</a>`;
  }

  // Always add the XIAOBAI chart link
  msg += `\n<a href="https://www.dextools.io/app/en/token/xiaobaictoeth?t=1753120925113">View Chart</a>`;

  // Try to send video first, fallback to image, then text
  const videoUrl = TOKEN_VIDEOS[token];
  const imageUrl = TOKEN_IMAGES[token];

  if (videoUrl) {
    try {
      await bot.sendVideo(TELEGRAM_CHAT, videoUrl, {
        caption: msg,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
      console.log(
        `✅ Video notification sent to production for ${token} deposit`
      );
    } catch (error) {
      console.log(
        `[Video] Failed to send video for ${token}, falling back to image`
      );
      // Fallback to image
      if (imageUrl) {
        await bot.sendPhoto(TELEGRAM_CHAT, imageUrl, {
          caption: msg,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        });
        console.log(
          `✅ Image notification sent to production for ${token} deposit`
        );
      } else {
        await bot.sendMessage(TELEGRAM_CHAT, msg, {
          parse_mode: "HTML",
          disable_web_page_preview: true,
        });
        console.log(
          `✅ Text notification sent to production for ${token} deposit`
        );
      }
    }
  } else if (imageUrl) {
    await bot.sendPhoto(TELEGRAM_CHAT, imageUrl, {
      caption: msg,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
    console.log(
      `✅ Image notification sent to production for ${token} deposit`
    );
  } else {
    await bot.sendMessage(TELEGRAM_CHAT, msg, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
    console.log(`✅ Text notification sent to production for ${token} deposit`);
  }
}

// Main function to send the missed notification to production
async function sendProdMissedNotification() {
  try {
    console.log(
      `📱 Sending missed notification to PRODUCTION for 7:03am XIAOBAI deposit...`
    );

    // The transaction details from our scan
    const txHash =
      "0x4e0b3cdc58ae30fbdd36d1ec890a3f81c86e62056ba0cae5982f2ae57ab66de5";
    const token = "XIAOBAI";
    const amount = "82542769229.903646583";
    const from = "0x9C6F88ecA61661aDc78535Ed8a97A6f99b581453";
    const to = MARKETING_WALLET;

    console.log(`📊 Transaction Details:`);
    console.log(`   Token: ${token}`);
    console.log(`   Amount: ${amount}`);
    console.log(`   From: ${from}`);
    console.log(`   To: ${to}`);
    console.log(`   TX Hash: ${txHash}`);
    console.log(`   Chat ID: ${TELEGRAM_CHAT} (PRODUCTION)`);
    console.log("");

    // Send the notification using the exact same format as index.js
    await sendDepositMessage(token, amount, from, to, txHash);

    console.log(`✅ Missed notification sent to production successfully!`);
  } catch (error) {
    console.error("❌ Error sending missed notification to production:", error);
  }
}

// Run the script
if (require.main === module) {
  sendProdMissedNotification();
}

module.exports = { sendProdMissedNotification };
