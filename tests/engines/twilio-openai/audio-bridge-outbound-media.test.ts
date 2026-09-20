/**
 * Controlled-clock regressions driving the actual TwilioOpenAIAudioBridge
 * handler for EOS → first Twilio media WS *enqueue*. Mocked sockets/logger only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioBridgeSession } from '../../../server/engines/twilio-openai/types';
import {
  openaiOutboundMediaMetrics,
  OUTBOUND_MEDIA_METRIC_VERSION,
  OUTBOUND_MEDIA_MEASUREMENT_POINT,
  LOOP9_MARK_METADATA_KEY,
  buildOutboundMarkMetadata,
} from '../../../server/engines/twilio-openai/services/openai-outbound-media-metrics';

const logCallError = vi.fn(async () => undefined);

vi.mock('../../../server/services/call-error-logger', () => ({
  callErrorLogger: {
    logCallError: (...args: unknown[]) => logCallError(...args),
  },
}));

vi.mock('../../../server/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [],
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: async () => undefined,
      }),
    }),
  },
}));

vi.mock('../../../server/infrastructure', () => ({
  openaiPoolManager: {
    removeConnection: vi.fn(),
  },
}));

vi.mock('../../../server/services/live-call-registry', () => ({
  liveCallRegistry: {
    updateSentiment: vi.fn(),
  },
}));

vi.mock('../../../server/services/realtime-sentiment.service', () => ({
  RealtimeSentimentService: {
    resetCall: vi.fn(),
    analyze: vi.fn(),
  },
}));

vi.mock('../../../server/services/notification-service', () => ({
  NotificationService: { create: vi.fn() },
}));

vi.mock('../../../server/services/conversation-memory', () => ({
  ConversationMemoryService: { storeFactsFromTranscript: vi.fn(async () => 0) },
}));

vi.mock('../../../server/services/conversation-resumption', () => ({
  conversationResumptionService: { markCallResumable: vi.fn() },
}));

import { TwilioOpenAIAudioBridge } from '../../../server/engines/twilio-openai/services/audio-bridge.service';

function mockWs(open = true) {
  return {
    readyState: open ? 1 : 3,
    OPEN: 1,
    send: vi.fn(),
    close: vi.fn(),
  } as any;
}

function makeSession(callSid: string, overrides: Partial<AudioBridgeSession> = {}): AudioBridgeSession {
  return {
    callSid,
    streamSid: 'MZ_test',
    openaiSessionId: 'sess_test',
    status: 'connected',
    startedAt: new Date(0),
    endedAt: null,
    openaiWs: mockWs(true),
    twilioWs: mockWs(true),
    agentConfig: {
      agentName: 'Test',
      model: 'gpt-realtime',
      voice: 'alloy',
      language: 'en',
      instructions: 'test',
      tools: [],
    } as any,
    transcriptParts: [],
    toolHandlers: new Map(),
    processedToolCallIds: new Set(),
    onTranscriptCallback: null,
    onToolCallback: null,
    onAudioCallback: vi.fn(),
    onEndCallback: null,
    endCallbackFired: false,
    firstMessageSent: true,
    greetingPlaybackActive: false,
    twilioStreamReady: true,
    lastUserSpeechTime: 0,
    isResponseActive: false,
    pendingAudioQueue: [],
    softTimeoutId: null,
    hardTimeoutId: null,
    behaviorConfig: { softTimeoutSec: 4, hardTimeoutSec: 15 },
    waitingMessages: null,
    explicitEndCall: false,
    pendingClearTimerId: null,
    sentimentMode: 'neutral',
    lastBargeInCancelAt: 0,
    activeResponseId: null,
    suppressResponseOutputUntilDone: false,
    suppressedResponseId: null,
    pendingExplicitOutboundCreates: 0,
    speechGuardrailStrikes: 0,
    kbLowConfidenceGateActive: false,
    unresolvedIntentStreak: 0,
    escalationCheckpointArmed: false,
    ...overrides,
  };
}

async function deliver(session: AudioBridgeSession, event: Record<string, unknown>) {
  await TwilioOpenAIAudioBridge.handleOpenAIMessageForTests(
    session,
    JSON.stringify(event),
  );
}

describe('TwilioOpenAIAudioBridge outbound-media integration (controlled clock)', () => {
  let measureClock = 0;
  let wallClock = 1_000_000;

  beforeEach(() => {
    measureClock = 0;
    wallClock = 1_000_000;
    logCallError.mockClear();
    openaiOutboundMediaMetrics.clearCall('CA_bridge');
    TwilioOpenAIAudioBridge.setMeasureClockForTests(() => measureClock);
    TwilioOpenAIAudioBridge.setWallClockForTests(() => wallClock);
  });

  afterEach(async () => {
    TwilioOpenAIAudioBridge.setMeasureClockForTests(null);
    TwilioOpenAIAudioBridge.setWallClockForTests(null);
    TwilioOpenAIAudioBridge.uninstallSessionForTests('CA_bridge');
    openaiOutboundMediaMetrics.clearCall('CA_bridge');
    try {
      await TwilioOpenAIAudioBridge.endSession('CA_bridge');
    } catch {
      /* ignore */
    }
  });

  it('canonical 600ms: speech 1000→6000, first enqueue 6600 via real handler', async () => {
    const session = makeSession('CA_bridge');
    TwilioOpenAIAudioBridge.installSessionForTests(session);

    measureClock = 1000;
    await deliver(session, { type: 'input_audio_buffer.speech_started' });
    measureClock = 6000;
    await deliver(session, { type: 'input_audio_buffer.speech_stopped' });
    measureClock = 6100;
    await deliver(session, {
      type: 'response.created',
      response: { id: 'resp_1' },
    });
    measureClock = 6600;
    await deliver(session, {
      type: 'response.output_audio.delta',
      response_id: 'resp_1',
      delta: Buffer.from('x').toString('base64'),
    });

    expect(logCallError).toHaveBeenCalled();
    const entry = logCallError.mock.calls[0][0];
    expect(String(entry.message)).toContain('eos_to_first_outbound_media_ms=600');
    expect(String(entry.message)).not.toMatch(/\bttfa_ms=/);
    expect(entry.metadata).toMatchObject({
      eosToFirstOutboundMediaMs: 600,
      eosToProviderFirstByteMs: 600,
      kind: 'user_turn_reply',
      metricVersion: OUTBOUND_MEDIA_METRIC_VERSION,
      includeInUserTurnLatency: true,
      callerHeard: false,
      measurementPoint: OUTBOUND_MEDIA_MEASUREMENT_POINT,
    });
    expect(entry.metadata.eosToFirstOutboundMediaMs).not.toBe(5600);
    expect(session.twilioWs.send).toHaveBeenCalled();
  });

  it('wall-clock jump does not inflate EOS interval (measure clock independent)', async () => {
    const session = makeSession('CA_bridge');
    TwilioOpenAIAudioBridge.installSessionForTests(session);

    measureClock = 1000;
    wallClock = 5_000_000;
    await deliver(session, { type: 'input_audio_buffer.speech_started' });
    expect(session.lastUserSpeechTime).toBe(5_000_000);

    measureClock = 6000;
    // Wall jumps forward 1 hour — must not affect EOS interval.
    wallClock = 5_000_000 + 3_600_000;
    await deliver(session, { type: 'input_audio_buffer.speech_stopped' });
    measureClock = 6100;
    await deliver(session, {
      type: 'response.created',
      response: { id: 'resp_wall' },
    });
    measureClock = 6600;
    await deliver(session, {
      type: 'response.output_audio.delta',
      response_id: 'resp_wall',
      delta: 'AA==',
    });

    const entry = logCallError.mock.calls[0][0];
    expect(entry.metadata.eosToFirstOutboundMediaMs).toBe(600);
    expect(entry.metadata.eosToFirstOutboundMediaMs).not.toBe(3_600_600);
  });

  it('late cancelled delta after response.done does not forward or side-effect', async () => {
    const session = makeSession('CA_bridge');
    TwilioOpenAIAudioBridge.installSessionForTests(session);

    measureClock = 1000;
    await deliver(session, { type: 'input_audio_buffer.speech_stopped' });
    measureClock = 1100;
    await deliver(session, {
      type: 'response.created',
      response: { id: 'resp_old' },
    });
    TwilioOpenAIAudioBridge.interrupt('CA_bridge');
    measureClock = 1200;
    await deliver(session, {
      type: 'response.done',
      response: { id: 'resp_old' },
    });
    expect(session.activeResponseId).toBeNull();
    expect(session.suppressResponseOutputUntilDone).toBe(false);

    const twilioSend = session.twilioWs!.send as ReturnType<typeof vi.fn>;
    twilioSend.mockClear();
    (session.onAudioCallback as ReturnType<typeof vi.fn>).mockClear();
    logCallError.mockClear();

    measureClock = 1300;
    await deliver(session, {
      type: 'response.output_audio.delta',
      response_id: 'resp_old',
      delta: 'AA==',
    });

    expect(twilioSend).not.toHaveBeenCalled();
    expect(session.onAudioCallback).not.toHaveBeenCalled();
    expect(logCallError).not.toHaveBeenCalled();
  });

  it('missing response_id on delta does not forward', async () => {
    const session = makeSession('CA_bridge');
    TwilioOpenAIAudioBridge.installSessionForTests(session);
    measureClock = 1000;
    await deliver(session, { type: 'input_audio_buffer.speech_stopped' });
    await deliver(session, {
      type: 'response.created',
      response: { id: 'resp_1' },
    });
    const twilioSend = session.twilioWs!.send as ReturnType<typeof vi.fn>;
    twilioSend.mockClear();
    (session.onAudioCallback as ReturnType<typeof vi.fn>).mockClear();

    await deliver(session, {
      type: 'response.output_audio.delta',
      delta: 'AA==',
    });
    expect(twilioSend).not.toHaveBeenCalled();
    expect(session.onAudioCallback).not.toHaveBeenCalled();
  });

  it('unknown response id does not forward', async () => {
    const session = makeSession('CA_bridge');
    TwilioOpenAIAudioBridge.installSessionForTests(session);
    const twilioSend = session.twilioWs!.send as ReturnType<typeof vi.fn>;
    await deliver(session, {
      type: 'response.output_audio.delta',
      response_id: 'resp_ghost',
      delta: 'AA==',
    });
    expect(twilioSend).not.toHaveBeenCalled();
  });

  it('old response after new response done is dropped', async () => {
    const session = makeSession('CA_bridge');
    TwilioOpenAIAudioBridge.installSessionForTests(session);

    measureClock = 1000;
    await deliver(session, { type: 'input_audio_buffer.speech_stopped' });
    await deliver(session, {
      type: 'response.created',
      response: { id: 'resp_1' },
    });
    await deliver(session, {
      type: 'response.done',
      response: { id: 'resp_1' },
    });

    measureClock = 2000;
    await deliver(session, { type: 'input_audio_buffer.speech_stopped' });
    await deliver(session, {
      type: 'response.created',
      response: { id: 'resp_2' },
    });
    await deliver(session, {
      type: 'response.done',
      response: { id: 'resp_2' },
    });

    const twilioSend = session.twilioWs!.send as ReturnType<typeof vi.fn>;
    twilioSend.mockClear();
    await deliver(session, {
      type: 'response.output_audio.delta',
      response_id: 'resp_1',
      delta: 'AA==',
    });
    expect(twilioSend).not.toHaveBeenCalled();
  });

  it('hard timeout cancels and suppresses late deltas for the timed-out response', async () => {
    vi.useFakeTimers();
    const session = makeSession('CA_bridge', {
      behaviorConfig: { softTimeoutSec: 100, hardTimeoutSec: 1 },
    });
    TwilioOpenAIAudioBridge.installSessionForTests(session);

    measureClock = 1000;
    await deliver(session, { type: 'input_audio_buffer.speech_stopped' });
    await deliver(session, {
      type: 'response.created',
      response: { id: 'resp_slow' },
    });
    expect(session.activeResponseId).toBe('resp_slow');

    await vi.advanceTimersByTimeAsync(1000);
    expect(session.suppressResponseOutputUntilDone).toBe(true);
    expect(session.suppressedResponseId).toBe('resp_slow');
    expect(
      openaiOutboundMediaMetrics.get('CA_bridge')?.shouldDropMedia('resp_slow'),
    ).toBe(true);

    const twilioSend = session.twilioWs!.send as ReturnType<typeof vi.fn>;
    twilioSend.mockClear();
    (session.onAudioCallback as ReturnType<typeof vi.fn>).mockClear();

    await deliver(session, {
      type: 'response.output_audio.delta',
      response_id: 'resp_slow',
      delta: 'AA==',
    });
    expect(twilioSend).not.toHaveBeenCalled();
    expect(session.onAudioCallback).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('late provider events after endSession do not recreate tracker or forward audio', async () => {
    const session = makeSession('CA_bridge');
    TwilioOpenAIAudioBridge.installSessionForTests(session);
    measureClock = 1000;
    await deliver(session, { type: 'input_audio_buffer.speech_stopped' });
    expect(openaiOutboundMediaMetrics.get('CA_bridge')).toBeDefined();

    await TwilioOpenAIAudioBridge.endSession('CA_bridge');
    expect(openaiOutboundMediaMetrics.get('CA_bridge')).toBeUndefined();

    const twilioSend = session.twilioWs!.send as ReturnType<typeof vi.fn>;
    twilioSend.mockClear();
    (session.onAudioCallback as ReturnType<typeof vi.fn>).mockClear();

    measureClock = 2000;
    await deliver(session, {
      type: 'response.created',
      response: { id: 'resp_late' },
    });
    await deliver(session, {
      type: 'response.output_audio.delta',
      response_id: 'resp_late',
      delta: Buffer.from('stale').toString('base64'),
    });

    expect(openaiOutboundMediaMetrics.get('CA_bridge')).toBeUndefined();
    expect(twilioSend).not.toHaveBeenCalled();
    expect(session.onAudioCallback).not.toHaveBeenCalled();
    expect(logCallError).not.toHaveBeenCalled();
  });

  it('public interrupt drops late delta before send/callback (not merely unmeasured)', async () => {
    const session = makeSession('CA_bridge');
    TwilioOpenAIAudioBridge.installSessionForTests(session);

    measureClock = 1000;
    await deliver(session, { type: 'input_audio_buffer.speech_started' });
    measureClock = 2000;
    await deliver(session, { type: 'input_audio_buffer.speech_stopped' });
    measureClock = 2100;
    await deliver(session, {
      type: 'response.created',
      response: { id: 'resp_int' },
    });

    TwilioOpenAIAudioBridge.interrupt('CA_bridge');
    expect(
      openaiOutboundMediaMetrics.get('CA_bridge')?.shouldDropMedia('resp_int'),
    ).toBe(true);

    const twilioSend = session.twilioWs!.send as ReturnType<typeof vi.fn>;
    twilioSend.mockClear();
    (session.onAudioCallback as ReturnType<typeof vi.fn>).mockClear();
    logCallError.mockClear();

    measureClock = 2800;
    await deliver(session, {
      type: 'response.output_audio.delta',
      response_id: 'resp_int',
      delta: Buffer.from('late').toString('base64'),
    });

    expect(twilioSend).not.toHaveBeenCalled();
    expect(session.onAudioCallback).not.toHaveBeenCalled();
    expect(logCallError).not.toHaveBeenCalled();
  });

  it('twilio send throw is enqueue failure — no latency sample claiming success', async () => {
    const session = makeSession('CA_bridge');
    (session.twilioWs!.send as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('enqueue failed');
    });
    TwilioOpenAIAudioBridge.installSessionForTests(session);

    measureClock = 1000;
    await deliver(session, { type: 'input_audio_buffer.speech_stopped' });
    await deliver(session, {
      type: 'response.created',
      response: { id: 'resp_fail' },
    });
    await deliver(session, {
      type: 'response.output_audio.delta',
      response_id: 'resp_fail',
      delta: 'AA==',
    });

    expect(logCallError).not.toHaveBeenCalled();
  });

  it('greetingPlaybackActive keeps echo-guard barge-in ignore', async () => {
    const session = makeSession('CA_bridge', {
      greetingPlaybackActive: true,
      isResponseActive: true,
      activeResponseId: 'resp_greet',
    });
    TwilioOpenAIAudioBridge.installSessionForTests(session);
    openaiOutboundMediaMetrics.getOrCreate('CA_bridge').markNextResponse('greeting');
    measureClock = 100;
    await deliver(session, {
      type: 'response.created',
      response: { id: 'resp_greet' },
    });

    const send = session.openaiWs!.send as ReturnType<typeof vi.fn>;
    send.mockClear();
    measureClock = 200;
    await deliver(session, { type: 'input_audio_buffer.speech_started' });
    expect(
      send.mock.calls.some((c) => String(c[0]).includes('response.cancel')),
    ).toBe(false);
  });

  it('overlapping speech stops before bind exclude uncertain user-turn sample', async () => {
    const session = makeSession('CA_bridge');
    TwilioOpenAIAudioBridge.installSessionForTests(session);

    measureClock = 1000;
    await deliver(session, { type: 'input_audio_buffer.speech_started' });
    measureClock = 2000;
    await deliver(session, { type: 'input_audio_buffer.speech_stopped' });
    measureClock = 3000;
    await deliver(session, { type: 'input_audio_buffer.speech_started' });
    measureClock = 4000;
    await deliver(session, { type: 'input_audio_buffer.speech_stopped' });

    measureClock = 4100;
    await deliver(session, {
      type: 'response.created',
      response: { id: 'resp_ambiguous' },
    });
    measureClock = 4500;
    await deliver(session, {
      type: 'response.output_audio.delta',
      response_id: 'resp_ambiguous',
      delta: 'AA==',
    });

    const log = logCallError.mock.calls.find(
      (c) => c[0]?.metadata?.responseId === 'resp_ambiguous',
    );
    expect(log?.[0].metadata.includeInUserTurnLatency).toBe(false);
    expect(log?.[0].metadata.eosToFirstOutboundMediaMs).toBeNull();
    expect(log?.[0].metadata.provenanceUncertain).toBe(true);
  });

  it('REAL handler: automatic response.created does not steal pending waiting mark', async () => {
    vi.useFakeTimers();
    const session = makeSession('CA_bridge', {
      behaviorConfig: { softTimeoutSec: 1, hardTimeoutSec: 100 },
      waitingMessages: ['One moment please'],
    });
    TwilioOpenAIAudioBridge.installSessionForTests(session);

    measureClock = 1000;
    await deliver(session, { type: 'input_audio_buffer.speech_stopped' });

    await vi.advanceTimersByTimeAsync(1000);
    const openaiSend = session.openaiWs!.send as ReturnType<typeof vi.fn>;
    const waitingCreate = openaiSend.mock.calls
      .map((c) => {
        try {
          return JSON.parse(String(c[0]));
        } catch {
          return null;
        }
      })
      .find((p) => p?.type === 'response.create' && p?.response?.metadata?.[LOOP9_MARK_METADATA_KEY]);
    expect(waitingCreate).toBeTruthy();
    const markId = waitingCreate.response.metadata[LOOP9_MARK_METADATA_KEY];
    expect(openaiOutboundMediaMetrics.get('CA_bridge')?.hasPendingMark(markId)).toBe(true);

    // Automatic create arrives first (no metadata) — must not consume waiting mark.
    await deliver(session, {
      type: 'response.created',
      response: { id: 'resp_auto' },
    });
    expect(openaiOutboundMediaMetrics.get('CA_bridge')?.getBinding('resp_auto')?.kind).toBe(
      'user_turn_reply',
    );
    expect(
      openaiOutboundMediaMetrics.get('CA_bridge')?.getBinding('resp_auto')?.attributionAmbiguous,
    ).toBe(true);
    expect(openaiOutboundMediaMetrics.get('CA_bridge')?.hasPendingMark(markId)).toBe(true);

    await deliver(session, {
      type: 'response.created',
      response: {
        id: 'resp_wait',
        metadata: waitingCreate.response.metadata,
      },
    });
    expect(openaiOutboundMediaMetrics.get('CA_bridge')?.getBinding('resp_wait')?.kind).toBe(
      'waiting_filler',
    );
    expect(openaiOutboundMediaMetrics.get('CA_bridge')?.pendingMarkCount()).toBe(0);
    vi.useRealTimers();
  });

  it('duplicate response.created does not rebind / shift labels', async () => {
    const session = makeSession('CA_bridge');
    TwilioOpenAIAudioBridge.installSessionForTests(session);
    const markId = openaiOutboundMediaMetrics
      .getOrCreate('CA_bridge')
      .markNextResponse('waiting_filler', 50);
    await deliver(session, {
      type: 'response.created',
      response: {
        id: 'resp_dup',
        metadata: buildOutboundMarkMetadata(markId, 'waiting_filler'),
      },
    });
    expect(openaiOutboundMediaMetrics.get('CA_bridge')?.getBinding('resp_dup')?.kind).toBe(
      'waiting_filler',
    );
    await deliver(session, {
      type: 'response.created',
      response: {
        id: 'resp_dup',
        metadata: buildOutboundMarkMetadata('mark_stale', 'greeting'),
      },
    });
    expect(openaiOutboundMediaMetrics.get('CA_bridge')?.getBinding('resp_dup')?.kind).toBe(
      'waiting_filler',
    );
  });

  it('late tool_final audio after interrupt is dropped (not hangup-only)', async () => {
    const session = makeSession('CA_bridge');
    TwilioOpenAIAudioBridge.installSessionForTests(session);

    measureClock = 1000;
    await deliver(session, { type: 'input_audio_buffer.speech_stopped' });
    const markId = openaiOutboundMediaMetrics
      .getOrCreate('CA_bridge')
      .markNextResponse('tool_final_reply', 1000);
    await deliver(session, {
      type: 'response.created',
      response: {
        id: 'resp_tool',
        metadata: buildOutboundMarkMetadata(markId, 'tool_final_reply'),
      },
    });
    expect(
      openaiOutboundMediaMetrics.get('CA_bridge')?.getBinding('resp_tool')?.kind,
    ).toBe('tool_final_reply');

    TwilioOpenAIAudioBridge.interrupt('CA_bridge');
    const twilioSend = session.twilioWs!.send as ReturnType<typeof vi.fn>;
    twilioSend.mockClear();
    (session.onAudioCallback as ReturnType<typeof vi.fn>).mockClear();

    await deliver(session, {
      type: 'response.output_audio.delta',
      response_id: 'resp_tool',
      delta: 'AA==',
    });
    expect(twilioSend).not.toHaveBeenCalled();
    expect(session.onAudioCallback).not.toHaveBeenCalled();
  });
});
