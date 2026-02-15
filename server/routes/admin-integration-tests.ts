'use strict';
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { integrationApps } from '@shared/schema';
import { eq, asc } from 'drizzle-orm';
import { n8nService } from '../services/n8n';

const N8N_BASE_URL = process.env.N8N_BASE_URL || '';
const N8N_API_KEY = process.env.N8N_API_KEY || '';

async function n8nFetch(path: string, options: RequestInit = {}): Promise<any> {
  if (!N8N_BASE_URL || !N8N_API_KEY) {
    throw new Error('n8n is not configured — running in local mode');
  }

  const url = `${N8N_BASE_URL}/api/v1${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-N8N-API-KEY': N8N_API_KEY,
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`n8n API error (${response.status}): ${errorText}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function createTestWorkflow(slug: string, name: string, n8nNodeType: string) {
  const webhookPath = `test-loop9-${slug}`;
  const nodes = [
    {
      parameters: { path: webhookPath, httpMethod: 'POST', responseMode: 'onReceived', options: {} },
      name: 'Loop9 Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 1,
      position: [250, 300],
    },
    {
      parameters: {},
      name,
      type: n8nNodeType,
      typeVersion: 1,
      position: [470, 300],
    },
  ];

  const connections = {
    'Loop9 Webhook': { main: [[{ node: name, type: 'main', index: 0 }]] },
  };

  const result = await n8nFetch('/workflows', {
    method: 'POST',
    body: JSON.stringify({
      name: `[TEST] Loop9 → ${name}`,
      nodes,
      connections,
      settings: { executionOrder: 'v1' },
    }),
  });

  return result;
}

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const apps = await db
      .select({
        id: integrationApps.id,
        name: integrationApps.name,
        slug: integrationApps.slug,
        category: integrationApps.category,
        n8nNodeType: integrationApps.n8nNodeType,
        isActive: integrationApps.isActive,
      })
      .from(integrationApps)
      .orderBy(asc(integrationApps.category), asc(integrationApps.name));

    res.json(apps);
  } catch (error: any) {
    console.error('Error fetching integration apps for testing:', error);
    res.status(500).json({ error: 'Failed to fetch integration apps' });
  }
});

router.post('/run', async (req: Request, res: Response) => {
  try {
    const { slug, name, n8nNodeType } = req.body;

    if (!slug || !name || !n8nNodeType) {
      return res.status(400).json({ error: 'slug, name, and n8nNodeType are required' });
    }

    const result = await createTestWorkflow(slug, name, n8nNodeType);
    res.json({ status: 'success', workflowId: result.id });
  } catch (error: any) {
    console.error('Error creating test workflow:', error);
    res.json({ status: 'failed', error: error.message });
  }
});

router.post('/run-all', async (_req: Request, res: Response) => {
  try {
    const apps = await db
      .select()
      .from(integrationApps)
      .where(eq(integrationApps.isActive, true))
      .orderBy(asc(integrationApps.category), asc(integrationApps.name));

    const results: { name: string; slug: string; category: string | null; status: string; workflowId?: string; error?: string }[] = [];

    for (const app of apps) {
      try {
        const result = await createTestWorkflow(app.slug, app.name, app.n8nNodeType);
        results.push({
          name: app.name,
          slug: app.slug,
          category: app.category,
          status: 'success',
          workflowId: result.id,
        });
      } catch (error: any) {
        results.push({
          name: app.name,
          slug: app.slug,
          category: app.category,
          status: 'failed',
          error: error.message,
        });
      }

      await new Promise(r => setTimeout(r, 300));
    }

    res.json(results);
  } catch (error: any) {
    console.error('Error running all integration tests:', error);
    res.status(500).json({ error: 'Failed to run integration tests' });
  }
});

router.post('/cleanup', async (req: Request, res: Response) => {
  try {
    const { workflowIds } = req.body;

    if (!Array.isArray(workflowIds) || workflowIds.length === 0) {
      return res.status(400).json({ error: 'workflowIds array is required' });
    }

    let deleted = 0;
    let failed = 0;

    for (const id of workflowIds) {
      try {
        await n8nService.deleteWorkflow(id);
        deleted++;
      } catch {
        failed++;
      }
    }

    res.json({ deleted, failed });
  } catch (error: any) {
    console.error('Error cleaning up test workflows:', error);
    res.status(500).json({ error: 'Failed to cleanup test workflows' });
  }
});

router.get('/n8n-status', async (_req: Request, res: Response) => {
  try {
    const configured = !!N8N_BASE_URL && !!N8N_API_KEY;

    if (!configured) {
      return res.json({ configured: false, connected: false });
    }

    try {
      await n8nFetch('/workflows?limit=1');
      res.json({ configured: true, connected: true });
    } catch (error: any) {
      res.json({ configured: true, connected: false, error: error.message });
    }
  } catch (error: any) {
    res.status(500).json({ configured: false, connected: false, error: error.message });
  }
});

export default router;
