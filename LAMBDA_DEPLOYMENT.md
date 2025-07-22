# AWS Lambda Deployment Guide

This guide explains how to deploy the Telegram Ethereum Wallet Monitor Bot to AWS Lambda for serverless execution.

## Prerequisites

- AWS CLI configured
- Node.js 18+ (for local testing)
- AWS Lambda execution role with appropriate permissions

## Deployment Options

### Option 1: Manual Deployment

1. **Create deployment package:**

   ```bash
   # Install dependencies
   npm install

   # Create deployment zip
   zip -r lambda-deployment.zip . -x "*.git*" "node_modules/.cache/*" "*.md" "*.log"
   ```

2. **Create Lambda function:**

   ```bash
   aws lambda create-function \
     --function-name eth-wallet-monitor \
     --runtime nodejs18.x \
     --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role \
     --handler lambda.handler \
     --zip-file fileb://lambda-deployment.zip \
     --timeout 300 \
     --memory-size 512
   ```

3. **Set environment variables:**
   ```bash
   aws lambda update-function-configuration \
     --function-name eth-wallet-monitor \
     --environment Variables='{
       "BOT_MODE":"once",
       "BLOCKS_TO_SCAN":"10"
     }'
   ```

### Option 2: CloudFormation Template

Create `template.yaml`:

```yaml
AWSTemplateFormatVersion: "2010-09-09"
Description: "Ethereum Wallet Monitor Lambda Function"

Parameters:
  BotToken:
    Type: String
    Description: Telegram Bot Token
  ChatId:
    Type: String
    Description: Telegram Chat ID

Resources:
  EthWalletMonitorFunction:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: eth-wallet-monitor
      Runtime: nodejs18.x
      Handler: lambda.handler
      Code:
        ZipFile: |
          // Placeholder - will be replaced with actual code
      Timeout: 300
      MemorySize: 512
      Environment:
        Variables:
          BOT_MODE: once
          BLOCKS_TO_SCAN: "10"
          TELEGRAM_BOT_TOKEN: !Ref BotToken
          TELEGRAM_CHAT: !Ref ChatId

  ScheduledRule:
    Type: AWS::Events::Rule
    Properties:
      Name: eth-wallet-monitor-schedule
      Description: Trigger wallet monitor every 5 minutes
      ScheduleExpression: rate(5 minutes)
      State: ENABLED
      Targets:
        - Arn: !GetAtt EthWalletMonitorFunction.Arn
          Id: EthWalletMonitorTarget

  PermissionForEventsToInvokeLambda:
    Type: AWS::Lambda::Permission
    Properties:
      FunctionName: !Ref EthWalletMonitorFunction
      Action: lambda:InvokeFunction
      Principal: events.amazonaws.com
      SourceArn: !GetAtt ScheduledRule.Arn
```

## Trigger Options

### 1. CloudWatch Events (Scheduled)

Trigger the function on a schedule:

```bash
# Create rule to run every 5 minutes
aws events put-rule \
  --name eth-wallet-monitor-schedule \
  --schedule-expression "rate(5 minutes)" \
  --state ENABLED

# Add Lambda as target
aws events put-targets \
  --rule eth-wallet-monitor-schedule \
  --targets "Id"="1","Arn"="arn:aws:lambda:REGION:ACCOUNT:function:eth-wallet-monitor"

# Grant permission
aws lambda add-permission \
  --function-name eth-wallet-monitor \
  --statement-id EventBridgeInvoke \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "arn:aws:events:REGION:ACCOUNT:rule/eth-wallet-monitor-schedule"
```

### 2. API Gateway (HTTP Trigger)

Create REST API endpoint:

```bash
# Create API
aws apigateway create-rest-api \
  --name eth-wallet-monitor-api \
  --description "Ethereum Wallet Monitor API"

# Create resource and method
aws apigateway create-resource \
  --rest-api-id YOUR_API_ID \
  --parent-id YOUR_PARENT_ID \
  --path-part "scan"

aws apigateway put-method \
  --rest-api-id YOUR_API_ID \
  --resource-id YOUR_RESOURCE_ID \
  --http-method POST \
  --authorization-type NONE

# Integrate with Lambda
aws apigateway put-integration \
  --rest-api-id YOUR_API_ID \
  --resource-id YOUR_RESOURCE_ID \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:REGION:lambda:path/2015-03-31/functions/arn:aws:lambda:REGION:ACCOUNT:function:eth-wallet-monitor/invocations"
```

### 3. S3 Event (File Upload Trigger)

Trigger when files are uploaded to S3:

```bash
# Create S3 bucket
aws s3 mb s3://eth-wallet-monitor-triggers

# Configure bucket notification
aws s3api put-bucket-notification-configuration \
  --bucket eth-wallet-monitor-triggers \
  --notification-configuration '{
    "LambdaConfigurations": [
      {
        "Id": "ScanTrigger",
        "LambdaFunctionArn": "arn:aws:lambda:REGION:ACCOUNT:function:eth-wallet-monitor",
        "Events": ["s3:ObjectCreated:*"]
      }
    ]
  }'
```

## Environment Variables

Configure these environment variables in your Lambda function:

| Variable             | Description              | Default   |
| -------------------- | ------------------------ | --------- |
| `BOT_MODE`           | Execution mode           | `once`    |
| `BLOCKS_TO_SCAN`     | Number of blocks to scan | `10`      |
| `TELEGRAM_BOT_TOKEN` | Your Telegram bot token  | Required  |
| `TELEGRAM_CHAT`      | Target chat ID           | Required  |
| `ETHEREUM_RPC`       | Ethereum RPC endpoint    | From code |

## Monitoring and Logging

### CloudWatch Logs

```bash
# View recent logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/eth-wallet-monitor"

# Get log events
aws logs get-log-events \
  --log-group-name "/aws/lambda/eth-wallet-monitor" \
  --log-stream-name "LATEST"
```

### CloudWatch Metrics

Monitor these metrics:

- Invocation count
- Duration
- Error rate
- Throttles

## Cost Optimization

### Lambda Configuration

- **Memory**: 512MB (adequate for blockchain operations)
- **Timeout**: 300 seconds (5 minutes max)
- **Concurrency**: Set limits to prevent excessive costs

### Scheduling Optimization

- Use CloudWatch Events with appropriate intervals
- Consider using EventBridge for more complex scheduling
- Monitor execution times and adjust accordingly

## Security Considerations

### IAM Permissions

Minimal required permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

### Environment Variables

- Store sensitive data (bot tokens) in AWS Secrets Manager
- Use encryption for environment variables
- Rotate credentials regularly

## Testing

### Local Testing

```bash
# Test once mode locally
npm run once

# Test with custom parameters
node index.js once 30000 15
```

### Lambda Testing

```bash
# Invoke function
aws lambda invoke \
  --function-name eth-wallet-monitor \
  --payload '{"test": true}' \
  response.json

# Check response
cat response.json
```

## Troubleshooting

### Common Issues

1. **Timeout Errors**

   - Increase Lambda timeout
   - Reduce blocks to scan
   - Check RPC endpoint performance

2. **Memory Errors**

   - Increase Lambda memory allocation
   - Optimize code for memory usage

3. **Permission Errors**

   - Verify IAM role permissions
   - Check CloudWatch Events permissions

4. **Network Errors**
   - Verify RPC endpoint accessibility
   - Check VPC configuration if applicable

### Debug Mode

Enable detailed logging by setting environment variable:

```bash
aws lambda update-function-configuration \
  --function-name eth-wallet-monitor \
  --environment Variables='{"DEBUG":"true"}'
```
