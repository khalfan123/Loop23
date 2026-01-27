'use strict';

import type { Express, Request, Response, RequestHandler } from 'express';
import { z } from 'zod';
import { TcxcApiService } from '../services/tcxc-api.service';
import { db } from '../../../server/db';
import { providerCallerIds } from '../../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

const createCredentialSchema = z.object({
  name: z.string().min(1),
  apiLogin: z.string().min(1),
  apiKey: z.string().min(1),
  apiEndpoint: z.string().url().optional(),
  isPrimary: z.boolean().optional(),
  techPrefixes: z.array(z.string()).optional(),
  connectionType: z.enum(['tcxc', 'softswitch']).optional(),
  sipServer: z.string().optional(),
  sipPort: z.number().optional(),
});

const updateCredentialSchema = z.object({
  name: z.string().min(1).optional(),
  apiLogin: z.string().min(1).optional(),
  apiKey: z.string().min(1).optional(),
  apiEndpoint: z.string().url().optional(),
  isPrimary: z.boolean().optional(),
  isActive: z.boolean().optional(),
  techPrefixes: z.array(z.string()).optional(),
  connectionType: z.enum(['tcxc', 'softswitch']).optional(),
  sipServer: z.string().optional(),
  sipPort: z.number().optional(),
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

  // User-facing endpoint to check if TCXC is configured (doesn't expose credentials)
  app.get('/api/tcxc/status', sessionAuth, async (req: Request, res: Response) => {
    try {
      const credentials = await TcxcApiService.getAllCredentials();
      const hasHealthyCredential = credentials.some(c => c.isActive && c.healthStatus === 'healthy');
      const hasAnyCredential = credentials.some(c => c.isActive);
      res.json({ 
        configured: hasAnyCredential,
        healthy: hasHealthyCredential,
        credentialCount: credentials.filter(c => c.isActive).length
      });
    } catch (error: any) {
      console.error('[TCXC Routes] Get status error:', error);
      res.status(500).json({ configured: false, healthy: false, credentialCount: 0 });
    }
  });

  // User-facing endpoint to get interconnections (tech prefixes, routing info) without exposing API keys
  app.get('/api/tcxc/interconnections', sessionAuth, async (req: Request, res: Response) => {
    try {
      const credentials = await TcxcApiService.getAllCredentials();
      const interconnections = credentials
        .filter(c => c.isActive)
        .map(c => ({
          id: c.id,
          name: c.name,
          connectionType: c.connectionType || 'tcxc',
          techPrefixes: c.techPrefixes || [],
          sipServer: c.sipServer,
          sipPort: c.sipPort,
          healthStatus: c.healthStatus,
          isActive: c.isActive,
        }));
      res.json(interconnections);
    } catch (error: any) {
      console.error('[TCXC Routes] Get interconnections error:', error);
      res.status(500).json([]);
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

      const updated = await TcxcApiService.updateCredential(req.params.id as string, validation.data);
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
      await TcxcApiService.deleteCredential(req.params.id as string);
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

  // Search marketplace DIDs from sellers (providers like AirTel, Mobily, Tonerro)
  app.post('/api/tcxc/marketplace/search', sessionAuth, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        prefix: z.string().optional(),
        country: z.string().optional(),
        seller: z.string().optional(),
        voice: z.boolean().optional(),
        sms: z.boolean().optional(),
        didType: z.enum(['any', 'mobile', 'landline']).optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      });
      
      const data = schema.parse(req.body);
      const dids = await TcxcApiService.searchMarketplaceDids(data);
      res.json(dids);
    } catch (error: any) {
      console.error('[TCXC Routes] Search marketplace DIDs error:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid request data', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Rent a DID from marketplace
  app.post('/api/tcxc/marketplace/rent', sessionAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const schema = z.object({
        iDid: z.number(),
        did: z.string().min(1),
        seller: z.string().min(1),
        country: z.string().optional(),
        monthlyFee: z.number().optional(),
        credentialId: z.string().min(1),
        techPrefix: z.string().min(1),
      });
      
      const data = schema.parse(req.body);
      
      // Get the credential to find the billing account info
      const credential = await TcxcApiService.getCredentialById(data.credentialId);
      if (!credential) {
        return res.status(400).json({ error: 'Invalid credential' });
      }
      
      // Construct SIP contact from server config
      const sipServer = credential.sipServer || 'sip01.telecomsxchange.com';
      const sipPort = credential.sipPort || 5060;
      const sipContact = `sip:${data.did}@${sipServer}:${sipPort}`;
      
      // Call the TCXC API to rent the DID
      // Note: billingAccountId would come from credential config in production
      const result = await TcxcApiService.rentMarketplaceDid(
        data.iDid,
        1, // Default billing account - should be configured per credential
        sipContact
      );
      
      if (result.success) {
        // Persist the rented DID to provider_caller_ids
        const [callerId] = await db.insert(providerCallerIds).values({
          userId: user.id,
          credentialId: data.credentialId,
          phoneNumber: data.did,
          providerName: data.seller,
          techPrefix: data.techPrefix,
          country: data.country || 'Unknown',
          numberType: 'voice',
          status: 'active',
        }).returning();
        
        res.json({ ...result, callerId });
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      console.error('[TCXC Routes] Rent marketplace DID error:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid request data', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Get list of sellers on the marketplace
  app.get('/api/tcxc/marketplace/sellers', sessionAuth, async (req: Request, res: Response) => {
    try {
      const sellers = await TcxcApiService.getSellerList();
      res.json(sellers);
    } catch (error: any) {
      console.error('[TCXC Routes] Get seller list error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get routes/destinations from TCXC (for GCC and other regions)
  app.get('/api/tcxc/routes', sessionAuth, async (req: Request, res: Response) => {
    try {
      const routes = await TcxcApiService.getRoutes();
      res.json(routes);
    } catch (error: any) {
      console.error('[TCXC Routes] Get routes error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Provider Caller IDs - Get user's added provider caller IDs
  app.get('/api/tcxc/provider-caller-ids', sessionAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const callerIds = await db.select().from(providerCallerIds).where(eq(providerCallerIds.userId, user.id));
      res.json(callerIds);
    } catch (error: any) {
      console.error('[TCXC Routes] Get provider caller IDs error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add a new provider caller ID
  app.post('/api/tcxc/provider-caller-ids', sessionAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const schema = z.object({
        credentialId: z.string().min(1),
        phoneNumber: z.string().min(1),
        providerName: z.string().min(1),
        techPrefix: z.string().min(1),
        country: z.string().optional(),
        countryCode: z.string().optional(),
        numberType: z.enum(['voice', 'sms', 'both']).optional(),
        isDefault: z.boolean().optional(),
      });
      
      const data = schema.parse(req.body);
      
      // If setting as default, unset other defaults first
      if (data.isDefault) {
        await db.update(providerCallerIds)
          .set({ isDefault: false })
          .where(eq(providerCallerIds.userId, user.id));
      }
      
      const [callerId] = await db.insert(providerCallerIds).values({
        userId: user.id,
        credentialId: data.credentialId,
        phoneNumber: data.phoneNumber,
        providerName: data.providerName,
        techPrefix: data.techPrefix,
        country: data.country || 'Unknown',
        countryCode: data.countryCode,
        numberType: data.numberType || 'voice',
        isDefault: data.isDefault || false,
      }).returning();
      
      res.json(callerId);
    } catch (error: any) {
      console.error('[TCXC Routes] Add provider caller ID error:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid request data', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a provider caller ID
  app.delete('/api/tcxc/provider-caller-ids/:id', sessionAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const callerIdId = req.params.id;
      // First verify the caller ID belongs to the user
      const existingRecords = await db.select()
        .from(providerCallerIds)
        .where(eq(providerCallerIds.userId, user.id));
      
      const existing = existingRecords.find(r => r.id === callerIdId);
      if (!existing) {
        return res.status(404).json({ error: 'Caller ID not found' });
      }
      
      // Use raw SQL for delete with id comparison
      await db.execute(sql`DELETE FROM provider_caller_ids WHERE id = ${callerIdId} AND user_id = ${user.id}`);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('[TCXC Routes] Delete provider caller ID error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  console.log('[SIP Engine] TCXC routes registered');
}
