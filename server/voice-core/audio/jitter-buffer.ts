/**
 * ============================================================
 * Voice Core — adaptive jitter buffer
 *
 * Absorbs network jitter and packet reordering on a sequenced audio
 * stream (e.g. WebRTC/RTP-style frames), emitting frames in order at a
 * steady playout cadence. It reorders out-of-order frames, drops
 * duplicates and late arrivals, prebuffers to a target depth, and adapts
 * that depth to the observed jitter. On a gap at playout it signals a
 * loss so the caller can run packet-loss concealment ({@link ./plc}).
 *
 * Pull-based: the playout loop calls pop() once per frame interval.
 * Dependency-free; clock injectable for deterministic tests.
 * ============================================================
 */

export interface JitterPacket<T = Buffer> {
  /** Monotonic frame sequence number. */
  seq: number;
  payload: T;
  /** Arrival time (ms); defaults to the injected clock. */
  arrivedAt?: number;
}

export interface JitterBufferOptions {
  frameMs?: number;
  targetDepthFrames?: number;
  minDepthFrames?: number;
  maxDepthFrames?: number;
  adaptive?: boolean;
  now?: () => number;
}

export interface JitterStats {
  received: number;
  played: number;
  reordered: number;
  duplicates: number;
  lost: number;
  late: number;
  targetDepthFrames: number;
  bufferedFrames: number;
}

export type JitterPop<T> =
  | { lost: false; seq: number; payload: T }
  | { lost: true; seq: number }
  | null;

export class JitterBuffer<T = Buffer> {
  private frames = new Map<number, T>();
  private frameMs: number;
  private minDepth: number;
  private maxDepth: number;
  private targetDepth: number;
  private adaptive: boolean;
  private now: () => number;

  private started = false;
  private nextSeq = 0;
  private highestSeq = -1;
  private lastArrivalAt: number | null = null;
  private jitterEstimateMs = 0;

  private received = 0;
  private played = 0;
  private reordered = 0;
  private duplicates = 0;
  private lost = 0;
  private late = 0;

  constructor(opts: JitterBufferOptions = {}) {
    this.frameMs = opts.frameMs ?? 20;
    this.minDepth = Math.max(1, opts.minDepthFrames ?? 1);
    this.maxDepth = Math.max(this.minDepth, opts.maxDepthFrames ?? 10);
    this.targetDepth = clamp(opts.targetDepthFrames ?? 2, this.minDepth, this.maxDepth);
    this.adaptive = opts.adaptive ?? true;
    this.now = opts.now ?? Date.now;
  }

  /** Insert a frame. Duplicates and already-played (late) frames are dropped. */
  push(packet: JitterPacket<T>): void {
    this.received++;
    const at = packet.arrivedAt ?? this.now();
    this.updateJitter(at);

    // A frame at or before the next-to-play position is too late to use.
    if (this.started && packet.seq < this.nextSeq) {
      this.late++;
      return;
    }
    if (this.frames.has(packet.seq)) {
      this.duplicates++;
      return;
    }
    if (this.highestSeq >= 0 && packet.seq < this.highestSeq) {
      this.reordered++;
    }
    this.frames.set(packet.seq, packet.payload);
    if (packet.seq > this.highestSeq) this.highestSeq = packet.seq;
  }

  /**
   * Pull the next frame for playout. Returns null while prebuffering or on
   * underrun (nothing to play yet). Returns { lost: true } when the expected
   * frame is missing but later frames exist — run PLC for that seq.
   */
  pop(): JitterPop<T> {
    if (!this.started) {
      if (this.frames.size < this.targetDepth) return null; // prebuffering
      this.started = true;
      this.nextSeq = Math.min(...Array.from(this.frames.keys()));
    }

    const expected = this.frames.get(this.nextSeq);
    if (expected !== undefined) {
      this.frames.delete(this.nextSeq);
      const seq = this.nextSeq;
      this.nextSeq++;
      this.played++;
      return { lost: false, seq, payload: expected };
    }

    // Gap at the expected seq. If we hold later frames, conceal and advance;
    // otherwise it's an underrun — wait (return null) rather than skip.
    if (this.frames.size > 0) {
      const seq = this.nextSeq;
      this.nextSeq++;
      this.lost++;
      return { lost: true, seq };
    }
    return null;
  }

  /** Frames currently buffered (not yet played). */
  get depth(): number {
    return this.frames.size;
  }

  stats(): JitterStats {
    return {
      received: this.received,
      played: this.played,
      reordered: this.reordered,
      duplicates: this.duplicates,
      lost: this.lost,
      late: this.late,
      targetDepthFrames: this.targetDepth,
      bufferedFrames: this.frames.size,
    };
  }

  private updateJitter(arrivalAt: number): void {
    if (this.lastArrivalAt !== null) {
      const interArrival = arrivalAt - this.lastArrivalAt;
      // RFC 3550-style smoothed deviation of inter-arrival from the nominal
      // frame period.
      const d = Math.abs(interArrival - this.frameMs);
      this.jitterEstimateMs += (d - this.jitterEstimateMs) / 16;
      if (this.adaptive) {
        const desired = Math.ceil(this.jitterEstimateMs / this.frameMs) + 1;
        this.targetDepth = clamp(desired, this.minDepth, this.maxDepth);
      }
    }
    this.lastArrivalAt = arrivalAt;
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
