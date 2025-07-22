# Serverless Framework Deployment Guide

This guide explains how to deploy the Telegram Ethereum Wallet Monitor Bot using the Serverless Framework.

## Prerequisites

1. **Serverless Framework installed:**

   ```bash
   npm install -g serverless
   ```

2. **AWS CLI configured:**

   ```bash
   aws configure
   ```

3. **Node.js dependencies:**
   ```bash
   npm install
   ```

## Environment Variables

Create a `.env` file in your project root:

```bash
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your-telegram-bot-token-here
TELEGRAM_CHAT_ID=-1002545365231

# Ethereum RPC Configuration
ETHEREUM_RPC=https://ethereum-mainnet.core.chainstack.com/b6dbac3a0035889f4fe0ecba93817555

# Bot Configuration
BOT_MODE=once
BLOCKS_TO_SCAN=10
POLLING_INTERVAL=30000

# AWS Configuration
AWS_REGION=us-east-1
AWS_STAGE=dev

# Node Environment
NODE_ENV=production
```

## Deployment Commands

### 1. Deploy to Development Stage

```bash
serverless deploy --stage dev
```

### 2. Deploy to Production Stage

```bash
serverless deploy --stage prod
```

### 3. Deploy with Custom Stage

```bash
serverless deploy --stage staging
```

### 4. Deploy Only Functions (Faster)

```bash
serverless deploy function --function walletMonitor
```

### 5. Remove Deployment

```bash
serverless remove --stage dev
```

## Configuration Options

### Schedule Configuration

The `serverless.yml` includes multiple schedule options:

```yaml
# Every minute (disabled by default)
rate(1 minute)

# Every 5 minutes (enabled by default)
rate(5 minutes)

# Every 15 minutes (disabled by default)
rate(15 minutes)
```

### Enable/Disable Schedules

Edit the `serverless.yml` file to enable different schedules:

```yaml
# Enable frequent scanning
- schedule:
    rate: ${self:custom.schedules.frequent}
    enabled: true # Change to true
```

### Custom Schedule Expressions

You can use various CloudWatch Events expressions:

```yaml
# Every 2 minutes
rate(2 minutes)

# Every hour
rate(1 hour)

# Every day at 2 AM UTC
cron(0 2 * * ? *)

# Every Monday at 9 AM UTC
cron(0 9 ? * MON *)
```

## API Endpoints

After deployment, you'll get these endpoints:

### 1. Manual Scan Trigger

```bash
# POST request to trigger scan
curl -X POST https://your-api-gateway-url/dev/scan

# GET request to trigger scan
curl https://your-api-gateway-url/dev/scan
```

### 2. Health Check

```bash
curl https://your-api-gateway-url/dev/health
```

## Monitoring and Logs

### View Logs

```bash
# View recent logs
serverless logs --function walletMonitor --stage dev

# Follow logs in real-time
serverless logs --function walletMonitor --stage dev --tail

# View logs for specific time
serverless logs --function walletMonitor --stage dev --startTime 1h
```

### CloudWatch Dashboard

The deployment creates a CloudWatch dashboard with:

- Lambda invocation metrics
- Error rates
- Duration statistics

Access it via AWS Console → CloudWatch → Dashboards

## Cost Optimization

### Lambda Configuration

- **Memory**: 512MB (adequate for blockchain operations)
- **Timeout**: 300 seconds (5 minutes max)
- **Concurrency**: Limited to 5 concurrent executions

### Schedule Optimization

- Use appropriate intervals based on your needs
- Monitor execution times and adjust accordingly
- Consider using EventBridge for complex scheduling

## Security

### IAM Permissions

The deployment creates minimal required permissions:

- CloudWatch Logs access
- Lambda execution permissions

### Environment Variables

- Sensitive data (bot tokens) should be stored securely
- Consider using AWS Secrets Manager for production

## Troubleshooting

### Common Issues

1. **Deployment Fails**

   ```bash
   # Check AWS credentials
   aws sts get-caller-identity

   # Check serverless version
   serverless --version
   ```

2. **Function Timeout**

   - Increase timeout in `serverless.yml`
   - Reduce `BLOCKS_TO_SCAN`
   - Check RPC endpoint performance

3. **Memory Issues**

   - Increase memory allocation
   - Optimize code for memory usage

4. **Schedule Not Working**
   - Check CloudWatch Events in AWS Console
   - Verify function permissions
   - Check function logs for errors

### Debug Mode

```bash
# Deploy with verbose logging
serverless deploy --stage dev --verbose

# Test function locally
serverless invoke local --function walletMonitor --stage dev
```

## Advanced Configuration

### Custom Domain

Add to `serverless.yml`:

```yaml
custom:
  customDomain:
    domainName: api.yourdomain.com
    stage: ${self:provider.stage}
    createRoute53Record: true
```

### VPC Configuration

```yaml
provider:
  vpc:
    securityGroupIds:
      - sg-xxxxxxxxxxxxxxxxx
    subnetIds:
      - subnet-xxxxxxxxxxxxxxxxx
      - subnet-xxxxxxxxxxxxxxxxx
```

### Environment-Specific Settings

```yaml
custom:
  dev:
    blocksToScan: 5
    pollingInterval: 60000
  prod:
    blocksToScan: 20
    pollingInterval: 30000
```

## Production Checklist

- [ ] Set up proper environment variables
- [ ] Configure monitoring and alerting
- [ ] Set up log retention policies
- [ ] Configure backup strategies
- [ ] Test all endpoints
- [ ] Verify schedule execution
- [ ] Set up cost monitoring
- [ ] Configure security best practices

## Support

For issues with the Serverless Framework:

- [Serverless Documentation](https://www.serverless.com/framework/docs/)
- [Serverless Community](https://forum.serverless.com/)

For issues with the bot:

- Check CloudWatch logs
- Verify environment variables
- Test locally first
