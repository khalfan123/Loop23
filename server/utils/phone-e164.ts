/**
 * Normalize caller/called IDs for storage and webhooks (E.164 with +).
 */
export function normalizePhoneForStorage(phone: string): string {
  const s = String(phone).trim().replace(/[\s\-()]/g, '');
  if (!s) return '';
  return s.startsWith('+') ? s : `+${s}`;
}

/**
 * Normalize user-entered transfer destinations to E.164 (+country + subscriber digits).
 * Does not validate numbering-plan specifics per country — Twilio enforces routability.
 */

export type NormalizeTransferPhoneResult =
  | { ok: true; e164: string }
  | { ok: false; error: string };

export function normalizeTransferPhoneE164(raw: string | null | undefined): NormalizeTransferPhoneResult {
  if (raw == null) {
    return { ok: false, error: 'Phone number is required' };
  }
  const trimmed = String(raw).trim();
  if (!trimmed) {
    return { ok: false, error: 'Phone number is required' };
  }

  let s = trimmed.replace(/[\s\-().]/g, '');
  if (!s.startsWith('+')) {
    if (/^\d+$/.test(s)) {
      s = `+${s}`;
    } else {
      return { ok: false, error: 'Use E.164 format with country code (e.g. +971501234567)' };
    }
  }

  const subscriber = s.slice(1);
  if (!/^[1-9]\d{1,14}$/.test(subscriber)) {
    return { ok: false, error: 'Invalid E.164 number (max 15 digits including country code)' };
  }

  return { ok: true, e164: s };
}

/** True if E.164 is UAE (+971…). Used to reject UAE numbers as outbound CLI for Human Agent bridge. */
export function isUaeE164(e164: string): boolean {
  const n = String(e164).replace(/[\s\-().]/g, '');
  // Treat both canonical (+971…) and bare-digit (971…) forms as UAE so non-canonical
  // stored values can't bypass UAE-exclusion checks.
  return n.startsWith('+971') || /^971\d+$/.test(n);
}

/**
 * Human Agent `<Dial>` caller ID: wizard-selected non-UAE Twilio number wins, then env, then generic inbound rules.
 *
 * Generic rules (`resolveTransferDialCallerId`): `TWILIO_TRANSFER_CALLER_ID`, omit UAE toll-free inbound, else inbound DID.
 */
export function resolveHumanAgentBridgeCallerId(options: {
  wizardOutboundPhoneE164?: string | null;
  inboundDid?: string | null;
}): string | undefined {
  const raw = options.wizardOutboundPhoneE164?.trim();
  if (raw) {
    let w = raw.replace(/[\s\-().]/g, '');
    if (!w.startsWith('+') && /^\d+$/.test(w)) w = `+${w}`;
    if (/^\+[1-9]\d{1,14}$/.test(w) && !isUaeE164(w)) {
      return w;
    }
  }
  return resolveTransferDialCallerId(options.inboundDid ?? undefined);
}

/**
 * Caller ID for `<Dial>` when bridging an inbound call to an agent PSTN leg (fallback path without wizard CLI).
 *
 * UAE numbers (+971…) — including toll-free and mobile/landline DIDs — are commonly
 * rejected by UAE carriers as outbound CLI when the destination leg is also UAE.
 * Twilio/carrier guidance: use a non-UAE Twilio number, or omit `callerId` and let
 * Twilio pick a routable presentation number.
 *
 * Priority:
 * 1. `TWILIO_TRANSFER_CALLER_ID` — E.164 Twilio-owned number (e.g. +44… / +1…) used for agent legs.
 * 2. If inbound line is any UAE DID (+971…), return `undefined` (omit `callerId` in TwiML).
 * 3. Otherwise use the inbound DID (normalized).
 */
export function resolveTransferDialCallerId(inboundDid: string | null | undefined): string | undefined {
  const fromEnv = process.env.TWILIO_TRANSFER_CALLER_ID?.trim();
  if (fromEnv && /^\+[1-9]\d{1,14}$/.test(fromEnv.replace(/[\s\-().]/g, ''))) {
    return fromEnv.replace(/[\s\-().]/g, '');
  }

  const raw = String(inboundDid ?? '').trim();
  if (!raw) return undefined;

  let n = raw.replace(/[\s\-().]/g, '');
  if (!n.startsWith('+')) {
    if (/^\d+$/.test(n)) n = `+${n}`;
    else return undefined;
  }

  // Any UAE inbound DID (toll-free, mobile, landline) — do not present as caller
  // ID on the agent leg; UAE carriers commonly reject UAE→UAE CLI presentation.
  if (isUaeE164(n)) {
    return undefined;
  }

  return n;
}
