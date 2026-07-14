import { describe, it, expect } from 'vitest';
import {
  FeedbackLoop,
  type CallOutcome,
} from '../../../server/services/agent-orchestration/feedback-loop';

function outcome(agentId: string, o: Partial<CallOutcome> = {}): CallOutcome {
  return { callSid: `CA-${Math.random()}`, agentId, ...o };
}

describe('FeedbackLoop', () => {
  it('stays silent below the minimum sample size', () => {
    const loop = new FeedbackLoop();
    const reports = loop.analyze([
      outcome('a', { qa: { hasHallucinations: true } }),
      outcome('a', { qa: { hasHallucinations: true } }),
    ]);
    expect(reports[0].window.calls).toBe(2);
    expect(reports[0].actions).toEqual([]); // < minCalls (3)
  });

  it('raises a knowledge_base action when hallucinations/KB inaccuracies recur, with evidence', () => {
    const loop = new FeedbackLoop();
    const outcomes: CallOutcome[] = [
      outcome('a', { qa: { hasHallucinations: true, diagnostics: { hallucinations: [{ text: 'We offer 24/7 support' }] } } }),
      outcome('a', { qa: { hasKbInaccuracies: true, diagnostics: { hallucinations: [{ text: 'Refunds take 2 days' }] } } }),
      outcome('a', { qa: { resolutionStatus: 'resolved' } }),
      outcome('a', { qa: { resolutionStatus: 'resolved' } }),
    ];
    const [report] = loop.analyze(outcomes);
    const kb = report.actions.find(a => a.sink === 'knowledge_base');
    expect(kb).toBeDefined();
    expect(kb!.category).toBe('kb_accuracy');
    expect(kb!.frequency).toBe(2);
    expect(kb!.evidence).toContain('We offer 24/7 support');
  });

  it('escalates compliance to critical severity when a high-severity issue is present', () => {
    const loop = new FeedbackLoop();
    const outcomes: CallOutcome[] = [
      outcome('a', { qa: { hasComplianceIssues: true, diagnostics: { complianceIssues: [{ issue: 'Missing recording disclosure', severity: 'high' }] } } }),
      outcome('a', { qa: { complianceScore: 40 } }),
      outcome('a', { qa: { complianceScore: 55 } }),
      outcome('a', { qa: { resolutionStatus: 'resolved' } }),
    ];
    const [report] = loop.analyze(outcomes);
    const comp = report.actions.find(a => a.category === 'compliance');
    expect(comp).toBeDefined();
    expect(comp!.sink).toBe('prompt');
    expect(comp!.severity).toBe('critical');
    expect(comp!.evidence).toContain('Missing recording disclosure');
  });

  it('flags low resolution rate as an agent-policy action', () => {
    const loop = new FeedbackLoop();
    const outcomes: CallOutcome[] = [
      outcome('a', { qa: { resolutionStatus: 'unresolved' } }),
      outcome('a', { qa: { resolutionStatus: 'unresolved' } }),
      outcome('a', { qa: { resolutionStatus: 'partial' } }),
      outcome('a', { qa: { resolutionStatus: 'resolved' } }),
    ];
    const [report] = loop.analyze(outcomes);
    expect(report.metrics.resolutionRate).toBe(0.25);
    const res = report.actions.find(a => a.category === 'resolution');
    expect(res).toBeDefined();
    expect(res!.sink).toBe('agent');
  });

  it('raises a CSAT action and computes avg CSAT', () => {
    const loop = new FeedbackLoop();
    const outcomes: CallOutcome[] = [
      outcome('a', { csat: 2, csatComment: 'Agent was rude', qa: { resolutionStatus: 'resolved' } }),
      outcome('a', { csat: 1, csatComment: 'Never solved my issue', qa: { resolutionStatus: 'resolved' } }),
      outcome('a', { csat: 3, qa: { resolutionStatus: 'resolved' } }),
    ];
    const [report] = loop.analyze(outcomes);
    expect(report.metrics.avgCsat).toBe(2);
    const csat = report.actions.find(a => a.category === 'csat');
    expect(csat).toBeDefined();
    expect(csat!.evidence).toContain('Agent was rude'); // low-CSAT comments surfaced
  });

  it('ranks actions by impact (severity × affected-rate × sink weight), most severe first', () => {
    const loop = new FeedbackLoop();
    // Every call has a high-severity compliance issue AND negative sentiment;
    // compliance (critical) should outrank sentiment.
    const outcomes: CallOutcome[] = Array.from({ length: 5 }, () =>
      outcome('a', {
        qa: {
          hasComplianceIssues: true,
          hasNegativeSentiment: true,
          diagnostics: { complianceIssues: [{ issue: 'No disclosure', severity: 'high' }] },
          resolutionStatus: 'resolved',
        },
      })
    );
    const [report] = loop.analyze(outcomes);
    expect(report.actions.length).toBeGreaterThanOrEqual(2);
    expect(report.actions[0].category).toBe('compliance');
    // Sorted descending by impact.
    for (let i = 1; i < report.actions.length; i++) {
      expect(report.actions[i - 1].impact).toBeGreaterThanOrEqual(report.actions[i].impact);
    }
  });

  it('groups outcomes per agent and orders reports by top action impact', () => {
    const loop = new FeedbackLoop();
    const outcomes: CallOutcome[] = [
      // Agent "bad": pervasive critical compliance problem.
      ...Array.from({ length: 4 }, () => outcome('bad', { qa: { hasComplianceIssues: true, diagnostics: { complianceIssues: [{ issue: 'x', severity: 'high' }] }, resolutionStatus: 'resolved' } })),
      // Agent "ok": clean.
      ...Array.from({ length: 4 }, () => outcome('ok', { qa: { resolutionStatus: 'resolved', overallScore: 95 } })),
    ];
    const reports = loop.analyze(outcomes);
    expect(reports.map(r => r.agentId)).toEqual(['bad', 'ok']);
    expect(reports[0].actions.length).toBeGreaterThan(0);
    expect(reports[1].actions).toEqual([]);
  });

  it('does not raise noise actions for a healthy agent', () => {
    const loop = new FeedbackLoop();
    const outcomes: CallOutcome[] = Array.from({ length: 6 }, () =>
      outcome('a', { qa: { resolutionStatus: 'resolved', overallScore: 92, complianceScore: 95 }, csat: 5 })
    );
    const [report] = loop.analyze(outcomes);
    expect(report.actions).toEqual([]);
    expect(report.metrics.resolutionRate).toBe(1);
    expect(report.metrics.avgCsat).toBe(5);
  });
});
