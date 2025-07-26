#!/bin/bash

# Toggle MIRROR_TO_DEV setting for deployment
# Usage: ./scripts/toggle-mirror.sh [dev|prod] [on|off]

STAGE=${1:-dev}
ACTION=${2:-on}

if [ "$ACTION" = "on" ]; then
    MIRROR_SETTING="true"
    echo "🔔 Enabling MIRROR_TO_DEV for $STAGE environment..."
elif [ "$ACTION" = "off" ]; then
    MIRROR_SETTING="false"
    echo "🔕 Disabling MIRROR_TO_DEV for $STAGE environment..."
else
    echo "❌ Invalid action. Use 'on' or 'off'"
    exit 1
fi

if [ "$STAGE" = "dev" ] || [ "$STAGE" = "prod" ]; then
    echo "🚀 Deploying to $STAGE with MIRROR_TO_DEV=$MIRROR_SETTING..."
    MIRROR_TO_DEV=$MIRROR_SETTING serverless deploy --stage $STAGE
    echo "✅ Deployment complete!"
else
    echo "❌ Invalid stage. Use 'dev' or 'prod'"
    exit 1
fi 