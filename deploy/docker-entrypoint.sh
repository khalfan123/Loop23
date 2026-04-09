#!/bin/sh
set -e

if [ -f "drizzle.config.ts" ] && [ -n "$DATABASE_URL" ]; then
    echo "[entrypoint] Running database migrations..."
    npx drizzle-kit push --force 2>&1
fi

exec "$@"
