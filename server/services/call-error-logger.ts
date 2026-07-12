'use strict';
import { db } from '../db';
import { callErrorLogs } from '@shared/schema';

export type ErrorCategory =
  | 'timeout'
  | 'latency'
  | 'tool_call_delay'
  | 'tts_failure'
  | 'stt_failure'
  | 'bedrock_error'
  | 'stream_abort'
  | 'stream_init'
  | 'ivr_connect_agent_failed'
  | 'barge_in'
  | 'hangup'
  | 'kb_slow';

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export type EngineType =
  | 'bedrock-polly'
  | 'twilio-openai'
  | 'ivr'
  | 'elevenlabs';

interface LogCallErrorParams {
  callId?: string;
  userId?: string;
  engineType: EngineType;
  errorCategory: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
}

class CallErrorLoggerService {
  async logCallError(params: LogCallErrorParams): Promise<void> {
    try {
      await db.insert(callErrorLogs).values({
        callId: params.callId || null,
        userId: params.userId || null,
        engineType: params.engineType,
        errorCategory: params.errorCategory,
        severity: params.severity,
        message: params.message,
        latencyMs: params.latencyMs ?? null,
        metadata: params.metadata ?? null,
      });
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error(`[CallErrorLogger] Failed to log error: ${msg}`);

      // In production we sometimes pass a callId/userId that isn't present in the referenced tables
      // (foreign keys), which would cause the insert to fail and we'd lose all observability.
      // Retry once without the FK fields so we still persist the event.
      const looksLikeFkViolation =
        msg.toLowerCase().includes('violates foreign key constraint') ||
        msg.toLowerCase().includes('foreign key');
      if (!looksLikeFkViolation) return;

      try {
        await db.insert(callErrorLogs).values({
          callId: null,
          userId: null,
          engineType: params.engineType,
          errorCategory: params.errorCategory,
          severity: params.severity,
          message: params.message,
          latencyMs: params.latencyMs ?? null,
          metadata: { ...(params.metadata ?? {}), _fkRetry: true },
        });
      } catch (err2: any) {
        console.error(`[CallErrorLogger] FK-retry failed: ${err2?.message || String(err2)}`);
      }
    }
  }
}

export const callErrorLogger = new CallErrorLoggerService();
