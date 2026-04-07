import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { supportTickets, supportMessages } from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";

interface AuthRequest extends Request {
  user?: any;
}

const SUPPORT_API_KEY = () => process.env.SUPPORT_API_KEY || "";

const createTicketSchema = z.object({
  subject: z.string().min(1).max(500),
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  message: z.string().min(1),
});

const createMessageSchema = z.object({
  senderName: z.string().min(1).max(255),
  senderType: z.enum(["user", "agent"]).default("user"),
  body: z.string().min(1),
});

const updateTicketSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
});

export function createSupportTicketRoutes(authenticate: any) {
  const router = Router();

  router.get("/tickets", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { status, page = "1", limit = "20" } = req.query;
      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
      const offset = (pageNum - 1) * limitNum;

      const conditions = [eq(supportTickets.userId, userId)];
      if (status && status !== "all") {
        conditions.push(eq(supportTickets.status, status as string));
      }

      const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

      const tickets = await db.select()
        .from(supportTickets)
        .where(whereClause)
        .orderBy(desc(supportTickets.createdAt))
        .limit(limitNum)
        .offset(offset);

      const [{ count }] = await db.select({ count: sql<number>`count(*)` })
        .from(supportTickets)
        .where(whereClause);

      res.json({ tickets, total: Number(count), page: pageNum, limit: limitNum });
    } catch (error: any) {
      console.error("[Support] Error fetching tickets:", error.message);
      res.status(500).json({ error: "Failed to fetch tickets" });
    }
  });

  router.get("/tickets/:id", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const ticketId = parseInt(req.params.id);
      if (isNaN(ticketId)) return res.status(400).json({ error: "Invalid ticket ID" });

      const [ticket] = await db.select()
        .from(supportTickets)
        .where(and(eq(supportTickets.id, ticketId), eq(supportTickets.userId, userId)));

      if (!ticket) return res.status(404).json({ error: "Ticket not found" });

      const messages = await db.select()
        .from(supportMessages)
        .where(eq(supportMessages.ticketId, ticketId))
        .orderBy(supportMessages.createdAt);

      res.json({ ...ticket, messages });
    } catch (error: any) {
      console.error("[Support] Error fetching ticket:", error.message);
      res.status(500).json({ error: "Failed to fetch ticket" });
    }
  });

  router.post("/tickets", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const parsed = createTicketSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });

      const { subject, name, email, priority, message } = parsed.data;

      const [ticket] = await db.insert(supportTickets).values({
        userId,
        name,
        email,
        subject,
        priority,
        status: "open",
      }).returning();

      await db.insert(supportMessages).values({
        ticketId: ticket.id,
        senderName: name,
        senderType: "user",
        body: message,
      });

      res.status(201).json(ticket);
    } catch (error: any) {
      console.error("[Support] Error creating ticket:", error.message);
      res.status(500).json({ error: "Failed to create ticket" });
    }
  });

  router.post("/tickets/:id/messages", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const ticketId = parseInt(req.params.id);
      if (isNaN(ticketId)) return res.status(400).json({ error: "Invalid ticket ID" });

      const [ticket] = await db.select()
        .from(supportTickets)
        .where(and(eq(supportTickets.id, ticketId), eq(supportTickets.userId, userId)));

      if (!ticket) return res.status(404).json({ error: "Ticket not found" });

      const parsed = createMessageSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });

      const [msg] = await db.insert(supportMessages).values({
        ticketId,
        ...parsed.data,
      }).returning();

      res.status(201).json(msg);
    } catch (error: any) {
      console.error("[Support] Error posting message:", error.message);
      res.status(500).json({ error: "Failed to post message" });
    }
  });

  router.patch("/tickets/:id/close", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const ticketId = parseInt(req.params.id);
      if (isNaN(ticketId)) return res.status(400).json({ error: "Invalid ticket ID" });

      const [ticket] = await db.select()
        .from(supportTickets)
        .where(and(eq(supportTickets.id, ticketId), eq(supportTickets.userId, userId)));

      if (!ticket) return res.status(404).json({ error: "Ticket not found" });

      const [updated] = await db.update(supportTickets)
        .set({ status: "closed", updatedAt: new Date() })
        .where(eq(supportTickets.id, ticketId))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("[Support] Error closing ticket:", error.message);
      res.status(500).json({ error: "Failed to close ticket" });
    }
  });

  router.delete("/tickets/:id", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const ticketId = parseInt(req.params.id);
      if (isNaN(ticketId)) return res.status(400).json({ error: "Invalid ticket ID" });

      const [ticket] = await db.select()
        .from(supportTickets)
        .where(and(eq(supportTickets.id, ticketId), eq(supportTickets.userId, userId)));

      if (!ticket) return res.status(404).json({ error: "Ticket not found" });

      await db.delete(supportMessages).where(eq(supportMessages.ticketId, ticketId));
      await db.delete(supportTickets).where(eq(supportTickets.id, ticketId));

      res.json({ success: true });
    } catch (error: any) {
      console.error("[Support] Error deleting ticket:", error.message);
      res.status(500).json({ error: "Failed to delete ticket" });
    }
  });

  return router;
}

function requireApiKey(req: Request, res: Response, next: Function) {
  const apiKey = SUPPORT_API_KEY();
  if (!apiKey) return res.status(503).json({ error: "Support API not configured" });

  const provided = req.headers["x-api-key"] ||
    (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null);

  if (!provided || provided !== apiKey) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

export function createPublicSupportRoutes() {
  const router = Router();

  router.get("/tickets", requireApiKey as any, async (req: Request, res: Response) => {
    try {
      const { status, email, page = "1", limit = "20" } = req.query;
      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
      const offset = (pageNum - 1) * limitNum;

      const conditions: any[] = [];
      if (status) conditions.push(eq(supportTickets.status, status as string));
      if (email) conditions.push(eq(supportTickets.email, email as string));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const tickets = await db.select()
        .from(supportTickets)
        .where(whereClause)
        .orderBy(desc(supportTickets.createdAt))
        .limit(limitNum)
        .offset(offset);

      const [{ count }] = await db.select({ count: sql<number>`count(*)` })
        .from(supportTickets)
        .where(whereClause);

      res.json({ tickets, total: Number(count), page: pageNum, limit: limitNum });
    } catch (error: any) {
      console.error("[Support Public] Error fetching tickets:", error.message);
      res.status(500).json({ error: "Failed to fetch tickets" });
    }
  });

  router.get("/tickets/:id", requireApiKey as any, async (req: Request, res: Response) => {
    try {
      const ticketId = parseInt(req.params.id);
      if (isNaN(ticketId)) return res.status(400).json({ error: "Invalid ticket ID" });

      const [ticket] = await db.select()
        .from(supportTickets)
        .where(eq(supportTickets.id, ticketId));

      if (!ticket) return res.status(404).json({ error: "Ticket not found" });

      const messages = await db.select()
        .from(supportMessages)
        .where(eq(supportMessages.ticketId, ticketId))
        .orderBy(supportMessages.createdAt);

      res.json({ ...ticket, messages });
    } catch (error: any) {
      console.error("[Support Public] Error fetching ticket:", error.message);
      res.status(500).json({ error: "Failed to fetch ticket" });
    }
  });

  router.patch("/tickets/:id", requireApiKey as any, async (req: Request, res: Response) => {
    try {
      const ticketId = parseInt(req.params.id);
      if (isNaN(ticketId)) return res.status(400).json({ error: "Invalid ticket ID" });

      const parsed = updateTicketSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });

      const [updated] = await db.update(supportTickets)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(supportTickets.id, ticketId))
        .returning();

      if (!updated) return res.status(404).json({ error: "Ticket not found" });
      res.json(updated);
    } catch (error: any) {
      console.error("[Support Public] Error updating ticket:", error.message);
      res.status(500).json({ error: "Failed to update ticket" });
    }
  });

  router.post("/tickets/:id/messages", requireApiKey as any, async (req: Request, res: Response) => {
    try {
      const ticketId = parseInt(req.params.id);
      if (isNaN(ticketId)) return res.status(400).json({ error: "Invalid ticket ID" });

      const [ticket] = await db.select()
        .from(supportTickets)
        .where(eq(supportTickets.id, ticketId));

      if (!ticket) return res.status(404).json({ error: "Ticket not found" });

      const parsed = createMessageSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });

      const [msg] = await db.insert(supportMessages).values({
        ticketId,
        ...parsed.data,
      }).returning();

      res.status(201).json(msg);
    } catch (error: any) {
      console.error("[Support Public] Error posting message:", error.message);
      res.status(500).json({ error: "Failed to post message" });
    }
  });

  router.get("/tickets/:id/messages", requireApiKey as any, async (req: Request, res: Response) => {
    try {
      const ticketId = parseInt(req.params.id);
      if (isNaN(ticketId)) return res.status(400).json({ error: "Invalid ticket ID" });

      const messages = await db.select()
        .from(supportMessages)
        .where(eq(supportMessages.ticketId, ticketId))
        .orderBy(supportMessages.createdAt);

      res.json(messages);
    } catch (error: any) {
      console.error("[Support Public] Error fetching messages:", error.message);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  return router;
}
