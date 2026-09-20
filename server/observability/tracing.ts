/**
 * ============================================================
 * OpenTelemetry tracing for the voice pipeline
 *
 * Opt-in via environment:
 *   OTEL_EXPORTER_OTLP_ENDPOINT — enable + export OTLP/HTTP
 *   OTEL_ENABLED=true           — enable with console exporter (dev)
 *   OTEL_SERVICE_NAME           — service.name (default loop9-server)
 *
 * When neither is set, no SDK is registered and every span
 * helper below is a zero-cost no-op through the OTel API's
 * default noop tracer — safe to call unconditionally.
 *
 * Spans are recorded retroactively from the voice-core metrics
 * (a turn is timed by the engine, then emitted as one span with
 * explicit start/end timestamps and stage events).
 * ============================================================
 */

import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import {
  NodeTracerProvider,
  BatchSpanProcessor,
  SimpleSpanProcessor,
  ConsoleSpanExporter,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import type { TurnLatencyMetric } from '../voice-core/metrics';
import type { TTSAttempt } from '../voice-core/types';

const TRACER_NAME = 'loop9.voice';

let initialized = false;

/**
 * Register the tracer provider when tracing is configured. Returns whether
 * tracing is active. Call once, early in server startup.
 */
export function initVoiceTracing(): boolean {
  if (initialized) return true;

  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const consoleMode = process.env.OTEL_ENABLED === 'true' && !otlpEndpoint;
  if (!otlpEndpoint && !consoleMode) {
    return false;
  }

  let spanProcessor: SpanProcessor;
  if (otlpEndpoint) {
    // Exporter reads OTEL_EXPORTER_OTLP_ENDPOINT (+ headers) from env itself.
    spanProcessor = new BatchSpanProcessor(new OTLPTraceExporter());
  } else {
    spanProcessor = new SimpleSpanProcessor(new ConsoleSpanExporter());
  }

  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'loop9-server',
    }),
    spanProcessors: [spanProcessor],
  });
  provider.register();
  initialized = true;
  console.log(
    `[Tracing] OpenTelemetry active (${otlpEndpoint ? `OTLP ${otlpEndpoint}` : 'console exporter'})`
  );
  return true;
}

/**
 * Emit a retroactive span TREE for a completed conversation turn: a parent
 * `voice.turn` span with child `voice.stt`, `voice.llm`, and `voice.tts`
 * spans placed at the measured stage offsets, so the STT→LLM→TTS pipeline is
 * a real distributed trace (shared trace id, parent/child links) rather than
 * a flat span with events. Stage events are retained on the parent for
 * back-compat with anything keying off them. No-op when no SDK is registered.
 *
 * All metric fields are millisecond offsets from the turn start (`startMs`).
 * A child span is emitted only for a stage with a positive, well-ordered
 * span, so turns that skip a stage (e.g. a greeting with no STT) don't
 * produce zero/negative-duration spans.
 */
export function recordVoiceTurnSpan(metric: TurnLatencyMetric): void {
  const tracer = trace.getTracer(TRACER_NAME);
  const startMs = metric.at - metric.streamTotalMs;
  const parent = tracer.startSpan('voice.turn', {
    startTime: new Date(startMs),
    attributes: {
      'voice.call_sid': metric.callSid,
      'voice.engine': metric.engine,
      'voice.stt_ms': metric.sttMs,
      'voice.llm_first_token_ms': metric.llmFirstMs,
      'voice.tts_start_ms': metric.ttsStartMs,
      'voice.tts_audio_ms': metric.ttsAudioMs,
      'voice.turn_total_ms': metric.streamTotalMs,
      ...(metric.ttsProvider ? { 'voice.tts_provider': metric.ttsProvider } : {}),
      ...(metric.ttsFellBack !== undefined ? { 'voice.tts_fell_back': metric.ttsFellBack } : {}),
    },
  });
  if (metric.sttMs > 0) parent.addEvent('stt.completed', undefined, new Date(startMs + metric.sttMs));
  if (metric.llmFirstMs > 0) parent.addEvent('llm.first_token', undefined, new Date(startMs + metric.llmFirstMs));
  if (metric.ttsStartMs > 0) parent.addEvent('tts.first_audio_requested', undefined, new Date(startMs + metric.ttsStartMs));

  const parentCtx = trace.setSpan(context.active(), parent);
  const emitChild = (
    name: string,
    startOffset: number,
    endOffset: number,
    attributes: Record<string, string | number | boolean> = {}
  ): void => {
    if (!(endOffset > startOffset)) return; // skip zero/negative-duration stages
    const child = tracer.startSpan(name, { startTime: new Date(startMs + startOffset), attributes }, parentCtx);
    child.end(new Date(startMs + endOffset));
  };

  // STT: [0, sttMs]. LLM: [sttMs, llmFirstMs] (STT-complete → first token).
  // TTS: [ttsStartMs, ttsAudioMs] (synthesis start → first audio ready).
  emitChild('voice.stt', 0, metric.sttMs, { 'voice.stt_ms': metric.sttMs });
  emitChild('voice.llm', metric.sttMs, metric.llmFirstMs, {
    'voice.llm_first_token_ms': metric.llmFirstMs,
  });
  emitChild('voice.tts', metric.ttsStartMs, metric.ttsAudioMs, {
    ...(metric.ttsProvider ? { 'voice.tts_provider': metric.ttsProvider } : {}),
    ...(metric.ttsFellBack !== undefined ? { 'voice.tts_fell_back': metric.ttsFellBack } : {}),
  });

  parent.end(new Date(metric.at));
}

/**
 * Emit one retroactive span per TTS provider attempt (including failovers).
 * Skipped candidates (breaker open / unusable) are recorded as zero-length
 * spans so failover decisions are visible in traces.
 */
export function recordTTSAttemptSpan(attempt: TTSAttempt): void {
  const tracer = trace.getTracer(TRACER_NAME);
  const now = Date.now();
  const span = tracer.startSpan('tts.synthesize', {
    startTime: new Date(now - attempt.latencyMs),
    attributes: {
      'voice.tts_provider': attempt.providerId,
      'voice.tts_ok': attempt.ok,
      ...(attempt.skipped ? { 'voice.tts_skipped': attempt.skipped } : {}),
      ...(attempt.error ? { 'voice.tts_error': attempt.error } : {}),
    },
  });
  if (!attempt.ok && !attempt.skipped) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: attempt.error });
  }
  span.end(new Date(now));
}
