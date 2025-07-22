# Telegram Ethereum Wallet Monitor Bot

A Telegram bot that monitors Ethereum wallet deposits and sends notifications to a Telegram chat. Supports both WebSocket and polling modes for different use cases.

## Features

- **Dual Mode Operation**: Run as WebSocket listener or polling-based scanner
- **Multi-Token Support**: Monitors ETH, USDC, USDT, and XIAOBAI deposits
- **Real-time Notifications**: Sends formatted messages with transaction links
- **Deposit Logging**: Stores all deposits in a local JSON database
- **Hourly Summaries**: Automatic balance and contribution summaries
- **Price Integration**: USD values for ETH and XIAOBAI tokens

## Installation

```bash
npm install
```

## Configuration

The bot can be configured using environment variables or command line arguments:

### Environment Variables

#### Bot Configuration

- `BOT_MODE`: "websocket", "polling", or "once" (default: "websocket")
- `POLLING_INTERVAL`: Interval in milliseconds for polling mode (default: 30000)
- `BLOCKS_TO_SCAN`: Number of blocks to scan in polling/once mode (default: 10)

#### Telegram Configuration

- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token
- `TELEGRAM_CHAT_ID_DEV`: Development/test chat ID (default: -1002545365231)
- `TELEGRAM_CHAT_ID_PROD`: Production chat ID (default: -1002545365231)

#### Blockchain Configuration

- `ETHEREUM_RPC`: Ethereum RPC endpoint (WebSocket or HTTP)

### Command Line Arguments

```bash
node index.js [mode] [polling_interval] [blocks_to_scan]
```

**Modes:**

- `websocket`: Real-time WebSocket monitoring
- `polling`: Continuous polling at intervals
- `once`: Single scan and exit (perfect for AWS Lambda)

## Usage

### WebSocket Mode (Real-time)

```bash
# Using npm script
npm run websocket

# Using node directly
node index.js websocket

# Using environment variable
BOT_MODE=websocket node index.js
```

### Once Mode (Single Execution)

```bash
# Using npm script
npm run once

# Using node directly
node index.js once

# Custom block range
node index.js once 30000 15  # 30 seconds, 15 blocks

# Using environment variable
BOT_MODE=once BLOCKS_TO_SCAN=20 node index.js
```

### Polling Mode (Interval-based)

```bash
# Default polling (30 seconds, 10 blocks)
npm run polling

# Fast polling (10 seconds, 5 blocks)
npm run polling-fast

# Slow polling (60 seconds, 20 blocks)
npm run polling-slow

# Custom configuration
node index.js polling 15000 15  # 15 seconds, 15 blocks

# Using environment variables
BOT_MODE=polling POLLING_INTERVAL=20000 BLOCKS_TO_SCAN=8 node index.js
```

## Mode Comparison

### WebSocket Mode

- **Pros**: Real-time notifications, lower latency, efficient resource usage
- **Cons**: Requires stable WebSocket connection, may miss events during disconnections
- **Best for**: Production environments with reliable network connections

### Polling Mode

- **Pros**: More reliable, works with HTTP RPC endpoints, easier to debug
- **Cons**: Higher latency, more API calls, potential for rate limiting
- **Best for**: Development, testing, or environments with unstable WebSocket connections

### Once Mode

- **Pros**: Perfect for serverless execution, no persistent connections, cost-effective
- **Cons**: No real-time monitoring, requires external triggers
- **Best for**: AWS Lambda, scheduled jobs, or external trigger systems

## Configuration Details

### Monitored Addresses

Currently monitors: `0xe453b6ba7d8a4b402DFf9C1b2Da18226c5c2A9D3`

### Supported Tokens

- **ETH**: Native Ethereum
- **USDC**: USD Coin (6 decimals)
- **USDT**: Tether (6 decimals)
- **XIAOBAI**: Custom token (9 decimals)

### Telegram Configuration

- Bot Token: Configured in the code
- Chat ID: Supergroup chat for notifications
- Messages include: Token icon, amount, sender/receiver addresses, transaction links, chart links

## Data Storage

Deposits are stored in `deposits.json` with the following structure:

```json
{
  "deposits": [
    {
      "token": "ETH",
      "amount": "1.5",
      "from": "0x...",
      "to": "0x...",
      "txHash": "0x...",
      "timestamp": 1234567890
    }
  ]
}
```

## Monitoring and Metrics

The bot provides console logging for:

- Block processing events
- Deposit notifications
- WebSocket connection status
- Error handling
- Hourly summary statistics

## Error Handling

- WebSocket reconnection on connection loss
- Graceful error handling for RPC failures
- Retry logic for failed API calls
- Comprehensive error logging

## AWS Lambda Deployment

For serverless deployment, see the comprehensive guide in [LAMBDA_DEPLOYMENT.md](./LAMBDA_DEPLOYMENT.md).

### Environment-Specific Deployment

The bot supports different Telegram chat IDs for development and production environments:

```bash
# Development deployment (uses TELEGRAM_CHAT_ID_DEV)
serverless deploy --stage dev

# Production deployment (uses TELEGRAM_CHAT_ID_PROD)
serverless deploy --stage prod

# Set environment variables
export TELEGRAM_CHAT_ID_DEV="-1002545365231"  # Test chat
export TELEGRAM_CHAT_ID_PROD="-1002545365231" # Production chat (update when ready)

# Deploy with custom chat IDs
TELEGRAM_CHAT_ID_DEV="-1001234567890" serverless deploy --stage dev
TELEGRAM_CHAT_ID_PROD="-1009876543210" serverless deploy --stage prod
```

### Quick Lambda Setup

```bash
# Create deployment package
npm install && zip -r lambda-deployment.zip . -x "*.git*" "node_modules/.cache/*"

# Deploy to AWS Lambda
aws lambda create-function \
  --function-name eth-wallet-monitor \
  --runtime nodejs18.x \
  --handler lambda.handler \
  --zip-file fileb://lambda-deployment.zip \
  --timeout 300 \
  --memory-size 512
```

## Asset Management

### **S3 Asset Upload**

The bot supports custom images and videos (GIFs, MP4s) stored in S3. You need to upload assets manually:

```bash
# Create assets folder
mkdir assets

# Add your media files
cp xiaobai_ani.mp4 assets/
cp ethereum.gif assets/

# Deploy infrastructure
npm run deploy

# Upload assets to S3
npm run upload-assets

# Or do both at once
npm run deploy-full
```

### **Asset File Structure**

```
your-project/
├── assets/
│   ├── xiaobai_ani.mp4    # XIAOBAI token video
│   ├── ethereum.gif       # ETH token image
│   ├── usdc.gif          # USDC token image
│   └── usdt.gif          # USDT token image
├── index.js
├── serverless.yml
└── ...
```

### **Asset URLs**

After upload, assets are available at:

```
https://tg-eth-wallet-bot-dev-assets.s3.us-east-1.amazonaws.com/xiaobai_ani.mp4
https://tg-eth-wallet-bot-dev-assets.s3.us-east-1.amazonaws.com/ethereum.gif
```

### **Asset Requirements**

- **MP4**: Up to 50MB, 60 seconds max
- **GIF**: Up to 8MB
- **Format**: HTTPS URLs only
- **Hosting**: S3 bucket (automatic) or external CDN

## Development

To modify the bot:

1. Update `MONITORED_ADDRESSES` array for new wallets
2. Add new tokens to the `TOKENS` object
3. Modify notification format in `sendDepositMessage`
4. Adjust polling intervals based on your needs

## License

This project is for educational and development purposes.
