import { describe, it, expect } from 'vitest';
import { ProviderStats } from '../../server/voice-core/health-stats';

function fakeClock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

describe('ProviderStats', () => {
  it('reports null EWMA before any successful sample', () => {
    const s = new ProviderStats(0.2, 60_000, fakeClock().now);
    expect(s.ewmaLatencyMs()).toBeNull();
    s.record(100, false, 'boom');
    expect(s.ewmaLatencyMs()).toBeNull();
  });

  it('computes EWMA against hand-calculated values', () => {
    const s = new ProviderStats(0.2, 60_000, fakeClock().now);
    s.record(100, true);
    expect(s.ewmaLatencyMs()).toBe(100);
    s.record(200, true);
    // 0.2*200 + 0.8*100 = 120
    expect(s.ewmaLatencyMs()).toBeCloseTo(120);
    s.record(50, true);
    // 0.2*50 + 0.8*120 = 106
    expect(s.ewmaLatencyMs()).toBeCloseTo(106);
  });

  it('windows the error rate', () => {
    const clock = fakeClock();
    const s = new ProviderStats(0.2, 60_000, clock.now);
    s.record(100, false, 'x');
    s.record(100, true);
    expect(s.errorRate()).toBeCloseTo(0.5);
    clock.advance(61_000);
    s.record(100, true);
    expect(s.errorRate()).toBe(0);
  });

  it('snapshot carries totals and last error', () => {
    const clock = fakeClock();
    const s = new ProviderStats(0.2, 60_000, clock.now);
    s.record(100, true);
    s.record(300, false, 'timeout');
    const snap = s.snapshot();
    expect(snap.attempts).toBe(2);
    expect(snap.failures).toBe(1);
    expect(snap.lastError).toBe('timeout');
    expect(snap.lastErrorAt).toBe(clock.now());
  });
});
