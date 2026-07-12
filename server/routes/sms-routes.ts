'use strict';
/**
 * SMS conversation panel — workspace-scoped REST API.
 *
 *   GET    /api/sms/settings                          → current sender config
 *   PUT    /api/sms/settings                          → save sender config
 *                                                       (auto-configures Twilio webhook)
 *   GET    /api/sms/numbers                           → SMS-capable owned numbers
 *   GET    /api/sms/conversations                     → workspace SMS conversations
 *   POST   /api/sms/conversations                     → start (or upsert) a thread
 *   GET    /api/sms/conversations/:id/messages        → fetch thread
 *   POST   /api/sms/messages                          → send outbound SMS
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  workspaceSmsSettings,
  phoneNumbers,
  conversations,
  messages,
} from '@shared/schema';
import { RouteContext, AuthRequest } from './common';
import { WorkspaceService } from '../services/workspace-service';
import { getWorkspaceTwilioClient } from '../services/twilio-connector';
import { getDomain } from '../utils/domain';
import { sendSms, SmsConfigurationError, SmsInsufficientCreditsError } from '../services/sms-service';
import { normalizeTransferPhoneE164 } from '../utils/phone-e164';
import { getSmsRateForCountry } from '../services/credit-service';
import { resolveCountryFromE164 } from '../utils/country-from-e164';

/**
 * Coerce empty strings to null on the optional ID fields so a stale client
 * sending `phoneNumberId: ""` doesn't trip the UUID validator. The other
 * sender-type-specific fields stay nullable + optional + permissive on
 * empty values for the same reason.
 */
const nullableString = (schema: z.ZodString) =>
  z
    .union([schema, z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" || v === null || v === undefined ? null : v));

const settingsSchema = z.object({
  senderType: z.enum(['phone_number', 'messaging_service', 'alphanumeric']),
  phoneNumberId: nullableString(z.string().uuid()),
  messagingServiceSid: nullableString(z.string().regex(/^MG[0-9a-fA-F]{32}$/)),
  // Alphanumeric sender ID: 11 chars max, must start with a letter, Latin
  // alphanumeric + spaces only. Enforced both client- and server-side.
  alphanumericSender: nullableString(
    z
      .string()
      .regex(
        /^[A-Za-z][A-Za-z0-9 ]{0,10}$/,
        '11 chars max, start with a letter, Latin alphanumeric + spaces only',
      ),
  ),
});

const conversationSchema = z.object({
  peerPhoneE164: z.string().min(4),
});

const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().min(1).max(1600),
});

const startAndSendSchema = z.object({
  peerPhoneE164: z.string().min(4),
  body: z.string().min(1).max(1600),
});

/**
 * Best-effort: PATCH the Twilio incoming phone number's smsUrl so inbound
 * SMS routes to our webhook. Not fatal — if it fails the user can paste
 * the URL into the Twilio Console manually.
 */
async function configureInboundWebhookForNumber(params: {
  workspaceId: string;
  twilioSid: string;
  hostHeader?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = await getWorkspaceTwilioClient(params.workspaceId);
    const smsUrl = `${getDomain(params.hostHeader)}/api/webhooks/twilio/sms/inbound`;
    await (client as any).incomingPhoneNumbers(params.twilioSid).update({
      smsUrl,
      smsMethod: 'POST',
    });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed to configure Twilio webhook' };
  }
}

export function createSmsRoutes(ctx: RouteContext): Router {
  const router = Router();
  const { authenticateToken } = ctx;

  // ────────────────────────────────────────────────────────────
  // Sender configuration
  // ────────────────────────────────────────────────────────────

  router.get('/api/sms/settings', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
      if (!workspace) return res.status(400).json({ error: 'No workspace found for user' });

      const [settings] = await db
        .select()
        .from(workspaceSmsSettings)
        .where(eq(workspaceSmsSettings.workspaceId, workspace.id))
        .limit(1);

      const defaultRate = await getSmsRateForCountry(null);

      res.json({
        settings: settings ?? null,
        defaultCreditsPerSegment: defaultRate,
      });
    } catch (e: any) {
      console.error('[sms] GET /api/sms/settings failed:', e);
      res.status(500).json({ error: e?.message || 'Failed to load SMS settings' });
    }
  });

  router.put('/api/sms/settings', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      // Log the incoming payload so we can diagnose validation failures from
      // the server terminal without needing the browser console.
      console.log('[sms] PUT /api/sms/settings — incoming body:', JSON.stringify(req.body));

      const parsed = settingsSchema.safeParse(req.body);
      if (!parsed.success) {
        // Surface the first field-level message so the toast tells the user
        // *why* their input was rejected (e.g. "11 chars max, start with a
        // letter…") instead of a generic "Invalid settings".
        const flat = parsed.error.flatten();
        const firstFieldError = Object.values(flat.fieldErrors)[0]?.[0];
        const firstFormError = flat.formErrors[0];
        const specific = firstFieldError || firstFormError;
        console.warn('[sms] PUT /api/sms/settings — validation failed:', JSON.stringify(flat));
        return res.status(400).json({
          error: specific ? `Invalid settings: ${specific}` : 'Invalid settings',
          details: flat,
        });
      }
      const { senderType, phoneNumberId, messagingServiceSid, alphanumericSender } = parsed.data;

      const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
      if (!workspace) return res.status(400).json({ error: 'No workspace found for user' });

      // Sender-shape validation
      if (senderType === 'phone_number') {
        if (!phoneNumberId) return res.status(400).json({ error: 'phoneNumberId is required when senderType=phone_number' });
        const [pn] = await db
          .select()
          .from(phoneNumbers)
          .where(and(eq(phoneNumbers.id, phoneNumberId), eq(phoneNumbers.userId, req.userId!)))
          .limit(1);
        if (!pn) return res.status(400).json({ error: 'You do not own that phone number' });
        // Soft-require SMS capability — Twilio's response shape is jsonb so be lenient.
        const caps = (pn.capabilities as any) || {};
        if (caps.sms === false || caps.SMS === false) {
          return res.status(400).json({ error: 'Selected number is not SMS-capable' });
        }
      } else if (senderType === 'messaging_service') {
        if (!messagingServiceSid) return res.status(400).json({ error: 'messagingServiceSid is required when senderType=messaging_service' });
      } else if (senderType === 'alphanumeric') {
        if (!alphanumericSender) return res.status(400).json({ error: 'alphanumericSender is required when senderType=alphanumeric' });
      }

      const now = new Date();
      const valuesToWrite = {
        workspaceId: workspace.id,
        senderType,
        phoneNumberId: senderType === 'phone_number' ? phoneNumberId ?? null : null,
        messagingServiceSid: senderType === 'messaging_service' ? messagingServiceSid ?? null : null,
        alphanumericSender: senderType === 'alphanumeric' ? alphanumericSender ?? null : null,
        // Inbound webhook is meaningful only for direct phone-number senders.
        // Messaging Services route inbound through the service's own webhook,
        // and alphanumeric senders cannot receive replies at all.
        inboundWebhookConfigured: false,
        complianceStatus: 'unknown',
        updatedAt: now,
      };

      const [existing] = await db
        .select()
        .from(workspaceSmsSettings)
        .where(eq(workspaceSmsSettings.workspaceId, workspace.id))
        .limit(1);

      let row;
      if (existing) {
        [row] = await db
          .update(workspaceSmsSettings)
          .set(valuesToWrite)
          .where(eq(workspaceSmsSettings.id, existing.id))
          .returning();
      } else {
        [row] = await db
          .insert(workspaceSmsSettings)
          .values({ ...valuesToWrite, createdAt: now })
          .returning();
      }

      // Auto-configure inbound webhook only when senderType=phone_number (Messaging
      // Service-managed numbers get their inbound webhook from the Messaging Service).
      let webhookResult: { ok: boolean; error?: string } = { ok: true };
      if (senderType === 'phone_number' && phoneNumberId) {
        const [pn] = await db
          .select({ twilioSid: phoneNumbers.twilioSid })
          .from(phoneNumbers)
          .where(eq(phoneNumbers.id, phoneNumberId))
          .limit(1);
        if (pn?.twilioSid) {
          webhookResult = await configureInboundWebhookForNumber({
            workspaceId: workspace.id,
            twilioSid: pn.twilioSid,
            hostHeader: req.get('host') || undefined,
          });
          if (webhookResult.ok) {
            await db
              .update(workspaceSmsSettings)
              .set({ inboundWebhookConfigured: true, updatedAt: new Date() })
              .where(eq(workspaceSmsSettings.id, row.id));
            row.inboundWebhookConfigured = true;
          }
        }
      }

      res.json({
        settings: row,
        webhook: webhookResult,
      });
    } catch (e: any) {
      console.error('[sms] PUT /api/sms/settings failed:', e);
      res.status(500).json({ error: e?.message || 'Failed to save SMS settings' });
    }
  });

  /**
   * Remove the workspace's SMS sender configuration entirely. After this
   * call, the workspace can't send SMS until a new sender is saved. Used by
   * the "Remove sender" button in the Setup UI.
   */
  router.delete('/api/sms/settings', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
      if (!workspace) return res.status(400).json({ error: 'No workspace found for user' });

      const deleted = await db
        .delete(workspaceSmsSettings)
        .where(eq(workspaceSmsSettings.workspaceId, workspace.id))
        .returning();

      res.json({ ok: true, removed: deleted.length });
    } catch (e: any) {
      console.error('[sms] DELETE /api/sms/settings failed:', e);
      res.status(500).json({ error: e?.message || 'Failed to remove SMS settings' });
    }
  });

  // ────────────────────────────────────────────────────────────
  // Sender candidates
  // ────────────────────────────────────────────────────────────

  router.get('/api/sms/numbers', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
      if (!workspace) return res.status(400).json({ error: 'No workspace found for user' });

      // Pull all numbers owned by this user — UI filters out non-SMS in JS so
      // we don't need a complicated jsonb query here.
      const rows = await db
        .select({
          id: phoneNumbers.id,
          phoneNumber: phoneNumbers.phoneNumber,
          friendlyName: phoneNumbers.friendlyName,
          country: phoneNumbers.country,
          capabilities: phoneNumbers.capabilities,
          numberType: phoneNumbers.numberType,
          status: phoneNumbers.status,
        })
        .from(phoneNumbers)
        .where(eq(phoneNumbers.userId, req.userId!))
        .orderBy(desc(phoneNumbers.purchasedAt));

      const smsCapable = rows.filter((r) => {
        const c = (r.capabilities as any) || {};
        // Default to true when capability metadata is missing (legacy rows).
        return c.sms !== false && c.SMS !== false;
      });

      // Surface a soft compliance hint per number. US long-codes and toll-free
      // need A2P 10DLC / TF verification respectively to avoid heavy filtering.
      const annotated = smsCapable.map((r) => {
        let complianceHint: 'a2p_required' | 'toll_free_verification_required' | 'international' | 'ok' = 'ok';
        if (r.country === 'US') {
          if (r.numberType === 'toll-free' || r.numberType === 'tollfree' || r.numberType === 'toll_free') {
            complianceHint = 'toll_free_verification_required';
          } else if (r.numberType === 'local' || r.numberType === 'mobile') {
            complianceHint = 'a2p_required';
          }
        } else if (r.country && r.country !== 'CA') {
          complianceHint = 'international';
        }
        return { ...r, complianceHint };
      });

      res.json(annotated);
    } catch (e: any) {
      console.error('[sms] GET /api/sms/numbers failed:', e);
      res.status(500).json({ error: e?.message || 'Failed to load SMS numbers' });
    }
  });

  // ────────────────────────────────────────────────────────────
  // Conversations & messages
  // ────────────────────────────────────────────────────────────

  router.get('/api/sms/conversations', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
      if (!workspace) return res.status(400).json({ error: 'No workspace found for user' });

      const rows = await db
        .select()
        .from(conversations)
        .where(and(eq(conversations.workspaceId, workspace.id), eq(conversations.channel, 'sms')))
        .orderBy(desc(conversations.lastMessageAt))
        .limit(200);
      res.json(rows);
    } catch (e: any) {
      console.error('[sms] GET /api/sms/conversations failed:', e);
      res.status(500).json({ error: e?.message || 'Failed to load conversations' });
    }
  });

  router.post('/api/sms/conversations', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const parsed = conversationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      }
      const normalized = normalizeTransferPhoneE164(parsed.data.peerPhoneE164);
      if (!normalized.ok) {
        return res.status(400).json({ error: normalized.error });
      }

      const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
      if (!workspace) return res.status(400).json({ error: 'No workspace found for user' });

      // Reuse an existing open thread for this peer (keeps history together).
      const [existing] = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.workspaceId, workspace.id),
            eq(conversations.channel, 'sms'),
            eq(conversations.peerPhoneE164, normalized.e164),
          ),
        )
        .orderBy(desc(conversations.lastMessageAt))
        .limit(1);

      if (existing) {
        return res.json(existing);
      }

      const now = new Date();
      const [created] = await db
        .insert(conversations)
        .values({
          workspaceId: workspace.id,
          channel: 'sms',
          peerPhoneE164: normalized.e164,
          status: 'open',
          lastMessageAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      res.json(created);
    } catch (e: any) {
      console.error('[sms] POST /api/sms/conversations failed:', e);
      res.status(500).json({ error: e?.message || 'Failed to start conversation' });
    }
  });

  router.get('/api/sms/conversations/:id/messages', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
      if (!workspace) return res.status(400).json({ error: 'No workspace found for user' });

      const conversationId = String(req.params.id);
      const [convo] = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);
      if (!convo || convo.workspaceId !== workspace.id || convo.channel !== 'sms') {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      const rows = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(messages.createdAt)
        .limit(500);
      res.json(rows);
    } catch (e: any) {
      console.error('[sms] GET /api/sms/conversations/:id/messages failed:', e);
      res.status(500).json({ error: e?.message || 'Failed to load messages' });
    }
  });

  router.post('/api/sms/messages', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const parsed = sendMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      }
      const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
      if (!workspace) return res.status(400).json({ error: 'No workspace found for user' });

      const [convo] = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, parsed.data.conversationId))
        .limit(1);
      if (!convo || convo.workspaceId !== workspace.id || convo.channel !== 'sms') {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      if (!convo.peerPhoneE164) {
        return res.status(400).json({ error: 'Conversation is missing a peer phone number' });
      }

      // Credits are charged against the workspace owner (billing party), not
      // the individual member who clicked Send. This keeps reconciliation
      // via the status callback consistent with the original charge.
      console.log('[sms] POST /api/sms/messages — workspace=%s to=%s bodyLen=%d', workspace.id, convo.peerPhoneE164, parsed.data.body.length);
      const result = await sendSms({
        workspaceId: workspace.id,
        userId: workspace.ownerUserId,
        conversationId: convo.id,
        to: convo.peerPhoneE164,
        body: parsed.data.body,
        hostHeader: req.get('host') || undefined,
      });

      res.json(result);
    } catch (e: any) {
      if (e instanceof SmsConfigurationError) {
        console.warn('[sms] POST /api/sms/messages — config error:', e.message);
        return res.status(409).json({ error: e.message, code: 'sms_not_configured' });
      }
      if (e instanceof SmsInsufficientCreditsError) {
        console.warn('[sms] POST /api/sms/messages — insufficient credits:', e.message);
        return res.status(402).json({ error: e.message, code: 'insufficient_credits' });
      }
      console.error('[sms] POST /api/sms/messages failed:', e);
      res.status(500).json({ error: e?.message || 'Failed to send message' });
    }
  });

  /**
   * Convenience endpoint: start a conversation AND send the first message in
   * a single round-trip. Used by the "New conversation" dialog in the UI.
   */
  router.post('/api/sms/quick-send', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const parsed = startAndSendSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      }
      const normalized = normalizeTransferPhoneE164(parsed.data.peerPhoneE164);
      if (!normalized.ok) {
        return res.status(400).json({ error: normalized.error });
      }

      const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
      if (!workspace) return res.status(400).json({ error: 'No workspace found for user' });

      const [existing] = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.workspaceId, workspace.id),
            eq(conversations.channel, 'sms'),
            eq(conversations.peerPhoneE164, normalized.e164),
          ),
        )
        .orderBy(desc(conversations.lastMessageAt))
        .limit(1);

      let conversationId = existing?.id;
      if (!conversationId) {
        const now = new Date();
        const [created] = await db
          .insert(conversations)
          .values({
            workspaceId: workspace.id,
            channel: 'sms',
            peerPhoneE164: normalized.e164,
            status: 'open',
            lastMessageAt: now,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        conversationId = created.id;
      }

      console.log('[sms] POST /api/sms/quick-send — workspace=%s to=%s bodyLen=%d', workspace.id, normalized.e164, parsed.data.body.length);
      const result = await sendSms({
        workspaceId: workspace.id,
        userId: workspace.ownerUserId,
        conversationId,
        to: normalized.e164,
        body: parsed.data.body,
        hostHeader: req.get('host') || undefined,
      });

      res.json({ conversationId, ...result });
    } catch (e: any) {
      if (e instanceof SmsConfigurationError) {
        console.warn('[sms] POST /api/sms/quick-send — config error:', e.message);
        return res.status(409).json({ error: e.message, code: 'sms_not_configured' });
      }
      if (e instanceof SmsInsufficientCreditsError) {
        console.warn('[sms] POST /api/sms/quick-send — insufficient credits:', e.message);
        return res.status(402).json({ error: e.message, code: 'insufficient_credits' });
      }
      console.error('[sms] POST /api/sms/quick-send failed:', e);
      res.status(500).json({ error: e?.message || 'Failed to send message' });
    }
  });

  /**
   * Pricing preview: returns the rate that would apply for a given peer
   * number. Used by the UI to show "this will cost N credits / segment".
   */
  router.get('/api/sms/rate-preview', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const to = String(req.query.to || '').trim();
      const iso = to ? resolveCountryFromE164(to) : null;
      const creditsPerSegment = await getSmsRateForCountry(iso);
      res.json({ destinationCountry: iso, creditsPerSegment });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to look up rate' });
    }
  });

  return router;
}
