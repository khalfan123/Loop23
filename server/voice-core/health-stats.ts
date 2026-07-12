/**
 * ============================================================
 * Voice Core — per-provider health/latency statistics
 *
 * EWMA latency plus a rolling error-rate window. Dependency-free;
 * clock injectable for deterministic tests.
 * ============================================================
 */

export interface ProviderStatsSnapshot {
  attempts: number;
  failures: number;
  ewmaLatencyMs: number | null;
  errorRate: number;
  lastErrorAt?: number;
  lastError?: string;
}

interface Sample {
  at: number;
  ok: boolean;
}

export class ProviderStats {
  private ewma: number | null = null;
  private samples: Sample[] = [];
  private totalAttempts = 0;
  private totalFailures = 0;
  private lastErrorAt?: number;
  private lastError?: string;

  constructor(
    private ewmaAlpha = 0.2,
    private windowMs = 60_000,
    private now: () => number = Date.now
  ) {}

  record(latencyMs: number, ok: boolean, error?: string): void {
    this.totalAttempts++;
    if (ok) {
      // Only successful calls inform the latency estimate; failures often
      // return instantly (connection refused) and would skew it optimistic.
      this.ewma = this.ewma === null ? latencyMs : this.ewmaAlpha * latencyMs + (1 - this.ewmaAlpha) * this.ewma;
    } else {
      this.totalFailures++;
      this.lastErrorAt = this.now();
      this.lastError = error;
    }
    this.samples.push({ at: this.now(), ok });
    this.prune();
  }

  ewmaLatencyMs(): number | null {
    return this.ewma;
  }

  errorRate(): number {
    this.prune();
    if (this.samples.length === 0) return 0;
    const failures = this.samples.filter(s => !s.ok).length;
    return failures / this.samples.length;
  }

  snapshot(): ProviderStatsSnapshot {
    return {
      attempts: this.totalAttempts,
      failures: this.totalFailures,
      ewmaLatencyMs: this.ewma,
      errorRate: this.errorRate(),
      lastErrorAt: this.lastErrorAt,
      lastError: this.lastError,
    };
  }

  private prune(): void {
    const cutoff = this.now() - this.windowMs;
    while (this.samples.length > 0 && this.samples[0].at < cutoff) {
      this.samples.shift();
    }
  }
}
