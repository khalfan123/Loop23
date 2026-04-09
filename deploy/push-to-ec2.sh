#!/usr/bin/env bash
set -euo pipefail

EC2_HOST="${EC2_HOST:-13.206.82.20}"
EC2_USER="${EC2_USER:-ubuntu}"
EC2_KEY="/tmp/ec2-key.pem"
APP_DIR="/home/agentlabs/app"
SYNC_DB="${SYNC_DB:-0}"

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

log "[1/6] Testing EC2 connection..."
ssh $SSH_OPTS $EC2_USER@$EC2_HOST 'echo "Connected to $(hostname)"' || error "Cannot connect to EC2"

log "[2/6] Building application locally..."
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

log "[3/6] Pushing build to EC2..."
tar cf - dist/ shared/ migrations/ drizzle.config.ts package.json package-lock.json 2>/dev/null \
    | ssh $SSH_OPTS $EC2_USER@$EC2_HOST \
    "sudo -u agentlabs bash -c 'cd $APP_DIR && rm -rf dist/ && tar xf -'" \
    || error "Failed to transfer files"
log "Files transferred"

if [ "$SYNC_DB" = "1" ]; then
    log "[4/6] Syncing database (full mirror)..."
    ssh $SSH_OPTS $EC2_USER@$EC2_HOST 'sudo systemctl stop agentlabs' || true

    ssh $SSH_OPTS $EC2_USER@$EC2_HOST 'sudo -u postgres bash -c "
        psql -c \"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '\''agentlabs'\'' AND pid <> pg_backend_pid();\" 2>/dev/null
        dropdb agentlabs 2>/dev/null
        createdb agentlabs -O agentlabs
        psql -d agentlabs -c '\''CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"; CREATE EXTENSION IF NOT EXISTS vector;'\''
    "' || error "Failed to recreate database"

    pg_dump --no-owner --no-privileges --format=plain --disable-triggers "$DATABASE_URL" 2>/dev/null \
        | ssh $SSH_OPTS $EC2_USER@$EC2_HOST 'sudo -u postgres psql -d agentlabs 2>&1 | tail -3' \
        || error "Failed to import database"

    ssh $SSH_OPTS $EC2_USER@$EC2_HOST 'sudo -u postgres psql -d agentlabs -c "
        GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO agentlabs;
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO agentlabs;
        GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO agentlabs;
        GRANT USAGE ON SCHEMA public TO agentlabs;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO agentlabs;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO agentlabs;
        DO \$\$ DECLARE r RECORD; BEGIN
            FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = '\''public'\'' LOOP
                EXECUTE '\''ALTER TABLE public.'\'' || r.tablename || '\'' OWNER TO agentlabs'\'';
            END LOOP;
            FOR r IN SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = '\''public'\'' LOOP
                EXECUTE '\''ALTER SEQUENCE public.'\'' || r.sequence_name || '\'' OWNER TO agentlabs'\'';
            END LOOP;
        END \$\$;
    "' || error "Failed to fix permissions"
    log "Database synced and permissions set"
else
    log "[4/6] Skipping database sync (use SYNC_DB=1 to sync)"
    ssh $SSH_OPTS $EC2_USER@$EC2_HOST "sudo bash -c '
    cd $APP_DIR
    sudo -u agentlabs npx drizzle-kit push --force 2>&1 | tail -5
    '" || warn "Migration had issues"
fi

log "[5/6] Restarting application..."
ssh $SSH_OPTS $EC2_USER@$EC2_HOST "sudo systemctl restart agentlabs" || error "Failed to restart"
sleep 6

log "[6/6] Health check..."
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
