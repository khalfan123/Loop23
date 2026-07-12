/**
 * Integration tests for executeTransfer in both AI engines.
 *
 * These exercise the REAL static `executeTransfer` method on each engine's
 * audio-bridge service with a mocked Twilio client (`getTwilioClient`).
 * They verify:
 *   - the resolver is fed inboundDid per call direction (toNumber on inbound,
 *     fromNumber on outbound);
 *   - `<Dial>` callerId is omitted for any UAE inbound DID without wizard/env;
 *   - the unified `[Transfer] engine=… callSid=… target=… callerId=… source=…`
 *     log line is emitted with correct fields and source classification.
 *
 * Run: pnpm --filter @workspace/loop23 run test:uae-transfer:integration
 */

import { test, mock, before } from 'node:test';
import assert from 'node:assert/strict';

import type { AudioBridgeSession } from '../server/engines/twilio-openai/types';
import type { BedrockPollyBridgeSession } from '../server/engines/twilio-bedrock-polly/types';

/* ----- Twilio mock used by both engines ------------------------------- */

interface MockedCall { sid: string; twiml: string }
const calls: MockedCall[] = [];

interface MockTwilioClient {
  calls(sid: string): { update(opts: { twiml: string }): Promise<{ sid: string }> };
}

function makeMockTwilioClient(): MockTwilioClient {
  return {
    calls: (sid: string) => ({
      update: async (opts: { twiml: string }) => {
        calls.push({ sid, twiml: opts.twiml });
        return { sid };
      },
    }),
  };
}

before(() => {
  mock.module('../server/services/twilio-connector', {
    namedExports: {
      getTwilioClient: async (): Promise<MockTwilioClient> => makeMockTwilioClient(),
    },
  });
});

/* ----- typed bridge test seams ---------------------------------------
 * The engines' `executeTransfer` is `private static` (TS-only — at runtime
 * they're plain static methods). Rather than weaken the production type
 * with an explicit test export, we narrow each bridge class to a typed
 * test interface via a single `as unknown as` cast.
 */

interface TransferResult { success: boolean; error?: string }

interface OpenAIBridgeTestable {
  executeTransfer(session: AudioBridgeSession, targetNumber: string): Promise<TransferResult>;
}

interface BedrockBridgeTestable {
  executeTransfer(session: BedrockPollyBridgeSession, targetNumber: string): Promise<void>;
}

/* ----- console.log capture helper ------------------------------------ */

async function captureLogs<T>(fn: () => Promise<T>): Promise<{ result: T; lines: string[] }> {
  const orig = console.log;
  const lines: string[] = [];
  console.log = (...args: unknown[]): void => {
    lines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  };
  try {
    const result = await fn();
    return { result, lines };
  } finally {
    console.log = orig;
  }
}

async function withEnv<T>(env: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const prev: Record<string, string | undefined> = {};
  for (const k of Object.keys(env)) {
    prev[k] = process.env[k];
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k];
  }
  try {
    return await fn();
  } finally {
    for (const k of Object.keys(prev)) {
      const v = prev[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

function findTransferLine(lines: string[]): string | undefined {
  return lines.find((l) => l.startsWith('[Transfer] '));
}

function parseTransferFields(line: string): Record<string, string> {
  const out: Record<string, string> = {};
  const parts = line.replace(/^\[Transfer\] /, '').split(/\s+/);
  for (const p of parts) {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i)] = p.slice(i + 1);
  }
  return out;
}

/* ----- typed minimal session fixtures --------------------------------
 * `executeTransfer` reads only direction/numbers/wizard plus a few
 * lifecycle fields (openaiWs, status, endedAt, endCallbackFired,
 * onEndCallback). We construct minimal but structurally complete
 * objects and narrow them through `unknown` to the public Session
 * interface — no `any` involved.
 */

interface OpenAITransferFixture {
  callSid: string;
  callDirection: 'inbound' | 'outbound';
  fromNumber: string;
  toNumber: string;
  humanWizardCli?: string;
}

function makeOpenAISession(fx: OpenAITransferFixture): AudioBridgeSession {
  const base = {
    callSid: fx.callSid,
    streamSid: null,
    openaiSessionId: 'os_test',
    status: 'connected' as const,
    startedAt: new Date(),
    endedAt: null,
    openaiWs: null,
    twilioWs: null,
    agentConfig: { voice: 'alloy', model: 'gpt-realtime' },
    transcriptParts: [],
    toolHandlers: new Map(),
    processedToolCallIds: new Set(),
    onTranscriptCallback: null,
    onToolCallback: null,
    onAudioCallback: null,
    onEndCallback: null,
    endCallbackFired: false,
    firstMessageSent: true,
    twilioStreamReady: true,
    lastUserSpeechTime: 0,
    isResponseActive: false,
    fromNumber: fx.fromNumber,
    toNumber: fx.toNumber,
    callDirection: fx.callDirection,
    humanWizardCli: fx.humanWizardCli,
    pendingAudioQueue: [],
    softTimeoutId: null,
    hardTimeoutId: null,
    behaviorConfig: null,
    waitingMessages: null,
    explicitEndCall: false,
  };
  return base as unknown as AudioBridgeSession;
}

function makeBedrockSession(fx: OpenAITransferFixture): BedrockPollyBridgeSession {
  const base = {
    callSid: fx.callSid,
    streamSid: null,
    bedrockSessionId: 'bs_test',
    status: 'connected' as const,
    startedAt: new Date(),
    endedAt: null,
    twilioWs: null,
    agentConfig: { voice: 'Joanna', model: 'anthropic.claude-3-haiku' },
    transcriptParts: [],
    toolHandlers: new Map(),
    processedToolCallIds: new Set(),
    onTranscriptCallback: null,
    onToolCallback: null,
    onAudioCallback: null,
    onEndCallback: null,
    messages: [],
    fromNumber: fx.fromNumber,
    toNumber: fx.toNumber,
    callDirection: fx.callDirection,
    humanWizardCli: fx.humanWizardCli,
    pendingAudioQueue: [],
    isProcessing: false,
    pollyEngine: 'neural' as const,
    ttsProvider: 'aws_polly',
    isOutbound: fx.callDirection === 'outbound',
    explicitEndCall: false,
  };
  return base as unknown as BedrockPollyBridgeSession;
}

/* ----- typed setTimeout stub for OpenAI engine pre-transfer wait ----- */

type SetTimeoutFn = typeof globalThis.setTimeout;

function withImmediateSetTimeout<T>(fn: () => Promise<T>): Promise<T> {
  const real: SetTimeoutFn = globalThis.setTimeout;
  const stub: SetTimeoutFn = ((cb: (...args: unknown[]) => void): ReturnType<SetTimeoutFn> =>
    real(cb, 0)) as unknown as SetTimeoutFn;
  globalThis.setTimeout = stub;
  return fn().finally(() => {
    globalThis.setTimeout = real;
  });
}

/* ----- twilio-openai executeTransfer integration --------------------- */

test('twilio-openai executeTransfer: inbound UAE → omitted callerId, [Transfer] log correct', async () => {
  const mod = await import('../server/engines/twilio-openai/services/audio-bridge.service');
  const bridge = mod.TwilioOpenAIAudioBridge as unknown as OpenAIBridgeTestable;

  const session = makeOpenAISession({
    callSid: 'CA_inbound_uae',
    callDirection: 'inbound',
    fromNumber: '+971555550111',
    toNumber: '+9718001234',
  });

  calls.length = 0;
  const { result, lines } = await withImmediateSetTimeout(() =>
    withEnv({ TWILIO_TRANSFER_CALLER_ID: undefined }, () =>
      captureLogs(() => bridge.executeTransfer(session, '+971501234567')),
    ),
  );

  assert.equal(result.success, true);
  assert.equal(calls.length, 1, 'twilio.calls(...).update should be called once');
  assert.match(calls[0].twiml, /<Dial timeout=/, 'callerId attribute should be omitted');
  assert.doesNotMatch(calls[0].twiml, /callerId=/);

  const line = findTransferLine(lines);
  assert.ok(line, `expected [Transfer] log line, got: ${lines.join('\n')}`);
  const f = parseTransferFields(line);
  assert.equal(f.engine, 'twilio-openai');
  assert.equal(f.callSid, 'CA_inbound_uae');
  assert.equal(f.target, '+971501234567');
  assert.equal(f.callerId, '(omitted)');
  assert.equal(f.source, 'omitted');
  assert.equal(f.direction, 'inbound');
  assert.equal(f.inboundDid, '+9718001234');
});

test('twilio-openai executeTransfer: wizard non-UAE wins on inbound UAE', async () => {
  const mod = await import('../server/engines/twilio-openai/services/audio-bridge.service');
  const bridge = mod.TwilioOpenAIAudioBridge as unknown as OpenAIBridgeTestable;

  const session = makeOpenAISession({
    callSid: 'CA_wizard',
    callDirection: 'inbound',
    fromNumber: '+971555550111',
    toNumber: '+9718001234',
    humanWizardCli: '+12025550199',
  });

  calls.length = 0;
  const { lines } = await withImmediateSetTimeout(() =>
    withEnv({ TWILIO_TRANSFER_CALLER_ID: undefined }, () =>
      captureLogs(() => bridge.executeTransfer(session, '+971501234567')),
    ),
  );

  assert.equal(calls.length, 1);
  assert.match(calls[0].twiml, /callerId="\+12025550199"/);
  const line = findTransferLine(lines);
  assert.ok(line);
  const f = parseTransferFields(line);
  assert.equal(f.callerId, '+12025550199');
  assert.equal(f.source, 'wizard');
});

test('twilio-openai executeTransfer: env wins on inbound UAE without wizard', async () => {
  const mod = await import('../server/engines/twilio-openai/services/audio-bridge.service');
  const bridge = mod.TwilioOpenAIAudioBridge as unknown as OpenAIBridgeTestable;

  const session = makeOpenAISession({
    callSid: 'CA_env',
    callDirection: 'inbound',
    fromNumber: '+971555550111',
    toNumber: '+9718001234',
  });

  calls.length = 0;
  const { lines } = await withImmediateSetTimeout(() =>
    withEnv({ TWILIO_TRANSFER_CALLER_ID: '+447900000001' }, () =>
      captureLogs(() => bridge.executeTransfer(session, '+971501234567')),
    ),
  );

  assert.equal(calls.length, 1);
  assert.match(calls[0].twiml, /callerId="\+447900000001"/);
  const line = findTransferLine(lines);
  assert.ok(line);
  const f = parseTransferFields(line);
  assert.equal(f.callerId, '+447900000001');
  assert.equal(f.source, 'env');
});

test('twilio-openai executeTransfer: outbound uses fromNumber as inboundDid', async () => {
  const mod = await import('../server/engines/twilio-openai/services/audio-bridge.service');
  const bridge = mod.TwilioOpenAIAudioBridge as unknown as OpenAIBridgeTestable;

  const session = makeOpenAISession({
    callSid: 'CA_outbound',
    callDirection: 'outbound',
    fromNumber: '+447900000001',
    toNumber: '+971501234567',
  });

  calls.length = 0;
  const { lines } = await withImmediateSetTimeout(() =>
    withEnv({ TWILIO_TRANSFER_CALLER_ID: undefined }, () =>
      captureLogs(() => bridge.executeTransfer(session, '+971501234567')),
    ),
  );

  const line = findTransferLine(lines);
  assert.ok(line);
  const f = parseTransferFields(line);
  assert.equal(f.direction, 'outbound');
  assert.equal(f.inboundDid, '+447900000001');
  assert.equal(f.callerId, '+447900000001');
  assert.equal(f.source, 'inbound');
});

/* ----- twilio-bedrock-polly executeTransfer integration -------------- */

test('twilio-bedrock-polly executeTransfer: inbound UAE → omitted callerId, [Transfer] log correct', async () => {
  const mod = await import('../server/engines/twilio-bedrock-polly/services/audio-bridge.service');
  const bridge = mod.BedrockPollyAudioBridge as unknown as BedrockBridgeTestable;

  const session = makeBedrockSession({
    callSid: 'CA_bp_inbound_uae',
    callDirection: 'inbound',
    fromNumber: '+971555550111',
    toNumber: '+9714222333',
  });

  calls.length = 0;
  const { lines } = await withEnv({ TWILIO_TRANSFER_CALLER_ID: undefined }, () =>
    captureLogs(() => bridge.executeTransfer(session, '+971501234567')),
  );

  assert.equal(calls.length, 1, 'twilio.calls(...).update should be called once');
  assert.match(calls[0].twiml, /<Dial>/);
  assert.doesNotMatch(calls[0].twiml, /callerId=/);

  const line = findTransferLine(lines);
  assert.ok(line, `expected [Transfer] log line, got: ${lines.join('\n')}`);
  const f = parseTransferFields(line);
  assert.equal(f.engine, 'twilio-bedrock-polly');
  assert.equal(f.callSid, 'CA_bp_inbound_uae');
  assert.equal(f.target, '+971501234567');
  assert.equal(f.callerId, '(omitted)');
  assert.equal(f.source, 'omitted');
  assert.equal(f.direction, 'inbound');
  assert.equal(f.inboundDid, '+9714222333');
});

test('twilio-bedrock-polly executeTransfer: wizard non-UAE wins on inbound UAE', async () => {
  const mod = await import('../server/engines/twilio-bedrock-polly/services/audio-bridge.service');
  const bridge = mod.BedrockPollyAudioBridge as unknown as BedrockBridgeTestable;

  const session = makeBedrockSession({
    callSid: 'CA_bp_wizard',
    callDirection: 'inbound',
    fromNumber: '+971555550111',
    toNumber: '+9714222333',
    humanWizardCli: '+12025550199',
  });

  calls.length = 0;
  const { lines } = await withEnv({ TWILIO_TRANSFER_CALLER_ID: undefined }, () =>
    captureLogs(() => bridge.executeTransfer(session, '+971501234567')),
  );

  assert.equal(calls.length, 1);
  assert.match(calls[0].twiml, /<Dial callerId="\+12025550199">/);
  const line = findTransferLine(lines);
  assert.ok(line);
  const f = parseTransferFields(line);
  assert.equal(f.callerId, '+12025550199');
  assert.equal(f.source, 'wizard');
});

test('twilio-bedrock-polly executeTransfer: outbound uses fromNumber as inboundDid', async () => {
  const mod = await import('../server/engines/twilio-bedrock-polly/services/audio-bridge.service');
  const bridge = mod.BedrockPollyAudioBridge as unknown as BedrockBridgeTestable;

  const session = makeBedrockSession({
    callSid: 'CA_bp_outbound',
    callDirection: 'outbound',
    fromNumber: '+447900000001',
    toNumber: '+971501234567',
  });

  calls.length = 0;
  const { lines } = await withEnv({ TWILIO_TRANSFER_CALLER_ID: undefined }, () =>
    captureLogs(() => bridge.executeTransfer(session, '+971501234567')),
  );

  const line = findTransferLine(lines);
  assert.ok(line);
  const f = parseTransferFields(line);
  assert.equal(f.direction, 'outbound');
  assert.equal(f.inboundDid, '+447900000001');
  assert.equal(f.callerId, '+447900000001');
  assert.equal(f.source, 'inbound');
});
