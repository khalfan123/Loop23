/**
 * ============================================================
 * Knowledge & reasoning — cross-source adapters + orchestrator
 *
 * The CrossSourceReasoner reconciles SourceEvidence; this layer is what turns
 * real system records (CRM contacts, ERP orders, DB rows, doc chunks) INTO
 * that evidence and drives a full synthesis. Adapters are pure record→evidence
 * mappers, so the whole knowledge path is testable without any live
 * credential — fetching the records is the only credentialed step, and it's
 * kept out of this module behind the adapter/record boundary.
 * ============================================================
 */

import {
  crossSourceReasoner,
  type SourceEvidence,
  type SourceFact,
  type FactValue,
  type SynthesisResult,
  type ReconcileOptions,
} from './cross-source-reasoner';

export interface SourceAdapter<Raw = Record<string, unknown>> {
  sourceType: string;
  toEvidence(raw: Raw): SourceEvidence;
}

export interface FieldMapAdapterConfig {
  sourceType: string;
  /** Record field holding the stable id (for citation). */
  idField?: string;
  titleField?: string;
  /** Record field holding a recency timestamp (ms epoch or Date/ISO). */
  updatedAtField?: string;
  /** Record field holding raw supporting text. */
  textField?: string;
  confidence?: number;
  /**
   * Which record fields become facts. An array uses the field names as fact
   * keys; a map renames them (recordField -> factKey).
   */
  fields: string[] | Record<string, string>;
}

/**
 * A generic, config-driven adapter: map selected record fields to facts. Most
 * REST/DB/CRM sources need nothing more than this; bespoke shapes get a custom
 * SourceAdapter.
 */
export function createFieldMapAdapter(
  cfg: FieldMapAdapterConfig
): SourceAdapter<Record<string, unknown>> {
  const pairs: Array<[string, string]> = Array.isArray(cfg.fields)
    ? cfg.fields.map(f => [f, f])
    : Object.entries(cfg.fields);

  return {
    sourceType: cfg.sourceType,
    toEvidence(raw: Record<string, unknown>): SourceEvidence {
      const facts: SourceFact[] = [];
      for (const [recordField, factKey] of pairs) {
        const value = raw[recordField];
        if (isFactValue(value)) facts.push({ key: factKey, value });
      }
      const idRaw = cfg.idField ? raw[cfg.idField] : undefined;
      const sourceId = idRaw != null ? `${cfg.sourceType}:${String(idRaw)}` : cfg.sourceType;
      const ev: SourceEvidence = { sourceType: cfg.sourceType, sourceId, facts };
      if (cfg.titleField && typeof raw[cfg.titleField] === 'string') ev.title = raw[cfg.titleField] as string;
      if (cfg.textField && typeof raw[cfg.textField] === 'string') ev.text = raw[cfg.textField] as string;
      if (cfg.confidence !== undefined) ev.confidence = cfg.confidence;
      const at = cfg.updatedAtField ? toEpochMs(raw[cfg.updatedAtField]) : undefined;
      if (at !== undefined) ev.updatedAt = at;
      return ev;
    },
  };
}

export interface SourceInput<Raw = Record<string, unknown>> {
  adapter: SourceAdapter<Raw>;
  records: Raw[];
}

/** Map every source's records into a flat evidence list. */
export function gatherEvidence(inputs: SourceInput[]): SourceEvidence[] {
  const evidence: SourceEvidence[] = [];
  for (const input of inputs) {
    for (const record of input.records) {
      evidence.push(input.adapter.toEvidence(record));
    }
  }
  return evidence;
}

/**
 * End-to-end cross-source synthesis: adapt each source's records to evidence,
 * then reconcile into one cited, conflict-resolved view. Returns the evidence
 * alongside the result so callers can hand both to an LLM for prose.
 */
export function synthesizeAcrossSources(
  inputs: SourceInput[],
  options: ReconcileOptions = {}
): { evidence: SourceEvidence[]; synthesis: SynthesisResult } {
  const evidence = gatherEvidence(inputs);
  return { evidence, synthesis: crossSourceReasoner.reconcile(evidence, options) };
}

function isFactValue(v: unknown): v is FactValue {
  return (typeof v === 'string' && v.length > 0) || typeof v === 'number' || typeof v === 'boolean';
}

function toEpochMs(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'string') {
    const t = Date.parse(v);
    if (!Number.isNaN(t)) return t;
  }
  return undefined;
}
