/**
 * ============================================================
 * Deepgram Voice Agent — Twilio voice webhook
 *
 * v1 wiring: point a Twilio number's voice webhook at
 *   POST /api/deepgram-agent/voice/incoming?agentId=<id>
 * The webhook validates the Twilio signature, checks the
 * Deepgram key, stages the agent's Settings for the stream
 * handler, and returns <Connect><Stream> TwiML.
 * ============================================================
 */

import { Router, type Request, type RequestHandler, type Response } from 'express';
import { validateTwilioWebhook } from '../../../middleware/webhookValidation';
import { buildAgentSettings, type DeepgramAgentSettings } from '../config/settings';

export interface DeepgramAgentDescriptor {
  systemPrompt: string;
  greeting?: string | null;
}

export interface DeepgramAgentWebhookDeps {
  loadAgent: (agentId: string) => Promise<DeepgramAgentDescriptor | null>;
}

/** Settings staged by the webhook, consumed once by the stream handler. */
const pendingSettings: Map<string, DeepgramAgentSettings> = new Map();

export function consumePendingSettings(callSid: string): DeepgramAgentSettings | undefined {
  const settings = pendingSettings.get(callSid);
  pendingSettings.delete(callSid);
  return settings;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function createDeepgramAgentWebhookRoutes(deps: DeepgramAgentWebhookDeps): Router {
  const router = Router();

  router.post(
    '/voice/incoming',
    validateTwilioWebhook as unknown as RequestHandler,
    async (req: Request, res: Response) => {
      try {
        if (!process.env.DEEPGRAM_API_KEY) {
          console.error('[DeepgramAgent] DEEPGRAM_API_KEY not configured — rejecting call');
          return res.status(503).type('text/xml').send(
            '<?xml version="1.0" encoding="UTF-8"?><Response><Say>This service is not configured yet. Goodbye.</Say><Hangup/></Response>'
          );
        }

        const callSid = (req.body?.CallSid as string) || '';
        const agentId = (req.query.agentId as string) || '';
        if (!callSid || !agentId) {
          return res.status(400).type('text/xml').send(
            '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Invalid request.</Say><Hangup/></Response>'
          );
        }

        const agent = await deps.loadAgent(agentId);
        if (!agent) {
          return res.status(404).type('text/xml').send(
            '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Agent not found.</Say><Hangup/></Response>'
          );
        }

        pendingSettings.set(callSid, buildAgentSettings({
          systemPrompt: agent.systemPrompt,
          greeting: agent.greeting,
        }));

        const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol;
        const host = ((req.headers['x-forwarded-host'] as string) || req.get('host') || '').split(',')[0].trim();
        const streamUrl = `${protocol === 'http' ? 'ws' : 'wss'}://${host}/api/deepgram-agent/stream/${callSid}`;

        console.log(`[DeepgramAgent] Incoming call ${callSid} for agent ${agentId} → ${streamUrl}`);
        res.type('text/xml').send(
          `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="${escapeXml(streamUrl)}" /></Connect></Response>`
        );
      } catch (error: any) {
        console.error(`[DeepgramAgent] Webhook error: ${error.message}`);
        res.status(500).type('text/xml').send(
          '<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred.</Say><Hangup/></Response>'
        );
      }
    }
  );

  return router;
}
