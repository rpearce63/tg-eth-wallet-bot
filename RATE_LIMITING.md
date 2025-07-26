# Rate Limiting Improvements

## Overview

The bot has been updated with comprehensive rate limiting to prevent hitting Chainstack's RPS (Requests Per Second) limits. This addresses the `-32005` error code that was causing the wallet monitor process to fail.

## Changes Made

### 1. Rate Limiting Configuration

Added a configurable rate limiting system with the following settings:

```javascript
const RATE_LIMIT_CONFIG = {
  maxRequestsPerSecond: process.env.MAX_RPS || 8, // Conservative default
  minDelayBetweenRequests: 150, // 150ms between requests (6.67 RPS)
  maxDelayBetweenRequests: 1000, // 1 second max delay
  exponentialBackoffBase: 2,
  maxRetries: 3,
  retryDelayMultiplier: 1.5,
};
```

### 2. Conservative Default Settings

- **Polling Interval**: Increased from 60s to 120s (2 minutes)
- **Blocks to Scan**: Reduced from 7 to 3 blocks per scan
- **Max RPS**: Set to 8 requests per second (well below Chainstack's limit)

### 3. Rate Limiting Functions

#### `rateLimitedRequest(requestFn, context)`

- Wraps all RPC calls with rate limiting
- Implements exponential backoff on rate limit errors
- Automatically retries failed requests
- Provides detailed logging for debugging

#### `enforceRateLimit()`

- Ensures minimum delay between requests
- Tracks requests per second window
- Automatically waits when limits are reached

#### `isRateLimitError(error)`

- Detects Chainstack rate limit errors (`-32005`)
- Handles various error formats

#### `calculateRetryDelay(error, retryCount)`

- Extracts suggested retry delay from error response
- Applies exponential backoff

### 4. Updated Functions

All RPC calls now use rate limiting:

- `provider.getBlockNumber()`
- `provider.getBlock(blockNumber, true)`
- `provider.getBalance(address)`
- `contract.queryFilter(filter, fromBlock, toBlock)`
- `contract.balanceOf(address)`

### 5. Error Handling

- Graceful handling of rate limit errors
- Automatic retry with exponential backoff
- Detailed logging for monitoring
- Non-blocking error handling for individual token queries

## Environment Variables

You can configure the rate limiting behavior using these environment variables:

```bash
# Maximum requests per second (default: 8)
MAX_RPS=6

# Polling interval in milliseconds (default: 120000 = 2 minutes)
POLLING_INTERVAL=180000

# Number of blocks to scan per polling cycle (default: 3)
BLOCKS_TO_SCAN=2
```

## Testing

### Test Rate Limiting

```bash
node scripts/test-rate-limiting.js
```

### Test Polling Mode

```bash
node scripts/test-polling-rate-limit.js
```

## Monitoring

The system provides detailed logging for monitoring rate limiting behavior:

```
[Rate Limit] getBlock(22998572) hit rate limit (attempt 1/4), retrying in 1500ms
[Rate Limit] Rate limit reached, waiting 200ms
[Config] Conservative settings: 120s interval, 3 blocks per scan
```

## Benefits

1. **Prevents Rate Limit Errors**: No more `-32005` errors from Chainstack
2. **Automatic Recovery**: Exponential backoff handles temporary rate limits
3. **Configurable**: Easy to adjust for different RPC provider limits
4. **Conservative Defaults**: Safe settings that work with free tier providers
5. **Detailed Logging**: Easy to monitor and debug rate limiting behavior

## Recommended Settings

For Chainstack free tier:

- `MAX_RPS=6` (conservative)
- `POLLING_INTERVAL=120000` (2 minutes)
- `BLOCKS_TO_SCAN=3` (3 blocks per scan)

For Chainstack paid tiers:

- `MAX_RPS=15-20` (depending on plan)
- `POLLING_INTERVAL=60000` (1 minute)
- `BLOCKS_TO_SCAN=5` (5 blocks per scan)
