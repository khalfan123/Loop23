import { describe, it, expect } from 'vitest';
import {
  createFieldMapAdapter,
  gatherEvidence,
  synthesizeAcrossSources,
} from '../../server/services/cross-source-adapters';

describe('createFieldMapAdapter', () => {
  it('maps record fields to facts with id, title, recency and confidence', () => {
    const adapter = createFieldMapAdapter({
      sourceType: 'crm',
      idField: 'accountId',
      titleField: 'name',
      updatedAtField: 'updatedAt',
      confidence: 0.9,
      fields: { plan_name: 'plan', email_addr: 'email' }, // rename record→fact
    });
    const ev = adapter.toEvidence({
      accountId: '123',
      name: 'Acme',
      plan_name: 'Pro',
      email_addr: 'a@acme.com',
      updatedAt: '2026-07-01T00:00:00Z',
    });
    expect(ev.sourceId).toBe('crm:123');
    expect(ev.title).toBe('Acme');
    expect(ev.confidence).toBe(0.9);
    expect(ev.updatedAt).toBe(Date.parse('2026-07-01T00:00:00Z'));
    expect(ev.facts).toEqual([
      { key: 'plan', value: 'Pro' },
      { key: 'email', value: 'a@acme.com' },
    ]);
  });

  it('supports an array field list (field name = fact key) and skips empty values', () => {
    const adapter = createFieldMapAdapter({ sourceType: 'erp', idField: 'id', fields: ['plan', 'balance', 'missing'] });
    const ev = adapter.toEvidence({ id: 7, plan: 'Enterprise', balance: 0, missing: '' });
    expect(ev.facts).toEqual([
      { key: 'plan', value: 'Enterprise' },
      { key: 'balance', value: 0 }, // numeric 0 kept
    ]);
    // empty string skipped
    expect(ev.facts.find(f => f.key === 'missing')).toBeUndefined();
  });
});

describe('gatherEvidence / synthesizeAcrossSources', () => {
  const crm = createFieldMapAdapter({ sourceType: 'crm', idField: 'id', updatedAtField: 'updatedAt', fields: ['plan'] });
  const erp = createFieldMapAdapter({ sourceType: 'erp', idField: 'id', updatedAtField: 'updatedAt', fields: ['plan'] });

  it('flattens every source record into evidence', () => {
    const evidence = gatherEvidence([
      { adapter: crm, records: [{ id: 1, plan: 'Pro', updatedAt: 1 }, { id: 2, plan: 'Pro', updatedAt: 1 }] },
      { adapter: erp, records: [{ id: 9, plan: 'Pro', updatedAt: 1 }] },
    ]);
    expect(evidence).toHaveLength(3);
    expect(evidence.map(e => e.sourceType)).toEqual(['crm', 'crm', 'erp']);
  });

  it('runs a full cross-source synthesis, resolving conflicts by source trust', () => {
    const NOW = 1_700_000_000_000;
    const { synthesis } = synthesizeAcrossSources(
      [
        { adapter: crm, records: [{ id: 1, plan: 'Basic', updatedAt: NOW }] },
        { adapter: erp, records: [{ id: 9, plan: 'Enterprise', updatedAt: NOW }] },
      ],
      { requiredKeys: ['plan'], now: () => NOW }
    );
    const plan = synthesis.facts.find(f => f.key === 'plan')!;
    expect(plan.value).toBe('Enterprise'); // ERP outranks CRM
    expect(plan.conflicted).toBe(true);
    expect(synthesis.gaps).toEqual([]);
    expect(synthesis.coverage).toBe(1);
  });
});
