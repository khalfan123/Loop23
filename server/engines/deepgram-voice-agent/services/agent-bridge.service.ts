/**
 * ============================================================
 * Deepgram Voice Agent — Twilio audio bridge
 *
 * Bridges a Twilio Media Stream websocket to the Deepgram Agent
 * websocket (Flux listening + think-model + Aura-2 speaking, all
 * orchestrated Deepgram-side). Audio is mulaw/8000 in both
 * directions, so payloads relay without transcoding:
 *
 *   Twilio media (base64) ── binary ──▶ Deepgram Agent
 *   Deepgram binary audio ── base64 ──▶ Twilio media
 *
 * Server events handled: ConversationText (transcript log),
 * UserStartedSpeaking (barge-in → Twilio `clear`), Error/Warning.
 * A KeepAlive is sent while the caller is silent so Deepgram
 * doesn't drop an idle socket.
 * ============================================================
 */

import WebSocket from 'ws';
import { DEEPGRAM_AGENT_URL, type DeepgramAgentSettings } from '../config/settings';

const KEEPALIVE_INTERVAL_MS = 8000;

export interface DeepgramAgentSessionParams {
  callSid: string;
  twilioWs: WebSocket;
  streamSid: string;
  settings: DeepgramAgentSettings;
  apiKey: string;
  /** Receives each ConversationText event (role + content). */
  onTranscript?: (role: 'user' | 'assistant', content: string) => void;
  onClose?: () => void;
}

interface DeepgramAgentSession {
  callSid: string;
  twilioWs: WebSocket;
  streamSid: string;
  dgWs: WebSocket;
  keepAlive: ReturnType<typeof setInterval>;
  transcript: { role: string; content: string; at: number }[];
}

const sessions: Map<string, DeepgramAgentSession> = new Map();

export class DeepgramAgentBridge {
  static createSession(params: DeepgramAgentSessionParams): void {
    const { callSid, twilioWs, streamSid, settings, apiKey } = params;

    const dgWs = new WebSocket(DEEPGRAM_AGENT_URL, {
      headers: { Authorization: `Token ${apiKey}` },
    });

    const session: DeepgramAgentSession = {
      callSid,
      twilioWs,
      streamSid,
      dgWs,
      keepAlive: setInterval(() => {
        if (dgWs.readyState === WebSocket.OPEN) {
          dgWs.send(JSON.stringify({ type: 'KeepAlive' }));
        }
      }, KEEPALIVE_INTERVAL_MS),
      transcript: [],
    };
    sessions.set(callSid, session);

    dgWs.on('open', () => {
      console.log(`[DeepgramAgent] Socket open for ${callSid}, sending Settings`);
      dgWs.send(JSON.stringify(settings));
    });

    dgWs.on('message', (data: Buffer, isBinary: boolean) => {
      if (isBinary) {
        // Agent speech audio (mulaw/8000) → Twilio media frame
        if (twilioWs.readyState === WebSocket.OPEN) {
          twilioWs.send(JSON.stringify({
            event: 'media',
            streamSid,
            media: { payload: data.toString('base64') },
          }));
        }
        return;
      }
      this.handleAgentEvent(session, data.toString(), params);
    });

    dgWs.on('error', (err) => {
      console.error(`[DeepgramAgent] Socket error for ${callSid}: ${err.message}`);
    });

    dgWs.on('close', (code) => {
      console.log(`[DeepgramAgent] Socket closed for ${callSid} (${code})`);
      this.endSession(callSid);
      params.onClose?.();
    });
  }

  /** Twilio Media Stream events for an active session. */
  static handleTwilioEvent(callSid: string, event: { event: string; media?: { payload: string } }): void {
    const session = sessions.get(callSid);
    if (!session) return;

    if (event.event === 'media' && event.media?.payload) {
      if (session.dgWs.readyState === WebSocket.OPEN) {
        session.dgWs.send(Buffer.from(event.media.payload, 'base64'));
      }
      return;
    }
    if (event.event === 'stop') {
      this.endSession(callSid);
    }
  }

  static getTranscript(callSid: string): { role: string; content: string; at: number }[] {
    return sessions.get(callSid)?.transcript ?? [];
  }

  static endSession(callSid: string): void {
    const session = sessions.get(callSid);
    if (!session) return;
    sessions.delete(callSid);
    clearInterval(session.keepAlive);
    if (session.dgWs.readyState === WebSocket.OPEN || session.dgWs.readyState === WebSocket.CONNECTING) {
      try { session.dgWs.close(); } catch { /* already closing */ }
    }
  }

  private static handleAgentEvent(
    session: DeepgramAgentSession,
    raw: string,
    params: DeepgramAgentSessionParams
  ): void {
    let event: any;
    try {
      event = JSON.parse(raw);
    } catch {
      console.warn(`[DeepgramAgent] Non-JSON text frame for ${session.callSid}: ${raw.substring(0, 120)}`);
      return;
    }

    switch (event.type) {
      case 'Welcome':
      case 'SettingsApplied':
        console.log(`[DeepgramAgent] ${event.type} for ${session.callSid}`);
        break;
      case 'ConversationText': {
        const role = event.role === 'assistant' ? 'assistant' : 'user';
        session.transcript.push({ role, content: event.content ?? '', at: Date.now() });
        console.log(`[DeepgramAgent] ${role} (${session.callSid}): ${(event.content ?? '').substring(0, 160)}`);
        params.onTranscript?.(role, event.content ?? '');
        break;
      }
      case 'UserStartedSpeaking':
        // Barge-in: stop whatever Twilio is still playing out.
        if (session.twilioWs.readyState === WebSocket.OPEN) {
          session.twilioWs.send(JSON.stringify({ event: 'clear', streamSid: session.streamSid }));
        }
        break;
      case 'AgentThinking':
      case 'AgentStartedSpeaking':
      case 'AgentAudioDone':
        break;
      case 'Warning':
        console.warn(`[DeepgramAgent] Warning for ${session.callSid}: ${event.description ?? raw}`);
        break;
      case 'Error':
        console.error(`[DeepgramAgent] Error for ${session.callSid}: ${event.description ?? raw}`);
        break;
      default:
        console.log(`[DeepgramAgent] Unhandled event ${event.type} for ${session.callSid}`);
    }
  }
}
