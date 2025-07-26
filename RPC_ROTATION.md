# RPC Rotation System

## Overview

The RPC rotation system distributes Ethereum RPC requests across multiple providers to avoid rate limits and improve reliability. This helps reduce the load on individual providers like Chainstack and provides automatic failover when providers are down.

## Features

- **Automatic Provider Rotation**: Switches between providers every 5 minutes
- **Health Monitoring**: Continuously checks provider health every minute
- **Failover**: Automatically switches to healthy providers when one fails
- **Load Distribution**: Spreads requests across multiple providers
- **Statistics Tracking**: Monitors usage, errors, and response times for each provider

## Provider Tiers

### Primary Providers (Priority 1)

- **Chainstack**: Paid service with high rate limits
- **Features**: WebSocket support, archive data, high reliability

### Secondary Providers (Priority 2)

- **Cloudflare**: Free service with moderate rate limits
- **Ankr**: Free service with moderate rate limits
- **1RPC**: Free service with lower rate limits
- **Features**: HTTP only, good reliability

### Fallback Providers (Priority 3)

- **Ethereum Foundation**: Public RPC endpoint
- **MyCrypto**: Public RPC endpoint
- **Features**: HTTP only, lower reliability, emergency backup

## Configuration

### Environment Variables

```bash
# Enable/disable RPC rotation (default: true)
ENABLE_RPC_ROTATION=true

# Rotation interval in milliseconds (default: 300000 = 5 minutes)
RPC_ROTATION_INTERVAL=300000

# Health check interval in milliseconds (default: 60000 = 1 minute)
RPC_HEALTH_CHECK_INTERVAL=60000

# Maximum consecutive failures before marking provider as failed (default: 3)
RPC_MAX_FAILURES=3

# Custom RPC providers (comma-separated URLs)
CUSTOM_RPC_PROVIDERS=https://your-rpc-1.com,https://your-rpc-2.com
```

### Adding Custom Providers

You can add your own RPC providers by setting the `CUSTOM_RPC_PROVIDERS` environment variable:

```bash
export CUSTOM_RPC_PROVIDERS="https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY,https://mainnet.infura.io/v3/YOUR_KEY"
```

## Usage

### Testing RPC Rotation

```bash
# Test the RPC rotation system
npm run test:rpc
```

### Monitoring Provider Statistics

The system automatically logs provider statistics. You can also access them programmatically:

```javascript
const { getRPCStats } = require("./index.js");
const stats = getRPCStats();
console.log(stats);
```

Example output:

```javascript
{
  "Chainstack": {
    "requests": 150,
    "errors": 2,
    "lastUsed": 1640995200000,
    "lastError": 1640995000000,
    "avgResponseTime": 245,
    "isHealthy": true,
    "consecutiveFailures": 0,
    "errorRate": "1.33%",
    "lastUsedAgo": "5s ago",
    "status": "healthy"
  },
  "Cloudflare": {
    "requests": 75,
    "errors": 1,
    "lastUsed": 1640995200000,
    "lastError": 0,
    "avgResponseTime": 180,
    "isHealthy": true,
    "consecutiveFailures": 0,
    "errorRate": "1.33%",
    "lastUsedAgo": "10s ago",
    "status": "healthy"
  }
}
```

## How It Works

### 1. Provider Selection

- Providers are ranked by priority (1 = highest, 3 = lowest)
- Within each priority level, providers are ranked by error rate
- The system selects the healthiest provider with the lowest priority

### 2. Automatic Rotation

- Every 5 minutes, the system attempts to rotate to a different provider
- Rotation only occurs if a healthier provider is available
- The current provider continues to be used if it's the best option

### 3. Health Monitoring

- Each provider is health-checked every minute
- Health checks involve calling `getBlockNumber()`
- Providers are marked as unhealthy after 3 consecutive failures

### 4. Failover

- When a provider fails (rate limit, network error, etc.), it's marked as failed
- The system automatically switches to the next best available provider
- Failed providers are retried during health checks

### 5. Rate Limit Handling

- When a rate limit error is detected, the system immediately rotates to another provider
- This prevents hitting rate limits on any single provider

## Benefits

### For Chainstack Users

- **Reduced Usage**: Distributes load across multiple providers
- **Cost Savings**: Reduces monthly request count on paid services
- **Reliability**: Automatic failover when Chainstack is down

### For All Users

- **Better Uptime**: Multiple providers ensure service availability
- **Improved Performance**: Faster response times from healthy providers
- **Automatic Recovery**: Self-healing when providers come back online

## Monitoring

### Log Messages

The system logs various events:

```
[RPC] Switched to Chainstack (http mode)
[RPC] Provider Cloudflare failed, switching to backup
[RPC] Health check failed for Ankr: connection timeout
[Rate Limit] getBlockNumber hit rate limit on Chainstack, switching to Cloudflare
```

### Statistics

Monitor provider performance through the statistics API:

- Request counts
- Error rates
- Response times
- Health status

## Troubleshooting

### Provider Not Working

1. Check if the provider is marked as failed in statistics
2. Verify the provider URL is correct
3. Check network connectivity
4. Review error logs for specific failure reasons

### High Error Rates

1. Reduce request frequency
2. Add more providers to the pool
3. Check provider rate limits
4. Consider upgrading to paid providers

### Performance Issues

1. Monitor response times in statistics
2. Switch to providers with better performance
3. Adjust health check intervals
4. Consider using WebSocket providers for real-time monitoring

## Future Enhancements

- **Weighted Load Balancing**: Distribute requests based on provider capacity
- **Geographic Distribution**: Use providers in different regions
- **Cost Optimization**: Prefer free providers for non-critical operations
- **Advanced Health Checks**: More sophisticated health monitoring
- **Provider Performance Analytics**: Detailed performance metrics
