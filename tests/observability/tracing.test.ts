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
  const durationMs = (span: { duration: [number, number] }): number =>
    span.duration[0] * 1000 + span.duration[1] / 1e6;

  it('emits a voice.turn parent with STT→LLM→TTS child spans forming one trace tree', () => {
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
    const parent = spans.find(s => s.name === 'voice.turn')!;
    const stt = spans.find(s => s.name === 'voice.stt')!;
    const llm = spans.find(s => s.name === 'voice.llm')!;
    const tts = spans.find(s => s.name === 'voice.tts')!;
    expect([parent, stt, llm, tts].every(Boolean)).toBe(true);

    // Parent summary attributes + back-compat stage events preserved.
    expect(parent.attributes['voice.call_sid']).toBe('CA-span-1');
    expect(parent.attributes['voice.tts_provider']).toBe('aws_polly');
    expect(parent.events.map(e => e.name)).toEqual([
      'stt.completed',
      'llm.first_token',
      'tts.first_audio_requested',
    ]);
    expect(durationMs(parent)).toBeCloseTo(1500, -1);

    // Children share the parent's trace id and reference it as parent.
    for (const child of [stt, llm, tts]) {
      expect(child.spanContext().traceId).toBe(parent.spanContext().traceId);
      expect(child.parentSpanContext?.spanId).toBe(parent.spanContext().spanId);
    }

    // Child durations match the measured stage offsets.
    expect(durationMs(stt)).toBeCloseTo(400, -1); // [0, 400]
    expect(durationMs(llm)).toBeCloseTo(300, -1); // [400, 700]
    expect(durationMs(tts)).toBeCloseTo(100, -1); // [900, 1000]
    expect(tts.attributes['voice.tts_provider']).toBe('aws_polly');
  });

  it('omits child spans and events for stages with zero/degenerate timings', () => {
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
    const spans = exporter.getFinishedSpans();
    expect(spans).toHaveLength(1); // only the parent turn span
    const span = spans[0];
    expect(span.name).toBe('voice.turn');
    expect(span.events).toHaveLength(0);
    expect(span.attributes['voice.tts_provider']).toBeUndefined();
  });

  it('emits an LLM child even when the turn has no STT stage (e.g. a greeting)', () => {
    recordVoiceTurnSpan({
      callSid: 'CA-span-3',
      at: Date.now(),
      engine: 'bedrock-polly',
      sttMs: 0,
      llmFirstMs: 250,
      ttsStartMs: 300,
      ttsAudioMs: 500,
      streamTotalMs: 800,
    });
    const spans = exporter.getFinishedSpans();
    expect(spans.find(s => s.name === 'voice.stt')).toBeUndefined();
    const llm = spans.find(s => s.name === 'voice.llm')!;
    expect(durationMs(llm)).toBeCloseTo(250, -1); // [0, 250]
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
