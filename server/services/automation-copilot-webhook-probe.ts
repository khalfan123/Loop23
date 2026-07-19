'use strict';

import dns from 'dns/promises';
import net from 'net';

export type WebhookProbeStatus = 'ok' | 'warn' | 'error';

export type WebhookProbeResult = {
  status: WebhookProbeStatus;
  detail: string;
  httpStatus?: number;
};

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
  'metadata.google.com',
  'metadata',
  '169.254.169.254',
]);

function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h.includes('metadata')) return true;
  return false;
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true; // link-local + cloud metadata
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true; // CGNAT
    return false;
  }
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (normalized === '::1') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    if (normalized.startsWith('fe80')) return true;
    // IPv4-mapped IPv6
    if (normalized.startsWith('::ffff:')) {
      const v4 = normalized.slice(7);
      if (net.isIPv4(v4) && isPrivateIp(v4)) return true;
    }
    return false;
  }
  return false;
}

/**
 * Validate absolute https URL and reject obvious SSRF targets by hostname shape.
 * Production probes are https-only (no plain http) to reduce open-proxy / MITM risk.
 */
export function validateWebhookUrlFormat(
  raw: string,
): { ok: true; url: URL } | { ok: false; reason: string } {
  const trimmed = (raw || '').trim();
  if (!trimmed) {
    return { ok: false, reason: 'Webhook URL is empty — paste a full https:// endpoint.' };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      ok: false,
      reason: `Invalid webhook URL “${trimmed.slice(0, 80)}” — must be a full https:// address.`,
    };
  }
  if (parsed.protocol === 'http:') {
    return {
      ok: false,
      reason: 'Webhook URL must use https:// (plain http is blocked for Test probes).',
    };
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Webhook URL must use https://.' };
  }
  const host = parsed.hostname.toLowerCase();
  if (!host) {
    return { ok: false, reason: 'Webhook URL is missing a hostname.' };
  }
  if (isBlockedHostname(host)) {
    return { ok: false, reason: 'Webhook URL cannot point at localhost, metadata, or internal hosts.' };
  }
  if (net.isIP(host) && isPrivateIp(host)) {
    return { ok: false, reason: 'Webhook URL cannot target a private/internal IP address.' };
  }
  return { ok: true, url: parsed };
}

async function assertPublicHostname(hostname: string): Promise<string | null> {
  if (net.isIP(hostname)) {
    return isPrivateIp(hostname) ? 'Webhook URL resolves to a private IP — blocked.' : null;
  }
  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    if (!records.length) return 'Webhook hostname could not be resolved (DNS).';
    for (const rec of records) {
      if (isPrivateIp(rec.address)) {
        return 'Webhook hostname resolves to a private/internal IP — blocked.';
      }
    }
    return null;
  } catch {
    return `Webhook hostname “${hostname}” could not be resolved — check the URL.`;
  }
}

/**
 * Live-probe a webhook endpoint with a sample payload.
 * Failures (bad URL, DNS, connection, 404/5xx, redirects) return status error.
 * Never follows redirects (SSRF via Location header).
 */
export async function probeWebhookEndpoint(input: {
  url: string;
  method?: string;
  samplePayload: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<WebhookProbeResult> {
  const format = validateWebhookUrlFormat(input.url);
  if (!format.ok) {
    return { status: 'error', detail: format.reason };
  }

  const ssrf = await assertPublicHostname(format.url.hostname);
  if (ssrf) {
    return { status: 'error', detail: ssrf };
  }

  const method = (input.method || 'POST').toUpperCase();
  const timeoutMs = input.timeoutMs ?? 8_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'Loop9-Automation-Test/1.0',
      'X-Loop9-Dry-Run': 'false',
      'X-Loop9-Test-Probe': '1',
    };
    const init: RequestInit = {
      method,
      headers,
      redirect: 'manual',
      signal: controller.signal,
    };
    if (method !== 'GET' && method !== 'HEAD') {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify({
        ...input.samplePayload,
        _loop9Test: true,
        _probedAt: new Date().toISOString(),
      });
    }

    const response = await fetch(format.url.toString(), init);
    const httpStatus = response.status;

    // Do not follow redirects — Location could point at private IPs
    if (httpStatus >= 300 && httpStatus < 400) {
      return {
        status: 'error',
        httpStatus,
        detail: `Webhook returned HTTP ${httpStatus} redirect — redirects are blocked for security. Use the final https:// URL.`,
      };
    }

    // Cap body read so probes cannot be used as large-response open proxies
    try {
      const reader = response.body?.getReader?.();
      if (reader) {
        const maxBytes = 64 * 1024;
        let total = 0;
        while (total < maxBytes) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value?.byteLength || 0;
        }
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore body drain errors */
    }

    if (httpStatus >= 200 && httpStatus < 300) {
      return {
        status: 'ok',
        httpStatus,
        detail: `Reached endpoint — HTTP ${httpStatus} for ${method} ${format.url.toString()}.`,
      };
    }
    if (httpStatus === 401 || httpStatus === 403) {
      return {
        status: 'warn',
        httpStatus,
        detail: `Endpoint reachable but returned HTTP ${httpStatus} (auth required). URL is valid; add credentials if needed.`,
      };
    }
    if (httpStatus === 404 || httpStatus === 410) {
      return {
        status: 'error',
        httpStatus,
        detail: `Incorrect endpoint — server returned HTTP ${httpStatus}. Check the webhook path/URL.`,
      };
    }
    if (httpStatus >= 500) {
      return {
        status: 'error',
        httpStatus,
        detail: `Endpoint error — HTTP ${httpStatus}. The URL may be wrong or the service is down.`,
      };
    }
    return {
      status: 'error',
      httpStatus,
      detail: `Unexpected HTTP ${httpStatus} from webhook — treat as failed test until the endpoint accepts the request.`,
    };
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (err?.name === 'AbortError' || /aborted|timeout/i.test(msg)) {
      return {
        status: 'error',
        detail: `Webhook timed out after ${timeoutMs}ms — incorrect or unreachable endpoint.`,
      };
    }
    if (/ENOTFOUND|getaddrinfo|EAI_AGAIN/i.test(msg)) {
      return {
        status: 'error',
        detail: 'Incorrect endpoint — hostname could not be resolved (DNS).',
      };
    }
    if (/ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|certificate|SSL/i.test(msg)) {
      return {
        status: 'error',
        detail: `Incorrect or unreachable endpoint — ${msg.slice(0, 160)}`,
      };
    }
    return {
      status: 'error',
      detail: `Webhook probe failed — ${msg.slice(0, 200) || 'unreachable endpoint'}.`,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function stepLooksLikeWebhook(step: {
  appId: string | null;
  config: Record<string, unknown>;
}): boolean {
  const nodeType =
    typeof step.config?.nodeType === 'string' ? step.config.nodeType : null;
  return nodeType === 'webhook' || step.appId === 'webhooks' || step.appId === 'api';
}

export function readWebhookUrl(config: Record<string, unknown>): string {
  if (typeof config.webhookUrl === 'string') return config.webhookUrl.trim();
  if (typeof config.url === 'string') return config.url.trim();
  return '';
}
