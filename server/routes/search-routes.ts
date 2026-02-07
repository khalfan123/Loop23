import { Router, Response } from "express";
import { db } from "../db";
import { agents, campaigns, calls, contacts, knowledgeBase, departments, phoneNumbers } from "@shared/schema";
import { eq, and, or, ilike, desc, sql } from "drizzle-orm";
import { authenticateToken, type AuthRequest } from "../middleware/auth";

const router = Router();

interface SearchResult {
  id: string;
  type: "agent" | "campaign" | "call" | "contact" | "knowledge" | "department" | "phone";
  title: string;
  subtitle?: string;
  url: string;
}

router.get("/api/search", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const q = (req.query.q as string || "").trim();
    if (!q || q.length < 2) {
      return res.json({ results: [] });
    }

    const userId = req.userId!;
    const pattern = `%${q}%`;
    const limit = 5;
    const results: SearchResult[] = [];

    const [agentResults, campaignResults, callResults, contactResults, knowledgeResults, departmentResults, phoneResults] = await Promise.all([
      db.select({ id: agents.id, name: agents.name, type: agents.type, specialist: agents.specialist })
        .from(agents)
        .where(and(eq(agents.userId, userId), or(ilike(agents.name, pattern), ilike(agents.specialist, pattern))))
        .limit(limit),

      db.select({ id: campaigns.id, name: campaigns.name, status: campaigns.status })
        .from(campaigns)
        .where(and(eq(campaigns.userId, userId), ilike(campaigns.name, pattern)))
        .limit(limit),

      db.select({ id: calls.id, phoneNumber: calls.phoneNumber, status: calls.status })
        .from(calls)
        .where(and(eq(calls.userId, userId), ilike(calls.phoneNumber, pattern)))
        .orderBy(desc(calls.createdAt))
        .limit(limit),

      db.select({ id: contacts.id, firstName: contacts.firstName, lastName: contacts.lastName, phone: contacts.phone, campaignId: contacts.campaignId })
        .from(contacts)
        .innerJoin(campaigns, eq(contacts.campaignId, campaigns.id))
        .where(and(eq(campaigns.userId, userId), or(ilike(contacts.firstName, pattern), ilike(contacts.phone, pattern))))
        .limit(limit),

      db.select({ id: knowledgeBase.id, title: knowledgeBase.title, type: knowledgeBase.type })
        .from(knowledgeBase)
        .where(and(eq(knowledgeBase.userId, userId), ilike(knowledgeBase.title, pattern)))
        .limit(limit),

      db.select({ id: departments.id, name: departments.name, description: departments.description })
        .from(departments)
        .where(and(eq(departments.userId, userId), or(ilike(departments.name, pattern), ilike(departments.description, pattern))))
        .limit(limit),

      db.select({ id: phoneNumbers.id, phoneNumber: phoneNumbers.phoneNumber, friendlyName: phoneNumbers.friendlyName })
        .from(phoneNumbers)
        .where(and(eq(phoneNumbers.userId, userId), or(ilike(phoneNumbers.phoneNumber, pattern), ilike(phoneNumbers.friendlyName, pattern))))
        .limit(limit),
    ]);

    for (const a of agentResults) {
      results.push({ id: a.id, type: "agent", title: a.name, subtitle: a.specialist || a.type, url: `/app/agents/${a.id}/edit` });
    }
    for (const c of campaignResults) {
      results.push({ id: c.id, type: "campaign", title: c.name, subtitle: c.status, url: `/app/campaigns/${c.id}` });
    }
    for (const c of callResults) {
      results.push({ id: c.id, type: "call", title: c.phoneNumber || "Unknown", subtitle: c.status, url: `/app/calls/${c.id}` });
    }
    for (const c of contactResults) {
      const contactName = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone;
      results.push({ id: c.id, type: "contact", title: contactName, subtitle: c.phone, url: `/app/contacts` });
    }
    for (const k of knowledgeResults) {
      results.push({ id: k.id, type: "knowledge", title: k.title, subtitle: k.type, url: `/app/knowledge-base` });
    }
    for (const d of departmentResults) {
      results.push({ id: d.id, type: "department", title: d.name, subtitle: d.description || undefined, url: `/app/departments` });
    }
    for (const p of phoneResults) {
      results.push({ id: p.id, type: "phone", title: p.friendlyName || p.phoneNumber, subtitle: p.phoneNumber, url: `/app/phone-numbers` });
    }

    res.json({ results });
  } catch (error: any) {
    console.error("Global search error:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;
