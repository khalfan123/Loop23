import { describe, it, expect } from 'vitest';
import {
  CrossSourceReasoner,
  type SourceEvidence,
} from '../../server/services/cross-source-reasoner';

const reasoner = new CrossSourceReasoner();
const NOW = 1_700_000_000_000;
const now = () => NOW;
const daysAgo = (d: number) => NOW - d * 86_400_000;

describe('CrossSourceReasoner.reconcile', () => {
  it('merges agreeing facts across sources with combined provenance', () => {
    const evidence: SourceEvidence[] = [
      { sourceType: 'crm', sourceId: 'sf:1', facts: [{ key: 'plan', value: 'Pro' }], updatedAt: daysAgo(1) },
      { sourceType: 'erp', sourceId: 'sap:1', facts: [{ key: 'plan', value: 'pro' }], updatedAt: daysAgo(2) },
    ];
    const r = reasoner.reconcile(evidence, { now });
    const plan = r.facts.find(f => f.key === 'plan')!;
    // The value comes from the highest-scoring source; the two agree
    // case-insensitively, so they merge (no conflict) with joint provenance.
    expect(String(plan.value).toLowerCase()).toBe('pro');
    expect(plan.conflicted).toBe(false);
    expect(plan.provenance).toHaveLength(2); // both sources agreed
  });

  it('resolves a conflict in favor of the higher-trust source and records it', () => {
    const evidence: SourceEvidence[] = [
      { sourceType: 'email', sourceId: 'em:9', facts: [{ key: 'plan', value: 'Basic' }], updatedAt: daysAgo(1) },
      { sourceType: 'erp', sourceId: 'sap:1', facts: [{ key: 'plan', value: 'Enterprise' }], updatedAt: daysAgo(1) },
    ];
    const r = reasoner.reconcile(evidence, { now });
    const plan = r.facts.find(f => f.key === 'plan')!;
    expect(plan.value).toBe('Enterprise'); // ERP outranks email
    expect(plan.conflicted).toBe(true);
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0].chosen.sourceType).toBe('erp');
    expect(r.conflicts[0].rejected[0].value).toBe('Basic');
  });

  it('lets strong recency override a small trust gap', () => {
    // CRM (0.85) fresh today vs API (0.75) — CRM wins on both counts.
    // Here: API is much fresher and CRM is very stale, closing the gap.
    const evidence: SourceEvidence[] = [
      { sourceType: 'crm', sourceId: 'sf:1', facts: [{ key: 'email', value: 'old@x.com' }], updatedAt: daysAgo(400) },
      { sourceType: 'api', sourceId: 'api:1', facts: [{ key: 'email', value: 'new@x.com' }], updatedAt: daysAgo(0) },
    ];
    const r = reasoner.reconcile(evidence, { now });
    expect(r.facts.find(f => f.key === 'email')!.value).toBe('new@x.com');
  });

  it('reports gaps and coverage against the query required keys', () => {
    const evidence: SourceEvidence[] = [
      { sourceType: 'crm', sourceId: 'sf:1', facts: [{ key: 'plan', value: 'Pro' }, { key: 'name', value: 'Sara' }] },
    ];
    const r = reasoner.reconcile(evidence, { requiredKeys: ['plan', 'name', 'balance'], now });
    expect(r.gaps).toEqual(['balance']);
    expect(r.coverage).toBeCloseTo(2 / 3, 2);
  });

  it('collects de-duplicated citations from every source', () => {
    const evidence: SourceEvidence[] = [
      { sourceType: 'docs', sourceId: 'doc:1', title: 'Refund policy', facts: [{ key: 'refundDays', value: 14 }] },
      { sourceType: 'docs', sourceId: 'doc:1', title: 'Refund policy', text: 'Refunds within 14 days.' }, // dup id
      { sourceType: 'crm', sourceId: 'sf:1', facts: [{ key: 'plan', value: 'Pro' }] },
    ];
    const r = reasoner.reconcile(evidence, { now });
    expect(r.citations).toHaveLength(2); // doc:1 collapsed
    expect(r.citations.map(c => c.sourceId).sort()).toEqual(['doc:1', 'sf:1']);
  });

  it('compares numeric facts numerically (no string coercion surprises)', () => {
    const evidence: SourceEvidence[] = [
      { sourceType: 'erp', sourceId: 'sap:1', facts: [{ key: 'balance', value: 100 }], updatedAt: daysAgo(1) },
      { sourceType: 'database', sourceId: 'db:1', facts: [{ key: 'balance', value: 100 }], updatedAt: daysAgo(1) },
    ];
    const r = reasoner.reconcile(evidence, { now });
    const balance = r.facts.find(f => f.key === 'balance')!;
    expect(balance.conflicted).toBe(false);
    expect(balance.value).toBe(100);
  });

  it('produces a lower aggregate confidence when sources conflict', () => {
    const agreeing: SourceEvidence[] = [
      { sourceType: 'erp', sourceId: 'a', facts: [{ key: 'plan', value: 'Pro' }], updatedAt: daysAgo(1) },
      { sourceType: 'crm', sourceId: 'b', facts: [{ key: 'plan', value: 'Pro' }], updatedAt: daysAgo(1) },
    ];
    const conflicting: SourceEvidence[] = [
      { sourceType: 'erp', sourceId: 'a', facts: [{ key: 'plan', value: 'Pro' }], updatedAt: daysAgo(1) },
      { sourceType: 'crm', sourceId: 'b', facts: [{ key: 'plan', value: 'Basic' }], updatedAt: daysAgo(1) },
    ];
    const cAgree = reasoner.reconcile(agreeing, { now }).confidence;
    const cConflict = reasoner.reconcile(conflicting, { now }).confidence;
    expect(cConflict).toBeLessThan(cAgree);
  });

  it('handles empty evidence without throwing', () => {
    const r = reasoner.reconcile([], { requiredKeys: ['plan'], now });
    expect(r.facts).toEqual([]);
    expect(r.gaps).toEqual(['plan']);
    expect(r.coverage).toBe(0);
    expect(r.confidence).toBe(0);
  });
});
