/**
 * ============================================================
 * Continuous improvement — QA/CSAT feedback loop
 *
 * Closes the loop between call evaluation and platform change: it
 * consumes per-call outcomes (QA analysis, CSAT, human review verdicts)
 * and emits prioritized, evidence-backed ImprovementActions routed to the
 * three change sinks the platform can actually act on:
 *
 *   - 'prompt'          — tune a specialist's system prompt (tone, script,
 *                         disclosures).
 *   - 'agent'           — change agent config/policy (escalation, barge-in,
 *                         handoff, guardrails).
 *   - 'knowledge_base'  — fix/verify KB entries behind hallucinations or
 *                         inaccurate answers.
 *
 * The QA input is a STRUCTURAL type (QaSignal) — the DB/OpenAI-backed
 * QaAnalysisResult satisfies it — so this engine is dependency-free and
 * fully deterministic/testable. The actual application of an action (writing
 * the new prompt, patching the KB) is the caller's integration sink; this
 * module decides WHAT should change and WHY, ranked by impact.
 * ============================================================
 */

export type ImprovementSink = 'prompt' | 'agent' | 'knowledge_base';
export type Severity = 'low' | 'medium' | 'high' | 'critical';

/** Structural subset of QaAnalysisResult the loop reasons over. */
export interface QaSignal {
  overallScore?: number;
  complianceScore?: number;
  resolutionStatus?: 'resolved' | 'unresolved' | 'partial' | 'transferred';
  hasHallucinations?: boolean;
  hasKbInaccuracies?: boolean;
  hasComplianceIssues?: boolean;
  hasInterruptions?: boolean;
  hasNegativeSentiment?: boolean;
  diagnostics?: {
    hallucinations?: Array<{ text: string; context?: string }>;
    complianceIssues?: Array<{ issue: string; severity?: string }>;
  };
}

export interface CallOutcome {
  callSid: string;
  agentId: string;
  at?: number;
  qa?: QaSignal;
  /** 1..5 customer satisfaction, if collected. */
  csat?: number;
  csatComment?: string;
  reviewOutcome?: 'approved' | 'flagged' | 'escalated';
  reviewNotes?: string;
}

export interface ImprovementAction {
  sink: ImprovementSink;
  category: 'kb_accuracy' | 'compliance' | 'resolution' | 'sentiment' | 'interruptions' | 'csat';
  severity: Severity;
  title: string;
  rationale: string;
  suggestion: string;
  /** # of calls exhibiting the signal. */
  frequency: number;
  /** frequency / calls analyzed (0..1). */
  affectedRate: number;
  evidence: string[];
  /** Ranking score (higher = act first). */
  impact: number;
}

export interface AgentImprovementReport {
  agentId: string;
  window: { calls: number; from?: number; to?: number };
  metrics: {
    avgQaScore: number | null;
    avgCsat: number | null;
    resolutionRate: number;
    complianceRate: number;
    negativeSentimentRate: number;
    interruptionRate: number;
    flaggedReviewRate: number;
  };
  actions: ImprovementAction[];
}

export interface FeedbackThresholds {
  kbAccuracyRate: number;      // affected-rate to raise a KB action
  complianceRate: number;
  sentimentRate: number;
  interruptionRate: number;
  resolutionFloor: number;     // resolution rate below which to act
  csatFloor: number;           // avg CSAT (1..5) below which to act
  minCalls: number;            // don't emit actions below this sample size
}

const DEFAULT_THRESHOLDS: FeedbackThresholds = {
  kbAccuracyRate: 0.15,
  complianceRate: 0.1,
  sentimentRate: 0.25,
  interruptionRate: 0.25,
  resolutionFloor: 0.7,
  csatFloor: 3.5,
  minCalls: 3,
};

const SEVERITY_WEIGHT: Record<Severity, number> = { low: 1, medium: 2, high: 3, critical: 4 };
const SINK_WEIGHT: Record<ImprovementSink, number> = { knowledge_base: 1.3, prompt: 1.1, agent: 1.0 };

export class FeedbackLoop {
  private t: FeedbackThresholds;

  constructor(thresholds: Partial<FeedbackThresholds> = {}) {
    this.t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  /** Group outcomes by agent and produce one report each, most-affected first. */
  analyze(outcomes: CallOutcome[]): AgentImprovementReport[] {
    const byAgent = new Map<string, CallOutcome[]>();
    for (const o of outcomes) {
      const list = byAgent.get(o.agentId) ?? [];
      list.push(o);
      byAgent.set(o.agentId, list);
    }
    return Array.from(byAgent.entries())
      .map(([agentId, list]) => this.analyzeAgent(agentId, list))
      .sort((a, b) => (b.actions[0]?.impact ?? 0) - (a.actions[0]?.impact ?? 0));
  }

  analyzeAgent(agentId: string, outcomes: CallOutcome[]): AgentImprovementReport {
    const calls = outcomes.length;
    const times = outcomes.map(o => o.at).filter((n): n is number => typeof n === 'number');
    const metrics = this.computeMetrics(outcomes);
    const report: AgentImprovementReport = {
      agentId,
      window: { calls, from: times.length ? Math.min(...times) : undefined, to: times.length ? Math.max(...times) : undefined },
      metrics,
      actions: [],
    };
    if (calls < this.t.minCalls) return report; // too small a sample to act on

    report.actions = this.deriveActions(outcomes, calls).sort((a, b) => b.impact - a.impact);
    return report;
  }

  private computeMetrics(outcomes: CallOutcome[]): AgentImprovementReport['metrics'] {
    const calls = outcomes.length || 1;
    const qaScores = outcomes.map(o => o.qa?.overallScore).filter((n): n is number => typeof n === 'number');
    const csats = outcomes.map(o => o.csat).filter((n): n is number => typeof n === 'number');
    const resolved = outcomes.filter(o => o.qa?.resolutionStatus === 'resolved').length;
    const complianceIssues = outcomes.filter(o => this.hasCompliance(o.qa)).length;
    const negative = outcomes.filter(o => o.qa?.hasNegativeSentiment).length;
    const interruptions = outcomes.filter(o => o.qa?.hasInterruptions).length;
    const flagged = outcomes.filter(o => o.reviewOutcome === 'flagged' || o.reviewOutcome === 'escalated').length;
    return {
      avgQaScore: qaScores.length ? round(avg(qaScores)) : null,
      avgCsat: csats.length ? round(avg(csats), 2) : null,
      resolutionRate: round(resolved / calls, 3),
      complianceRate: round(1 - complianceIssues / calls, 3),
      negativeSentimentRate: round(negative / calls, 3),
      interruptionRate: round(interruptions / calls, 3),
      flaggedReviewRate: round(flagged / calls, 3),
    };
  }

  private deriveActions(outcomes: CallOutcome[], calls: number): ImprovementAction[] {
    const actions: ImprovementAction[] = [];

    // 1. Knowledge-base accuracy: hallucinations or inaccurate answers.
    const kbCalls = outcomes.filter(o => o.qa?.hasHallucinations || o.qa?.hasKbInaccuracies);
    if (rate(kbCalls.length, calls) >= this.t.kbAccuracyRate) {
      const evidence = dedupe(
        outcomes.flatMap(o => (o.qa?.diagnostics?.hallucinations ?? []).map(h => h.text))
      ).slice(0, 5);
      actions.push(this.action('knowledge_base', 'kb_accuracy', kbCalls.length, calls, {
        title: 'Fix knowledge-base gaps driving inaccurate answers',
        rationale: `${kbCalls.length}/${calls} calls showed hallucinations or KB inaccuracies.`,
        suggestion: 'Verify and correct the cited KB entries; add missing coverage; re-embed the updated documents.',
        evidence,
      }));
    }

    // 2. Compliance: explicit issues or low compliance score.
    const compCalls = outcomes.filter(o => this.hasCompliance(o.qa));
    if (rate(compCalls.length, calls) >= this.t.complianceRate) {
      const highSeverity = outcomes.some(o =>
        (o.qa?.diagnostics?.complianceIssues ?? []).some(c => c.severity === 'high')
      );
      const evidence = dedupe(
        outcomes.flatMap(o => (o.qa?.diagnostics?.complianceIssues ?? []).map(c => c.issue))
      ).slice(0, 5);
      const action = this.action('prompt', 'compliance', compCalls.length, calls, {
        title: 'Strengthen compliance and script adherence in the system prompt',
        rationale: `${compCalls.length}/${calls} calls had compliance issues or low compliance scores.`,
        suggestion: 'Add explicit required disclosures/greetings/closings to the prompt and a compliance guardrail check.',
        evidence,
      });
      if (highSeverity) {
        action.severity = 'critical';
        action.impact = this.impact('prompt', 'critical', compCalls.length, calls);
      }
      actions.push(action);
    }

    // 3. Resolution rate below floor → agent policy (escalation/handoff).
    const resolved = outcomes.filter(o => o.qa?.resolutionStatus === 'resolved').length;
    const resolutionRate = resolved / calls;
    if (resolutionRate < this.t.resolutionFloor) {
      const unresolved = calls - resolved;
      actions.push(this.action('agent', 'resolution', unresolved, calls, {
        title: 'Raise first-contact resolution with better escalation/handoff',
        rationale: `Resolution rate ${round(resolutionRate * 100)}% is below the ${round(this.t.resolutionFloor * 100)}% floor.`,
        suggestion: 'Tune the supervisor handoff rules and add an escalation path for repeatedly unresolved intents.',
        evidence: [],
      }));
    }

    // 4. Negative sentiment → prompt tone/empathy.
    const negCalls = outcomes.filter(o => o.qa?.hasNegativeSentiment);
    if (rate(negCalls.length, calls) >= this.t.sentimentRate) {
      actions.push(this.action('prompt', 'sentiment', negCalls.length, calls, {
        title: 'Improve tone and empathy to reduce negative sentiment',
        rationale: `${negCalls.length}/${calls} calls ended with negative customer sentiment.`,
        suggestion: 'Add empathetic acknowledgement and de-escalation guidance to the prompt; enable affective response tuning.',
        evidence: dedupe(outcomes.map(o => o.csatComment).filter((s): s is string => Boolean(s))).slice(0, 5),
      }));
    }

    // 5. Interruptions → agent barge-in / VAD tuning.
    const intCalls = outcomes.filter(o => o.qa?.hasInterruptions);
    if (rate(intCalls.length, calls) >= this.t.interruptionRate) {
      actions.push(this.action('agent', 'interruptions', intCalls.length, calls, {
        title: 'Reduce interruptions with barge-in / VAD tuning',
        rationale: `${intCalls.length}/${calls} calls had frequent interruptions.`,
        suggestion: 'Tune VAD sensitivity and barge-in thresholds; shorten agent turns.',
        evidence: [],
      }));
    }

    // 6. CSAT below floor → agent policy.
    const csats = outcomes.map(o => o.csat).filter((n): n is number => typeof n === 'number');
    if (csats.length && avg(csats) < this.t.csatFloor) {
      const a = avg(csats);
      actions.push(this.action('agent', 'csat', csats.length, calls, {
        title: 'Lift CSAT — callers are dissatisfied',
        rationale: `Average CSAT ${round(a, 2)} is below the ${this.t.csatFloor} floor across ${csats.length} rated calls.`,
        suggestion: 'Review low-CSAT transcripts, adjust agent policy and prompt, and prioritize the highest-impact actions above.',
        evidence: dedupe(
          outcomes.filter(o => typeof o.csat === 'number' && o.csat <= 2).map(o => o.csatComment).filter((s): s is string => Boolean(s))
        ).slice(0, 5),
      }));
    }

    return actions;
  }

  private hasCompliance(qa?: QaSignal): boolean {
    if (!qa) return false;
    return Boolean(qa.hasComplianceIssues) || (typeof qa.complianceScore === 'number' && qa.complianceScore < 70);
  }

  private action(
    sink: ImprovementSink,
    category: ImprovementAction['category'],
    frequency: number,
    calls: number,
    parts: { title: string; rationale: string; suggestion: string; evidence: string[] }
  ): ImprovementAction {
    const affectedRate = rate(frequency, calls);
    const severity = severityFromRate(affectedRate);
    return {
      sink,
      category,
      severity,
      ...parts,
      frequency,
      affectedRate,
      impact: this.impact(sink, severity, frequency, calls),
    };
  }

  private impact(sink: ImprovementSink, severity: Severity, frequency: number, calls: number): number {
    return round(rate(frequency, calls) * SEVERITY_WEIGHT[severity] * SINK_WEIGHT[sink], 4);
  }
}

function severityFromRate(r: number): Severity {
  if (r >= 0.6) return 'critical';
  if (r >= 0.35) return 'high';
  if (r >= 0.15) return 'medium';
  return 'low';
}

function rate(n: number, total: number): number {
  return total > 0 ? n / total : 0;
}
function avg(nums: number[]): number {
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}
function round(n: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr.filter(Boolean)));
}
