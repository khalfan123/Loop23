import { describe, it, expect } from 'vitest';
import { FeedbackLoop, type CallOutcome } from '../../../server/services/agent-orchestration/feedback-loop';
import {
  proposalsFromReport,
  applyProposals,
  ReviewQueueSink,
  type ApplySink,
  type ChangeProposal,
} from '../../../server/services/agent-orchestration/feedback-applier';

function report() {
  const loop = new FeedbackLoop();
  const outcomes: CallOutcome[] = [
    ...Array.from({ length: 4 }, () => (({
      callSid: 'x', agentId: 'agentA',
      qa: {
        hasHallucinations: true,
        hasComplianceIssues: true,
        diagnostics: {
          hallucinations: [{ text: 'We offer lifetime warranty' }],
          complianceIssues: [{ issue: 'No recording disclosure', severity: 'high' }],
        },
        resolutionStatus: 'unresolved' as const,
      },
    }) as CallOutcome)),
  ];
  return loop.analyzeAgent('agentA', outcomes);
}

describe('proposalsFromReport', () => {
  it('routes each improvement action to the right change kind', () => {
    const proposals = proposalsFromReport(report());
    expect(proposals.some(p => p.kind === 'kb_update')).toBe(true);       // hallucinations → KB
    expect(proposals.some(p => p.kind === 'prompt_revision')).toBe(true); // compliance → prompt
    expect(proposals.some(p => p.kind === 'agent_config')).toBe(true);    // low resolution → agent
  });

  it('carries the agent id, rationale, severity and evidence onto the proposal', () => {
    const kb = proposalsFromReport(report()).find(p => p.kind === 'kb_update')!;
    expect(kb.agentId).toBe('agentA');
    expect(kb.severity).toBeTruthy();
    expect(kb.evidence).toContain('We offer lifetime warranty');
    if (kb.kind === 'kb_update') expect(kb.action).toBe('correct'); // kb_accuracy → correct
  });
});

describe('applyProposals', () => {
  it('applies every proposal through the sink', async () => {
    const sink = new ReviewQueueSink();
    const proposals = proposalsFromReport(report());
    const result = await applyProposals(proposals, sink);
    expect(result.applied).toHaveLength(proposals.length);
    expect(result.failed).toHaveLength(0);
    expect(sink.queued).toHaveLength(proposals.length);
  });

  it('isolates failures so one bad proposal does not block the rest', async () => {
    const flaky: ApplySink = {
      applyPromptRevision: () => { throw new Error('prompt store down'); },
      applyKbUpdate: () => { /* ok */ },
      applyAgentConfig: () => { /* ok */ },
    };
    const proposals = proposalsFromReport(report());
    const result = await applyProposals(proposals, flaky);
    expect(result.failed.every(f => f.proposal.kind === 'prompt_revision')).toBe(true);
    expect(result.failed.length).toBeGreaterThan(0);
    // Non-prompt proposals still applied.
    expect(result.applied.some(p => p.kind !== 'prompt_revision')).toBe(true);
  });

  it('does nothing with no proposals', async () => {
    const result = await applyProposals([], new ReviewQueueSink());
    expect(result).toEqual({ applied: [], failed: [] });
  });
});
