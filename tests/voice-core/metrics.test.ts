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
    expect(tts.cartesia).toMatchObject({ attempts: 0, failures: 0 });
  });

  it('summary handles the empty state', () => {
    const m = new MetricsRecorder(5);
    const s = m.summary();
    expect(s.turnCount).toBe(0);
    expect(s.latency.streamTotalMs).toEqual({ p50: 0, p95: 0, avg: 0 });
    expect(s.stt).toEqual({});
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
