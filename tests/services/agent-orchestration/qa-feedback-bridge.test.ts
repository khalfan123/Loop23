import { describe, it, expect, afterEach } from 'vitest';
import {
  callOutcomeFromQa,
  enqueueHumanReviewedFeedbackFromOutcomes,
  enqueueFeedbackFromSingleQa,
  clearQaFeedbackQueueForTests,
  peekQaFeedbackQueue,
  isQaFeedbackLoopEnabled,
} from '../../../server/services/agent-orchestration/qa-feedback-bridge';
import { FeedbackLoop } from '../../../server/services/agent-orchestration/feedback-loop';
import { ReviewQueueSink } from '../../../server/services/agent-orchestration/feedback-applier';

describe('callOutcomeFromQa', () => {
  it('maps QA fields onto CallOutcome (callSid + flags)', () => {
    const o = callOutcomeFromQa({
      agentId: 'agent-1',
      callSid: 'CA123',
      qa: {
        overallScore: 72,
        resolutionStatus: 'unresolved',
        hasHallucinations: true,
        complianceScore: 40,
        diagnostics: { hallucinations: [{ text: 'We refund in 1 hour' }] },
      },
    });
    expect(o.callSid).toBe('CA123');
    expect(o.agentId).toBe('agent-1');
    expect(o.qa?.hasHallucinations).toBe(true);
    expect(o.qa?.hasComplianceIssues).toBe(true);
    expect(o.qa?.diagnostics?.hallucinations?.[0].text).toBe(
      'We refund in 1 hour',
    );
  });
});

describe('enqueueHumanReviewedFeedbackFromOutcomes', () => {
  const prevEnabled = process.env.QA_FEEDBACK_LOOP_ENABLED;
  const prevMin = process.env.QA_FEEDBACK_MIN_CALLS;

  afterEach(() => {
    clearQaFeedbackQueueForTests();
    if (prevEnabled === undefined) delete process.env.QA_FEEDBACK_LOOP_ENABLED;
    else process.env.QA_FEEDBACK_LOOP_ENABLED = prevEnabled;
    if (prevMin === undefined) delete process.env.QA_FEEDBACK_MIN_CALLS;
    else process.env.QA_FEEDBACK_MIN_CALLS = prevMin;
  });

  it('no-ops when flag disabled', async () => {
    delete process.env.QA_FEEDBACK_LOOP_ENABLED;
    expect(isQaFeedbackLoopEnabled()).toBe(false);
    const result = await enqueueHumanReviewedFeedbackFromOutcomes([
      callOutcomeFromQa({
        agentId: 'a',
        callSid: 'CA1',
        qa: { hasHallucinations: true },
      }),
    ]);
    expect(result.enabled).toBe(false);
    expect(result.queued).toEqual([]);
  });

  it('queues human-reviewed proposals without writing prompts', async () => {
    process.env.QA_FEEDBACK_LOOP_ENABLED = 'true';
    const sink = new ReviewQueueSink();
    const loop = new FeedbackLoop({ minCalls: 3, kbAccuracyRate: 0.1 });
    const outcomes = [1, 2, 3].map((i) =>
      callOutcomeFromQa({
        agentId: 'agent-kb',
        callSid: `CA-${i}`,
        qa: {
          hasHallucinations: true,
          diagnostics: { hallucinations: [{ text: `bad fact ${i}` }] },
        },
      }),
    );
    const result = await enqueueHumanReviewedFeedbackFromOutcomes(
      outcomes,
      sink,
      loop,
    );
    expect(result.enabled).toBe(true);
    expect(result.queued.length).toBeGreaterThan(0);
    expect(result.queued.every((p) => p.kind === 'kb_update' || p.kind === 'prompt_revision' || p.kind === 'agent_config')).toBe(
      true,
    );
  });

  it('rolling single-QA enqueue respects minCalls via buffer', async () => {
    process.env.QA_FEEDBACK_LOOP_ENABLED = 'true';
    process.env.QA_FEEDBACK_MIN_CALLS = '3';
    clearQaFeedbackQueueForTests();

    for (let i = 0; i < 2; i++) {
      const r = await enqueueFeedbackFromSingleQa({
        agentId: 'agent-roll',
        callSid: `CA-r${i}`,
        qa: { hasHallucinations: true },
      });
      expect(r.queued.length).toBe(0);
    }
    const third = await enqueueFeedbackFromSingleQa({
      agentId: 'agent-roll',
      callSid: 'CA-r2',
      qa: {
        hasHallucinations: true,
        diagnostics: { hallucinations: [{ text: 'invented SLA' }] },
      },
    });
    expect(third.queued.length).toBeGreaterThan(0);
    expect(peekQaFeedbackQueue().length).toBeGreaterThan(0);
  });
});
