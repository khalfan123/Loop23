/**
 * Canonical platform webhook event names for outbound delivery (n8n, Zapier, etc.)
 */

export const PLATFORM_WEBHOOK_EVENTS = [
  'campaign.started',
  'campaign.paused',
  'campaign.resumed',
  'campaign.completed',
  'campaign.failed',
  'campaign.cancelled',
  'call.started',
  'call.ringing',
  'call.answered',
  'call.completed',
  'call.failed',
  'call.transferred',
  'call.no_answer',
  'call.busy',
  'call.voicemail',
  'inbound_call.received',
  'inbound_call.answered',
  'inbound_call.completed',
  'inbound_call.missed',
  'ivr.started',
  'ivr.language_selected',
  'ivr.option_selected',
  'flow.started',
  'flow.completed',
  'flow.failed',
  'appointment.booked',
  'appointment.confirmed',
  'appointment.cancelled',
  'appointment.rescheduled',
  'appointment.completed',
  'appointment.no_show',
  'form.submitted',
  'form.lead_created',
  'lead.captured',
] as const;

export type PlatformWebhookEvent = (typeof PLATFORM_WEBHOOK_EVENTS)[number];

/** Events the Integration Concierge may bind to n8n workflows (validated server-side). */
export const CONCIERGE_ALLOWED_TRIGGER_EVENTS = PLATFORM_WEBHOOK_EVENTS;

export type ConciergeTriggerEvent = (typeof CONCIERGE_ALLOWED_TRIGGER_EVENTS)[number];

/** Native compiler-supported destinations with one-click deploy. */
export const CONCIERGE_NATIVE_DESTINATION_SLUGS = ['zendesk', 'slack', 'hubspot'] as const;

/**
 * @deprecated Use CONCIERGE_NATIVE_DESTINATION_SLUGS. Generic destinations
 * are accepted for the HTTP adapter path.
 */
export const CONCIERGE_DESTINATION_SLUGS = CONCIERGE_NATIVE_DESTINATION_SLUGS;

const VALID_AUTH_TYPES = new Set(['none', 'bearer', 'basic', 'header']);
const VALID_FILTER_OPS = new Set([
  'equals',
  'not_equals',
  'contains',
  'greater_than',
  'less_than',
]);

export function isValidPlatformWebhookEvent(event: string): boolean {
  return (PLATFORM_WEBHOOK_EVENTS as readonly string[]).includes(event);
}

interface ValidatableRecipe {
  triggerEvent?: string;
  destination?: { slug?: string; subdomain?: string };
  mode?: string;
  filter?: {
    campaignIds?: unknown;
    condition?: { field?: unknown; op?: unknown; value?: unknown } | null;
  };
  action?: {
    url?: unknown;
    method?: unknown;
    auth?: { type?: unknown };
  };
}

export function validateConciergeRecipe(
  recipe: ValidatableRecipe,
): { ok: true } | { ok: false; error: string } {
  const te = String(recipe.triggerEvent || '').trim();
  if (!te) return { ok: false, error: 'Missing triggerEvent' };
  if (!(CONCIERGE_ALLOWED_TRIGGER_EVENTS as readonly string[]).includes(te)) {
    return {
      ok: false,
      error: `triggerEvent must be one of: ${CONCIERGE_ALLOWED_TRIGGER_EVENTS.join(', ')}`,
    };
  }
  const slug = String(recipe.destination?.slug || '').trim();
  if (!slug) return { ok: false, error: 'destination.slug is required' };

  const isNativeSlug = (CONCIERGE_NATIVE_DESTINATION_SLUGS as readonly string[]).includes(slug);
  const mode = recipe.mode ? String(recipe.mode) : isNativeSlug ? 'native' : 'generic';
  if (mode !== 'native' && mode !== 'generic') {
    return { ok: false, error: 'mode must be "native" or "generic"' };
  }

  if (mode === 'native') {
    if (!isNativeSlug) {
      return {
        ok: false,
        error: `mode "native" requires destination.slug to be one of: ${CONCIERGE_NATIVE_DESTINATION_SLUGS.join(', ')}`,
      };
    }
    if (slug === 'zendesk') {
      const sub = String(recipe.destination?.subdomain || '').trim();
      if (!sub) return { ok: false, error: 'Zendesk requires recipe.destination.subdomain' };
    }
  } else {
    const url = String(recipe.action?.url || '').trim();
    if (!url) return { ok: false, error: 'mode "generic" requires recipe.action.url' };
    if (!/^https?:\/\//i.test(url)) {
      return { ok: false, error: 'recipe.action.url must be an http(s) URL' };
    }
    const authType = String(recipe.action?.auth?.type || 'none');
    if (!VALID_AUTH_TYPES.has(authType)) {
      return { ok: false, error: `recipe.action.auth.type must be one of: ${[...VALID_AUTH_TYPES].join(', ')}` };
    }
    const method = recipe.action?.method ? String(recipe.action.method).toUpperCase() : 'POST';
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return { ok: false, error: 'recipe.action.method must be GET/POST/PUT/PATCH/DELETE' };
    }
  }

  if (recipe.filter) {
    if (recipe.filter.campaignIds != null && !Array.isArray(recipe.filter.campaignIds)) {
      return { ok: false, error: 'recipe.filter.campaignIds must be an array of strings' };
    }
    if (recipe.filter.condition) {
      const cond = recipe.filter.condition;
      if (!cond.field || typeof cond.field !== 'string') {
        return { ok: false, error: 'recipe.filter.condition.field is required' };
      }
      if (typeof cond.op !== 'string' || !VALID_FILTER_OPS.has(cond.op)) {
        return {
          ok: false,
          error: `recipe.filter.condition.op must be one of: ${[...VALID_FILTER_OPS].join(', ')}`,
        };
      }
      if (cond.value == null) {
        return { ok: false, error: 'recipe.filter.condition.value is required' };
      }
    }
  }

  return { ok: true };
}

/** Injected into Bedrock concierge system prompt — keep in sync with triggerEvent payloads. */
export const WEBHOOK_PAYLOAD_SCHEMA_FOR_PROMPT = `
Platform webhook JSON envelope (all events):
{ "event": string, "timestamp": ISO8601 string, "data": object }

Common data fields for inbound/call events:
- userId: string (account owner)
- callSid: string | null (Twilio Call SID)
- callId: string | null (internal call id when available)
- direction: "inbound" | "outbound"
- fromNumber, toNumber: E.164 strings
- phoneNumberId: string | null
- agentId: string | null
- departmentId: string | null (IVR selection)
- departmentLabel: string | null
- ivrId: string | null (IVR configuration id)
- ivrEngine: "default" | "bedrock-polly" | null
- dtmf: string | null (menu digit when relevant)
- language: string | null (ISO language code when relevant)
- engine: string | null (voice pipeline, e.g. twilio-openai, twilio-default)
- recordingUrl, transcriptSummary: may appear on call.completed / inbound_call.completed

IVR-specific events:
- ivr.started: caller entered IVR (before department choice).
- ivr.language_selected: caller chose a language (multi-language IVR).
- ivr.option_selected: caller chose a department/menu option (includes departmentId, departmentLabel, dtmf).

Use exact triggerEvent strings from CONCIERGE_ALLOWED_TRIGGER_EVENTS when proposing recipes.
`.trim();
