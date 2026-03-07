'use strict';
import { EventEmitter } from 'events';
import { db } from '../db';
import { calls, twilioOpenaiCalls, plivoCalls } from '../../shared/schema';
import { eq, and, lt, sql, inArray } from 'drizzle-orm';

export interface LiveCall {
  callId: string;
  userId: string;
  twilioCallSid?: string;
  plivoCallUuid?: string;
  direction: 'inbound' | 'outbound';
  status: 'initiated' | 'ringing' | 'in-progress' | 'completed' | 'failed' | 'no-answer' | 'busy' | 'canceled';
  fromNumber?: string;
  toNumber?: string;
  agentId?: string;
  agentName?: string;
  campaignId?: string;
  campaignName?: string;
  contactId?: string;
  contactName?: string;
  engine: 'twilio-elevenlabs' | 'twilio-openai' | 'twilio-bedrock-polly' | 'plivo-openai' | 'plivo-elevenlabs' | 'sip';
  startedAt: Date;
  answeredAt?: Date;
  duration?: number;
  transcript?: string[];
  metadata?: Record<string, unknown>;
  sentimentLevel?: 'positive' | 'neutral' | 'cautious' | 'negative' | 'critical';
  sentimentScore?: number;
  sentimentAlert?: boolean;
  sentimentReason?: string | null;
}

export type LiveCallEvent = 
  | { type: 'call_started'; call: LiveCall }
  | { type: 'call_updated'; call: LiveCall }
  | { type: 'call_ended'; callId: string; userId: string }
  | { type: 'transcript_update'; callId: string; userId: string; message: string; role: 'agent' | 'caller' }
  | { type: 'sentiment_alert'; callId: string; userId: string; sentimentLevel: string; sentimentScore: number; sentimentReason: string | null; call: LiveCall };

const STALE_CALL_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const STALE_CALL_CHECK_INTERVAL_MS = 60 * 1000;

class LiveCallRegistry extends EventEmitter {
  private activeCalls: Map<string, LiveCall> = new Map();
  private durationIntervals: Map<string, NodeJS.Timeout> = new Map();
  private staleCleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startStaleCallCleanup();
  }

  registerCall(call: LiveCall): void {
    this.activeCalls.set(call.callId, { ...call });
    this.startDurationTracker(call.callId);
    this.emit('call_event', { type: 'call_started', call: { ...call } } as LiveCallEvent);
    console.log(`📞 [LiveRegistry] Call registered: ${call.callId} (${call.direction}, ${call.engine})`);
  }

  updateCall(callId: string, updates: Partial<LiveCall>): void {
    const existing = this.activeCalls.get(callId);
    if (!existing) {
      console.log(`📞 [LiveRegistry] updateCall skipped - call not found: ${callId}`);
      return;
    }

    const updated = { ...existing, ...updates };
    this.activeCalls.set(callId, updated);

    if (updates.status && ['completed', 'failed', 'no-answer', 'busy', 'canceled'].includes(updates.status)) {
      this.endCall(callId);
      return;
    }

    this.emit('call_event', { type: 'call_updated', call: { ...updated } } as LiveCallEvent);
  }

  addTranscriptMessage(callId: string, message: string, role: 'agent' | 'caller'): void {
    const existing = this.activeCalls.get(callId);
    if (!existing) return;

    if (!existing.transcript) {
      existing.transcript = [];
    }
    existing.transcript.push(`[${role}] ${message}`);
    this.activeCalls.set(callId, existing);

    this.emit('call_event', {
      type: 'transcript_update',
      callId,
      userId: existing.userId,
      message,
      role,
    } as LiveCallEvent);
  }

  updateSentiment(callId: string, level: string, score: number, alert: boolean, reason: string | null): void {
    const existing = this.activeCalls.get(callId);
    if (!existing) return;

    existing.sentimentLevel = level as LiveCall['sentimentLevel'];
    existing.sentimentScore = score;
    this.activeCalls.set(callId, existing);

    if (alert && !existing.sentimentAlert) {
      existing.sentimentAlert = true;
      existing.sentimentReason = reason;
      this.activeCalls.set(callId, existing);

      this.emit('call_event', {
        type: 'sentiment_alert',
        callId,
        userId: existing.userId,
        sentimentLevel: level,
        sentimentScore: score,
        sentimentReason: reason,
        call: { ...existing },
      } as LiveCallEvent);
      console.log(`🚨 [LiveRegistry] Sentiment alert for ${callId}: ${level} (score: ${score}) — ${reason}`);
    }
  }

  getFlaggedCalls(): LiveCall[] {
    return Array.from(this.activeCalls.values())
      .filter(call => call.sentimentAlert === true)
      .sort((a, b) => (a.sentimentScore || 0) - (b.sentimentScore || 0));
  }

  endCall(callId: string): void {
    const existing = this.activeCalls.get(callId);
    if (!existing) return;

    this.stopDurationTracker(callId);
    const userId = existing.userId;
    this.activeCalls.delete(callId);
    this.emit('call_event', { type: 'call_ended', callId, userId } as LiveCallEvent);
    console.log(`📞 [LiveRegistry] Call ended: ${callId}`);
  }

  getActiveCallsForUser(userId: string): LiveCall[] {
    return Array.from(this.activeCalls.values())
      .filter(call => call.userId === userId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  getAllActiveCalls(): LiveCall[] {
    return Array.from(this.activeCalls.values())
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  getCall(callId: string): LiveCall | undefined {
    return this.activeCalls.get(callId);
  }

  getActiveCallCount(userId?: string): number {
    if (userId) {
      return Array.from(this.activeCalls.values()).filter(c => c.userId === userId).length;
    }
    return this.activeCalls.size;
  }

  endCallByTwilioSid(callSid: string): void {
    const entries = Array.from(this.activeCalls.entries());
    for (let i = 0; i < entries.length; i++) {
      const [callId, call] = entries[i];
      if (call.twilioCallSid === callSid) {
        this.endCall(callId);
        return;
      }
    }
    console.log(`📞 [LiveRegistry] endCallByTwilioSid skipped - no call found for SID: ${callSid}`);
  }

  endCallByPlivoUuid(callUuid: string): void {
    const entries = Array.from(this.activeCalls.entries());
    for (let i = 0; i < entries.length; i++) {
      const [callId, call] = entries[i];
      if (call.plivoCallUuid === callUuid || callId === callUuid) {
        this.endCall(callId);
        return;
      }
    }
    console.log(`📞 [LiveRegistry] endCallByPlivoUuid skipped - no call found for UUID: ${callUuid}`);
  }

  private startDurationTracker(callId: string): void {
    const interval = setInterval(() => {
      const call = this.activeCalls.get(callId);
      if (!call) {
        this.stopDurationTracker(callId);
        return;
      }
      call.duration = Math.floor((Date.now() - call.startedAt.getTime()) / 1000);
    }, 1000);
    this.durationIntervals.set(callId, interval);
  }

  private stopDurationTracker(callId: string): void {
    const interval = this.durationIntervals.get(callId);
    if (interval) {
      clearInterval(interval);
      this.durationIntervals.delete(callId);
    }
  }

  private startStaleCallCleanup(): void {
    this.staleCleanupInterval = setInterval(() => {
      const now = Date.now();
      const entries = Array.from(this.activeCalls.entries());
      for (let i = 0; i < entries.length; i++) {
        const [callId, call] = entries[i];
        const age = now - call.startedAt.getTime();
        if (age > STALE_CALL_MAX_AGE_MS) {
          console.log(`📞 [LiveRegistry] Auto-removing stale call ${callId} (age: ${Math.round(age / 60000)}min)`);
          this.endCall(callId);
        }
      }

      this.cleanupStaleDbCalls().catch((err) => {
        console.error(`📞 [LiveRegistry] DB stale call cleanup error:`, err.message);
      });
    }, STALE_CALL_CHECK_INTERVAL_MS);
  }

  private async cleanupStaleDbCalls(): Promise<void> {
    const cutoff = new Date(Date.now() - STALE_CALL_MAX_AGE_MS);

    const result1 = await db
      .update(calls)
      .set({
        status: 'completed',
        endedAt: sql`COALESCE(${calls.endedAt}, NOW())`,
      })
      .where(
        and(
          inArray(calls.status, ['in-progress', 'ringing', 'initiated']),
          lt(calls.createdAt, cutoff)
        )
      );

    const result2 = await db
      .update(twilioOpenaiCalls)
      .set({
        status: 'completed',
        endedAt: sql`COALESCE(${twilioOpenaiCalls.endedAt}, NOW())`,
      })
      .where(
        and(
          inArray(twilioOpenaiCalls.status, ['in-progress', 'ringing', 'initiated']),
          lt(twilioOpenaiCalls.createdAt, cutoff)
        )
      );

    const result3 = await db
      .update(plivoCalls)
      .set({
        status: 'completed',
        endedAt: sql`COALESCE(${plivoCalls.endedAt}, NOW())`,
      })
      .where(
        and(
          inArray(plivoCalls.status, ['in-progress', 'ringing', 'initiated']),
          lt(plivoCalls.createdAt, cutoff)
        )
      );
  }
}

export const liveCallRegistry = new LiveCallRegistry();
