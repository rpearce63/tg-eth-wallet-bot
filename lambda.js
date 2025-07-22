// AWS Lambda handler for the Telegram Ethereum Wallet Monitor Bot
const { ethers } = require("ethers");
const TelegramBot = require("node-telegram-bot-api");
const path = require("path");
const fetch = require("node-fetch");

// Lambda handler function
exports.handler = async (event, context) => {
  try {
    console.log("[Lambda] Event received:", JSON.stringify(event, null, 2));

    // Set environment for "once" mode
    process.env.BOT_MODE = "once";

    // Override console.log to capture output
    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => {
      logs.push(args.join(" "));
      originalLog(...args);
    };

    // Import the main bot functionality dynamically
    const botFunctions = await import("./index.js");

    // Run the bot in "once" mode
    await botFunctions.setupOnceMode();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Scan completed successfully",
        logs: logs,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error("[Lambda] Error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
    };
  }
};

// Alternative handler that can be triggered by CloudWatch Events
exports.scheduledHandler = async (event, context) => {
  console.log(
    "[Lambda] Scheduled event received:",
    JSON.stringify(event, null, 2)
  );

  // Set environment for "once" mode with custom parameters
  process.env.BOT_MODE = "once";
  process.env.BLOCKS_TO_SCAN = "20"; // Scan more blocks for scheduled runs

  try {
    // Import the main bot functionality dynamically
    const botFunctions = await import("./index.js");
    await botFunctions.setupOnceMode();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Scheduled scan completed successfully",
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error("[Lambda] Scheduled scan error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
    };
  }
};

// Health check handler
exports.healthHandler = async (event, context) => {
  try {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
      body: JSON.stringify({
        status: "healthy",
        service: "tg-eth-wallet-bot",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development",
        mode: process.env.BOT_MODE || "once",
      }),
    };
  } catch (error) {
    console.error("[Health] Error:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
      body: JSON.stringify({
        status: "unhealthy",
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
    };
  }
};

// Summary handler for hourly/daily summaries
exports.summaryHandler = async (event, context) => {
  try {
    console.log(
      "[Lambda] Summary event received:",
      JSON.stringify(event, null, 2)
    );

    // Import the main bot functionality dynamically
    const botFunctions = await import("./index.js");

    // Send the summary
    await botFunctions.sendHourlySummary();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Summary sent successfully",
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error("[Lambda] Summary error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
    };
  }
};

// Test handler for sending test messages for all token types
exports.testHandler = async (event, context) => {
  try {
    console.log(
      "[Lambda] Test event received:",
      JSON.stringify(event, null, 2)
    );

    // Import the main bot functionality dynamically
    const botFunctions = await import("./index.js");

    // Send test messages for all token types
    await botFunctions.sendAllTestMessages();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
      body: JSON.stringify({
        message: "Test messages for all token types sent successfully",
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error("[Lambda] Test error:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
      body: JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
    };
  }
};
