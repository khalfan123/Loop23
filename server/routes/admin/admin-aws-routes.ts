import { Router, Request, Response } from "express";
import { db } from "../../db";
import { awsCredentials } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { awsBedrockService } from "../../services/aws-bedrock";

const router = Router();

router.get("/aws/status", async (_req: Request, res: Response) => {
  try {
    const credentials = await db.select().from(awsCredentials);
    const active = credentials.filter(c => c.isActive);
    const pollyEnabled = credentials.filter(c => c.isActive && c.enabledServices?.polly);
    const bedrockEnabled = credentials.filter(c => c.isActive && c.enabledServices?.bedrock);
    res.json({
      totalCredentials: credentials.length,
      activeCredentials: active.length,
      pollyEnabled: pollyEnabled.length,
      bedrockEnabled: bedrockEnabled.length,
      status: active.length > 0 ? "configured" : "not_configured",
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch AWS status" });
  }
});

router.get("/aws/polly/voices", async (_req: Request, res: Response) => {
  try {
    const pollyVoices = [
      { id: "Joanna", name: "Joanna", language: "en-US", gender: "Female", engine: "neural" },
      { id: "Matthew", name: "Matthew", language: "en-US", gender: "Male", engine: "neural" },
      { id: "Amy", name: "Amy", language: "en-GB", gender: "Female", engine: "neural" },
      { id: "Brian", name: "Brian", language: "en-GB", gender: "Male", engine: "neural" },
      { id: "Lupe", name: "Lupe", language: "es-US", gender: "Female", engine: "neural" },
      { id: "Pedro", name: "Pedro", language: "es-US", gender: "Male", engine: "neural" },
      { id: "Léa", name: "Léa", language: "fr-FR", gender: "Female", engine: "neural" },
      { id: "Rémi", name: "Rémi", language: "fr-FR", gender: "Male", engine: "neural" },
      { id: "Vicki", name: "Vicki", language: "de-DE", gender: "Female", engine: "neural" },
      { id: "Daniel", name: "Daniel", language: "de-DE", gender: "Male", engine: "neural" },
      { id: "Bianca", name: "Bianca", language: "it-IT", gender: "Female", engine: "neural" },
      { id: "Adriano", name: "Adriano", language: "it-IT", gender: "Male", engine: "neural" },
      { id: "Vitória", name: "Vitória", language: "pt-BR", gender: "Female", engine: "neural" },
      { id: "Thiago", name: "Thiago", language: "pt-BR", gender: "Male", engine: "neural" },
      { id: "Kajal", name: "Kajal", language: "hi-IN", gender: "Female", engine: "neural" },
      { id: "Takumi", name: "Takumi", language: "ja-JP", gender: "Male", engine: "neural" },
      { id: "Seoyeon", name: "Seoyeon", language: "ko-KR", gender: "Female", engine: "neural" },
      { id: "Zhiyu", name: "Zhiyu", language: "cmn-CN", gender: "Female", engine: "neural" },
      { id: "Hala", name: "Hala", language: "ar-AE", gender: "Female", engine: "neural" },
      { id: "Zayd", name: "Zayd", language: "ar-AE", gender: "Male", engine: "neural" },
    ];

    const activePollyCredentials = await db.select().from(awsCredentials)
      .where(eq(awsCredentials.isActive, true));
    const pollyConfigured = activePollyCredentials.some(c => c.enabledServices?.polly);

    res.json({
      voices: pollyVoices,
      totalVoices: pollyVoices.length,
      credentialsConfigured: pollyConfigured,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch Polly voices" });
  }
});

router.get("/aws/bedrock/models", async (_req: Request, res: Response) => {
  try {
    // Source the model list from the central alias resolver so that the admin
    // picker only ever shows ids that actually work in the configured region.
    const bedrockModels = awsBedrockService.listModels().map((m) => ({
      id: m.alias,
      modelId: m.id,
      name: m.alias,
      provider: m.provider,
      category: "text",
      tier: m.tier,
      contextWindow: m.contextWindow,
    }));

    const activeBedrockCredentials = await db.select().from(awsCredentials)
      .where(eq(awsCredentials.isActive, true));
    const bedrockConfigured = activeBedrockCredentials.some(c => c.enabledServices?.bedrock);

    res.json({
      models: bedrockModels,
      totalModels: bedrockModels.length,
      credentialsConfigured: bedrockConfigured,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch Bedrock models" });
  }
});

router.get("/aws/credentials", async (_req: Request, res: Response) => {
  try {
    const credentials = await db.select().from(awsCredentials).orderBy(desc(awsCredentials.createdAt));
    const sanitized = credentials.map(c => ({
      ...c,
      secretAccessKey: "********",
    }));
    res.json(sanitized);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch AWS credentials" });
  }
});

router.post("/aws/credentials", async (req: Request, res: Response) => {
  try {
    const { name, accessKeyId, secretAccessKey, region, enabledServices, pollyVoiceEngine, bedrockDefaultModel } = req.body;
    if (!name || !accessKeyId || !secretAccessKey) {
      return res.status(400).json({ error: "name, accessKeyId, and secretAccessKey are required" });
    }
    const [credential] = await db.insert(awsCredentials).values({
      name,
      accessKeyId,
      secretAccessKey,
      region: region || "us-east-1",
      enabledServices: enabledServices || { polly: true, bedrock: true },
      pollyVoiceEngine: pollyVoiceEngine || "neural",
      bedrockDefaultModel: bedrockDefaultModel || "claude-sonnet-4-6",
    }).returning();
    res.status(201).json({ ...credential, secretAccessKey: "********" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create AWS credential" });
  }
});

router.patch("/aws/credentials/:id", async (req: Request, res: Response) => {
  try {
    const [existing] = await db.select().from(awsCredentials).where(eq(awsCredentials.id, req.params.id));
    if (!existing) return res.status(404).json({ error: "Credential not found" });
    const updates: any = { updatedAt: new Date() };
    const fields = ["name", "accessKeyId", "region", "isActive", "isPrimary", "enabledServices", "pollyVoiceEngine", "bedrockDefaultModel", "maxConcurrency"];
    for (const f of fields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }
    if (req.body.secretAccessKey) updates.secretAccessKey = req.body.secretAccessKey;
    await db.update(awsCredentials).set(updates).where(eq(awsCredentials.id, req.params.id));
    const [updated] = await db.select().from(awsCredentials).where(eq(awsCredentials.id, req.params.id));
    res.json({ ...updated, secretAccessKey: "********" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update AWS credential" });
  }
});

router.delete("/aws/credentials/:id", async (req: Request, res: Response) => {
  try {
    const [existing] = await db.select().from(awsCredentials).where(eq(awsCredentials.id, req.params.id));
    if (!existing) return res.status(404).json({ error: "Credential not found" });
    await db.delete(awsCredentials).where(eq(awsCredentials.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete AWS credential" });
  }
});

router.post("/aws/credentials/:id/test", async (req: Request, res: Response) => {
  try {
    const [credential] = await db.select().from(awsCredentials).where(eq(awsCredentials.id, req.params.id));
    if (!credential) return res.status(404).json({ error: "Credential not found" });
    try {
      const { STSClient, GetCallerIdentityCommand } = await import("@aws-sdk/client-sts");
      const client = new STSClient({
        region: credential.region || "us-east-1",
        credentials: {
          accessKeyId: credential.accessKeyId,
          secretAccessKey: credential.secretAccessKey,
        },
      });
      await client.send(new GetCallerIdentityCommand({}));
      await db.update(awsCredentials).set({ healthStatus: "healthy", lastHealthCheck: new Date() }).where(eq(awsCredentials.id, req.params.id));
      res.json({ success: true, status: "healthy" });
    } catch (e: any) {
      await db.update(awsCredentials).set({ healthStatus: "unhealthy", lastHealthCheck: new Date() }).where(eq(awsCredentials.id, req.params.id));
      res.json({ success: false, status: "unhealthy", error: e.message });
    }
  } catch (error: any) {
    res.status(500).json({ error: "Failed to test credential" });
  }
});

export default router;
