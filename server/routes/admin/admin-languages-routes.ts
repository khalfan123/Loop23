import { Router, Request, Response } from "express";
import { db } from "../../db";
import { platformLanguages } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/languages", async (_req: Request, res: Response) => {
  try {
    const languages = await db.select().from(platformLanguages).orderBy(platformLanguages.sortOrder, platformLanguages.name);
    res.json(languages);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch languages" });
  }
});

router.post("/languages", async (req: Request, res: Response) => {
  try {
    const { code, name, nativeName, direction, isActive, sortOrder } = req.body;
    if (!code || !name) return res.status(400).json({ error: "code and name are required" });
    const [created] = await db.insert(platformLanguages).values({
      code, name, nativeName: nativeName || name,
      direction: direction || "ltr",
      isActive: isActive !== undefined ? isActive : true,
      sortOrder: sortOrder || 0,
    }).returning();
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create language" });
  }
});

router.patch("/languages/:id", async (req: Request, res: Response) => {
  try {
    const [existing] = await db.select().from(platformLanguages).where(eq(platformLanguages.id, req.params.id));
    if (!existing) return res.status(404).json({ error: "Language not found" });
    const updates: any = { updatedAt: new Date() };
    const fields = ["code", "name", "nativeName", "direction", "isActive", "sortOrder"];
    for (const f of fields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }
    await db.update(platformLanguages).set(updates).where(eq(platformLanguages.id, req.params.id));
    const [updated] = await db.select().from(platformLanguages).where(eq(platformLanguages.id, req.params.id));
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update language" });
  }
});

router.delete("/languages/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(platformLanguages).where(eq(platformLanguages.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete language" });
  }
});

export default router;
