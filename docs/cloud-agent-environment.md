# Cloud Agent Node/TypeScript Environment Setup

This repository includes an idempotent bootstrap script for cloud agents:

- `scripts/bootstrap-node-env.sh`

It is designed to:

1. Install dependencies deterministically from `package-lock.json` (`npm ci`).
2. Skip reinstalling when `node_modules` and lockfile hash are already up to date.
3. Verify that tooling for `npm run check` and `npm run build` is available.

## What it verifies

- `npm` script `check` exists and `tsc` is available (`npm run check -- --version`)
- `npm` script `build` exists
- `tsx` is available (`npx --no-install tsx --version`)
- build entry file exists: `script/build.ts`

## Automatic integration points

- `.replit` run command and workflow now run:

```bash
bash scripts/bootstrap-node-env.sh && npm run dev
```

- `scripts/post-merge.sh` now calls the same bootstrap script before optional DB sync.

## Cache and lock tracking

- npm cache: `.npm-cache/`
- lock hash marker: `.cache/agent-env/package-lock.sha256`
- install timestamp marker: `.cache/agent-env/last-install-utc.txt`

These paths are git-ignored.

## Manual usage

```bash
bash scripts/bootstrap-node-env.sh
```
