'use strict';
import { db } from '../db';
import { callErrorLogs } from '@shared/schema';

export type ErrorCategory =
  | 'timeout'
  | 'tool_call_delay'
  | 'tts_failure'
  | 'stt_failure'
  | 'bedrock_error'
  | 'stream_abort'
  | 'barge_in'
  | 'hangup'
  | 'kb_slow';

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export type EngineType =
  | 'bedrock-polly'
  | 'twilio-openai'
  | 'plivo'
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
      console.error(`[CallErrorLogger] Failed to log error: ${err.message}`);
    }
  }
}

export const callErrorLogger = new CallErrorLoggerService();
