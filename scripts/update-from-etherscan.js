#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");

// Configuration
const STAGE = process.argv[2] || "dev";
const TABLE_NAME = `tg-eth-wallet-bot-deposits-${STAGE}`;
const MARKETING_WALLET = "0xe453b6ba7d8a4b402dff9c1b2da18226c5c2a9d3";

console.log(`🚀 Starting Etherscan data update for table: ${TABLE_NAME}`);

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(client);

// Parse CSV data
function parseEtherscanCSV(csvData) {
  const lines = csvData.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.replace(/"/g, ""));
  const transactions = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const values = line.split(",").map((v) => v.replace(/"/g, ""));
    const tx = {};

    headers.forEach((header, index) => {
      tx[header] = values[index];
    });

    transactions.push(tx);
  }

  return transactions;
}

// Convert Etherscan data to our deposit format
function convertToDeposit(tx) {
  // Only process deposits TO the marketing wallet
  if (tx.To.toLowerCase() !== MARKETING_WALLET) {
    return null;
  }

  // Parse token type
  let token = "UNKNOWN";
  if (
    tx.Token.includes("XiaoBai") ||
    tx.Token.includes("XIAOBAI") ||
    tx.Token.includes("XiaoBai (XIAOBAI)")
  ) {
    token = "XIAOBAI";
  } else if (tx.Token.includes("USDT") || tx.Token.includes("Tether USD")) {
    token = "USDT";
  } else if (tx.Token.includes("USDC")) {
    token = "USDC";
  } else if (tx.Token.includes("ETH") || tx.Token.includes("Ether")) {
    token = "ETH";
  }

  // Parse amount (remove commas and convert to string)
  const amount = tx.Amount.replace(/,/g, "");

  // Parse timestamp
  const date = new Date(tx["DateTime (UTC)"]);
  const timestamp = date.getTime();

  return {
    txHash: tx["Transaction Hash"],
    token: token,
    amount: amount,
    from: tx.From,
    to: tx.To,
    timestamp: timestamp,
    blockNumber: parseInt(tx.BlockNo),
    usdValue:
      parseFloat(tx["Value (USD)"].replace("$", "").replace(",", "")) || 0,
  };
}

// Get existing deposits from DynamoDB
async function getExistingDeposits() {
  try {
    const command = new ScanCommand({
      TableName: TABLE_NAME,
    });

    const response = await docClient.send(command);
    return response.Items || [];
  } catch (error) {
    console.error("[DB] Error loading existing deposits:", error);
    return [];
  }
}

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
      },
    });

    await docClient.send(command);
    return true;
  } catch (error) {
    console.error(`❌ Error saving deposit ${deposit.txHash}:`, error);
    return false;
  }
}

// Main update function
async function updateFromEtherscan() {
  try {
    console.log(`📋 Update Summary:`);
    console.log(`   Stage: ${STAGE}`);
    console.log(`   Table: ${TABLE_NAME}`);
    console.log(`   Marketing Wallet: ${MARKETING_WALLET}`);
    console.log("");

    // Get existing deposits
    console.log("📊 Loading existing deposits from DynamoDB...");
    const existingDeposits = await getExistingDeposits();
    const existingTxHashes = new Set(existingDeposits.map((d) => d.txHash));
    console.log(`   Found ${existingDeposits.length} existing deposits`);

    // Parse Etherscan data
    const etherscanData = `Transaction Hash,Status,Method,BlockNo,DateTime (UTC),From,From_Nametag,To,To_Nametag,Amount,Value (USD),Token
"0x4e0b3cdc58ae30fbdd36d1ec890a3f81c86e62056ba0cae5982f2ae57ab66de5","Success","Transfer","22981745","2025-07-23 12:02:47","0x9C6F88ecA61661aDc78535Ed8a97A6f99b581453","","0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3","xiaobaicto.eth","82,542,769,229.90364658","$113.00","XiaoBai (XIAOBAI)"
"0xda6c610a334daefd2817922dd6671bf3eeea3b2097475087222d6dc9284b4022","Success","Transfer","22981718","2025-07-23 11:57:23","0x3F3aA3Bd1E0D80a2470689D0cDf19f7a97c16123","","0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3","xiaobaicto.eth","50","$50.00","Tether USD (USDT)"
"0xfb44c5e7c475d8f82341241b5fb1a538028d1d582885ec86667f171b2aa8651d","Success","Transfer","22974227","2025-07-22 10:49:35","0x3F3aA3Bd1E0D80a2470689D0cDf19f7a97c16123","","0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3","xiaobaicto.eth","50","$50.00","Tether USD (USDT)"
"0xa266d3a138d48b0f6034883c8b1b7625134653933a961c789170091d203e4f20","Success","Transfer","22960114","2025-07-20 11:29:47","0x3F3aA3Bd1E0D80a2470689D0cDf19f7a97c16123","","0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3","xiaobaicto.eth","100","$100.00","Tether USD (USDT)"
"0x2c250cff8c0dc97daa18beaa2498b4e6dbbf43188c0afa10b2bcba9673385562","Success","Transfer","22957331","2025-07-20 02:09:47","0xad91e2a2CFa185B2b37eCa4D10b6E7A56c6Ae517","","0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3","xiaobaicto.eth","56,189,253,406.28855","$76.92","XiaoBai (XIAOBAI)"
"0xeaf40b888e9ad5a40b3f3454d9c700201e21a9fa2c26dcbdf934bc481a4c19b2","Success","Transfer","22956845","2025-07-20 00:32:23","0x75426b3dA78B556ea4692F0A3BdEcC7aE33772eC","","0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3","xiaobaicto.eth","97,566,128,924.69758","$133.57","XiaoBai (XIAOBAI)"
"0xb5f9fbd6330aa51f19f48dbdf24379668b9b06e77f66bc14141d826c652b9bff","Success","Transfer","22938879","2025-07-17 12:19:47","0x3F3aA3Bd1E0D80a2470689D0cDf19f7a97c16123","","0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3","xiaobaicto.eth","100","$100.00","Tether USD (USDT)"
"0x85a314299e4edc624a2b2fdad91456d9a9d0aa8662700de3c427ddbfc5bfadcb","Success","Transfer","22936175","2025-07-17 03:17:11","0x1cA5aa5b1dd8D948bB0971A5fB1762FE172E0040","BloFin","0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3","xiaobaicto.eth","200","$199.97","USDC (USDC)"
"0x4d6c10fa45e0cde5ececdb1f77a5b1d4c1ca4dba2a34341cb74e31358b184112","Success","Transfer","22923510","2025-07-15 08:52:59","0x1cA5aa5b1dd8D948bB0971A5fB1762FE172E0040","BloFin","0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3","xiaobaicto.eth","547","$546.93","USDC (USDC)"
"0x5aca7d2398e6837c754a2abf98445b133993d80505590651eabfe54089f9b03a","Success","Transfer","22923000","2025-07-15 07:10:47","0x1cA5aa5b1dd8D948bB0971A5fB1762FE172E0040","BloFin","0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3","xiaobaicto.eth","497","$496.93","USDC (USDC)"
"0xf0c2d5533eb8e15cad7ac14dd79953f5194b6450231a7a51ae189205099f5577","Success","Transfer","22918483","2025-07-14 16:03:35","0x4FBBd22D32b21a6f98f7F4CDB730b433682Eb676","defironin.eth","0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3","xiaobaicto.eth","22,884,466,554","$31.33","XiaoBai (XIAOBAI)"
"0x1989c0e74abb7c88ec543ad7f4274c2f54aa31d76e841b40e5a19b5b580a63a7","Success","Transfer","22918465","2025-07-14 15:59:47","0x97D7d3cB92188770D1C76DdB0AB225cE64AD5411","","0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3","xiaobaicto.eth","20,000,000,000","$27.38","XiaoBai (XIAOBAI)"
"0x142aaf39497bb36a7820ed4a7242aaddc8dc8078f76a22b22884deffcb823607","Success","Transfer","22916932","2025-07-14 10:50:47","0x1cA5aa5b1dd8D948bB0971A5fB1762FE172E0040","BloFin","0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3","xiaobaicto.eth","396","$395.95","USDC (USDC)"
"0x1d452de45dd430a4dbe2df730091843d3784d3996731fb51b9a9d93f97dfaaa3","Success","Transfer","22916257","2025-07-14 08:34:47","0x1cA5aa5b1dd8D948bB0971A5fB1762FE172E0040","BloFin","0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3","xiaobaicto.eth","302","$301.96","USDC (USDC)"
"0x019ddfdc7440a68011994965af911bf7c18805302a2944d36c45d39b8f932782","Success","Transfer","22914220","2025-07-14 01:45:47","0x1cA5aa5b1dd8D948bB0971A5fB1762FE172E0040","BloFin","0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3","xiaobaicto.eth","302","$301.96","USDC (USDC)"`;

    const transactions = parseEtherscanCSV(etherscanData);
    console.log(
      `📊 Parsed ${transactions.length} transactions from Etherscan data`
    );

    // Convert to deposits and filter new ones
    const newDeposits = [];
    for (const tx of transactions) {
      const deposit = convertToDeposit(tx);
      if (deposit && !existingTxHashes.has(deposit.txHash)) {
        newDeposits.push(deposit);
      }
    }

    console.log(`🆕 Found ${newDeposits.length} new deposits to add`);

    if (newDeposits.length === 0) {
      console.log("✅ No new deposits to add. Database is up to date!");
      return;
    }

    // Sort by timestamp (oldest first)
    newDeposits.sort((a, b) => a.timestamp - b.timestamp);

    // Save new deposits
    console.log("💾 Saving new deposits to DynamoDB...");
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < newDeposits.length; i++) {
      const deposit = newDeposits[i];
      const success = await saveDepositToDynamoDB(deposit);

      if (success) {
        successCount++;
        const date = new Date(deposit.timestamp);
        console.log(
          `✅ Added deposit ${i + 1}/${newDeposits.length}: ${deposit.token} ${
            deposit.amount
          } ($${deposit.usdValue}) - ${date.toISOString()}`
        );
      } else {
        errorCount++;
        console.log(
          `❌ Failed to add deposit ${i + 1}/${newDeposits.length}: ${
            deposit.txHash
          }`
        );
      }

      // Add a small delay to avoid overwhelming DynamoDB
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log("");
    console.log(`🎉 Update completed!`);
    console.log(`   ✅ Successfully added: ${successCount} deposits`);
    console.log(`   ❌ Failed to add: ${errorCount} deposits`);
    console.log(`   📊 Total new deposits processed: ${newDeposits.length}`);

    if (errorCount > 0) {
      console.log(`⚠️  Some deposits failed to add. Check the logs above.`);
      process.exit(1);
    } else {
      console.log(`✅ All new deposits added successfully!`);
    }
  } catch (error) {
    console.error("❌ Update failed:", error);
    process.exit(1);
  }
}

// Run update
if (require.main === module) {
  updateFromEtherscan();
}

module.exports = { updateFromEtherscan, parseEtherscanCSV, convertToDeposit };
