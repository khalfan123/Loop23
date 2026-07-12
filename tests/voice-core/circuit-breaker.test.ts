import { describe, it, expect } from 'vitest';
import { CircuitBreaker } from '../../server/voice-core/circuit-breaker';

function fakeClock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

describe('CircuitBreaker', () => {
  it('starts closed and allows requests', () => {
    const b = new CircuitBreaker(undefined, fakeClock().now);
    expect(b.state()).toBe('closed');
    expect(b.canRequest()).toBe(true);
  });

  it('opens after N consecutive failures and rejects while open', () => {
    const clock = fakeClock();
    const b = new CircuitBreaker({ consecutiveFailuresToOpen: 3, openMs: 30_000 }, clock.now);
    b.recordFailure();
    b.recordFailure();
    expect(b.state()).toBe('closed');
    b.recordFailure();
    expect(b.state()).toBe('open');
    expect(b.canRequest()).toBe(false);
  });

  it('success resets the consecutive-failure counter', () => {
    const b = new CircuitBreaker({ consecutiveFailuresToOpen: 3 }, fakeClock().now);
    b.recordFailure();
    b.recordFailure();
    b.recordSuccess();
    b.recordFailure();
    b.recordFailure();
    expect(b.state()).toBe('closed');
  });

  it('half-opens after openMs and allows a single probe', () => {
    const clock = fakeClock();
    const b = new CircuitBreaker({ consecutiveFailuresToOpen: 1, openMs: 30_000, halfOpenMaxProbes: 1 }, clock.now);
    b.recordFailure();
    expect(b.state()).toBe('open');
    clock.advance(30_000);
    expect(b.state()).toBe('half_open');
    expect(b.canRequest()).toBe(true);   // consumes the probe slot
    expect(b.canRequest()).toBe(false);  // probe budget exhausted
  });

  it('a successful probe closes the breaker', () => {
    const clock = fakeClock();
    const b = new CircuitBreaker({ consecutiveFailuresToOpen: 1, openMs: 30_000 }, clock.now);
    b.recordFailure();
    clock.advance(30_000);
    expect(b.canRequest()).toBe(true);
    b.recordSuccess();
    expect(b.state()).toBe('closed');
    expect(b.canRequest()).toBe(true);
  });

  it('a failed probe re-opens the breaker for another openMs', () => {
    const clock = fakeClock();
    const b = new CircuitBreaker({ consecutiveFailuresToOpen: 1, openMs: 30_000 }, clock.now);
    b.recordFailure();
    clock.advance(30_000);
    expect(b.canRequest()).toBe(true);
    b.recordFailure();
    expect(b.state()).toBe('open');
    clock.advance(29_999);
    expect(b.state()).toBe('open');
    clock.advance(1);
    expect(b.state()).toBe('half_open');
  });
});
