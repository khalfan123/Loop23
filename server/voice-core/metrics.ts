/**
 * ============================================================
 * Voice Core — per-turn latency metrics
 *
 * Dependency-free in-process recorder: a fixed ring buffer of
 * per-turn latency breakdowns plus per-provider TTS attempt
 * aggregates. Feeds the /api/voice-metrics route today and an
 * OpenTelemetry exporter in a later increment.
 * ============================================================
 */

import type { TTSAttempt, TTSProviderId } from './types';
import { estimateTTSCostUsd } from './cost';

export interface TurnLatencyMetric {
  callSid: string;
  at: number;
  engine: 'bedrock-polly';
  sttMs: number;
  llmFirstMs: number;
  ttsStartMs: number;
  ttsAudioMs: number;
  streamTotalMs: number;
  ttsProvider?: TTSProviderId;
  ttsFellBack?: boolean;
}

interface ProviderAggregate {
  attempts: number;
  failures: number;
  totalLatencyMs: number;
}

interface TTSProviderAggregate extends ProviderAggregate {
  characters: number;
  estimatedCostUsd: number;
}

export interface STTAttemptMetric {
  providerId: string;
  ok: boolean;
  latencyMs: number;
  rejected?: 'confidence' | 'error' | 'aborted';
}

export interface LatencyPercentiles {
  p50: number;
  p95: number;
  avg: number;
}

/** Target p50 turn latency (ms) below which callers stop noticing the AI. */
export const TURN_LATENCY_TARGET_MS = 700;

export interface QualitySummary {
  /** % of turns whose full-turn latency met the <700ms target. */
  turnsUnderTargetPct: number;
  /** % of turns that fell back off the agent's preferred TTS provider. */
  ttsFallbackRatePct: number;
  /** % of STT attempts rejected on low confidence (noise/silence gating). */
  sttConfidenceRejectRatePct: number;
  /** Composite 0–100 health score (higher is better). */
  healthScore: number;
}

export interface VoiceMetricsSummary {
  turnCount: number;
  latency: Record<'sttMs' | 'llmFirstMs' | 'ttsStartMs' | 'streamTotalMs', LatencyPercentiles>;
  tts: Partial<Record<TTSProviderId, {
    attempts: number;
    failures: number;
    avgLatencyMs: number;
    characters: number;
    estimatedCostUsd: number;
  }>>;
  stt: Record<string, { attempts: number; failures: number; confidenceRejects: number; avgLatencyMs: number }>;
  /** Sum of estimatedCostUsd across all TTS providers. */
  estimatedTtsCostUsd: number;
  /** Derived conversation-quality / system-health signals. */
  quality: QualitySummary;
  /** Actionable, plain-language recommendations derived from the signals. */
  recommendations: string[];
}

/**
 * Turn the derived quality signals into a short, actionable, plain-language
 * recommendation list for the Operations Center. Pure — no side effects.
 */
export function deriveRecommendations(
  turnCount: number,
  quality: QualitySummary,
  tts: VoiceMetricsSummary['tts']
): string[] {
  const recs: string[] = [];
  if (turnCount === 0) return recs;

  if (quality.turnsUnderTargetPct < 60) {
    recs.push(
      `Only ${Math.round(quality.turnsUnderTargetPct)}% of turns are under the ${TURN_LATENCY_TARGET_MS}ms target — enable streaming STT (Deepgram Flux) to remove batch-transcription dead air.`
    );
  }
  if (quality.ttsFallbackRatePct > 20) {
    recs.push(
      `TTS fell back on ${Math.round(quality.ttsFallbackRatePct)}% of turns — check the preferred voice provider's credentials and health.`
    );
  }
  if (quality.sttConfidenceRejectRatePct > 25) {
    recs.push(
      `${Math.round(quality.sttConfidenceRejectRatePct)}% of transcriptions were low-confidence — likely noisy audio; enable input AGC / noise suppression.`
    );
  }
  const failingProvider = Object.entries(tts).find(
    ([, v]) => v && v.attempts >= 3 && v.failures / v.attempts > 0.3
  );
  if (failingProvider) {
    recs.push(
      `Provider "${failingProvider[0]}" is failing >30% of synthesis attempts — investigate or route around it.`
    );
  }
  return recs;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

export class MetricsRecorder {
  private turns: TurnLatencyMetric[];
  private next = 0;
  private filled = false;
  private ttsAggregates: Map<TTSProviderId, TTSProviderAggregate> = new Map();
  private sttAggregates: Map<string, ProviderAggregate & { confidenceRejects: number }> = new Map();

  constructor(private capacity = 1000) {
    this.turns = new Array(capacity);
  }

  recordTurn(metric: TurnLatencyMetric): void {
    this.turns[this.next] = metric;
    this.next = (this.next + 1) % this.capacity;
    if (this.next === 0) this.filled = true;
  }

  recordTTSAttempt(attempt: TTSAttempt): void {
    if (attempt.skipped) return; // skipped candidates are not real attempts
    let agg = this.ttsAggregates.get(attempt.providerId);
    if (!agg) {
      agg = { attempts: 0, failures: 0, totalLatencyMs: 0, characters: 0, estimatedCostUsd: 0 };
      this.ttsAggregates.set(attempt.providerId, agg);
    }
    agg.attempts++;
    if (!attempt.ok) agg.failures++;
    agg.totalLatencyMs += attempt.latencyMs;
    if (attempt.ok && attempt.characters) {
      agg.characters += attempt.characters;
      agg.estimatedCostUsd += estimateTTSCostUsd(attempt.providerId, attempt.characters);
    }
  }

  recordSTTAttempt(attempt: STTAttemptMetric): void {
    let agg = this.sttAggregates.get(attempt.providerId);
    if (!agg) {
      agg = { attempts: 0, failures: 0, totalLatencyMs: 0, confidenceRejects: 0 };
      this.sttAggregates.set(attempt.providerId, agg);
    }
    agg.attempts++;
    if (attempt.rejected === 'confidence') agg.confidenceRejects++;
    else if (!attempt.ok) agg.failures++;
    agg.totalLatencyMs += attempt.latencyMs;
  }

  recentTurns(limit = 50): TurnLatencyMetric[] {
    const all = this.orderedTurns();
    return all.slice(Math.max(0, all.length - limit)).reverse();
  }

  summary(): VoiceMetricsSummary {
    const all = this.orderedTurns();
    const fields = ['sttMs', 'llmFirstMs', 'ttsStartMs', 'streamTotalMs'] as const;
    const latency = {} as VoiceMetricsSummary['latency'];
    for (const field of fields) {
      const values = all.map(t => t[field]).filter(v => Number.isFinite(v)).sort((a, b) => a - b);
      latency[field] = {
        p50: percentile(values, 50),
        p95: percentile(values, 95),
        avg: values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0,
      };
    }
    const tts: VoiceMetricsSummary['tts'] = {};
    let estimatedTtsCostUsd = 0;
    for (const [providerId, agg] of Array.from(this.ttsAggregates.entries())) {
      tts[providerId] = {
        attempts: agg.attempts,
        failures: agg.failures,
        avgLatencyMs: agg.attempts ? agg.totalLatencyMs / agg.attempts : 0,
        characters: agg.characters,
        estimatedCostUsd: agg.estimatedCostUsd,
      };
      estimatedTtsCostUsd += agg.estimatedCostUsd;
    }
    const stt: VoiceMetricsSummary['stt'] = {};
    let sttAttempts = 0;
    let sttConfidenceRejects = 0;
    for (const [providerId, agg] of Array.from(this.sttAggregates.entries())) {
      stt[providerId] = {
        attempts: agg.attempts,
        failures: agg.failures,
        confidenceRejects: agg.confidenceRejects,
        avgLatencyMs: agg.attempts ? agg.totalLatencyMs / agg.attempts : 0,
      };
      sttAttempts += agg.attempts;
      sttConfidenceRejects += agg.confidenceRejects;
    }

    const quality = this.computeQuality(all, sttAttempts, sttConfidenceRejects);
    const recommendations = deriveRecommendations(all.length, quality, tts);
    return { turnCount: all.length, latency, tts, stt, estimatedTtsCostUsd, quality, recommendations };
  }

  /** Derive conversation-quality signals from the recorded turns + STT stats. */
  private computeQuality(
    turns: TurnLatencyMetric[],
    sttAttempts: number,
    sttConfidenceRejects: number
  ): QualitySummary {
    const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);
    const underTarget = turns.filter(t => t.streamTotalMs > 0 && t.streamTotalMs < TURN_LATENCY_TARGET_MS).length;
    const fellBack = turns.filter(t => t.ttsFellBack === true).length;

    const turnsUnderTargetPct = pct(underTarget, turns.length);
    const ttsFallbackRatePct = pct(fellBack, turns.length);
    const sttConfidenceRejectRatePct = pct(sttConfidenceRejects, sttAttempts);

    // Composite: reward hitting the latency target, penalize fallbacks and
    // confidence rejects. With no data yet, report a neutral 100.
    const healthScore = turns.length === 0
      ? 100
      : Math.round(Math.max(0, Math.min(100,
          turnsUnderTargetPct
          - ttsFallbackRatePct * 0.5
          - sttConfidenceRejectRatePct * 0.5
        )));

    return { turnsUnderTargetPct, ttsFallbackRatePct, sttConfidenceRejectRatePct, healthScore };
  }

  private orderedTurns(): TurnLatencyMetric[] {
    if (!this.filled) return this.turns.slice(0, this.next);
    return [...this.turns.slice(this.next), ...this.turns.slice(0, this.next)];
  }
}

/** Process-wide singleton used by engines and the metrics route. */
export const voiceMetrics = new MetricsRecorder();
