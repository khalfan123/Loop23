import { Response, Router } from "express";
import { db } from "../db";
import { conversations, messages, whatsappContacts, whatsappSenders, whatsappSenderEvents } from "@shared/schema";
import { and, desc, eq } from "drizzle-orm";
import type { WhatsappWebhookRequest } from "../middleware/whatsapp-webhook-validation";
import { validateWhatsappWebhook } from "../middleware/whatsapp-webhook-validation";
import { runInboundAutomations, isFirstInboundMessage, buildBaseUrl } from "../services/whatsapp-automations.service";

function parseMediaUrls(body: any): string[] {
  const count = Number(body?.NumMedia || 0);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const url = body?.[`MediaUrl${i}`];
    if (typeof url === "string" && url) out.push(url);
  }
  return out;
}

async function upsertWhatsappContact(params: { workspaceId: string; phoneNumberE164: string; profileName?: string | null }) {
  const existing = await db
    .select()
    .from(whatsappContacts)
    .where(and(eq(whatsappContacts.workspaceId, params.workspaceId), eq(whatsappContacts.phoneNumberE164, params.phoneNumberE164)))
    .limit(1);

  const now = new Date();
  if (existing[0]) {
    const row = existing[0];
    await db
      .update(whatsappContacts)
      .set({ profileName: params.profileName ?? row.profileName, lastSeenAt: now, updatedAt: now })
      .where(eq(whatsappContacts.id, row.id));
    return row.id;
  }

  const [created] = await db
    .insert(whatsappContacts)
    .values({
      workspaceId: params.workspaceId,
      phoneNumberE164: params.phoneNumberE164,
      profileName: params.profileName ?? null,
      firstSeenAt: now,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return created.id;
}

async function getOrCreateOpenConversation(params: {
  workspaceId: string;
  senderId: string;
  contactId: string;
}) {
  const existing = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.workspaceId, params.workspaceId),
        eq(conversations.channel, "whatsapp"),
        eq(conversations.status, "open"),
        eq(conversations.whatsappSenderId, params.senderId),
        eq(conversations.contactId, params.contactId),
      ),
    )
    .orderBy(desc(conversations.lastMessageAt))
    .limit(1);

  const now = new Date();
  if (existing[0]) return existing[0].id;

  const [created] = await db
    .insert(conversations)
    .values({
      workspaceId: params.workspaceId,
      channel: "whatsapp",
      whatsappSenderId: params.senderId,
      contactId: params.contactId,
      status: "open",
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return created.id;
}

export function createWhatsappWebhookRoutes(): Router {
  const router = Router();

  router.post(
    "/api/webhooks/twilio/whatsapp/inbound/:senderId/:webhookSecret",
    validateWhatsappWebhook,
    async (req: WhatsappWebhookRequest, res: Response) => {
      try {
        const senderId = req.senderId!;
        const workspaceId = req.workspaceId!;

        const fromRaw = (req.body?.From as string) || "";
        const from = fromRaw.replace(/^whatsapp:/, "");
        const bodyText = (req.body?.Body as string) || "";
        const profileName = (req.body?.ProfileName as string) || null;
        const mediaUrls = parseMediaUrls(req.body);

        const contactId = await upsertWhatsappContact({ workspaceId, phoneNumberE164: from, profileName });
        const conversationId = await getOrCreateOpenConversation({ workspaceId, senderId, contactId });

        const now = new Date();
        await db.insert(messages).values({
          conversationId,
          direction: "inbound",
          body: bodyText,
          mediaUrls,
          twilioMessageSid: req.body?.MessageSid || null,
          status: "delivered",
          createdAt: now,
        });

        await db.update(conversations).set({ lastMessageAt: now, updatedAt: now }).where(eq(conversations.id, conversationId));

        await db.insert(whatsappSenderEvents).values({
          senderId,
          eventType: "inbound_message",
          rawPayload: req.body,
          createdAt: now,
        });

        // Fire-and-forget automations (welcome / keyword / default reply).
        const isFirst = await isFirstInboundMessage({ contactId });
        void runInboundAutomations({
          workspaceId,
          senderId,
          contactId,
          inboundText: bodyText,
          baseUrl: buildBaseUrl(req.get("host") || undefined),
          isFirstInbound: isFirst,
        });

        res.type("text/xml").send("<Response/>");
      } catch (e: any) {
        console.error("[WhatsApp] inbound webhook error:", e);
        res.status(200).type("text/xml").send("<Response/>");
      }
    },
  );

  router.post(
    "/api/webhooks/twilio/whatsapp/status/:senderId/:webhookSecret",
    validateWhatsappWebhook,
    async (req: WhatsappWebhookRequest, res: Response) => {
      try {
        const senderId = req.senderId!;
        const now = new Date();

        const status = (req.body?.MessageStatus as string) || (req.body?.Status as string) || null;
        const messageSid = (req.body?.MessageSid as string) || (req.body?.SmsSid as string) || null;

        if (status && messageSid) {
          await db.update(messages).set({ status }).where(eq(messages.twilioMessageSid, messageSid));
        }

        // Sender lifecycle events from Twilio Senders API may also hit here; capture raw.
        await db.insert(whatsappSenderEvents).values({
          senderId,
          eventType: "status_callback",
          rawPayload: req.body,
          createdAt: now,
        });

        res.json({ ok: true });
      } catch (e) {
        console.error("[WhatsApp] status webhook error:", e);
        res.json({ ok: true });
      }
    },
  );

  return router;
}

