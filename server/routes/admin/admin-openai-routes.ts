import { Router, Request, Response } from "express";
import { db } from "../../db";
import { openaiCredentials, users, agents } from "@shared/schema";
import { eq, sql, desc } from "drizzle-orm";

const router = Router();

function sanitizeOpenaiCred(c: any) {
  const { apiKey, ...safe } = c;
  return { ...safe, apiKey: apiKey ? `${apiKey.substring(0, 8)}...` : null };
}

router.get("/openai/pool", async (_req: Request, res: Response) => {
  try {
    const credentials = await db.select().from(openaiCredentials).orderBy(desc(openaiCredentials.createdAt));
    res.json(credentials.map(sanitizeOpenaiCred));
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch pool" });
  }
});

router.get("/openai/pool/stats", async (_req: Request, res: Response) => {
  try {
    const credentials = await db.select().from(openaiCredentials);
    const totalKeys = credentials.length;
    const activeKeys = credentials.filter(c => c.isActive).length;
    const totalLoad = credentials.reduce((sum, c) => sum + c.currentLoad, 0);
    const totalCapacity = credentials.reduce((sum, c) => sum + c.maxConcurrency, 0);
    res.json({ totalKeys, activeKeys, totalLoad, totalCapacity, utilizationPercent: totalCapacity > 0 ? Math.round((totalLoad / totalCapacity) * 100) : 0 });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch pool stats" });
  }
});

router.post("/openai/pool", async (req: Request, res: Response) => {
  try {
    const { name, apiKey, modelTier, maxConcurrency, maxAgentsThreshold } = req.body;
    if (!name || !apiKey) return res.status(400).json({ error: "name and apiKey are required" });
    const [credential] = await db.insert(openaiCredentials).values({
      name,
      apiKey,
      modelTier: modelTier || "free",
      maxConcurrency: maxConcurrency || 50,
      maxAgentsThreshold: maxAgentsThreshold || 100,
    }).returning();
    res.status(201).json(sanitizeOpenaiCred(credential));
  } catch (error: any) {
    res.status(500).json({ error: "Failed to add credential" });
  }
});

router.put("/openai/pool/:id", async (req: Request, res: Response) => {
  try {
    const [existing] = await db.select().from(openaiCredentials).where(eq(openaiCredentials.id, req.params.id));
    if (!existing) return res.status(404).json({ error: "Credential not found" });
    const updates: any = { updatedAt: new Date() };
    const fields = ["name", "apiKey", "modelTier", "maxConcurrency", "maxAgentsThreshold", "isActive"];
    for (const f of fields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }
    await db.update(openaiCredentials).set(updates).where(eq(openaiCredentials.id, req.params.id));
    const [updated] = await db.select().from(openaiCredentials).where(eq(openaiCredentials.id, req.params.id));
    res.json(sanitizeOpenaiCred(updated));
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update credential" });
  }
});

router.post("/openai/pool/:id/test", async (req: Request, res: Response) => {
  try {
    const [credential] = await db.select().from(openaiCredentials).where(eq(openaiCredentials.id, req.params.id));
    if (!credential) return res.status(404).json({ error: "Credential not found" });
    try {
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: { "Authorization": `Bearer ${credential.apiKey}` },
      });
      const status = response.ok ? "healthy" : "unhealthy";
      await db.update(openaiCredentials).set({ healthStatus: status, lastHealthCheck: new Date() }).where(eq(openaiCredentials.id, req.params.id));
      res.json({ success: response.ok, status });
    } catch (e: any) {
      await db.update(openaiCredentials).set({ healthStatus: "unhealthy", lastHealthCheck: new Date() }).where(eq(openaiCredentials.id, req.params.id));
      res.json({ success: false, status: "unhealthy", error: e.message });
    }
  } catch (error: any) {
    res.status(500).json({ error: "Failed to test credential" });
  }
});

router.post("/openai/pool/:id/activate", async (req: Request, res: Response) => {
  try {
    await db.update(openaiCredentials).set({ isActive: true, updatedAt: new Date() }).where(eq(openaiCredentials.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to activate credential" });
  }
});

router.post("/openai/pool/:id/deactivate", async (req: Request, res: Response) => {
  try {
    await db.update(openaiCredentials).set({ isActive: false, updatedAt: new Date() }).where(eq(openaiCredentials.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to deactivate credential" });
  }
});

router.delete("/openai/pool/:id", async (req: Request, res: Response) => {
  try {
    const [credential] = await db.select().from(openaiCredentials).where(eq(openaiCredentials.id, req.params.id));
    if (!credential) return res.status(404).json({ error: "Credential not found" });
    await db.delete(openaiCredentials).where(eq(openaiCredentials.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete credential" });
  }
});

router.post("/openai/pool/:id/migrate-users", async (req: Request, res: Response) => {
  try {
    const { targetCredentialId } = req.body;
    if (!targetCredentialId) return res.status(400).json({ error: "targetCredentialId is required" });
    await db.update(agents).set({ openaiCredentialId: targetCredentialId }).where(eq(agents.openaiCredentialId, req.params.id));
    res.json({ success: true, message: "Users migrated" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to migrate users" });
  }
});

export default router;
