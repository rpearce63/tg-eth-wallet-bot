# Testing Guidelines

## 🚨 **IMPORTANT: Dev Environment Only**

All tests must be conducted in the **dev environment only**. Production testing is strictly prohibited.

## ✅ **Environment Validation**

All test scripts include automatic environment validation:

```javascript
function validateEnvironment() {
  const stage = process.env.STAGE || "dev";
  if (stage === "prod") {
    console.error("❌ ERROR: Tests cannot be run in production environment!");
    process.exit(1);
  }
  console.log(`✅ Running tests in ${stage} environment`);
}
```

## 🧪 **Available Test Scripts**

### 1. Image Size Tests

Test different image dimensions and formats:

```bash
# Test images only
STAGE=dev node test-image-sizes.js image

# Test videos only
STAGE=dev node test-image-sizes.js video

# Test both images and videos
STAGE=dev node test-image-sizes.js
```

### 2. Bot Function Tests

Test the main bot functions:

```bash
# Test individual token messages
STAGE=dev node test-dev-functions.js

# Test all messages at once
STAGE=dev node test-dev-functions.js --all
```

### 3. Manual Testing via API

Test via the deployed dev API endpoints:

```bash
# Health check
curl https://0iqnm7nlak.execute-api.us-east-1.amazonaws.com/dev/health

# Test endpoint
curl -X POST https://0iqnm7nlak.execute-api.us-east-1.amazonaws.com/dev/test

# Manual scan
curl -X POST https://0iqnm7nlak.execute-api.us-east-1.amazonaws.com/dev/scan
```

## 📱 **Dev Environment Details**

- **Chat ID**: `-1002545365231` (Test chat)
- **S3 Assets**: `tg-eth-wallet-bot-dev-assets`
- **DynamoDB Table**: `tg-eth-wallet-bot-deposits-dev`
- **API Endpoint**: `https://0iqnm7nlak.execute-api.us-east-1.amazonaws.com/dev/`

## 🔧 **Test Configuration**

### Image Size Configuration

```javascript
const IMAGE_SIZE_CONFIG = {
  width: 400, // Default width
  height: 300, // Default height
  tokenSpecific: {
    ETH: { width: 450, height: 338 },
    XIAOBAI: { width: 500, height: 375 },
  },
};
```

### Test Data

- **ETH**: 0.05 ETH (~$150)
- **USDC**: 150 USDC
- **USDT**: 250 USDT
- **XIAOBAI**: 50,000,000 tokens (~$7.50)

## 🚫 **What NOT to Test in Production**

- ❌ Image size variations
- ❌ Bot function tests
- ❌ Manual API calls
- ❌ Media asset tests
- ❌ Rate limiting tests

## ✅ **What to Test in Dev**

- ✅ All image sizes and formats
- ✅ All token message types
- ✅ API endpoints
- ✅ Media asset delivery
- ✅ Rate limiting behavior
- ✅ Error handling
- ✅ DynamoDB operations

## 🔄 **Deployment Workflow**

1. **Develop** → Make changes locally
2. **Test** → Run tests in dev environment
3. **Deploy Dev** → `serverless deploy --stage dev`
4. **Verify** → Test deployed dev functions
5. **Deploy Prod** → `serverless deploy --stage prod` (only after dev verification)

## 📋 **Pre-Deployment Checklist**

- [ ] All tests pass in dev environment
- [ ] No console errors in dev logs
- [ ] Media assets load correctly
- [ ] Messages send to dev chat only
- [ ] DynamoDB operations work
- [ ] API endpoints respond correctly

## 🆘 **Troubleshooting**

### Test Fails with Production Error

```bash
# Ensure you're in dev environment
export STAGE=dev
# or
unset STAGE  # defaults to dev
```

### Media Assets Not Loading

```bash
# Check dev S3 bucket
aws s3 ls s3://tg-eth-wallet-bot-dev-assets/ --region us-east-1
```

### API Endpoints Not Responding

```bash
# Check dev deployment status
serverless info --stage dev
```
