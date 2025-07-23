const TelegramBot = require("node-telegram-bot-api");

// Environment validation - ensure tests only run in dev
function validateEnvironment() {
  const stage = process.env.STAGE || "dev";
  if (stage === "prod") {
    console.error("❌ ERROR: Tests cannot be run in production environment!");
    console.error("Please set STAGE=dev or remove STAGE environment variable.");
    process.exit(1);
  }
  console.log(`✅ Running tests in ${stage} environment`);
}

// Validate environment before proceeding
validateEnvironment();

// Bot configuration
const TELEGRAM_BOT_TOKEN = "5560564745:AAGItPTaoQQyxxnm7bAavxofMKN3z4ieAM0";
// Use dev environment chat ID by default
const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT || -1002545365231; // Dev chat ID

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });

// Test image URL - use dev environment assets (new static JPG)
const testImageUrl =
  "https://tg-eth-wallet-bot-dev-assets.s3.amazonaws.com/xiaobai_contribution_static.JPG";

async function testImageSizes() {
  console.log("Testing different image size configurations...");

  const testCases = [
    {
      name: "Default size (no width/height)",
      options: {
        caption: "Test 1: Default size (no width/height specified)",
        parse_mode: "HTML",
        disable_web_page_preview: true,
      },
    },
    {
      name: "Small size (200x150)",
      options: {
        caption: "Test 2: Small size (200x150 pixels)",
        parse_mode: "HTML",
        disable_web_page_preview: true,
        width: 200,
        height: 150,
      },
    },
    {
      name: "Medium size (400x300)",
      options: {
        caption: "Test 3: Medium size (400x300 pixels)",
        parse_mode: "HTML",
        disable_web_page_preview: true,
        width: 400,
        height: 300,
      },
    },
    {
      name: "Large size (600x450)",
      options: {
        caption: "Test 4: Large size (600x450 pixels)",
        parse_mode: "HTML",
        disable_web_page_preview: true,
        width: 600,
        height: 450,
      },
    },
    {
      name: "Wide format (800x300)",
      options: {
        caption: "Test 5: Wide format (800x300 pixels)",
        parse_mode: "HTML",
        disable_web_page_preview: true,
        width: 800,
        height: 300,
      },
    },
    {
      name: "Tall format (300x600)",
      options: {
        caption: "Test 6: Tall format (300x600 pixels)",
        parse_mode: "HTML",
        disable_web_page_preview: true,
        width: 300,
        height: 600,
      },
    },
  ];

  for (const testCase of testCases) {
    try {
      console.log(`Sending: ${testCase.name}`);
      await bot.sendPhoto(TELEGRAM_CHAT, testImageUrl, testCase.options);

      // Wait 2 seconds between messages to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Error sending ${testCase.name}:`, error.message);
    }
  }

  console.log("Image size tests completed!");
}

// Test video with size options
async function testVideoSizes() {
  console.log("Testing video size configurations...");

  const testVideoUrl =
    "https://tg-eth-wallet-bot-dev-assets.s3.amazonaws.com/xiaobai_ani.mp4";

  const videoTestCases = [
    {
      name: "Video with default size",
      options: {
        caption: "Video Test 1: Default size",
        parse_mode: "HTML",
        disable_web_page_preview: true,
        supports_streaming: true,
      },
    },
    {
      name: "Video with custom size (400x300)",
      options: {
        caption: "Video Test 2: Custom size (400x300)",
        parse_mode: "HTML",
        disable_web_page_preview: true,
        width: 400,
        height: 300,
        supports_streaming: true,
      },
    },
    {
      name: "Video with large size (600x450)",
      options: {
        caption: "Video Test 3: Large size (600x450)",
        parse_mode: "HTML",
        disable_web_page_preview: true,
        width: 600,
        height: 450,
        supports_streaming: true,
      },
    },
  ];

  for (const testCase of videoTestCases) {
    try {
      console.log(`Sending: ${testCase.name}`);
      await bot.sendVideo(TELEGRAM_CHAT, testVideoUrl, testCase.options);

      // Wait 3 seconds between videos to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (error) {
      console.error(`Error sending ${testCase.name}:`, error.message);
    }
  }

  console.log("Video size tests completed!");
}

// Run tests
async function runTests() {
  console.log("Starting image and video size tests...");

  await testImageSizes();

  // Wait a bit before testing videos
  await new Promise((resolve) => setTimeout(resolve, 5000));

  await testVideoSizes();

  console.log("All tests completed!");
  process.exit(0);
}

// Handle command line arguments
const testType = process.argv[2];

if (testType === "video") {
  testVideoSizes().then(() => process.exit(0));
} else if (testType === "image") {
  testImageSizes().then(() => process.exit(0));
} else {
  runTests();
}
