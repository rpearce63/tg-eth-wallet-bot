const { exec } = require("child_process");
const { promisify } = require("util");
const AWS = require("aws-sdk");
const fs = require("fs");
const path = require("path");

const execAsync = promisify(exec);

// AWS S3 configuration
const s3 = new AWS.S3({
  region: "us-east-1",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

// S3 bucket configurations
const DEV_BUCKET = "tg-eth-wallet-bot-dev-assets";
const PROD_BUCKET = "tg-eth-wallet-bot-prod-assets";
const VIDEO_KEY = "xiaobai_ani.mp4";
const GIF_KEY = "xiaobai_ani.gif";

async function convertMp4ToGif() {
  console.log("🎬 Converting MP4 to GIF...");

  try {
    // Download the MP4 from S3 if it doesn't exist locally
    if (!fs.existsSync("temp_xiaobai_ani.mp4")) {
      console.log("📥 Downloading MP4 from S3...");
      const videoData = await s3
        .getObject({
          Bucket: DEV_BUCKET,
          Key: VIDEO_KEY,
        })
        .promise();

      fs.writeFileSync("temp_xiaobai_ani.mp4", videoData.Body);
      console.log("✅ MP4 downloaded successfully");
    }

    // Convert MP4 to GIF using ffmpeg
    console.log("🔄 Converting to GIF...");
    const ffmpegCommand = `ffmpeg -i temp_xiaobai_ani.mp4 -vf "fps=10,scale=480:-1:flags=lanczos" -loop 0 temp_xiaobai_ani.gif -y`;

    await execAsync(ffmpegCommand);
    console.log("✅ GIF conversion completed");

    // Upload GIF to dev bucket
    console.log("📤 Uploading GIF to dev bucket...");
    const gifBuffer = fs.readFileSync("temp_xiaobai_ani.gif");
    await s3
      .putObject({
        Bucket: DEV_BUCKET,
        Key: GIF_KEY,
        Body: gifBuffer,
        ContentType: "image/gif",
      })
      .promise();
    console.log("✅ GIF uploaded to dev bucket");

    // Upload GIF to prod bucket
    console.log("📤 Uploading GIF to prod bucket...");
    await s3
      .putObject({
        Bucket: PROD_BUCKET,
        Key: GIF_KEY,
        Body: gifBuffer,
        ContentType: "image/gif",
      })
      .promise();
    console.log("✅ GIF uploaded to prod bucket");

    // Clean up temporary files
    console.log("🧹 Cleaning up temporary files...");
    if (fs.existsSync("temp_xiaobai_ani.mp4")) {
      fs.unlinkSync("temp_xiaobai_ani.mp4");
    }
    if (fs.existsSync("temp_xiaobai_ani.gif")) {
      fs.unlinkSync("temp_xiaobai_ani.gif");
    }
    console.log("✅ Cleanup completed");

    // Generate the URLs
    const devGifUrl = `https://${DEV_BUCKET}.s3.amazonaws.com/${GIF_KEY}`;
    const prodGifUrl = `https://${PROD_BUCKET}.s3.amazonaws.com/${GIF_KEY}`;

    console.log("\n🎉 Conversion and upload completed!");
    console.log(`📱 Dev GIF URL: ${devGifUrl}`);
    console.log(`🚀 Prod GIF URL: ${prodGifUrl}`);

    console.log("\n📝 Update your TOKEN_IMAGES in index.js to:");
    console.log("const TOKEN_IMAGES = {");
    console.log('  ETH: "' + devGifUrl + '",');
    console.log('  USDC: "' + devGifUrl + '",');
    console.log('  USDT: "' + devGifUrl + '",');
    console.log('  XIAOBAI: "' + devGifUrl + '",');
    console.log("};");
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

// Run the conversion
convertMp4ToGif();
