// Test setup file
process.env.NODE_ENV = "test";

// Mock environment variables for testing
process.env.TELEGRAM_BOT_TOKEN = "test-token";
process.env.TELEGRAM_CHAT = "-1001234567890";
process.env.DEV_CHAT_ID = "-1001234567891";
process.env.TEST_MODE = "true";
process.env.MIRROR_TO_DEV = "false";
process.env.STAGE = "test";

// Fix BigInt serialization for Jest
if (typeof BigInt !== "undefined") {
  BigInt.prototype.toJSON = function () {
    return this.toString();
  };
}

// Suppress console.log during tests unless explicitly needed
const originalLog = console.log;
const originalError = console.error;

beforeAll(() => {
  // Only show logs if TEST_VERBOSE is set
  if (!process.env.TEST_VERBOSE) {
    console.log = jest.fn();
    console.error = jest.fn();
  }
});

afterAll(() => {
  console.log = originalLog;
  console.error = originalError;
});

// Global test utilities
global.testUtils = {
  createMockTransaction: (hash, from, to, value) => ({
    hash,
    from,
    to,
    value: typeof value === "string" ? ethers.parseEther(value) : value,
  }),

  createMockEvent: (from, to, value, txHash) => ({
    args: { from, to, value },
    transactionHash: txHash,
  }),

  createMockBlock: (number, transactions) => ({
    number,
    transactions: transactions || [],
    prefetchedTransactions: transactions || [],
  }),
};
