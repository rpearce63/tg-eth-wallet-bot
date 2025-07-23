#!/usr/bin/env node

const { ethers } = require("ethers");
const TelegramBot = require("node-telegram-bot-api");

// Configuration
const ETHEREUM_RPC =
  process.env.ETHEREUM_RPC ||
  "https://ethereum-mainnet.core.chainstack.com/b6dbac3a0035889f4fe0ecba93817555";
const TELEGRAM_BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN ||
  "5560564745:AAGItPTaoQQyxxnm7bAavxofMKN3z4ieAM0";
const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT || "-1002545365231";
const MARKETING_WALLET = "0xe453b6ba7d8a4b402dff9c1b2da18226c5c2a9d3";

// Token configurations
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

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });

// Function to format amount with proper decimals
function formatAmount(amount, decimals) {
  return ethers.formatUnits(amount, decimals);
}

// Function to truncate address
function truncateAddress(addr) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// Function to send deposit message
async function sendDepositMessage(token, amount, from, to, txHash) {
  try {
    // Get USD prices
    const prices = await fetchPrices();

    // Format amount based on token
    let formattedAmount = amount;
    let usdValue = 0;

    if (token === "XIAOBAI") {
      usdValue = Number(amount) * prices.xiaobai;
      // Format with more decimals for very small values
      const decimals = usdValue < 1 ? 6 : 2;
      formattedAmount = `${Number(amount).toLocaleString("en-US", {
        maximumFractionDigits: 8,
      })} ${token} ($${usdValue.toLocaleString("en-US", {
        maximumFractionDigits: decimals,
      })})`;
    } else if (token === "ETH") {
      usdValue = Number(amount) * prices.eth;
      formattedAmount = `${Number(amount).toLocaleString("en-US", {
        maximumFractionDigits: 4,
      })} ${token} ($${usdValue.toLocaleString("en-US", {
        maximumFractionDigits: 2,
      })})`;
    } else {
      // USDC/USDT - assume $1 each
      usdValue = Number(amount);
      formattedAmount = `${Number(amount).toLocaleString("en-US", {
        maximumFractionDigits: 2,
      })} ${token} ($${usdValue.toLocaleString("en-US", {
        maximumFractionDigits: 2,
      })})`;
    }

    const message =
      `💰 <b>New ${token} Deposit!</b>\n\n` +
      `Amount: <b>${formattedAmount}</b>\n` +
      `From: <code>${truncateAddress(from)}</code>\n` +
      `To: <code>${truncateAddress(to)}</code>\n` +
      `Transaction: <a href="https://etherscan.io/tx/${txHash}">View on Etherscan</a>\n\n` +
      `Keep contributing to beat the previous records! 🚀`;

    // Try to send video first, then fallback to message
    try {
      const videoUrl =
        "https://tg-eth-wallet-bot-dev-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.mp4";
      await bot.sendVideo(TELEGRAM_CHAT, videoUrl, {
        caption: message,
        parse_mode: "HTML",
        supports_streaming: true,
      });
      console.log(`✅ Video notification sent for ${token} deposit`);
    } catch (videoError) {
      console.log(
        `⚠️  Video failed, sending text message: ${videoError.message}`
      );
      await bot.sendMessage(TELEGRAM_CHAT, message, { parse_mode: "HTML" });
      console.log(`✅ Text notification sent for ${token} deposit`);
    }
  } catch (error) {
    console.error(`❌ Error sending ${token} notification:`, error);
  }
}

// Function to fetch prices
async function fetchPrices() {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,xiaobai&vs_currencies=usd"
    );
    const data = await response.json();

    return {
      eth: data.ethereum?.usd || 3000,
      xiaobai: data.xiaobai?.usd || 0.00000000137,
    };
  } catch (error) {
    console.error("Error fetching prices:", error);
    return {
      eth: 3000,
      xiaobai: 0.00000000137,
    };
  }
}

// Main function to send the missed notification
async function sendMissedNotification() {
  try {
    console.log(`📱 Sending missed notification for 7:03am XIAOBAI deposit...`);

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
    console.log(`   Chat ID: ${TELEGRAM_CHAT}`);
    console.log("");

    // Send the notification
    await sendDepositMessage(token, amount, from, to, txHash);

    console.log(`✅ Missed notification sent successfully!`);
  } catch (error) {
    console.error("❌ Error sending missed notification:", error);
  }
}

// Run the script
if (require.main === module) {
  sendMissedNotification();
}

module.exports = { sendMissedNotification };
