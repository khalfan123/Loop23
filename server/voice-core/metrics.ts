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

export interface VoiceMetricsSummary {
  turnCount: number;
  latency: Record<'sttMs' | 'llmFirstMs' | 'ttsStartMs' | 'streamTotalMs', LatencyPercentiles>;
  tts: Partial<Record<TTSProviderId, { attempts: number; failures: number; avgLatencyMs: number }>>;
  stt: Record<string, { attempts: number; failures: number; confidenceRejects: number; avgLatencyMs: number }>;
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
  private ttsAggregates: Map<TTSProviderId, ProviderAggregate> = new Map();
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
    let agg = this.ttsAggregates.get(attempt.providerId);
    if (!agg) {
      agg = { attempts: 0, failures: 0, totalLatencyMs: 0 };
      this.ttsAggregates.set(attempt.providerId, agg);
    }
    if (attempt.skipped) return; // skipped candidates are not real attempts
    agg.attempts++;
    if (!attempt.ok) agg.failures++;
    agg.totalLatencyMs += attempt.latencyMs;
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
    for (const [providerId, agg] of Array.from(this.ttsAggregates.entries())) {
      tts[providerId] = {
        attempts: agg.attempts,
        failures: agg.failures,
        avgLatencyMs: agg.attempts ? agg.totalLatencyMs / agg.attempts : 0,
      };
    }
    const stt: VoiceMetricsSummary['stt'] = {};
    for (const [providerId, agg] of Array.from(this.sttAggregates.entries())) {
      stt[providerId] = {
        attempts: agg.attempts,
        failures: agg.failures,
        confidenceRejects: agg.confidenceRejects,
        avgLatencyMs: agg.attempts ? agg.totalLatencyMs / agg.attempts : 0,
      };
    }
    return { turnCount: all.length, latency, tts, stt };
  }

  private orderedTurns(): TurnLatencyMetric[] {
    if (!this.filled) return this.turns.slice(0, this.next);
    return [...this.turns.slice(this.next), ...this.turns.slice(0, this.next)];
  }
}

/** Process-wide singleton used by engines and the metrics route. */
export const voiceMetrics = new MetricsRecorder();
