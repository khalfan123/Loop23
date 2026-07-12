import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { trace } from '@opentelemetry/api';
import {
  NodeTracerProvider,
  SimpleSpanProcessor,
  InMemorySpanExporter,
} from '@opentelemetry/sdk-trace-node';
import { recordVoiceTurnSpan, recordTTSAttemptSpan } from '../../server/observability/tracing';

const exporter = new InMemorySpanExporter();
let provider: NodeTracerProvider;

beforeAll(() => {
  provider = new NodeTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  provider.register();
});

afterAll(async () => {
  await provider.shutdown();
  trace.disable();
});

beforeEach(() => {
  exporter.reset();
});

describe('recordVoiceTurnSpan', () => {
  it('emits a retroactive voice.turn span with stage events and timing attributes', () => {
    const at = Date.now();
    recordVoiceTurnSpan({
      callSid: 'CA-span-1',
      at,
      engine: 'bedrock-polly',
      sttMs: 400,
      llmFirstMs: 700,
      ttsStartMs: 900,
      ttsAudioMs: 1000,
      streamTotalMs: 1500,
      ttsProvider: 'aws_polly',
      ttsFellBack: false,
    });

    const spans = exporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    const span = spans[0];
    expect(span.name).toBe('voice.turn');
    expect(span.attributes['voice.call_sid']).toBe('CA-span-1');
    expect(span.attributes['voice.stt_ms']).toBe(400);
    expect(span.attributes['voice.tts_provider']).toBe('aws_polly');
    expect(span.attributes['voice.tts_fell_back']).toBe(false);
    expect(span.events.map(e => e.name)).toEqual([
      'stt.completed',
      'llm.first_token',
      'tts.first_audio_requested',
    ]);
    // Duration ≈ streamTotalMs (hrTime tuple: [seconds, nanos])
    const durationMs = span.duration[0] * 1000 + span.duration[1] / 1e6;
    expect(durationMs).toBeCloseTo(1500, -1);
  });

  it('omits stage events with zero timings', () => {
    recordVoiceTurnSpan({
      callSid: 'CA-span-2',
      at: Date.now(),
      engine: 'bedrock-polly',
      sttMs: 0,
      llmFirstMs: 0,
      ttsStartMs: 0,
      ttsAudioMs: 0,
      streamTotalMs: 100,
    });
    const span = exporter.getFinishedSpans()[0];
    expect(span.events).toHaveLength(0);
    expect(span.attributes['voice.tts_provider']).toBeUndefined();
  });
});

describe('recordTTSAttemptSpan', () => {
  it('emits an ok span for a successful attempt', () => {
    recordTTSAttemptSpan({ providerId: 'elevenlabs', ok: true, latencyMs: 120 });
    const span = exporter.getFinishedSpans()[0];
    expect(span.name).toBe('tts.synthesize');
    expect(span.attributes['voice.tts_provider']).toBe('elevenlabs');
    expect(span.attributes['voice.tts_ok']).toBe(true);
    expect(span.status.code).not.toBe(2);
  });

  it('marks a failed attempt with ERROR status and the error message', () => {
    recordTTSAttemptSpan({ providerId: 'cartesia', ok: false, latencyMs: 80, error: 'boom' });
    const span = exporter.getFinishedSpans()[0];
    expect(span.status.code).toBe(2); // SpanStatusCode.ERROR
    expect(span.attributes['voice.tts_error']).toBe('boom');
  });

  it('records skipped candidates with the skip reason', () => {
    recordTTSAttemptSpan({ providerId: 'elevenlabs', ok: false, latencyMs: 0, skipped: 'breaker_open' });
    const span = exporter.getFinishedSpans()[0];
    expect(span.attributes['voice.tts_skipped']).toBe('breaker_open');
    expect(span.status.code).not.toBe(2);
  });
});
