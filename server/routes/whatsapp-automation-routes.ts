import { Router, Response } from "express";
import { z } from "zod";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { RouteContext, AuthRequest } from "./common";
import { WorkspaceService } from "../services/workspace-service";
import { getDomain } from "../utils/domain";
import { db } from "../db";
import {
  whatsappContacts,
  whatsappContactTags,
  whatsappContactFields,
  whatsappTags,
  whatsappChannelSettings,
  whatsappQuickReplies,
  whatsappKeywordTriggers,
  whatsappBroadcasts,
  whatsappBroadcastRecipients,
  whatsappSenders,
} from "@shared/schema";
import { getWorkspaceTwilioClient } from "../services/twilio-connector";

/** Group ManyChat-style routes: tags, contact fields, channel settings, quick
 *  replies, keyword triggers, broadcasts. */
export function createWhatsappAutomationRoutes(ctx: RouteContext): Router {
  const router = Router();
  const { authenticateToken } = ctx;

  // ───────────── Audience: contacts + tags + custom fields ─────────────

  router.get("/api/whatsapp/audience/contacts", authenticateToken, async (req: AuthRequest, res: Response) => {
    const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
    if (!workspace) return res.status(400).json({ error: "No workspace found for user" });
    const search = String(req.query.search || "").trim().toLowerCase();
    const tagId = req.query.tagId ? String(req.query.tagId) : null;

    let contacts = await db
      .select()
      .from(whatsappContacts)
      .where(eq(whatsappContacts.workspaceId, workspace.id))
      .orderBy(desc(whatsappContacts.lastSeenAt))
      .limit(500);

    if (search) {
      contacts = contacts.filter(
        (c) =>
          c.phoneNumberE164.toLowerCase().includes(search) ||
          (c.profileName || "").toLowerCase().includes(search),
      );
    }

    const contactIds = contacts.map((c) => c.id);
    const tagLinks = contactIds.length
      ? await db
          .select()
          .from(whatsappContactTags)
          .where(inArray(whatsappContactTags.contactId, contactIds))
      : [];

    if (tagId) {
      const allowed = new Set(tagLinks.filter((l) => l.tagId === tagId).map((l) => l.contactId));
      contacts = contacts.filter((c) => allowed.has(c.id));
    }

    const tagIdsInUse = Array.from(new Set(tagLinks.map((l) => l.tagId)));
    const tags = tagIdsInUse.length
      ? await db.select().from(whatsappTags).where(inArray(whatsappTags.id, tagIdsInUse))
      : [];
    const tagsById = new Map(tags.map((t) => [t.id, t]));
    const tagsByContact = new Map<string, any[]>();
    for (const link of tagLinks) {
      const arr = tagsByContact.get(link.contactId) || [];
      const tag = tagsById.get(link.tagId);
      if (tag) arr.push(tag);
      tagsByContact.set(link.contactId, arr);
    }

    res.json(
      contacts.map((c) => ({
        ...c,
        tags: tagsByContact.get(c.id) || [],
      })),
    );
  });

  router.get("/api/whatsapp/audience/contacts/:contactId", authenticateToken, async (req: AuthRequest, res: Response) => {
    const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
    if (!workspace) return res.status(400).json({ error: "No workspace found for user" });

    const [contact] = await db
      .select()
      .from(whatsappContacts)
      .where(and(eq(whatsappContacts.id, String(req.params.contactId)), eq(whatsappContacts.workspaceId, workspace.id)))
      .limit(1);
    if (!contact) return res.status(404).json({ error: "Contact not found" });

    const links = await db
      .select()
      .from(whatsappContactTags)
      .where(eq(whatsappContactTags.contactId, contact.id));
    const tags = links.length
      ? await db.select().from(whatsappTags).where(inArray(whatsappTags.id, links.map((l) => l.tagId)))
      : [];
    const fields = await db
      .select()
      .from(whatsappContactFields)
      .where(eq(whatsappContactFields.contactId, contact.id));

    res.json({ contact, tags, fields });
  });

  router.put("/api/whatsapp/audience/contacts/:contactId/fields", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
      if (!workspace) return res.status(400).json({ error: "No workspace found for user" });
      const [contact] = await db
        .select()
        .from(whatsappContacts)
        .where(and(eq(whatsappContacts.id, String(req.params.contactId)), eq(whatsappContacts.workspaceId, workspace.id)))
        .limit(1);
      if (!contact) return res.status(404).json({ error: "Contact not found" });

      const parsed = z
        .object({
          fields: z.array(z.object({ key: z.string().min(1).max(100), value: z.string().max(2000).optional() })),
        })
        .parse(req.body);

      for (const f of parsed.fields) {
        const [existing] = await db
          .select({ id: whatsappContactFields.id })
          .from(whatsappContactFields)
          .where(and(eq(whatsappContactFields.contactId, contact.id), eq(whatsappContactFields.key, f.key)))
          .limit(1);
        if (existing) {
          await db
            .update(whatsappContactFields)
            .set({ value: f.value ?? null, updatedAt: new Date() })
            .where(eq(whatsappContactFields.id, existing.id));
        } else {
          await db
            .insert(whatsappContactFields)
            .values({ workspaceId: workspace.id, contactId: contact.id, key: f.key, value: f.value ?? null });
        }
      }
      res.json({ ok: true });
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Invalid input", issues: e.issues });
      res.status(500).json({ error: e?.message || "Failed to update fields" });
    }
  });

  // ───────────── Tags ─────────────

  router.get("/api/whatsapp/tags", authenticateToken, async (req: AuthRequest, res: Response) => {
    const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
    if (!workspace) return res.status(400).json({ error: "No workspace found for user" });
    const rows = await db
      .select()
      .from(whatsappTags)
      .where(eq(whatsappTags.workspaceId, workspace.id))
      .orderBy(whatsappTags.name);
    res.json(rows);
  });

  router.post("/api/whatsapp/tags", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
      if (!workspace) return res.status(400).json({ error: "No workspace found for user" });
      const parsed = z.object({ name: z.string().min(1).max(64), color: z.string().max(32).optional() }).parse(req.body);
      const [row] = await db
        .insert(whatsappTags)
        .values({ workspaceId: workspace.id, name: parsed.name, color: parsed.color ?? null })
        .returning();
      res.json(row);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Invalid input", issues: e.issues });
      if (String(e?.message || "").includes("unique")) return res.status(409).json({ error: "Tag already exists" });
      res.status(500).json({ error: e?.message || "Failed to create tag" });
    }
  });

  router.delete("/api/whatsapp/tags/:tagId", authenticateToken, async (req: AuthRequest, res: Response) => {
    const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
    if (!workspace) return res.status(400).json({ error: "No workspace found for user" });
    await db
      .delete(whatsappTags)
      .where(and(eq(whatsappTags.id, String(req.params.tagId)), eq(whatsappTags.workspaceId, workspace.id)));
    res.json({ ok: true });
  });

  router.post(
    "/api/whatsapp/audience/contacts/:contactId/tags",
    authenticateToken,
    async (req: AuthRequest, res: Response) => {
      try {
        const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
        if (!workspace) return res.status(400).json({ error: "No workspace found for user" });
        const parsed = z.object({ tagId: z.string().min(1) }).parse(req.body);
        await db
          .insert(whatsappContactTags)
          .values({ workspaceId: workspace.id, contactId: String(req.params.contactId), tagId: parsed.tagId })
          .onConflictDoNothing();
        res.json({ ok: true });
      } catch (e: any) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: "Invalid input", issues: e.issues });
        res.status(500).json({ error: e?.message || "Failed to assign tag" });
      }
    },
  );

  router.delete(
    "/api/whatsapp/audience/contacts/:contactId/tags/:tagId",
    authenticateToken,
    async (req: AuthRequest, res: Response) => {
      const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
      if (!workspace) return res.status(400).json({ error: "No workspace found for user" });
      await db
        .delete(whatsappContactTags)
        .where(
          and(
            eq(whatsappContactTags.workspaceId, workspace.id),
            eq(whatsappContactTags.contactId, String(req.params.contactId)),
            eq(whatsappContactTags.tagId, String(req.params.tagId)),
          ),
        );
      res.json({ ok: true });
    },
  );

  // ───────────── Channel settings (welcome / default reply / away) ─────

  router.get("/api/whatsapp/channel-settings", authenticateToken, async (req: AuthRequest, res: Response) => {
    const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
    if (!workspace) return res.status(400).json({ error: "No workspace found for user" });
    const senderId = req.query.senderId ? String(req.query.senderId) : null;
    const where = senderId
      ? and(eq(whatsappChannelSettings.workspaceId, workspace.id), eq(whatsappChannelSettings.senderId, senderId))
      : eq(whatsappChannelSettings.workspaceId, workspace.id);
    const rows = await db.select().from(whatsappChannelSettings).where(where);
    res.json(rows[0] || null);
  });

  router.put("/api/whatsapp/channel-settings", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
      if (!workspace) return res.status(400).json({ error: "No workspace found for user" });
      const parsed = z
        .object({
          senderId: z.string().min(1).nullable().optional(),
          welcomeEnabled: z.boolean().optional(),
          welcomeBody: z.string().max(4096).optional().nullable(),
          defaultReplyEnabled: z.boolean().optional(),
          defaultReplyBody: z.string().max(4096).optional().nullable(),
          awayHoursEnabled: z.boolean().optional(),
          awayMessage: z.string().max(4096).optional().nullable(),
          awaySchedule: z.any().optional(),
        })
        .parse(req.body);

      const senderId = parsed.senderId ?? null;
      const [existing] = await db
        .select()
        .from(whatsappChannelSettings)
        .where(
          senderId
            ? and(eq(whatsappChannelSettings.workspaceId, workspace.id), eq(whatsappChannelSettings.senderId, senderId))
            : eq(whatsappChannelSettings.workspaceId, workspace.id),
        )
        .limit(1);

      const row = {
        welcomeEnabled: parsed.welcomeEnabled ?? existing?.welcomeEnabled ?? false,
        welcomeBody: parsed.welcomeBody ?? existing?.welcomeBody ?? null,
        defaultReplyEnabled: parsed.defaultReplyEnabled ?? existing?.defaultReplyEnabled ?? false,
        defaultReplyBody: parsed.defaultReplyBody ?? existing?.defaultReplyBody ?? null,
        awayHoursEnabled: parsed.awayHoursEnabled ?? existing?.awayHoursEnabled ?? false,
        awayMessage: parsed.awayMessage ?? existing?.awayMessage ?? null,
        awaySchedule: (parsed.awaySchedule as any) ?? existing?.awaySchedule ?? null,
        updatedAt: new Date(),
      };
      if (existing) {
        await db.update(whatsappChannelSettings).set(row).where(eq(whatsappChannelSettings.id, existing.id));
      } else {
        await db
          .insert(whatsappChannelSettings)
          .values({ workspaceId: workspace.id, senderId, ...row });
      }
      res.json({ ok: true });
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Invalid input", issues: e.issues });
      res.status(500).json({ error: e?.message || "Failed to update settings" });
    }
  });

  // ───────────── Quick replies ─────────────

  router.get("/api/whatsapp/quick-replies", authenticateToken, async (req: AuthRequest, res: Response) => {
    const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
    if (!workspace) return res.status(400).json({ error: "No workspace found for user" });
    const rows = await db
      .select()
      .from(whatsappQuickReplies)
      .where(eq(whatsappQuickReplies.workspaceId, workspace.id))
      .orderBy(whatsappQuickReplies.shortcut);
    res.json(rows);
  });

  router.post("/api/whatsapp/quick-replies", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
      if (!workspace) return res.status(400).json({ error: "No workspace found for user" });
      const parsed = z.object({ shortcut: z.string().min(1).max(40), body: z.string().min(1).max(4096) }).parse(req.body);
      const [row] = await db
        .insert(whatsappQuickReplies)
        .values({ workspaceId: workspace.id, shortcut: parsed.shortcut, body: parsed.body })
        .returning();
      res.json(row);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Invalid input", issues: e.issues });
      if (String(e?.message || "").includes("unique")) return res.status(409).json({ error: "Shortcut already exists" });
      res.status(500).json({ error: e?.message || "Failed to create quick reply" });
    }
  });

  router.delete("/api/whatsapp/quick-replies/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
    if (!workspace) return res.status(400).json({ error: "No workspace found for user" });
    await db
      .delete(whatsappQuickReplies)
      .where(and(eq(whatsappQuickReplies.id, String(req.params.id)), eq(whatsappQuickReplies.workspaceId, workspace.id)));
    res.json({ ok: true });
  });

  // ───────────── Keyword triggers ─────────────

  router.get("/api/whatsapp/keyword-triggers", authenticateToken, async (req: AuthRequest, res: Response) => {
    const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
    if (!workspace) return res.status(400).json({ error: "No workspace found for user" });
    const rows = await db
      .select()
      .from(whatsappKeywordTriggers)
      .where(eq(whatsappKeywordTriggers.workspaceId, workspace.id))
      .orderBy(whatsappKeywordTriggers.priority);
    res.json(rows);
  });

  router.post("/api/whatsapp/keyword-triggers", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
      if (!workspace) return res.status(400).json({ error: "No workspace found for user" });
      const parsed = z
        .object({
          name: z.string().min(1).max(120),
          matchMode: z.enum(["contains", "exact", "startsWith", "regex"]).default("contains"),
          keywords: z.array(z.string().min(1)).min(1).max(50),
          caseSensitive: z.boolean().default(false),
          replyBody: z.string().max(4096).optional().nullable(),
          assignTagId: z.string().optional().nullable(),
          senderId: z.string().optional().nullable(),
          enabled: z.boolean().default(true),
          priority: z.number().int().min(0).max(10000).default(100),
        })
        .parse(req.body);

      const [row] = await db
        .insert(whatsappKeywordTriggers)
        .values({
          workspaceId: workspace.id,
          senderId: parsed.senderId ?? null,
          name: parsed.name,
          matchMode: parsed.matchMode,
          keywords: parsed.keywords as any,
          caseSensitive: parsed.caseSensitive,
          replyBody: parsed.replyBody ?? null,
          assignTagId: parsed.assignTagId ?? null,
          enabled: parsed.enabled,
          priority: parsed.priority,
        })
        .returning();
      res.json(row);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Invalid input", issues: e.issues });
      res.status(500).json({ error: e?.message || "Failed to create trigger" });
    }
  });

  router.put("/api/whatsapp/keyword-triggers/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
      if (!workspace) return res.status(400).json({ error: "No workspace found for user" });
      const parsed = z
        .object({
          name: z.string().min(1).max(120).optional(),
          matchMode: z.enum(["contains", "exact", "startsWith", "regex"]).optional(),
          keywords: z.array(z.string().min(1)).min(1).max(50).optional(),
          caseSensitive: z.boolean().optional(),
          replyBody: z.string().max(4096).nullable().optional(),
          assignTagId: z.string().nullable().optional(),
          senderId: z.string().nullable().optional(),
          enabled: z.boolean().optional(),
          priority: z.number().int().min(0).max(10000).optional(),
        })
        .parse(req.body);

      await db
        .update(whatsappKeywordTriggers)
        .set({
          ...(parsed.name !== undefined ? { name: parsed.name } : {}),
          ...(parsed.matchMode !== undefined ? { matchMode: parsed.matchMode } : {}),
          ...(parsed.keywords !== undefined ? { keywords: parsed.keywords as any } : {}),
          ...(parsed.caseSensitive !== undefined ? { caseSensitive: parsed.caseSensitive } : {}),
          ...(parsed.replyBody !== undefined ? { replyBody: parsed.replyBody } : {}),
          ...(parsed.assignTagId !== undefined ? { assignTagId: parsed.assignTagId } : {}),
          ...(parsed.senderId !== undefined ? { senderId: parsed.senderId } : {}),
          ...(parsed.enabled !== undefined ? { enabled: parsed.enabled } : {}),
          ...(parsed.priority !== undefined ? { priority: parsed.priority } : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(whatsappKeywordTriggers.id, String(req.params.id)),
            eq(whatsappKeywordTriggers.workspaceId, workspace.id),
          ),
        );
      res.json({ ok: true });
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Invalid input", issues: e.issues });
      res.status(500).json({ error: e?.message || "Failed to update trigger" });
    }
  });

  router.delete("/api/whatsapp/keyword-triggers/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
    if (!workspace) return res.status(400).json({ error: "No workspace found for user" });
    await db
      .delete(whatsappKeywordTriggers)
      .where(
        and(
          eq(whatsappKeywordTriggers.id, String(req.params.id)),
          eq(whatsappKeywordTriggers.workspaceId, workspace.id),
        ),
      );
    res.json({ ok: true });
  });

  // ───────────── Broadcasts ─────────────

  router.get("/api/whatsapp/broadcasts", authenticateToken, async (req: AuthRequest, res: Response) => {
    const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
    if (!workspace) return res.status(400).json({ error: "No workspace found for user" });
    const rows = await db
      .select()
      .from(whatsappBroadcasts)
      .where(eq(whatsappBroadcasts.workspaceId, workspace.id))
      .orderBy(desc(whatsappBroadcasts.createdAt))
      .limit(200);
    res.json(rows);
  });

  router.post("/api/whatsapp/broadcasts", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
      if (!workspace) return res.status(400).json({ error: "No workspace found for user" });
      const parsed = z
        .object({
          name: z.string().min(1).max(120),
          senderId: z.string().min(1),
          templateName: z.string().min(1),
          templateLanguage: z.string().min(2),
          templateVariables: z.array(z.string()).optional(),
          audienceTagIds: z.array(z.string()).min(1, "Choose at least one tag for the audience"),
        })
        .parse(req.body);

      const [sender] = await db
        .select({ id: whatsappSenders.id })
        .from(whatsappSenders)
        .where(and(eq(whatsappSenders.id, parsed.senderId), eq(whatsappSenders.workspaceId, workspace.id)))
        .limit(1);
      if (!sender) return res.status(400).json({ error: "Sender not found" });

      const links = await db
        .select()
        .from(whatsappContactTags)
        .where(
          and(
            eq(whatsappContactTags.workspaceId, workspace.id),
            inArray(whatsappContactTags.tagId, parsed.audienceTagIds),
          ),
        );
      const contactIds = Array.from(new Set(links.map((l) => l.contactId)));

      const [row] = await db
        .insert(whatsappBroadcasts)
        .values({
          workspaceId: workspace.id,
          senderId: parsed.senderId,
          name: parsed.name,
          templateName: parsed.templateName,
          templateLanguage: parsed.templateLanguage,
          templateVariables: (parsed.templateVariables as any) ?? null,
          audienceTagIds: parsed.audienceTagIds as any,
          status: "draft",
          totalRecipients: contactIds.length,
        })
        .returning();

      if (contactIds.length) {
        await db
          .insert(whatsappBroadcastRecipients)
          .values(contactIds.map((cid) => ({ broadcastId: row.id, contactId: cid })))
          .onConflictDoNothing();
      }

      res.json(row);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Invalid input", issues: e.issues });
      res.status(500).json({ error: e?.message || "Failed to create broadcast" });
    }
  });

  router.post("/api/whatsapp/broadcasts/:id/send", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
      if (!workspace) return res.status(400).json({ error: "No workspace found for user" });
      const [b] = await db
        .select()
        .from(whatsappBroadcasts)
        .where(and(eq(whatsappBroadcasts.id, String(req.params.id)), eq(whatsappBroadcasts.workspaceId, workspace.id)))
        .limit(1);
      if (!b) return res.status(404).json({ error: "Broadcast not found" });
      if (b.status === "sending" || b.status === "sent") return res.status(409).json({ error: "Already sent" });

      await db
        .update(whatsappBroadcasts)
        .set({ status: "sending", startedAt: new Date(), updatedAt: new Date() })
        .where(eq(whatsappBroadcasts.id, b.id));

      void runBroadcast({
        broadcastId: b.id,
        workspaceId: workspace.id,
        baseUrl: getDomain(req.get("host") || undefined),
      }).catch((e) => console.error("[WhatsApp] broadcast failed:", e));
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Failed to start broadcast" });
    }
  });

  router.get("/api/whatsapp/broadcasts/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
    if (!workspace) return res.status(400).json({ error: "No workspace found for user" });
    const [b] = await db
      .select()
      .from(whatsappBroadcasts)
      .where(and(eq(whatsappBroadcasts.id, String(req.params.id)), eq(whatsappBroadcasts.workspaceId, workspace.id)))
      .limit(1);
    if (!b) return res.status(404).json({ error: "Broadcast not found" });
    const recipients = await db
      .select()
      .from(whatsappBroadcastRecipients)
      .where(eq(whatsappBroadcastRecipients.broadcastId, b.id))
      .limit(500);
    res.json({ broadcast: b, recipients });
  });

  return router;
}

async function runBroadcast(params: { broadcastId: string; workspaceId: string; baseUrl: string }): Promise<void> {
  const { broadcastId, workspaceId, baseUrl } = params;
  const [b] = await db.select().from(whatsappBroadcasts).where(eq(whatsappBroadcasts.id, broadcastId)).limit(1);
  if (!b) return;
  const [sender] = await db.select().from(whatsappSenders).where(eq(whatsappSenders.id, b.senderId)).limit(1);
  if (!sender) {
    await db
      .update(whatsappBroadcasts)
      .set({ status: "failed", lastError: "Sender missing", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(whatsappBroadcasts.id, b.id));
    return;
  }

  const recipients = await db
    .select()
    .from(whatsappBroadcastRecipients)
    .where(eq(whatsappBroadcastRecipients.broadcastId, b.id));

  const twilioClient = await getWorkspaceTwilioClient(workspaceId);
  const variables = Array.isArray(b.templateVariables) ? (b.templateVariables as string[]) : [];

  let sent = 0;
  let failed = 0;
  const concurrency = 4;
  let cursor = 0;
  await Promise.all(
    Array.from({ length: concurrency }).map(async () => {
      while (true) {
        const idx = cursor++;
        if (idx >= recipients.length) break;
        const r = recipients[idx];
        const [contact] = await db.select().from(whatsappContacts).where(eq(whatsappContacts.id, r.contactId)).limit(1);
        if (!contact) {
          failed++;
          await db
            .update(whatsappBroadcastRecipients)
            .set({ status: "failed", errorMessage: "Contact missing" })
            .where(eq(whatsappBroadcastRecipients.id, r.id));
          continue;
        }
        try {
          const contentVariables: Record<string, string> = {};
          variables.forEach((v, i) => (contentVariables[String(i + 1)] = v));
          const msg = await (twilioClient as any).messages.create({
            from: `whatsapp:${sender.phoneNumberE164}`,
            to: `whatsapp:${contact.phoneNumberE164}`,
            // Note: Twilio supports two ways for templates — Content API or template parameters.
            // Here we send a plain text representation; users with Twilio Content templates can
            // switch to contentSid + contentVariables (TODO).
            body: variables.length
              ? `[${b.templateName}] ` + variables.join(" · ")
              : `[${b.templateName}]`,
            statusCallback: `${baseUrl}/api/webhooks/twilio/whatsapp/status/${sender.id}/${sender.webhookSecret}`,
          });
          sent++;
          await db
            .update(whatsappBroadcastRecipients)
            .set({ status: "sent", twilioMessageSid: msg.sid, sentAt: new Date() })
            .where(eq(whatsappBroadcastRecipients.id, r.id));
        } catch (e: any) {
          failed++;
          await db
            .update(whatsappBroadcastRecipients)
            .set({ status: "failed", errorMessage: e?.message || "send failed" })
            .where(eq(whatsappBroadcastRecipients.id, r.id));
        }
        await db
          .update(whatsappBroadcasts)
          .set({ sentCount: sent, failedCount: failed, updatedAt: new Date() })
          .where(eq(whatsappBroadcasts.id, b.id));
      }
    }),
  );

  await db
    .update(whatsappBroadcasts)
    .set({
      status: failed > 0 && sent === 0 ? "failed" : "sent",
      completedAt: new Date(),
      updatedAt: new Date(),
      sentCount: sent,
      failedCount: failed,
    })
    .where(eq(whatsappBroadcasts.id, b.id));
  // sql import side-effect (keep import used)
  void sql;
}
