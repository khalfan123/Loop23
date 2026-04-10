#!/usr/bin/env bash
set -euo pipefail

npm install --prefer-offline --no-audit --no-fund 2>/dev/null || true

if [ -n "${DATABASE_URL:-}" ]; then
  npx drizzle-kit push --force
else
  echo "[post-merge] DATABASE_URL not set; skipping drizzle-kit push."
fi
