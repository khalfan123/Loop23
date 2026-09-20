import { Router, Request, Response } from "express";
import { db } from "../../db";
import { calls, campaigns, users, callErrorLogs } from "@shared/schema";
import { desc, sql, gte } from "drizzle-orm";

const router = Router();

// High-level operational KPIs for control plane dashboards.
router.get("/operations/kpis", async (_req: Request, res: Response) => {
  try {
    const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [callCount] = await db.select({ count: sql<number>`count(*)` }).from(calls);
    const [campaignCount] = await db.select({ count: sql<number>`count(*)` }).from(campaigns);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [error24h] = await db
      .select({ count: sql<number>`count(*)` })
      .from(callErrorLogs)
      .where(gte(callErrorLogs.createdAt, since));

    res.json({
      users: Number(userCount?.count || 0),
      calls: Number(callCount?.count || 0),
      campaigns: Number(campaignCount?.count || 0),
      callErrors24h: Number(error24h?.count || 0),
      windowHours: 24,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch operations KPIs" });
  }
});

// Latest call errors (alias of admin-calls errors, but useful as a stable ops namespace)
router.get("/operations/call-errors", async (req: Request, res: Response) => {
  try {
    const { limit: lim, offset: off } = req.query;
    const limit = Math.min(parseInt(lim as string) || 50, 200);
    const offset = parseInt(off as string) || 0;
    const rows = await db.select().from(callErrorLogs).orderBy(desc(callErrorLogs.createdAt)).limit(limit).offset(offset);
    res.json({ data: rows, limit, offset });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch call errors" });
  }
});

export default router;

