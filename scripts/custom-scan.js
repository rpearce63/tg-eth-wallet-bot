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

const ERC20_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

console.log(`🔍 Starting custom scan for missed deposits...`);

async function scanBlockRange(startBlock, endBlock) {
  const provider = new ethers.JsonRpcProvider(ETHEREUM_RPC);
  let ethDeposits = 0;
  let erc20Deposits = 0;

  console.log(`📊 Scanning blocks ${startBlock} to ${endBlock}...`);

  for (let blockNumber = startBlock; blockNumber <= endBlock; blockNumber++) {
    try {
      console.log(`🔍 Processing block ${blockNumber}...`);

      // Add delay to respect RPC rate limits
      await new Promise((resolve) => setTimeout(resolve, 500));

      const block = await provider.getBlock(blockNumber, true);
      if (!block) {
        console.log(`⚠️  Block ${blockNumber} not found`);
        continue;
      }

      // Process ETH transactions
      for (const tx of block.transactions) {
        if (
          tx.to &&
          tx.to.toLowerCase() === MARKETING_WALLET &&
          tx.value &&
          tx.value > 0
        ) {
          const ethAmount = ethers.formatEther(tx.value);
          console.log(
            `💰 ETH deposit found in block ${blockNumber}: ${ethAmount} ETH from ${tx.from} to ${tx.to} (tx: ${tx.hash})`
          );
          ethDeposits++;
        }
      }

      // Process ERC-20 transfers
      for (const [symbol, { address, decimals }] of Object.entries(TOKENS)) {
        try {
          // Add delay between contract queries
          await new Promise((resolve) => setTimeout(resolve, 200));

          const contract = new ethers.Contract(address, ERC20_ABI, provider);
          const filter = contract.filters.Transfer(null, null);
          const events = await contract.queryFilter(
            filter,
            blockNumber,
            blockNumber
          );

          for (const event of events) {
            const { from, to, value } = event.args;
            if (to && to.toLowerCase() === MARKETING_WALLET) {
              const amount = ethers.formatUnits(value, decimals);
              const txHash =
                event.transactionHash || event.log?.transactionHash;
              console.log(
                `💰 ${symbol} deposit found in block ${blockNumber}: ${amount} ${symbol} from ${from} to ${to} (tx: ${txHash})`
              );
              erc20Deposits++;
            }
          }
        } catch (error) {
          if (error.error && error.error.code === -32005) {
            console.log(
              `⏳ Rate limit hit for ${symbol} in block ${blockNumber}, waiting...`
            );
            await new Promise((resolve) => setTimeout(resolve, 2000));
          } else {
            console.error(
              `❌ Error processing ${symbol} in block ${blockNumber}:`,
              error.message
            );
          }
        }
      }
    } catch (error) {
      if (error.error && error.error.code === -32005) {
        console.log(`⏳ Rate limit hit for block ${blockNumber}, waiting...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else {
        console.error(
          `❌ Error processing block ${blockNumber}:`,
          error.message
        );
      }
    }
  }

  console.log(`\n📊 Scan Results:`);
  console.log(`   - ETH deposits found: ${ethDeposits}`);
  console.log(`   - ERC-20 deposits found: ${erc20Deposits}`);
  console.log(`   - Total deposits found: ${ethDeposits + erc20Deposits}`);
  console.log(`   - Blocks scanned: ${endBlock - startBlock + 1}`);

  return { ethDeposits, erc20Deposits };
}

// Main function
async function main() {
  try {
    // Target the block range around the 7:03am deposit (block 22981745)
    const targetBlock = 22981745;
    const startBlock = targetBlock - 5; // 5 blocks before
    const endBlock = targetBlock + 5; // 5 blocks after

    console.log(
      `🎯 Targeting block range around 7:03am deposit (block ${targetBlock})`
    );
    console.log(`📅 Scan range: ${startBlock} to ${endBlock}`);
    console.log("");

    const results = await scanBlockRange(startBlock, endBlock);

    if (results.ethDeposits + results.erc20Deposits > 0) {
      console.log(`\n✅ Found deposits! Check the logs above for details.`);
    } else {
      console.log(`\nℹ️  No deposits found in the scanned range.`);
    }
  } catch (error) {
    console.error("❌ Custom scan failed:", error);
    process.exit(1);
  }
}

// Run scan
if (require.main === module) {
  main();
}

module.exports = { scanBlockRange };
