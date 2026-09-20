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
import { DeepgramAgentBridge, type KBLookupFn } from '../services/agent-bridge.service';
import { consumePendingCall } from './webhooks';
import { RAGKnowledgeService } from '../../../services/rag-knowledge';

/**
 * Build the production KB lookup for a call: search the agent's knowledge
 * bases and format the top results for the agent to speak. Mirrors the
 * Deprock engine's lookup_knowledge_base handler.
 */
function buildKBLookup(userId: string | undefined, knowledgeBaseIds: string[]): KBLookupFn | undefined {
  if (!userId || knowledgeBaseIds.length === 0) return undefined;
  return async (query: string) => {
    const results = await RAGKnowledgeService.searchKnowledge(query, knowledgeBaseIds, userId, 5);
    if (results.length === 0) {
      return 'No exact match found for that query. Try different keywords, or offer the closest option you know about.';
    }
    return RAGKnowledgeService.formatResultsForAgent(results, 1200);
  };
}

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
        const pending = consumePendingCall(callSid);
        if (!pending) {
          // Not staged by our webhook — reject rather than serve an
          // arbitrary call SID.
          console.error(`[DeepgramAgent Stream] No staged call for ${callSid}, closing`);
          twilioWs.close();
          return;
        }
        started = true;
        DeepgramAgentBridge.createSession({
          callSid,
          twilioWs,
          streamSid: event.start.streamSid,
          settings: pending.settings,
          apiKey: process.env.DEEPGRAM_API_KEY || '',
          kbLookup: buildKBLookup(pending.userId, pending.knowledgeBaseIds),
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
