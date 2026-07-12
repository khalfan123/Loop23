import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import type { Server } from 'http';

vi.mock('../../../server/storage', () => ({
  storage: { getGlobalSetting: vi.fn(async () => undefined) },
}));

import {
  createDeepgramAgentWebhookRoutes,
  consumePendingSettings,
} from '../../../server/engines/deepgram-voice-agent/routes/webhooks';

let server: Server;
let baseUrl: string;
const loadAgent = vi.fn();

beforeAll(async () => {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use('/api/deepgram-agent', createDeepgramAgentWebhookRoutes({ loadAgent }));
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

beforeEach(() => {
  loadAgent.mockReset();
  delete process.env.DEEPGRAM_API_KEY;
});

function postIncoming(agentId: string, callSid = 'CA-dg-1') {
  // No X-Twilio-Signature header: in test env the fail-closed policy is
  // permissive, matching the other engines' webhook tests.
  return fetch(`${baseUrl}/api/deepgram-agent/voice/incoming?agentId=${agentId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ CallSid: callSid }),
  });
}

describe('POST /api/deepgram-agent/voice/incoming', () => {
  it('returns 503 TwiML when DEEPGRAM_API_KEY is not configured', async () => {
    const res = await postIncoming('agent-1');
    expect(res.status).toBe(503);
    expect(await res.text()).toContain('<Hangup/>');
    expect(loadAgent).not.toHaveBeenCalled();
  });

  it('returns Connect/Stream TwiML and stages settings for the stream handler', async () => {
    process.env.DEEPGRAM_API_KEY = 'dg-test-key';
    loadAgent.mockResolvedValue({ systemPrompt: 'Billing agent prompt', greeting: 'Hi there!' });

    const res = await postIncoming('agent-1', 'CA-dg-2');
    expect(res.status).toBe(200);
    const twiml = await res.text();
    expect(twiml).toContain('<Connect>');
    expect(twiml).toContain('/api/deepgram-agent/stream/CA-dg-2');

    const staged = consumePendingSettings('CA-dg-2');
    expect(staged?.agent.think.prompt).toBe('Billing agent prompt');
    expect(staged?.agent.greeting).toBe('Hi there!');
    // consume-once semantics
    expect(consumePendingSettings('CA-dg-2')).toBeUndefined();
  });

  it('returns 404 for an unknown agent', async () => {
    process.env.DEEPGRAM_API_KEY = 'dg-test-key';
    loadAgent.mockResolvedValue(null);
    const res = await postIncoming('missing-agent');
    expect(res.status).toBe(404);
  });

  it('returns 400 when CallSid is missing', async () => {
    process.env.DEEPGRAM_API_KEY = 'dg-test-key';
    const res = await fetch(`${baseUrl}/api/deepgram-agent/voice/incoming?agentId=a1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({}),
    });
    expect(res.status).toBe(400);
  });
});
