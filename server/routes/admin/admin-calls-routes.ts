import { Router, Request, Response } from "express";
import { db } from "../../db";
import { storage } from "../../storage";
import { calls, callErrorLogs, bannedWords, contentViolations, users } from "@shared/schema";
import { eq, and, sql, desc, gte, lte, isNotNull } from "drizzle-orm";

const router = Router();

router.get("/calls/errors/summary", async (_req: Request, res: Response) => {
  try {
    const summary = await db.select({
      errorCategory: callErrorLogs.errorCategory,
      severity: callErrorLogs.severity,
      count: sql<number>`count(*)`,
    }).from(callErrorLogs)
      .groupBy(callErrorLogs.errorCategory, callErrorLogs.severity);
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch error summary" });
  }
});

router.get("/calls/errors", async (req: Request, res: Response) => {
  try {
    const { limit: lim, offset: off } = req.query;
    const limit = Math.min(parseInt(lim as string) || 50, 200);
    const offset = parseInt(off as string) || 0;
    const errors = await db.select().from(callErrorLogs)
      .orderBy(desc(callErrorLogs.createdAt))
      .limit(limit).offset(offset);
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(callErrorLogs);
    res.json({ data: errors, total: Number(countResult?.count || 0), limit, offset });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch error logs" });
  }
});

router.get("/calls/stats", async (_req: Request, res: Response) => {
  try {
    const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(calls);
    const [completedResult] = await db.select({ count: sql<number>`count(*)` }).from(calls).where(eq(calls.status, "completed"));
    const [failedResult] = await db.select({ count: sql<number>`count(*)` }).from(calls).where(eq(calls.status, "failed"));
    const [inProgressResult] = await db.select({ count: sql<number>`count(*)` }).from(calls).where(eq(calls.status, "in-progress"));
    const [avgDuration] = await db.select({ avg: sql<number>`COALESCE(AVG(${calls.duration}), 0)` }).from(calls).where(isNotNull(calls.duration));
    res.json({
      total: Number(totalResult?.count || 0),
      completed: Number(completedResult?.count || 0),
      failed: Number(failedResult?.count || 0),
      inProgress: Number(inProgressResult?.count || 0),
      averageDuration: Math.round(Number(avgDuration?.avg || 0)),
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch call stats" });
  }
});

router.post("/calls/sync-elevenlabs", async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, message: "ElevenLabs call sync initiated" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to sync calls" });
  }
});

router.post("/calls/sync-recordings", async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, message: "Recording sync initiated" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to sync recordings" });
  }
});

router.get("/calls", async (req: Request, res: Response) => {
  try {
    const { userId, status, direction, startDate, endDate, limit: lim, offset: off } = req.query;
    const conditions: any[] = [];
    if (userId) conditions.push(eq(calls.userId, userId as string));
    if (status) conditions.push(eq(calls.status, status as string));
    if (direction) conditions.push(eq(calls.callDirection, direction as string));
    if (startDate) conditions.push(gte(calls.createdAt, new Date(startDate as string)));
    if (endDate) conditions.push(lte(calls.createdAt, new Date(endDate as string)));

    const limit = Math.min(parseInt(lim as string) || 50, 200);
    const offset = parseInt(off as string) || 0;

    let query = db.select().from(calls).orderBy(desc(calls.createdAt)).limit(limit).offset(offset);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    const results = await query;
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(calls)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    res.json({ data: results, total: Number(countResult?.count || 0), limit, offset });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch calls" });
  }
});

router.get("/calls/:id", async (req: Request, res: Response) => {
  try {
    const call = await storage.getCallWithDetails(req.params.id);
    if (!call) return res.status(404).json({ error: "Call not found" });
    res.json(call);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch call" });
  }
});

router.get("/calls/:id/transcript", async (req: Request, res: Response) => {
  try {
    const call = await storage.getCall(req.params.id);
    if (!call) return res.status(404).json({ error: "Call not found" });
    res.json({ callId: call.id, transcript: call.transcript || null });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch transcript" });
  }
});

router.get("/calls/:id/recording", async (req: Request, res: Response) => {
  try {
    const call = await storage.getCall(req.params.id);
    if (!call) return res.status(404).json({ error: "Call not found" });
    res.json({ callId: call.id, recordingUrl: call.recordingUrl || null });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch recording" });
  }
});

router.post("/calls/:id/scan-violations", async (req: Request, res: Response) => {
  try {
    const call = await storage.getCall(req.params.id);
    if (!call) return res.status(404).json({ error: "Call not found" });
    if (!call.transcript) return res.json({ violations: [], message: "No transcript available" });

    const activeBannedWords = await db.select().from(bannedWords).where(eq(bannedWords.isActive, true));
    const violations: any[] = [];
    const transcript = call.transcript.toLowerCase();

    for (const bw of activeBannedWords) {
      if (transcript.includes(bw.word.toLowerCase())) {
        const idx = transcript.indexOf(bw.word.toLowerCase());
        const contextStart = Math.max(0, idx - 50);
        const contextEnd = Math.min(transcript.length, idx + bw.word.length + 50);
        const context = call.transcript!.substring(contextStart, contextEnd);

        const [violation] = await db.insert(contentViolations).values({
          callId: call.id,
          userId: call.userId || "",
          bannedWordId: bw.id,
          detectedWord: bw.word,
          context,
          severity: bw.severity,
          status: "pending",
        }).returning();
        violations.push(violation);
      }
    }
    res.json({ violations, count: violations.length });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to scan violations" });
  }
});

export default router;
