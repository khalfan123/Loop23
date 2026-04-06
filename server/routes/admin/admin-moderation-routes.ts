import { Router, Request, Response } from "express";
import { db } from "../../db";
import { bannedWords, contentViolations, calls } from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";

const router = Router();

router.get("/banned-words", async (_req: Request, res: Response) => {
  try {
    const words = await db.select().from(bannedWords).orderBy(desc(bannedWords.createdAt));
    res.json(words);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch banned words" });
  }
});

router.post("/banned-words", async (req: Request, res: Response) => {
  try {
    const { word, category, severity, autoBlock } = req.body;
    if (!word) return res.status(400).json({ error: "word is required" });
    const [created] = await db.insert(bannedWords).values({
      word,
      category: category || "general",
      severity: severity || "medium",
      autoBlock: autoBlock || false,
    }).returning();
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create banned word" });
  }
});

router.patch("/banned-words/:id", async (req: Request, res: Response) => {
  try {
    const [existing] = await db.select().from(bannedWords).where(eq(bannedWords.id, req.params.id));
    if (!existing) return res.status(404).json({ error: "Banned word not found" });
    const { word, category, severity, isActive, autoBlock } = req.body;
    const updates: any = { updatedAt: new Date() };
    if (word !== undefined) updates.word = word;
    if (category !== undefined) updates.category = category;
    if (severity !== undefined) updates.severity = severity;
    if (isActive !== undefined) updates.isActive = isActive;
    if (autoBlock !== undefined) updates.autoBlock = autoBlock;
    await db.update(bannedWords).set(updates).where(eq(bannedWords.id, req.params.id));
    const [updated] = await db.select().from(bannedWords).where(eq(bannedWords.id, req.params.id));
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update banned word" });
  }
});

router.delete("/banned-words/:id", async (req: Request, res: Response) => {
  try {
    const [existing] = await db.select().from(bannedWords).where(eq(bannedWords.id, req.params.id));
    if (!existing) return res.status(404).json({ error: "Banned word not found" });
    await db.delete(bannedWords).where(eq(bannedWords.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete banned word" });
  }
});

router.post("/banned-words/scan-all-calls", async (_req: Request, res: Response) => {
  try {
    const activeBannedWords = await db.select().from(bannedWords).where(eq(bannedWords.isActive, true));
    if (activeBannedWords.length === 0) return res.json({ scanned: 0, violations: 0, message: "No active banned words" });

    const allCalls = await db.select({ id: calls.id, transcript: calls.transcript, userId: calls.userId })
      .from(calls)
      .where(sql`${calls.transcript} IS NOT NULL AND ${calls.transcript} != ''`)
      .limit(1000);

    let totalViolations = 0;
    for (const call of allCalls) {
      if (!call.transcript) continue;
      const transcript = call.transcript.toLowerCase();
      for (const bw of activeBannedWords) {
        if (transcript.includes(bw.word.toLowerCase())) {
          const idx = transcript.indexOf(bw.word.toLowerCase());
          const contextStart = Math.max(0, idx - 50);
          const contextEnd = Math.min(transcript.length, idx + bw.word.length + 50);
          await db.insert(contentViolations).values({
            callId: call.id,
            userId: call.userId || "",
            bannedWordId: bw.id,
            detectedWord: bw.word,
            context: call.transcript!.substring(contextStart, contextEnd),
            severity: bw.severity,
            status: "pending",
          });
          totalViolations++;
        }
      }
    }
    res.json({ scanned: allCalls.length, violations: totalViolations });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to scan calls" });
  }
});

router.get("/violations", async (req: Request, res: Response) => {
  try {
    const { status, severity, limit: lim, offset: off } = req.query;
    const conditions: any[] = [];
    if (status) conditions.push(eq(contentViolations.status, status as string));
    if (severity) conditions.push(eq(contentViolations.severity, severity as string));
    const limit = Math.min(parseInt(lim as string) || 50, 200);
    const offset = parseInt(off as string) || 0;
    let query = db.select().from(contentViolations).orderBy(desc(contentViolations.createdAt)).limit(limit).offset(offset);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    const results = await query;
    res.json({ data: results, limit, offset });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch violations" });
  }
});

router.patch("/violations/:id/review", async (req: Request, res: Response) => {
  try {
    const [violation] = await db.select().from(contentViolations).where(eq(contentViolations.id, req.params.id));
    if (!violation) return res.status(404).json({ error: "Violation not found" });
    const { status, actionTaken, notes } = req.body;
    await db.update(contentViolations).set({
      status: status || "reviewed",
      actionTaken: actionTaken || null,
      notes: notes || null,
      reviewedAt: new Date(),
      reviewedBy: "admin",
    }).where(eq(contentViolations.id, req.params.id));
    const [updated] = await db.select().from(contentViolations).where(eq(contentViolations.id, req.params.id));
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to review violation" });
  }
});

router.get("/moderation/reports", async (req: Request, res: Response) => {
  try {
    const { status, severity, limit: lim, offset: off } = req.query;
    const conditions: any[] = [];
    if (status) conditions.push(eq(contentViolations.status, status as string));
    if (severity) conditions.push(eq(contentViolations.severity, severity as string));
    const limit = Math.min(parseInt(lim as string) || 50, 200);
    const offset = parseInt(off as string) || 0;
    let query = db.select().from(contentViolations).orderBy(desc(contentViolations.createdAt)).limit(limit).offset(offset);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    const results = await query;
    res.json({ data: results, limit, offset });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch moderation reports" });
  }
});

router.get("/moderation/flagged", async (req: Request, res: Response) => {
  try {
    const { limit: lim, offset: off } = req.query;
    const limit = Math.min(parseInt(lim as string) || 50, 200);
    const offset = parseInt(off as string) || 0;
    const flagged = await db.select().from(contentViolations)
      .where(eq(contentViolations.status, "pending"))
      .orderBy(desc(contentViolations.createdAt))
      .limit(limit).offset(offset);
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(contentViolations)
      .where(eq(contentViolations.status, "pending"));
    res.json({ data: flagged, total: Number(countResult?.count || 0), limit, offset });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch flagged content" });
  }
});

export default router;
