'use strict';
import { Router, Response } from 'express';
import { AdminRequest } from '../../middleware/admin-auth';
import { db } from '../../db';
import { eq } from 'drizzle-orm';
import { retellCredentials } from '@shared/schema';
import { z } from 'zod';

export function registerRetellCredentialsRoutes(router: Router) {
  router.get('/retell-credentials', async (req: AdminRequest, res: Response) => {
    try {
      const credentials = await db.select().from(retellCredentials);
      res.json(credentials);
    } catch (error) {
      console.error('Error fetching Retell credentials:', error);
      res.status(500).json({ error: 'Failed to fetch Retell credentials' });
    }
  });

  router.post('/retell-credentials', async (req: AdminRequest, res: Response) => {
    try {
      const schema = z.object({
        name: z.string().min(1),
        apiKey: z.string().min(1),
        isActive: z.boolean().optional(),
        maxConcurrency: z.number().optional(),
      });

      const data = schema.parse(req.body);

      const [credential] = await db.insert(retellCredentials).values({
        name: data.name,
        apiKey: data.apiKey,
        isActive: data.isActive !== false,
        maxConcurrency: data.maxConcurrency || 50,
      }).returning();

      res.json(credential);
    } catch (error: any) {
      console.error('Error adding Retell credential:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      res.status(500).json({ error: error.message || 'Failed to add credential' });
    }
  });

  router.post('/retell-credentials/test', async (req: AdminRequest, res: Response) => {
    try {
      const { apiKey } = req.body;

      if (!apiKey) {
        return res.status(400).json({ error: 'API key is required' });
      }

      const response = await fetch('https://api.retellai.com/v2/list-agents', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        res.json({ success: true, agentCount: Array.isArray(data) ? data.length : 0 });
      } else {
        res.json({ success: false, error: 'Invalid API key or unable to connect to Retell AI' });
      }
    } catch (error: any) {
      res.json({ success: false, error: error.message || 'Failed to test API key' });
    }
  });

  router.put('/retell-credentials/:id', async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const schema = z.object({
        name: z.string().min(1).optional(),
        apiKey: z.string().min(1).optional(),
        isActive: z.boolean().optional(),
        maxConcurrency: z.number().optional(),
      });

      const data = schema.parse(req.body);

      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (data.name !== undefined) updateData.name = data.name;
      if (data.apiKey !== undefined) updateData.apiKey = data.apiKey;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.maxConcurrency !== undefined) updateData.maxConcurrency = data.maxConcurrency;

      const [updated] = await db.update(retellCredentials)
        .set(updateData)
        .where(eq(retellCredentials.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Credential not found' });
      }

      res.json(updated);
    } catch (error: any) {
      console.error('Error updating Retell credential:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      res.status(500).json({ error: error.message || 'Failed to update credential' });
    }
  });

  router.delete('/retell-credentials/:id', async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;

      const [deleted] = await db.delete(retellCredentials)
        .where(eq(retellCredentials.id, id))
        .returning();

      if (!deleted) {
        return res.status(404).json({ error: 'Credential not found' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting Retell credential:', error);
      res.status(500).json({ error: 'Failed to delete credential' });
    }
  });

  router.patch('/retell-credentials/:id/activate', async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      await db.update(retellCredentials)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(retellCredentials.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error('Error activating Retell credential:', error);
      res.status(500).json({ error: 'Failed to activate credential' });
    }
  });

  router.patch('/retell-credentials/:id/deactivate', async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      await db.update(retellCredentials)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(retellCredentials.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error('Error deactivating Retell credential:', error);
      res.status(500).json({ error: 'Failed to deactivate credential' });
    }
  });
}
