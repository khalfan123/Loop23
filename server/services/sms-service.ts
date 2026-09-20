'use strict';
/**
 * SMS service — single send entry point used by /api/sms/messages and any
 * future automation. Resolves the workspace's SMS sender (phone number or
 * Messaging Service SID), calls Twilio, inserts the outbound `messages`
 * row, and applies a provisional credit charge that is reconciled by the
 * status-callback webhook once Twilio reports the final NumSegments.
 *
 * Per-workspace Twilio subaccount isolation is provided by
 * `getWorkspaceTwilioClient(workspaceId)` from twilio-connector.
 */

import { db } from '../db';
import { eq } from 'drizzle-orm';
import {
  workspaceSmsSettings,
  phoneNumbers,
  conversations,
  messages,
} from '@shared/schema';
import {
  getWorkspaceTwilioClient,
  getTwilioClient,
} from './twilio-connector';
import { WorkspaceService } from './workspace-service';
import {
  chargeSmsSegments,
  estimateSmsSegments,
  getSmsRateForCountry,
} from './credit-service';
import { getDomain } from '../utils/domain';
import { logger } from '../utils/logger';
import { ExternalServiceError } from '../utils/errors';
import { resolveCountryFromE164 } from '../utils/country-from-e164';

export interface SendSmsParams {
  workspaceId: string;
  userId: string;
  conversationId: string;
  to: string;
  body: string;
  /** Used to build the absolute status-callback URL when APP_DOMAIN isn't set. */
  hostHeader?: string;
}

export interface SendSmsResult {
  twilioMessageSid: string;
  status: string;
  segmentsEstimated: number;
  creditsCharged: number;
  ratePerSegment: number;
  destinationCountry: string | null;
}

export class SmsConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SmsConfigurationError';
  }
}

export class SmsInsufficientCreditsError extends Error {
  constructor(message = 'Insufficient credits to send this SMS') {
    super(message);
    this.name = 'SmsInsufficientCreditsError';
  }
}

/**
 * ISO countries where alphanumeric sender IDs are not supported by Twilio.
 * Messages to these destinations will fail with Twilio error 21612 if sent
 * via an alpha sender, so we block them server-side before the API call.
 *
 * Source: https://www.twilio.com/docs/messaging/services/alpha-sender-ids-countries
 */
export const ALPHA_UNSUPPORTED_COUNTRIES = new Set<string>(['US', 'CA', 'CN', 'VN']);

/**
 * Resolve which Twilio sender identity the workspace should use:
 *   - 'messaging_service' → `messagingServiceSid`
 *   - 'phone_number'      → the E.164 of the linked phone_numbers row
 *   - 'alphanumeric'      → a branded string used as `from` (one-way send only)
 */
async function resolveWorkspaceSender(workspaceId: string): Promise<
  | { kind: 'messaging_service'; messagingServiceSid: string }
  | { kind: 'phone_number'; fromE164: string; phoneNumberId: string }
  | { kind: 'alphanumeric'; alphanumericSender: string }
> {
  const [settings] = await db
    .select()
    .from(workspaceSmsSettings)
    .where(eq(workspaceSmsSettings.workspaceId, workspaceId))
    .limit(1);

  if (!settings) {
    throw new SmsConfigurationError(
      'SMS sender is not configured for this workspace. Open SMS → Setup to pick a number, Messaging Service, or alphanumeric sender ID.',
    );
  }

  if (settings.senderType === 'messaging_service') {
    if (!settings.messagingServiceSid) {
      throw new SmsConfigurationError('Messaging Service SID is not set on SMS settings.');
    }
    return { kind: 'messaging_service', messagingServiceSid: settings.messagingServiceSid };
  }

  if (settings.senderType === 'alphanumeric') {
    if (!settings.alphanumericSender) {
      throw new SmsConfigurationError('Alphanumeric sender ID is not set on SMS settings.');
    }
    return { kind: 'alphanumeric', alphanumericSender: settings.alphanumericSender };
  }

  if (!settings.phoneNumberId) {
    throw new SmsConfigurationError('No sender phone number selected for SMS.');
  }
  const [pn] = await db
    .select({ id: phoneNumbers.id, phoneNumber: phoneNumbers.phoneNumber })
    .from(phoneNumbers)
    .where(eq(phoneNumbers.id, settings.phoneNumberId))
    .limit(1);
  if (!pn) {
    throw new SmsConfigurationError('Configured SMS sender number could not be found in your inventory.');
  }
  return { kind: 'phone_number', fromE164: pn.phoneNumber, phoneNumberId: pn.id };
}

/**
 * Send a single outbound SMS for a workspace conversation.
 *
 *   1. Resolve sender (Messaging Service vs. phone number).
 *   2. Pre-flight credit check using the estimated segment count.
 *   3. Twilio messages.create() via the workspace subaccount client (falls
 *      back to the platform client if no subaccount is provisioned).
 *   4. Insert outbound `messages` row, bump conversation lastMessageAt.
 *   5. Provisional credit charge — idempotent on the Twilio MessageSid.
 *
 * The status-callback webhook later reconciles the charge against Twilio's
 * actual `NumSegments`.
 */
export async function sendSms(params: SendSmsParams): Promise<SendSmsResult> {
  const { workspaceId, userId, conversationId, to, body, hostHeader } = params;

  if (!to || !body) {
    throw new Error('to and body are required');
  }

  // Confirm the conversation belongs to this workspace.
  const [convo] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!convo || convo.workspaceId !== workspaceId) {
    throw new Error('Conversation not found for this workspace');
  }

  const sender = await resolveWorkspaceSender(workspaceId);

  // Country and pre-flight credit check.
  const destinationCountry = resolveCountryFromE164(to);
  const segmentsEstimated = estimateSmsSegments(body);
  const ratePerSegment = await getSmsRateForCountry(destinationCountry);
  const provisionalCredits = ratePerSegment * segmentsEstimated;

  // Alphanumeric senders cannot deliver in US/CA/CN/VN. Reject before the
  // Twilio call so the user sees a clear error instead of Twilio 21612.
  if (
    sender.kind === 'alphanumeric' &&
    destinationCountry &&
    ALPHA_UNSUPPORTED_COUNTRIES.has(destinationCountry)
  ) {
    throw new SmsConfigurationError(
      `Alphanumeric senders aren't supported in ${destinationCountry}. ` +
        `Switch to a phone-number sender in SMS → Setup to message this destination.`,
    );
  }

  if (provisionalCredits > 0) {
    const { checkSufficientCredits } = await import('./credit-service');
    const hasCredits = await checkSufficientCredits(userId, provisionalCredits);
    if (!hasCredits) {
      throw new SmsInsufficientCreditsError(
        `This message would cost ${provisionalCredits} credit${provisionalCredits === 1 ? '' : 's'} ` +
          `(${segmentsEstimated} segment${segmentsEstimated === 1 ? '' : 's'} × ${ratePerSegment}/segment). ` +
          `Top up your balance to continue.`,
      );
    }
  }

  // Prefer the workspace-scoped subaccount client; fall back to the platform
  // client if the workspace doesn't have a subaccount yet. The fallback is
  // necessary because brand-new workspaces send through the master account
  // until subaccount provisioning runs.
  let twilioClient: Awaited<ReturnType<typeof getTwilioClient>>;
  try {
    twilioClient = await getWorkspaceTwilioClient(workspaceId);
  } catch {
    twilioClient = await getTwilioClient();
  }

  const statusCallback = `${getDomain(hostHeader)}/api/webhooks/twilio/sms/status`;

  const createParams: any = { to, body, statusCallback };
  if (sender.kind === 'messaging_service') {
    createParams.messagingServiceSid = sender.messagingServiceSid;
  } else if (sender.kind === 'alphanumeric') {
    createParams.from = sender.alphanumericSender;
  } else {
    createParams.from = sender.fromE164;
  }

  let twilioMessage: any;
  try {
    twilioMessage = await (twilioClient as any).messages.create(createParams);
  } catch (err: any) {
    logger.error(`[sms] Twilio messages.create failed: ${err.message}`, err, 'SmsService');
    throw new ExternalServiceError('Twilio', err?.message || 'Failed to send SMS', undefined, {
      operation: 'messages.create',
      workspaceId,
      to,
    });
  }

  const now = new Date();
  await db.insert(messages).values({
    conversationId,
    direction: 'outbound',
    body,
    mediaUrls: [],
    twilioMessageSid: twilioMessage.sid,
    status: twilioMessage.status || 'queued',
    destinationCountry: destinationCountry ?? null,
    numSegments: segmentsEstimated,
    creditsCharged: 0,
    createdAt: now,
  });

  await db
    .update(conversations)
    .set({ lastMessageAt: now, updatedAt: now })
    .where(eq(conversations.id, conversationId));

  // Provisional charge — idempotent on subRef='send'. If the status callback
  // later reports more segments, it will add a 'reconcile' delta row.
  const charge = await chargeSmsSegments({
    userId,
    twilioMessageSid: twilioMessage.sid,
    segments: segmentsEstimated,
    destinationCountry,
    subRef: 'send',
  });

  return {
    twilioMessageSid: twilioMessage.sid,
    status: twilioMessage.status || 'queued',
    segmentsEstimated,
    creditsCharged: charge.creditsDeducted,
    ratePerSegment,
    destinationCountry,
  };
}
