'use strict';

import type { Express, Request, Response } from 'express';
import { ElevenLabsSipService } from '../services/elevenlabs-sip.service';
import crypto from 'crypto';
import { db } from '../../../server/db';
import { elevenLabsCredentials } from '../../../shared/schema';
import { eq, and } from 'drizzle-orm';

type RawBodyRequest = Request & {
  rawBody?: Buffer;
};

function verifyElevenLabsSignature(
  payload: string,
  signature: string,
  webhookSecret: string
): boolean {
  if (!signature || !webhookSecret || !payload) {
    return false;
  }
  
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

async function verifyWebhookSignature(req: RawBodyRequest): Promise<{ isVerified: boolean; error?: string }> {
  const signature = req.headers['x-elevenlabs-signature'] as string;
  const rawBody = req.rawBody;
  const strictVerification = process.env.SIP_WEBHOOK_STRICT_VERIFICATION === 'true';
  
  if (!rawBody || rawBody.length === 0) {
    if (strictVerification) {
      return { isVerified: false, error: 'Missing request body' };
    }
    console.warn('[SIP Webhook] Empty raw body, using JSON.stringify fallback');
    return { isVerified: false };
  }
  
  const rawPayload = rawBody.toString('utf8');
  
  if (!signature) {
    if (strictVerification) {
      return { isVerified: false, error: 'Missing signature' };
    }
    console.warn('[SIP Webhook] No signature provided, processing anyway (strict mode disabled)');
    return { isVerified: false };
  }
  
  const [credential] = await db
    .select()
    .from(elevenLabsCredentials)
    .where(and(eq(elevenLabsCredentials.isActive, true), eq(elevenLabsCredentials.isPrimary, true)))
    .limit(1);
  
  if (!credential?.webhookSecret) {
    if (strictVerification) {
      return { isVerified: false, error: 'Webhook secret not configured' };
    }
    console.warn('[SIP Webhook] No webhook secret configured, processing anyway (strict mode disabled)');
    return { isVerified: false };
  }
  
  const isVerified = verifyElevenLabsSignature(rawPayload, signature, credential.webhookSecret);
  
  if (!isVerified) {
    if (strictVerification) {
      return { isVerified: false, error: 'Signature verification failed' };
    }
    console.warn('[SIP Webhook] Signature verification failed, processing anyway (strict mode disabled)');
  }
  
  return { isVerified };
}

export function setupSipWebhookRoutes(app: Express): void {
  app.post('/api/sip/webhooks/elevenlabs/conversation-status', async (req: RawBodyRequest, res: Response) => {
    try {
      const verification = await verifyWebhookSignature(req);
      
      if (verification.error) {
        console.error(`[SIP Webhook] ${verification.error}`);
        return res.status(401).json({ error: verification.error });
      }
      
      const {
        conversation_id,
        event_type,
        status,
        duration,
        transcript,
      } = req.body;
      
      if (!conversation_id) {
        console.warn('[SIP Webhook] Missing conversation_id');
        return res.status(400).json({ error: 'Missing conversation_id' });
      }
      
      console.log(`[SIP Webhook] Received ${event_type} for conversation ${conversation_id}`);
      
      if (event_type === 'conversation.status_update' || event_type === 'conversation.ended') {
        await ElevenLabsSipService.handleCallWebhook({
          conversationId: conversation_id,
          status: status || (event_type === 'conversation.ended' ? 'completed' : 'in-progress'),
          duration,
          transcript,
        });
      }
      
      res.json({ received: true });
    } catch (error: any) {
      console.error('[SIP Webhook] Error processing webhook:', error);
      res.status(200).json({ received: true, error: error.message });
    }
  });

  app.post('/api/sip/webhooks/elevenlabs/inbound-call', async (req: RawBodyRequest, res: Response) => {
    try {
      const verification = await verifyWebhookSignature(req);
      
      if (verification.error) {
        console.error(`[SIP Webhook] ${verification.error}`);
        return res.status(401).json({ error: verification.error });
      }
      
      const {
        conversation_id,
        agent_id,
        phone_number_id,
        caller_phone_number,
        called_phone_number,
      } = req.body;
      
      console.log(`[SIP Webhook] Inbound call received: ${caller_phone_number} -> ${called_phone_number}`);
      
      res.json({
        received: true,
        conversation_id,
      });
    } catch (error: any) {
      console.error('[SIP Webhook] Inbound call error:', error);
      res.status(200).json({ received: true, error: error.message });
    }
  });

  app.post('/api/sip/webhooks/elevenlabs/call-ended', async (req: RawBodyRequest, res: Response) => {
    try {
      const verification = await verifyWebhookSignature(req);
      
      if (verification.error) {
        console.error(`[SIP Webhook] ${verification.error}`);
        return res.status(401).json({ error: verification.error });
      }
      
      const {
        conversation_id,
        duration,
        transcript,
        summary,
        sentiment,
        call_outcome,
      } = req.body;
      
      console.log(`[SIP Webhook] Call ended: ${conversation_id}, duration: ${duration}s`);
      
      await ElevenLabsSipService.handleCallWebhook({
        conversationId: conversation_id,
        status: 'completed',
        duration,
        transcript: {
          messages: transcript,
          summary,
          sentiment,
          call_outcome,
        },
      });
      
      res.json({ received: true });
    } catch (error: any) {
      console.error('[SIP Webhook] Call ended error:', error);
      res.status(200).json({ received: true, error: error.message });
    }
  });

  app.get('/api/sip/webhooks/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      endpoints: [
        '/api/sip/webhooks/elevenlabs/conversation-status',
        '/api/sip/webhooks/elevenlabs/inbound-call',
        '/api/sip/webhooks/elevenlabs/call-ended',
      ],
    });
  });

  console.log('[SIP Engine] SIP webhook routes registered');
}
