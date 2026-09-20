'use strict';
/**
 * Bedrock/Polly outbound-media latency diagnostics.
 *
 * Anchors (do not conflate):
 * - lastSpeechFrameAtMs: last accepted speech-energy frame at ingestion
 * - endpointDetectedAtMs: silence-timer fire (includes VAD debounce; NOT pure acoustic EOS)
 * - turnReadyAtMs: transcript accepted
 * - first enqueue: Twilio media WS enqueue
 *
 * Immutable turnToken from beginUserTurn must be passed through synthesis→send;
 * stale tokens / dead sessions must not enqueue or consume the reply first-audio slot.
 */

export const BEDROCK_OUTBOUND_METRIC_VERSION =
  'speech_frame_and_endpoint_to_first_outbound_media_v1' as const;
export const BEDROCK_OUTBOUND_METRIC_ORIGIN =
  'twilio_bedrock_polly_audio_bridge' as const;
export const BEDROCK_OUTBOUND_MEASUREMENT_POINT =
  'twilio_media_ws_enqueue' as const;

export type BedrockOutboundPurpose =
  | 'user_turn_reply'
  | 'filler'
  | 'greeting'
  | 'rejection_reprompt'
  | 'apology';

export type BedrockOutboundSample = {
  callSid: string;
  kind: BedrockOutboundPurpose;
  turnToken: number;
  /**
   * Last accepted speech frame → first enqueue. Null when no speech frame
   * was recorded (acoustic EOS unknown).
   */
  lastSpeechFrameToFirstOutboundMediaMs: number | null;
  /**
   * Silence-timer fire → first enqueue. Includes VAD debounce; never claim
   * this equals acoustic-EOS-without-debounce.
   */
  endpointDetectedToFirstOutboundMediaMs: number | null;
  lastSpeechFrameToTurnReadyMs: number | null;
  endpointDetectedToTurnReadyMs: number | null;
  turnReadyToFirstOutboundMediaMs: number | null;
  /** True only when lastSpeechFrameAtMs was captured. */
  acousticEosKnown: boolean;
  metricVersion: typeof BEDROCK_OUTBOUND_METRIC_VERSION;
  metricOrigin: typeof BEDROCK_OUTBOUND_METRIC_ORIGIN;
  callerHeard: false;
  measurementPoint: typeof BEDROCK_OUTBOUND_MEASUREMENT_POINT;
  includeInUserTurnLatency: boolean;
  interrupted: boolean;
  lastSpeechFrameAtMs: number | null;
  endpointDetectedAtMs: number | null;
  turnReadyAtMs: number | null;
  firstOutboundMediaAtMs: number;
};

export class CallBedrockOutboundTracker {
  lastSpeechFrameAtMs: number | null = null;
  endpointDetectedAtMs: number | null = null;
  turnReadyAtMs: number | null = null;
  private activeTurnToken = 0;
  private interrupted = false;
  /** Only user_turn_reply may consume the first-audio slot for a turn. */
  private replyOutboundLogged = false;

  constructor(private callSid: string) {}

  getCallSid(): string {
    return this.callSid;
  }

  setCallSid(callSid: string): void {
    this.callSid = callSid;
  }

  getActiveTurnToken(): number {
    return this.activeTurnToken;
  }

  /** Update last accepted speech-energy frame (ingestion path). */
  onSpeechFrameAccepted(nowMs: number): void {
    this.lastSpeechFrameAtMs = nowMs;
  }

  /**
   * Silence timer fired — begin a user turn with an immutable token.
   * Does not clear lastSpeechFrameAtMs (acoustic anchor for this endpoint).
   */
  beginUserTurn(endpointDetectedAtMs: number): number {
    this.activeTurnToken += 1;
    this.endpointDetectedAtMs = endpointDetectedAtMs;
    this.turnReadyAtMs = null;
    this.interrupted = false;
    this.replyOutboundLogged = false;
    return this.activeTurnToken;
  }

  /** Non-turn outbound (greeting) gets its own token so late TTS cannot collide. */
  beginStandaloneOutbound(nowMs: number): number {
    this.activeTurnToken += 1;
    this.endpointDetectedAtMs = null;
    this.turnReadyAtMs = null;
    this.interrupted = false;
    this.replyOutboundLogged = false;
    void nowMs;
    return this.activeTurnToken;
  }

  onTurnReady(nowMs: number, turnToken: number): void {
    if (!this.isTokenLive(turnToken)) return;
    this.turnReadyAtMs = nowMs;
  }

  onInterrupted(): void {
    this.interrupted = true;
  }

  isTokenLive(turnToken: number): boolean {
    return (
      turnToken > 0 &&
      turnToken === this.activeTurnToken &&
      !this.interrupted
    );
  }

  shouldDropOutbound(turnToken: number): boolean {
    return !this.isTokenLive(turnToken);
  }

  onFirstOutboundMediaEnqueue(
    nowMs: number,
    purpose: BedrockOutboundPurpose,
    turnToken: number,
  ): BedrockOutboundSample | null {
    if (!this.isTokenLive(turnToken)) return null;

    // Only the turn's eligible reply consumes the first-audio metric slot.
    if (purpose === 'user_turn_reply') {
      if (this.replyOutboundLogged) return null;
      this.replyOutboundLogged = true;
    }

    const lastSpeechFrameAtMs = this.lastSpeechFrameAtMs;
    const endpointDetectedAtMs = this.endpointDetectedAtMs;
    const turnReadyAtMs = this.turnReadyAtMs;
    const acousticEosKnown =
      lastSpeechFrameAtMs != null && Number.isFinite(lastSpeechFrameAtMs);

    const lastSpeechFrameToFirstOutboundMediaMs = acousticEosKnown
      ? Math.max(0, nowMs - lastSpeechFrameAtMs!)
      : null;
    const endpointDetectedToFirstOutboundMediaMs =
      endpointDetectedAtMs != null && Number.isFinite(endpointDetectedAtMs)
        ? Math.max(0, nowMs - endpointDetectedAtMs)
        : null;
    const lastSpeechFrameToTurnReadyMs =
      acousticEosKnown &&
      turnReadyAtMs != null &&
      Number.isFinite(turnReadyAtMs)
        ? Math.max(0, turnReadyAtMs - lastSpeechFrameAtMs!)
        : null;
    const endpointDetectedToTurnReadyMs =
      endpointDetectedAtMs != null &&
      turnReadyAtMs != null &&
      Number.isFinite(endpointDetectedAtMs) &&
      Number.isFinite(turnReadyAtMs)
        ? Math.max(0, turnReadyAtMs - endpointDetectedAtMs)
        : null;
    const turnReadyToFirstOutboundMediaMs =
      turnReadyAtMs != null && Number.isFinite(turnReadyAtMs)
        ? Math.max(0, nowMs - turnReadyAtMs)
        : null;

    const includeInUserTurnLatency =
      purpose === 'user_turn_reply' &&
      !this.interrupted &&
      (lastSpeechFrameToFirstOutboundMediaMs != null ||
        endpointDetectedToFirstOutboundMediaMs != null);

    return {
      callSid: this.callSid,
      kind: purpose,
      turnToken,
      lastSpeechFrameToFirstOutboundMediaMs,
      endpointDetectedToFirstOutboundMediaMs,
      lastSpeechFrameToTurnReadyMs,
      endpointDetectedToTurnReadyMs,
      turnReadyToFirstOutboundMediaMs,
      acousticEosKnown,
      metricVersion: BEDROCK_OUTBOUND_METRIC_VERSION,
      metricOrigin: BEDROCK_OUTBOUND_METRIC_ORIGIN,
      callerHeard: false,
      measurementPoint: BEDROCK_OUTBOUND_MEASUREMENT_POINT,
      includeInUserTurnLatency,
      interrupted: this.interrupted,
      lastSpeechFrameAtMs,
      endpointDetectedAtMs,
      turnReadyAtMs,
      firstOutboundMediaAtMs: nowMs,
    };
  }

  clear(): void {
    this.lastSpeechFrameAtMs = null;
    this.endpointDetectedAtMs = null;
    this.turnReadyAtMs = null;
    this.activeTurnToken = 0;
    this.interrupted = false;
    this.replyOutboundLogged = false;
  }
}

export class BedrockOutboundMetricsRegistry {
  private readonly trackers = new Map<string, CallBedrockOutboundTracker>();

  getOrCreate(callSid: string): CallBedrockOutboundTracker {
    let t = this.trackers.get(callSid);
    if (!t) {
      t = new CallBedrockOutboundTracker(callSid);
      this.trackers.set(callSid, t);
    }
    return t;
  }

  get(callSid: string): CallBedrockOutboundTracker | undefined {
    return this.trackers.get(callSid);
  }

  clearCall(callSid: string): void {
    const t = this.trackers.get(callSid);
    if (t) {
      t.clear();
      this.trackers.delete(callSid);
    }
  }

  size(): number {
    return this.trackers.size;
  }
}

export const bedrockOutboundMediaMetrics = new BedrockOutboundMetricsRegistry();

export function formatBedrockOutboundLogMessage(sample: BedrockOutboundSample): string {
  const lf =
    sample.lastSpeechFrameToFirstOutboundMediaMs == null
      ? 'null'
      : String(sample.lastSpeechFrameToFirstOutboundMediaMs);
  const ep =
    sample.endpointDetectedToFirstOutboundMediaMs == null
      ? 'null'
      : String(sample.endpointDetectedToFirstOutboundMediaMs);
  const tr =
    sample.turnReadyToFirstOutboundMediaMs == null
      ? 'null'
      : String(sample.turnReadyToFirstOutboundMediaMs);
  return (
    `last_speech_frame_to_first_outbound_media_ms=${lf} ` +
    `endpoint_detected_to_first_outbound_media_ms=${ep} ` +
    `turn_ready_to_first_outbound_media_ms=${tr} ` +
    `acoustic_eos_known=${sample.acousticEosKnown} ` +
    `kind=${sample.kind} turn=${sample.turnToken} ` +
    `point=${sample.measurementPoint} version=${sample.metricVersion}`
  );
}
