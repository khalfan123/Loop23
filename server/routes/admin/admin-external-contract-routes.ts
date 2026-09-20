/**
 * Stable admin contract routes for external dashboards / proxies.
 * Mounted under /api/admin (after checkAdminOrInternal).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Router, Request, Response } from "express";
import { db } from "../../db";
import { storage } from "../../storage";
import {
  agents,
  auditLogs,
  apiAuditLogs,
  calls,
  creditTransactions,
  generatedArticles,
  globalSettings,
  integrationApps,
  knowledgeBase,
  notifications,
  paymentTransactions,
  phoneNumbers,
  userIntegrations,
  users,
  userSubscriptions,
} from "@shared/schema";
import { and, desc, eq, sql } from "drizzle-orm";

const router = Router();

function forwardedOrigin(req: Request): string {
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "https").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost").split(",")[0].trim();
  return `${proto}://${host}`;
}

// --- Users (extras beyond admin-users-routes) ---
router.get("/users/:id", async (req: Request, res: Response) => {
  try {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const { password, ...safe } = user as Record<string, unknown>;
    void password;
    res.json({ data: safe });
  } catch {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

router.post("/users/:id/credits", async (req: Request, res: Response) => {
  try {
    const amount = Number(req.body?.amount);
    const description = req.body?.description != null ? String(req.body.description) : null;
    if (!Number.isFinite(amount)) return res.status(400).json({ error: "amount must be a number" });
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const newCredits = Number(user.credits || 0) + amount;
    await storage.updateUserCredits(user.id, newCredits);
    await storage.createCreditTransaction({
      userId: user.id,
      type: amount >= 0 ? "credit" : "debit",
      amount,
      description: description || (amount >= 0 ? "Admin credit adjustment" : "Admin debit adjustment"),
      reference: null,
      stripePaymentId: null,
    });
    res.json({ success: true, newCredits });
  } catch {
    res.status(500).json({ error: "Failed to adjust credits" });
  }
});

router.get("/users/:id/limits", async (req: Request, res: Response) => {
  try {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const limits = await storage.getUserEffectiveLimits(req.params.id);
    const subscription = await storage.getUserSubscription(req.params.id);
    const kbCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(knowledgeBase)
      .where(eq(knowledgeBase.userId, req.params.id));
    const phoneCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(phoneNumbers)
      .where(eq(phoneNumbers.userId, req.params.id));
    res.json({
      userId: req.params.id,
      effectiveLimits: limits,
      overrides: subscription
        ? {
            overrideMaxWebhooks: subscription.overrideMaxWebhooks,
            overrideMaxKnowledgeBases: subscription.overrideMaxKnowledgeBases,
            overrideMaxFlows: subscription.overrideMaxFlows,
            overrideMaxPhoneNumbers: subscription.overrideMaxPhoneNumbers,
          }
        : null,
      currentUsage: {
        knowledgeBases: Number(kbCount[0]?.count || 0),
        phoneNumbers: Number(phoneCount[0]?.count || 0),
      },
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch limits" });
  }
});

router.patch("/users/:id/limits", async (req: Request, res: Response) => {
  try {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const coerce = (v: unknown): number | null | undefined => {
      if (v === undefined) return undefined;
      if (v === null || v === "" || v === "null") return null;
      const n = typeof v === "string" ? parseInt(v, 10) : (v as number);
      if (typeof n !== "number" || isNaN(n) || n < 0 || !Number.isInteger(n)) {
        throw new Error("Must be null or a non-negative integer");
      }
      return n;
    };
    const overrideMaxWebhooks = coerce(req.body?.overrideMaxWebhooks);
    const overrideMaxKnowledgeBases = coerce(req.body?.overrideMaxKnowledgeBases);
    const overrideMaxFlows = coerce(req.body?.overrideMaxFlows);
    const overrideMaxPhoneNumbers = coerce(req.body?.overrideMaxPhoneNumbers);
    let subscription = await storage.getUserSubscription(req.params.id);
    if (!subscription) {
      subscription = await storage.createUserSubscription({
        userId: req.params.id,
        planId: "free",
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        overrideMaxWebhooks: overrideMaxWebhooks ?? null,
        overrideMaxKnowledgeBases: overrideMaxKnowledgeBases ?? null,
        overrideMaxFlows: overrideMaxFlows ?? null,
        overrideMaxPhoneNumbers: overrideMaxPhoneNumbers ?? null,
      });
    } else {
      await db
        .update(userSubscriptions)
        .set({
          overrideMaxWebhooks: overrideMaxWebhooks !== undefined ? overrideMaxWebhooks : subscription.overrideMaxWebhooks,
          overrideMaxKnowledgeBases:
            overrideMaxKnowledgeBases !== undefined ? overrideMaxKnowledgeBases : subscription.overrideMaxKnowledgeBases,
          overrideMaxFlows: overrideMaxFlows !== undefined ? overrideMaxFlows : subscription.overrideMaxFlows,
          overrideMaxPhoneNumbers:
            overrideMaxPhoneNumbers !== undefined ? overrideMaxPhoneNumbers : subscription.overrideMaxPhoneNumbers,
        })
        .where(eq(userSubscriptions.id, subscription.id));
    }
    const newLimits = await storage.getUserEffectiveLimits(req.params.id);
    res.json({ success: true, effectiveLimits: newLimits });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update limits";
    res.status(500).json({ error: msg });
  }
});

// KYC stable aliases
router.get("/kyc/queue", (_req: Request, res: Response) => {
  res.redirect(307, "/api/admin/users/kyc-queue");
});
router.post("/kyc/:id/approve", (req: Request, res: Response) => {
  res.redirect(307, `/api/admin/users/${encodeURIComponent(req.params.id)}/kyc/approve`);
});
router.post("/kyc/:id/reject", (req: Request, res: Response) => {
  res.redirect(307, `/api/admin/users/${encodeURIComponent(req.params.id)}/kyc/reject`);
});

// AI Services — agents (cross-tenant admin view)
router.get("/ai-services/agents", async (req: Request, res: Response) => {
  try {
    const { userId, limit: lim, offset: off } = req.query;
    const limit = Math.min(parseInt(lim as string, 10) || 50, 200);
    const offset = parseInt(off as string, 10) || 0;
    const conditions = [];
    if (userId) conditions.push(eq(agents.userId, userId as string));
    let q = db.select().from(agents).orderBy(desc(agents.createdAt)).limit(limit).offset(offset);
    if (conditions.length) q = q.where(and(...conditions)) as typeof q;
    const data = await q;
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(agents)
      .where(conditions.length ? and(...conditions) : undefined);
    res.json({ data, total: Number(countResult?.count || 0), limit, offset });
  } catch {
    res.status(500).json({ error: "Failed to list agents" });
  }
});

router.get("/ai-services/agents/:id", async (req: Request, res: Response) => {
  try {
    const [row] = await db.select().from(agents).where(eq(agents.id, req.params.id));
    if (!row) return res.status(404).json({ error: "Agent not found" });
    res.json({ data: row });
  } catch {
    res.status(500).json({ error: "Failed to fetch agent" });
  }
});

const AGENT_PATCH_KEYS = new Set([
  "name",
  "voiceTone",
  "personality",
  "systemPrompt",
  "language",
  "firstMessage",
  "llmModel",
  "temperature",
  "telephonyProvider",
  "transferEnabled",
  "transferPhoneNumber",
  "openaiVoice",
]);

router.patch("/ai-services/agents/:id", async (req: Request, res: Response) => {
  try {
    const [existing] = await db.select().from(agents).where(eq(agents.id, req.params.id));
    if (!existing) return res.status(404).json({ error: "Agent not found" });
    const updates: Record<string, unknown> = {};
    for (const k of Object.keys(req.body || {})) {
      if (AGENT_PATCH_KEYS.has(k)) updates[k] = req.body[k];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No configurable fields in body" });
    }
    updates.updatedAt = new Date();
    await db.update(agents).set(updates as any).where(eq(agents.id, req.params.id));
    const [row] = await db.select().from(agents).where(eq(agents.id, req.params.id));
    res.json({ data: row });
  } catch {
    res.status(500).json({ error: "Failed to update agent" });
  }
});

// Billing — stable aliases
router.get("/billing/credits/ledger", async (req: Request, res: Response) => {
  try {
    const { userId, limit: lim, offset: off } = req.query;
    const conditions = [];
    if (userId) conditions.push(eq(creditTransactions.userId, userId as string));
    const limit = Math.min(parseInt(lim as string, 10) || 50, 200);
    const offset = parseInt(off as string, 10) || 0;
    let q = db
      .select()
      .from(creditTransactions)
      .orderBy(desc(creditTransactions.createdAt))
      .limit(limit)
      .offset(offset);
    if (conditions.length) q = q.where(and(...conditions)) as typeof q;
    const data = await q;
    res.json({ data, limit, offset });
  } catch {
    res.status(500).json({ error: "Failed to fetch credit ledger" });
  }
});

router.get("/billing/credits/balance", async (req: Request, res: Response) => {
  try {
    const userId = String(req.query.userId || "");
    if (!userId) return res.status(400).json({ error: "userId is required" });
    const [u] = await db.select({ id: users.id, credits: users.credits }).from(users).where(eq(users.id, userId));
    if (!u) return res.status(404).json({ error: "User not found" });
    res.json({ data: { userId: u.id, credits: Number(u.credits || 0) } });
  } catch {
    res.status(500).json({ error: "Failed to fetch balance" });
  }
});

router.get("/billing/invoices", async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string | undefined;
    let rows = await storage.getAllInvoices();
    if (userId) rows = rows.filter((i) => i.userId === userId);
    res.json({ data: rows, total: rows.length });
  } catch {
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

router.get("/billing/payments", async (req: Request, res: Response) => {
  try {
    const { status, limit: lim, offset: off } = req.query;
    const conditions = [];
    if (status) conditions.push(eq(paymentTransactions.status, status as string));
    const limit = Math.min(parseInt(lim as string, 10) || 50, 200);
    const offset = parseInt(off as string, 10) || 0;
    let q = db
      .select()
      .from(paymentTransactions)
      .orderBy(desc(paymentTransactions.createdAt))
      .limit(limit)
      .offset(offset);
    if (conditions.length) q = q.where(and(...conditions)) as typeof q;
    const data = await q;
    res.json({ data, limit, offset });
  } catch {
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

// Content
router.get("/content/notifications", async (req: Request, res: Response) => {
  try {
    const { userId, limit: lim, offset: off } = req.query;
    const limit = Math.min(parseInt(lim as string, 10) || 50, 200);
    const offset = parseInt(off as string, 10) || 0;
    const conditions = [];
    if (userId) conditions.push(eq(notifications.userId, userId as string));
    let q = db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(limit).offset(offset);
    if (conditions.length) q = q.where(and(...conditions)) as typeof q;
    const data = await q;
    res.json({ data, limit, offset });
  } catch {
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

router.post("/content/notifications/broadcast", async (req: Request, res: Response) => {
  try {
    const {
      title,
      message,
      link,
      type = "system",
      icon,
      displayType = "bell",
      priority = 0,
      dismissible = true,
      expiresAt,
    } = req.body || {};
    if (!title || !message) return res.status(400).json({ error: "Title and message are required" });
    let parsedExpiresAt: Date | null = null;
    if (expiresAt) {
      parsedExpiresAt = new Date(expiresAt);
      if (isNaN(parsedExpiresAt.getTime())) return res.status(400).json({ error: "expiresAt must be a valid date" });
    }
    const allUsers = await storage.getAllUsers();
    await Promise.all(
      allUsers.map((u) =>
        storage.createNotification({
          userId: u.id,
          type,
          title,
          message,
          link: link || null,
          icon: icon || null,
          displayType,
          priority,
          dismissible,
          expiresAt: parsedExpiresAt,
        }),
      ),
    );
    res.json({
      success: true,
      recipientCount: allUsers.length,
      message: `Broadcast sent to ${allUsers.length} users`,
    });
  } catch {
    res.status(500).json({ error: "Failed to send broadcast" });
  }
});

router.get("/content/articles", async (req: Request, res: Response) => {
  try {
    const { limit: lim, offset: off } = req.query;
    const limit = Math.min(parseInt(lim as string, 10) || 50, 200);
    const offset = parseInt(off as string, 10) || 0;
    const data = await db
      .select()
      .from(generatedArticles)
      .orderBy(desc(generatedArticles.createdAt))
      .limit(limit)
      .offset(offset);
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(generatedArticles);
    res.json({ data, total: Number(countResult?.count || 0), limit, offset });
  } catch {
    res.status(500).json({ error: "Failed to fetch articles" });
  }
});

// Configure / Settings — single global key/value store
router.get("/configure/settings", async (_req: Request, res: Response) => {
  try {
    const settings = await db.select().from(globalSettings).orderBy(globalSettings.key);
    res.json({ data: settings, store: "globalSettings" as const });
  } catch {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.patch("/configure/settings", async (req: Request, res: Response) => {
  try {
    const list = req.body?.settings;
    if (!Array.isArray(list)) return res.status(400).json({ error: "settings must be an array of {key,value}" });
    for (const s of list) {
      if (s?.key != null) await storage.updateGlobalSetting(String(s.key), s.value);
    }
    res.json({ success: true, updated: list.length });
  } catch {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

router.get("/settings/flags", (_req: Request, res: Response) => {
  res.redirect(307, "/api/admin/configure/settings");
});

// System
router.get("/system/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

router.get("/system/version", (_req: Request, res: Response) => {
  try {
    const p = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../package.json");
    const pkg = JSON.parse(fs.readFileSync(p, "utf-8")) as { version?: string };
    res.json({ version: pkg.version || "0.0.0" });
  } catch {
    res.json({ version: "0.0.0" });
  }
});

router.get("/system/audit-logs", async (req: Request, res: Response) => {
  try {
    const { userId, limit: lim, offset: off } = req.query;
    const conditions = [];
    if (userId) conditions.push(eq(auditLogs.userId, userId as string));
    const limit = Math.min(parseInt(lim as string, 10) || 50, 200);
    const offset = parseInt(off as string, 10) || 0;
    let q = db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit).offset(offset);
    if (conditions.length) q = q.where(and(...conditions)) as typeof q;
    const data = await q;
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(conditions.length ? and(...conditions) : undefined);
    res.json({ data, total: Number(countResult?.count || 0), limit, offset });
  } catch {
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

router.get("/system/api-audit-logs", async (req: Request, res: Response) => {
  try {
    const { userId, limit: lim, offset: off } = req.query;
    const conditions = [];
    if (userId) conditions.push(eq(apiAuditLogs.userId, userId as string));
    const limit = Math.min(parseInt(lim as string, 10) || 50, 200);
    const offset = parseInt(off as string, 10) || 0;
    let q = db.select().from(apiAuditLogs).orderBy(desc(apiAuditLogs.createdAt)).limit(limit).offset(offset);
    if (conditions.length) q = q.where(and(...conditions)) as typeof q;
    const data = await q;
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(apiAuditLogs)
      .where(conditions.length ? and(...conditions) : undefined);
    res.json({ data, total: Number(countResult?.count || 0), limit, offset });
  } catch {
    res.status(500).json({ error: "Failed to fetch API audit logs" });
  }
});

// Marketplace
router.get("/marketplace/integrations", (_req: Request, res: Response) => {
  res.redirect(307, "/api/admin/integrations");
});

router.get("/marketplace/integrations/:id", async (req: Request, res: Response) => {
  try {
    const [app] = await db.select().from(integrationApps).where(eq(integrationApps.id, req.params.id));
    if (!app) return res.status(404).json({ error: "Integration not found" });
    res.json({ data: app });
  } catch {
    res.status(500).json({ error: "Failed to fetch integration" });
  }
});

router.delete("/marketplace/user-integrations/:id", async (req: Request, res: Response) => {
  try {
    const [row] = await db.select().from(userIntegrations).where(eq(userIntegrations.id, req.params.id));
    if (!row) return res.status(404).json({ error: "User integration not found" });
    await db.delete(userIntegrations).where(eq(userIntegrations.id, req.params.id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to remove user integration" });
  }
});

router.get("/marketplace/plugins", (_req: Request, res: Response) => {
  res.redirect(307, "/api/admin/plugins");
});

// Calling — redirect to call-intelligence API (same auth headers forwarded by client)
router.get("/calling/call-intelligence/stats", (req: Request, res: Response) => {
  res.redirect(307, `${forwardedOrigin(req)}/api/call-intelligence/stats`);
});

router.get("/calling/call-intelligence/insights", (req: Request, res: Response) => {
  res.redirect(307, `${forwardedOrigin(req)}/api/call-intelligence/insights`);
});

router.get("/calls/:id/recording/fetch", async (req: Request, res: Response) => {
  try {
    const [call] = await db
      .select({ id: calls.id, recordingUrl: calls.recordingUrl })
      .from(calls)
      .where(eq(calls.id, req.params.id));
    if (!call) return res.status(404).json({ error: "Call not found" });
    if (!call.recordingUrl) return res.status(404).json({ error: "Recording not available" });
    res.redirect(302, String(call.recordingUrl));
  } catch {
    res.status(500).json({ error: "Failed to resolve recording" });
  }
});

export default router;
