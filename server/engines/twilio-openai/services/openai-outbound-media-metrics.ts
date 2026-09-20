'use strict';
/**
 * OpenAI Realtime outbound-media latency diagnostics.
 *
 * Primary user-turn metric (EOS-anchored only):
 *   speech_stopped → first Twilio Media Streams `media` WebSocket *enqueue*
 *
 * Explicit response.create intents are correlated via response.metadata
 * (official Realtime guidance for disambiguating simultaneous responses).
 * Automatic response.created without our mark metadata never consumes a
 * pending explicit intent (no FIFO steal).
 */

export const OUTBOUND_MEDIA_METRIC_VERSION = 'eos_to_first_outbound_media_v1' as const;
export const OUTBOUND_MEDIA_METRIC_ORIGIN = 'twilio_openai_audio_bridge' as const;
export const OUTBOUND_MEDIA_MEASUREMENT_POINT = 'twilio_media_ws_enqueue' as const;

/** Key placed on response.create → response.metadata (echoed on response.created). */
export const LOOP9_MARK_METADATA_KEY = 'loop9_outbound_mark' as const;
export const LOOP9_KIND_METADATA_KEY = 'loop9_outbound_kind' as const;

export type OutboundMediaResponseKind =
  | 'greeting'
  | 'user_turn_reply'
  | 'waiting_filler'
  | 'tool_acknowledgement'
  | 'tool_final_reply'
  | 'hard_timeout_apology';

export type OutboundMediaSample = {
  callSid: string;
  responseId: string;
  kind: OutboundMediaResponseKind;
  eosToFirstOutboundMediaMs: number | null;
  eosToProviderFirstByteMs: number | null;
  anchorToFirstOutboundMediaMs: number | null;
  metricVersion: typeof OUTBOUND_MEDIA_METRIC_VERSION;
  metricOrigin: typeof OUTBOUND_MEDIA_METRIC_ORIGIN;
  callerHeard: false;
  measurementPoint: typeof OUTBOUND_MEDIA_MEASUREMENT_POINT;
  includeInUserTurnLatency: boolean;
  cancelled: boolean;
  eosAtMs: number | null;
  anchorAtMs: number | null;
  providerFirstByteAtMs: number | null;
  firstOutboundMediaAtMs: number;
  provenanceUncertain?: boolean;
  /** Bound without correlating metadata when an explicit mark was pending. */
  attributionAmbiguous?: boolean;
};

type BoundResponse = {
  responseId: string;
  kind: OutboundMediaResponseKind;
  eosAtMs: number | null;
  anchorAtMs: number | null;
  cancelled: boolean;
  providerFirstByteAtMs: number | null;
  outboundMediaLogged: boolean;
  provenanceUncertain: boolean;
  attributionAmbiguous: boolean;
  markId: string | null;
};

type PendingMark = {
  id: string;
  kind: OutboundMediaResponseKind;
  anchorAtMs: number | null;
};

let markSeq = 0;

export class CallOutboundMediaTracker {
  speechStartedAtMs: number | null = null;
  speechStoppedAtMs: number | null = null;
  pendingUserEosAtMs: number | null = null;
  private pendingUserEosUncertain = false;
  private readonly pendingMarks = new Map<string, PendingMark>();
  private readonly byResponse = new Map<string, BoundResponse>();
  private readonly outboundMediaSeen = new Set<string>();
  private readonly providerByteSeen = new Set<string>();
  private readonly terminalResponseIds = new Set<string>();
  private readonly terminalOrder: string[] = [];
  private static readonly MAX_TERMINAL_IDS = 64;

  constructor(private callSid: string) {}

  private markTerminal(responseId: string): void {
    if (this.terminalResponseIds.has(responseId)) return;
    this.terminalResponseIds.add(responseId);
    this.terminalOrder.push(responseId);
    while (this.terminalOrder.length > CallOutboundMediaTracker.MAX_TERMINAL_IDS) {
      const evicted = this.terminalOrder.shift();
      if (evicted) this.terminalResponseIds.delete(evicted);
    }
  }

  getCallSid(): string {
    return this.callSid;
  }

  setCallSid(callSid: string): void {
    this.callSid = callSid;
  }

  onSpeechStarted(nowMs: number): void {
    this.speechStartedAtMs = nowMs;
  }

  onSpeechStopped(nowMs: number): void {
    this.speechStoppedAtMs = nowMs;
    if (this.pendingUserEosAtMs != null) {
      this.pendingUserEosUncertain = true;
    }
    this.pendingUserEosAtMs = nowMs;
  }

  /**
   * Queue an explicit response.create intent. Embed returned id in
   * response.metadata[LOOP9_MARK_METADATA_KEY] so response.created can match.
   */
  markNextResponse(
    kind: OutboundMediaResponseKind,
    anchorAtMs?: number | null,
  ): string {
    const id = `mark_${++markSeq}`;
    this.pendingMarks.set(id, {
      id,
      kind,
      anchorAtMs: anchorAtMs ?? null,
    });
    return id;
  }

  abandonMark(markId: string | null | undefined): void {
    if (!markId) return;
    this.pendingMarks.delete(markId);
  }

  abandonMarksOfKind(kind: OutboundMediaResponseKind): void {
    for (const [id, m] of this.pendingMarks) {
      if (m.kind === kind) this.pendingMarks.delete(id);
    }
  }

  pendingMarkCount(): number {
    return this.pendingMarks.size;
  }

  hasPendingMark(markId: string): boolean {
    return this.pendingMarks.has(markId);
  }

  /**
   * Bind provider response id using metadata correlation when present.
   * Without matching loop9_outbound_mark metadata, never consume a pending
   * explicit mark (automatic creates cannot steal waiting/tool/apology labels).
   */
  onResponseCreated(
    responseId: string | null | undefined,
    opts?: {
      greetingPlaybackActive?: boolean;
      /** response.metadata from response.created (official correlation channel). */
      providerMetadata?: Record<string, unknown> | null;
    },
  ): void {
    if (!responseId) return;
    if (this.terminalResponseIds.has(responseId)) return;
    // Duplicate response.created: keep first binding; do not shift labels.
    if (this.byResponse.has(responseId)) return;

    const meta = opts?.providerMetadata || null;
    const metaMarkId =
      meta && typeof meta[LOOP9_MARK_METADATA_KEY] === 'string'
        ? (meta[LOOP9_MARK_METADATA_KEY] as string)
        : null;

    let mark: PendingMark | null = null;
    let attributionAmbiguous = false;

    if (metaMarkId) {
      mark = this.pendingMarks.get(metaMarkId) ?? null;
      if (mark) {
        this.pendingMarks.delete(metaMarkId);
      } else {
        // Stale/rejected mark id on metadata — do not invent FIFO attribution.
        attributionAmbiguous = true;
      }
    } else if (this.pendingMarks.size > 0) {
      // Automatic (or unmarked) create while an explicit intent is pending:
      // leave marks in place; bind ambiguously (exclude from user-turn latency).
      attributionAmbiguous = true;
    }

    let kind: OutboundMediaResponseKind = 'user_turn_reply';
    if (mark) {
      kind = mark.kind;
    } else if (opts?.greetingPlaybackActive && !metaMarkId) {
      kind = 'greeting';
    }

    if (opts?.greetingPlaybackActive && mark?.kind === 'greeting') {
      kind = 'greeting';
    }

    let eosAtMs: number | null = null;
    let anchorAtMs: number | null = mark?.anchorAtMs ?? null;
    let provenanceUncertain = false;

    if (kind === 'user_turn_reply') {
      if (attributionAmbiguous || this.pendingUserEosUncertain) {
        provenanceUncertain = true;
        attributionAmbiguous = attributionAmbiguous || this.pendingUserEosUncertain;
        eosAtMs = null;
        anchorAtMs = null;
        if (this.pendingUserEosUncertain) {
          this.pendingUserEosAtMs = null;
          this.pendingUserEosUncertain = false;
        }
        // Ambiguous automatic create: do NOT consume pending EOS.
      } else {
        eosAtMs = this.pendingUserEosAtMs;
        this.pendingUserEosAtMs = null;
        anchorAtMs = eosAtMs;
      }
    } else if (kind === 'greeting') {
      eosAtMs = null;
      anchorAtMs = null;
    } else {
      eosAtMs = null;
    }

    this.byResponse.set(responseId, {
      responseId,
      kind,
      eosAtMs,
      anchorAtMs,
      cancelled: false,
      providerFirstByteAtMs: null,
      outboundMediaLogged: false,
      provenanceUncertain,
      attributionAmbiguous,
      markId: mark?.id ?? null,
    });
  }

  onResponseCancelled(responseId: string | null | undefined): void {
    if (!responseId) return;
    const bound = this.byResponse.get(responseId);
    if (bound) bound.cancelled = true;
    this.markTerminal(responseId);
  }

  onResponseTerminal(responseId: string | null | undefined): void {
    if (!responseId) return;
    this.markTerminal(responseId);
    this.byResponse.delete(responseId);
  }

  shouldDropMedia(responseId: string | null | undefined): boolean {
    if (!responseId) return true;
    if (this.terminalResponseIds.has(responseId)) return true;
    const bound = this.byResponse.get(responseId);
    if (!bound) return true;
    if (bound.cancelled) return true;
    return false;
  }

  isTerminal(responseId: string): boolean {
    return this.terminalResponseIds.has(responseId);
  }

  onProviderFirstByte(
    responseId: string | null | undefined,
    nowMs: number,
  ): void {
    if (!responseId) return;
    if (this.providerByteSeen.has(responseId)) return;
    if (this.shouldDropMedia(responseId)) {
      this.providerByteSeen.add(responseId);
      return;
    }

    const bound = this.byResponse.get(responseId);
    if (!bound) {
      this.providerByteSeen.add(responseId);
      return;
    }
    if (bound.providerFirstByteAtMs != null) return;

    bound.providerFirstByteAtMs = nowMs;
    this.providerByteSeen.add(responseId);
  }

  onFirstOutboundMediaEnqueue(
    responseId: string | null | undefined,
    nowMs: number,
  ): OutboundMediaSample | null {
    if (!responseId) return null;
    if (this.outboundMediaSeen.has(responseId)) return null;

    const bound = this.byResponse.get(responseId);
    if (!bound) {
      this.outboundMediaSeen.add(responseId);
      return null;
    }
    if (bound.outboundMediaLogged) return null;

    bound.outboundMediaLogged = true;
    this.outboundMediaSeen.add(responseId);

    const eosAnchored =
      bound.kind === 'user_turn_reply' &&
      !bound.provenanceUncertain &&
      !bound.attributionAmbiguous &&
      bound.eosAtMs != null &&
      Number.isFinite(bound.eosAtMs);

    const eosToFirstOutboundMediaMs = eosAnchored
      ? Math.max(0, nowMs - bound.eosAtMs!)
      : null;
    const eosToProviderFirstByteMs =
      eosAnchored &&
      bound.providerFirstByteAtMs != null &&
      Number.isFinite(bound.providerFirstByteAtMs)
        ? Math.max(0, bound.providerFirstByteAtMs - bound.eosAtMs!)
        : null;

    const nonEosAnchor =
      bound.kind !== 'user_turn_reply' &&
      bound.kind !== 'greeting' &&
      bound.anchorAtMs != null &&
      Number.isFinite(bound.anchorAtMs);
    const anchorToFirstOutboundMediaMs = nonEosAnchor
      ? Math.max(0, nowMs - bound.anchorAtMs!)
      : null;

    const includeInUserTurnLatency =
      bound.kind === 'user_turn_reply' &&
      !bound.cancelled &&
      !bound.provenanceUncertain &&
      !bound.attributionAmbiguous &&
      eosToFirstOutboundMediaMs != null;

    return {
      callSid: this.callSid,
      responseId,
      kind: bound.kind,
      eosToFirstOutboundMediaMs,
      eosToProviderFirstByteMs,
      anchorToFirstOutboundMediaMs,
      metricVersion: OUTBOUND_MEDIA_METRIC_VERSION,
      metricOrigin: OUTBOUND_MEDIA_METRIC_ORIGIN,
      callerHeard: false,
      measurementPoint: OUTBOUND_MEDIA_MEASUREMENT_POINT,
      includeInUserTurnLatency,
      cancelled: bound.cancelled,
      eosAtMs: bound.eosAtMs,
      anchorAtMs: bound.anchorAtMs,
      providerFirstByteAtMs: bound.providerFirstByteAtMs,
      firstOutboundMediaAtMs: nowMs,
      provenanceUncertain: bound.provenanceUncertain,
      attributionAmbiguous: bound.attributionAmbiguous,
    };
  }

  clear(): void {
    this.speechStartedAtMs = null;
    this.speechStoppedAtMs = null;
    this.pendingUserEosAtMs = null;
    this.pendingUserEosUncertain = false;
    this.pendingMarks.clear();
    this.byResponse.clear();
    this.outboundMediaSeen.clear();
    this.providerByteSeen.clear();
    this.terminalResponseIds.clear();
    this.terminalOrder.length = 0;
  }

  boundCount(): number {
    return this.byResponse.size;
  }

  hasBinding(responseId: string): boolean {
    return this.byResponse.has(responseId);
  }

  getBinding(responseId: string): BoundResponse | undefined {
    return this.byResponse.get(responseId);
  }

  isPendingEosUncertain(): boolean {
    return this.pendingUserEosUncertain;
  }

  terminalCount(): number {
    return this.terminalResponseIds.size;
  }
}

export class OutboundMediaMetricsRegistry {
  private readonly trackers = new Map<string, CallOutboundMediaTracker>();

  getOrCreate(callSid: string): CallOutboundMediaTracker {
    let t = this.trackers.get(callSid);
    if (!t) {
      t = new CallOutboundMediaTracker(callSid);
      this.trackers.set(callSid, t);
    }
    return t;
  }

  get(callSid: string): CallOutboundMediaTracker | undefined {
    return this.trackers.get(callSid);
  }

  clearCall(callSid: string): void {
    const t = this.trackers.get(callSid);
    if (t) {
      t.clear();
      this.trackers.delete(callSid);
    }
  }

  remapCall(oldCallSid: string, newCallSid: string): void {
    const t = this.trackers.get(oldCallSid);
    if (!t) return;
    this.trackers.delete(oldCallSid);
    t.setCallSid(newCallSid);
    this.trackers.set(newCallSid, t);
  }

  size(): number {
    return this.trackers.size;
  }
}

export const openaiOutboundMediaMetrics = new OutboundMediaMetricsRegistry();

export function formatOutboundMediaLogMessage(sample: OutboundMediaSample): string {
  const eosOut =
    sample.eosToFirstOutboundMediaMs == null
      ? 'null'
      : String(sample.eosToFirstOutboundMediaMs);
  const eosProv =
    sample.eosToProviderFirstByteMs == null
      ? 'null'
      : String(sample.eosToProviderFirstByteMs);
  const anchorOut =
    sample.anchorToFirstOutboundMediaMs == null
      ? 'null'
      : String(sample.anchorToFirstOutboundMediaMs);
  return (
    `eos_to_first_outbound_media_ms=${eosOut} ` +
    `eos_to_provider_first_byte_ms=${eosProv} ` +
    `anchor_to_first_outbound_media_ms=${anchorOut} ` +
    `kind=${sample.kind} point=${sample.measurementPoint} version=${sample.metricVersion}` +
    (sample.attributionAmbiguous ? ' attribution=ambiguous' : '')
  );
}

/** Build response.metadata for an explicit response.create. */
export function buildOutboundMarkMetadata(
  markId: string,
  kind: OutboundMediaResponseKind,
): Record<string, string> {
  return {
    [LOOP9_MARK_METADATA_KEY]: markId,
    [LOOP9_KIND_METADATA_KEY]: kind,
  };
}
