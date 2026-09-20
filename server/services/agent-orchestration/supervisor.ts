/**
 * ============================================================
 * Multi-agent workforce — Supervisor / Orchestrator
 *
 * A supervisor routes each conversation turn to the right specialist
 * agent (Sales / Support / Billing / QA / …), maintaining ONE typed
 * shared state that every specialist reads and writes, and recording
 * every transfer as an explicit, audited handoff.
 *
 * Design goals:
 * - Typed shared state: a single {@link SharedState} bag threads
 *   customer, intent, collected slots and the handoff trail through
 *   the whole call — no per-agent hidden state.
 * - Explicit handoffs: a transfer is always an auditable
 *   {@link HandoffRecord} (who → who, why, when), never implicit.
 * - Deterministic & testable core: routing is a pluggable
 *   {@link Router}; the default is a rule-based intent classifier, so
 *   the orchestration logic is fully testable without any LLM/network.
 *   An LLM-backed router can be dropped in without touching this file.
 * - Guardrails: a handoff budget and a ping-pong guard stop the
 *   classic A→B→A oscillation on ambiguous turns; human/agent-initiated
 *   ("explicit") handoffs always win.
 * ============================================================
 */

import type { ToolDefinition } from './tool-registry';

export type SpecialistId = string;

/** One customer-facing specialist the supervisor can route to. */
export interface SpecialistAgent {
  id: SpecialistId;
  /** Human label, e.g. "Billing". */
  role: string;
  description: string;
  /** Lowercased intent keywords used by the default rule-based router. */
  keywords: string[];
  systemPrompt: string;
  tools?: ToolDefinition[];
  /**
   * Optional gate: return false when this specialist cannot serve the
   * current state (e.g. billing needs an identified customer). A gated-out
   * specialist is skipped by the router.
   */
  canHandle?(state: SharedState): boolean;
}

/** An audited transfer of control between agents. */
export interface HandoffRecord {
  from: SpecialistId | 'supervisor';
  to: SpecialistId;
  reason: string;
  at: number;
  turn: number;
  /** True when a human/agent requested it explicitly (vs. router-inferred). */
  explicit: boolean;
}

/** The single shared state threaded through the whole conversation. */
export interface SharedState {
  callSid: string;
  locale?: string;
  customer: {
    id?: string;
    name?: string;
    phone?: string;
    email?: string;
    tier?: string;
  };
  intent?: { primary: SpecialistId; confidence: number; rationale?: string };
  /** Slots gathered by specialists (form answers, quotes, ticket ids, …). */
  collected: Record<string, unknown>;
  handoffs: HandoffRecord[];
  activeSpecialist?: SpecialistId;
  resolved: boolean;
}

export interface RouteDecision {
  specialist: SpecialistId;
  confidence: number;
  reason: string;
}

/** Pluggable routing strategy. The default is rule-based; swap in an LLM. */
export interface Router {
  route(
    input: string,
    state: SharedState,
    agents: SpecialistAgent[]
  ): RouteDecision | Promise<RouteDecision>;
}

export interface SupervisorOptions {
  router?: Router;
  /** Max router-inferred handoffs per call (explicit ones don't count). Default 4. */
  maxHandoffs?: number;
  /** Below this confidence a router handoff that reverses the last one is denied. Default 0.5. */
  pingPongConfidenceFloor?: number;
  now?: () => number;
}

export interface TurnRouting {
  specialist: SpecialistAgent;
  decision: RouteDecision;
  state: SharedState;
  handedOff: boolean;
}

/** Build a fresh shared state for a new call. */
export function createSharedState(callSid: string, locale?: string): SharedState {
  return {
    callSid,
    locale,
    customer: {},
    collected: {},
    handoffs: [],
    resolved: false,
  };
}

/**
 * Rule-based intent router: score each eligible specialist by keyword hits,
 * with a small stickiness bias toward the active specialist so ambiguous
 * turns don't trigger needless transfers. Confidence is the winning score
 * normalized by the number of tokens matched — deterministic and explainable.
 */
export class KeywordRouter implements Router {
  constructor(private stickiness = 0.15) {}

  route(input: string, state: SharedState, agents: SpecialistAgent[]): RouteDecision {
    const eligible = agents.filter(a => !a.canHandle || a.canHandle(state));
    const pool = eligible.length > 0 ? eligible : agents;
    const tokens = tokenize(input);

    let best: { agent: SpecialistAgent; score: number; hits: number } | null = null;
    for (const agent of pool) {
      let hits = 0;
      for (const kw of agent.keywords) {
        if (kw && tokens.has(kw)) hits++;
      }
      let score = hits;
      if (agent.id === state.activeSpecialist) score += this.stickiness;
      if (!best || score > best.score) best = { agent, score, hits };
    }

    if (!best || best.hits === 0) {
      // No keyword signal: stay with the active specialist if any, else the
      // first eligible one (typically Support as the generalist default).
      const fallback =
        pool.find(a => a.id === state.activeSpecialist) ?? pool[0];
      return {
        specialist: fallback.id,
        confidence: state.activeSpecialist ? 0.4 : 0.25,
        reason: state.activeSpecialist ? 'no new intent signal; kept active specialist' : 'no intent signal; default specialist',
      };
    }

    const confidence = Math.min(1, best.hits / Math.max(1, best.hits + 1) + best.hits * 0.1);
    return {
      specialist: best.agent.id,
      confidence: Number(confidence.toFixed(3)),
      reason: `matched ${best.hits} intent keyword(s) for ${best.agent.role}`,
    };
  }
}

export class Supervisor {
  private agents: Map<SpecialistId, SpecialistAgent> = new Map();
  private router: Router;
  private maxHandoffs: number;
  private pingPongFloor: number;
  private now: () => number;

  constructor(opts: SupervisorOptions = {}) {
    this.router = opts.router ?? new KeywordRouter();
    this.maxHandoffs = opts.maxHandoffs ?? 4;
    this.pingPongFloor = opts.pingPongConfidenceFloor ?? 0.5;
    this.now = opts.now ?? Date.now;
  }

  registerSpecialist(agent: SpecialistAgent): this {
    this.agents.set(agent.id, agent);
    return this;
  }

  registerAll(agents: SpecialistAgent[]): this {
    for (const a of agents) this.registerSpecialist(a);
    return this;
  }

  getSpecialist(id: SpecialistId): SpecialistAgent | undefined {
    return this.agents.get(id);
  }

  listSpecialists(): SpecialistAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Route one turn. Mutates and returns `state`. `requestedSpecialist`
   * models an explicit handoff (a specialist or human transferring the
   * call); explicit handoffs bypass the budget and ping-pong guards.
   */
  async routeTurn(
    input: string,
    state: SharedState,
    opts: { turn?: number; requestedSpecialist?: SpecialistId; reason?: string } = {}
  ): Promise<TurnRouting> {
    if (this.agents.size === 0) {
      throw new Error('Supervisor has no registered specialists');
    }
    const turn = opts.turn ?? state.handoffs.length;

    let decision: RouteDecision;
    let explicit = false;
    if (opts.requestedSpecialist && this.agents.has(opts.requestedSpecialist)) {
      decision = {
        specialist: opts.requestedSpecialist,
        confidence: 1,
        reason: opts.reason ?? 'explicit handoff requested',
      };
      explicit = true;
    } else {
      decision = await this.router.route(input, state, this.listSpecialists());
    }

    state.intent = {
      primary: decision.specialist,
      confidence: decision.confidence,
      rationale: decision.reason,
    };

    const target = decision.specialist;
    const active = state.activeSpecialist;

    // Same specialist keeps the turn — no handoff.
    if (target === active) {
      return { specialist: this.agents.get(target)!, decision, state, handedOff: false };
    }

    if (!explicit && active !== undefined) {
      const routerHandoffs = state.handoffs.filter(h => !h.explicit).length;
      // Budget guard: too many inferred transfers → keep the active agent.
      if (routerHandoffs >= this.maxHandoffs) {
        return this.stay(active, state, decision, 'handoff budget exhausted');
      }
      // Ping-pong guard: reversing the last handoff on a low-confidence turn.
      const last = state.handoffs[state.handoffs.length - 1];
      if (last && last.from === target && decision.confidence < this.pingPongFloor) {
        return this.stay(active, state, decision, 'ping-pong guard');
      }
    }

    // Accept the handoff.
    state.handoffs.push({
      from: active ?? 'supervisor',
      to: target,
      reason: decision.reason,
      at: this.now(),
      turn,
      explicit,
    });
    state.activeSpecialist = target;
    return { specialist: this.agents.get(target)!, decision, state, handedOff: true };
  }

  /** Mark the call resolved and hand off to QA for review if registered. */
  requestQaReview(state: SharedState, reason = 'call resolved'): TurnRouting | null {
    state.resolved = true;
    const qa = this.agents.get('qa');
    if (!qa) return null;
    if (state.activeSpecialist === 'qa') {
      return { specialist: qa, decision: { specialist: 'qa', confidence: 1, reason }, state, handedOff: false };
    }
    state.handoffs.push({
      from: state.activeSpecialist ?? 'supervisor',
      to: 'qa',
      reason,
      at: this.now(),
      turn: state.handoffs.length,
      explicit: true,
    });
    state.activeSpecialist = 'qa';
    return { specialist: qa, decision: { specialist: 'qa', confidence: 1, reason }, state, handedOff: true };
  }

  private stay(
    active: SpecialistId,
    state: SharedState,
    decision: RouteDecision,
    why: string
  ): TurnRouting {
    return {
      specialist: this.agents.get(active)!,
      decision: { ...decision, specialist: active, reason: `${why}; kept ${active}` },
      state,
      handedOff: false,
    };
  }
}

function tokenize(input: string): Set<string> {
  return new Set(
    (input || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
  );
}

/**
 * The default enterprise workforce: Sales, Support, Billing, QA. These are
 * intentionally data-only specs (prompt + intent keywords + gates) so they
 * can be overridden per tenant without code changes.
 */
export function defaultSpecialists(): SpecialistAgent[] {
  return [
    {
      id: 'sales',
      role: 'Sales',
      description: 'Qualifies leads, explains plans and pricing, books demos.',
      keywords: ['buy', 'price', 'pricing', 'plan', 'plans', 'demo', 'quote', 'upgrade', 'trial', 'purchase', 'cost', 'subscribe'],
      systemPrompt:
        'You are a consultative sales specialist. Qualify the caller, match them to the right plan, and capture their contact details and requirements into shared state. Hand off to Support for existing-account issues or Billing for invoices/payments.',
    },
    {
      id: 'support',
      role: 'Support',
      description: 'General help, troubleshooting, and account questions. The default generalist.',
      keywords: ['help', 'support', 'issue', 'problem', 'broken', 'error', 'how', 'setup', 'configure', 'not', 'working', 'trouble', 'reset', 'account'],
      systemPrompt:
        'You are a patient technical support specialist. Diagnose the caller\'s issue, resolve it or capture reproduction details. Hand off to Billing for charges/refunds and Sales for new purchases.',
    },
    {
      id: 'billing',
      role: 'Billing',
      description: 'Invoices, payments, refunds, and subscription charges.',
      keywords: ['bill', 'billing', 'invoice', 'charge', 'charged', 'refund', 'payment', 'card', 'receipt', 'subscription', 'cancel', 'overcharged'],
      systemPrompt:
        'You are a precise billing specialist. Resolve invoice, payment, and refund questions. Verify the customer before discussing account financials. Hand off to Support for product issues and Sales for upgrades.',
      canHandle: (state) => Boolean(state.customer.id || state.customer.email || state.customer.phone),
    },
    {
      id: 'qa',
      role: 'Quality Assurance',
      description: 'Reviews resolved conversations for quality, compliance, and follow-up.',
      keywords: ['review', 'quality', 'feedback', 'complaint', 'escalate', 'supervisor', 'manager'],
      systemPrompt:
        'You are a QA reviewer. Assess whether the caller\'s intent was met, flag compliance or sentiment risks, and record a concise quality note into shared state.',
    },
  ];
}
