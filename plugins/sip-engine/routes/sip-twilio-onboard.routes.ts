'use strict';

import type { Express, Request, Response, RequestHandler } from 'express';
import { z } from 'zod';
import { ElevenLabsSipService } from '../services/elevenlabs-sip.service';
import { getTwilioClient } from '../../../server/services/twilio-connector';

const connectSchema = z.object({
  trunkName: z.string().min(1).max(100),
  sipHost: z.string().min(1),
  sipPort: z.number().int().min(1).max(65535).default(5061),
  transport: z.enum(['udp', 'tcp', 'tls']).default('tls'),
  mediaEncryption: z.enum(['require', 'prefer', 'none']).default('require'),
  phoneNumbers: z.array(z.object({
    phoneNumber: z.string().min(1),
    friendlyName: z.string().optional(),
    manual: z.boolean().optional(),
  })).min(1).max(100),
});

export function setupSipTwilioOnboardRoutes(
  app: Express,
  sessionAuth: RequestHandler
): void {
  app.get('/api/sip/twilio/list-numbers', sessionAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      try {
        const client = await getTwilioClient();
        const numbers = await client.incomingPhoneNumbers.list({ limit: 100 });

        const phoneNumbers = numbers.map((num: any) => ({
          sid: num.sid,
          phoneNumber: num.phoneNumber,
          friendlyName: num.friendlyName,
          country: num.isoCountry || null,
          capabilities: {
            voice: num.capabilities?.voice ?? false,
            sms: num.capabilities?.sms ?? false,
            mms: num.capabilities?.mms ?? false,
          },
        }));

        res.json({ phoneNumbers, total: phoneNumbers.length });
      } catch (twilioError: any) {
        if (twilioError.status === 401 || twilioError.code === 20003) {
          return res.status(500).json({ error: 'Twilio credentials are not configured properly. Please contact your administrator.' });
        }
        throw twilioError;
      }
    } catch (error: any) {
      console.error('[SIP Twilio Onboard] List numbers error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/sip/twilio/connect', sessionAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const validation = connectSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
      }

      const { trunkName, sipHost, sipPort, transport, mediaEncryption, phoneNumbers } = validation.data;

      const twilioNumbers = phoneNumbers.filter(p => !p.manual);
      if (twilioNumbers.length > 0) {
        try {
          const client = await getTwilioClient();
          const ownedNumbers = await client.incomingPhoneNumbers.list({ limit: 200 });
          const ownedSet = new Set(ownedNumbers.map((n: any) => n.phoneNumber));
          const unowned = twilioNumbers.filter(p => !ownedSet.has(p.phoneNumber));
          if (unowned.length > 0) {
            return res.status(400).json({
              error: `The following numbers are not found on the Twilio account: ${unowned.map(p => p.phoneNumber).join(', ')}`,
            });
          }
        } catch (twilioError: any) {
          if (twilioError.status === 401 || twilioError.code === 20003) {
            return res.status(500).json({ error: 'Twilio credentials are not configured properly. Please contact your administrator.' });
          }
          return res.status(500).json({ error: 'Failed to verify phone number ownership with Twilio' });
        }
      }

      const trunk = await ElevenLabsSipService.createSipTrunk({
        userId,
        name: trunkName,
        provider: 'twilio',
        sipHost,
        sipPort,
        transport,
        mediaEncryption,
      });

      const results: Array<{ phoneNumber: string; success: boolean; error?: string; id?: string }> = [];

      for (const phone of phoneNumbers) {
        try {
          const created = await ElevenLabsSipService.addPhoneNumber({
            userId,
            sipTrunkId: trunk.id,
            phoneNumber: phone.phoneNumber,
            label: phone.friendlyName || phone.phoneNumber,
          });
          results.push({ phoneNumber: phone.phoneNumber, success: true, id: created.id });
        } catch (err: any) {
          results.push({ phoneNumber: phone.phoneNumber, success: false, error: err.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      res.json({
        success: true,
        trunk: {
          id: trunk.id,
          name: trunk.name,
          sipHost: trunk.sipHost,
          sipPort: trunk.sipPort,
          transport: trunk.transport,
        },
        imported: successCount,
        failed: failCount,
        results,
      });
    } catch (error: any) {
      console.error('[SIP Twilio Onboard] Connect error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  console.log('[SIP Engine] Twilio SIP onboarding routes registered');
}
