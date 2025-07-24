#!/usr/bin/env node

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

// Configuration
const STAGE = process.argv[2] || "prod";
const TABLE_NAME = `tg-eth-wallet-bot-deposits-${STAGE}`;
const MARKETING_WALLET =
  "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3".toLowerCase();

console.log(
  `🚀 Starting Etherscan data import to DynamoDB table: ${TABLE_NAME}`
);

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(client);

// ETH Transfers from Transactions tab (CSV data)
const ETH_TRANSFERS = [
  {
    txHash:
      "0x550d207757cd5a86f0f10c8ba2db6f95efc1d1285681bd6498b34971610839ba",
    block: 22983136,
    amount: "0.001",
    from: "0x3f3aa3bd1e0d80a2470689d0cdf19f7a97c16123",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
    timestamp: new Date("2025-07-23T16:44:11Z").getTime(),
  },
  {
    txHash:
      "0xfc3d2029c0a998e328de4119b6cf72664736f6d6e27b171aa1651d010582d2ec",
    block: 22983115,
    amount: "0.0078",
    from: "0x7f2f41a72b45218fbf9b86b7ea6a8300e64ce5b1",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
    timestamp: new Date("2025-07-23T16:39:59Z").getTime(),
  },
  {
    txHash:
      "0x45624bbe3975163e1adfebbfca609d08e65b70dd8650103e49cb68270886b398",
    block: 22983089,
    amount: "0.042",
    from: "0x704e7e61ebf9ad65665cbdddb9f1e57b97a6259b",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
    timestamp: new Date("2025-07-23T16:34:47Z").getTime(),
  },
  {
    txHash:
      "0x9545bce0cc31435850068a716d7c651ce5600be66dc05fdbe6147622dd1739b1",
    block: 22983022,
    amount: "0.0005",
    from: "0x3f3aa3bd1e0d80a2470689d0cdf19f7a97c16123",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
    timestamp: new Date("2025-07-23T16:21:23Z").getTime(),
  },
  {
    txHash:
      "0x9aec82463678a44a6500498dd552b5bf86c6cabe8fba10b8c63d8e152beb6da5",
    block: 22982850,
    amount: "0.02761626",
    from: "0x30030d2297c908745e08c44702a09c3b200e3350",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
    timestamp: new Date("2025-07-23T15:46:35Z").getTime(),
  },
  {
    txHash:
      "0x014b17c9b992efe101fb3e7a65b3ff44d5715c6e2fd121fc13a99472857e196d",
    block: 22982831,
    amount: "0.0277",
    from: "0xe50238d691494fb26f60ab97bb19fcb7a22aec07",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
    timestamp: new Date("2025-07-23T15:42:47Z").getTime(),
  },
  {
    txHash:
      "0x92e7c2c16850a5a0f5d54b382d65c8cbe28d230e7fc39633e138a2e2ba513da5",
    block: 22982487,
    amount: "0.055",
    from: "0xe50238d691494fb26f60ab97bb19fcb7a22aec07",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
    timestamp: new Date("2025-07-23T14:33:23Z").getTime(),
  },
  {
    txHash:
      "0x92ee7b7eae41a0a09737c9b4495a2f26bde754cad2d07337bfed2c63c2de9f1d",
    block: 22982310,
    amount: "0.001",
    from: "0x3f3aa3bd1e0d80a2470689d0cdf19f7a97c16123",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
    timestamp: new Date("2025-07-23T13:57:35Z").getTime(),
  },
  {
    txHash:
      "0xf5c5c2e10d0851317b3cc1a8100b78e7337cbe54423d4a8e55182f73636b5a95",
    block: 22981789,
    amount: "0.054525",
    from: "0x704e7e61ebf9ad65665cbdddb9f1e57b97a6259b",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
    timestamp: new Date("2025-07-23T12:11:47Z").getTime(),
  },
  {
    txHash:
      "0x38781efd1e9d272d77140a706db95b4a89f4a62f193c8ef40611f069bade4ef2",
    block: 22981723,
    amount: "0.02887968",
    from: "0x6c8c7c09fa24327f2e0cf714901c6f6700d6622c",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
    timestamp: new Date("2025-07-23T11:58:23Z").getTime(),
  },
  {
    txHash:
      "0xc6c976779ed3568b512f052894310b9bb9803ee0b32b4862100e1fb5fd28514e",
    block: 22964329,
    amount: "0.08563993",
    from: "0x6c8c7c09fa24327f2e0cf714901c6f6700d6622c",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
    timestamp: new Date("2025-07-21T01:37:23Z").getTime(),
  },
  {
    txHash:
      "0x2628634dfdce030a5d80581490ffb1bd7b7fb2309d3cb61fc4bbc1966ab23171",
    block: 22946149,
    amount: "0.01612683",
    from: "0x30030d2297c908745e08c44702a09c3b200e3350",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
    timestamp: new Date("2025-07-18T12:41:11Z").getTime(),
  },
  {
    txHash:
      "0xb88c41dc5b7f1b9213a581190768bb3378450a947f99adc3b5a4d1744906e6bd",
    block: 22945627,
    amount: "0.078",
    from: "0x44e12c4591cff2921496b269d55536f224bb9a7d",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
    timestamp: new Date("2025-07-18T10:56:23Z").getTime(),
  },
  {
    txHash:
      "0x3487b561abe09f54baeedc33a34bbc54f64e8846459b3c5d3d638dcca54873e6",
    block: 22941704,
    amount: "0.0057",
    from: "0x0d4e159d1f7651c1805af2084ea1f047a76bb619",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
    timestamp: new Date("2025-07-17T21:46:35Z").getTime(),
  },
  {
    txHash:
      "0x401e1c1a92a15b20f5ce2530f4d20c82bb9e03e74c6da078c68af229e570dd2a",
    block: 22932810,
    amount: "0.06535805",
    from: "0x2417489382ec44030f8f4e7b3caff3586d3bab71",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
    timestamp: new Date("2025-07-16T16:01:23Z").getTime(),
  },
];

// ERC-20 Token Transfers from ERC-20 Token Transfers tab (CSV data)
const ERC20_TRANSFERS = [
  {
    txHash:
      "0xda6c610a334daefd2817922dd6671bf3eeea3b2097475087222d6dc9284b4022",
    block: 22981718,
    amount: "50",
    token: "USDT",
    from: "0x3F3aA3Bd1E0D80a2470689D0cDf19f7a97c16123",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
    timestamp: new Date("2025-07-23T11:57:23Z").getTime(),
  },
  {
    txHash:
      "0xfb44c5e7c475d8f82341241b5fb1a538028d1d582885ec86667f171b2aa8651d",
    block: 22974227,
    amount: "50",
    token: "USDT",
    from: "0x3F3aA3Bd1E0D80a2470689D0cDf19f7a97c16123",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
    timestamp: new Date("2025-07-22T10:49:35Z").getTime(),
  },
  {
    txHash:
      "0x4e0b3cdc58ae30fbdd36d1ec890a3f81c86e62056ba0cae5982f2ae57ab66de5",
    block: 22981745,
    amount: "82542769229.90364658",
    token: "XIAOBAI",
    from: "0x9C6F88ecA61661aDc78535Ed8a97A6f99b581453",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
    timestamp: new Date("2025-07-23T12:02:47Z").getTime(),
  },
  {
    txHash:
      "0xa266d3a138d48b0f6034883c8b1b7625134653933a961c789170091d203e4f20",
    block: 22960114,
    amount: "100",
    token: "USDT",
    from: "0x3F3aA3Bd1E0D80a2470689D0cDf19f7a97c16123",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
    timestamp: new Date("2025-07-20T11:29:47Z").getTime(),
  },
  {
    txHash:
      "0x2c250cff8c0dc97daa18beaa2498b4e6dbbf43188c0afa10b2bcba9673385562",
    block: 22957331,
    amount: "56189253406.28855",
    token: "XIAOBAI",
    from: "0xad91e2a2CFa185B2b37eCa4D10b6E7A56c6Ae517",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
    timestamp: new Date("2025-07-20T02:09:47Z").getTime(),
  },
  {
    txHash:
      "0xeaf40b888e9ad5a40b3f3454d9c700201e21a9fa2c26dcbdf934bc481a4c19b2",
    block: 22956845,
    amount: "97566128924.69758",
    token: "XIAOBAI",
    from: "0x75426b3dA78B556ea4692F0A3BdEcC7aE33772eC",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
    timestamp: new Date("2025-07-20T00:32:23Z").getTime(),
  },
  {
    txHash:
      "0xb5f9fbd6330aa51f19f48dbdf24379668b9b06e77f66bc14141d826c652b9bff",
    block: 22938879,
    amount: "100",
    token: "USDT",
    from: "0x3F3aA3Bd1E0D80a2470689D0cDf19f7a97c16123",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
    timestamp: new Date("2025-07-17T12:19:47Z").getTime(),
  },
  {
    txHash:
      "0x85a314299e4edc624a2b2fdad91456d9a9d0aa8662700de3c427ddbfc5bfadcb",
    block: 22936175,
    amount: "200",
    token: "USDC",
    from: "0x1cA5aa5b1dd8D948bB0971A5fB1762FE172E0040",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
    timestamp: new Date("2025-07-17T03:17:11Z").getTime(),
  },
  {
    txHash:
      "0x4d6c10fa45e0cde5ececdb1f77a5b1d4c1ca4dba2a34341cb74e31358b184112",
    block: 22923510,
    amount: "547",
    token: "USDC",
    from: "0x1cA5aa5b1dd8D948bB0971A5fB1762FE172E0040",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
    timestamp: new Date("2025-07-15T08:52:59Z").getTime(),
  },
  {
    txHash:
      "0x5aca7d2398e6837c754a2abf98445b133993d80505590651eabfe54089f9b03a",
    block: 22923000,
    amount: "497",
    token: "USDC",
    from: "0x1cA5aa5b1dd8D948bB0971A5fB1762FE172E0040",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
    timestamp: new Date("2025-07-15T07:10:47Z").getTime(),
  },
  {
    txHash:
      "0xf0c2d5533eb8e15cad7ac14dd79953f5194b6450231a7a51ae189205099f5577",
    block: 22918483,
    amount: "22884466554",
    token: "XIAOBAI",
    from: "0x4FBBd22D32b21a6f98f7F4CDB730b433682Eb676",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
    timestamp: new Date("2025-07-14T16:03:35Z").getTime(),
  },
  {
    txHash:
      "0x1989c0e74abb7c88ec543ad7f4274c2f54aa31d76e841b40e5a19b5b580a63a7",
    block: 22918465,
    amount: "20000000000",
    token: "XIAOBAI",
    from: "0x97D7d3cB92188770D1C76DdB0AB225cE64AD5411",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
    timestamp: new Date("2025-07-14T15:59:47Z").getTime(),
  },
  {
    txHash:
      "0x142aaf39497bb36a7820ed4a7242aaddc8dc8078f76a22b22884deffcb823607",
    block: 22916932,
    amount: "396",
    token: "USDC",
    from: "0x1cA5aa5b1dd8D948bB0971A5fB1762FE172E0040",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
    timestamp: new Date("2025-07-14T10:50:47Z").getTime(),
  },
  {
    txHash:
      "0x1d452de45dd430a4dbe2df730091843d3784d3996731fb51b9a9d93f97dfaaa3",
    block: 22916257,
    amount: "302",
    token: "USDC",
    from: "0x1cA5aa5b1dd8D948bB0971A5fB1762FE172E0040",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
    timestamp: new Date("2025-07-14T08:34:47Z").getTime(),
  },
  {
    txHash:
      "0x019ddfdc7440a68011994965af911bf7c18805302a2944d36c45d39b8f932782",
    block: 22914220,
    amount: "302",
    token: "USDC",
    from: "0x1cA5aa5b1dd8D948bB0971A5fB1762FE172E0040",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
    timestamp: new Date("2025-07-14T01:45:47Z").getTime(),
  },
];

// Save deposit to DynamoDB
async function saveDepositToDynamoDB(deposit) {
  try {
    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        txHash: deposit.txHash,
        token: deposit.token,
        amount: deposit.amount,
        from: deposit.from,
        to: deposit.to,
        timestamp: deposit.timestamp,
        blockNumber: deposit.block,
      },
    });

    await docClient.send(command);
    return true;
  } catch (error) {
    console.error(`❌ Error saving deposit ${deposit.txHash}:`, error);
    return false;
  }
}

// Import all deposits
async function importDeposits() {
  console.log(`📋 Import Summary:`);
  console.log(`   Stage: ${STAGE}`);
  console.log(`   Table: ${TABLE_NAME}`);
  console.log(`   Region: us-east-1`);
  console.log("");

  // Combine all transfers
  const allTransfers = [
    ...ETH_TRANSFERS.map((tx) => ({ ...tx, token: "ETH" })),
    ...ERC20_TRANSFERS,
  ];

  console.log(`📊 Processing ${allTransfers.length} total transfers:`);
  console.log(`   ETH transfers: ${ETH_TRANSFERS.length}`);
  console.log(`   ERC-20 transfers: ${ERC20_TRANSFERS.length}`);
  console.log("");

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < allTransfers.length; i++) {
    const transfer = allTransfers[i];

    // Skip transfers that don't go to the marketing wallet
    if (transfer.to.toLowerCase() !== MARKETING_WALLET) {
      console.log(
        `⏭️  Skipping transfer ${transfer.txHash} (not to marketing wallet)`
      );
      continue;
    }

    const success = await saveDepositToDynamoDB(transfer);

    if (success) {
      successCount++;
      console.log(
        `✅ Imported transfer ${i + 1}/${allTransfers.length}: ${
          transfer.amount
        } ${transfer.token} from ${transfer.from}`
      );
    } else {
      errorCount++;
      console.log(
        `❌ Failed to import transfer ${i + 1}/${allTransfers.length}: ${
          transfer.txHash
        }`
      );
    }

    // Add a small delay to avoid overwhelming DynamoDB
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log("");
  console.log(`🎉 Import completed!`);
  console.log(`   ✅ Successfully imported: ${successCount} transfers`);
  console.log(`   ❌ Failed to import: ${errorCount} transfers`);
  console.log(`   📊 Total processed: ${allTransfers.length} transfers`);

  if (errorCount > 0) {
    console.log(`⚠️  Some transfers failed to import. Check the logs above.`);
    process.exit(1);
  } else {
    console.log(`✅ All transfers imported successfully!`);
  }
}

// Run the import
if (require.main === module) {
  importDeposits();
}

module.exports = { importDeposits, ETH_TRANSFERS, ERC20_TRANSFERS };
