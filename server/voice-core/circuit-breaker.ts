/**
 * ============================================================
 * Voice Core — circuit breaker
 *
 * Closed -> (N consecutive failures) -> open -> (openMs elapses)
 * -> half_open probe -> success closes / failure re-opens.
 * Clock is injectable for deterministic tests.
 * ============================================================
 */

export type BreakerState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerOptions {
  /** Consecutive failures required to trip open. */
  consecutiveFailuresToOpen: number;
  /** How long the breaker stays open before probing. */
  openMs: number;
  /** Concurrent probe budget while half-open. */
  halfOpenMaxProbes: number;
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  consecutiveFailuresToOpen: 3,
  openMs: 30_000,
  halfOpenMaxProbes: 1,
};

export class CircuitBreaker {
  private options: CircuitBreakerOptions;
  private now: () => number;
  private consecutiveFailures = 0;
  private openedAt: number | null = null;
  private probesInFlight = 0;

  constructor(options?: Partial<CircuitBreakerOptions>, now: () => number = Date.now) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.now = now;
  }

  state(): BreakerState {
    if (this.openedAt === null) return 'closed';
    return this.now() - this.openedAt >= this.options.openMs ? 'half_open' : 'open';
  }

  /**
   * Whether a request may be attempted right now. In half-open state this
   * consumes a probe slot; the caller MUST follow up with recordSuccess or
   * recordFailure to release it.
   */
  canRequest(): boolean {
    const state = this.state();
    if (state === 'closed') return true;
    if (state === 'open') return false;
    if (this.probesInFlight >= this.options.halfOpenMaxProbes) return false;
    this.probesInFlight++;
    return true;
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.openedAt = null;
    this.probesInFlight = 0;
  }

  recordFailure(): void {
    if (this.state() === 'half_open') {
      // Failed probe: re-open from now.
      this.openedAt = this.now();
      this.probesInFlight = 0;
      return;
    }
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.options.consecutiveFailuresToOpen) {
      this.openedAt = this.now();
      this.probesInFlight = 0;
    }
  }
}
