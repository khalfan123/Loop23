/**
 * Out-of-band delivery channels for relay-cleanup alerts.
 *
 * The relay-cleanup-monitor fires an in-app notification (bell + banner) when
 * the per-workspace cleanup-event threshold is crossed. Operators who don't
 * sit in the app all day still need to find out — this module mirrors the
 * same payload to:
 *   • email (workspace owner, or a custom destination), via the existing
 *     `EmailService.sendEmail` transport
 *   • a workspace-configured webhook URL, signed with HMAC-SHA256 in the
 *     same `X-Webhook-Signature: sha256=…` form used by
 *     `webhook-delivery.ts`
 *
 * Per-channel enablement, destination, and webhook secret live in the
 * existing `global_settings` table under the key
 *   `relay_alert_delivery:<workspaceUserId>`
 * so no schema migration is required. When neither channel is enabled the
 * dispatcher is a no-op.
 *
 * Throttling: this module does NOT add its own cooldown — it is only ever
 * invoked from the in-app alert branch in `relay-cleanup-monitor.ts`, which
 * already enforces a per-workspace cooldown. That guarantees email/webhook
 * traffic is bounded by the same 1×/30min ceiling as the bell notification.
 */

import crypto from 'crypto';
import { storage } from '../storage';
import { emailService } from './email-service';
import type { RelayCleanupReason } from './relay-cleanup-monitor';

export interface RelayAlertPayload {
  /** Workspace owner user id, or null when the originating call could not be enriched. */
  userId: string | null;
  /** Number of cleanup events in the rolling window. */
  count: number;
  /** Rolling window length, in milliseconds. */
  windowMs: number;
  /** Human-friendly reason summary, e.g. `hop2-no-answer×3, hop2-failed×1`. */
  reasons: string;
  /** Up to N agent E.164 targets seen in the window. */
  targets: string[];
  /** Up to N relay E.164 numbers seen in the window. */
  relays: string[];
  /** Up to N humanIncomingConnections.id values seen in the window. */
  connections: string[];
  /** Pre-rendered plain-text message used for the in-app alert. Email/webhook reuse it for consistency. */
  message: string;
  /** ISO-8601 timestamp of the alert. */
  occurredAt: string;
}

export interface RelayAlertDeliveryConfig {
  emailEnabled: boolean;
  /** Optional override; when omitted the workspace owner's `users.email` is used. */
  emailTo?: string | null;
  webhookEnabled: boolean;
  webhookUrl?: string | null;
  /** Optional HMAC secret. When omitted, no signature header is sent. */
  webhookSecret?: string | null;
}

const SETTING_KEY_PREFIX = 'relay_alert_delivery:';
const WEBHOOK_TIMEOUT_MS = 30_000;

export function settingKeyFor(userId: string): string {
  return `${SETTING_KEY_PREFIX}${userId}`;
}

function sanitizeConfig(value: unknown): RelayAlertDeliveryConfig | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  return {
    emailEnabled: v.emailEnabled === true,
    emailTo: typeof v.emailTo === 'string' && v.emailTo.trim() ? v.emailTo.trim() : null,
    webhookEnabled: v.webhookEnabled === true,
    webhookUrl: typeof v.webhookUrl === 'string' && v.webhookUrl.trim() ? v.webhookUrl.trim() : null,
    webhookSecret: typeof v.webhookSecret === 'string' && v.webhookSecret.trim() ? v.webhookSecret.trim() : null,
  };
}

async function loadConfig(userId: string): Promise<RelayAlertDeliveryConfig | null> {
  try {
    const row = await storage.getGlobalSetting(settingKeyFor(userId));
    if (!row) return null;
    return sanitizeConfig(row.value);
  } catch (err: any) {
    console.error(`[RelayAlertChannels] failed to load config for ${userId}: ${err?.message || err}`);
    return null;
  }
}

async function resolveEmailRecipient(userId: string, override?: string | null): Promise<string | null> {
  if (override) return override;
  try {
    const user = await storage.getUser(userId);
    return user?.email || null;
  } catch (err: any) {
    console.error(`[RelayAlertChannels] failed to resolve owner email for ${userId}: ${err?.message || err}`);
    return null;
  }
}

function renderEmailHtml(payload: RelayAlertPayload): string {
  const rows: Array<[string, string]> = [
    ['Cleanup events', String(payload.count)],
    ['Window', `${Math.round(payload.windowMs / 60_000)} min`],
    ['Reasons', payload.reasons || 'n/a'],
    ['Connection(s)', payload.connections.length ? payload.connections.join(', ') : 'n/a'],
    ['Agent target(s)', payload.targets.length ? payload.targets.join(', ') : 'n/a'],
    ['Relay number(s)', payload.relays.length ? payload.relays.join(', ') : 'n/a'],
    ['Occurred at', payload.occurredAt],
  ];
  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${escapeHtml(label)}</td>` +
        `<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:500;">${escapeHtml(value)}</td></tr>`,
    )
    .join('');
  return (
    `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;">` +
    `<h2 style="margin:0 0 12px 0;">Calls are not reaching your human agent</h2>` +
    `<p style="margin:0 0 16px 0;color:#4b5563;">${escapeHtml(payload.message)}</p>` +
    `<table style="width:100%;border-collapse:collapse;font-size:14px;">${tableRows}</table>` +
    `<p style="margin-top:16px;color:#6b7280;font-size:12px;">` +
    `This alert is throttled to once every 30 minutes per workspace.` +
    `</p></div>`
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendEmailAlert(
  userId: string,
  cfg: RelayAlertDeliveryConfig,
  payload: RelayAlertPayload,
): Promise<void> {
  const to = await resolveEmailRecipient(userId, cfg.emailTo);
  if (!to) {
    console.warn(`[RelayAlertChannels] email enabled but no recipient resolvable for ${userId}; skipping`);
    return;
  }
  const subject = `[Alert] Human-agent transfers are failing (${payload.count} in last ${Math.round(
    payload.windowMs / 60_000,
  )} min)`;
  try {
    const result = await emailService.sendEmail(to, subject, renderEmailHtml(payload), undefined, {
      text: payload.message,
    });
    if (!result.success) {
      console.error(`[RelayAlertChannels] email delivery failed to ${to}: ${result.error}`);
    } else {
      console.log(`[RelayAlertChannels] email delivered to ${to} (msg=${result.messageId})`);
    }
  } catch (err: any) {
    console.error(`[RelayAlertChannels] email delivery threw for ${to}: ${err?.message || err}`);
  }
}

interface FetchLike {
  (input: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }): Promise<{
    ok: boolean;
    status: number;
  }>;
}

let fetchImpl: FetchLike = (globalThis.fetch as unknown as FetchLike);

async function postWebhookAlert(
  cfg: RelayAlertDeliveryConfig,
  payload: RelayAlertPayload,
): Promise<void> {
  const url = cfg.webhookUrl;
  if (!url) return;
  const body = JSON.stringify({
    event: 'human_agent_relay.failures_threshold',
    timestamp: payload.occurredAt,
    data: payload,
  });
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Loop23-RelayAlert/1.0',
    'X-Webhook-Event': 'human_agent_relay.failures_threshold',
    'X-Webhook-Delivery': crypto.randomUUID(),
  };
  if (cfg.webhookSecret) {
    headers['X-Webhook-Signature'] =
      'sha256=' + crypto.createHmac('sha256', cfg.webhookSecret).update(body).digest('hex');
  }
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[RelayAlertChannels] webhook POST ${url} returned ${res.status}`);
    } else {
      console.log(`[RelayAlertChannels] webhook delivered to ${url} (status=${res.status})`);
    }
  } catch (err: any) {
    console.error(`[RelayAlertChannels] webhook POST ${url} failed: ${err?.message || err}`);
  }
}

/**
 * Fan out an already-throttled relay-cleanup alert to whichever external
 * channels the workspace has enabled. Never throws.
 */
export async function dispatchRelayAlert(payload: RelayAlertPayload): Promise<void> {
  if (!payload.userId) return; // No workspace context => nowhere to deliver.
  const cfg = await loadConfig(payload.userId);
  if (!cfg) return;
  const tasks: Array<Promise<void>> = [];
  if (cfg.emailEnabled) tasks.push(sendEmailAlert(payload.userId, cfg, payload));
  if (cfg.webhookEnabled && cfg.webhookUrl) tasks.push(postWebhookAlert(cfg, payload));
  if (tasks.length === 0) return;
  await Promise.allSettled(tasks);
}

// ─── Test helpers (not part of the public runtime surface) ───────────────
export const __test__ = {
  setFetch(f: FetchLike): void {
    fetchImpl = f;
  },
  resetFetch(): void {
    fetchImpl = globalThis.fetch as unknown as FetchLike;
  },
  sanitizeConfig,
  renderEmailHtml,
};
