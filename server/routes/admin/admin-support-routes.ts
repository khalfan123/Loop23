import { Router, Request, Response } from "express";
import { db } from "../../db";
import { supportTickets, supportMessages, users } from "@shared/schema";
import { eq, and, or, desc, sql, ilike } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const updateTicketSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "closed", "on_hold"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assignedTo: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
});

const createMessageSchema = z.object({
  senderName: z.string().min(1).max(255),
  senderType: z.enum(["user", "agent"]).default("agent"),
  body: z.string().min(1),
});

const createTicketSchema = z.object({
  subject: z.string().min(1).max(500),
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  message: z.string().min(1),
  userId: z.string().optional(),
});

router.get("/support/tickets", async (req: Request, res: Response) => {
  try {
    const { status, priority, search, page = "1", limit: lim = "20", assigned } = req.query;
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(lim as string) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conditions: any[] = [];
    if (status && status !== "all") {
      conditions.push(eq(supportTickets.status, status as string));
    }
    if (priority && priority !== "all") {
      conditions.push(eq(supportTickets.priority, priority as string));
    }
    if (assigned === "unassigned") {
      conditions.push(sql`${supportTickets.assignedTo} IS NULL`);
    } else if (assigned && assigned !== "all") {
      conditions.push(eq(supportTickets.assignedTo, assigned as string));
    }
    if (search) {
      const searchTerm = `%${search}%`;
      conditions.push(
        or(
          ilike(supportTickets.name, searchTerm),
          ilike(supportTickets.email, searchTerm),
          ilike(supportTickets.subject, searchTerm),
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const tickets = await db.select()
      .from(supportTickets)
      .where(whereClause)
      .orderBy(desc(supportTickets.updatedAt))
      .limit(limitNum)
      .offset(offset);

    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
      .from(supportTickets)
      .where(whereClause);

    const [statsResult] = await db.select({
      total: sql<number>`count(*)`,
      open: sql<number>`count(*) filter (where ${supportTickets.status} = 'open')`,
      in_progress: sql<number>`count(*) filter (where ${supportTickets.status} = 'in_progress')`,
      resolved: sql<number>`count(*) filter (where ${supportTickets.status} = 'resolved')`,
      closed: sql<number>`count(*) filter (where ${supportTickets.status} = 'closed')`,
      on_hold: sql<number>`count(*) filter (where ${supportTickets.status} = 'on_hold')`,
      urgent: sql<number>`count(*) filter (where ${supportTickets.priority} = 'urgent')`,
      unassigned: sql<number>`count(*) filter (where ${supportTickets.assignedTo} IS NULL)`,
    }).from(supportTickets);

    res.json({
      tickets,
      total: Number(count),
      page: pageNum,
      limit: limitNum,
      stats: {
        total: Number(statsResult.total),
        open: Number(statsResult.open),
        in_progress: Number(statsResult.in_progress),
        resolved: Number(statsResult.resolved),
        closed: Number(statsResult.closed),
        on_hold: Number(statsResult.on_hold),
        urgent: Number(statsResult.urgent),
        unassigned: Number(statsResult.unassigned),
      },
    });
  } catch (error: any) {
    console.error("[Admin Support] Error fetching tickets:", error.message);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

router.get("/support/tickets/:id", async (req: Request, res: Response) => {
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
    console.error("[Admin Support] Error fetching ticket:", error.message);
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
});

router.post("/support/tickets", async (req: Request, res: Response) => {
  try {
    const parsed = createTicketSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });

    const { subject, name, email, priority, message, userId } = parsed.data;

    const [ticket] = await db.insert(supportTickets).values({
      userId: userId || "admin",
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
    console.error("[Admin Support] Error creating ticket:", error.message);
    res.status(500).json({ error: "Failed to create ticket" });
  }
});

router.patch("/support/tickets/:id", async (req: Request, res: Response) => {
  try {
    const ticketId = parseInt(req.params.id);
    if (isNaN(ticketId)) return res.status(400).json({ error: "Invalid ticket ID" });

    const parsed = updateTicketSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });

    const updateData: any = { ...parsed.data, updatedAt: new Date() };

    const [updated] = await db.update(supportTickets)
      .set(updateData)
      .where(eq(supportTickets.id, ticketId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Ticket not found" });
    res.json(updated);
  } catch (error: any) {
    console.error("[Admin Support] Error updating ticket:", error.message);
    res.status(500).json({ error: "Failed to update ticket" });
  }
});

router.delete("/support/tickets/:id", async (req: Request, res: Response) => {
  try {
    const ticketId = parseInt(req.params.id);
    if (isNaN(ticketId)) return res.status(400).json({ error: "Invalid ticket ID" });

    await db.delete(supportMessages).where(eq(supportMessages.ticketId, ticketId));
    await db.delete(supportTickets).where(eq(supportTickets.id, ticketId));

    res.json({ success: true });
  } catch (error: any) {
    console.error("[Admin Support] Error deleting ticket:", error.message);
    res.status(500).json({ error: "Failed to delete ticket" });
  }
});

router.post("/support/tickets/:id/messages", async (req: Request, res: Response) => {
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

    await db.update(supportTickets)
      .set({ updatedAt: new Date() })
      .where(eq(supportTickets.id, ticketId));

    res.status(201).json(msg);
  } catch (error: any) {
    console.error("[Admin Support] Error posting message:", error.message);
    res.status(500).json({ error: "Failed to post message" });
  }
});

router.get("/support/tickets/:id/messages", async (req: Request, res: Response) => {
  try {
    const ticketId = parseInt(req.params.id);
    if (isNaN(ticketId)) return res.status(400).json({ error: "Invalid ticket ID" });

    const messages = await db.select()
      .from(supportMessages)
      .where(eq(supportMessages.ticketId, ticketId))
      .orderBy(supportMessages.createdAt);

    res.json(messages);
  } catch (error: any) {
    console.error("[Admin Support] Error fetching messages:", error.message);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.get("/support/stats", async (_req: Request, res: Response) => {
  try {
    const [stats] = await db.select({
      total: sql<number>`count(*)`,
      open: sql<number>`count(*) filter (where ${supportTickets.status} = 'open')`,
      in_progress: sql<number>`count(*) filter (where ${supportTickets.status} = 'in_progress')`,
      resolved: sql<number>`count(*) filter (where ${supportTickets.status} = 'resolved')`,
      closed: sql<number>`count(*) filter (where ${supportTickets.status} = 'closed')`,
      on_hold: sql<number>`count(*) filter (where ${supportTickets.status} = 'on_hold')`,
      urgent: sql<number>`count(*) filter (where ${supportTickets.priority} = 'urgent')`,
      high: sql<number>`count(*) filter (where ${supportTickets.priority} = 'high')`,
      unassigned: sql<number>`count(*) filter (where ${supportTickets.assignedTo} IS NULL)`,
    }).from(supportTickets);

    res.json({
      total: Number(stats.total),
      open: Number(stats.open),
      in_progress: Number(stats.in_progress),
      resolved: Number(stats.resolved),
      closed: Number(stats.closed),
      on_hold: Number(stats.on_hold),
      urgent: Number(stats.urgent),
      high: Number(stats.high),
      unassigned: Number(stats.unassigned),
    });
  } catch (error: any) {
    console.error("[Admin Support] Error fetching stats:", error.message);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
