'use strict';
import { EventEmitter } from 'events';

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
}

export type LiveCallEvent = 
  | { type: 'call_started'; call: LiveCall }
  | { type: 'call_updated'; call: LiveCall }
  | { type: 'call_ended'; callId: string; userId: string }
  | { type: 'transcript_update'; callId: string; userId: string; message: string; role: 'agent' | 'caller' };

class LiveCallRegistry extends EventEmitter {
  private activeCalls: Map<string, LiveCall> = new Map();
  private durationIntervals: Map<string, NodeJS.Timeout> = new Map();

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
}

export const liveCallRegistry = new LiveCallRegistry();
