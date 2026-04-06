import { Router, Request, Response } from "express";
import { db } from "../../db";
import { integrationApps, userIntegrations, integrationSyncLogs, apiKeys, apiAuditLogs, users } from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";

const router = Router();

router.get("/integrations", async (_req: Request, res: Response) => {
  try {
    const apps = await db.select().from(integrationApps).orderBy(integrationApps.name);
    res.json(apps);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch integrations" });
  }
});

router.get("/integrations/apps", async (_req: Request, res: Response) => {
  try {
    const apps = await db.select().from(integrationApps).orderBy(integrationApps.name);
    res.json(apps);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch integration apps" });
  }
});

router.post("/integrations/apps", async (req: Request, res: Response) => {
  try {
    const { name, slug, description, category, logoUrl, n8nNodeType, isPopular, isActive } = req.body;
    if (!name || !slug || !n8nNodeType) return res.status(400).json({ error: "name, slug, and n8nNodeType are required" });
    const [created] = await db.insert(integrationApps).values({
      name, slug, description, category, logoUrl, n8nNodeType,
      isPopular: isPopular || false,
      isActive: isActive !== undefined ? isActive : true,
    }).returning();
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create integration app" });
  }
});

router.patch("/integrations/apps/:id", async (req: Request, res: Response) => {
  try {
    const [existing] = await db.select().from(integrationApps).where(eq(integrationApps.id, req.params.id));
    if (!existing) return res.status(404).json({ error: "Integration app not found" });
    const updates: any = {};
    const fields = ["name", "slug", "description", "category", "logoUrl", "n8nNodeType", "isPopular", "isActive"];
    for (const f of fields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }
    await db.update(integrationApps).set(updates).where(eq(integrationApps.id, req.params.id));
    const [updated] = await db.select().from(integrationApps).where(eq(integrationApps.id, req.params.id));
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update integration app" });
  }
});

router.delete("/integrations/apps/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(integrationApps).where(eq(integrationApps.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete integration app" });
  }
});

router.get("/integrations/user-integrations", async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    const conditions: any[] = [];
    if (userId) conditions.push(eq(userIntegrations.userId, userId as string));
    let query = db.select().from(userIntegrations).orderBy(desc(userIntegrations.createdAt));
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    const results = await query;
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch user integrations" });
  }
});

router.get("/integrations/sync-logs", async (req: Request, res: Response) => {
  try {
    const { integrationId, limit: lim } = req.query;
    const limit = Math.min(parseInt(lim as string) || 50, 200);
    const conditions: any[] = [];
    if (integrationId) conditions.push(eq(integrationSyncLogs.integrationId, integrationId as string));
    let query = db.select().from(integrationSyncLogs).orderBy(desc(integrationSyncLogs.createdAt)).limit(limit);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    const results = await query;
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch sync logs" });
  }
});

router.get("/api-keys", async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    const conditions: any[] = [];
    if (userId) conditions.push(eq(apiKeys.userId, userId as string));
    let query = db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    const results = await query;
    const sanitized = results.map(k => ({ ...k, hashedSecret: "********" }));
    res.json(sanitized);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch API keys" });
  }
});

router.post("/api-keys/:id/revoke", async (req: Request, res: Response) => {
  try {
    const [key] = await db.select().from(apiKeys).where(eq(apiKeys.id, req.params.id));
    if (!key) return res.status(404).json({ error: "API key not found" });
    await db.update(apiKeys).set({ isActive: false, updatedAt: new Date() }).where(eq(apiKeys.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to revoke API key" });
  }
});

router.get("/api-audit-logs", async (req: Request, res: Response) => {
  try {
    const { userId, limit: lim, offset: off } = req.query;
    const conditions: any[] = [];
    if (userId) conditions.push(eq(apiAuditLogs.userId, userId as string));
    const limit = Math.min(parseInt(lim as string) || 50, 200);
    const offset = parseInt(off as string) || 0;
    let query = db.select().from(apiAuditLogs).orderBy(desc(apiAuditLogs.createdAt)).limit(limit).offset(offset);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    const results = await query;
    res.json({ data: results, limit, offset });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

router.post("/integrations/:type/test", async (req: Request, res: Response) => {
  try {
    const integrationType = req.params.type;
    const [app] = await db.select().from(integrationApps)
      .where(eq(integrationApps.slug, integrationType));
    if (!app) return res.status(404).json({ error: `Integration type '${integrationType}' not found` });
    res.json({ success: true, integration: integrationType, message: `Integration ${app.name} is configured and active: ${app.isActive}` });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to test integration" });
  }
});

export default router;
