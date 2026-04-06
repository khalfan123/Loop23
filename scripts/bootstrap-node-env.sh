#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f "package-lock.json" ]; then
  echo "[bootstrap-node-env] package-lock.json not found; cannot perform deterministic install."
  exit 1
fi

CACHE_DIR=".cache/agent-env"
LOCK_HASH_FILE="$CACHE_DIR/package-lock.sha256"
INSTALL_MARKER_FILE="$CACHE_DIR/last-install-utc.txt"

mkdir -p "$CACHE_DIR"

CURRENT_LOCK_HASH="$(sha256sum package-lock.json | awk '{print $1}')"
PREVIOUS_LOCK_HASH=""
if [ -f "$LOCK_HASH_FILE" ]; then
  PREVIOUS_LOCK_HASH="$(tr -d '\n' < "$LOCK_HASH_FILE")"
fi

SHOULD_INSTALL="false"
REASON="none"

if [ ! -d "node_modules" ]; then
  SHOULD_INSTALL="true"
  REASON="node_modules missing"
elif [ "$CURRENT_LOCK_HASH" != "$PREVIOUS_LOCK_HASH" ]; then
  SHOULD_INSTALL="true"
  REASON="package-lock hash changed"
elif [ ! -x "node_modules/.bin/tsc" ] || [ ! -x "node_modules/.bin/tsx" ]; then
  SHOULD_INSTALL="true"
  REASON="required local binaries missing"
elif [ ! -f "$INSTALL_MARKER_FILE" ]; then
  SHOULD_INSTALL="true"
  REASON="install marker missing"
fi

# Keep npm cache inside the workspace to speed up repeated setup runs.
export npm_config_cache="$ROOT_DIR/.npm-cache"

if [ "$SHOULD_INSTALL" = "true" ]; then
  echo "[bootstrap-node-env] Installing dependencies via npm ci ($REASON)"
  npm ci --prefer-offline --no-audit --fund=false
  printf '%s\n' "$CURRENT_LOCK_HASH" > "$LOCK_HASH_FILE"
  date -u +"%Y-%m-%dT%H:%M:%SZ" > "$INSTALL_MARKER_FILE"
else
  echo "[bootstrap-node-env] Dependencies already up to date (hash match); skipping npm ci."
fi

echo "[bootstrap-node-env] Verifying npm scripts and toolchain availability..."
node -e "const pkg=require('./package.json'); if(!pkg?.scripts?.check) throw new Error('Missing npm script: check'); if(!pkg?.scripts?.build) throw new Error('Missing npm script: build');"
npm run check -- --version >/dev/null
npx --no-install tsx --version >/dev/null

if [ ! -f "script/build.ts" ]; then
  echo "[bootstrap-node-env] Missing build entry file: script/build.ts"
  exit 1
fi

echo "[bootstrap-node-env] Tooling ready: npm run check / npm run build prerequisites verified."
