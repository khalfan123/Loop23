import { Router, Request, Response } from "express";
import { db } from "../../db";
import { storage } from "../../storage";
import { campaigns, contacts, calls, campaignJobs } from "@shared/schema";
import { eq, and, sql, desc, isNull } from "drizzle-orm";

const router = Router();

router.get("/campaigns", async (req: Request, res: Response) => {
  try {
    const { status, userId, limit: lim, offset: off } = req.query;
    const conditions: any[] = [isNull(campaigns.deletedAt)];
    if (status) conditions.push(eq(campaigns.status, status as string));
    if (userId) conditions.push(eq(campaigns.userId, userId as string));
    const limit = Math.min(parseInt(lim as string) || 50, 200);
    const offset = parseInt(off as string) || 0;
    const results = await db.select().from(campaigns)
      .where(and(...conditions))
      .orderBy(desc(campaigns.createdAt))
      .limit(limit).offset(offset);
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(campaigns)
      .where(and(...conditions));
    res.json({ data: results, total: Number(countResult?.count || 0), limit, offset });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch campaigns" });
  }
});

router.get("/campaigns/:id", async (req: Request, res: Response) => {
  try {
    const campaign = await storage.getCampaignIncludingDeleted(req.params.id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json(campaign);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch campaign" });
  }
});

router.get("/campaigns/:id/contacts", async (req: Request, res: Response) => {
  try {
    const campaignContacts = await storage.getCampaignContacts(req.params.id);
    res.json(campaignContacts);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch campaign contacts" });
  }
});

router.get("/campaigns/:id/calls", async (req: Request, res: Response) => {
  try {
    const campaignCalls = await storage.getCampaignCalls(req.params.id);
    res.json(campaignCalls);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch campaign calls" });
  }
});

router.get("/campaigns/:id/batches", async (req: Request, res: Response) => {
  try {
    const jobs = await db.select().from(campaignJobs)
      .where(eq(campaignJobs.campaignId, req.params.id))
      .orderBy(desc(campaignJobs.createdAt));
    res.json(jobs);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch batch jobs" });
  }
});

router.get("/batch-jobs", async (req: Request, res: Response) => {
  try {
    const { status, limit: lim, offset: off } = req.query;
    const conditions: any[] = [];
    if (status) conditions.push(eq(campaignJobs.status, status as string));
    const limit = Math.min(parseInt(lim as string) || 50, 200);
    const offset = parseInt(off as string) || 0;
    let query = db.select().from(campaignJobs).orderBy(desc(campaignJobs.createdAt)).limit(limit).offset(offset);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    const results = await query;
    res.json({ data: results, limit, offset });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch batch jobs" });
  }
});

router.get("/batch-jobs/:id", async (req: Request, res: Response) => {
  try {
    const [job] = await db.select().from(campaignJobs).where(eq(campaignJobs.id, req.params.id));
    if (!job) return res.status(404).json({ error: "Batch job not found" });
    res.json(job);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch batch job" });
  }
});

router.post("/batch-jobs/:id/retry", async (req: Request, res: Response) => {
  try {
    const [job] = await db.select().from(campaignJobs).where(eq(campaignJobs.id, req.params.id));
    if (!job) return res.status(404).json({ error: "Batch job not found" });
    await db.update(campaignJobs).set({
      status: "pending",
      lastError: null,
      processedAt: null,
      completedAt: null,
    }).where(eq(campaignJobs.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to retry batch job" });
  }
});

export default router;
