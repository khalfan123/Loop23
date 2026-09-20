/**
 * Bedrock speech-frame / endpoint-detected / turn-token enqueue guards.
 * Exercises real synthesizeAndSend + sendMulaw paths (not tracker-only races).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BEDROCK_OUTBOUND_MEASUREMENT_POINT,
  BEDROCK_OUTBOUND_METRIC_VERSION,
  bedrockOutboundMediaMetrics,
  formatBedrockOutboundLogMessage,
} from '../../../server/engines/twilio-bedrock-polly/services/bedrock-outbound-media-metrics';

const logCallError = vi.fn(async () => undefined);

vi.mock('../../../server/services/call-error-logger', () => ({
  callErrorLogger: {
    logCallError: (...args: unknown[]) => logCallError(...args),
  },
}));

vi.mock('../../../server/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  },
}));

vi.mock('../../../server/services/live-call-registry', () => ({
  liveCallRegistry: { updateSentiment: vi.fn() },
}));

vi.mock('../../../server/services/realtime-sentiment.service', () => ({
  RealtimeSentimentService: { resetCall: vi.fn(), analyzeSentiment: vi.fn() },
}));

vi.mock('../../../server/services/notification-service', () => ({
  NotificationService: { create: vi.fn() },
}));

vi.mock('../../../server/services/conversation-resumption', () => ({
  conversationResumptionService: { markCallResumable: vi.fn() },
}));

vi.mock('../../../server/engines/twilio-bedrock-polly/services/tts-router', () => ({
  getDeprockTTSRouter: () => ({
    synthesize: async () => ({
      result: { encoding: 'mulaw', audio: Buffer.alloc(640, 0xaa) },
      attempts: [{ provider: 'aws_polly', ok: true }],
    }),
  }),
  buildTTSRouteContext: (_a: unknown, preferred: string, text: string) => ({
    preferred,
    text,
    finalFallback: 'aws_polly',
  }),
  outcomeFromAttempts: () => ({ provider: 'aws_polly', fellBack: false }),
}));

import { BedrockPollyAudioBridge } from '../../../server/engines/twilio-bedrock-polly/services/audio-bridge.service';

function makeSession(callSid: string, overrides: Record<string, unknown> = {}) {
  return {
    callSid,
    streamSid: 'MZ_br',
    status: 'connected',
    startedAt: new Date(0),
    endedAt: null,
    twilioWs: {
      readyState: 1,
      OPEN: 1,
      send: vi.fn(),
    },
    agentConfig: {
      agentName: 'Test',
      model: 'claude',
      voice: 'Joanna',
      language: 'en',
      instructions: 'test',
      tools: [],
      ttsProvider: 'aws_polly',
      firstMessage: 'Hello there',
    },
    transcriptParts: [],
    toolHandlers: new Map(),
    processedToolCallIds: new Set(),
    onTranscriptCallback: null,
    onToolCallback: null,
    onAudioCallback: vi.fn(),
    onEndCallback: null,
    messages: [],
    pendingAudioQueue: [],
    isProcessing: false,
    pollyEngine: 'neural',
    ttsProvider: 'aws_polly',
    isOutbound: false,
    explicitEndCall: false,
    activeOutboundTurnToken: 0,
    ...overrides,
  } as any;
}

describe('Bedrock frame/endpoint/turn-token outbound', () => {
  let clock = 0;

  beforeEach(() => {
    clock = 0;
    logCallError.mockClear();
    bedrockOutboundMediaMetrics.clearCall('CA_br');
    BedrockPollyAudioBridge.setMeasureClockForTests(() => clock);
    BedrockPollyAudioBridge.setPreEnqueueHookForTests(null);
  });

  afterEach(() => {
    BedrockPollyAudioBridge.setMeasureClockForTests(null);
    BedrockPollyAudioBridge.setPreEnqueueHookForTests(null);
    BedrockPollyAudioBridge.uninstallSessionForTests('CA_br');
    bedrockOutboundMediaMetrics.clearCall('CA_br');
  });

  it('labels last-speech-frame and endpoint-detected separately (debounce not removed EOS)', () => {
    const t = bedrockOutboundMediaMetrics.getOrCreate('CA_br');
    clock = 1000;
    t.onSpeechFrameAccepted(1000);
    clock = 1400; // endpoint after 400ms debounce
    const token = t.beginUserTurn(1400);
    clock = 2000;
    t.onTurnReady(2000, token);
    clock = 3000;
    const sample = t.onFirstOutboundMediaEnqueue(3000, 'user_turn_reply', token)!;
    expect(sample.lastSpeechFrameToFirstOutboundMediaMs).toBe(2000);
    expect(sample.endpointDetectedToFirstOutboundMediaMs).toBe(1600);
    expect(sample.acousticEosKnown).toBe(true);
    expect(sample.lastSpeechFrameToFirstOutboundMediaMs).not.toBe(
      sample.endpointDetectedToFirstOutboundMediaMs,
    );
    const msg = formatBedrockOutboundLogMessage(sample);
    expect(msg).toContain('last_speech_frame_to_first_outbound_media_ms=2000');
    expect(msg).toContain('endpoint_detected_to_first_outbound_media_ms=1600');
    expect(msg).toContain('acoustic_eos_known=true');
    expect(msg).not.toMatch(/speech_end_to_first/);
    expect(sample.metricVersion).toBe(BEDROCK_OUTBOUND_METRIC_VERSION);
  });

  it('deferred TTS for turn A after interrupt+B does not enqueue via real synthesizeAndSend', async () => {
    const session = makeSession('CA_br');
    BedrockPollyAudioBridge.installSessionForTests(session);
    const tracker = bedrockOutboundMediaMetrics.getOrCreate('CA_br');

    clock = 1000;
    tracker.onSpeechFrameAccepted(1000);
    const tokenA = tracker.beginUserTurn(1100);
    session.activeOutboundTurnToken = tokenA;
    tracker.onTurnReady(1200, tokenA);

    let releaseA!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseA = resolve;
    });
    BedrockPollyAudioBridge.setPreEnqueueHookForTests(async ({ turnToken }) => {
      if (turnToken === tokenA) await gate;
    });

    const pendingA = BedrockPollyAudioBridge.synthesizeAndSendForTests(session, 'Answer A', {
      turnToken: tokenA,
      purpose: 'user_turn_reply',
    });

    // Interrupt A, start B while A is still gated post-synth.
    tracker.onInterrupted();
    clock = 2000;
    tracker.onSpeechFrameAccepted(2000);
    const tokenB = tracker.beginUserTurn(2100);
    session.activeOutboundTurnToken = tokenB;
    tracker.onTurnReady(2200, tokenB);
    expect(tracker.isTokenLive(tokenA)).toBe(false);
    expect(tracker.isTokenLive(tokenB)).toBe(true);

    const send = session.twilioWs.send as ReturnType<typeof vi.fn>;
    send.mockClear();
    logCallError.mockClear();

    releaseA();
    await pendingA;

    expect(send).not.toHaveBeenCalled();
    expect(
      logCallError.mock.calls.some((c) => c[0]?.metadata?.turnToken === tokenA),
    ).toBe(false);

    // B can still enqueue.
    clock = 3500;
    BedrockPollyAudioBridge.sendMulawToTwilioForTests(session, Buffer.alloc(640, 0xbb), {
      turnToken: tokenB,
      purpose: 'user_turn_reply',
    });
    expect(send).toHaveBeenCalled();
    const meta = logCallError.mock.calls.find(
      (c) => c[0]?.metadata?.kind === 'user_turn_reply',
    )?.[0]?.metadata;
    expect(meta?.turnToken).toBe(tokenB);
    expect(meta?.measurementPoint).toBe(BEDROCK_OUTBOUND_MEASUREMENT_POINT);
    expect(meta?.callerHeard).toBe(false);
  });

  it('filler first then answer: filler does not consume reply first-audio slot', () => {
    const session = makeSession('CA_br');
    BedrockPollyAudioBridge.installSessionForTests(session);
    const t = bedrockOutboundMediaMetrics.getOrCreate('CA_br');
    clock = 100;
    t.onSpeechFrameAccepted(100);
    const token = t.beginUserTurn(200);
    session.activeOutboundTurnToken = token;
    t.onTurnReady(300, token);

    const send = session.twilioWs.send as ReturnType<typeof vi.fn>;
    clock = 400;
    BedrockPollyAudioBridge.sendMulawToTwilioForTests(session, Buffer.alloc(640, 1), {
      turnToken: token,
      purpose: 'filler',
    });
    expect(send).toHaveBeenCalled();
    // Filler may log but must not block reply slot.
    logCallError.mockClear();
    send.mockClear();

    clock = 800;
    BedrockPollyAudioBridge.sendMulawToTwilioForTests(session, Buffer.alloc(640, 2), {
      turnToken: token,
      purpose: 'user_turn_reply',
    });
    expect(send).toHaveBeenCalled();
    const replyLog = logCallError.mock.calls.find(
      (c) => c[0]?.metadata?.kind === 'user_turn_reply',
    );
    expect(replyLog?.[0].metadata.includeInUserTurnLatency).toBe(true);
    expect(replyLog?.[0].metadata.endpointDetectedToFirstOutboundMediaMs).toBe(600);
  });

  it('greeting purpose is not user_turn_reply', () => {
    const session = makeSession('CA_br');
    BedrockPollyAudioBridge.installSessionForTests(session);
    const t = bedrockOutboundMediaMetrics.getOrCreate('CA_br');
    const token = t.beginStandaloneOutbound(50);
    session.activeOutboundTurnToken = token;
    BedrockPollyAudioBridge.sendMulawToTwilioForTests(session, Buffer.alloc(640, 3), {
      turnToken: token,
      purpose: 'greeting',
    });
    const meta = logCallError.mock.calls[0]?.[0]?.metadata;
    expect(meta?.kind).toBe('greeting');
    expect(meta?.includeInUserTurnLatency).toBe(false);
  });

  it('rejection_reprompt purpose tagged', () => {
    const session = makeSession('CA_br');
    BedrockPollyAudioBridge.installSessionForTests(session);
    const t = bedrockOutboundMediaMetrics.getOrCreate('CA_br');
    const token = t.beginUserTurn(10);
    session.activeOutboundTurnToken = token;
    BedrockPollyAudioBridge.sendMulawToTwilioForTests(session, Buffer.alloc(640, 4), {
      turnToken: token,
      purpose: 'rejection_reprompt',
    });
    expect(logCallError.mock.calls[0]?.[0]?.metadata?.kind).toBe('rejection_reprompt');
    expect(logCallError.mock.calls[0]?.[0]?.metadata?.includeInUserTurnLatency).toBe(false);
  });

  it('hangup / disconnected session drops late TTS enqueue', async () => {
    const session = makeSession('CA_br');
    BedrockPollyAudioBridge.installSessionForTests(session);
    const t = bedrockOutboundMediaMetrics.getOrCreate('CA_br');
    const token = t.beginUserTurn(10);
    session.activeOutboundTurnToken = token;
    t.onTurnReady(20, token);

    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    BedrockPollyAudioBridge.setPreEnqueueHookForTests(async () => {
      await gate;
    });

    const pending = BedrockPollyAudioBridge.synthesizeAndSendForTests(session, 'Late goodbye', {
      turnToken: token,
      purpose: 'user_turn_reply',
    });

    session.status = 'disconnected';
    const send = session.twilioWs.send as ReturnType<typeof vi.fn>;
    send.mockClear();
    release();
    await pending;
    expect(send).not.toHaveBeenCalled();
  });

  it('replaced session object rejects enqueue', () => {
    const sessionA = makeSession('CA_br');
    const sessionB = makeSession('CA_br');
    BedrockPollyAudioBridge.installSessionForTests(sessionB); // live is B
    const t = bedrockOutboundMediaMetrics.getOrCreate('CA_br');
    const token = t.beginUserTurn(1);
    sessionA.activeOutboundTurnToken = token;
    const sendA = sessionA.twilioWs.send as ReturnType<typeof vi.fn>;
    BedrockPollyAudioBridge.sendMulawToTwilioForTests(sessionA, Buffer.alloc(640, 5), {
      turnToken: token,
      purpose: 'user_turn_reply',
    });
    expect(sendA).not.toHaveBeenCalled();
  });
});
