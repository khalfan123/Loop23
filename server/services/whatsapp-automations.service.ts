import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import {
  whatsappChannelSettings,
  whatsappKeywordTriggers,
  whatsappContactTags,
  whatsappContacts,
  whatsappSenders,
} from "@shared/schema";
import { getWorkspaceTwilioClient } from "./twilio-connector";
import { getDomain } from "../utils/domain";

/**
 * Evaluate channel-level automations for an inbound WhatsApp message:
 *   - Welcome message (first-ever inbound message from this contact)
 *   - Keyword triggers (priority-ordered; first match wins)
 *   - Default reply (catch-all if nothing else matched)
 *
 * Sends auto-replies through the same Twilio Senders / Messaging Service the
 * primary sender already uses. Errors are swallowed and logged — auto-replies
 * must never break the main webhook flow.
 */
export async function runInboundAutomations(params: {
  workspaceId: string;
  senderId: string;
  contactId: string;
  inboundText: string;
  baseUrl: string;
  isFirstInbound: boolean;
}): Promise<void> {
  const { workspaceId, senderId, contactId, inboundText, baseUrl, isFirstInbound } = params;
  try {
    const [sender] = await db.select().from(whatsappSenders).where(eq(whatsappSenders.id, senderId)).limit(1);
    if (!sender) return;
    const [contact] = await db.select().from(whatsappContacts).where(eq(whatsappContacts.id, contactId)).limit(1);
    if (!contact) return;

    const [settings] = await db
      .select()
      .from(whatsappChannelSettings)
      .where(
        and(
          eq(whatsappChannelSettings.workspaceId, workspaceId),
          eq(whatsappChannelSettings.senderId, senderId),
        ),
      )
      .limit(1);

    const replies: string[] = [];

    if (settings?.welcomeEnabled && settings.welcomeBody && isFirstInbound) {
      replies.push(settings.welcomeBody);
    }

    const triggerMatched = await matchKeywordTrigger({
      workspaceId,
      senderId,
      text: inboundText,
      contactId,
    });
    if (triggerMatched?.replyBody) replies.push(triggerMatched.replyBody);

    if (replies.length === 0 && settings?.defaultReplyEnabled && settings.defaultReplyBody) {
      replies.push(settings.defaultReplyBody);
    }

    if (replies.length === 0) return;

    const twilioClient = await getWorkspaceTwilioClient(workspaceId);
    for (const body of replies) {
      try {
        await (twilioClient as any).messages.create({
          from: `whatsapp:${sender.phoneNumberE164}`,
          to: `whatsapp:${contact.phoneNumberE164}`,
          body,
          statusCallback: `${baseUrl}/api/webhooks/twilio/whatsapp/status/${sender.id}/${sender.webhookSecret}`,
        });
      } catch (e: any) {
        console.warn("[WhatsApp] auto-reply send failed:", e?.message || e);
      }
    }
  } catch (e: any) {
    console.warn("[WhatsApp] runInboundAutomations failed:", e?.message || e);
  }
}

async function matchKeywordTrigger(params: {
  workspaceId: string;
  senderId: string;
  text: string;
  contactId: string;
}): Promise<{ replyBody: string | null; assignTagId: string | null; id: string } | null> {
  const { workspaceId, senderId, text, contactId } = params;
  const triggers = await db
    .select()
    .from(whatsappKeywordTriggers)
    .where(eq(whatsappKeywordTriggers.workspaceId, workspaceId));
  // Filter by sender (or workspace-wide) and enabled, sort by priority asc.
  const candidates = triggers
    .filter((t) => t.enabled && (t.senderId == null || t.senderId === senderId))
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

  for (const t of candidates) {
    if (!matchesTrigger(text, t)) continue;
    // Side-effect: assign tag, bump fire count.
    try {
      await db
        .update(whatsappKeywordTriggers)
        .set({ fireCount: sql`${whatsappKeywordTriggers.fireCount} + 1`, lastFiredAt: new Date(), updatedAt: new Date() })
        .where(eq(whatsappKeywordTriggers.id, t.id));
      if (t.assignTagId) {
        await db
          .insert(whatsappContactTags)
          .values({ workspaceId, contactId, tagId: t.assignTagId })
          .onConflictDoNothing();
      }
    } catch (e: any) {
      console.warn("[WhatsApp] keyword side-effect failed:", e?.message || e);
    }
    return { replyBody: t.replyBody ?? null, assignTagId: t.assignTagId ?? null, id: t.id };
  }
  return null;
}

function matchesTrigger(text: string, t: { matchMode: string; keywords: unknown; caseSensitive: boolean }): boolean {
  const haystack = t.caseSensitive ? text : text.toLowerCase();
  const list = Array.isArray(t.keywords) ? (t.keywords as unknown[]).map(String) : [];
  for (const raw of list) {
    const needle = t.caseSensitive ? String(raw) : String(raw).toLowerCase();
    if (!needle) continue;
    switch (t.matchMode) {
      case "exact":
        if (haystack.trim() === needle.trim()) return true;
        break;
      case "startsWith":
        if (haystack.trimStart().startsWith(needle)) return true;
        break;
      case "regex":
        try {
          const re = new RegExp(String(raw), t.caseSensitive ? "" : "i");
          if (re.test(text)) return true;
        } catch {
          // ignore invalid regex
        }
        break;
      case "contains":
      default:
        if (haystack.includes(needle)) return true;
        break;
    }
  }
  return false;
}

// Public helper used by the webhook to detect "first inbound from this contact in this conversation".
export async function isFirstInboundMessage(params: { contactId: string }): Promise<boolean> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(whatsappContacts)
    .where(eq(whatsappContacts.id, params.contactId));
  // Best-effort: treat firstSeenAt == lastSeenAt within a short window as "first inbound".
  // Cheap proxy: the contact row was created moments ago (within ~5s) by upsert.
  if (!row) return false;
  const [contact] = await db.select().from(whatsappContacts).where(eq(whatsappContacts.id, params.contactId)).limit(1);
  if (!contact) return false;
  const created = contact.createdAt instanceof Date ? contact.createdAt : new Date(contact.createdAt as any);
  return Date.now() - created.getTime() < 10_000;
}

export function buildBaseUrl(host: string | undefined): string {
  return getDomain(host);
}
