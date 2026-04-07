import { Router, Request, Response } from "express";
import { db } from "../../db";
import { storage } from "../../storage";
import { users } from "@shared/schema";
import { eq, sql, desc, and } from "drizzle-orm";
import bcrypt from "bcrypt";

const router = Router();

router.get("/admin-users", async (_req: Request, res: Response) => {
  try {
    const adminUsers = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    }).from(users)
      .where(eq(users.role, "admin"))
      .orderBy(desc(users.createdAt));
    res.json(adminUsers);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch admin users" });
  }
});

router.post("/admin-users", async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "name, email, and password are required" });
    const existing = await storage.getUserByEmail(email);
    if (existing) return res.status(409).json({ error: "Email already in use" });
    const hashedPassword = await bcrypt.hash(password, 12);
    const [created] = await db.insert(users).values({
      name, email, password: hashedPassword, role: "admin", isActive: true, credits: 0,
    }).returning();
    res.status(201).json({ id: created.id, name: created.name, email: created.email, role: created.role });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create admin user" });
  }
});

router.patch("/admin-users/:id", async (req: Request, res: Response) => {
  try {
    const [existing] = await db.select().from(users).where(and(eq(users.id, req.params.id), eq(users.role, "admin")));
    if (!existing) return res.status(404).json({ error: "Admin user not found" });
    const updates: any = {};
    if (req.body.name) updates.name = req.body.name;
    if (req.body.email) updates.email = req.body.email;
    if (req.body.isActive !== undefined) updates.isActive = req.body.isActive;
    if (req.body.password) updates.password = await bcrypt.hash(req.body.password, 12);
    await db.update(users).set(updates).where(eq(users.id, req.params.id));
    const [updated] = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role, isActive: users.isActive })
      .from(users).where(eq(users.id, req.params.id));
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update admin user" });
  }
});

router.delete("/admin-users/:id", async (req: Request, res: Response) => {
  try {
    const [existing] = await db.select().from(users).where(and(eq(users.id, req.params.id), eq(users.role, "admin")));
    if (!existing) return res.status(404).json({ error: "Admin user not found" });
    const [adminCount] = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.role, "admin"));
    if (Number(adminCount?.count || 0) <= 1) return res.status(400).json({ error: "Cannot delete the last admin user" });
    await db.update(users).set({ isActive: false, isDeleted: true, deletedAt: new Date(), deletedBy: "admin" })
      .where(eq(users.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete admin user" });
  }
});

router.get("/auth/sessions", async (_req: Request, res: Response) => {
  try {
    res.json({
      data: [],
      message: "JWT-based authentication — no server-side session store. Sessions are managed via token expiry.",
      authType: "jwt",
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

router.delete("/auth/sessions/:id", async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      message: "JWT-based authentication — session invalidation requires token blacklisting or expiry.",
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete session" });
  }
});

export default router;
