#!/usr/bin/env node
/**
 * Verify connectivity from admin / ops machine to the Byan AI **main** app internal API.
 *
 * Discovery (no secret):
 *   node scripts/verify-internal-admin-api.mjs https://YOUR_MAIN_APP.replit.app
 *
 * Full check (with secret from Replit Secrets — do not paste into git):
 *   INTERNAL_API_SECRET=... node scripts/verify-internal-admin-api.mjs https://YOUR_MAIN_APP.replit.app
 *
 * Exit codes: 0 all checks passed, 1 failure, 2 wrong usage
 */
import process from "node:process";
import { execFileSync } from "node:child_process";

const INTERNAL_HEADER = "x-internal-api-key";

function requestViaCurl(base, path, secret) {
  const url = `${base}${path}`;
  const args = ["-sS", "-w", "\n%{http_code}", "-o", "-", url];
  if (secret) {
    args.unshift("-H", `${INTERNAL_HEADER}: ${secret}`);
  }
  const out = execFileSync("curl", args, {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  const lastNl = out.lastIndexOf("\n");
  const body = out.slice(0, lastNl).trimEnd();
  const statusLine = out.slice(lastNl + 1).trim();
  const status = Number.parseInt(statusLine, 10) || 0;
  let json = null;
  try {
    json = JSON.parse(body);
  } catch {
    /* ignore */
  }
  return { status, text: body, json };
}

function usage() {
  console.error(`Usage:
  node scripts/verify-internal-admin-api.mjs <baseUrl>
  INTERNAL_API_SECRET=... node scripts/verify-internal-admin-api.mjs <baseUrl>

<baseUrl> must be https origin only, e.g. https://my-byanai.replit.app (no trailing slash)

See scripts/admin-connection.env.example for Replit Secret alignment.`);
}

function normalizeBase(url) {
  const u = String(url || "").trim().replace(/\/+$/, "");
  if (!u.startsWith("http://") && !u.startsWith("https://")) {
    throw new Error("baseUrl must start with https:// or http://");
  }
  return u;
}

async function request(base, path, { secret } = {}) {
  try {
    const headers = {};
    if (secret) headers[INTERNAL_HEADER] = secret;
    const res = await fetch(`${base}${path}`, { headers, redirect: "manual" });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* ignore */
    }
    return { status: res.status, text, json };
  } catch (e) {
    const code = e?.cause?.code || e?.code;
    const msg = String(e?.message || e);
    const tls = code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" || msg.includes("fetch failed");
    if (tls && process.platform !== "win32") {
      try {
        return requestViaCurl(base, path, secret);
      } catch {
        /* fall through */
      }
    }
    console.error(
      `Request failed (${msg}). If TLS is the issue, install ca certs or run the same URL with curl manually.`,
    );
    throw e;
  }
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--json");
  if (args.length < 1) {
    usage();
    process.exit(2);
  }

  const base = normalizeBase(args[0]);
  const secret = process.env.INTERNAL_API_SECRET || "";

  console.log(`Target: ${base}\n`);

  // --- OpenAPI (public, no auth) ---
  const openApi = await request(base, "/api/openapi.json", {});
  console.log(`[discovery] GET /api/openapi.json (no auth)`);
  console.log(`  HTTP ${openApi.status}`);
  if (openApi.status === 200 && openApi.json?.openapi) {
    console.log(`  OK: OpenAPI ${openApi.json.openapi} — ${openApi.json.info?.title || "doc"}`);
  } else if (openApi.status === 404) {
    console.log(`  Deploy may be missing admin/openapi routes — pull latest main app and restart.`);
  } else {
    console.log(`  Body (truncated): ${openApi.text.slice(0, 200)}`);
  }

  // --- Discovery: unauthenticated internal health ---
  const noKey = await request(base, "/api/internal/health", {});
  console.log(`[discovery] GET /api/internal/health (no ${INTERNAL_HEADER})`);
  console.log(`  HTTP ${noKey.status}`);
  if (noKey.status === 404) {
    console.log(
      `  Interpretation: this host does not expose Loop23 internal routes (SPA-only or wrong deployment).`,
    );
    console.log(
      `  loopcp-style admin hosts often return 404 here; set baseUrl to the **main** Byan AI API host.`,
    );
  } else if (noKey.status === 401) {
    console.log(`  OK: internal API is mounted; authentication required.`);
  } else if (noKey.status === 503 && noKey.json?.error?.includes?.("not configured")) {
    console.log(`  INTERNAL_API_SECRET is missing on this server — set it in Replit Secrets and restart.`);
  } else if (noKey.status === 200) {
    console.log(`  Unexpected 200 without key — review server middleware.`);
  } else {
    console.log(`  Body (truncated): ${noKey.text.slice(0, 200)}`);
  }

  if (!secret) {
    console.log(`\n[skip] No INTERNAL_API_SECRET in env — set it to run authenticated checks.`);
    console.log(
      `\n[data-loss hint] Empty admin after wiring usually means wrong DATABASE_URL or a reset DB; compare Neon/Replit DB to backups.`,
    );
    process.exit(0);
  }

  // --- Authenticated ---
  const health = await request(base, "/api/internal/health", { secret });
  console.log(`\n[verify] GET /api/internal/health (with secret)`);
  console.log(`  HTTP ${health.status}`);
  if (health.status !== 200 || health.json?.status !== "ok") {
    console.log(`  Body: ${health.text.slice(0, 500)}`);
    process.exit(1);
  }
  console.log(`  OK: ${JSON.stringify(health.json)}`);

  const users = await request(base, "/api/internal/users", { secret });
  console.log(`\n[verify] GET /api/internal/users`);
  console.log(`  HTTP ${users.status}`);
  if (users.status !== 200 || !Array.isArray(users.json)) {
    console.log(`  Body: ${users.text.slice(0, 500)}`);
    process.exit(1);
  }
  const n = users.json.length;
  console.log(`  OK: ${n} user row(s) visible to internal API`);
  if (n === 0) {
    console.log(
      `  [data-loss warning] Zero users — if you expect accounts, confirm DATABASE_URL on this deployment and whether the database was replaced.`,
    );
  }

  const billing = await request(base, "/api/internal/admin/billing/overview", { secret });
  console.log(`\n[verify] GET /api/internal/admin/billing/overview`);
  console.log(`  HTTP ${billing.status}`);
  if (billing.status !== 200) {
    console.log(`  Body: ${billing.text.slice(0, 500)}`);
    process.exit(1);
  }
  console.log(`  OK: billing overview reachable`);

  const adminMirror = await request(base, "/api/admin/system/version", { secret });
  console.log(`\n[verify] GET /api/admin/system/version (same secret as /api/internal/*)`);
  console.log(`  HTTP ${adminMirror.status}`);
  if (adminMirror.status !== 200) {
    console.log(`  Body: ${adminMirror.text.slice(0, 500)}`);
    process.exit(1);
  }
  console.log(`  OK: /api/admin/* mirror is deployed — ${JSON.stringify(adminMirror.json)}`);

  console.log(`\nAll checks passed. Align loopcp Secrets with this baseUrl and the same INTERNAL_API_SECRET, then restart loopcp.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
