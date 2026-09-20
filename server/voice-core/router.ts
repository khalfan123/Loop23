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

export interface SelectionWeights {
  /** Weight on normalized EWMA latency (0..1, lower is better). */
  latency: number;
  /** Weight on rolling error rate (0..1). */
  errorRate: number;
  /** Weight on normalized cost (0..1). */
  cost: number;
}

const DEFAULT_WEIGHTS: SelectionWeights = { latency: 0.5, errorRate: 0.35, cost: 0.15 };

interface RouterOptions {
  breakerOptions?: Partial<CircuitBreakerOptions>;
  ewmaAlpha?: number;
  onAttempt?: (attempt: TTSAttempt) => void;
  now?: () => number;
  /**
   * 'preferred' (default): honor the agent's preferred provider first, then
   * healthy alternates by latency — the legacy, behavior-preserving order.
   * 'health_aware': rank ALL usable providers (except the always-last final
   * fallback) by a weighted latency/error/cost score, so a degraded or
   * expensive preferred provider yields to a healthier/cheaper one.
   */
  selectionStrategy?: 'preferred' | 'health_aware';
  selectionWeights?: Partial<SelectionWeights>;
  /** Cost per provider (e.g. USD per 1k chars) for the cost term. */
  costOf?: (id: TTSProviderId) => number;
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
    const usable = this.registry
      .listTTS()
      .filter(p => p.id !== ctx.finalFallback)
      .filter(p => p.isConfigured() && p.supportsLanguage(ctx.language))
      .filter(p => this.breakerFor(p.id).state() !== 'open');

    let ranked: TTSProviderId[];
    if ((this.options.selectionStrategy ?? 'preferred') === 'health_aware') {
      // Score every usable provider by weighted latency/error/cost; the
      // preferred provider no longer gets automatic priority.
      const ids = new Set(usable.map(p => p.id));
      // Preserve the cross-strategy invariant that the agent's preferred
      // provider is always *considered* when it can serve. A registry-level
      // isConfigured() check can't see per-agent API keys, so an agent whose
      // preferred provider is credentialed only at the agent level would
      // otherwise be silently dropped to the final fallback under this
      // strategy (a regression from 'preferred', which force-includes it). A
      // tripped (open) breaker still excludes it — synthesize() would skip a
      // tripped provider anyway — so genuinely degraded providers still yield.
      if (
        ctx.preferred !== ctx.finalFallback &&
        this.breakerFor(ctx.preferred).state() !== 'open'
      ) {
        ids.add(ctx.preferred);
      }
      ranked = Array.from(ids)
        .map(id => ({ id, score: this.score(id) }))
        .sort((a, b) => a.score - b.score)
        .map(x => x.id);
    } else {
      // Legacy: preferred first, then remaining usable by latency.
      const alternates = usable
        .filter(p => p.id !== ctx.preferred)
        .sort((a, b) => (this.statsFor(a.id).ewmaLatencyMs() ?? Number.MAX_SAFE_INTEGER)
                       - (this.statsFor(b.id).ewmaLatencyMs() ?? Number.MAX_SAFE_INTEGER))
        .map(p => p.id);
      ranked = [ctx.preferred, ...alternates];
    }

    // The final fallback is always attempted last, whatever the strategy.
    return Array.from(new Set([...ranked, ctx.finalFallback]));
  }

  /** Lower is better. Normalizes latency against the fastest observed provider. */
  private score(id: TTSProviderId): number {
    const w = { ...DEFAULT_WEIGHTS, ...(this.options.selectionWeights ?? {}) };
    const snap = this.statsFor(id).snapshot();
    // Latency normalized to a 0..1-ish range against a 1s reference; a
    // provider with no data yet is treated as neutral (0.5) so it can be tried.
    const latency = snap.ewmaLatencyMs === null ? 0.5 : Math.min(1, snap.ewmaLatencyMs / 1000);
    const errorRate = snap.errorRate;
    const cost = this.options.costOf ? Math.min(1, this.options.costOf(id) / 0.3) : 0;
    return w.latency * latency + w.errorRate * errorRate + w.cost * cost;
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
