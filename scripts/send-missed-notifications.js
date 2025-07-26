const { ethers } = require("ethers");

// Configuration
const ETHEREUM_RPC =
  "wss://ethereum-mainnet.core.chainstack.com/b6dbac3a0035889f4fe0ecba93817555";
const TELEGRAM_BOT_TOKEN = "5560564745:AAGItPTaoQQyxxnm7bAavxofMKN3z4ieAM0";
const PROD_CHAT_ID = -1002753827191; // Changed from DEV_CHAT_ID to PROD_CHAT_ID

// ERC-20 token contract addresses
const TOKENS = {
  USDC: {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
  },
  USDT: {
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    decimals: 6,
  },
  XIAOBAI: {
    address: "0xcb69E5750f8dC3b69647B9d8B1f45466ace0A027",
    decimals: 9,
  },
};

// Token icons and media
const TOKEN_ICONS = {
  ETH: "🦄",
  USDC: "🪙",
  USDT: "💲",
  XIAOBAI: "🐕",
};

const TOKEN_VIDEOS = {
  ETH: "https://tg-eth-wallet-bot-prod-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.mp4", // Changed to prod URLs
  USDC: "https://tg-eth-wallet-bot-prod-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.mp4",
  USDT: "https://tg-eth-wallet-bot-prod-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.mp4",
  XIAOBAI:
    "https://tg-eth-wallet-bot-prod-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.mp4",
};

const TOKEN_IMAGES = {
  ETH: "https://tg-eth-wallet-bot-prod-assets.s3.amazonaws.com/xiaobai_ani.gif", // Changed to prod URLs
  USDC: "https://tg-eth-wallet-bot-prod-assets.s3.amazonaws.com/xiaobai_ani.gif",
  USDT: "https://tg-eth-wallet-bot-prod-assets.s3.amazonaws.com/xiaobai_ani.gif",
  XIAOBAI:
    "https://tg-eth-wallet-bot-prod-assets.s3.amazonaws.com/xiaobai_ani.gif",
};

const IMAGE_SIZE_CONFIG = {
  width: 400,
  height: 300,
  tokenSpecific: {
    ETH: { width: 450, height: 338 },
    USDC: { width: 400, height: 300 },
    USDT: { width: 400, height: 300 },
    XIAOBAI: { width: 500, height: 375 },
  },
};

// Initialize bot and provider
const TelegramBot = require("node-telegram-bot-api");
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
const provider = new ethers.JsonRpcProvider(
  ETHEREUM_RPC.replace("wss://", "https://")
);

// Helper functions
function truncateAddress(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

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

async function sendDepositMessage(token, amount, from, to, txHash) {
  console.log(
    `[Missed] Sending ${token} deposit message for transaction ${txHash}...`
  );

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
    let decimalPlaces = 2;
    if (usdValue < 0.01) {
      decimalPlaces = 6;
    } else if (usdValue < 1) {
      decimalPlaces = 4;
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

  // Changed title to original format (no "MISSED" mention)
  let msg = `<b>New contribution detected!</b>\n\n<b>Token:</b> ${token}\n<b>Amount:</b> ${formattedAmount}\n\n<b>From:</b> ${fromLink}\n<b>To:</b> ${toLink}\n`;
  if (txHash) {
    msg += `\n<a href="https://etherscan.io/tx/${txHash}">View Transaction</a>`;
  }
  msg += `\n<a href="https://www.dextools.io/app/en/token/xiaobaictoeth?t=1753120925113">View Chart</a>`;

  // Send text message only (skip video/image to avoid URL issues)
  try {
    await bot.sendMessage(PROD_CHAT_ID, msg, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
    console.log(
      `[Missed] ✅ ${token} deposit text message sent successfully to prod chat!`
    );
  } catch (error) {
    console.error(`[Missed] Error sending ${token} deposit message:`, error);
    throw error;
  }
}

async function processTransaction(txHash) {
  try {
    console.log(`[Missed] Processing transaction: ${txHash}`);

    // Get transaction details
    const tx = await provider.getTransaction(txHash);
    if (!tx) {
      console.log(`[Missed] ❌ Transaction not found: ${txHash}`);
      return false;
    }

    console.log(`[Missed] Transaction details:`);
    console.log(`  Hash: ${tx.hash}`);
    console.log(`  From: ${tx.from}`);
    console.log(`  To: ${tx.to}`);
    console.log(`  Value: ${tx.value}`);
    console.log(`  Block Number: ${tx.blockNumber}`);

    // Check if it's an ETH transfer
    if (tx.to && tx.value && tx.value > 0) {
      const ethAmount = ethers.formatEther(tx.value);
      console.log(`[Missed] ✅ Found ETH transfer: ${ethAmount} ETH`);

      await sendDepositMessage("ETH", ethAmount, tx.from, tx.to, tx.hash);
      return true;
    }

    // Check if it's an ERC-20 transfer by looking at the transaction receipt
    const receipt = await provider.getTransactionReceipt(txHash);
    if (receipt && receipt.logs) {
      for (const log of receipt.logs) {
        // Check if this is a Transfer event to our monitored address
        if (
          log.topics[0] ===
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
        ) {
          // Transfer event signature
          const toAddress = "0x" + log.topics[2].slice(26); // Extract 'to' address from topic

          // Check each token
          for (const [symbol, { address, decimals }] of Object.entries(
            TOKENS
          )) {
            if (log.address.toLowerCase() === address.toLowerCase()) {
              const value = ethers.getBigInt(log.data);
              const amount = ethers.formatUnits(value, decimals);

              console.log(
                `[Missed] ✅ Found ${symbol} transfer: ${amount} ${symbol}`
              );

              await sendDepositMessage(
                symbol,
                amount,
                tx.from,
                toAddress,
                tx.hash
              );
              return true;
            }
          }
        }
      }
    }

    console.log(
      `[Missed] ⚠️ No supported transfer found in transaction: ${txHash}`
    );
    return false;
  } catch (error) {
    console.error(`[Missed] Error processing transaction ${txHash}:`, error);
    return false;
  }
}

async function sendMissedNotifications(transactionHashes) {
  console.log(
    `[Missed] Starting to process ${transactionHashes.length} missed transactions...`
  );

  let successCount = 0;
  let errorCount = 0;

  for (const txHash of transactionHashes) {
    try {
      const success = await processTransaction(txHash);
      if (success) {
        successCount++;
      } else {
        errorCount++;
      }

      // Add a small delay between transactions to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`[Missed] Failed to process ${txHash}:`, error);
      errorCount++;
    }
  }

  console.log(`[Missed] Summary:`);
  console.log(`  ✅ Successful: ${successCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log(`  📊 Total: ${transactionHashes.length}`);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(
      "Usage: node scripts/send-missed-notifications.js <txHash1> <txHash2> ..."
    );
    console.log(
      "Example: node scripts/send-missed-notifications.js 0x123... 0x456..."
    );
    process.exit(1);
  }

  console.log(`[Missed] Processing ${args.length} transaction hashes...`);
  console.log(`[Missed] Transaction hashes:`, args);

  await sendMissedNotifications(args);

  console.log(`[Missed] All done!`);
  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error(`[Missed] Fatal error:`, error);
    process.exit(1);
  });
}

module.exports = { sendMissedNotifications, processTransaction };
