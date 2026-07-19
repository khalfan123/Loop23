'use strict';

import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { agents, departmentAgents, departments, knowledgeBase } from '@shared/schema';
import { storage } from '../storage';
import { awsBedrockService } from './aws-bedrock';
import { WorkspaceService } from './workspace-service';
import { requireUserScope, sanitizeUntrustedExcerpt } from './automation-copilot-context';

const GENERIC_FALLBACK = 'your call center';
const companyCache = new Map<string, { name: string; at: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function resolveCompanyNameFromPrompt(input: {
  systemPrompt?: string | null;
  firstMessage?: string | null;
}): string | null {
  const text = [input.systemPrompt, input.firstMessage].filter(Boolean).join('\n');
  const match = text.match(/(?:company|business|brand)\s*(?:name)?\s*[:\-]\s*([^\n]+)/i);
  return match?.[1]?.trim() || null;
}

/** Platform / account labels that must never be treated as the tenant's call-center brand. */
const PLATFORM_ADMIN_RE =
  /^(loop9(\s+admin)?|byan(\s+ai)?|agentlabs?|agent\s*labs|rest-express)(\s+admin)?$/i;

export function isGenericCompanyLabel(name: string | null | undefined): boolean {
  const n = (name || '').trim().toLowerCase();
  return (
    !n ||
    n === 'your company' ||
    n === 'your call center' ||
    n === 'unknown' ||
    n === 'company' ||
    n === 'n/a'
  );
}

export function isPlatformOrAdminLabel(name: string | null | undefined): boolean {
  const n = (name || '').trim();
  if (!n) return true;
  if (PLATFORM_ADMIN_RE.test(n)) return true;
  if (/\badmin\b/i.test(n) && /loop9|byan|agentlabs?/i.test(n)) return true;
  // Bare role labels, not brands
  if (/^(admin|administrator|owner|user)$/i.test(n)) return true;
  return false;
}

/** Soft clean for profile/workspace/KB brand values. */
export function trustAccountCompanyName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let resolved = String(raw)
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\.[a-z]{2,10}(\/.*)?$/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim();
  if (!resolved || resolved.length < 2 || resolved.length > 60) return null;
  if (isGenericCompanyLabel(resolved)) return null;
  if (isPlatformOrAdminLabel(resolved)) return null;
  if (resolved.includes('?')) return null;
  if (
    /^(comparing|compare|getting started|overview|guide|how to|what is|faq)\b/i.test(resolved)
  ) {
    return null;
  }
  return resolved.charAt(0).toUpperCase() + resolved.slice(1);
}

function clampBrand(raw: string): string | null {
  return trustAccountCompanyName(raw);
}

function extractCompanyFromText(text: string | null | undefined): string | null {
  if (!text || !text.trim()) return null;
  const patterns = [
    /(?:^|\n)\s*Company\s*[:\-]\s*([^\n]+)/i,
    /(?:^|\n)\s*Company Name\s*[:\-]\s*([^\n]+)/i,
    /(?:^|\n)\s*Brand\s*[:\-]\s*([^\n]+)/i,
    /(?:work(?:s|ing)?\s+(?:for|at)|representing|from)\s+([A-Z][A-Za-z0-9&.\- ]{1,40})/i,
    /(?:thanks for calling|welcome to)\s+([A-Z][A-Za-z0-9&.\- ]{1,40})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const cleaned = clampBrand(m[1]);
      if (cleaned) return cleaned;
    }
  }
  const fromPrompt = resolveCompanyNameFromPrompt({
    systemPrompt: text,
    firstMessage: text,
  });
  if (fromPrompt) return clampBrand(fromPrompt);
  return null;
}

async function resolveFromAgents(userId: string): Promise<string | null> {
  requireUserScope(userId);

  const linked = await db
    .select({
      systemPrompt: agents.systemPrompt,
      firstMessage: agents.firstMessage,
    })
    .from(agents)
    .innerJoin(departmentAgents, eq(departmentAgents.agentId, agents.id))
    .innerJoin(departments, eq(departmentAgents.departmentId, departments.id))
    .where(and(eq(agents.userId, userId), eq(departments.userId, userId)))
    .limit(25);

  for (const row of linked) {
    const fromPrompt = resolveCompanyNameFromPrompt({
      systemPrompt: row.systemPrompt,
      firstMessage: row.firstMessage,
    });
    if (fromPrompt) {
      const cleaned = clampBrand(fromPrompt);
      if (cleaned) return cleaned;
    }
    const fromText = extractCompanyFromText(
      [row.systemPrompt, row.firstMessage].filter(Boolean).join('\n'),
    );
    if (fromText) return fromText;
  }

  const allAgents = await db
    .select({
      systemPrompt: agents.systemPrompt,
      firstMessage: agents.firstMessage,
      name: agents.name,
    })
    .from(agents)
    .where(eq(agents.userId, userId))
    .limit(25);

  for (const row of allAgents) {
    const fromPrompt = resolveCompanyNameFromPrompt({
      systemPrompt: row.systemPrompt,
      firstMessage: row.firstMessage,
    });
    if (fromPrompt) {
      const cleaned = clampBrand(fromPrompt);
      if (cleaned) return cleaned;
    }
    const fromText = extractCompanyFromText(
      [row.systemPrompt, row.firstMessage].filter(Boolean).join('\n'),
    );
    if (fromText) return fromText;
  }

  return null;
}

async function resolveFromKnowledgeBase(userId: string): Promise<{
  name: string | null;
  snippets: string[];
}> {
  requireUserScope(userId);
  const kbEntries = await db
    .select({
      title: knowledgeBase.title,
      type: knowledgeBase.type,
      content: knowledgeBase.content,
      metadata: knowledgeBase.metadata,
    })
    .from(knowledgeBase)
    .where(eq(knowledgeBase.userId, userId))
    .limit(40);

  const snippets: string[] = [];

  // Pass 1: explicit metadata / businessProfile (highest signal for this tenant's brand)
  for (const entry of kbEntries) {
    const meta = (entry.metadata || {}) as Record<string, unknown>;
    if (typeof meta.companyName === 'string' && meta.companyName.trim()) {
      const cleaned = trustAccountCompanyName(meta.companyName);
      if (cleaned) return { name: cleaned, snippets };
    }
    if (meta.businessProfile && typeof meta.businessProfile === 'object') {
      const profileName = (meta.businessProfile as { companyName?: unknown }).companyName;
      if (typeof profileName === 'string' && profileName.trim()) {
        const cleaned = trustAccountCompanyName(profileName);
        if (cleaned) return { name: cleaned, snippets };
      }
    }
  }

  // Pass 2: structured Company: lines in content
  for (const entry of kbEntries) {
    const fromContent = extractCompanyFromText(entry.content);
    if (fromContent) return { name: fromContent, snippets };
  }

  // Pass 3: collect snippets for Bedrock; also catch short brand titles that look like company names
  for (const entry of kbEntries) {
    if (entry.content?.trim()) {
      snippets.push(
        `KB[${entry.type}] ${sanitizeUntrustedExcerpt(entry.title || '', 80)}: ${sanitizeUntrustedExcerpt(entry.content, 400)}`,
      );
    }
    // Synthesized docs often start with "Company: LinkEx"
    const titleBrand = trustAccountCompanyName(entry.title || '');
    if (
      titleBrand &&
      entry.title &&
      entry.title.trim().split(/\s+/).length <= 3 &&
      !/\b(faq|guide|overview|policy|pricing)\b/i.test(entry.title)
    ) {
      // Prefer titles that appear with company framing in content
      if (
        entry.content &&
        new RegExp(`\\b${titleBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(
          entry.content,
        )
      ) {
        return { name: titleBrand, snippets };
      }
    }
  }

  return { name: null, snippets: snippets.slice(0, 12) };
}

async function resolveWithBedrock(snippets: string[]): Promise<string | null> {
  if (!awsBedrockService.isConfigured() || snippets.length === 0) return null;
  try {
    const result = await awsBedrockService.invoke({
      model: 'claude-3-5-haiku',
      systemPrompt: [
        'You extract the company/brand name for ONE authenticated call-center tenant from their knowledge base and agent text.',
        'Use only the provided tenant snippets. Never invent a brand.',
        'NEVER return platform or account labels: Loop9, Loop9 Admin, Byan, Byan AI, AgentLabs, Admin.',
        'Prefer names that appear as Company:/Brand: or as the business the agents work for (e.g. LinkEx).',
        'Return ONLY JSON: {"companyName":"Brand"} or {"companyName":null}',
      ].join(' '),
      messages: [
        {
          role: 'user',
          content: `Tenant snippets:\n${snippets.join('\n---\n').slice(0, 7000)}`,
        },
      ],
      maxTokens: 80,
      temperature: 0,
    });

    const match = result.content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { companyName?: unknown };
    if (typeof parsed.companyName !== 'string') return null;
    return trustAccountCompanyName(parsed.companyName);
  } catch (err: any) {
    console.warn('[Copilot] Bedrock company resolve failed:', err?.message || err);
    return null;
  }
}

function cacheSet(userId: string, name: string) {
  companyCache.set(userId, { name, at: Date.now() });
}

/**
 * Resolve the tenant's call-center brand for Copilot personalization.
 * Priority: Knowledge Base → agents → profile/workspace (non-platform) → Bedrock → fallback.
 * Never returns "your company" or platform labels like "Loop9 Admin".
 */
export async function resolveCopilotCompanyName(userId: string): Promise<string> {
  requireUserScope(userId);

  const cached = companyCache.get(userId);
  if (
    cached &&
    Date.now() - cached.at < CACHE_TTL_MS &&
    !isGenericCompanyLabel(cached.name) &&
    !isPlatformOrAdminLabel(cached.name)
  ) {
    return cached.name;
  }

  const bedrockSnippets: string[] = [];

  try {
    // 1) Knowledge Base brand (LinkEx etc.) — primary signal for personalization
    const kb = await resolveFromKnowledgeBase(userId);
    if (kb.name) {
      cacheSet(userId, kb.name);
      return kb.name;
    }
    bedrockSnippets.push(...kb.snippets);

    // 2) Agents speak as the company
    const fromAgents = await resolveFromAgents(userId);
    if (fromAgents) {
      cacheSet(userId, fromAgents);
      return fromAgents;
    }

    const user = await storage.getUser(userId);

    // 3) Profile company — only if not a platform/admin label
    const fromProfile = trustAccountCompanyName(user?.company);
    if (fromProfile) {
      cacheSet(userId, fromProfile);
      return fromProfile;
    }

    try {
      const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(userId);
      const fromWorkspace = trustAccountCompanyName(workspace?.name);
      if (fromWorkspace && !/^workspace\b/i.test(fromWorkspace)) {
        cacheSet(userId, fromWorkspace);
        return fromWorkspace;
      }
      // Do not feed platform workspace names into Bedrock
      if (workspace?.name && !isPlatformOrAdminLabel(workspace.name)) {
        bedrockSnippets.push(
          `Workspace name: ${sanitizeUntrustedExcerpt(workspace.name, 80)}`,
        );
      }
    } catch {
      // ignore
    }

    const fromBilling = trustAccountCompanyName(user?.billingName);
    if (fromBilling) {
      cacheSet(userId, fromBilling);
      return fromBilling;
    }

    // Agent snippets for Bedrock (never owner display name — that yields "Loop9 Admin")
    if (bedrockSnippets.length < 3) {
      const agentRows = await db
        .select({
          name: agents.name,
          systemPrompt: agents.systemPrompt,
          firstMessage: agents.firstMessage,
        })
        .from(agents)
        .where(eq(agents.userId, userId))
        .limit(8);
      for (const a of agentRows) {
        bedrockSnippets.push(
          `Agent ${sanitizeUntrustedExcerpt(a.name, 40)}: ${sanitizeUntrustedExcerpt(
            [a.firstMessage, a.systemPrompt].filter(Boolean).join(' '),
            350,
          )}`,
        );
      }
    }

    const fromBedrock = await resolveWithBedrock(bedrockSnippets);
    if (fromBedrock) {
      cacheSet(userId, fromBedrock);
      return fromBedrock;
    }
  } catch (err: any) {
    console.warn('[Copilot] company resolve error:', err?.message || err);
  }

  return GENERIC_FALLBACK;
}

/** For tests / cache bust after profile updates */
export function clearCopilotCompanyCache(userId?: string) {
  if (userId) companyCache.delete(userId);
  else companyCache.clear();
}
