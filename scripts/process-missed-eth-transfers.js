const { ethers } = require("ethers");
const TelegramBot = require("node-telegram-bot-api");
const AWS = require("aws-sdk");

// Configuration
const TELEGRAM_BOT_TOKEN = "5560564745:AAGItPTaoQQyxxnm7bAavxofMKN3z4ieAM0";
const TELEGRAM_CHAT =
  process.env.STAGE === "prod" ? -1002753827191 : -1002545365231;
const ETHEREUM_RPC =
  "https://ethereum-mainnet.core.chainstack.com/b6dbac3a0035889f4fe0ecba93817555";

// DynamoDB setup
const dynamoClient = new AWS.DynamoDB.DocumentClient({
  region: "us-east-1",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const TABLE_NAME =
  process.env.STAGE === "prod"
    ? "tg-eth-wallet-bot-deposits-prod"
    : "tg-eth-wallet-bot-deposits-dev";

// Token configuration
const TOKEN_ICONS = {
  ETH: "🦄",
  USDC: "🪙",
  USDT: "💲",
  XIAOBAI: "🐕",
};

const TOKEN_VIDEOS = {
  ETH:
    process.env.STAGE === "prod"
      ? "https://tg-eth-wallet-bot-prod-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.mp4"
      : "https://tg-eth-wallet-bot-dev-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.mp4",
};

const TOKEN_IMAGES = {
  ETH:
    process.env.STAGE === "prod"
      ? "https://tg-eth-wallet-bot-prod-assets.s3.amazonaws.com/xiaobai_ani.gif"
      : "https://tg-eth-wallet-bot-dev-assets.s3.amazonaws.com/xiaobai_ani.gif",
};

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });

// ETH transfers from Etherscan CSV (only the ones with actual ETH amounts)
const ETH_TRANSFERS = [
  {
    txHash:
      "0x550d207757cd5a86f0f10c8ba2db6f95efc1d1285681bd6498b34971610839ba",
    block: 22983136,
    amount: "0.001",
    from: "0x3f3aa3bd1e0d80a2470689d0cdf19f7a97c16123",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
  },
  {
    txHash:
      "0xfc3d2029c0a998e328de4119b6cf72664736f6d6e27b171aa1651d010582d2ec",
    block: 22983115,
    amount: "0.0078",
    from: "0x7f2f41a72b45218fbf9b86b7ea6a8300e64ce5b1",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
  },
  {
    txHash:
      "0x45624bbe3975163e1adfebbfca609d08e65b70dd8650103e49cb68270886b398",
    block: 22983089,
    amount: "0.042",
    from: "0x704e7e61ebf9ad65665cbdddb9f1e57b97a6259b",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
  },
  {
    txHash:
      "0x9545bce0cc31435850068a716d7c651ce5600be66dc05fdbe6147622dd1739b1",
    block: 22983022,
    amount: "0.0005",
    from: "0x3f3aa3bd1e0d80a2470689d0cdf19f7a97c16123",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
  },
  {
    txHash:
      "0x9aec82463678a44a6500498dd552b5bf86c6cabe8fba10b8c63d8e152beb6da5",
    block: 22982850,
    amount: "0.02761626",
    from: "0x30030d2297c908745e08c44702a09c3b200e3350",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
  },
  {
    txHash:
      "0x014b17c9b992efe101fb3e7a65b3ff44d5715c6e2fd121fc13a99472857e196d",
    block: 22982831,
    amount: "0.0277",
    from: "0xe50238d691494fb26f60ab97bb19fcb7a22aec07",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
  },
  {
    txHash:
      "0x92e7c2c16850a5a0f5d54b382d65c8cbe28d230e7fc39633e138a2e2ba513da5",
    block: 22982487,
    amount: "0.055",
    from: "0xe50238d691494fb26f60ab97bb19fcb7a22aec07",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
  },
  {
    txHash:
      "0x92ee7b7eae41a0a09737c9b4495a2f26bde754cad2d07337bfed2c63c2de9f1d",
    block: 22982310,
    amount: "0.001",
    from: "0x3f3aa3bd1e0d80a2470689d0cdf19f7a97c16123",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
  },
  {
    txHash:
      "0xf5c5c2e10d0851317b3cc1a8100b78e7337cbe54423d4a8e55182f73636b5a95",
    block: 22981789,
    amount: "0.054525",
    from: "0x704e7e61ebf9ad65665cbdddb9f1e57b97a6259b",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
  },
  {
    txHash:
      "0x38781efd1e9d272d77140a706db95b4a89f4a62f193c8ef40611f069bade4ef2",
    block: 22981723,
    amount: "0.02887968",
    from: "0x6c8c7c09fa24327f2e0cf714901c6f6700d6622c",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
  },
  {
    txHash:
      "0xc6c976779ed3568b512f052894310b9bb9803ee0b32b4862100e1fb5fd28514e",
    block: 22964329,
    amount: "0.08563993",
    from: "0x6c8c7c09fa24327f2e0cf714901c6f6700d6622c",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
  },
  {
    txHash:
      "0x2628634dfdce030a5d80581490ffb1bd7b7fb2309d3cb61fc4bbc1966ab23171",
    block: 22946149,
    amount: "0.01612683",
    from: "0x30030d2297c908745e08c44702a09c3b200e3350",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
  },
  {
    txHash:
      "0xb88c41dc5b7f1b9213a581190768bb3378450a947f99adc3b5a4d1744906e6bd",
    block: 22945627,
    amount: "0.078",
    from: "0x44e12c4591cff2921496b269d55536f224bb9a7d",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
  },
  {
    txHash:
      "0x3487b561abe09f54baeedc33a34bbc54f64e8846459b3c5d3d638dcca54873e6",
    block: 22941704,
    amount: "0.0057",
    from: "0x0d4e159d1f7651c1805af2084ea1f047a76bb619",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
  },
  {
    txHash:
      "0x401e1c1a92a15b20f5ce2530f4d20c82bb9e03e74c6da078c68af229e570dd2a",
    block: 22932810,
    amount: "0.06535805",
    from: "0x2417489382ec44030f8f4e7b3caff3586d3bab71",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
  },
];

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

    const msg = `🎉 <b>New ${token} Deposit!</b>

💰 <b>Amount:</b> ${amount} ${token} ($${usdValue})
👤 <b>From:</b> <code>${truncateAddress(from)}</code>
🎯 <b>To:</b> <code>${truncateAddress(to)}</code>
🔗 <b>Transaction:</b> <a href="https://etherscan.io/tx/${txHash}">View on Etherscan</a>

⏰ <i>Detected at ${new Date().toISOString()}</i>`;

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

async function saveDepositToDynamoDB(deposit) {
  try {
    await dynamoClient
      .put({
        TableName: TABLE_NAME,
        Item: {
          txHash: deposit.txHash,
          token: deposit.token,
          amount: deposit.amount,
          from: deposit.from,
          to: deposit.to,
          timestamp: Date.now(),
          blockNumber: deposit.blockNumber,
        },
      })
      .promise();
    return true;
  } catch (error) {
    console.error("Error saving to DynamoDB:", error);
    return false;
  }
}

async function processMissedEthTransfers() {
  console.log("🚨 Processing missed ETH transfers...");
  console.log(`📊 Processing ${ETH_TRANSFERS.length} missed ETH transfers`);
  console.log(`📱 Sending to chat: ${TELEGRAM_CHAT}`);
  console.log(`🗄️  Saving to table: ${TABLE_NAME}\n`);

  let processedCount = 0;
  let failedCount = 0;

  for (const transfer of ETH_TRANSFERS) {
    try {
      console.log(
        `📝 Processing: ${transfer.amount} ETH from block ${transfer.block}`
      );

      // Save to DynamoDB
      const saved = await saveDepositToDynamoDB({
        txHash: transfer.txHash,
        token: "ETH",
        amount: transfer.amount,
        from: transfer.from,
        to: transfer.to,
        blockNumber: transfer.block,
      });

      if (saved) {
        // Send notification
        await sendDepositMessage(
          "ETH",
          transfer.amount,
          transfer.from,
          transfer.to,
          transfer.txHash
        );
        processedCount++;
        console.log(
          `✅ Processed: ${transfer.amount} ETH from ${transfer.from}`
        );
      } else {
        failedCount++;
        console.log(
          `❌ Failed to save: ${transfer.amount} ETH from ${transfer.from}`
        );
      }

      // Add delay between notifications
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      failedCount++;
      console.error(
        `❌ Error processing transfer ${transfer.txHash}:`,
        error.message
      );
    }
  }

  console.log("\n📊 PROCESSING SUMMARY:");
  console.log(`Total transfers: ${ETH_TRANSFERS.length}`);
  console.log(`Successfully processed: ${processedCount}`);
  console.log(`Failed: ${failedCount}`);

  if (processedCount > 0) {
    console.log("\n🎉 Successfully processed missed ETH transfers!");
  } else {
    console.log(
      "\n❌ Failed to process any transfers. Check DynamoDB table and permissions."
    );
  }
}

// Run the processing
processMissedEthTransfers();
