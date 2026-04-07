import { Router, Request, Response } from "express";
import { db } from "../../db";
import { storage } from "../../storage";
import { promptTemplates } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/prompt-templates", async (_req: Request, res: Response) => {
  try {
    const templates = await db.select().from(promptTemplates).orderBy(desc(promptTemplates.createdAt));
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

router.post("/prompt-templates", async (req: Request, res: Response) => {
  try {
    const { name, description, category, systemPrompt, firstMessage, variables, tags, isSystemTemplate, isPublic, suggestedVoiceTone, suggestedPersonality, suggestedTemperature, suggestedLlmModel, suggestedVoice } = req.body;
    if (!name || !systemPrompt) return res.status(400).json({ error: "name and systemPrompt are required" });
    const [created] = await db.insert(promptTemplates).values({
      name,
      description: description || null,
      category: category || "general",
      systemPrompt,
      firstMessage: firstMessage || null,
      variables: variables || null,
      tags: tags || null,
      isSystemTemplate: isSystemTemplate || false,
      isPublic: isPublic || false,
      suggestedVoiceTone: suggestedVoiceTone || null,
      suggestedPersonality: suggestedPersonality || null,
      suggestedTemperature: suggestedTemperature || null,
      suggestedLlmModel: suggestedLlmModel || null,
      suggestedVoice: suggestedVoice || null,
      userId: null,
    }).returning();
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create template" });
  }
});

router.patch("/prompt-templates/:id", async (req: Request, res: Response) => {
  try {
    const [existing] = await db.select().from(promptTemplates).where(eq(promptTemplates.id, req.params.id));
    if (!existing) return res.status(404).json({ error: "Template not found" });
    const updates: any = { updatedAt: new Date() };
    const fields = ["name", "description", "category", "systemPrompt", "firstMessage", "variables", "tags", "isSystemTemplate", "isPublic", "suggestedVoiceTone", "suggestedPersonality", "suggestedTemperature", "suggestedLlmModel", "suggestedVoice"];
    for (const f of fields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }
    await db.update(promptTemplates).set(updates).where(eq(promptTemplates.id, req.params.id));
    const [updated] = await db.select().from(promptTemplates).where(eq(promptTemplates.id, req.params.id));
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update template" });
  }
});

router.delete("/prompt-templates/:id", async (req: Request, res: Response) => {
  try {
    const [existing] = await db.select().from(promptTemplates).where(eq(promptTemplates.id, req.params.id));
    if (!existing) return res.status(404).json({ error: "Template not found" });
    await db.delete(promptTemplates).where(eq(promptTemplates.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete template" });
  }
});

export default router;
