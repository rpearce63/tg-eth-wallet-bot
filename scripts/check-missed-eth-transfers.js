const AWS = require("aws-sdk");

// DynamoDB setup
const dynamoClient = new AWS.DynamoDB.DocumentClient({
  region: "us-east-1",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const TABLE_NAME =
  process.env.STAGE === "prod"
    ? "tg-eth-wallet-bot-prod-deposits"
    : "tg-eth-wallet-bot-dev-deposits";

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

async function isTransactionProcessed(txHash) {
  try {
    const result = await dynamoClient
      .get({
        TableName: TABLE_NAME,
        Key: { txHash: txHash },
      })
      .promise();
    return !!result.Item;
  } catch (error) {
    console.error("Error checking transaction:", error);
    return false;
  }
}

async function checkMissedEthTransfers() {
  console.log(
    "🔍 Checking which ETH transfers from Etherscan were missed by the bot..."
  );
  console.log(
    `📊 Checking ${ETH_TRANSFERS.length} ETH transfers against DynamoDB table: ${TABLE_NAME}\n`
  );

  let processedCount = 0;
  let missedCount = 0;
  let missedTransfers = [];

  for (const transfer of ETH_TRANSFERS) {
    const wasProcessed = await isTransactionProcessed(transfer.txHash);

    if (wasProcessed) {
      processedCount++;
      console.log(
        `✅ Block ${transfer.block}: ${transfer.amount} ETH (PROCESSED)`
      );
    } else {
      missedCount++;
      missedTransfers.push(transfer);
      console.log(
        `❌ Block ${transfer.block}: ${transfer.amount} ETH from ${transfer.from} (MISSED!)`
      );
      console.log(`   Hash: ${transfer.txHash}`);
    }
  }

  console.log("\n📊 SUMMARY:");
  console.log(`Total ETH transfers from Etherscan: ${ETH_TRANSFERS.length}`);
  console.log(`Processed by bot: ${processedCount}`);
  console.log(`Missed by bot: ${missedCount}`);

  if (missedCount > 0) {
    console.log("\n🚨 MISSED TRANSFERS:");
    missedTransfers.forEach((transfer, index) => {
      console.log(
        `${index + 1}. Block ${transfer.block}: ${transfer.amount} ETH`
      );
      console.log(`   From: ${transfer.from}`);
      console.log(`   Hash: ${transfer.txHash}`);
    });

    console.log("\n💡 RECOMMENDATIONS:");
    console.log("1. The bot may need to scan more blocks per run");
    console.log("2. The scanning frequency may need to be increased");
    console.log("3. There may be RPC rate limiting issues");
    console.log(
      "4. Consider implementing a catch-up mechanism for missed blocks"
    );
  } else {
    console.log("\n✅ All ETH transfers were processed correctly!");
  }
}

// Run the check
checkMissedEthTransfers();
