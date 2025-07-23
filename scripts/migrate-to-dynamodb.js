#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

// Configuration
const STAGE = process.argv[2] || "dev";
const TABLE_NAME = `tg-eth-wallet-bot-deposits-${STAGE}`;

console.log(`🚀 Starting migration to DynamoDB table: ${TABLE_NAME}`);

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(client);

// Load historical data from JSON file
function loadHistoricalData() {
  const jsonPath = path.join(__dirname, "..", "deposits.json");

  if (!fs.existsSync(jsonPath)) {
    console.error("❌ deposits.json not found");
    process.exit(1);
  }

  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    console.log(
      `📊 Loaded ${data.deposits.length} deposits from deposits.json`
    );
    return data.deposits;
  } catch (error) {
    console.error("❌ Error reading deposits.json:", error);
    process.exit(1);
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

// Migrate all deposits
async function migrateDeposits(deposits) {
  console.log(`🔄 Starting migration of ${deposits.length} deposits...`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < deposits.length; i++) {
    const deposit = deposits[i];

    // Skip deposits that don't go to the marketing wallet
    if (
      deposit.to.toLowerCase() !== "0xe453b6ba7d8a4b402dff9c1b2da18226c5c2a9d3"
    ) {
      console.log(
        `⏭️  Skipping deposit ${deposit.txHash} (not to marketing wallet)`
      );
      continue;
    }

    const success = await saveDepositToDynamoDB(deposit);

    if (success) {
      successCount++;
      console.log(
        `✅ Migrated deposit ${i + 1}/${deposits.length}: ${deposit.txHash}`
      );
    } else {
      errorCount++;
      console.log(
        `❌ Failed to migrate deposit ${i + 1}/${deposits.length}: ${
          deposit.txHash
        }`
      );
    }

    // Add a small delay to avoid overwhelming DynamoDB
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return { successCount, errorCount };
}

// Main migration function
async function main() {
  try {
    console.log(`📋 Migration Summary:`);
    console.log(`   Stage: ${STAGE}`);
    console.log(`   Table: ${TABLE_NAME}`);
    console.log(`   Region: us-east-1`);
    console.log("");

    // Load historical data
    const deposits = loadHistoricalData();

    // Migrate deposits
    const { successCount, errorCount } = await migrateDeposits(deposits);

    console.log("");
    console.log(`🎉 Migration completed!`);
    console.log(`   ✅ Successfully migrated: ${successCount} deposits`);
    console.log(`   ❌ Failed to migrate: ${errorCount} deposits`);
    console.log(`   📊 Total processed: ${deposits.length} deposits`);

    if (errorCount > 0) {
      console.log(`⚠️  Some deposits failed to migrate. Check the logs above.`);
      process.exit(1);
    } else {
      console.log(`✅ All deposits migrated successfully!`);
    }
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
if (require.main === module) {
  main();
}

module.exports = { main, loadHistoricalData, saveDepositToDynamoDB };
