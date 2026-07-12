/**
 * ============================================================
 * Voice Core — provider router
 *
 * Orders TTS candidates as [preferred] ++ (usable, breaker-permitting,
 * language-supporting providers sorted by EWMA latency) ++ [finalFallback],
 * deduped, then attempts them in order. The final fallback is ALWAYS
 * attempted — even with an open breaker — preserving the engine's
 * "Polly is always tried last" semantics.
 * ============================================================
 */

import type { TTSAttempt, TTSProviderId, TTSRequest, TTSResult } from './types';
import { TTSAllProvidersFailedError } from './types';
import { ProviderRegistry } from './registry';
import { CircuitBreaker, type BreakerState, type CircuitBreakerOptions } from './circuit-breaker';
import { ProviderStats, type ProviderStatsSnapshot } from './health-stats';

export interface TTSRouteContext {
  preferred: TTSProviderId;
  /** Attempted last no matter what ('aws_polly' for the Deprock engine). */
  finalFallback: TTSProviderId;
  language?: string;
  /**
   * Materialize a provider-specific request, or null when this provider is
   * not usable for this agent (missing voice id / API key). Encodes the
   * per-agent voice/key rules, so existing agents collapse to exactly the
   * legacy [preferred, finalFallback] order.
   */
  buildRequest(id: TTSProviderId): TTSRequest | null;
}

export interface TTSRouteResult {
  result: TTSResult;
  attempts: TTSAttempt[];
}

export interface ProviderHealthSnapshot extends ProviderStatsSnapshot {
  providerId: TTSProviderId;
  breaker: BreakerState;
}

interface RouterOptions {
  breakerOptions?: Partial<CircuitBreakerOptions>;
  ewmaAlpha?: number;
  onAttempt?: (attempt: TTSAttempt) => void;
  now?: () => number;
}

export class ProviderRouter {
  private breakers: Map<TTSProviderId, CircuitBreaker> = new Map();
  private stats: Map<TTSProviderId, ProviderStats> = new Map();

  constructor(
    private registry: ProviderRegistry,
    private options: RouterOptions = {}
  ) {}

  /** Exported for deterministic tests. */
  candidateOrder(ctx: TTSRouteContext): TTSProviderId[] {
    const order: TTSProviderId[] = [ctx.preferred];

    const alternates = this.registry
      .listTTS()
      .filter(p => p.id !== ctx.preferred && p.id !== ctx.finalFallback)
      .filter(p => p.isConfigured() && p.supportsLanguage(ctx.language))
      .filter(p => this.breakerFor(p.id).state() !== 'open')
      .sort((a, b) => {
        const la = this.statsFor(a.id).ewmaLatencyMs() ?? Number.MAX_SAFE_INTEGER;
        const lb = this.statsFor(b.id).ewmaLatencyMs() ?? Number.MAX_SAFE_INTEGER;
        return la - lb;
      })
      .map(p => p.id);

    order.push(...alternates, ctx.finalFallback);
    return Array.from(new Set(order));
  }

  async synthesize(ctx: TTSRouteContext): Promise<TTSRouteResult> {
    const attempts: TTSAttempt[] = [];
    const candidates = this.candidateOrder(ctx);

    for (const providerId of candidates) {
      const provider = this.registry.getTTS(providerId);
      const isFinalFallback = providerId === ctx.finalFallback;

      if (!provider) {
        this.pushAttempt(attempts, { providerId, ok: false, latencyMs: 0, skipped: 'unusable', error: 'not registered' });
        continue;
      }

      const request = ctx.buildRequest(providerId);
      if (!request) {
        this.pushAttempt(attempts, { providerId, ok: false, latencyMs: 0, skipped: 'unusable', error: 'not usable for agent' });
        continue;
      }

      const breaker = this.breakerFor(providerId);
      // The final fallback is always attempted so a tripped breaker can
      // never leave a call with no voice at all.
      if (!isFinalFallback && !breaker.canRequest()) {
        this.pushAttempt(attempts, { providerId, ok: false, latencyMs: 0, skipped: 'breaker_open' });
        continue;
      }

      const startedAt = (this.options.now ?? Date.now)();
      try {
        const result = await provider.synthesize(request);
        const latencyMs = (this.options.now ?? Date.now)() - startedAt;
        breaker.recordSuccess();
        this.statsFor(providerId).record(latencyMs, true);
        this.pushAttempt(attempts, { providerId, ok: true, latencyMs, characters: result.characters });
        return { result: { ...result, latencyMs }, attempts };
      } catch (error: any) {
        const latencyMs = (this.options.now ?? Date.now)() - startedAt;
        breaker.recordFailure();
        this.statsFor(providerId).record(latencyMs, false, error?.message);
        this.pushAttempt(attempts, { providerId, ok: false, latencyMs, error: error?.message?.substring(0, 300) });
      }
    }

    throw new TTSAllProvidersFailedError(attempts);
  }

  healthSnapshot(): ProviderHealthSnapshot[] {
    return this.registry.listTTS().map(p => ({
      providerId: p.id,
      breaker: this.breakerFor(p.id).state(),
      ...this.statsFor(p.id).snapshot(),
    }));
  }

  private pushAttempt(attempts: TTSAttempt[], attempt: TTSAttempt): void {
    attempts.push(attempt);
    this.options.onAttempt?.(attempt);
  }

  private breakerFor(id: TTSProviderId): CircuitBreaker {
    let breaker = this.breakers.get(id);
    if (!breaker) {
      breaker = new CircuitBreaker(this.options.breakerOptions, this.options.now);
      this.breakers.set(id, breaker);
    }
    return breaker;
  }

  private statsFor(id: TTSProviderId): ProviderStats {
    let stats = this.stats.get(id);
    if (!stats) {
      stats = new ProviderStats(this.options.ewmaAlpha, 60_000, this.options.now);
      this.stats.set(id, stats);
    }
    return stats;
  }
}
