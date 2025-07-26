#!/usr/bin/env node

const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");
const path = require("path");

const STAGE = process.env.STAGE || "prod";
const BUCKET_NAME = `tg-eth-wallet-bot-v2-${STAGE}-assets`;

const s3Client = new S3Client({ region: "us-east-1" });

// Media files to upload
const MEDIA_FILES = [
  {
    localPath: "temp_d3.gif",
    s3Key: "xiaobai_ani.gif",
    contentType: "image/gif",
  },
  {
    localPath: "temp_d3.mp4",
    s3Key: "xiaobai_ani.mp4",
    contentType: "video/mp4",
  },
];

async function uploadFile(localPath, s3Key, contentType) {
  console.log(`📤 Uploading ${localPath} to ${s3Key}...`);

  try {
    // Check if local file exists
    if (!fs.existsSync(localPath)) {
      console.log(`⚠️  Local file not found: ${localPath}`);
      return false;
    }

    const fileContent = fs.readFileSync(localPath);

    const putCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: fileContent,
      ContentType: contentType,
    });

    await s3Client.send(putCommand);
    console.log(`✅ Successfully uploaded ${s3Key}`);
    console.log(
      `🔗 URL: https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/${s3Key}`
    );
    return true;
  } catch (error) {
    console.log(`❌ Failed to upload ${s3Key}: ${error.message}`);
    return false;
  }
}

async function createTestMedia() {
  console.log("🎨 Creating test media files...");

  // Create a simple test GIF (1x1 pixel transparent GIF)
  const testGif = Buffer.from([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
    0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
    0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
    0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
  ]);

  // Create a simple test MP4 (minimal MP4 header)
  const testMp4 = Buffer.from([
    0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
    0x00, 0x00, 0x02, 0x00, 0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
    0x61, 0x76, 0x63, 0x31, 0x6d, 0x70, 0x34, 0x31,
  ]);

  try {
    fs.writeFileSync("temp_d3.gif", testGif);
    fs.writeFileSync("temp_d3.mp4", testMp4);
    console.log("✅ Created test media files");
    return true;
  } catch (error) {
    console.log(`❌ Failed to create test files: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log("🚀 S3 Media Upload Script");
  console.log("=".repeat(50));
  console.log(`Bucket: ${BUCKET_NAME}`);
  console.log(`Stage: ${STAGE}`);
  console.log("");

  // Check if media files exist, create test files if not
  const hasMediaFiles = MEDIA_FILES.some((file) =>
    fs.existsSync(file.localPath)
  );

  if (!hasMediaFiles) {
    console.log("📁 No media files found, creating test files...");
    await createTestMedia();
  }

  // Upload all media files
  console.log("📤 Starting media upload...\n");

  let successCount = 0;
  for (const file of MEDIA_FILES) {
    const success = await uploadFile(
      file.localPath,
      file.s3Key,
      file.contentType
    );
    if (success) successCount++;
    console.log("");
  }

  console.log("📊 Upload Summary:");
  console.log(
    `✅ Successfully uploaded: ${successCount}/${MEDIA_FILES.length} files`
  );

  if (successCount > 0) {
    console.log("\n🔗 Test URLs:");
    console.log(
      `GIF: https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/xiaobai_ani.gif`
    );
    console.log(
      `MP4: https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/xiaobai_ani.mp4`
    );

    console.log("\n🎯 Next steps:");
    console.log("1. Test the URLs in your browser");
    console.log("2. Replace test files with your actual media files");
    console.log(
      "3. The bot should now be able to send videos and animated GIFs"
    );
  }
}

main().catch(console.error);
