import { Router, Request, Response } from "express";
import { db } from "../../db";
import { storage } from "../../storage";
import { users, contacts, webhookSubscriptions, campaigns } from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import bcrypt from "bcrypt";

const router = Router();

// Compatibility alias: some CP builds call tenants instead of users
router.get("/tenants", async (req: Request, res: Response) => {
  try {
    const { role, search, limit: lim, offset: off } = req.query;
    const conditions: any[] = [];
    if (role) conditions.push(eq(users.role, role as string));
    const limit = Math.min(parseInt(lim as string) || 50, 200);
    const offset = parseInt(off as string) || 0;
    let query = db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        credits: users.credits,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    const results = await query;
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    res.json({ data: results, total: Number(countResult?.count || 0), limit, offset });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch tenants" });
  }
});

router.get("/users", async (req: Request, res: Response) => {
  try {
    const { role, search, limit: lim, offset: off } = req.query;
    const conditions: any[] = [];
    if (role) conditions.push(eq(users.role, role as string));
    const limit = Math.min(parseInt(lim as string) || 50, 200);
    const offset = parseInt(off as string) || 0;
    let query = db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      credits: users.credits,
      createdAt: users.createdAt,
    }).from(users).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    const results = await query;
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(users)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    res.json({ data: results, total: Number(countResult?.count || 0), limit, offset });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.post("/users", async (req: Request, res: Response) => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: "email, password, and name are required" });
    }
    const existing = await storage.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: "User with this email already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await storage.createUser({
      email,
      password: hashedPassword,
      name,
      role: role || "user",
    });
    res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create user" });
  }
});

router.delete("/users/:id", async (req: Request, res: Response) => {
  try {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    await db.update(users).set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: "admin",
      isActive: false,
    }).where(eq(users.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

router.patch("/users/:id", async (req: Request, res: Response) => {
  try {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const { name, email, role } = req.body;
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (role !== undefined) updates.role = role;
    updates.updatedAt = new Date();
    await db.update(users).set(updates).where(eq(users.id, req.params.id));
    const updated = await storage.getUser(req.params.id);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update user" });
  }
});

router.post("/users/:id/block", async (req: Request, res: Response) => {
  try {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const { reason } = req.body;
    await db.update(users).set({
      isActive: false,
      blockedReason: reason || "Blocked by admin",
      blockedAt: new Date(),
      blockedBy: "admin",
    }).where(eq(users.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to block user" });
  }
});

router.post("/users/:id/unblock", async (req: Request, res: Response) => {
  try {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    await db.update(users).set({
      isActive: true,
      blockedReason: null,
      blockedAt: null,
      blockedBy: null,
    }).where(eq(users.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to unblock user" });
  }
});

router.post("/users/:id/recover", async (req: Request, res: Response) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.params.id));
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.isDeleted) return res.status(400).json({ error: "User is not deleted" });
    await db.update(users).set({
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      isActive: true,
    }).where(eq(users.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to recover user" });
  }
});

router.get("/users/:id/contacts", async (req: Request, res: Response) => {
  try {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const userContacts = await storage.getUserContacts(req.params.id);
    res.json(userContacts);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch contacts" });
  }
});

router.get("/users/:id/webhooks", async (req: Request, res: Response) => {
  try {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const webhooks = await db.select().from(webhookSubscriptions)
      .where(eq(webhookSubscriptions.userId, req.params.id))
      .orderBy(desc(webhookSubscriptions.createdAt));
    res.json(webhooks);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch webhooks" });
  }
});

router.delete("/users/:id/webhooks/:webhookId", async (req: Request, res: Response) => {
  try {
    const [webhook] = await db.select().from(webhookSubscriptions)
      .where(and(
        eq(webhookSubscriptions.id, req.params.webhookId),
        eq(webhookSubscriptions.userId, req.params.id)
      ));
    if (!webhook) return res.status(404).json({ error: "Webhook not found" });
    await db.delete(webhookSubscriptions).where(eq(webhookSubscriptions.id, req.params.webhookId));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete webhook" });
  }
});

export default router;
