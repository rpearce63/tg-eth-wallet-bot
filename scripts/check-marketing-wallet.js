const { ethers } = require("ethers");

// Configuration
const ETHEREUM_RPC =
  "https://ethereum-mainnet.core.chainstack.com/b6dbac3a0035889f4fe0ecba93817555";
const MARKETING_WALLET = "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3";

async function checkMarketingWallet() {
  console.log("🔍 Checking marketing wallet status...");

  const provider = new ethers.JsonRpcProvider(ETHEREUM_RPC);

  try {
    // Get current balance
    const balance = await provider.getBalance(MARKETING_WALLET);
    const balanceEth = ethers.formatEther(balance);

    console.log(`💰 Marketing Wallet: ${MARKETING_WALLET}`);
    console.log(`💎 Current Balance: ${balanceEth} ETH`);

    // Get current block
    const currentBlock = await provider.getBlockNumber();
    console.log(`📦 Current Block: ${currentBlock}`);

    // Check recent transactions (last 1000 blocks)
    console.log("\n🔍 Checking recent incoming transactions...");

    const blocksToCheck = 1000;
    const startBlock = currentBlock - blocksToCheck;

    let ethTransfers = [];

    for (
      let blockNumber = startBlock;
      blockNumber <= currentBlock;
      blockNumber++
    ) {
      try {
        // Add delay to respect RPC rate limits
        if (blockNumber % 100 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        const block = await provider.getBlock(blockNumber, true);
        if (!block) continue;

        // Check each transaction in the block
        for (const tx of block.transactions) {
          if (
            tx.to &&
            tx.to.toLowerCase() === MARKETING_WALLET.toLowerCase() &&
            tx.value &&
            tx.value > 0
          ) {
            const ethAmount = ethers.formatEther(tx.value);
            ethTransfers.push({
              blockNumber,
              txHash: tx.hash,
              from: tx.from,
              amount: ethAmount,
              timestamp: block.timestamp,
            });
          }
        }
      } catch (error) {
        console.error(
          `❌ Error processing block ${blockNumber}:`,
          error.message
        );
      }
    }

    console.log(
      `\n📊 Found ${ethTransfers.length} ETH transfers in the last ${blocksToCheck} blocks`
    );

    if (ethTransfers.length > 0) {
      console.log("\n📋 Recent ETH Transfers:");
      ethTransfers.slice(-10).forEach((transfer, index) => {
        const date = new Date(transfer.timestamp * 1000);
        console.log(
          `${index + 1}. Block ${transfer.blockNumber} (${date.toISOString()})`
        );
        console.log(`   Amount: ${transfer.amount} ETH`);
        console.log(`   From: ${transfer.from}`);
        console.log(`   Hash: ${transfer.txHash}`);
        console.log("");
      });
    } else {
      console.log("\n❌ No ETH transfers found in the last 1000 blocks");
      console.log("This could mean:");
      console.log("1. No ETH transfers have occurred recently");
      console.log("2. The bot is working correctly and catching all transfers");
      console.log(
        "3. There might be an issue with the monitoring configuration"
      );
    }
  } catch (error) {
    console.error("❌ Error checking marketing wallet:", error);
  }
}

// Run the check
checkMarketingWallet();
