import { describe, it, expect } from 'vitest';
import { MetricsRecorder, deriveSignalAlerts } from '../../server/voice-core/metrics';

describe('MetricsRecorder — conversation signals', () => {
  it('reports an empty, non-throwing signals block with no data', () => {
    const s = new MetricsRecorder().summary().signals;
    expect(s.count).toBe(0);
    expect(s.sentiment).toMatchObject({ positive: 0, neutral: 0, negative: 0, positivePct: 0, negativePct: 0 });
    expect(s.topIntents).toEqual([]);
    expect(s.avgConfidence).toBeNull();
    expect(s.csat.avg).toBeNull();
    expect(s.compliance.flagged).toBe(0);
  });

  it('aggregates sentiment breakdown as counts and percentages', () => {
    const m = new MetricsRecorder();
    m.recordConversationSignal({ callSid: '1', sentiment: 'positive' });
    m.recordConversationSignal({ callSid: '2', sentiment: 'positive' });
    m.recordConversationSignal({ callSid: '3', sentiment: 'negative' });
    m.recordConversationSignal({ callSid: '4', sentiment: 'neutral' });
    const s = m.summary().signals;
    expect(s.sentiment.positive).toBe(2);
    expect(s.sentiment.positivePct).toBe(50);
    expect(s.sentiment.negativePct).toBe(25);
  });

  it('ranks the top intents by frequency', () => {
    const m = new MetricsRecorder();
    for (const intent of ['billing', 'billing', 'billing', 'support', 'support', 'sales']) {
      m.recordConversationSignal({ callSid: 'x', intent });
    }
    const top = m.summary().signals.topIntents;
    expect(top[0]).toEqual({ intent: 'billing', count: 3 });
    expect(top[1]).toEqual({ intent: 'support', count: 2 });
    expect(top.map(t => t.intent)).toContain('sales');
  });

  it('averages confidence and CSAT only over the signals that carry them', () => {
    const m = new MetricsRecorder();
    m.recordConversationSignal({ callSid: '1', confidence: 0.9, csat: 5 });
    m.recordConversationSignal({ callSid: '2', confidence: 0.7 });      // no csat
    m.recordConversationSignal({ callSid: '3', csat: 3 });             // no confidence
    const s = m.summary().signals;
    expect(s.avgConfidence).toBeCloseTo(0.8, 5); // (0.9+0.7)/2
    expect(s.csat).toEqual({ count: 2, avg: 4 }); // (5+3)/2
    expect(s.count).toBe(3);
  });

  it('tracks the compliance-issue rate', () => {
    const m = new MetricsRecorder();
    m.recordConversationSignal({ callSid: '1', complianceIssue: true });
    m.recordConversationSignal({ callSid: '2' });
    m.recordConversationSignal({ callSid: '3', complianceIssue: true });
    m.recordConversationSignal({ callSid: '4' });
    const s = m.summary().signals;
    expect(s.compliance.flagged).toBe(2);
    expect(s.compliance.flaggedRatePct).toBe(50);
  });
});

describe('deriveSignalAlerts', () => {
  const base = () => new MetricsRecorder().summary().signals;

  it('is silent with no signals', () => {
    expect(deriveSignalAlerts(base())).toEqual([]);
  });

  it('raises a critical compliance alert past 25% and a warning past 10%', () => {
    const m = new MetricsRecorder();
    // 3 of 10 flagged = 30% → critical.
    for (let i = 0; i < 3; i++) m.recordConversationSignal({ callSid: `f${i}`, complianceIssue: true });
    for (let i = 0; i < 7; i++) m.recordConversationSignal({ callSid: `o${i}` });
    const alerts = deriveSignalAlerts(m.summary().signals);
    const compliance = alerts.find(a => a.code === 'compliance_issue');
    expect(compliance?.severity).toBe('critical');
  });

  it('flags negative sentiment, low confidence, and low CSAT', () => {
    const m = new MetricsRecorder();
    m.recordConversationSignal({ callSid: '1', sentiment: 'negative', confidence: 0.4, csat: 2 });
    m.recordConversationSignal({ callSid: '2', sentiment: 'negative', confidence: 0.5, csat: 2 });
    m.recordConversationSignal({ callSid: '3', sentiment: 'positive', confidence: 0.5, csat: 2 });
    const codes = deriveSignalAlerts(m.summary().signals).map(a => a.code);
    expect(codes).toContain('negative_sentiment'); // 2/3 ≈ 67%
    expect(codes).toContain('low_confidence');      // avg < 0.6
    expect(codes).toContain('low_csat');            // avg 2 < 3
  });

  it('surfaces signal alerts through the recorder summary', () => {
    const m = new MetricsRecorder();
    for (let i = 0; i < 5; i++) m.recordConversationSignal({ callSid: `c${i}`, complianceIssue: true });
    const alerts = m.summary().alerts;
    expect(alerts.some(a => a.code === 'compliance_issue')).toBe(true);
  });
});
