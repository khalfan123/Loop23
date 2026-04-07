import { Router, Request, Response } from "express";
import { db } from "../../db";
import { llmModels } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/llm-models", async (_req: Request, res: Response) => {
  try {
    const models = await db.select().from(llmModels).orderBy(llmModels.sortOrder, llmModels.name);
    res.json(models);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch LLM models" });
  }
});

router.patch("/llm-models/:id", async (req: Request, res: Response) => {
  try {
    const [model] = await db.select().from(llmModels).where(eq(llmModels.id, req.params.id));
    if (!model) return res.status(404).json({ error: "Model not found" });
    const { name, tier, sortOrder } = req.body;
    const updates: any = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (tier !== undefined) updates.tier = tier;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;
    await db.update(llmModels).set(updates).where(eq(llmModels.id, req.params.id));
    const [updated] = await db.select().from(llmModels).where(eq(llmModels.id, req.params.id));
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update model" });
  }
});

router.post("/llm-models/:id/toggle", async (req: Request, res: Response) => {
  try {
    const [model] = await db.select().from(llmModels).where(eq(llmModels.id, req.params.id));
    if (!model) return res.status(404).json({ error: "Model not found" });
    await db.update(llmModels).set({ isActive: !model.isActive, updatedAt: new Date() }).where(eq(llmModels.id, req.params.id));
    res.json({ success: true, isActive: !model.isActive });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to toggle model" });
  }
});

export default router;
