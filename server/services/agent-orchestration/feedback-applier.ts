/**
 * ============================================================
 * Continuous improvement — feedback applier
 *
 * The FeedbackLoop emits ranked ImprovementActions; this closes the loop by
 * turning each into a concrete, reviewable ChangeProposal and applying it
 * through a pluggable ApplySink. The mapping (action → proposal) is pure and
 * tested; persistence (writing the prompt revision, flagging the KB entry,
 * updating agent config) is the sink implementation the caller provides — so
 * the same closed loop works with a human-approval queue, a direct DB write,
 * or a dry run.
 * ============================================================
 */

import type { AgentImprovementReport, ImprovementAction, Severity } from './feedback-loop';

export type ChangeProposal =
  | {
      kind: 'prompt_revision';
      agentId: string;
      instruction: string;
      rationale: string;
      severity: Severity;
      evidence: string[];
    }
  | {
      kind: 'kb_update';
      agentId: string;
      action: 'verify' | 'correct' | 'add';
      rationale: string;
      severity: Severity;
      evidence: string[];
    }
  | {
      kind: 'agent_config';
      agentId: string;
      rationale: string;
      severity: Severity;
      evidence: string[];
    };

export interface ApplySink {
  applyPromptRevision(p: Extract<ChangeProposal, { kind: 'prompt_revision' }>): Promise<void> | void;
  applyKbUpdate(p: Extract<ChangeProposal, { kind: 'kb_update' }>): Promise<void> | void;
  applyAgentConfig(p: Extract<ChangeProposal, { kind: 'agent_config' }>): Promise<void> | void;
}

export interface ApplyResult {
  applied: ChangeProposal[];
  failed: Array<{ proposal: ChangeProposal; error: string }>;
}

/** Turn one agent's improvement report into concrete, sink-routable proposals. */
export function proposalsFromReport(report: AgentImprovementReport): ChangeProposal[] {
  return report.actions.map(a => actionToProposal(report.agentId, a));
}

function actionToProposal(agentId: string, a: ImprovementAction): ChangeProposal {
  const base = { agentId, rationale: a.rationale, severity: a.severity, evidence: a.evidence };
  switch (a.sink) {
    case 'prompt':
      return { kind: 'prompt_revision', instruction: a.suggestion, ...base };
    case 'knowledge_base':
      return {
        kind: 'kb_update',
        action: a.category === 'kb_accuracy' ? 'correct' : 'verify',
        ...base,
      };
    case 'agent':
    default:
      return { kind: 'agent_config', ...base };
  }
}

/**
 * Apply proposals through a sink. Each is isolated: one failing proposal never
 * blocks the rest, and the outcome is reported for audit/human review.
 */
export async function applyProposals(
  proposals: ChangeProposal[],
  sink: ApplySink
): Promise<ApplyResult> {
  const result: ApplyResult = { applied: [], failed: [] };
  for (const p of proposals) {
    try {
      if (p.kind === 'prompt_revision') await sink.applyPromptRevision(p);
      else if (p.kind === 'kb_update') await sink.applyKbUpdate(p);
      else await sink.applyAgentConfig(p);
      result.applied.push(p);
    } catch (err: any) {
      result.failed.push({ proposal: p, error: err?.message ?? String(err) });
    }
  }
  return result;
}

/**
 * A safe default sink: proposes nothing to production, just records the
 * proposals for a human-approval queue. Use in place of a direct-write sink
 * until change automation is trusted.
 */
export class ReviewQueueSink implements ApplySink {
  readonly queued: ChangeProposal[] = [];
  applyPromptRevision(p: Extract<ChangeProposal, { kind: 'prompt_revision' }>): void { this.queued.push(p); }
  applyKbUpdate(p: Extract<ChangeProposal, { kind: 'kb_update' }>): void { this.queued.push(p); }
  applyAgentConfig(p: Extract<ChangeProposal, { kind: 'agent_config' }>): void { this.queued.push(p); }
}
