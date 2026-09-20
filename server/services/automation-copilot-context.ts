'use strict';

import crypto from 'crypto';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import {
  agents,
  departmentAgents,
  departments,
  incomingAgents,
  ivrConfigurations,
  knowledgeBase,
  phoneNumbers,
  voices,
} from '@shared/schema';
import { WorkspaceService } from './workspace-service';

export class TenantScopeError extends Error {
  constructor(message = 'Missing tenant scope') {
    super(message);
    this.name = 'TenantScopeError';
  }
}

export function requireUserScope(userId: string | null | undefined): asserts userId is string {
  if (!userId || !String(userId).trim()) {
    throw new TenantScopeError('Missing tenant scope — refuse unscoped query');
  }
}

export type TenantDepartmentAgent = {
  id: string;
  name: string;
  language: string;
};

export type TenantDepartment = {
  id: string;
  name: string;
  source: 'ops' | 'deprock';
  agents: TenantDepartmentAgent[];
};

export type TenantKbArticle = {
  title: string;
  type: string;
  excerpt: string;
};

export type TenantVoice = {
  id: string;
  name: string;
};

export type TenantPhone = {
  id: string;
  label: string;
};

export type TenantGap = {
  module: 'knowledge-base' | 'deprock' | 'ops' | 'voices' | 'phones';
  message: string;
  nextStep: string;
};

export type TenantCopilotContext = {
  userId: string;
  workspaceId: string | null;
  companyName: string;
  knowledgeBase: TenantKbArticle[];
  deprock: { departments: TenantDepartment[] };
  ops: {
    departments: TenantDepartment[];
    phones: TenantPhone[];
    businessHours: Array<{
      name: string;
      enabled: boolean;
      start: string | null;
      end: string | null;
      timezone: string | null;
      transferEnabled: boolean;
    }>;
  };
  voices: TenantVoice[];
  gaps: TenantGap[];
  /** Merged ops + deprock departments for transfer sanitization / UI */
  departments: TenantDepartment[];
};

const INJECTION_LINE =
  /\b(ignore\s+(all\s+)?(previous|prior|above)\s+instructions?|system\s+prompt|you\s+are\s+now|act\s+as\s+(?:a|an|the)\b|disregard\s+(all|previous)|new\s+instructions?:)/i;

export function sanitizeUntrustedExcerpt(raw: string, maxLen = 280): string {
  const cleaned = String(raw || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => !INJECTION_LINE.test(line))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen - 1)}…`;
}

export function wrapTenantDataBlock(
  source: string,
  body: string,
): string {
  return `<tenant_data source="${source}" trust="untrusted">\n${body}\n</tenant_data>`;
}

function maskPhone(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  if (digits.length < 4) return '••••';
  return `•••${digits.slice(-4)}`;
}

async function loadDepartmentsByEngine(
  userId: string,
  engineType: 'default' | 'bedrock-polly',
  source: 'ops' | 'deprock',
): Promise<TenantDepartment[]> {
  requireUserScope(userId);

  const userDepts = await db
    .select({
      id: departments.id,
      name: departments.name,
    })
    .from(departments)
    .where(
      and(
        eq(departments.userId, userId),
        eq(departments.engineType, engineType),
        eq(departments.isActive, true),
      ),
    )
    .orderBy(asc(departments.name));

  if (userDepts.length === 0) return [];

  const deptIds = userDepts.map((d) => d.id);
  const links = await db
    .select({
      departmentId: departmentAgents.departmentId,
      agentId: agents.id,
      agentName: agents.name,
      language: departmentAgents.language,
    })
    .from(departmentAgents)
    .innerJoin(departments, eq(departmentAgents.departmentId, departments.id))
    .innerJoin(agents, eq(departmentAgents.agentId, agents.id))
    .where(
      and(
        inArray(departmentAgents.departmentId, deptIds),
        eq(departments.userId, userId),
        eq(departments.engineType, engineType),
        eq(agents.userId, userId),
      ),
    );

  const byDept = new Map<string, TenantDepartmentAgent[]>();
  for (const link of links) {
    const list = byDept.get(link.departmentId) || [];
    if (!list.some((a) => a.id === link.agentId)) {
      list.push({
        id: link.agentId,
        name: link.agentName,
        language: link.language || 'en',
      });
    }
    byDept.set(link.departmentId, list);
  }

  return userDepts.map((d) => ({
    id: d.id,
    name: d.name,
    source,
    agents: byDept.get(d.id) || [],
  }));
}

async function loadKnowledgeArticles(userId: string): Promise<TenantKbArticle[]> {
  requireUserScope(userId);
  const rows = await db
    .select({
      title: knowledgeBase.title,
      type: knowledgeBase.type,
      content: knowledgeBase.content,
    })
    .from(knowledgeBase)
    .where(eq(knowledgeBase.userId, userId))
    .limit(20);

  return rows.map((r) => ({
    title: sanitizeUntrustedExcerpt(r.title || 'Untitled', 80),
    type: r.type || 'article',
    excerpt: sanitizeUntrustedExcerpt(r.content || '', 280),
  }));
}

async function loadTenantVoices(userId: string): Promise<TenantVoice[]> {
  requireUserScope(userId);
  const rows = await db
    .select({ id: voices.id, name: voices.name })
    .from(voices)
    .where(eq(voices.userId, userId))
    .orderBy(asc(voices.name))
    .limit(40);
  return rows.map((r) => ({
    id: r.id,
    name: sanitizeUntrustedExcerpt(r.name, 60),
  }));
}

async function loadTenantPhones(userId: string): Promise<TenantPhone[]> {
  requireUserScope(userId);
  const rows = await db
    .select({
      id: phoneNumbers.id,
      phoneNumber: phoneNumbers.phoneNumber,
      friendlyName: phoneNumbers.friendlyName,
    })
    .from(phoneNumbers)
    .where(and(eq(phoneNumbers.userId, userId), eq(phoneNumbers.status, 'active')))
    .limit(40);

  return rows.map((r) => ({
    id: r.id,
    label: r.friendlyName?.trim()
      ? sanitizeUntrustedExcerpt(r.friendlyName, 40)
      : maskPhone(r.phoneNumber),
  }));
}

async function loadOpsBusinessHours(userId: string) {
  requireUserScope(userId);
  const rows = await db
    .select({
      name: incomingAgents.name,
      enabled: incomingAgents.businessHoursEnabled,
      start: incomingAgents.businessHoursStart,
      end: incomingAgents.businessHoursEnd,
      timezone: incomingAgents.businessHoursTimezone,
      transferEnabled: incomingAgents.transferEnabled,
    })
    .from(incomingAgents)
    .where(and(eq(incomingAgents.userId, userId), eq(incomingAgents.isActive, true)))
    .limit(20);

  return rows.map((r) => ({
    name: sanitizeUntrustedExcerpt(r.name, 60),
    enabled: !!r.enabled,
    start: r.start,
    end: r.end,
    timezone: r.timezone,
    transferEnabled: !!r.transferEnabled,
  }));
}

async function loadIvrHints(userId: string, engineType: 'default' | 'bedrock-polly') {
  requireUserScope(userId);
  const rows = await db
    .select({
      name: ivrConfigurations.name,
      voiceName: ivrConfigurations.voiceName,
      engineType: ivrConfigurations.engineType,
    })
    .from(ivrConfigurations)
    .where(
      and(
        eq(ivrConfigurations.userId, userId),
        eq(ivrConfigurations.isActive, true),
        eq(ivrConfigurations.engineType, engineType),
      ),
    )
    .limit(10);
  return rows;
}

function buildGaps(ctx: Omit<TenantCopilotContext, 'gaps' | 'departments'>): TenantGap[] {
  const gaps: TenantGap[] = [];
  if (ctx.knowledgeBase.length === 0) {
    gaps.push({
      module: 'knowledge-base',
      message: 'No knowledge base articles yet',
      nextStep: 'Add FAQs or procedures under Knowledge Base so automations can use your real content.',
    });
  }
  if (ctx.deprock.departments.length === 0) {
    gaps.push({
      module: 'deprock',
      message: 'No Deprock (Automation Builder inbound) departments configured',
      nextStep: 'Create departments and agents in Deprock before building transfer/routing automations.',
    });
  }
  if (ctx.ops.departments.length === 0) {
    gaps.push({
      module: 'ops',
      message: 'No Ops / AI Call Center departments configured',
      nextStep: 'Add departments and agents under Call Center (Ops) so routing matches how you run.',
    });
  }
  if (ctx.voices.length === 0) {
    gaps.push({
      module: 'voices',
      message: 'No voices configured for this account',
      nextStep: 'Configure at least one voice under Voices before assigning voice options.',
    });
  }
  if (ctx.ops.phones.length === 0) {
    gaps.push({
      module: 'phones',
      message: 'No phone numbers on this account',
      nextStep: 'Purchase or assign a phone number so inbound automations have a real line.',
    });
  }
  return gaps;
}

export async function loadTenantCopilotContext(
  userId: string,
  companyName: string,
): Promise<TenantCopilotContext> {
  requireUserScope(userId);

  let workspaceId: string | null = null;
  try {
    const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(userId);
    workspaceId = workspace?.id ?? null;
  } catch {
    workspaceId = null;
  }

  const [kb, opsDepts, deprockDepts, tenantVoices, phones, businessHours] =
    await Promise.all([
      loadKnowledgeArticles(userId),
      loadDepartmentsByEngine(userId, 'default', 'ops'),
      loadDepartmentsByEngine(userId, 'bedrock-polly', 'deprock'),
      loadTenantVoices(userId),
      loadTenantPhones(userId),
      loadOpsBusinessHours(userId),
    ]);

  // Touch IVR so context loaders stay fail-closed if used later for richer prompts
  await Promise.all([
    loadIvrHints(userId, 'default'),
    loadIvrHints(userId, 'bedrock-polly'),
  ]);

  const partial = {
    userId,
    workspaceId,
    companyName: companyName?.trim() || 'your call center',
    knowledgeBase: kb,
    deprock: { departments: deprockDepts },
    ops: {
      departments: opsDepts,
      phones,
      businessHours,
    },
    voices: tenantVoices,
  };

  return {
    ...partial,
    gaps: buildGaps(partial),
    departments: [...opsDepts, ...deprockDepts],
  };
}

export function serializeTenantContextForPrompt(ctx: TenantCopilotContext): string {
  const kbBody =
    ctx.knowledgeBase.length === 0
      ? '(empty)'
      : ctx.knowledgeBase
          .map((a) => `- [${a.type}] ${a.title}: ${a.excerpt || '(no excerpt)'}`)
          .join('\n');

  const fmtDepts = (depts: TenantDepartment[]) =>
    depts.length === 0
      ? '(none configured)'
      : depts
          .map((d) => {
            const agents =
              d.agents.length === 0
                ? '(no agents)'
                : d.agents.map((a) => `${a.name} (${a.language})`).join(', ');
            return `- ${d.name}: ${agents}`;
          })
          .join('\n');

  const voicesBody =
    ctx.voices.length === 0
      ? '(none configured)'
      : ctx.voices.map((v) => `- ${v.name}`).join('\n');

  const phonesBody =
    ctx.ops.phones.length === 0
      ? '(none)'
      : ctx.ops.phones.map((p) => `- ${p.label}`).join('\n');

  const hoursBody =
    ctx.ops.businessHours.length === 0
      ? '(no business-hours profiles)'
      : ctx.ops.businessHours
          .map((h) => {
            if (!h.enabled) return `- ${h.name}: hours disabled; transfer=${h.transferEnabled ? 'on' : 'off'}`;
            return `- ${h.name}: ${h.start || '?'}–${h.end || '?'} ${h.timezone || ''} (transfer=${h.transferEnabled ? 'on' : 'off'})`;
          })
          .join('\n');

  const gapsBody =
    ctx.gaps.length === 0
      ? '(none — core modules have data)'
      : ctx.gaps.map((g) => `- [${g.module}] ${g.message} → ${g.nextStep}`).join('\n');

  // Internal IDs for model assignment only — never echo raw IDs in reply text
  const idMap = [
    ...ctx.departments.flatMap((d) => [
      `dept:${d.source}:${d.name}=${d.id}`,
      ...d.agents.map((a) => `agent:${d.name}:${a.name}=${a.id}`),
    ]),
    ...ctx.voices.map((v) => `voice:${v.name}=${v.id}`),
  ].join('\n');

  const blocks = [
    wrapTenantDataBlock('knowledge-base', kbBody),
    wrapTenantDataBlock('deprock', fmtDepts(ctx.deprock.departments)),
    wrapTenantDataBlock(
      'ops',
      [
        'Departments:',
        fmtDepts(ctx.ops.departments),
        'Phones:',
        phonesBody,
        'Business hours / transfer:',
        hoursBody,
      ].join('\n'),
    ),
    wrapTenantDataBlock('voices', voicesBody),
    wrapTenantDataBlock('setup-gaps', gapsBody),
    wrapTenantDataBlock(
      'id-map-internal-only',
      idMap || '(no ids — do not invent any)',
    ),
  ];

  const joined = blocks.join('\n\n');
  const MAX = 12_000;
  if (joined.length <= MAX) return joined;
  return `${joined.slice(0, MAX)}\n…[tenant context truncated]`;
}

export type SanitizableAutomation = {
  name: string;
  status: 'draft' | 'published';
  steps: Array<{
    id: string;
    order: number;
    type: 'trigger' | 'action';
    appId: string | null;
    actionId: string | null;
    label: string;
    config: Record<string, unknown>;
  }>;
};

export function tenantAgentIdSet(ctx: Pick<TenantCopilotContext, 'departments'>): Set<string> {
  const ids = new Set<string>();
  for (const dept of ctx.departments) {
    for (const agent of dept.agents) ids.add(agent.id);
  }
  return ids;
}

export function tenantDepartmentIdSet(
  ctx: Pick<TenantCopilotContext, 'departments'>,
): Set<string> {
  return new Set(ctx.departments.map((d) => d.id));
}

export function tenantVoiceIdSet(ctx: Pick<TenantCopilotContext, 'voices'>): Set<string> {
  return new Set(ctx.voices.map((v) => v.id));
}

/** Keep automation transfers / voice / dept refs inside this tenant only. */
export function sanitizeAutomationToTenantScope<T extends SanitizableAutomation>(
  automation: T,
  ctx: Pick<TenantCopilotContext, 'departments' | 'voices' | 'ops'>,
): T {
  const allowedAgents = tenantAgentIdSet(ctx);
  const allowedDepts = tenantDepartmentIdSet(ctx);
  const allowedVoices = tenantVoiceIdSet(ctx);
  const allowedPhones = new Set(ctx.ops.phones.map((p) => p.id));

  return {
    ...automation,
    steps: automation.steps.map((step) => {
      const config = { ...step.config };
      const transferAgentId =
        typeof config.transferAgentId === 'string' ? config.transferAgentId.trim() : '';
      if (transferAgentId && !allowedAgents.has(transferAgentId)) {
        config.transferAgentId = null;
      }
      const departmentId =
        typeof config.departmentId === 'string' ? config.departmentId.trim() : '';
      if (departmentId && !allowedDepts.has(departmentId)) {
        config.departmentId = null;
      }
      const voiceId = typeof config.voiceId === 'string' ? config.voiceId.trim() : '';
      if (voiceId && !allowedVoices.has(voiceId)) {
        config.voiceId = null;
      }
      const phoneNumberId =
        typeof config.phoneNumberId === 'string' ? config.phoneNumberId.trim() : '';
      if (phoneNumberId && !allowedPhones.has(phoneNumberId)) {
        config.phoneNumberId = null;
      }
      return { ...step, config };
    }),
  };
}

export function detectDestructiveIntent(
  message: string,
): 'publish' | 'delete_chat' | 'overwrite' | null {
  const msg = message.trim().toLowerCase();
  if (
    /\b(publish|go\s+live|make\s+(it\s+)?live|push\s+live|deploy\s+(this|the)\s+automation)\b/i.test(
      msg,
    )
  ) {
    return 'publish';
  }
  if (/\b(delete\s+(this\s+)?(chat|conversation|automation)|remove\s+this\s+chat)\b/i.test(msg)) {
    return 'delete_chat';
  }
  if (/\b(overwrite|replace\s+(the\s+)?(current\s+)?(draft|automation|canvas))\b/i.test(msg)) {
    return 'overwrite';
  }
  return null;
}

export function isAffirmativeConfirmation(message: string): boolean {
  const msg = message.trim().toLowerCase();
  return /^(yes|yep|yeah|confirm|confirmed|do\s+it|go\s+ahead|proceed|approve|ok|okay)\b/i.test(
    msg,
  );
}

/** Short one-time token for destructive confirm (publish / overwrite / delete). */
export function createConfirmToken(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

/** Confirm only when UI sends confirm:true with the exact pending token. */
export function confirmTokenMatches(
  pendingToken: string | null | undefined,
  provided: unknown,
): boolean {
  if (!pendingToken) return false;
  const token = typeof provided === 'string' ? provided.trim() : '';
  return token.length > 0 && token === pendingToken;
}
