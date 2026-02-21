'use strict';
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';
import { liveCallRegistry, type LiveCallEvent } from './live-call-registry';

interface MonitoringClient {
  ws: WebSocket;
  userId: string;
  isAdmin: boolean;
  subscribedCallId?: string;
}

class LiveMonitoringWebSocket {
  private clients: Set<MonitoringClient> = new Set();
  private wss: WebSocketServer | null = null;

  setup(httpServer: Server): void {
    httpServer.on('upgrade', (request: IncomingMessage, socket: any, head: Buffer) => {
      const pathname = request.url?.split('?')[0] || '';

      if (pathname !== '/ws/live-monitoring') return;

      if (!this.wss) {
        this.wss = new WebSocketServer({ noServer: true });
      }

      const url = new URL(request.url || '', `http://${request.headers.host}`);
      const userId = url.searchParams.get('userId');
      const isAdmin = url.searchParams.get('isAdmin') === 'true';

      if (!userId) {
        socket.destroy();
        return;
      }

      this.wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        const client: MonitoringClient = { ws, userId, isAdmin };
        this.clients.add(client);
        console.log(`📡 [LiveMonitoring WS] Client connected: ${userId} (admin: ${isAdmin})`);

        const activeCalls = isAdmin
          ? liveCallRegistry.getAllActiveCalls()
          : liveCallRegistry.getActiveCallsForUser(userId);

        ws.send(JSON.stringify({
          type: 'initial_state',
          activeCalls: activeCalls.map(c => ({
            ...c,
            startedAt: c.startedAt.toISOString(),
            answeredAt: c.answeredAt?.toISOString() || null,
            duration: c.duration || Math.floor((Date.now() - c.startedAt.getTime()) / 1000),
          })),
        }));

        ws.on('message', (data: Buffer) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'subscribe_call') {
              client.subscribedCallId = msg.callId;
            } else if (msg.type === 'unsubscribe_call') {
              client.subscribedCallId = undefined;
            }
          } catch (e) {}
        });

        ws.on('close', () => {
          this.clients.delete(client);
          console.log(`📡 [LiveMonitoring WS] Client disconnected: ${userId}`);
        });

        ws.on('error', () => {
          this.clients.delete(client);
        });
      });
    });

    liveCallRegistry.on('call_event', (event: LiveCallEvent) => {
      this.broadcastEvent(event);
    });

    this.startHeartbeat();
    console.log('✅ [LiveMonitoring WS] WebSocket handler initialized');
  }

  private broadcastEvent(event: LiveCallEvent): void {
    const serializedEvent = this.serializeEvent(event);

    this.clients.forEach(client => {
      if (client.ws.readyState !== WebSocket.OPEN) return;

      const shouldReceive = this.shouldClientReceiveEvent(client, event);
      if (!shouldReceive) return;

      try {
        client.ws.send(serializedEvent);
      } catch (e) {
        console.error(`📡 [LiveMonitoring WS] Failed to send to client: ${client.userId}`);
      }
    });
  }

  private shouldClientReceiveEvent(client: MonitoringClient, event: LiveCallEvent): boolean {
    if (client.isAdmin) return true;

    switch (event.type) {
      case 'call_started':
      case 'call_updated':
        return event.call.userId === client.userId;
      case 'call_ended':
      case 'transcript_update':
        return event.userId === client.userId;
      default:
        return false;
    }
  }

  private serializeEvent(event: LiveCallEvent): string {
    if (event.type === 'call_started' || event.type === 'call_updated') {
      return JSON.stringify({
        ...event,
        call: {
          ...event.call,
          startedAt: event.call.startedAt.toISOString(),
          answeredAt: event.call.answeredAt?.toISOString() || null,
          duration: event.call.duration || Math.floor((Date.now() - event.call.startedAt.getTime()) / 1000),
        },
      });
    }
    return JSON.stringify(event);
  }

  private startHeartbeat(): void {
    setInterval(() => {
      this.clients.forEach(client => {
        if (client.ws.readyState === WebSocket.OPEN) {
          try {
            client.ws.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
          } catch (e) {
            this.clients.delete(client);
          }
        } else {
          this.clients.delete(client);
        }
      });
    }, 15000);
  }
}

export const liveMonitoringWs = new LiveMonitoringWebSocket();
