#!/usr/bin/env bash
set -euo pipefail

EC2_HOST="${EC2_HOST:-13.206.82.20}"
EC2_USER="${EC2_USER:-ubuntu}"
EC2_KEY="/tmp/ec2-key.pem"
APP_DIR="/home/agentlabs/app"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEPLOY]${NC} $(date '+%H:%M:%S') $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $(date '+%H:%M:%S') $1"; }
error() { echo -e "${RED}[ERROR]${NC} $(date '+%H:%M:%S') $1"; exit 1; }

log "========================================="
log "  AgentLabs EC2 Auto-Deploy"
log "========================================="

if [ ! -f "$EC2_KEY" ]; then
    if [ -n "${EC2_SSH_KEY_B64:-}" ]; then
        log "Reconstructing SSH key from stored secret..."
        echo "$EC2_SSH_KEY_B64" | base64 -d > "$EC2_KEY"
        chmod 600 "$EC2_KEY"
    else
        error "SSH key not found. Set EC2_SSH_KEY_B64 env var or place key at $EC2_KEY"
    fi
fi

SSH_OPTS="-i $EC2_KEY -o ConnectTimeout=15 -o ServerAliveInterval=10 -o ServerAliveCountMax=6 -o TCPKeepAlive=yes -o StrictHostKeyChecking=no"

log "[1/5] Testing EC2 connection..."
ssh $SSH_OPTS $EC2_USER@$EC2_HOST 'echo "Connected to $(hostname)"' || error "Cannot connect to EC2"

log "[2/5] Building application locally..."
npx vite build --outDir dist/public 2>&1 | tail -5
npx esbuild server/index.ts \
    --bundle --platform=node --format=esm \
    --outfile=dist/index.mjs \
    --packages=external \
    --define:process.env.NODE_ENV=\"production\" 2>&1 | tail -3

cat > dist/index.cjs << 'EOF'
#!/usr/bin/env node
import("./index.mjs");
EOF

log "Build complete: $(du -sh dist/ | cut -f1)"

log "[3/5] Pushing build to EC2..."
tar cf - dist/ shared/ migrations/ drizzle.config.ts package.json package-lock.json 2>/dev/null \
    | ssh $SSH_OPTS $EC2_USER@$EC2_HOST \
    "sudo -u agentlabs bash -c 'cd $APP_DIR && rm -rf dist/ && tar xf -'" \
    || error "Failed to transfer files"
log "Files transferred"

log "[4/5] Running migrations & restarting on EC2..."
ssh $SSH_OPTS $EC2_USER@$EC2_HOST "sudo bash -c '
cd $APP_DIR
sudo -u agentlabs npx drizzle-kit push --force 2>&1 | tail -5
systemctl restart agentlabs
sleep 5
'" || error "Failed to restart on EC2"

log "[5/5] Health check..."
RETRIES=8
for i in $(seq 1 $RETRIES); do
    CODE=$(ssh $SSH_OPTS $EC2_USER@$EC2_HOST "curl -s -o /dev/null -w '%{http_code}' http://localhost:5000/health" 2>/dev/null || echo "000")
    if [ "$CODE" = "200" ]; then
        log "Health check passed!"
        break
    fi
    if [ "$i" -eq "$RETRIES" ]; then
        error "Health check failed after $RETRIES attempts. Check: ssh $EC2_USER@$EC2_HOST 'sudo journalctl -u agentlabs -n 50'"
    fi
    warn "Attempt $i/$RETRIES returned $CODE, retrying in 3s..."
    sleep 3
done

log "========================================="
log "  Deployment successful!"
log "  Live at: http://$EC2_HOST"
log "========================================="
