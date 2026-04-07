import { Router, Request, Response } from "express";
import { db } from "../../db";
import { storage } from "../../storage";
import { notifications, users } from "@shared/schema";
import { eq, sql, desc, and, isNull } from "drizzle-orm";

const router = Router();

router.get("/notifications", async (req: Request, res: Response) => {
  try {
    const { type, limit: lim, offset: off } = req.query;
    const limit = Math.min(parseInt(lim as string) || 50, 200);
    const offset = parseInt(off as string) || 0;
    const conditions: any[] = [];
    if (type) conditions.push(eq(notifications.type, type as string));
    let query = db.select().from(notifications)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(notifications.createdAt))
      .limit(limit).offset(offset);
    const results = await query;
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(notifications)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    res.json({ data: results, total: Number(countResult?.count || 0), limit, offset });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

router.post("/notifications/broadcast", async (req: Request, res: Response) => {
  try {
    const {
      title, message, link, type = "system", icon,
      displayType = "bell", priority = 0, dismissible = true, expiresAt,
    } = req.body;
    if (!title || !message) return res.status(400).json({ error: "Title and message are required" });
    let parsedExpiresAt: Date | null = null;
    if (expiresAt) {
      parsedExpiresAt = new Date(expiresAt);
      if (isNaN(parsedExpiresAt.getTime())) return res.status(400).json({ error: "expiresAt must be a valid date" });
    }
    const allUsers = await storage.getAllUsers();
    const created = await Promise.all(
      allUsers.map(u =>
        storage.createNotification({
          userId: u.id, type, title, message,
          link: link || null, icon: icon || null,
          displayType, priority, dismissible,
          expiresAt: parsedExpiresAt,
        })
      )
    );
    res.json({ success: true, recipientCount: created.length, message: `Broadcast sent to ${created.length} users` });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to send broadcast" });
  }
});

router.delete("/notifications/:id", async (req: Request, res: Response) => {
  try {
    const [existing] = await db.select().from(notifications).where(eq(notifications.id, req.params.id));
    if (!existing) return res.status(404).json({ error: "Notification not found" });
    await storage.deleteNotification(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete notification" });
  }
});

export default router;
