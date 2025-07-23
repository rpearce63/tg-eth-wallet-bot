const TelegramBot = require("node-telegram-bot-api");

// Configuration
const TELEGRAM_BOT_TOKEN = "5560564745:AAGItPTaoQQyxxnm7bAavxofMKN3z4ieAM0";
const TELEGRAM_CHAT = -1002545365231; // Dev chat

// Token configuration
const TOKEN_VIDEOS = {
  ETH: "https://tg-eth-wallet-bot-dev-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.mp4",
};

const TOKEN_IMAGES = {
  ETH: "https://tg-eth-wallet-bot-dev-assets.s3.amazonaws.com/xiaobai_ani.gif",
};

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });

async function fetchEthPrice() {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
    );
    const data = await response.json();
    return data.ethereum.usd;
  } catch (error) {
    console.error("Error fetching ETH price:", error);
    return 3590; // Fallback price
  }
}

function truncateAddress(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

async function sendDepositMessage(token, amount, from, to, txHash) {
  try {
    const ethPrice = await fetchEthPrice();
    const usdValue = (parseFloat(amount) * ethPrice).toFixed(2);

    // Format amount with USD value
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

    let msg = `<b>New contribution detected!</b>\n\n<b>Token:</b> ${token}\n<b>Amount:</b> ${formattedAmount}\n\n<b>From:</b> ${fromLink}\n<b>To:</b> ${toLink}\n`;
    if (txHash) {
      msg += `\n<a href="https://etherscan.io/tx/${txHash}">View Transaction</a>`;
    }
    // Always add the XIAOBAI chart link
    msg += `\n<a href="https://www.dextools.io/app/en/token/xiaobaictoeth?t=1753120925113">View Chart</a>`;

    const videoUrl = TOKEN_VIDEOS[token];
    const imageUrl = TOKEN_IMAGES[token];

    if (videoUrl) {
      try {
        await bot.sendVideo(TELEGRAM_CHAT, videoUrl, {
          caption: msg,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        });
        console.log(`✅ Video notification sent for ${token} deposit`);
      } catch (error) {
        console.log(
          `[Video] Failed to send video for ${token}, falling back to image`
        );
        if (imageUrl) {
          await bot.sendPhoto(TELEGRAM_CHAT, imageUrl, {
            caption: msg,
            parse_mode: "HTML",
            disable_web_page_preview: true,
          });
        } else {
          await bot.sendMessage(TELEGRAM_CHAT, msg, {
            parse_mode: "HTML",
            disable_web_page_preview: true,
          });
        }
      }
    } else if (imageUrl) {
      await bot.sendPhoto(TELEGRAM_CHAT, imageUrl, {
        caption: msg,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
    } else {
      await bot.sendMessage(TELEGRAM_CHAT, msg, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
    }
  } catch (error) {
    console.error("Error sending deposit message:", error);
  }
}

async function sendTestTransaction() {
  console.log("🧪 Sending test transaction to dev chat...");

  // Test transaction data
  const testTransfer = {
    txHash:
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    amount: "0.1",
    from: "0x1234567890abcdef1234567890abcdef12345678",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
  };

  try {
    await sendDepositMessage(
      "ETH",
      testTransfer.amount,
      testTransfer.from,
      testTransfer.to,
      testTransfer.txHash
    );
    console.log("✅ Test transaction sent successfully!");
  } catch (error) {
    console.error("❌ Failed to send test transaction:", error);
  }
}

// Run the test
sendTestTransaction();
