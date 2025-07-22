#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// Copy deposits.json to deposits-deploy.json for deployment
const sourceFile = path.join(__dirname, "..", "deposits.json");
const deployFile = path.join(__dirname, "..", "deposits-deploy.json");

try {
  if (fs.existsSync(sourceFile)) {
    const data = fs.readFileSync(sourceFile, "utf8");
    fs.writeFileSync(deployFile, data);
    console.log(
      "✅ Copied deposits.json to deposits-deploy.json for deployment"
    );
  } else {
    console.log("⚠️  deposits.json not found, creating empty deployment file");
    fs.writeFileSync(deployFile, JSON.stringify({ deposits: [] }, null, 2));
  }
} catch (error) {
  console.error("❌ Error preparing deployment data:", error);
  process.exit(1);
}
