'use strict';
/**
 * Twilio SMS webhook endpoints (parallel to whatsapp-webhooks.ts).
 *
 *   POST /api/webhooks/twilio/sms/inbound    → inbound SMS from a contact
 *   POST /api/webhooks/twilio/sms/status     → delivery status callbacks
 *
 * The workspace is discovered by looking up phone_numbers.phone_number = To
 * (for inbound) and messages.twilio_message_sid = MessageSid (for status).
 * Signature validation uses the workspace's subaccount auth token (falling
 * back to the platform auth token if the workspace isn't on a subaccount).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import twilio from 'twilio';
import { db } from '../db';
import {
  phoneNumbers,
  workspaces,
  workspaceSmsSettings,
  conversations,
  messages,
} from '@shared/schema';
import { unsealString } from '../utils/crypto-seal';
import { normalizePhoneForStorage } from '../utils/phone-e164';
import { chargeSmsSegments } from '../services/credit-service';
import {
  getEnvTwilioCredentials,
} from '../services/twilio-connector';

interface SmsWebhookRequest extends Request {
  resolvedWorkspaceId?: string;
  resolvedAuthToken?: string;
  resolvedPhoneNumberId?: string;
  resolvedOwnerUserId?: string;
}

function buildAbsoluteUrl(req: Request): string {
  const proto = (req.header('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
  const host = req.header('x-forwarded-host') || req.get('host');
  return `${proto}://${host}${req.originalUrl}`;
}

/**
 * Resolve which workspace owns the `To` number and validate the Twilio
 * signature against that workspace's subaccount auth token (or the platform
 * token if the workspace isn't on a subaccount). Attaches the resolved
 * workspaceId / authToken to the request.
 */
async function validateInboundSms(req: SmsWebhookRequest, res: Response, next: NextFunction) {
  try {
    const toRaw = (req.body?.To as string) || '';
    const to = normalizePhoneForStorage(toRaw);
    if (!to) return res.status(400).send('Missing To');

    const [pn] = await db
      .select({
        id: phoneNumbers.id,
        userId: phoneNumbers.userId,
        workspaceId: phoneNumbers.workspaceId,
      })
      .from(phoneNumbers)
      .where(eq(phoneNumbers.phoneNumber, to))
      .limit(1);

    if (!pn || !pn.workspaceId || !pn.userId) {
      return res.status(404).send('Number not owned by any workspace');
    }

    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, pn.workspaceId)).limit(1);
    if (!ws) return res.status(404).send('Workspace not found');

    let authToken: string | null = null;
    if (ws.twilioSubaccountAuthTokenEnc) {
      authToken = unsealString(ws.twilioSubaccountAuthTokenEnc);
    } else {
      const env = getEnvTwilioCredentials();
      authToken = env.authToken;
    }
    if (!authToken) {
      return res.status(503).send('Twilio auth token unavailable for signature validation');
    }

    const signature = req.header('X-Twilio-Signature') || '';
    const url = buildAbsoluteUrl(req);
    const isValid = twilio.validateRequest(authToken, signature, url, req.body || {});
    if (!isValid && process.env.NODE_ENV === 'production') {
      return res.status(403).send('Invalid Twilio signature');
    }

    req.resolvedWorkspaceId = ws.id;
    req.resolvedAuthToken = authToken;
    req.resolvedPhoneNumberId = pn.id;
    req.resolvedOwnerUserId = pn.userId;
    next();
  } catch (err: any) {
    console.error('[sms] inbound validation failed:', err);
    res.status(500).send('Webhook validation error');
  }
}

/**
 * Status callbacks: looked up by MessageSid. We accept any signature in dev
 * (Twilio sends from a master account in some cases), but enforce it in
 * production using the workspace's auth token.
 */
async function validateStatusSms(req: SmsWebhookRequest, res: Response, next: NextFunction) {
  try {
    const messageSid = (req.body?.MessageSid as string) || (req.body?.SmsSid as string) || null;
    if (!messageSid) return res.status(400).send('Missing MessageSid');

    const [msg] = await db
      .select({ id: messages.id, conversationId: messages.conversationId })
      .from(messages)
      .where(eq(messages.twilioMessageSid, messageSid))
      .limit(1);
    if (!msg) {
      // Status for an unknown message — ack so Twilio doesn't keep retrying.
      return res.status(200).send('<Response/>');
    }
    const [convo] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, msg.conversationId))
      .limit(1);
    if (!convo) return res.status(200).send('<Response/>');

    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, convo.workspaceId)).limit(1);
    if (!ws) return res.status(200).send('<Response/>');

    let authToken: string | null = null;
    if (ws.twilioSubaccountAuthTokenEnc) {
      authToken = unsealString(ws.twilioSubaccountAuthTokenEnc);
    } else {
      authToken = getEnvTwilioCredentials().authToken;
    }

    if (process.env.NODE_ENV === 'production' && authToken) {
      const signature = req.header('X-Twilio-Signature') || '';
      const url = buildAbsoluteUrl(req);
      const isValid = twilio.validateRequest(authToken, signature, url, req.body || {});
      if (!isValid) return res.status(403).send('Invalid Twilio signature');
    }

    req.resolvedWorkspaceId = ws.id;
    next();
  } catch (err: any) {
    console.error('[sms] status validation failed:', err);
    res.status(200).send('<Response/>');
  }
}

export function createSmsWebhookRoutes(): Router {
  const router = Router();

  router.post('/api/webhooks/twilio/sms/inbound', validateInboundSms, async (req: SmsWebhookRequest, res: Response) => {
    try {
      const workspaceId = req.resolvedWorkspaceId!;
      const fromRaw = (req.body?.From as string) || '';
      const from = normalizePhoneForStorage(fromRaw);
      const bodyText = (req.body?.Body as string) || '';
      const messageSid = (req.body?.MessageSid as string) || (req.body?.SmsSid as string) || null;
      const numSegmentsRaw = req.body?.NumSegments;
      const numSegments = numSegmentsRaw ? Number(numSegmentsRaw) : null;

      // Upsert open SMS conversation for (workspace, peer).
      const [existing] = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.workspaceId, workspaceId),
            eq(conversations.channel, 'sms'),
            eq(conversations.peerPhoneE164, from),
          ),
        )
        .orderBy(desc(conversations.lastMessageAt))
        .limit(1);

      const now = new Date();
      let conversationId = existing?.id;
      if (!conversationId) {
        const [created] = await db
          .insert(conversations)
          .values({
            workspaceId,
            channel: 'sms',
            peerPhoneE164: from,
            status: 'open',
            lastMessageAt: now,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        conversationId = created.id;
      }

      await db.insert(messages).values({
        conversationId,
        direction: 'inbound',
        body: bodyText,
        mediaUrls: [],
        twilioMessageSid: messageSid,
        status: 'delivered',
        numSegments,
        createdAt: now,
      });

      await db
        .update(conversations)
        .set({ lastMessageAt: now, updatedAt: now })
        .where(eq(conversations.id, conversationId));

      res.type('text/xml').send('<Response/>');
    } catch (err: any) {
      console.error('[sms] inbound webhook error:', err);
      // Always ack with TwiML so Twilio doesn't keep retrying — we'll
      // investigate failures via logs/observability.
      res.status(200).type('text/xml').send('<Response/>');
    }
  });

  router.post('/api/webhooks/twilio/sms/status', validateStatusSms, async (req: SmsWebhookRequest, res: Response) => {
    try {
      const messageSid = (req.body?.MessageSid as string) || (req.body?.SmsSid as string) || null;
      const status = (req.body?.MessageStatus as string) || (req.body?.SmsStatus as string) || null;
      const errorCode = (req.body?.ErrorCode as string) || null;
      const numSegmentsRaw = req.body?.NumSegments;
      const actualSegments = numSegmentsRaw ? Number(numSegmentsRaw) : null;

      if (!messageSid) return res.json({ ok: true });

      // Find our record + owning conversation/workspace before updating.
      const [msg] = await db.select().from(messages).where(eq(messages.twilioMessageSid, messageSid)).limit(1);
      if (!msg) return res.json({ ok: true });

      const [convo] = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, msg.conversationId))
        .limit(1);
      const [ws] = convo
        ? await db.select().from(workspaces).where(eq(workspaces.id, convo.workspaceId)).limit(1)
        : [null];

      const update: Record<string, any> = {};
      if (status) update.status = status;
      if (errorCode) update.errorCode = errorCode;
      if (actualSegments && actualSegments > (msg.numSegments ?? 0)) {
        update.numSegments = actualSegments;
      }
      if (Object.keys(update).length) {
        await db.update(messages).set(update).where(eq(messages.id, msg.id));
      }

      // Reconcile credit charge if Twilio reported more segments than we estimated.
      if (
        actualSegments &&
        actualSegments > (msg.numSegments ?? 0) &&
        msg.direction === 'outbound' &&
        ws?.ownerUserId
      ) {
        const delta = actualSegments - (msg.numSegments ?? 0);
        await chargeSmsSegments({
          userId: ws.ownerUserId,
          twilioMessageSid: messageSid,
          segments: delta,
          destinationCountry: msg.destinationCountry,
          subRef: 'reconcile',
        });
      }

      res.json({ ok: true });
    } catch (err: any) {
      console.error('[sms] status webhook error:', err);
      res.json({ ok: true });
    }
  });

  return router;
}
