import { Router, Request, Response } from "express";
import { db } from "../../db";
import { knowledgeBase, knowledgeFolders } from "@shared/schema";
import { desc, eq, sql } from "drizzle-orm";

const router = Router();

router.get("/knowledge/folders", async (_req: Request, res: Response) => {
  try {
    const folders = await db.select().from(knowledgeFolders).orderBy(desc(knowledgeFolders.updatedAt));
    res.json({ data: folders });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch knowledge folders" });
  }
});

router.get("/knowledge/base", async (req: Request, res: Response) => {
  try {
    const { userId, limit: lim, offset: off } = req.query;
    const limit = Math.min(parseInt(lim as string) || 50, 200);
    const offset = parseInt(off as string) || 0;

    const where = userId ? eq(knowledgeBase.userId, userId as string) : undefined;
    const rows = await db.select().from(knowledgeBase).where(where).orderBy(desc(knowledgeBase.createdAt)).limit(limit).offset(offset);
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(knowledgeBase)
      .where(where);

    res.json({ data: rows, total: Number(countResult?.count || 0), limit, offset });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch knowledge base items" });
  }
});

export default router;

