#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bash "$SCRIPT_DIR/bootstrap-node-env.sh"

if [ -n "${DATABASE_URL:-}" ]; then
  npx drizzle-kit push --force
else
  echo "[post-merge] DATABASE_URL not set; skipping drizzle-kit push."
fi
