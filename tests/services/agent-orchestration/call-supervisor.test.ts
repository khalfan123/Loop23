import { describe, it, expect } from 'vitest';
import {
  isCallSupervisorEnabled,
  createDefaultCallSupervisor,
  routeCallSupervisorTurn,
} from '../../../server/services/agent-orchestration/call-supervisor';

describe('isCallSupervisorEnabled', () => {
  it('is off by default', () => {
    expect(isCallSupervisorEnabled({})).toBe(false);
  });

  it('accepts true/1/yes', () => {
    expect(isCallSupervisorEnabled({ LOOP9_CALL_SUPERVISOR: 'true' })).toBe(
      true,
    );
    expect(isCallSupervisorEnabled({ LOOP9_CALL_SUPERVISOR: '1' })).toBe(true);
    expect(isCallSupervisorEnabled({ LOOP9_CALL_SUPERVISOR: 'yes' })).toBe(
      true,
    );
  });
});

describe('routeCallSupervisorTurn', () => {
  it('hands off to billing on payment keywords and preserves context hint', async () => {
    const bundle = createDefaultCallSupervisor('CA-test', 'en');
    expect(bundle.state.activeSpecialist).toBe('general_support');

    const first = await routeCallSupervisorTurn(bundle, 'hello there');
    expect(first.handedOff).toBe(false);

    const billing = await routeCallSupervisorTurn(
      bundle,
      'I have a question about my invoice and payment',
    );
    expect(billing.handedOff).toBe(true);
    expect(billing.specialist.id).toBe('billing');
    expect(billing.specialistPromptHint).toContain('Billing');
    expect(billing.state.handoffs.length).toBeGreaterThan(0);
  });

  it('routes scheduling keywords to scheduling specialist', async () => {
    const bundle = createDefaultCallSupervisor('CA-sched', 'en');
    const routing = await routeCallSupervisorTurn(
      bundle,
      'I need to book an appointment tomorrow',
    );
    expect(routing.specialist.id).toBe('scheduling');
    expect(routing.handedOff).toBe(true);
  });
});
