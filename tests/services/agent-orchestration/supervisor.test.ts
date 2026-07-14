import { describe, it, expect } from 'vitest';
import {
  Supervisor,
  KeywordRouter,
  createSharedState,
  defaultSpecialists,
  type Router,
  type RouteDecision,
  type SharedState,
} from '../../../server/services/agent-orchestration/supervisor';

/** Deterministic router that replays a fixed script of decisions. */
class ScriptedRouter implements Router {
  private i = 0;
  constructor(private script: RouteDecision[]) {}
  route(): RouteDecision {
    return this.script[Math.min(this.i++, this.script.length - 1)];
  }
}

function withCustomer(state: SharedState): SharedState {
  state.customer.email = 'caller@example.com';
  return state;
}

describe('createSharedState', () => {
  it('starts empty and unresolved', () => {
    const s = createSharedState('CA1', 'en-US');
    expect(s).toMatchObject({ callSid: 'CA1', locale: 'en-US', resolved: false });
    expect(s.handoffs).toEqual([]);
    expect(s.collected).toEqual({});
    expect(s.activeSpecialist).toBeUndefined();
  });
});

describe('KeywordRouter', () => {
  const agents = defaultSpecialists();

  it('routes a pricing question to Sales', () => {
    const r = new KeywordRouter();
    const d = r.route('what does the pro plan cost, I want to upgrade', createSharedState('C'), agents);
    expect(d.specialist).toBe('sales');
    expect(d.confidence).toBeGreaterThan(0);
  });

  it('routes a refund question to Billing once the customer is identified', () => {
    const r = new KeywordRouter();
    const d = r.route('I was charged twice and need a refund on my invoice', withCustomer(createSharedState('C')), agents);
    expect(d.specialist).toBe('billing');
  });

  it('gates Billing out until the customer is identified', () => {
    const r = new KeywordRouter();
    // Same billing-heavy input but no customer on state → billing.canHandle=false.
    const d = r.route('refund my invoice charge', createSharedState('C'), agents);
    expect(d.specialist).not.toBe('billing');
  });

  it('keeps the active specialist when there is no intent signal', () => {
    const r = new KeywordRouter();
    const state = createSharedState('C');
    state.activeSpecialist = 'support';
    const d = r.route('okay, sure, thanks', state, agents);
    expect(d.specialist).toBe('support');
  });
});

describe('Supervisor.routeTurn', () => {
  it('hands off from the supervisor to the matched specialist on the first turn', async () => {
    const sup = new Supervisor().registerAll(defaultSpecialists());
    const state = createSharedState('CA2');
    const { specialist, handedOff } = await sup.routeTurn('I want to buy a plan', state);
    expect(specialist.id).toBe('sales');
    expect(handedOff).toBe(true);
    expect(state.activeSpecialist).toBe('sales');
    expect(state.handoffs).toHaveLength(1);
    expect(state.handoffs[0]).toMatchObject({ from: 'supervisor', to: 'sales', explicit: false });
  });

  it('does not record a handoff when the same specialist keeps the turn', async () => {
    const sup = new Supervisor().registerAll(defaultSpecialists());
    const state = createSharedState('CA3');
    await sup.routeTurn('I need help, something is broken', state);
    expect(state.activeSpecialist).toBe('support');
    const before = state.handoffs.length;
    const { handedOff } = await sup.routeTurn('yes it still shows an error', state);
    expect(handedOff).toBe(false);
    expect(state.handoffs).toHaveLength(before);
  });

  it('honors an explicit handoff even past the budget, bypassing guards', async () => {
    const sup = new Supervisor({ maxHandoffs: 0 }).registerAll(defaultSpecialists());
    const state = withCustomer(createSharedState('CA4'));
    state.activeSpecialist = 'support';
    const { specialist, handedOff } = await sup.routeTurn('', state, {
      requestedSpecialist: 'billing',
      reason: 'agent transferred to billing',
    });
    expect(handedOff).toBe(true);
    expect(specialist.id).toBe('billing');
    expect(state.handoffs.at(-1)).toMatchObject({ to: 'billing', explicit: true });
  });

  it('enforces the router handoff budget, keeping the active specialist', async () => {
    const router = new ScriptedRouter([
      { specialist: 'support', confidence: 0.9, reason: 's' },
      { specialist: 'sales', confidence: 0.9, reason: 's' },
      { specialist: 'billing', confidence: 0.9, reason: 's' }, // this one exceeds budget
    ]);
    const sup = new Supervisor({ maxHandoffs: 2, router }).registerAll(defaultSpecialists());
    const state = withCustomer(createSharedState('CA5'));
    await sup.routeTurn('a', state); // → support (handoff 1)
    await sup.routeTurn('b', state); // → sales   (handoff 2)
    const { specialist, handedOff } = await sup.routeTurn('c', state); // budget exhausted
    expect(handedOff).toBe(false);
    expect(specialist.id).toBe('sales');
    expect(state.handoffs.filter(h => !h.explicit)).toHaveLength(2);
  });

  it('blocks a low-confidence handoff that reverses the previous one (ping-pong guard)', async () => {
    const router = new ScriptedRouter([
      { specialist: 'billing', confidence: 0.9, reason: 'b' },
      { specialist: 'support', confidence: 0.9, reason: 's' },
      { specialist: 'billing', confidence: 0.3, reason: 'weak reverse' }, // reverses support→billing
    ]);
    const sup = new Supervisor({ maxHandoffs: 10, router, pingPongConfidenceFloor: 0.5 }).registerAll(defaultSpecialists());
    const state = withCustomer(createSharedState('CA6'));
    await sup.routeTurn('a', state); // → billing
    await sup.routeTurn('b', state); // → support
    const { specialist, handedOff } = await sup.routeTurn('c', state); // weak reverse → denied
    expect(handedOff).toBe(false);
    expect(specialist.id).toBe('support');
  });

  it('allows a high-confidence reversal (not treated as ping-pong)', async () => {
    const router = new ScriptedRouter([
      { specialist: 'billing', confidence: 0.9, reason: 'b' },
      { specialist: 'support', confidence: 0.9, reason: 's' },
      { specialist: 'billing', confidence: 0.9, reason: 'strong reverse' },
    ]);
    const sup = new Supervisor({ maxHandoffs: 10, router }).registerAll(defaultSpecialists());
    const state = withCustomer(createSharedState('CA7'));
    await sup.routeTurn('a', state);
    await sup.routeTurn('b', state);
    const { handedOff, specialist } = await sup.routeTurn('c', state);
    expect(handedOff).toBe(true);
    expect(specialist.id).toBe('billing');
  });

  it('preserves shared state (collected slots) across handoffs', async () => {
    const sup = new Supervisor().registerAll(defaultSpecialists());
    const state = withCustomer(createSharedState('CA8'));
    await sup.routeTurn('I want to buy the pro plan', state); // sales
    state.collected.quotedPlan = 'pro';
    await sup.routeTurn('actually I was overcharged on my last invoice refund', state); // billing
    expect(state.activeSpecialist).toBe('billing');
    expect(state.collected.quotedPlan).toBe('pro'); // survived the handoff
  });

  it('throws when no specialists are registered', async () => {
    const sup = new Supervisor();
    await expect(sup.routeTurn('hi', createSharedState('CA9'))).rejects.toThrow(/no registered specialists/);
  });
});

describe('Supervisor.requestQaReview', () => {
  it('marks the call resolved and hands off to QA', () => {
    const sup = new Supervisor().registerAll(defaultSpecialists());
    const state = createSharedState('CA10');
    state.activeSpecialist = 'support';
    const routing = sup.requestQaReview(state, 'issue resolved');
    expect(state.resolved).toBe(true);
    expect(routing?.specialist.id).toBe('qa');
    expect(routing?.handedOff).toBe(true);
    expect(state.handoffs.at(-1)).toMatchObject({ from: 'support', to: 'qa', explicit: true });
  });

  it('returns null when no QA specialist is registered', () => {
    const sup = new Supervisor().registerSpecialist(defaultSpecialists()[0]); // sales only
    const state = createSharedState('CA11');
    expect(sup.requestQaReview(state)).toBeNull();
    expect(state.resolved).toBe(true);
  });
});
