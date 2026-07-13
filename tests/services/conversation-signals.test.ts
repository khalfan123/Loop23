import { describe, it, expect } from 'vitest';
import { normalizeSentiment, insightsToSignal } from '../../server/services/conversation-signals';
import { MetricsRecorder } from '../../server/voice-core/metrics';

describe('normalizeSentiment', () => {
  it('collapses the 5-level scale to the 3-level ops scale', () => {
    expect(normalizeSentiment('positive')).toBe('positive');
    expect(normalizeSentiment('neutral')).toBe('neutral');
    expect(normalizeSentiment('cautious')).toBe('neutral'); // conservative
    expect(normalizeSentiment('negative')).toBe('negative');
    expect(normalizeSentiment('critical')).toBe('negative');
  });

  it('returns undefined for missing/unknown levels', () => {
    expect(normalizeSentiment(undefined)).toBeUndefined();
    expect(normalizeSentiment('weird')).toBeUndefined();
  });
});

describe('insightsToSignal', () => {
  it('maps sentiment and classification (as intent)', () => {
    const s = insightsToSignal('CA1', { sentiment: 'positive', classification: 'hot' });
    expect(s).toEqual({ callSid: 'CA1', sentiment: 'positive', intent: 'hot' });
  });

  it('omits fields with no source rather than emitting nulls', () => {
    const s = insightsToSignal('CA2', { sentiment: 'negative' });
    expect(s).toEqual({ callSid: 'CA2', sentiment: 'negative' });
    expect('confidence' in s).toBe(false);
    expect('csat' in s).toBe(false);
  });

  it('threads optional confidence/CSAT/compliance/at through', () => {
    const s = insightsToSignal('CA3', { sentiment: 'neutral' }, { confidence: 0.82, csat: 4, complianceIssue: true, at: 123 });
    expect(s).toMatchObject({ confidence: 0.82, csat: 4, complianceIssue: true, at: 123 });
  });

  it('tolerates null insights', () => {
    expect(insightsToSignal('CA4', null)).toEqual({ callSid: 'CA4' });
  });

  it('flows end-to-end into the recorder summary', () => {
    const m = new MetricsRecorder();
    m.recordConversationSignal(insightsToSignal('CA5', { sentiment: 'negative', classification: 'lost' }));
    m.recordConversationSignal(insightsToSignal('CA6', { sentiment: 'positive', classification: 'hot' }));
    const s = m.summary().signals;
    expect(s.count).toBe(2);
    expect(s.sentiment.negative).toBe(1);
    expect(s.topIntents.map(t => t.intent).sort()).toEqual(['hot', 'lost']);
  });
});
