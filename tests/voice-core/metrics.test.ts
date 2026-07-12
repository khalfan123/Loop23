import { describe, it, expect } from 'vitest';
import { MetricsRecorder, type TurnLatencyMetric } from '../../server/voice-core/metrics';

function turn(overrides: Partial<TurnLatencyMetric> = {}): TurnLatencyMetric {
  return {
    callSid: 'CA123',
    at: Date.now(),
    engine: 'bedrock-polly',
    sttMs: 400,
    llmFirstMs: 300,
    ttsStartMs: 200,
    ttsAudioMs: 250,
    streamTotalMs: 900,
    ...overrides,
  };
}

describe('MetricsRecorder', () => {
  it('records and returns recent turns newest-first', () => {
    const m = new MetricsRecorder(10);
    m.recordTurn(turn({ callSid: 'A' }));
    m.recordTurn(turn({ callSid: 'B' }));
    m.recordTurn(turn({ callSid: 'C' }));
    expect(m.recentTurns(2).map(t => t.callSid)).toEqual(['C', 'B']);
  });

  it('wraps the ring buffer at capacity, keeping the newest entries', () => {
    const m = new MetricsRecorder(3);
    for (let i = 1; i <= 5; i++) m.recordTurn(turn({ callSid: `T${i}` }));
    const recent = m.recentTurns(10).map(t => t.callSid);
    expect(recent).toEqual(['T5', 'T4', 'T3']);
    expect(m.summary().turnCount).toBe(3);
  });

  it('computes p50/p95/avg on a fixed distribution', () => {
    const m = new MetricsRecorder(100);
    for (let i = 1; i <= 100; i++) m.recordTurn(turn({ sttMs: i * 10 }));
    const stt = m.summary().latency.sttMs;
    expect(stt.p50).toBe(500);
    expect(stt.p95).toBe(950);
    expect(stt.avg).toBeCloseTo(505);
  });

  it('aggregates TTS attempts per provider, ignoring skipped candidates', () => {
    const m = new MetricsRecorder(10);
    m.recordTTSAttempt({ providerId: 'elevenlabs', ok: false, latencyMs: 120, error: 'x' });
    m.recordTTSAttempt({ providerId: 'aws_polly', ok: true, latencyMs: 80 });
    m.recordTTSAttempt({ providerId: 'aws_polly', ok: true, latencyMs: 100 });
    m.recordTTSAttempt({ providerId: 'cartesia', ok: false, latencyMs: 0, skipped: 'breaker_open' });
    const tts = m.summary().tts;
    expect(tts.elevenlabs).toMatchObject({ attempts: 1, failures: 1 });
    expect(tts.aws_polly).toMatchObject({ attempts: 2, failures: 0, avgLatencyMs: 90 });
    // A provider that was only ever skipped must not appear as a phantom
    // zero-attempt entry in the dashboard.
    expect(tts.cartesia).toBeUndefined();
  });

  it('accumulates characters and estimated TTS cost from successful attempts', () => {
    const m = new MetricsRecorder(10);
    m.recordTTSAttempt({ providerId: 'aws_polly', ok: true, latencyMs: 80, characters: 1000 });
    m.recordTTSAttempt({ providerId: 'aws_polly', ok: true, latencyMs: 90, characters: 500 });
    m.recordTTSAttempt({ providerId: 'elevenlabs', ok: false, latencyMs: 50, characters: 999, error: 'x' });
    const summary = m.summary();
    expect(summary.tts.aws_polly?.characters).toBe(1500);
    expect(summary.tts.aws_polly?.estimatedCostUsd).toBeCloseTo(0.024); // 1500/1000 * 0.016
    // Failed attempt contributes no characters/cost
    expect(summary.tts.elevenlabs?.characters).toBe(0);
    expect(summary.estimatedTtsCostUsd).toBeCloseTo(0.024);
  });

  it('summary handles the empty state', () => {
    const m = new MetricsRecorder(5);
    const s = m.summary();
    expect(s.turnCount).toBe(0);
    expect(s.latency.streamTotalMs).toEqual({ p50: 0, p95: 0, avg: 0 });
    expect(s.stt).toEqual({});
    expect(s.quality.healthScore).toBe(100); // neutral with no data
  });

  it('derives conversation-quality signals from turns and STT stats', () => {
    const m = new MetricsRecorder(20);
    // 3 fast turns (<700ms), 1 slow; one of the fast turns fell back
    m.recordTurn(turn({ streamTotalMs: 500 }));
    m.recordTurn(turn({ streamTotalMs: 600, ttsFellBack: true }));
    m.recordTurn(turn({ streamTotalMs: 650 }));
    m.recordTurn(turn({ streamTotalMs: 1200 }));
    // STT: 4 attempts, 1 confidence reject
    m.recordSTTAttempt({ providerId: 'whisper-batch', ok: true, latencyMs: 400 });
    m.recordSTTAttempt({ providerId: 'whisper-batch', ok: true, latencyMs: 400 });
    m.recordSTTAttempt({ providerId: 'whisper-batch', ok: true, latencyMs: 400 });
    m.recordSTTAttempt({ providerId: 'whisper-batch', ok: false, latencyMs: 500, rejected: 'confidence' });

    const q = m.summary().quality;
    expect(q.turnsUnderTargetPct).toBe(75);   // 3 of 4 under 700ms
    expect(q.ttsFallbackRatePct).toBe(25);    // 1 of 4
    expect(q.sttConfidenceRejectRatePct).toBe(25); // 1 of 4
    // 75 - 25*0.5 - 25*0.5 = 50
    expect(q.healthScore).toBe(50);
  });

  it('clamps the health score to 0..100', () => {
    const m = new MetricsRecorder(10);
    // All slow + all fell back → score would go negative, clamp to 0
    m.recordTurn(turn({ streamTotalMs: 2000, ttsFellBack: true }));
    m.recordTurn(turn({ streamTotalMs: 2500, ttsFellBack: true }));
    const q = m.summary().quality;
    expect(q.turnsUnderTargetPct).toBe(0);
    expect(q.healthScore).toBe(0);
  });

  it('recommends streaming STT when turns run over the latency target', () => {
    const m = new MetricsRecorder(10);
    m.recordTurn(turn({ streamTotalMs: 1800 }));
    m.recordTurn(turn({ streamTotalMs: 2200 }));
    const recs = m.summary().recommendations;
    expect(recs.some(r => /streaming STT|Deepgram Flux/i.test(r))).toBe(true);
  });

  it('recommends checking the provider when TTS fallback is high', () => {
    const m = new MetricsRecorder(10);
    m.recordTurn(turn({ streamTotalMs: 400, ttsFellBack: true }));
    m.recordTurn(turn({ streamTotalMs: 400, ttsFellBack: true }));
    m.recordTurn(turn({ streamTotalMs: 400, ttsFellBack: false }));
    const recs = m.summary().recommendations;
    expect(recs.some(r => /fell back/i.test(r))).toBe(true);
  });

  it('flags a provider failing most of its synthesis attempts', () => {
    const m = new MetricsRecorder(10);
    m.recordTurn(turn({ streamTotalMs: 400 }));
    m.recordTTSAttempt({ providerId: 'elevenlabs', ok: false, latencyMs: 50, error: 'x' });
    m.recordTTSAttempt({ providerId: 'elevenlabs', ok: false, latencyMs: 50, error: 'x' });
    m.recordTTSAttempt({ providerId: 'elevenlabs', ok: true, latencyMs: 50 });
    const recs = m.summary().recommendations;
    expect(recs.some(r => /elevenlabs/i.test(r) && /failing/i.test(r))).toBe(true);
  });

  it('returns no recommendations for a healthy, empty, or on-target system', () => {
    const empty = new MetricsRecorder(10);
    expect(empty.summary().recommendations).toEqual([]);
    const healthy = new MetricsRecorder(10);
    healthy.recordTurn(turn({ streamTotalMs: 500 }));
    healthy.recordTurn(turn({ streamTotalMs: 550 }));
    expect(healthy.summary().recommendations).toEqual([]);
  });

  it('aggregates STT attempts, separating confidence rejects from failures', () => {
    const m = new MetricsRecorder(10);
    m.recordSTTAttempt({ providerId: 'whisper-batch', ok: true, latencyMs: 400 });
    m.recordSTTAttempt({ providerId: 'whisper-batch', ok: false, latencyMs: 500, rejected: 'confidence' });
    m.recordSTTAttempt({ providerId: 'whisper-batch', ok: false, latencyMs: 100, rejected: 'error' });
    const stt = m.summary().stt;
    expect(stt['whisper-batch']).toMatchObject({
      attempts: 3,
      failures: 1,
      confidenceRejects: 1,
    });
    expect(stt['whisper-batch'].avgLatencyMs).toBeCloseTo(1000 / 3);
  });
});
