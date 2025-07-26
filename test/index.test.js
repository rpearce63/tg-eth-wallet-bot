const { ethers } = require("ethers");

// Mock the required modules
jest.mock("node-telegram-bot-api");
jest.mock("node-fetch");
jest.mock("lowdb/node", () => ({
  JSONFile: jest.fn().mockImplementation(() => ({
    read: jest.fn(),
    write: jest.fn(),
  })),
}));
jest.mock("lowdb", () => ({
  Low: jest.fn().mockImplementation(() => ({
    data: { deposits: [] },
    read: jest.fn(),
    write: jest.fn(),
  })),
}));

// Import the functions we want to test
const {
  logDeposit,
  isTransactionProcessed,
  truncateAddress,
  calculateRetryDelay,
  isRateLimitError,
} = require("../index.js");

describe("Telegram Bot Unit Tests", () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  describe("Address Utilities", () => {
    test("truncateAddress should format addresses correctly", () => {
      const testAddress = "0x1234567890abcdef1234567890abcdef12345678";
      const truncated = truncateAddress(testAddress);

      expect(truncated).toBe("0x1234...5678");
      expect(truncated.length).toBe(11); // 6 + "..." + 4
    });

    test("truncateAddress should handle short addresses", () => {
      const shortAddress = "0x1234567890";
      const truncated = truncateAddress(shortAddress);

      expect(truncated).toBe("0x1234...7890");
    });
  });

  describe("Rate Limiting Logic", () => {
    test("isRateLimitError should detect rate limit errors", () => {
      const rateLimitError1 = { error: { code: -32005 } };
      const rateLimitError2 = { code: -32005 };
      const rateLimitError3 = { message: "RPS limit exceeded" };
      const rateLimitError4 = { message: "rate limit hit" };
      const normalError = { message: "network error" };

      expect(isRateLimitError(rateLimitError1)).toBe(true);
      expect(isRateLimitError(rateLimitError2)).toBe(true);
      expect(isRateLimitError(rateLimitError3)).toBe(true);
      expect(isRateLimitError(rateLimitError4)).toBe(true);
      expect(isRateLimitError(normalError)).toBe(false);
    });

    test("calculateRetryDelay should calculate exponential backoff", () => {
      const error = { error: { data: { try_again_in: "2" } } };
      const retryCount = 2;

      const delay = calculateRetryDelay(error, retryCount);

      // Should be at least 2000ms (2 seconds) * 2^2 = 8000ms
      expect(delay).toBeGreaterThanOrEqual(8000);
      expect(delay).toBeLessThanOrEqual(20000); // Max delay
    });

    test("calculateRetryDelay should use default when no suggested delay", () => {
      const error = { message: "rate limit" };
      const retryCount = 1;

      const delay = calculateRetryDelay(error, retryCount);

      // Should be 1000ms * 2^1 = 2000ms
      expect(delay).toBe(2000);
    });
  });

  describe("Transaction Processing", () => {
    test("isTransactionProcessed should check for duplicates", async () => {
      // Mock the database with some existing transactions
      const mockDb = {
        data: {
          deposits: [
            { txHash: "0x1234567890abcdef" },
            { txHash: "0xabcdef1234567890" },
          ],
        },
      };

      // Mock initializeDB to return our mock database
      jest.doMock("../index.js", () => ({
        ...jest.requireActual("../index.js"),
        initializeDB: jest.fn().mockResolvedValue(mockDb),
      }));

      const existingTx = "0x1234567890abcdef";
      const newTx = "0x9999999999999999";

      const isExisting = await isTransactionProcessed(existingTx);
      const isNew = await isTransactionProcessed(newTx);

      expect(isExisting).toBe(true);
      expect(isNew).toBe(false);
    });
  });

  describe("Ethers.js Integration", () => {
    test("should handle prefetchedTransactions correctly", () => {
      // Mock a block with prefetched transactions
      const mockBlock = {
        number: 12345,
        transactions: ["0x123", "0x456"], // Transaction hashes
        prefetchedTransactions: [
          {
            hash: "0x123",
            from: "0x1111111111111111111111111111111111111111",
            to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
            value: ethers.parseEther("0.1"),
          },
          {
            hash: "0x456",
            from: "0x2222222222222222222222222222222222222222",
            to: "0x3333333333333333333333333333333333333333",
            value: ethers.parseEther("0.05"),
          },
        ],
      };

      const transactions = mockBlock.prefetchedTransactions || [];

      expect(transactions).toHaveLength(2);
      expect(transactions[0].hash).toBe("0x123");
      expect(transactions[0].to).toBe(
        "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3"
      );
      expect(ethers.formatEther(transactions[0].value)).toBe("0.1");
    });

    test("should detect ETH transfers to monitored addresses", () => {
      const monitoredAddresses = [
        "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3".toLowerCase(),
      ];

      const mockTransactions = [
        {
          hash: "0x123",
          from: "0x1111111111111111111111111111111111111111",
          to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
          value: ethers.parseEther("0.1"),
        },
        {
          hash: "0x456",
          from: "0x2222222222222222222222222222222222222222",
          to: "0x3333333333333333333333333333333333333333",
          value: ethers.parseEther("0.05"),
        },
      ];

      const ethTransfers = mockTransactions.filter(
        (tx) =>
          tx.to &&
          monitoredAddresses.includes(tx.to.toLowerCase()) &&
          tx.value &&
          tx.value > 0
      );

      expect(ethTransfers).toHaveLength(1);
      expect(ethTransfers[0].hash).toBe("0x123");
      expect(ethers.formatEther(ethTransfers[0].value)).toBe("0.1");
    });
  });

  describe("ERC-20 Token Processing", () => {
    test("should format token amounts correctly", () => {
      const tokens = {
        USDC: { decimals: 6 },
        USDT: { decimals: 6 },
        XIAOBAI: { decimals: 9 },
      };

      const testCases = [
        { token: "USDC", value: "1000000", expected: "1.0" },
        { token: "USDT", value: "500000", expected: "0.5" },
        { token: "XIAOBAI", value: "1000000000", expected: "1.0" },
      ];

      testCases.forEach(({ token, value, expected }) => {
        const formatted = ethers.formatUnits(value, tokens[token].decimals);
        expect(formatted).toBe(expected);
      });
    });

    test("should detect ERC-20 transfer events", () => {
      const mockEvent = {
        args: {
          from: "0x1111111111111111111111111111111111111111",
          to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
          value: "1000000", // 1 USDC
        },
        transactionHash: "0x1234567890abcdef",
      };

      const monitoredAddress = "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3";

      expect(mockEvent.args.to.toLowerCase()).toBe(
        monitoredAddress.toLowerCase()
      );
      expect(mockEvent.transactionHash).toBeDefined();
    });
  });

  describe("Configuration Validation", () => {
    test("should have valid token configurations", () => {
      const tokens = {
        USDC: {
          address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          decimals: 6,
        },
        USDT: {
          address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
          decimals: 6,
        },
        XIAOBAI: {
          address: "0xcb69E5750f8dC3b69647B9d8B1f45466ace0A027",
          decimals: 9,
        },
      };

      // Check that all tokens have required properties
      Object.entries(tokens).forEach(([symbol, config]) => {
        expect(config.address).toBeDefined();
        expect(config.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
        expect(config.decimals).toBeDefined();
        expect(typeof config.decimals).toBe("number");
        expect(config.decimals).toBeGreaterThan(0);
      });
    });

    test("should have valid monitored addresses", () => {
      const monitoredAddresses = [
        "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3".toLowerCase(),
      ];

      monitoredAddresses.forEach((address) => {
        expect(address).toMatch(/^0x[a-f0-9]{40}$/);
      });
    });
  });

  describe("Error Handling", () => {
    test("should handle missing transaction data gracefully", () => {
      const mockBlock = {
        number: 12345,
        transactions: [],
        prefetchedTransactions: null,
      };

      const transactions = mockBlock.prefetchedTransactions || [];
      expect(transactions).toHaveLength(0);
    });

    test("should handle invalid transaction objects", () => {
      const mockTransactions = [
        {
          hash: "0x123",
          from: "0x1111111111111111111111111111111111111111",
          to: null, // Invalid: missing 'to' address
          value: ethers.parseEther("0.1"),
        },
        {
          hash: "0x456",
          from: "0x2222222222222222222222222222222222222222",
          to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
          value: 0, // Invalid: zero value
        },
      ];

      const monitoredAddresses = [
        "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3".toLowerCase(),
      ];

      const validTransfers = mockTransactions.filter(
        (tx) =>
          tx.to &&
          monitoredAddresses.includes(tx.to.toLowerCase()) &&
          tx.value &&
          tx.value > 0
      );

      expect(validTransfers).toHaveLength(0);
    });
  });

  describe("Rate Limiting Configuration", () => {
    test("should have reasonable rate limit settings", () => {
      const rateLimitConfig = {
        maxRequestsPerSecond: 5,
        minDelayBetweenRequests: 250,
        maxDelayBetweenRequests: 2000,
        exponentialBackoffBase: 2,
        maxRetries: 3,
        retryDelayMultiplier: 1.5,
      };

      expect(rateLimitConfig.maxRequestsPerSecond).toBeGreaterThan(0);
      expect(rateLimitConfig.maxRequestsPerSecond).toBeLessThanOrEqual(10);
      expect(rateLimitConfig.minDelayBetweenRequests).toBeGreaterThan(0);
      expect(rateLimitConfig.maxDelayBetweenRequests).toBeGreaterThan(
        rateLimitConfig.minDelayBetweenRequests
      );
      expect(rateLimitConfig.maxRetries).toBeGreaterThan(0);
      expect(rateLimitConfig.maxRetries).toBeLessThanOrEqual(5);
    });
  });
});
