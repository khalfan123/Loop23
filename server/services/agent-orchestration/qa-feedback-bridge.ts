'use strict';
/**
 * Human-reviewed QA → FeedbackLoop sink (awesome-ai-apps eval/closed-loop pattern).
 *
 * Never auto-writes prompts or KB. Proposals land in ReviewQueueSink only.
 */

import {
  FeedbackLoop,
  type CallOutcome,
  type AgentImprovementReport,
  type QaSignal,
} from './feedback-loop';
import {
  ReviewQueueSink,
  proposalsFromReport,
  applyProposals,
  type ChangeProposal,
} from './feedback-applier';

/** Process-wide human-approval queue (no production writes). */
export const qaFeedbackReviewQueue = new ReviewQueueSink();

/** Rolling outcomes per agent so FeedbackLoop can meet minCalls. */
const outcomeBuffers = new Map<string, CallOutcome[]>();
const MAX_BUFFER = 50;

export type QaLike = {
  overallScore?: number | null;
  resolutionStatus?: string | null;
  hasHallucinations?: boolean | null;
  hasInterruptions?: boolean | null;
  hasNegativeSentiment?: boolean | null;
  hasKbInaccuracies?: boolean | null;
  hasComplianceIssues?: boolean | null;
  complianceScore?: number | null;
  diagnostics?: {
    hallucinations?: Array<{ text: string }>;
    complianceIssues?: Array<{ issue: string; severity?: string }>;
  } | null;
};

export function isQaFeedbackLoopEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const v = (env.QA_FEEDBACK_LOOP_ENABLED || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function normalizeResolution(
  s: string | null | undefined,
): QaSignal['resolutionStatus'] | undefined {
  if (
    s === 'resolved' ||
    s === 'unresolved' ||
    s === 'partial' ||
    s === 'transferred'
  ) {
    return s;
  }
  return undefined;
}

/** Map a single QA analysis row into FeedbackLoop CallOutcome shape. */
export function callOutcomeFromQa(input: {
  agentId: string;
  callSid: string;
  at?: number;
  qa: QaLike;
  csat?: number | null;
  reviewOutcome?: CallOutcome['reviewOutcome'];
}): CallOutcome {
  const qa = input.qa;
  return {
    agentId: input.agentId,
    callSid: input.callSid,
    at: input.at ?? Date.now(),
    csat: input.csat ?? undefined,
    reviewOutcome: input.reviewOutcome,
    qa: {
      overallScore:
        typeof qa.overallScore === 'number' ? qa.overallScore : undefined,
      resolutionStatus: normalizeResolution(qa.resolutionStatus),
      hasHallucinations: Boolean(qa.hasHallucinations),
      hasInterruptions: Boolean(qa.hasInterruptions),
      hasNegativeSentiment: Boolean(qa.hasNegativeSentiment),
      hasKbInaccuracies: Boolean(qa.hasKbInaccuracies),
      hasComplianceIssues:
        Boolean(qa.hasComplianceIssues) ||
        (typeof qa.complianceScore === 'number' && qa.complianceScore < 70),
      diagnostics: qa.diagnostics
        ? {
            hallucinations: (qa.diagnostics.hallucinations || []).map((h) => ({
              text: h.text,
            })),
            complianceIssues: (qa.diagnostics.complianceIssues || []).map(
              (c) => ({
                issue: c.issue,
                severity: c.severity,
              }),
            ),
          }
        : undefined,
    },
  };
}

export type EnqueueFeedbackResult = {
  enabled: boolean;
  reports: AgentImprovementReport[];
  queued: ChangeProposal[];
};

function feedbackLoopFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): FeedbackLoop {
  const minRaw = env.QA_FEEDBACK_MIN_CALLS;
  const minCalls =
    minRaw !== undefined && minRaw !== ''
      ? Math.max(1, Number(minRaw) || 3)
      : 3;
  return new FeedbackLoop({ minCalls });
}

/**
 * Analyze outcomes and enqueue human-reviewed proposals. Safe no-op when flag off.
 */
export async function enqueueHumanReviewedFeedbackFromOutcomes(
  outcomes: CallOutcome[],
  sink: ReviewQueueSink = qaFeedbackReviewQueue,
  loop: FeedbackLoop = feedbackLoopFromEnv(),
): Promise<EnqueueFeedbackResult> {
  if (!isQaFeedbackLoopEnabled()) {
    return { enabled: false, reports: [], queued: [] };
  }
  const before = sink.queued.length;
  const reports = loop.analyze(outcomes);
  const proposals = reports.flatMap((r) => proposalsFromReport(r));
  await applyProposals(proposals, sink);
  return {
    enabled: true,
    reports,
    queued: sink.queued.slice(before),
  };
}

/** Convenience: one QA analysis → rolling buffer → feedback queue. */
export async function enqueueFeedbackFromSingleQa(input: {
  agentId: string;
  callSid: string;
  qa: QaLike;
}): Promise<EnqueueFeedbackResult> {
  if (!isQaFeedbackLoopEnabled()) {
    return { enabled: false, reports: [], queued: [] };
  }
  const outcome = callOutcomeFromQa(input);
  const buf = outcomeBuffers.get(outcome.agentId) || [];
  buf.push(outcome);
  while (buf.length > MAX_BUFFER) buf.shift();
  outcomeBuffers.set(outcome.agentId, buf);
  return enqueueHumanReviewedFeedbackFromOutcomes(buf);
}

export function peekQaFeedbackQueue(): ChangeProposal[] {
  return [...qaFeedbackReviewQueue.queued];
}

export function clearQaFeedbackQueueForTests(): void {
  qaFeedbackReviewQueue.queued.length = 0;
  outcomeBuffers.clear();
}
