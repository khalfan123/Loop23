/**
 * ============================================================
 * Knowledge & reasoning — cross-source reasoning engine
 *
 * The existing ReasoningEngine does hybrid RAG over knowledge-base chunks.
 * This engine sits ABOVE isolated retrieval: it reasons ACROSS heterogeneous
 * enterprise sources (CRM, ERP, docs, APIs, databases, email, policies) by
 * reconciling their facts into one coherent, cited view — resolving conflicts
 * by source trust, recency, and confidence, and reporting what's missing.
 *
 * The deterministic reconciliation (merge, conflict resolution, provenance,
 * gap detection, confidence) lives here and is fully testable; turning the
 * reconciled view into prose is a pluggable LLM step the caller owns.
 * ============================================================
 */

export type SourceType =
  | 'crm' | 'erp' | 'database' | 'api' | 'policy' | 'docs' | 'kb' | 'faq' | 'email' | string;

export type FactValue = string | number | boolean;

export interface SourceFact {
  key: string;
  value: FactValue;
  /** 0..1 confidence in this specific fact. */
  confidence?: number;
}

export interface SourceEvidence {
  sourceType: SourceType;
  /** Stable id for citation, e.g. 'salesforce:account/123' or a doc id. */
  sourceId: string;
  title?: string;
  facts?: SourceFact[];
  /** Unstructured supporting text (kept for citation, not reconciled). */
  text?: string;
  /** Source-level confidence 0..1 (default 0.7). */
  confidence?: number;
  /** Recency (ms epoch) for tie-breaking. */
  updatedAt?: number;
}

export interface Provenance {
  sourceType: SourceType;
  sourceId: string;
}

export interface ReconciledFact {
  key: string;
  value: FactValue;
  confidence: number;
  provenance: Provenance[];
  conflicted: boolean;
}

export interface FactConflict {
  key: string;
  chosen: { value: FactValue; sourceType: SourceType; sourceId: string; score: number };
  rejected: Array<{ value: FactValue; sourceType: SourceType; sourceId: string; score: number }>;
  reason: string;
}

export interface Citation {
  sourceType: SourceType;
  sourceId: string;
  title?: string;
}

export interface SynthesisResult {
  facts: ReconciledFact[];
  conflicts: FactConflict[];
  citations: Citation[];
  /** requiredKeys satisfied ÷ requiredKeys (1 when none specified and facts exist). */
  coverage: number;
  /** Aggregate 0..1, penalized by conflicts and gaps. */
  confidence: number;
  /** Required keys with no supporting evidence. */
  gaps: string[];
}

export interface ReconcileOptions {
  /** Keys the query needs answered; drives coverage + gap reporting. */
  requiredKeys?: string[];
  /** Trust weight per source type (higher = more authoritative). */
  trust?: Partial<Record<SourceType, number>>;
  weights?: { trust?: number; recency?: number; confidence?: number };
  now?: () => number;
}

/** System-of-record data outranks derived/unstructured sources by default. */
const DEFAULT_TRUST: Record<string, number> = {
  policy: 1.0,
  erp: 0.95,
  database: 0.9,
  crm: 0.85,
  api: 0.75,
  docs: 0.6,
  kb: 0.55,
  faq: 0.5,
  email: 0.45,
};

const DEFAULT_WEIGHTS = { trust: 0.6, recency: 0.2, confidence: 0.2 };

export class CrossSourceReasoner {
  reconcile(evidence: SourceEvidence[], options: ReconcileOptions = {}): SynthesisResult {
    const trust = { ...DEFAULT_TRUST, ...(options.trust ?? {}) };
    const w = { ...DEFAULT_WEIGHTS, ...(options.weights ?? {}) };
    const now = options.now ?? Date.now;
    const newest = Math.max(0, ...evidence.map(e => e.updatedAt ?? 0));

    // Gather every candidate fact with a reconciliation score.
    interface Candidate {
      key: string;
      value: FactValue;
      sourceType: SourceType;
      sourceId: string;
      score: number;
    }
    const byKey = new Map<string, Candidate[]>();
    for (const src of evidence) {
      const srcTrust = trust[src.sourceType] ?? 0.5;
      const recency = recencyScore(src.updatedAt, newest, now);
      for (const fact of src.facts ?? []) {
        const conf = clamp01(fact.confidence ?? src.confidence ?? 0.7);
        const score = round(w.trust * srcTrust + w.recency * recency + w.confidence * conf, 4);
        const list = byKey.get(fact.key) ?? [];
        list.push({ key: fact.key, value: fact.value, sourceType: src.sourceType, sourceId: src.sourceId, score });
        byKey.set(fact.key, list);
      }
    }

    const facts: ReconciledFact[] = [];
    const conflicts: FactConflict[] = [];

    for (const [key, candidates] of Array.from(byKey.entries())) {
      candidates.sort((a, b) => b.score - a.score);
      const winner = candidates[0];
      const agree = candidates.filter(c => sameValue(c.value, winner.value));
      const disagree = candidates.filter(c => !sameValue(c.value, winner.value));

      // Confidence in the winning value: its best score, nudged up when
      // multiple independent sources agree, down when strong sources disagree.
      let confidence = winner.score;
      if (agree.length > 1) confidence = Math.min(1, confidence + 0.05 * (agree.length - 1));
      if (disagree.length > 0) confidence = Math.max(0, confidence - 0.15);

      facts.push({
        key,
        value: winner.value,
        confidence: round(confidence, 4),
        provenance: dedupeProvenance(agree.map(c => ({ sourceType: c.sourceType, sourceId: c.sourceId }))),
        conflicted: disagree.length > 0,
      });

      if (disagree.length > 0) {
        conflicts.push({
          key,
          chosen: pick(winner),
          rejected: dedupeRejected(disagree).map(pick),
          reason: `resolved to the ${winner.sourceType} value (highest trust/recency/confidence score ${winner.score})`,
        });
      }
    }

    facts.sort((a, b) => a.key.localeCompare(b.key));

    // Coverage + gaps against the query's required keys.
    const required = options.requiredKeys ?? [];
    const present = new Set(facts.map(f => f.key));
    const gaps = required.filter(k => !present.has(k));
    const coverage = required.length > 0
      ? round((required.length - gaps.length) / required.length, 3)
      : (facts.length > 0 ? 1 : 0);

    const citations = dedupeCitations(evidence.map(e => ({ sourceType: e.sourceType, sourceId: e.sourceId, title: e.title })));

    // Aggregate confidence: mean fact confidence × coverage, penalized per conflict.
    const meanConf = facts.length ? facts.reduce((s, f) => s + f.confidence, 0) / facts.length : 0;
    const conflictPenalty = Math.min(0.3, conflicts.length * 0.05);
    const confidence = round(Math.max(0, meanConf * coverage - conflictPenalty), 4);

    return { facts, conflicts, citations, coverage, confidence, gaps };
  }
}

export const crossSourceReasoner = new CrossSourceReasoner();

function recencyScore(updatedAt: number | undefined, newest: number, now: () => number): number {
  if (!updatedAt || newest <= 0) return 0.5; // unknown recency = neutral
  const ageDays = Math.max(0, (now() - updatedAt) / 86_400_000);
  // 1.0 today, decaying with a ~30-day half-life, floored at 0.1.
  return round(Math.max(0.1, Math.pow(0.5, ageDays / 30)), 4);
}

function sameValue(a: FactValue, b: FactValue): boolean {
  if (typeof a === 'number' && typeof b === 'number') return a === b;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

function pick(c: { value: FactValue; sourceType: SourceType; sourceId: string; score: number }) {
  return { value: c.value, sourceType: c.sourceType, sourceId: c.sourceId, score: c.score };
}

function dedupeProvenance(p: Provenance[]): Provenance[] {
  const seen = new Set<string>();
  return p.filter(x => {
    const k = `${x.sourceType}|${x.sourceId}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function dedupeRejected<T extends { value: FactValue; sourceId: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  return arr.filter(x => {
    const k = `${x.sourceId}|${String(x.value).toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function dedupeCitations(c: Citation[]): Citation[] {
  const seen = new Set<string>();
  return c.filter(x => {
    const k = `${x.sourceType}|${x.sourceId}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
