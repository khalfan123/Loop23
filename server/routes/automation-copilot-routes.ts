'use strict';

import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { automationCopilotChats, integrationApps } from '@shared/schema';
import { storage } from '../storage';
import { awsBedrockService } from '../services/aws-bedrock';
import {
  CONCIERGE_ALLOWED_TRIGGER_EVENTS,
  PLATFORM_WEBHOOK_EVENTS,
} from '../constants/platform-webhook-events';
import {
  buildAskReply,
  buildCopilotSystemPrompt,
  buildScaffoldIntro,
  buildWelcomeMessage,
  enhanceAskReply,
  formatDryRunChatMessage,
  mergeBuildReply,
} from '../services/automation-copilot-guidance';

interface AuthRequest extends Request {
  userId?: string;
  isTeamMember?: boolean;
  teamMember?: { userId: string };
}

function getUserId(req: AuthRequest): string {
  if (req.isTeamMember && req.teamMember) return req.teamMember.userId;
  return req.userId || '';
}

async function resolveCompanyName(userId: string): Promise<string> {
  try {
    const user = await storage.getUser(userId);
    const fromProfile = user?.company?.trim();
    if (fromProfile) return fromProfile;
    const fromBilling = user?.billingName?.trim();
    if (fromBilling) return fromBilling;
  } catch {
    // ignore — fall through to default
  }
  return 'your company';
}

type CopilotStep = {
  id: string;
  order: number;
  type: 'trigger' | 'action';
  appId: string | null;
  actionId: string | null;
  label: string;
  config: Record<string, unknown>;
};

type CopilotAutomation = {
  name: string;
  status: 'draft' | 'published';
  steps: CopilotStep[];
};

type CopilotMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type CopilotSession = {
  id: string;
  userId: string;
  companyName: string;
  messages: CopilotMessage[];
  automation: CopilotAutomation;
  updatedAt: number;
};

const sessions = new Map<string, CopilotSession>();
const chatRateLimit = new Map<string, number[]>();

function isRateLimited(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const windowStart = now - windowMs;
  const hits = (chatRateLimit.get(key) || []).filter((t) => t > windowStart);
  if (hits.length >= limit) {
    return { limited: true, retryAfterMs: Math.max(250, hits[0] + windowMs - now) };
  }
  hits.push(now);
  chatRateLimit.set(key, hits);
  return { limited: false, retryAfterMs: 0 };
}

function emptyAutomation(): CopilotAutomation {
  return {
    name: 'Untitled automation',
    status: 'draft',
    steps: [
      {
        id: 'step-trigger',
        order: 0,
        type: 'trigger',
        appId: 'loop9',
        actionId: null,
        label: 'Select the event that starts your automation',
        config: {},
      },
      {
        id: 'step-action-1',
        order: 1,
        type: 'action',
        appId: null,
        actionId: null,
        label: 'Select the event for your automation to run',
        config: {},
      },
    ],
  };
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

async function listCatalogApps(category?: string) {
  const rows = await db.select().from(integrationApps).where(eq(integrationApps.isActive, true));
  const apps = rows.map((a) => ({
    id: a.slug,
    name: a.name,
    category: a.category || 'other',
    isPopular: a.isPopular,
  }));
  if (!category || category === 'all') return apps;
  return apps.filter((a) => a.category === category);
}

function getAppActions(appId: string) {
  if (appId === 'loop9') {
    return {
      triggers: CONCIERGE_ALLOWED_TRIGGER_EVENTS.map((ev) => ({
        id: ev,
        name: ev,
        requiredFields: [] as string[],
      })),
      actions: [] as Array<{ id: string; name: string; requiredFields: string[] }>,
    };
  }
  return {
    triggers: [] as Array<{ id: string; name: string; requiredFields: string[] }>,
    actions: [
      {
        id: 'send',
        name: 'Send / sync data',
        requiredFields: ['connection'],
      },
    ],
  };
}

const BUILTIN_APP_IDS = new Set(['webhooks', 'schedule', 'email', 'code', 'api']);
const FLOW_NODE_TYPES = new Set([
  'message',
  'question',
  'play_audio',
  'condition',
  'appointment',
  'form',
  'webhook',
  'transfer',
  'delay',
  'end',
]);

function validateProposedAutomation(
  draft: unknown,
  catalogSlugs: Set<string>,
): { ok: true; automation: CopilotAutomation } | { ok: false; error: string } {
  if (!draft || typeof draft !== 'object') {
    return { ok: false, error: 'propose_automation missing automation object' };
  }
  const raw = draft as Partial<CopilotAutomation>;
  const stepsIn = Array.isArray(raw.steps) ? raw.steps : [];
  if (stepsIn.length === 0) {
    return { ok: false, error: 'propose_automation requires at least one step' };
  }

  const steps: CopilotStep[] = [];
  for (let i = 0; i < stepsIn.length; i++) {
    const s = stepsIn[i] as Partial<CopilotStep>;
    const type = s.type === 'trigger' || s.type === 'action' ? s.type : null;
    if (!type) return { ok: false, error: `Step ${i} has invalid type` };

    const appId = typeof s.appId === 'string' ? s.appId : null;
    const actionId = typeof s.actionId === 'string' ? s.actionId : null;
    const config =
      s.config && typeof s.config === 'object'
        ? (s.config as Record<string, unknown>)
        : ({} as Record<string, unknown>);
    const nodeType = typeof config.nodeType === 'string' ? config.nodeType : null;
    const isFlowNode = !!(nodeType && FLOW_NODE_TYPES.has(nodeType));
    const isBuiltin = !!(appId && BUILTIN_APP_IDS.has(appId));

    if (type === 'trigger') {
      if (actionId && !(PLATFORM_WEBHOOK_EVENTS as readonly string[]).includes(actionId)) {
        return { ok: false, error: `Unsupported trigger: ${actionId}` };
      }
    } else if (
      appId &&
      appId !== 'loop9' &&
      !catalogSlugs.has(appId) &&
      !isBuiltin &&
      !isFlowNode
    ) {
      return { ok: false, error: `Unsupported app: ${appId}` };
    }

    steps.push({
      id: typeof s.id === 'string' ? s.id : `step-${i}`,
      order: i,
      type,
      appId: appId || (type === 'trigger' ? 'loop9' : isFlowNode ? null : null),
      actionId: actionId || (isFlowNode || isBuiltin ? 'send' : null),
      label:
        typeof s.label === 'string' && s.label.trim()
          ? s.label.trim()
          : type === 'trigger'
            ? actionId || 'Select trigger'
            : isFlowNode
              ? nodeType || 'Flow step'
              : actionId
                ? `${appId}: ${actionId}`
                : 'Select action',
      config,
    });
  }

  if (steps[0]?.type !== 'trigger') {
    return { ok: false, error: 'First step must be a trigger' };
  }

  return {
    ok: true,
    automation: {
      name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Untitled automation',
      status: 'draft',
      steps,
    },
  };
}

type DryRunStepResult = {
  id: string;
  order: number;
  type: 'trigger' | 'action';
  label: string;
  status: 'ok' | 'warn' | 'error' | 'skipped';
  detail: string;
};

function samplePayloadForTrigger(triggerId: string | null) {
  const now = new Date().toISOString();
  const base = {
    event: triggerId || 'call.completed',
    occurredAt: now,
    callId: 'test-call-' + crypto.randomUUID().slice(0, 8),
    from: '+15551234567',
    to: '+15559876543',
    direction: 'inbound',
    durationSec: 94,
    summary: 'Caller asked about pricing and requested a callback.',
  };
  if (triggerId?.startsWith('appointment')) {
    return {
      ...base,
      appointmentId: 'appt-test-001',
      startsAt: now,
      status: 'booked',
    };
  }
  if (triggerId?.startsWith('lead')) {
    return {
      ...base,
      leadId: 'lead-test-001',
      email: 'test@example.com',
      name: 'Test Lead',
    };
  }
  return base;
}

function dryRunAutomation(
  automation: CopilotAutomation,
  catalogSlugs: Set<string>,
): { ok: boolean; steps: DryRunStepResult[]; samplePayload: Record<string, unknown> } {
  const results: DryRunStepResult[] = [];
  let ok = true;
  const samplePayload = samplePayloadForTrigger(automation.steps[0]?.actionId || null);

  for (let i = 0; i < automation.steps.length; i++) {
    const step = automation.steps[i];
    const nodeType =
      step.config && typeof step.config.nodeType === 'string' ? step.config.nodeType : null;

    if (step.type === 'trigger') {
      if (!step.actionId) {
        ok = false;
        results.push({
          id: step.id,
          order: i,
          type: step.type,
          label: step.label,
          status: 'error',
          detail: 'No trigger event selected — click the Trigger card → **Node Properties** → choose **Trigger event**.',
        });
        continue;
      }
      if (!(PLATFORM_WEBHOOK_EVENTS as readonly string[]).includes(step.actionId)) {
        ok = false;
        results.push({
          id: step.id,
          order: i,
          type: step.type,
          label: step.label,
          status: 'error',
          detail: `Unknown trigger “${step.actionId}” — open **Browse triggers…** and pick a supported event.`,
        });
        continue;
      }
      results.push({
        id: step.id,
        order: i,
        type: step.type,
        label: step.label,
        status: 'ok',
        detail: `Would fire on ${step.actionId} with a sample payload.`,
      });
      continue;
    }

    if (nodeType === 'condition') {
      const expr =
        typeof step.config.condition === 'string' && step.config.condition.trim()
          ? step.config.condition.trim()
          : null;
      if (!expr) {
        results.push({
          id: step.id,
          order: i,
          type: step.type,
          label: step.label,
          status: 'warn',
          detail: 'Condition is empty — dry-run assumes true and continues.',
        });
      } else {
        results.push({
          id: step.id,
          order: i,
          type: step.type,
          label: step.label,
          status: 'ok',
          detail: `Would evaluate “${expr}” (assumed true in dry-run).`,
        });
      }
      continue;
    }

    if (nodeType === 'delay') {
      const duration =
        typeof step.config.duration === 'number' ? step.config.duration : 5;
      results.push({
        id: step.id,
        order: i,
        type: step.type,
        label: step.label,
        status: 'ok',
        detail: `Would wait ${duration}s (skipped in dry-run).`,
      });
      continue;
    }

    if (nodeType === 'webhook') {
      const url =
        typeof step.config.webhookUrl === 'string' ? step.config.webhookUrl.trim() : '';
      if (!url) {
        results.push({
          id: step.id,
          order: i,
          type: step.type,
          label: step.label,
          status: 'warn',
          detail: 'Webhook URL is empty — click this step → **Node Properties** → paste your **Webhook URL**, then re-test.',
        });
      } else {
        results.push({
          id: step.id,
          order: i,
          type: step.type,
          label: step.label,
          status: 'ok',
          detail: `Would ${String(step.config.method || 'POST')} ${url} with the sample payload.`,
        });
      }
      continue;
    }

    if (nodeType === 'message' || nodeType === 'question' || nodeType === 'play_audio' || nodeType === 'end' || nodeType === 'form' || nodeType === 'appointment' || nodeType === 'transfer') {
      results.push({
        id: step.id,
        order: i,
        type: step.type,
        label: step.label,
        status: 'ok',
        detail: `Would run flow node “${nodeType}” with current config.`,
      });
      continue;
    }

    if (!step.appId) {
      ok = false;
      results.push({
        id: step.id,
        order: i,
        type: step.type,
        label: step.label,
        status: 'error',
        detail: 'No app or flow node configured — click the step → **Node Properties** → select an **App** or add a flow node.',
      });
      continue;
    }

    if (
      step.appId !== 'loop9' &&
      step.appId !== 'webhooks' &&
      step.appId !== 'schedule' &&
      step.appId !== 'email' &&
      step.appId !== 'code' &&
      step.appId !== 'api' &&
      !catalogSlugs.has(step.appId)
    ) {
      ok = false;
      results.push({
        id: step.id,
        order: i,
        type: step.type,
        label: step.label,
        status: 'error',
        detail: `App “${step.appId}” is not in the marketplace — pick a connected app via **Browse apps…**.`,
      });
      continue;
    }

    results.push({
      id: step.id,
      order: i,
      type: step.type,
      label: step.label,
      status: 'ok',
      detail: `Would send sample payload to ${step.appId} (${step.actionId || 'send'}).`,
    });
  }

  if (results.length === 0) {
    ok = false;
  }

  return { ok, steps: results, samplePayload };
}

type CopilotMode = 'ask' | 'build';

function buildCallerLookupAutomation(nameHint?: string): CopilotAutomation {
  return {
    name: nameHint || 'Identify caller via webhook API',
    status: 'draft',
    steps: [
      {
        id: 'step-trigger',
        order: 0,
        type: 'trigger',
        appId: 'loop9',
        actionId: 'inbound_call.received',
        label: 'inbound_call.received',
        config: {},
      },
      {
        id: 'step-lookup',
        order: 1,
        type: 'action',
        appId: 'webhooks',
        actionId: 'send',
        label: 'Lookup caller by mobile number (HTTP API)',
        config: {
          nodeType: 'webhook',
          method: 'POST',
          webhookUrl: '',
          notes:
            'POST caller phone (from) to your Linkex/backend identity API. Map response fields into later steps.',
          bodyTemplate:
            '{"phone":"{{from}}","callId":"{{callId}}","direction":"{{direction}}"}',
        },
      },
      {
        id: 'step-notify',
        order: 2,
        type: 'action',
        appId: 'slack',
        actionId: 'send',
        label: 'Notify agent with caller profile',
        config: {
          notes: 'Use fields returned by the lookup webhook (name, account, tier, etc.).',
        },
      },
    ],
  };
}

function heuristicReply(
  message: string,
  catalog: Array<{ id: string; name: string }>,
  mode: CopilotMode,
  automation: CopilotAutomation,
  history: CopilotMessage[] = [],
  companyName = 'your company',
) {
  const company = companyName?.trim() || 'your company';
  if (mode === 'ask') {
    return {
      reply: buildAskReply(company, automation, catalog),
      automation: null as CopilotAutomation | null,
    };
  }

  const context = [...history.map((m) => m.content), message].join('\n').toLowerCase();
  const msg = message.toLowerCase();

  const wantsCallerLookup =
    /(linkex|identify|identity|lookup|caller|mobile number|phone number|pull.?out.*(data|profile)|screen.?pop)/i.test(
      context,
    );
  const wantsWebhook =
    /(webhook|http\b|api\b|backend|rest|endpoint)/i.test(context) || wantsCallerLookup;
  const saysBuildNow =
    /(build|scaffold|create|make).*(flow|automation|zap)|build the flow|do it|go ahead/i.test(msg);

  if (wantsWebhook || wantsCallerLookup || saysBuildNow) {
    const next = buildCallerLookupAutomation(
      wantsCallerLookup
        ? `${company}: identify caller via API`
        : `${company}: webhook automation`,
    );
    const hasSlack = catalog.some((a) => a.id === 'slack');
    if (!hasSlack) {
      next.steps = next.steps.filter((s) => s.id !== 'step-notify');
      next.steps.push({
        id: 'step-use-data',
        order: 2,
        type: 'action',
        appId: null,
        actionId: null,
        label: 'Use returned caller data (message / route)',
        config: {
          nodeType: 'message',
          message:
            'Caller identified. Use returned profile fields for routing or agent screen-pop.',
        },
      });
    }

    const intro = [
      buildScaffoldIntro(company, next),
      '',
      '**Flow summary:**',
      '',
      '1. **When a call comes in** — automation starts automatically',
      '2. **Look up the caller** — send the mobile number to your backend API (Webhook step)',
      hasSlack
        ? '3. **Notify supervisors** — post caller details to **Slack**'
        : '3. **Use caller details** — show them in the next message step',
    ].join('\n');
    return {
      reply: mergeBuildReply(intro, next, catalog),
      automation: next,
    };
  }

  const trigger =
    /appointment/.test(msg) || /appointment/.test(context)
      ? 'appointment.booked'
      : /lead|contact/.test(msg) || /lead|contact/.test(context)
        ? 'lead.captured'
        : /inbound/.test(msg) || /inbound/.test(context)
          ? 'inbound_call.received'
          : 'call.completed';

  const dest =
    catalog.find((a) => msg.includes(a.id) || msg.includes(a.name.toLowerCase())) ||
    catalog.find((a) => context.includes(a.id) || context.includes(a.name.toLowerCase())) ||
    catalog.find((a) => a.id === 'slack') ||
    catalog.find((a) => a.id === 'google-sheets') ||
    catalog[0];

  if (!dest) {
    const next = buildCallerLookupAutomation(`${company}: caller lookup`);
    const intro = [
      buildScaffoldIntro(company, next),
      '',
      'This starter flow looks up callers by phone through your API. Paste your backend link in the **Webhook** step.',
    ].join('\n');
    return {
      reply: mergeBuildReply(intro, next, catalog),
      automation: next,
    };
  }

  const next: CopilotAutomation = {
    name: `${company}: ${trigger} → ${dest.name}`,
    status: 'draft',
    steps: [
      {
        id: 'step-trigger',
        order: 0,
        type: 'trigger',
        appId: 'loop9',
        actionId: trigger,
        label: trigger,
        config: {},
      },
      {
        id: 'step-action-1',
        order: 1,
        type: 'action',
        appId: dest.id,
        actionId: 'send',
        label: `Send to ${dest.name}`,
        config: {},
      },
    ],
  };

  const intro = [
    buildScaffoldIntro(company, next),
    '',
    `When **${trigger.replace(/\./g, ' · ')}** happens, data goes to **${dest.name}**.`,
    '',
    `If **${dest.name}** is not connected yet, open **Settings → Integrations** first, then confirm the app on the action step.`,
  ].join('\n');
  return {
    reply: mergeBuildReply(intro, next, catalog),
    automation: next,
  };
}

async function bedrockCopilotTurn(input: {
  message: string;
  automation: CopilotAutomation;
  history: CopilotMessage[];
  catalog: Array<{ id: string; name: string; category: string }>;
  mode: CopilotMode;
  companyName?: string;
}): Promise<{ reply: string; automation: CopilotAutomation | null }> {
  const company =
    input.companyName && input.companyName.trim() ? input.companyName.trim() : 'your company';

  if (!awsBedrockService.isConfigured()) {
    return heuristicReply(
      input.message,
      input.catalog,
      input.mode,
      input.automation,
      input.history,
      company,
    );
  }

  const isAsk = input.mode === 'ask';

  const systemPrompt = buildCopilotSystemPrompt({
    companyName: company,
    mode: input.mode,
    catalog: input.catalog,
    triggers: CONCIERGE_ALLOWED_TRIGGER_EVENTS,
  });

  const historyText = input.history
    .slice(-8)
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');

  const userContent = [
    `Company: ${company}`,
    `Current draft: ${JSON.stringify(input.automation)}`,
    historyText ? `Recent chat:\n${historyText}` : '',
    `User: ${input.message}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const result = await awsBedrockService.invoke({
      model: 'claude-sonnet-4-6',
      systemPrompt,
      messages: [{ role: 'user', content: userContent }],
      maxTokens: 2200,
      temperature: 0.2,
    });

    const parsed = safeJsonParse<{
      reply?: string;
      propose_automation?: unknown;
    }>(result.content);

    if (!parsed) {
      if (!isAsk) {
        return heuristicReply(
          input.message,
          input.catalog,
          input.mode,
          input.automation,
          input.history,
          company,
        );
      }
      const askFallback = buildAskReply(company, input.automation, input.catalog);
      return {
        reply: askFallback.slice(0, 4000) || 'I could not parse a structured reply. Try again.',
        automation: null,
      };
    }

    let automation: CopilotAutomation | null = null;
    if (!isAsk && parsed.propose_automation) {
      const catalogSlugs = new Set(input.catalog.map((a) => a.id));
      const validated = validateProposedAutomation(parsed.propose_automation, catalogSlugs);
      if (validated.ok) automation = validated.automation;
    }

    if (isAsk) {
      return {
        reply: enhanceAskReply(parsed.reply, company, input.automation, input.catalog),
        automation: null,
      };
    }

    if (!automation) {
      const fallback = heuristicReply(
        input.message,
        input.catalog,
        input.mode,
        input.automation,
        input.history,
        company,
      );
      const merged = parsed.reply?.trim()
        ? mergeBuildReply(parsed.reply, fallback.automation || input.automation, input.catalog)
        : fallback.reply;
      return {
        reply: merged,
        automation: fallback.automation,
      };
    }

    const reply = mergeBuildReply(
      parsed.reply?.trim() || buildScaffoldIntro(company, automation),
      automation,
      input.catalog,
    );

    return {
      reply,
      automation,
    };
  } catch (err: any) {
    console.warn('[Copilot] Bedrock failed, using heuristic:', err?.message || err);
    return heuristicReply(
      input.message,
      input.catalog,
      input.mode,
      input.automation,
      input.history,
      company,
    );
  }
}

export function createAutomationCopilotRoutes(): Router {
  const router = Router();

  router.get('/copilot/catalog', async (req: AuthRequest, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: 'Not authenticated' });
      const category = typeof req.query.category === 'string' ? req.query.category : undefined;
      const apps = await listCatalogApps(category);
      res.json({
        apps,
        triggers: CONCIERGE_ALLOWED_TRIGGER_EVENTS.map((id) => ({ id, name: id })),
        builtins: [
          { id: 'webhooks', name: 'Webhooks', category: 'utilities' },
          { id: 'schedule', name: 'Schedule', category: 'utilities' },
          { id: 'email', name: 'Email', category: 'utilities' },
          { id: 'code', name: 'Code', category: 'custom' },
        ],
      });
    } catch (error: any) {
      console.error('[Copilot] catalog error:', error);
      res.status(500).json({ error: error.message || 'Failed to load catalog' });
    }
  });

  router.get('/copilot/apps/:appId/actions', async (req: AuthRequest, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: 'Not authenticated' });
      res.json(getAppActions(String(req.params.appId || '')));
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load actions' });
    }
  });

  router.post('/copilot/session', async (req: AuthRequest, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: 'Not authenticated' });
      const companyName = await resolveCompanyName(userId);

      const restoreMessages = Array.isArray(req.body?.messages)
        ? req.body.messages.filter(
            (m: unknown): m is CopilotMessage =>
              !!m &&
              typeof m === 'object' &&
              ((m as CopilotMessage).role === 'user' ||
                (m as CopilotMessage).role === 'assistant') &&
              typeof (m as CopilotMessage).content === 'string',
          )
        : [];

      let automation = emptyAutomation();
      if (req.body?.automation && typeof req.body.automation === 'object') {
        const catalog = await listCatalogApps();
        const validated = validateProposedAutomation(
          req.body.automation,
          new Set(catalog.map((a) => a.id)),
        );
        if (validated.ok) automation = validated.automation;
      }

      const id = crypto.randomUUID();
      const session: CopilotSession = {
        id,
        userId,
        companyName,
        messages:
          restoreMessages.length > 0
            ? restoreMessages
            : [
                {
                  role: 'assistant',
                  content: buildWelcomeMessage(companyName),
                },
              ],
        automation,
        updatedAt: Date.now(),
      };
      sessions.set(id, session);
      res.json({
        sessionId: id,
        automation: session.automation,
        messages: session.messages,
        companyName,
        restored: restoreMessages.length > 0,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to create session' });
    }
  });

  router.post('/copilot/chat', async (req: AuthRequest, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: 'Not authenticated' });

      const rl = isRateLimited(`copilot:${userId}`, 8, 10_000);
      if (rl.limited) {
        res.setHeader('Retry-After', String(Math.ceil(rl.retryAfterMs / 1000)));
        return res.status(429).json({ error: 'Too many Copilot requests. Please wait a moment.' });
      }

      const message = String(req.body?.message || '').trim();
      if (!message) return res.status(400).json({ error: 'message is required' });

      const mode: CopilotMode = req.body?.mode === 'ask' ? 'ask' : 'build';

      let session = req.body?.sessionId ? sessions.get(String(req.body.sessionId)) : undefined;
      if (!session || session.userId !== userId) {
        const companyName = await resolveCompanyName(userId);
        const id = crypto.randomUUID();
        session = {
          id,
          userId,
          companyName,
          messages: [],
          automation: emptyAutomation(),
          updatedAt: Date.now(),
        };
        sessions.set(id, session);
      } else if (!session.companyName) {
        session.companyName = await resolveCompanyName(userId);
      }

      if (req.body?.automation && typeof req.body.automation === 'object') {
        const catalog = await listCatalogApps();
        const validated = validateProposedAutomation(
          req.body.automation,
          new Set(catalog.map((a) => a.id)),
        );
        if (validated.ok) session.automation = validated.automation;
      }

      session.messages.push({ role: 'user', content: message });
      const catalog = await listCatalogApps();
      const turn = await bedrockCopilotTurn({
        message,
        automation: session.automation,
        history: session.messages,
        catalog,
        mode,
        companyName: session.companyName || 'your company',
      });

      if (mode === 'build' && turn.automation) session.automation = turn.automation;
      session.messages.push({ role: 'assistant', content: turn.reply });
      session.updatedAt = Date.now();

      res.json({
        sessionId: session.id,
        reply: turn.reply,
        automation: session.automation,
        mode,
        messages: session.messages.slice(-20),
        bedrockConfigured: awsBedrockService.isConfigured(),
      });
    } catch (error: any) {
      console.error('[Copilot] chat error:', error);
      res.status(500).json({ error: error.message || 'Copilot chat failed' });
    }
  });

  router.put('/copilot/session/:id/automation', async (req: AuthRequest, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: 'Not authenticated' });
      const session = sessions.get(String(req.params.id));
      if (!session || session.userId !== userId) {
        return res.status(404).json({ error: 'Session not found' });
      }
      const catalog = await listCatalogApps();
      const validated = validateProposedAutomation(
        req.body?.automation,
        new Set(catalog.map((a) => a.id)),
      );
      if (!validated.ok) return res.status(400).json({ error: validated.error });
      session.automation = validated.automation;
      session.updatedAt = Date.now();
      res.json({ automation: session.automation });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update automation' });
    }
  });

  router.post('/copilot/test', async (req: AuthRequest, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: 'Not authenticated' });

      const rl = isRateLimited(`copilot-test:${userId}`, 12, 10_000);
      if (rl.limited) {
        res.setHeader('Retry-After', String(Math.ceil(rl.retryAfterMs / 1000)));
        return res.status(429).json({ error: 'Too many test runs. Please wait a moment.' });
      }

      const catalog = await listCatalogApps();
      const catalogSlugs = new Set(catalog.map((a) => a.id));
      const validated = validateProposedAutomation(req.body?.automation, catalogSlugs);
      if (!validated.ok) {
        return res.status(400).json({
          ok: false,
          error: validated.error,
          steps: [],
          samplePayload: null,
        });
      }

      const result = dryRunAutomation(validated.automation, catalogSlugs);
      const chatMessage = formatDryRunChatMessage(
        result.ok,
        validated.automation.name,
        result.steps,
      );
      res.json({
        ok: result.ok,
        name: validated.automation.name,
        dryRun: true,
        steps: result.steps,
        samplePayload: result.samplePayload,
        chatMessage,
        summary: result.ok
          ? `Dry-run passed (${result.steps.length} steps). No live webhooks were called.`
          : `Dry-run found issues in ${result.steps.filter((s) => s.status === 'error').length} step(s).`,
      });
    } catch (error: any) {
      console.error('[Copilot] test error:', error);
      res.status(500).json({ error: error.message || 'Test failed' });
    }
  });

  // ── Saved chats (user-scoped only) ─────────────────────────────

  function deriveChatTitle(
    messages: Array<{ role: string; content: string }>,
    automationName?: string,
  ): string {
    const firstUser = messages.find((m) => m.role === 'user' && m.content.trim());
    if (firstUser) {
      const clean = firstUser.content.replace(/\s+/g, ' ').trim();
      return clean.length > 72 ? `${clean.slice(0, 69)}…` : clean;
    }
    if (automationName && automationName.trim() && automationName !== 'Untitled automation') {
      return automationName.trim().slice(0, 72);
    }
    return 'Untitled chat';
  }

  router.get('/copilot/chats', async (req: AuthRequest, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: 'Not authenticated' });

      const rows = await db
        .select({
          id: automationCopilotChats.id,
          title: automationCopilotChats.title,
          updatedAt: automationCopilotChats.updatedAt,
          createdAt: automationCopilotChats.createdAt,
        })
        .from(automationCopilotChats)
        .where(eq(automationCopilotChats.userId, userId))
        .orderBy(desc(automationCopilotChats.updatedAt))
        .limit(50);

      res.json({ chats: rows });
    } catch (error: any) {
      console.error('[Copilot] list chats error:', error);
      res.status(500).json({ error: error.message || 'Failed to list saved chats' });
    }
  });

  router.get('/copilot/chats/:id', async (req: AuthRequest, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: 'Not authenticated' });

      const [row] = await db
        .select()
        .from(automationCopilotChats)
        .where(
          and(
            eq(automationCopilotChats.id, String(req.params.id)),
            eq(automationCopilotChats.userId, userId),
          ),
        )
        .limit(1);

      if (!row) return res.status(404).json({ error: 'Chat not found' });
      res.json({ chat: row });
    } catch (error: any) {
      console.error('[Copilot] get chat error:', error);
      res.status(500).json({ error: error.message || 'Failed to load chat' });
    }
  });

  router.post('/copilot/chats', async (req: AuthRequest, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: 'Not authenticated' });

      const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
      const automation =
        req.body?.automation && typeof req.body.automation === 'object'
          ? req.body.automation
          : emptyAutomation();
      const title =
        typeof req.body?.title === 'string' && req.body.title.trim()
          ? req.body.title.trim().slice(0, 120)
          : deriveChatTitle(messages, automation?.name);

      const existingId =
        typeof req.body?.id === 'string' && req.body.id.trim() ? req.body.id.trim() : null;

      if (existingId) {
        const [updated] = await db
          .update(automationCopilotChats)
          .set({
            title,
            messages,
            automation,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(automationCopilotChats.id, existingId),
              eq(automationCopilotChats.userId, userId),
            ),
          )
          .returning();

        if (updated) {
          return res.json({ chat: updated, saved: true, updated: true });
        }
      }

      const [created] = await db
        .insert(automationCopilotChats)
        .values({
          userId,
          title,
          messages,
          automation,
        })
        .returning();

      res.status(201).json({ chat: created, saved: true, updated: false });
    } catch (error: any) {
      console.error('[Copilot] save chat error:', error);
      res.status(500).json({ error: error.message || 'Failed to save chat' });
    }
  });

  router.delete('/copilot/chats/:id', async (req: AuthRequest, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: 'Not authenticated' });

      const [deleted] = await db
        .delete(automationCopilotChats)
        .where(
          and(
            eq(automationCopilotChats.id, String(req.params.id)),
            eq(automationCopilotChats.userId, userId),
          ),
        )
        .returning({ id: automationCopilotChats.id });

      if (!deleted) return res.status(404).json({ error: 'Chat not found' });
      res.json({ ok: true, id: deleted.id });
    } catch (error: any) {
      console.error('[Copilot] delete chat error:', error);
      res.status(500).json({ error: error.message || 'Failed to delete chat' });
    }
  });

  // ── Saved automations (user-scoped builder drafts) ─────────────

  function summarizeSavedAutomation(automation: unknown): {
    name: string;
    status: 'draft' | 'published';
    stepCount: number;
  } | null {
    if (!automation || typeof automation !== 'object') return null;
    const raw = automation as Partial<CopilotAutomation>;
    const steps = Array.isArray(raw.steps) ? raw.steps : [];
    if (steps.length === 0) return null;
    return {
      name:
        typeof raw.name === 'string' && raw.name.trim()
          ? raw.name.trim()
          : 'Untitled automation',
      status: raw.status === 'published' ? 'published' : 'draft',
      stepCount: steps.length,
    };
  }

  router.get('/copilot/automations', async (req: AuthRequest, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: 'Not authenticated' });

      const rows = await db
        .select({
          id: automationCopilotChats.id,
          automation: automationCopilotChats.automation,
          updatedAt: automationCopilotChats.updatedAt,
        })
        .from(automationCopilotChats)
        .where(eq(automationCopilotChats.userId, userId))
        .orderBy(desc(automationCopilotChats.updatedAt))
        .limit(50);

      const automations = rows
        .map((row) => {
          const summary = summarizeSavedAutomation(row.automation);
          if (!summary) return null;
          return {
            id: row.id,
            chatId: row.id,
            name: summary.name,
            status: summary.status,
            stepCount: summary.stepCount,
            updatedAt: row.updatedAt,
            source: 'saved_chat' as const,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);

      res.json({ automations });
    } catch (error: any) {
      console.error('[Copilot] list automations error:', error);
      res.status(500).json({ error: error.message || 'Failed to list automations' });
    }
  });

  router.get('/copilot/automations/:id', async (req: AuthRequest, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: 'Not authenticated' });

      const [row] = await db
        .select()
        .from(automationCopilotChats)
        .where(
          and(
            eq(automationCopilotChats.id, String(req.params.id)),
            eq(automationCopilotChats.userId, userId),
          ),
        )
        .limit(1);

      if (!row) return res.status(404).json({ error: 'Automation not found' });

      const catalog = await listCatalogApps();
      const catalogSlugs = new Set(catalog.map((a) => a.id));
      const validated = validateProposedAutomation(row.automation, catalogSlugs);
      const automation = validated.ok ? validated.automation : emptyAutomation();
      const messages = Array.isArray(row.messages) ? row.messages : [];

      res.json({
        id: row.id,
        chatId: row.id,
        name: automation.name,
        status: automation.status,
        automation,
        messages,
        updatedAt: row.updatedAt,
        source: 'saved_chat' as const,
        restoredFromInvalid: !validated.ok,
      });
    } catch (error: any) {
      console.error('[Copilot] get automation error:', error);
      res.status(500).json({ error: error.message || 'Failed to load automation' });
    }
  });

  return router;
}
