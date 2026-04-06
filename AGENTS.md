# AGENTS.md

## Cursor Cloud specific instructions

### Overview

AgentLabs is a multi-tenant SaaS platform for AI-powered bulk calling. It uses a single-port Express + Vite architecture (port 5000) with a React 18 frontend and Node.js/TypeScript backend. See `replit.md` for full architecture details.

### Quick reference

| Action | Command |
|--------|---------|
| Install deps | `bash scripts/bootstrap-node-env.sh` |
| Dev server | `npm run dev` |
| Type check | `npm run check` |
| Build | `npm run build` |
| DB schema push | `npx drizzle-kit push --force` |

### Required environment variables

The dev server requires these env vars to start:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Any string for JWT signing |
| `APP_DOMAIN` | Domain for webhook URLs (use `http://localhost:5000` for local dev) |
| `OPENAI_API_KEY` | Required at module-load time by `server/replit_integrations/image/client.ts`; can be a placeholder like `sk-placeholder` if not using OpenAI features |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Same as above, used by the Replit integration image client |

### Database setup

PostgreSQL 16 is used. For local dev:

```
sudo pg_ctlcluster 16 main start
```

Schema is managed by Drizzle ORM. Push schema changes with:

```
npx drizzle-kit push --force
```

After a fresh DB, you must seed the `plans` table (at minimum `free` and `pro` rows) for agent/campaign creation to work.

### Non-obvious caveats

- **TypeScript check has pre-existing errors**: `npm run check` (tsc) reports ~20 type errors in the existing codebase. These do not affect runtime because the server runs via `tsx` which skips type checking.
- **Module-level OpenAI client**: `server/replit_integrations/image/client.ts` creates an OpenAI client at import time. If `OPENAI_API_KEY` or `AI_INTEGRATIONS_OPENAI_API_KEY` is not set, the server crashes on startup. A placeholder value is sufficient.
- **APP_DOMAIN required**: The server crashes during route registration if `APP_DOMAIN` is not set. Use `http://localhost:5000` for local development.
- **Plans table must be seeded**: The `plans` table must contain rows matching user `planType` values (e.g., `free`, `pro`) or agent/campaign creation will fail with "Plan configuration not found".
- **Single-port architecture**: Both Express API and Vite dev server run on port 5000. Do not start separate frontend dev servers.
- **bcrypt native module**: The `bcrypt` package has a native C++ addon compiled during `npm ci`. If Node.js major version changes, `node_modules` should be reinstalled.
