import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readPackageVersion(): string {
  try {
    const p = path.join(__dirname, "../../package.json");
    const pkg = JSON.parse(fs.readFileSync(p, "utf-8")) as { version?: string };
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/** Public discovery document for client generation (no auth). */
router.get("/api/openapi.json", (_req: Request, res: Response) => {
  const version = readPackageVersion();
  res.json({
    openapi: "3.0.3",
    info: { title: "Byan AI Admin API", version },
    servers: [{ url: "/" }],
    paths: {
      "/api/openapi.json": { get: { summary: "This document" } },
      "/api/auth/login": { post: { summary: "Login; returns {user, token, expiresIn}; sets refresh cookie" } },
      "/api/auth/refresh": { post: { summary: "New access token using refresh_token cookie" } },
      "/api/auth/me": { get: { summary: "Current user; requires Authorization: Bearer" } },
      "/api/internal/health": { get: { summary: "Internal health; requires X-Internal-API-Key" } },
      "/api/internal/admin/{path}": { get: {}, post: {}, patch: {}, put: {}, delete: {} },
      "/api/admin/users": { get: {}, post: {} },
      "/api/admin/users/{id}": { get: {}, patch: {}, delete: {} },
      "/api/admin/users/{id}/credits": { post: {} },
      "/api/admin/users/{id}/limits": { get: {}, patch: {} },
      "/api/admin/kyc/queue": { get: { summary: "Alias → users/kyc-queue" } },
      "/api/admin/support/tickets": { get: {}, post: {} },
      "/api/admin/calls": { get: {} },
      "/api/admin/calls/stats": { get: {} },
      "/api/admin/ai-services/agents": { get: {} },
      "/api/admin/billing/overview": { get: {} },
      "/api/admin/billing/credits/balance": { get: {} },
      "/api/admin/billing/credits/ledger": { get: {} },
      "/api/admin/billing/invoices": { get: {} },
      "/api/admin/content/notifications": { get: {} },
      "/api/admin/content/articles": { get: {} },
      "/api/admin/configure/settings": { get: {}, patch: {} },
      "/api/admin/system/health": { get: {} },
      "/api/admin/system/version": { get: {} },
      "/api/admin/system/audit-logs": { get: {} },
      "/api/admin/system/api-audit-logs": { get: {} },
      "/api/admin/marketplace/integrations": { get: {} },
      "/api/admin/plugins": { get: {} },
    },
  });
});

export default router;
