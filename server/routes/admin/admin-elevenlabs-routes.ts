import { Router, Request, Response } from "express";
import { db } from "../../db";
import { elevenLabsCredentials, users, agents, syncedVoices } from "@shared/schema";
import { eq, sql, desc } from "drizzle-orm";

const router = Router();

function sanitizeElevenLabsCred(c: any) {
  const { apiKey, webhookSecret, ...safe } = c;
  return { ...safe, apiKey: apiKey ? `${apiKey.substring(0, 6)}...` : null, webhookSecret: webhookSecret ? "********" : null };
}

router.get("/elevenlabs/pool", async (_req: Request, res: Response) => {
  try {
    const credentials = await db.select().from(elevenLabsCredentials).orderBy(desc(elevenLabsCredentials.createdAt));
    res.json(credentials.map(sanitizeElevenLabsCred));
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch pool" });
  }
});

router.get("/elevenlabs/pool/stats", async (_req: Request, res: Response) => {
  try {
    const credentials = await db.select().from(elevenLabsCredentials);
    const totalKeys = credentials.length;
    const activeKeys = credentials.filter(c => c.isActive).length;
    const totalLoad = credentials.reduce((sum, c) => sum + c.currentLoad, 0);
    const totalCapacity = credentials.reduce((sum, c) => sum + c.maxConcurrency, 0);
    const totalAgents = credentials.reduce((sum, c) => sum + c.totalAssignedAgents, 0);
    const totalUsers = credentials.reduce((sum, c) => sum + c.totalAssignedUsers, 0);
    res.json({ totalKeys, activeKeys, totalLoad, totalCapacity, totalAgents, totalUsers, utilizationPercent: totalCapacity > 0 ? Math.round((totalLoad / totalCapacity) * 100) : 0 });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch pool stats" });
  }
});

router.get("/elevenlabs/pool/retry-queue", async (_req: Request, res: Response) => {
  try {
    res.json({ queue: [], length: 0 });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch retry queue" });
  }
});

router.get("/elevenlabs/pool/voice-status", async (_req: Request, res: Response) => {
  try {
    const voices = await db.select().from(syncedVoices).orderBy(desc(syncedVoices.syncedAt));
    res.json(voices);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch voice status" });
  }
});

router.post("/elevenlabs/pool", async (req: Request, res: Response) => {
  try {
    const { name, apiKey, webhookSecret, maxConcurrency, maxAgentsThreshold } = req.body;
    if (!name || !apiKey) return res.status(400).json({ error: "name and apiKey are required" });
    const [credential] = await db.insert(elevenLabsCredentials).values({
      name,
      apiKey,
      webhookSecret: webhookSecret || null,
      maxConcurrency: maxConcurrency || 30,
      maxAgentsThreshold: maxAgentsThreshold || 100,
    }).returning();
    res.status(201).json(sanitizeElevenLabsCred(credential));
  } catch (error: any) {
    res.status(500).json({ error: "Failed to add credential" });
  }
});

router.post("/elevenlabs/pool/health-check", async (_req: Request, res: Response) => {
  try {
    const credentials = await db.select().from(elevenLabsCredentials);
    const results = [];
    for (const cred of credentials) {
      try {
        const response = await fetch("https://api.elevenlabs.io/v1/user", {
          headers: { "xi-api-key": cred.apiKey },
        });
        const status = response.ok ? "healthy" : "unhealthy";
        await db.update(elevenLabsCredentials).set({ healthStatus: status, lastHealthCheck: new Date() }).where(eq(elevenLabsCredentials.id, cred.id));
        results.push({ id: cred.id, name: cred.name, status });
      } catch {
        await db.update(elevenLabsCredentials).set({ healthStatus: "unhealthy", lastHealthCheck: new Date() }).where(eq(elevenLabsCredentials.id, cred.id));
        results.push({ id: cred.id, name: cred.name, status: "unhealthy" });
      }
    }
    res.json({ results, checked: results.length });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to run health check" });
  }
});

router.post("/elevenlabs/pool/sync-agents", async (_req: Request, res: Response) => {
  try {
    const credentials = await db.select().from(elevenLabsCredentials);
    for (const cred of credentials) {
      const [agentCount] = await db.select({ count: sql<number>`count(*)` }).from(agents)
        .where(eq(agents.elevenLabsCredentialId, cred.id));
      await db.update(elevenLabsCredentials).set({
        totalAssignedAgents: Number(agentCount?.count || 0),
        updatedAt: new Date(),
      }).where(eq(elevenLabsCredentials.id, cred.id));
    }
    res.json({ success: true, message: "Agent counts synced" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to sync agents" });
  }
});

router.post("/elevenlabs/pool/retry-queue/process", async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, processed: 0 });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to process retry queue" });
  }
});

router.post("/elevenlabs/pool/sync-voices", async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, message: "Voice sync initiated" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to sync voices" });
  }
});

router.put("/elevenlabs/pool/:id", async (req: Request, res: Response) => {
  try {
    const [existing] = await db.select().from(elevenLabsCredentials).where(eq(elevenLabsCredentials.id, req.params.id));
    if (!existing) return res.status(404).json({ error: "Credential not found" });
    const updates: any = { updatedAt: new Date() };
    const fields = ["name", "apiKey", "webhookSecret", "maxConcurrency", "maxAgentsThreshold", "isActive"];
    for (const f of fields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }
    await db.update(elevenLabsCredentials).set(updates).where(eq(elevenLabsCredentials.id, req.params.id));
    const [updated] = await db.select().from(elevenLabsCredentials).where(eq(elevenLabsCredentials.id, req.params.id));
    res.json(sanitizeElevenLabsCred(updated));
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update credential" });
  }
});

router.post("/elevenlabs/pool/:id/test", async (req: Request, res: Response) => {
  try {
    const [credential] = await db.select().from(elevenLabsCredentials).where(eq(elevenLabsCredentials.id, req.params.id));
    if (!credential) return res.status(404).json({ error: "Credential not found" });
    try {
      const response = await fetch("https://api.elevenlabs.io/v1/user", {
        headers: { "xi-api-key": credential.apiKey },
      });
      const data = await response.json();
      if (response.ok) {
        await db.update(elevenLabsCredentials).set({ healthStatus: "healthy", lastHealthCheck: new Date() }).where(eq(elevenLabsCredentials.id, req.params.id));
        res.json({ success: true, status: "healthy", user: data });
      } else {
        await db.update(elevenLabsCredentials).set({ healthStatus: "unhealthy", lastHealthCheck: new Date() }).where(eq(elevenLabsCredentials.id, req.params.id));
        res.json({ success: false, status: "unhealthy", error: data });
      }
    } catch (e: any) {
      await db.update(elevenLabsCredentials).set({ healthStatus: "unhealthy", lastHealthCheck: new Date() }).where(eq(elevenLabsCredentials.id, req.params.id));
      res.json({ success: false, status: "unhealthy", error: e.message });
    }
  } catch (error: any) {
    res.status(500).json({ error: "Failed to test credential" });
  }
});

router.post("/elevenlabs/pool/:id/activate", async (req: Request, res: Response) => {
  try {
    await db.update(elevenLabsCredentials).set({ isActive: true, updatedAt: new Date() }).where(eq(elevenLabsCredentials.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to activate credential" });
  }
});

router.post("/elevenlabs/pool/:id/deactivate", async (req: Request, res: Response) => {
  try {
    await db.update(elevenLabsCredentials).set({ isActive: false, updatedAt: new Date() }).where(eq(elevenLabsCredentials.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to deactivate credential" });
  }
});

router.delete("/elevenlabs/pool/:id", async (req: Request, res: Response) => {
  try {
    const [credential] = await db.select().from(elevenLabsCredentials).where(eq(elevenLabsCredentials.id, req.params.id));
    if (!credential) return res.status(404).json({ error: "Credential not found" });
    if (credential.totalAssignedUsers > 0) {
      return res.status(400).json({ error: "Cannot delete credential with assigned users. Migrate users first." });
    }
    await db.delete(elevenLabsCredentials).where(eq(elevenLabsCredentials.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete credential" });
  }
});

router.get("/elevenlabs/pool/:id/users", async (req: Request, res: Response) => {
  try {
    const assignedUsers = await db.select({
      id: users.id, name: users.name, email: users.email,
    }).from(users).where(eq(users.elevenLabsCredentialId, req.params.id));
    res.json(assignedUsers);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.post("/elevenlabs/pool/:id/set-threshold", async (req: Request, res: Response) => {
  try {
    const { maxAgentsThreshold } = req.body;
    if (typeof maxAgentsThreshold !== "number") return res.status(400).json({ error: "maxAgentsThreshold must be a number" });
    await db.update(elevenLabsCredentials).set({ maxAgentsThreshold, updatedAt: new Date() }).where(eq(elevenLabsCredentials.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to set threshold" });
  }
});

router.post("/elevenlabs/pool/:id/migrate-users", async (req: Request, res: Response) => {
  try {
    const { targetCredentialId } = req.body;
    if (!targetCredentialId) return res.status(400).json({ error: "targetCredentialId is required" });
    const [source] = await db.select().from(elevenLabsCredentials).where(eq(elevenLabsCredentials.id, req.params.id));
    const [target] = await db.select().from(elevenLabsCredentials).where(eq(elevenLabsCredentials.id, targetCredentialId));
    if (!source || !target) return res.status(404).json({ error: "Source or target credential not found" });
    const result = await db.update(users).set({ elevenLabsCredentialId: targetCredentialId }).where(eq(users.elevenLabsCredentialId, req.params.id));
    await db.update(agents).set({ elevenLabsCredentialId: targetCredentialId }).where(eq(agents.elevenLabsCredentialId, req.params.id));
    res.json({ success: true, message: "Users and agents migrated" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to migrate users" });
  }
});

export default router;
