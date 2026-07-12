import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import { createVoiceMetricsRoutes } from '../../server/routes/voice-metrics-routes';
import { voiceMetrics } from '../../server/voice-core';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  const allowAll = (_req: any, _res: any, next: Function) => next();
  app.use('/api/voice-metrics', createVoiceMetricsRoutes(allowAll));
  await new Promise<void>(resolve => {
    server = app.listen(0, () => resolve());
  });
  const address = server.address();
  if (typeof address === 'object' && address) {
    baseUrl = `http://127.0.0.1:${address.port}`;
  }
});

afterAll(() => {
  server?.close();
});

describe('GET /api/voice-metrics', () => {
  it('returns the latency summary with provider health', async () => {
    const res = await fetch(`${baseUrl}/api/voice-metrics`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('turnCount');
    expect(body).toHaveProperty('latency.sttMs.p50');
    expect(body).toHaveProperty('latency.streamTotalMs.p95');
    expect(Array.isArray(body.providers)).toBe(true);
    const ids = body.providers.map((p: any) => p.providerId).sort();
    expect(ids).toEqual(['aws_polly', 'cartesia', 'elevenlabs']);
    for (const p of body.providers) {
      expect(['closed', 'open', 'half_open']).toContain(p.breaker);
    }
  });
});

describe('GET /api/voice-metrics/turns', () => {
  it('returns recorded turns newest-first and honors limit', async () => {
    voiceMetrics.recordTurn({
      callSid: 'CA-test-1', at: Date.now(), engine: 'bedrock-polly',
      sttMs: 100, llmFirstMs: 200, ttsStartMs: 300, ttsAudioMs: 350, streamTotalMs: 700,
      ttsProvider: 'aws_polly', ttsFellBack: false,
    });
    voiceMetrics.recordTurn({
      callSid: 'CA-test-2', at: Date.now(), engine: 'bedrock-polly',
      sttMs: 110, llmFirstMs: 210, ttsStartMs: 310, ttsAudioMs: 360, streamTotalMs: 710,
    });
    const res = await fetch(`${baseUrl}/api/voice-metrics/turns?limit=1`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.turns).toHaveLength(1);
    expect(body.turns[0].callSid).toBe('CA-test-2');
  });

  it('clamps invalid limits to the default', async () => {
    const res = await fetch(`${baseUrl}/api/voice-metrics/turns?limit=abc`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.turns)).toBe(true);
  });
});
