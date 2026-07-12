/**
 * ============================================================
 * Deepgram Voice Agent — Twilio Media Stream websocket handler
 *
 * Accepts the <Connect><Stream> websocket from Twilio for calls
 * staged by the voice webhook, then bridges it to the Deepgram
 * Agent socket. Upgrades for unknown call SIDs are rejected.
 * ============================================================
 */

import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { DeepgramAgentBridge } from '../services/agent-bridge.service';
import { consumePendingSettings } from './webhooks';

let sharedWss: WebSocketServer | null = null;

export function setupDeepgramAgentStreamHandler(httpServer: HttpServer): void {
  if (!sharedWss) {
    sharedWss = new WebSocketServer({ noServer: true });
  }

  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = request.url?.split('?')[0] || '';
    if (!pathname.startsWith('/api/deepgram-agent/stream/')) return;

    const callSid = pathname.split('/api/deepgram-agent/stream/')[1];
    if (!callSid) {
      socket.destroy();
      return;
    }

    sharedWss!.handleUpgrade(request, socket, head, (ws: WebSocket) => {
      handleTwilioStreamConnection(ws, callSid);
    });
  });

  console.log('✅ Deepgram Voice Agent stream endpoint registered');
}

function handleTwilioStreamConnection(twilioWs: WebSocket, callSid: string): void {
  let started = false;

  twilioWs.on('message', (message: Buffer | string) => {
    try {
      const event = JSON.parse(typeof message === 'string' ? message : message.toString());

      if (event.event === 'start' && event.start && !started) {
        const settings = consumePendingSettings(callSid);
        if (!settings) {
          // Not staged by our webhook — reject rather than serve an
          // arbitrary call SID.
          console.error(`[DeepgramAgent Stream] No staged settings for ${callSid}, closing`);
          twilioWs.close();
          return;
        }
        started = true;
        DeepgramAgentBridge.createSession({
          callSid,
          twilioWs,
          streamSid: event.start.streamSid,
          settings,
          apiKey: process.env.DEEPGRAM_API_KEY || '',
        });
        return;
      }

      if (started) {
        DeepgramAgentBridge.handleTwilioEvent(callSid, event);
      }
    } catch (error: any) {
      console.error(`[DeepgramAgent Stream] Message error for ${callSid}: ${error.message}`);
    }
  });

  twilioWs.on('close', () => {
    DeepgramAgentBridge.endSession(callSid);
  });
}
