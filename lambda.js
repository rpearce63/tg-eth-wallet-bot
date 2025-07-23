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
  process.env.BLOCKS_TO_SCAN = "7"; // Optimized for 60-second intervals

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

    // SECURITY: Check for authentication token
    const authToken =
      event.headers?.["x-auth-token"] || event.headers?.["X-Auth-Token"];
    const expectedToken = process.env.TEST_AUTH_TOKEN;

    if (!expectedToken || authToken !== expectedToken) {
      console.log("[Lambda] Test endpoint accessed without valid auth token");
      return {
        statusCode: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        },
        body: JSON.stringify({
          error: "Unauthorized - Valid X-Auth-Token header required",
          timestamp: new Date().toISOString(),
        }),
      };
    }

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

// Control handler for remote parameter adjustment
exports.controlHandler = async (event, context) => {
  try {
    console.log(
      "[Lambda] Control event received:",
      JSON.stringify(event, null, 2)
    );

    const body = event.body ? JSON.parse(event.body) : {};
    const { action, parameter, value } = body;

    let response = {
      message: "Control action completed",
      timestamp: new Date().toISOString(),
    };

    switch (action) {
      case "status":
        response.status = {
          depositScanning: process.env.DEPOSIT_SCANNING_ENABLED !== "false",
          summaryScanning: process.env.SUMMARY_SCANNING_ENABLED !== "false",
          scanInterval: process.env.POLLING_INTERVAL || "60000",
          blocksToScan: process.env.BLOCKS_TO_SCAN || "7",
        };
        break;

      case "pause_deposits":
        // This would require updating environment variables
        response.message =
          "Deposit scanning paused (requires redeploy to take effect)";
        break;

      case "resume_deposits":
        response.message =
          "Deposit scanning resumed (requires redeploy to take effect)";
        break;

      case "pause_summary":
        response.message =
          "Summary scanning paused (requires redeploy to take effect)";
        break;

      case "resume_summary":
        response.message =
          "Summary scanning resumed (requires redeploy to take effect)";
        break;

      default:
        response.message =
          "Unknown action. Available actions: status, pause_deposits, resume_deposits, pause_summary, resume_summary";
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error("[Lambda] Control error:", error);

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
