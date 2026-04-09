#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/agentlabs/app"
SERVICE_NAME="agentlabs"
LOG_DIR="$APP_DIR/logs"
LOG_FILE="$LOG_DIR/deploy-$(date +%Y%m%d-%H%M%S).log"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEPLOY]${NC} $(date '+%H:%M:%S') $1" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $(date '+%H:%M:%S') $1" | tee -a "$LOG_FILE"; }
error() { echo -e "${RED}[ERROR]${NC} $(date '+%H:%M:%S') $1" | tee -a "$LOG_FILE"; exit 1; }

mkdir -p "$LOG_DIR"

log "Starting deployment..."

if [ ! -f "$APP_DIR/.env" ]; then
    error ".env file not found at $APP_DIR/.env — copy deploy/.env.production.example and fill in values"
fi

cd "$APP_DIR"

log "Saving current commit for rollback..."
ROLLBACK_COMMIT=$(git rev-parse HEAD)
echo "$ROLLBACK_COMMIT" > "$LOG_DIR/.last-good-commit"

log "Pulling latest code..."
git fetch origin
CURRENT=$(git rev-parse HEAD)
git pull origin main
NEW=$(git rev-parse HEAD)

if [ "$CURRENT" = "$NEW" ] && [ "${FORCE_DEPLOY:-}" != "1" ]; then
    warn "No new changes detected. Set FORCE_DEPLOY=1 to force. Exiting."
    exit 0
fi

log "Commit: $(git log -1 --pretty=format:'%h %s')"

log "Installing dependencies..."
npm ci --production=false 2>&1 | tail -5 | tee -a "$LOG_FILE"

log "Building application..."
npm run build 2>&1 | tee -a "$LOG_FILE"

log "Running database migrations..."
npx drizzle-kit push 2>&1 | tee -a "$LOG_FILE"

log "Ensuring required directories exist..."
mkdir -p client/public/uploads client/public/images public/audio public/avatars public/widget \
         kyc exports data data/invoices data/refund-notes logs public/images

log "Restarting service..."
sudo systemctl restart "$SERVICE_NAME"

sleep 3

log "Checking service health..."
RETRIES=10
HEALTH_OK=0
for i in $(seq 1 $RETRIES); do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        log "Health check passed (attempt $i/$RETRIES)"
        HEALTH_OK=1
        break
    fi
    if [ "$i" -eq "$RETRIES" ]; then
        warn "Health check failed after $RETRIES attempts."
        warn "Rolling back to previous commit $ROLLBACK_COMMIT ..."
        git checkout "$ROLLBACK_COMMIT"
        npm ci --production=false 2>&1 | tail -3
        npm run build 2>&1 | tail -3
        sudo systemctl restart "$SERVICE_NAME"
        error "Deployment failed and rolled back. Check: sudo journalctl -u $SERVICE_NAME -n 50"
    fi
    warn "Health check attempt $i/$RETRIES returned $HTTP_CODE, retrying in 3s..."
    sleep 3
done

log "Deployment complete!"
log "Version: $(node -e "const v=require('./build-version.json'); console.log('v'+v.major+'.'+v.minor+'.'+v.patch+' (Build '+v.build+')')" 2>/dev/null || echo 'unknown')"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status $SERVICE_NAME"
echo "  sudo journalctl -u $SERVICE_NAME -f"
echo "  curl -s http://localhost:5000/health | jq"
echo ""
echo "NOTE: This script uses 'sudo systemctl restart'."
echo "Ensure the agentlabs user has passwordless sudo for systemctl."
echo "Add to /etc/sudoers.d/agentlabs:"
echo "  agentlabs ALL=(ALL) NOPASSWD: /bin/systemctl restart agentlabs, /bin/systemctl status agentlabs"
