import { describe, expect, it, beforeEach } from 'vitest';
import {
  CallOutboundMediaTracker,
  OUTBOUND_MEDIA_METRIC_ORIGIN,
  OUTBOUND_MEDIA_METRIC_VERSION,
  OUTBOUND_MEDIA_MEASUREMENT_POINT,
  LOOP9_MARK_METADATA_KEY,
  LOOP9_KIND_METADATA_KEY,
  buildOutboundMarkMetadata,
  formatOutboundMediaLogMessage,
  OutboundMediaMetricsRegistry,
} from '../../../server/engines/twilio-openai/services/openai-outbound-media-metrics';

describe('OpenAI eos_to_first_outbound_media_v1 (metadata correlation)', () => {
  let tracker: CallOutboundMediaTracker;

  beforeEach(() => {
    tracker = new CallOutboundMediaTracker('CA_test');
  });

  it('speech begin 1000, end 6000, outbound 6600 → 600ms not 5600', () => {
    tracker.onSpeechStarted(1000);
    tracker.onSpeechStopped(6000);
    tracker.onResponseCreated('resp_1');
    tracker.onProviderFirstByte('resp_1', 6550);
    const sample = tracker.onFirstOutboundMediaEnqueue('resp_1', 6600);
    expect(sample).toMatchObject({
      kind: 'user_turn_reply',
      eosToFirstOutboundMediaMs: 600,
      includeInUserTurnLatency: true,
      measurementPoint: OUTBOUND_MEDIA_MEASUREMENT_POINT,
      metricVersion: OUTBOUND_MEDIA_METRIC_VERSION,
      metricOrigin: OUTBOUND_MEDIA_METRIC_ORIGIN,
      callerHeard: false,
    });
  });

  it('automatic response.created does not steal pending waiting mark', () => {
    tracker.onSpeechStopped(6000);
    const waitingMark = tracker.markNextResponse('waiting_filler', 6500);
    expect(tracker.pendingMarkCount()).toBe(1);

    // Automatic create — no metadata — must not consume waiting mark.
    tracker.onResponseCreated('resp_auto');
    expect(tracker.getBinding('resp_auto')?.kind).toBe('user_turn_reply');
    expect(tracker.getBinding('resp_auto')?.attributionAmbiguous).toBe(true);
    expect(tracker.hasPendingMark(waitingMark)).toBe(true);
    expect(tracker.pendingMarkCount()).toBe(1);

    const autoSample = tracker.onFirstOutboundMediaEnqueue('resp_auto', 6700);
    expect(autoSample?.includeInUserTurnLatency).toBe(false);
    expect(autoSample?.eosToFirstOutboundMediaMs).toBeNull();
    expect(autoSample?.attributionAmbiguous).toBe(true);

    // Later correlated waiting create.
    tracker.onResponseCreated('resp_wait', {
      providerMetadata: buildOutboundMarkMetadata(waitingMark, 'waiting_filler'),
    });
    expect(tracker.getBinding('resp_wait')?.kind).toBe('waiting_filler');
    expect(tracker.pendingMarkCount()).toBe(0);
    const wait = tracker.onFirstOutboundMediaEnqueue('resp_wait', 6800);
    expect(wait).toMatchObject({
      kind: 'waiting_filler',
      eosToFirstOutboundMediaMs: null,
      anchorToFirstOutboundMediaMs: 300,
      includeInUserTurnLatency: false,
    });
  });

  it('rejected/abandoned mark metadata does not apply stale label', () => {
    const markId = tracker.markNextResponse('hard_timeout_apology', 100);
    tracker.abandonMark(markId);
    tracker.onResponseCreated('resp_orphan', {
      providerMetadata: buildOutboundMarkMetadata(markId, 'hard_timeout_apology'),
    });
    expect(tracker.getBinding('resp_orphan')?.kind).toBe('user_turn_reply');
    expect(tracker.getBinding('resp_orphan')?.attributionAmbiguous).toBe(true);
    const sample = tracker.onFirstOutboundMediaEnqueue('resp_orphan', 200);
    expect(sample?.includeInUserTurnLatency).toBe(false);
  });

  it('duplicate response.created keeps first binding', () => {
    const markId = tracker.markNextResponse('waiting_filler', 10);
    tracker.onResponseCreated('resp_1', {
      providerMetadata: buildOutboundMarkMetadata(markId, 'waiting_filler'),
    });
    expect(tracker.getBinding('resp_1')?.kind).toBe('waiting_filler');
    tracker.onResponseCreated('resp_1', {
      providerMetadata: { [LOOP9_MARK_METADATA_KEY]: 'other', [LOOP9_KIND_METADATA_KEY]: 'greeting' },
    });
    expect(tracker.getBinding('resp_1')?.kind).toBe('waiting_filler');
  });

  it('greeting via metadata correlation', () => {
    const markId = tracker.markNextResponse('greeting');
    tracker.onResponseCreated('resp_greet', {
      greetingPlaybackActive: true,
      providerMetadata: buildOutboundMarkMetadata(markId, 'greeting'),
    });
    const sample = tracker.onFirstOutboundMediaEnqueue('resp_greet', 500);
    expect(sample).toMatchObject({
      kind: 'greeting',
      eosToFirstOutboundMediaMs: null,
      includeInUserTurnLatency: false,
    });
  });

  it('cancelled terminal drops media', () => {
    tracker.onSpeechStopped(1000);
    tracker.onResponseCreated('resp_1');
    tracker.onResponseCancelled('resp_1');
    expect(tracker.shouldDropMedia('resp_1')).toBe(true);
  });

  it('format message excludes legacy ttfa_ms', () => {
    tracker.onSpeechStopped(1000);
    tracker.onResponseCreated('resp_1');
    tracker.onProviderFirstByte('resp_1', 1500);
    const msg = formatOutboundMediaLogMessage(
      tracker.onFirstOutboundMediaEnqueue('resp_1', 1600)!,
    );
    expect(msg).toContain('eos_to_first_outbound_media_ms=600');
    expect(msg).not.toMatch(/\bttfa_ms=/);
  });

  it('teardown clears registry', () => {
    const registry = new OutboundMediaMetricsRegistry();
    registry.getOrCreate('CA_a').onSpeechStopped(1);
    registry.clearCall('CA_a');
    expect(registry.get('CA_a')).toBeUndefined();
  });
});
