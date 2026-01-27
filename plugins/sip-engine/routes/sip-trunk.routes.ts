'use strict';

import type { Express, Request, Response, RequestHandler } from 'express';
import { z } from 'zod';
import { ElevenLabsSipService } from '../services/elevenlabs-sip.service';
import { SIP_PROVIDERS } from '../config/sip-config';

const createTrunkSchema = z.object({
  name: z.string().min(1).max(100),
  provider: z.string().default('generic'),
  sipHost: z.string().min(1),
  sipPort: z.number().int().min(1).max(65535).optional(),
  transport: z.enum(['udp', 'tcp', 'tls']).optional(),
  mediaEncryption: z.enum(['require', 'prefer', 'none']).optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  realm: z.string().optional(),
  codecsAllowed: z.array(z.string()).optional(),
  inboundTransport: z.enum(['udp', 'tcp', 'tls']).optional(),
  inboundPort: z.number().int().min(1).max(65535).optional(),
});

const updateTrunkSchema = createTrunkSchema.partial();

export function setupSipTrunkRoutes(
  app: Express,
  sessionAuth: RequestHandler
): void {
  app.get('/api/sip/providers', sessionAuth, async (req: Request, res: Response) => {
    try {
      const providers = Object.entries(SIP_PROVIDERS).map(([key, config]) => ({
        id: key,
        name: config.displayName,
        description: config.description,
        defaults: {
          port: config.defaultPort,
          transport: config.defaultTransport,
          mediaEncryption: config.defaultMediaEncryption,
          requiresRegistration: config.requiresRegistration,
        },
      }));
      
      res.json(providers);
    } catch (error: any) {
      console.error('[SIP Routes] Get providers error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/sip/trunks', sessionAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const trunks = await ElevenLabsSipService.getUserTrunks(userId);
      res.json(trunks);
    } catch (error: any) {
      console.error('[SIP Routes] Get trunks error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/sip/trunks/:trunkId', sessionAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const trunk = await ElevenLabsSipService.getTrunkById(req.params.trunkId);
      
      if (!trunk) {
        return res.status(404).json({ error: 'Trunk not found' });
      }
      
      if (trunk.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      res.json(trunk);
    } catch (error: any) {
      console.error('[SIP Routes] Get trunk error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/sip/trunks', sessionAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const validation = createTrunkSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
      }
      
      const trunk = await ElevenLabsSipService.createSipTrunk({
        userId,
        ...validation.data,
      });
      
      res.status(201).json(trunk);
    } catch (error: any) {
      console.error('[SIP Routes] Create trunk error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/sip/trunks/:trunkId', sessionAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const existing = await ElevenLabsSipService.getTrunkById(req.params.trunkId);
      
      if (!existing) {
        return res.status(404).json({ error: 'Trunk not found' });
      }
      
      if (existing.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const validation = updateTrunkSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
      }
      
      const trunk = await ElevenLabsSipService.updateSipTrunk(req.params.trunkId, validation.data);
      
      res.json(trunk);
    } catch (error: any) {
      console.error('[SIP Routes] Update trunk error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/sip/trunks/:trunkId', sessionAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const existing = await ElevenLabsSipService.getTrunkById(req.params.trunkId);
      
      if (!existing) {
        return res.status(404).json({ error: 'Trunk not found' });
      }
      
      if (existing.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      await ElevenLabsSipService.deleteSipTrunk(req.params.trunkId);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('[SIP Routes] Delete trunk error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/sip/trunks/:trunkId/health-check', sessionAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const existing = await ElevenLabsSipService.getTrunkById(req.params.trunkId);
      
      if (!existing) {
        return res.status(404).json({ error: 'Trunk not found' });
      }
      
      if (existing.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const result = await ElevenLabsSipService.checkTrunkHealth(req.params.trunkId);
      
      res.json(result);
    } catch (error: any) {
      console.error('[SIP Routes] Health check error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  console.log('[SIP Engine] SIP trunk routes registered');
}
