#!/usr/bin/env node

const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  PutBucketPolicyCommand,
  GetBucketPolicyCommand,
} = require("@aws-sdk/client-s3");

const STAGE = process.env.STAGE || "prod";
const BUCKET_NAME = `tg-eth-wallet-bot-v2-${STAGE}-assets`;

const s3Client = new S3Client({ region: "us-east-1" });

async function testS3Access() {
  console.log(`🔍 Testing S3 bucket access: ${BUCKET_NAME}`);

  try {
    // Test if we can read from the bucket
    const testKey = "xiaobai_ani.gif";
    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: testKey,
    });

    const result = await s3Client.send(getCommand);
    console.log(`✅ Successfully accessed ${testKey} from bucket`);
    console.log(`📏 File size: ${result.ContentLength} bytes`);
    console.log(`📅 Last modified: ${result.LastModified}`);
  } catch (error) {
    console.log(`❌ Failed to access bucket: ${error.message}`);

    if (error.name === "NoSuchBucket") {
      console.log(`📦 Bucket ${BUCKET_NAME} does not exist`);
      return false;
    } else if (error.name === "AccessDenied") {
      console.log(`🔒 Access denied - bucket policy needs to be updated`);
      return false;
    } else if (error.name === "NoSuchKey") {
      console.log(`📁 File not found - bucket exists but file is missing`);
      return true; // Bucket is accessible
    }

    return false;
  }

  return true;
}

async function fixBucketPolicy() {
  console.log(`🔧 Attempting to fix bucket policy for ${BUCKET_NAME}`);

  const bucketPolicy = {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "PublicReadGetObject",
        Effect: "Allow",
        Principal: "*",
        Action: "s3:GetObject",
        Resource: `arn:aws:s3:::${BUCKET_NAME}/*`,
      },
    ],
  };

  try {
    const putCommand = new PutBucketPolicyCommand({
      Bucket: BUCKET_NAME,
      Policy: JSON.stringify(bucketPolicy),
    });

    await s3Client.send(putCommand);
    console.log(`✅ Successfully updated bucket policy`);
    return true;
  } catch (error) {
    console.log(`❌ Failed to update bucket policy: ${error.message}`);
    return false;
  }
}

async function uploadTestFile() {
  console.log(`📤 Uploading test file to ${BUCKET_NAME}`);

  const testContent = "This is a test file for S3 access verification";
  const testKey = "test-access.txt";

  try {
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: testKey,
      Body: testContent,
      ContentType: "text/plain",
    });

    await s3Client.send(putCommand);
    console.log(`✅ Successfully uploaded test file: ${testKey}`);
    return true;
  } catch (error) {
    console.log(`❌ Failed to upload test file: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log("🚀 S3 Bucket Access Fix Script");
  console.log("=".repeat(50));

  // Test current access
  const canAccess = await testS3Access();

  if (!canAccess) {
    console.log("\n🔧 Attempting to fix access issues...");

    // Try to fix bucket policy
    const policyFixed = await fixBucketPolicy();

    if (policyFixed) {
      console.log("\n🔄 Testing access again after policy fix...");
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
      await testS3Access();
    }
  }

  // Test upload capability
  console.log("\n📤 Testing upload capability...");
  await uploadTestFile();

  console.log("\n📋 Summary:");
  console.log(`Bucket: ${BUCKET_NAME}`);
  console.log(`Region: us-east-1`);
  console.log(
    `URL Format: https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/filename`
  );
  console.log("\n🎯 Next steps:");
  console.log("1. Upload your media files to the bucket");
  console.log("2. Test URLs in browser");
  console.log("3. Update bot configuration if needed");
}

main().catch(console.error);
