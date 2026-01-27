'use strict';

import type { Express, Request, Response, RequestHandler } from 'express';
import { z } from 'zod';
import { TcxcApiService } from '../services/tcxc-api.service';

const createCredentialSchema = z.object({
  name: z.string().min(1),
  apiLogin: z.string().min(1),
  apiKey: z.string().min(1),
  apiEndpoint: z.string().url().optional(),
  isPrimary: z.boolean().optional(),
});

const updateCredentialSchema = z.object({
  name: z.string().min(1).optional(),
  apiLogin: z.string().min(1).optional(),
  apiKey: z.string().min(1).optional(),
  apiEndpoint: z.string().url().optional(),
  isPrimary: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export function setupTcxcRoutes(
  app: Express,
  sessionAuth: RequestHandler,
  adminAuth: RequestHandler
): void {
  app.get('/api/tcxc/credentials', adminAuth, async (req: Request, res: Response) => {
    try {
      const credentials = await TcxcApiService.getAllCredentials();
      const sanitized = credentials.map(c => ({
        ...c,
        apiKey: c.apiKey ? '••••••••' + c.apiKey.slice(-4) : null,
      }));
      res.json(sanitized);
    } catch (error: any) {
      console.error('[TCXC Routes] Get credentials error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/tcxc/credentials', adminAuth, async (req: Request, res: Response) => {
    try {
      const validation = createCredentialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
      }

      const credential = await TcxcApiService.createCredential(validation.data);
      res.status(201).json({
        ...credential,
        apiKey: '••••••••' + credential.apiKey.slice(-4),
      });
    } catch (error: any) {
      console.error('[TCXC Routes] Create credential error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/tcxc/credentials/:id', adminAuth, async (req: Request, res: Response) => {
    try {
      const validation = updateCredentialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
      }

      const updated = await TcxcApiService.updateCredential(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ error: 'Credential not found' });
      }

      res.json({
        ...updated,
        apiKey: '••••••••' + updated.apiKey.slice(-4),
      });
    } catch (error: any) {
      console.error('[TCXC Routes] Update credential error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/tcxc/credentials/:id', adminAuth, async (req: Request, res: Response) => {
    try {
      await TcxcApiService.deleteCredential(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[TCXC Routes] Delete credential error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/tcxc/test-connection', adminAuth, async (req: Request, res: Response) => {
    try {
      const result = await TcxcApiService.testConnection();
      res.json(result);
    } catch (error: any) {
      console.error('[TCXC Routes] Test connection error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/tcxc/dids/available', sessionAuth, async (req: Request, res: Response) => {
    try {
      const { countryCode, type, limit, offset } = req.query;
      const dids = await TcxcApiService.getAvailableDids({
        countryCode: countryCode as string,
        type: type as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.json(dids);
    } catch (error: any) {
      console.error('[TCXC Routes] Get available DIDs error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/tcxc/dids/gcc', sessionAuth, async (req: Request, res: Response) => {
    try {
      const dids = await TcxcApiService.getGccDids();
      res.json(dids);
    } catch (error: any) {
      console.error('[TCXC Routes] Get GCC DIDs error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/tcxc/dids/my', sessionAuth, async (req: Request, res: Response) => {
    try {
      const dids = await TcxcApiService.getMyDids();
      res.json(dids);
    } catch (error: any) {
      console.error('[TCXC Routes] Get my DIDs error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/tcxc/interconnections', sessionAuth, async (req: Request, res: Response) => {
    try {
      const interconnections = await TcxcApiService.getInterconnections();
      res.json(interconnections);
    } catch (error: any) {
      console.error('[TCXC Routes] Get interconnections error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/tcxc/dids/purchase', sessionAuth, async (req: Request, res: Response) => {
    try {
      const { didId } = req.body;
      if (!didId) {
        return res.status(400).json({ error: 'didId is required' });
      }
      const result = await TcxcApiService.purchaseDid(didId);
      res.json(result);
    } catch (error: any) {
      console.error('[TCXC Routes] Purchase DID error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/tcxc/countries/gcc', (req: Request, res: Response) => {
    res.json(TcxcApiService.getGccCountries());
  });

  console.log('[SIP Engine] TCXC routes registered');
}
