# Testing Documentation

This document describes the testing setup for the Telegram Ethereum Wallet Bot.

## Overview

The bot includes a comprehensive test suite to validate core functionality, data processing logic, and error handling. Tests are designed to run quickly and provide confidence that the code is working correctly before deployment.

## Test Structure

### Test Files

- **`test/simple.test.js`** - Core logic tests that validate fundamental functionality
- **`test/setup.js`** - Test environment setup and configuration
- **`jest.config.js`** - Jest configuration

### Test Categories

1. **Address Utilities** - Tests for address formatting and validation
2. **Rate Limiting Logic** - Tests for rate limit detection and retry logic
3. **Transaction Processing** - Tests for ETH and ERC-20 transfer detection
4. **ERC-20 Token Processing** - Tests for token amount formatting and event processing
5. **Configuration Validation** - Tests for token and address configuration
6. **Error Handling** - Tests for graceful handling of edge cases
7. **Rate Limiting Configuration** - Tests for rate limit settings validation

## Running Tests

### Basic Test Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with verbose output
npm run test:verbose

# Run only unit tests
npm run test:unit
```

### Test Scripts

- `npm test` - Run the test suite
- `npm run test:watch` - Run tests in watch mode for development
- `npm run test:coverage` - Generate coverage report
- `npm run test:verbose` - Run tests with detailed logging
- `npm run test:unit` - Run only unit tests

## Test Coverage

The tests cover the following key areas:

### ✅ Core Logic Validation

- **Address Truncation**: Validates that Ethereum addresses are properly formatted for display
- **Rate Limit Detection**: Tests error detection for various rate limit scenarios
- **Retry Logic**: Validates exponential backoff calculations
- **Transaction Filtering**: Tests ETH transfer detection logic
- **ERC-20 Processing**: Validates token amount formatting and event processing

### ✅ Configuration Validation

- **Token Configurations**: Validates token addresses and decimal places
- **Monitored Addresses**: Ensures addresses are properly formatted
- **Rate Limit Settings**: Validates rate limiting configuration

### ✅ Error Handling

- **Missing Data**: Tests graceful handling of null/undefined values
- **Invalid Transactions**: Validates filtering of malformed transaction data
- **Edge Cases**: Tests boundary conditions and unexpected inputs

## Test Data

### Mock Transactions

Tests use realistic mock data that mirrors actual Ethereum transactions:

```javascript
const mockTransaction = {
  hash: "0x1234567890abcdef",
  from: "0x1111111111111111111111111111111111111111",
  to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
  value: ethers.parseEther("0.1"),
};
```

### Mock Events

ERC-20 transfer events are mocked to test event processing:

```javascript
const mockEvent = {
  args: {
    from: "0x1111111111111111111111111111111111111111",
    to: "0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3",
    value: "1000000", // 1 USDC
  },
  transactionHash: "0x1234567890abcdef",
};
```

## Pre-Deployment Testing

### Automated Testing

The `predeploy` script automatically runs tests before deployment:

```json
{
  "scripts": {
    "predeploy": "npm test"
  }
}
```

This ensures that:

- ✅ All core logic is validated
- ✅ Configuration is correct
- ✅ Error handling works properly
- ✅ No syntax errors exist

### Manual Testing

Before deploying, you can also run:

```bash
# Run all tests
npm test

# Check for any linting issues
npm run lint

# Validate configuration
npm run validate
```

## Test Environment

### Environment Variables

Tests use a controlled environment with mock values:

```javascript
process.env.TELEGRAM_BOT_TOKEN = "test-token";
process.env.TELEGRAM_CHAT = "-1001234567890";
process.env.DEV_CHAT_ID = "-1001234567891";
process.env.TEST_MODE = "true";
process.env.MIRROR_TO_DEV = "false";
process.env.STAGE = "test";
```

### Mocking Strategy

- **External Dependencies**: Telegram API, Ethereum provider, and database are mocked
- **Isolated Logic**: Core business logic is tested in isolation
- **Realistic Data**: Tests use realistic transaction and event data

## Continuous Integration

### GitHub Actions (Recommended)

Add this to your `.github/workflows/test.yml`:

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: "18"
      - run: npm ci
      - run: npm test
```

### Pre-commit Hooks

Consider adding pre-commit hooks to run tests automatically:

```bash
# Install husky
npm install --save-dev husky

# Add pre-commit hook
npx husky add .husky/pre-commit "npm test"
```

## Troubleshooting

### Common Issues

1. **BigInt Serialization**: Fixed with custom `toJSON` method in test setup
2. **Mock Dependencies**: External modules are properly mocked to avoid network calls
3. **Environment Variables**: Test environment is isolated from production

### Debugging Tests

```bash
# Run tests with verbose output
npm run test:verbose

# Run specific test file
npx jest test/simple.test.js

# Run tests in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Best Practices

### Writing Tests

1. **Test Core Logic**: Focus on business logic rather than external dependencies
2. **Use Realistic Data**: Mock data should mirror real-world scenarios
3. **Test Edge Cases**: Include tests for error conditions and boundary cases
4. **Keep Tests Fast**: Tests should run quickly for efficient development

### Test Maintenance

1. **Update Tests**: When adding new features, add corresponding tests
2. **Review Coverage**: Regularly review test coverage and add tests for critical paths
3. **Refactor Tests**: Keep tests clean and maintainable

## Conclusion

The test suite provides confidence that the core functionality works correctly before deployment. All tests should pass before deploying to production environments.

For questions or issues with testing, refer to the Jest documentation or create an issue in the project repository.
