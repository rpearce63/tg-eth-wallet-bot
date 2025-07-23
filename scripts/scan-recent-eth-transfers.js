const { ethers } = require("ethers");
const AWS = require("aws-sdk");

// Configuration
const ETHEREUM_RPC =
  "https://ethereum-mainnet.core.chainstack.com/b6dbac3a0035889f4fe0ecba93817555";
const MONITORED_ADDRESSES = [
  "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3".toLowerCase(),
];

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

async function scanRecentEthTransfers() {
  console.log("🔍 Scanning recent blocks for ETH transfers...");

  const provider = new ethers.JsonRpcProvider(ETHEREUM_RPC);

  try {
    // Get current block number
    const currentBlock = await provider.getBlockNumber();
    console.log(`📦 Current block: ${currentBlock}`);

    // Scan last 200 blocks (adjust as needed)
    const blocksToScan = 200;
    const startBlock = currentBlock - blocksToScan;

    console.log(`🔍 Scanning blocks ${startBlock} to ${currentBlock}...`);

    let totalEthTransfers = 0;
    let missedTransfers = 0;
    let processedTransfers = 0;

    for (
      let blockNumber = startBlock;
      blockNumber <= currentBlock;
      blockNumber++
    ) {
      try {
        // Add delay to respect RPC rate limits
        await new Promise((resolve) => setTimeout(resolve, 200));

        const block = await provider.getBlock(blockNumber, true);
        if (!block) {
          console.log(`⚠️  Block ${blockNumber} not found`);
          continue;
        }

        let blockEthTransfers = 0;

        // Check each transaction in the block
        for (const tx of block.transactions) {
          if (
            tx.to &&
            MONITORED_ADDRESSES.includes(tx.to.toLowerCase()) &&
            tx.value &&
            tx.value > 0
          ) {
            const ethAmount = ethers.formatEther(tx.value);
            const wasProcessed = await isTransactionProcessed(tx.hash);

            totalEthTransfers++;
            blockEthTransfers++;

            if (wasProcessed) {
              processedTransfers++;
              console.log(
                `✅ Block ${blockNumber}: ETH ${ethAmount} from ${tx.from} to ${tx.to} (PROCESSED)`
              );
            } else {
              missedTransfers++;
              console.log(
                `❌ Block ${blockNumber}: ETH ${ethAmount} from ${tx.from} to ${tx.to} (MISSED!)`
              );
              console.log(`   Transaction Hash: ${tx.hash}`);
            }
          }
        }

        if (blockEthTransfers > 0) {
          console.log(
            `📊 Block ${blockNumber}: ${blockEthTransfers} ETH transfers found`
          );
        }
      } catch (error) {
        console.error(
          `❌ Error processing block ${blockNumber}:`,
          error.message
        );
      }
    }

    console.log("\n📊 SCAN SUMMARY:");
    console.log(`Total ETH transfers found: ${totalEthTransfers}`);
    console.log(`Already processed: ${processedTransfers}`);
    console.log(`Missed transfers: ${missedTransfers}`);

    if (missedTransfers > 0) {
      console.log("\n🚨 MISSED TRANSFERS DETECTED!");
      console.log("The bot may need configuration adjustments.");
    } else {
      console.log("\n✅ All ETH transfers appear to be processed correctly.");
    }
  } catch (error) {
    console.error("❌ Error during scan:", error);
  }
}

// Run the scan
scanRecentEthTransfers();
