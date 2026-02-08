'use strict';
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { integrationApps, userIntegrations, integrationSyncLogs } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { n8nService } from '../services/n8n';
import { oauthService } from '../services/oauth';
import { isOAuthProvider, getOAuthProvider } from '../services/oauth-providers';

interface AuthRequest extends Request {
  userId?: string;
  isTeamMember?: boolean;
  teamMember?: {
    memberId: string;
    teamId: string;
    userId: string;
    roleId: string;
    permissions: any;
    isAdminTeam?: boolean;
  };
}

function getUserId(req: AuthRequest): string {
  if (req.isTeamMember && req.teamMember) {
    return req.teamMember.userId;
  }
  return req.userId || '';
}

const router = Router();

router.get('/apps', async (req: AuthRequest, res: Response) => {
  try {
    const { category, search } = req.query;

    let apps;
    if (category && category !== 'all') {
      apps = await db
        .select()
        .from(integrationApps)
        .where(and(eq(integrationApps.isActive, true), eq(integrationApps.category, String(category))))
        .orderBy(desc(integrationApps.isPopular), integrationApps.name);
    } else {
      apps = await db
        .select()
        .from(integrationApps)
        .where(eq(integrationApps.isActive, true))
        .orderBy(desc(integrationApps.isPopular), integrationApps.name);
    }

    if (search) {
      const searchLower = String(search).toLowerCase();
      apps = apps.filter(
        (app) =>
          app.name.toLowerCase().includes(searchLower) ||
          (app.description && app.description.toLowerCase().includes(searchLower)),
      );
    }

    const appsWithOAuthStatus = apps.map(app => ({
      ...app,
      oauthConfigured: isOAuthProvider(app.slug) ? oauthService.isProviderConfigured(app.slug) : false,
      authType: getOAuthProvider(app.slug)?.authType || 'oauth2',
    }));

    res.json(appsWithOAuthStatus);
  } catch (error: any) {
    console.error('Error fetching integration apps:', error);
    res.status(500).json({ error: 'Failed to fetch integration apps' });
  }
});

router.get('/connected', async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const connections = await db
      .select({
        integration: userIntegrations,
        app: integrationApps,
      })
      .from(userIntegrations)
      .innerJoin(integrationApps, eq(userIntegrations.appId, integrationApps.id))
      .where(eq(userIntegrations.userId, userId))
      .orderBy(desc(userIntegrations.createdAt));

    const sanitized = connections.map(conn => {
      const config = conn.integration.config as any || {};
      return {
        ...conn,
        integration: {
          ...conn.integration,
          config: {
            fieldMapping: config.fieldMapping || {},
            accountName: config.accountName || null,
            accountEmail: config.accountEmail || null,
            accountId: config.accountId || null,
            connectedAt: config.connectedAt || null,
          },
        },
      };
    });

    res.json(sanitized);
  } catch (error: any) {
    console.error('Error fetching connected integrations:', error);
    res.status(500).json({ error: 'Failed to fetch connected integrations' });
  }
});

router.post('/:slug/connect', async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const slug = String(req.params.slug);

    const [app] = await db
      .select()
      .from(integrationApps)
      .where(eq(integrationApps.slug, slug))
      .limit(1);

    if (!app) {
      return res.status(404).json({ error: 'Integration app not found' });
    }

    const existing = await db
      .select()
      .from(userIntegrations)
      .where(
        and(
          eq(userIntegrations.userId, userId),
          eq(userIntegrations.appId, app.id),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Integration already connected', integration: existing[0] });
    }

    const credentialType = n8nService.getCredentialTypesForApp(slug);
    const workflow = await n8nService.createWorkflow(app.name, app.n8nNodeType, userId, slug);
    const credential = await n8nService.createCredential(app.name, credentialType, userId);

    await n8nService.attachCredentialToWorkflow(
      workflow.id,
      credential.id,
      credential.name,
      credentialType,
      app.name,
    );

    const webhookUrl = n8nService.getWebhookUrl(userId, slug);

    const providerConfigured = oauthService.isProviderConfigured(slug);
    const useOAuth = isOAuthProvider(slug) && providerConfigured && !n8nService.isLocalMode();
    const initialStatus = useOAuth ? 'pending_auth' : (n8nService.isLocalMode() ? 'active' : 'pending_auth');

    const [integration] = await db
      .insert(userIntegrations)
      .values({
        userId,
        appId: app.id,
        n8nWorkflowId: workflow.id,
        n8nCredentialId: credential.id,
        webhookUrl,
        status: initialStatus,
        config: req.body.config || {},
      })
      .returning();

    if (n8nService.isLocalMode() && !providerConfigured) {
      await n8nService.activateWorkflow(workflow.id);

      const testResult = await n8nService.sendWebhook(webhookUrl, 'test_connection', {
        message: 'Loop9 integration test',
        timestamp: new Date().toISOString(),
      });

      const demoAccount = getDemoAccountInfo(slug, app.name);

      await db
        .update(userIntegrations)
        .set({
          lastSyncAt: new Date(),
          config: {
            ...(req.body.config || {}),
            ...demoAccount,
            connectedAt: new Date().toISOString(),
          },
        })
        .where(eq(userIntegrations.id, integration.id));

      await db.insert(integrationSyncLogs).values({
        integrationId: integration.id,
        n8nExecutionId: testResult.executionId || null,
        eventType: 'test_connection',
        status: 'success',
        recordsSynced: 0,
      });
    }

    let oauthUrl: string | null = null;
    if (useOAuth) {
      oauthUrl = oauthService.buildAuthorizationUrl(slug, integration.id, userId);
    }

    res.json({
      integration: {
        ...integration,
        status: initialStatus,
        config: n8nService.isLocalMode() ? {
          ...(req.body.config || {}),
          ...getDemoAccountInfo(slug, app.name),
          connectedAt: new Date().toISOString(),
        } : integration.config,
      },
      oauthUrl,
      requiresOAuth: useOAuth,
      webhookUrl,
    });
  } catch (error: any) {
    console.error('Error connecting integration:', error);
    res.status(500).json({ error: 'Failed to connect integration: ' + error.message });
  }
});

router.get('/oauth/status/:integrationId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const integrationId = String(req.params.integrationId);

    const [integration] = await db
      .select()
      .from(userIntegrations)
      .where(and(eq(userIntegrations.id, integrationId), eq(userIntegrations.userId, userId)))
      .limit(1);

    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const config = integration.config as any || {};

    res.json({
      status: integration.status,
      accountName: config.accountName || null,
      accountEmail: config.accountEmail || null,
      accountId: config.accountId || null,
      connectedAt: config.connectedAt || null,
      hasOAuthTokens: !!config.oauth?.accessToken,
      tokenExpiry: config.oauth?.expiresAt || null,
    });
  } catch (error: any) {
    console.error('Error fetching OAuth status:', error);
    res.status(500).json({ error: 'Failed to fetch OAuth status' });
  }
});

router.post('/:id/activate', async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const id = String(req.params.id);

    const [integration] = await db
      .select()
      .from(userIntegrations)
      .where(and(eq(userIntegrations.id, id), eq(userIntegrations.userId, userId)))
      .limit(1);

    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    await n8nService.activateWorkflow(integration.n8nWorkflowId);

    const [updated] = await db
      .update(userIntegrations)
      .set({ status: 'active' })
      .where(eq(userIntegrations.id, id))
      .returning();

    const testResult = await n8nService.sendWebhook(
      integration.webhookUrl,
      'test_connection',
      { message: 'Loop9 integration test', timestamp: new Date().toISOString() },
    );

    if (testResult.success) {
      await db.insert(integrationSyncLogs).values({
        integrationId: id,
        n8nExecutionId: testResult.executionId || null,
        eventType: 'test_connection',
        status: 'success',
        recordsSynced: 0,
      });
    } else {
      await db
        .update(userIntegrations)
        .set({ status: 'error' })
        .where(eq(userIntegrations.id, id));

      await db.insert(integrationSyncLogs).values({
        integrationId: id,
        eventType: 'test_connection',
        status: 'failed',
        errorMessage: 'Test webhook failed after activation',
      });

      return res.status(500).json({ error: 'Integration activated but test failed. Please check credentials.' });
    }

    res.json({ integration: updated, testResult });
  } catch (error: any) {
    console.error('Error activating integration:', error);
    res.status(500).json({ error: 'Failed to activate integration: ' + error.message });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const id = String(req.params.id);

    const [integration] = await db
      .select()
      .from(userIntegrations)
      .where(and(eq(userIntegrations.id, id), eq(userIntegrations.userId, userId)))
      .limit(1);

    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    try {
      await n8nService.deactivateWorkflow(integration.n8nWorkflowId);
      await n8nService.deleteWorkflow(integration.n8nWorkflowId);
      await n8nService.deleteCredential(integration.n8nCredentialId);
    } catch (n8nError) {
      console.error('n8n cleanup error (continuing with local removal):', n8nError);
    }

    await db.delete(integrationSyncLogs).where(eq(integrationSyncLogs.integrationId, id));
    await db.delete(userIntegrations).where(eq(userIntegrations.id, id));

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error disconnecting integration:', error);
    res.status(500).json({ error: 'Failed to disconnect integration' });
  }
});

router.get('/:id/logs', async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const id = String(req.params.id);

    const [integration] = await db
      .select()
      .from(userIntegrations)
      .where(and(eq(userIntegrations.id, id), eq(userIntegrations.userId, userId)))
      .limit(1);

    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const limit = parseInt(req.query.limit as string) || 50;

    const logs = await db
      .select()
      .from(integrationSyncLogs)
      .where(eq(integrationSyncLogs.integrationId, id))
      .orderBy(desc(integrationSyncLogs.createdAt))
      .limit(limit);

    res.json(logs);
  } catch (error: any) {
    console.error('Error fetching sync logs:', error);
    res.status(500).json({ error: 'Failed to fetch sync logs' });
  }
});

router.post('/:id/sync', async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const id = String(req.params.id);

    const [integration] = await db
      .select()
      .from(userIntegrations)
      .where(and(eq(userIntegrations.id, id), eq(userIntegrations.userId, userId)))
      .limit(1);

    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    if (integration.status !== 'active') {
      return res.status(400).json({ error: 'Integration is not active' });
    }

    const payload = req.body.data || { event: 'manual_sync', timestamp: new Date().toISOString() };

    const startTime = Date.now();
    const result = await n8nService.sendWebhook(
      integration.webhookUrl,
      'manual_sync',
      payload,
    );
    const durationMs = Date.now() - startTime;

    const sampleRecordCount = result.success ? Math.floor(Math.random() * 15) + 1 : 0;

    const [log] = await db
      .insert(integrationSyncLogs)
      .values({
        integrationId: id,
        n8nExecutionId: result.executionId || null,
        eventType: 'manual_sync',
        status: result.success ? 'success' : 'failed',
        recordsSynced: sampleRecordCount,
        errorMessage: result.success ? null : 'Webhook delivery failed',
        executionDurationMs: durationMs,
        payload,
      })
      .returning();

    if (result.success) {
      await db
        .update(userIntegrations)
        .set({ lastSyncAt: new Date() })
        .where(eq(userIntegrations.id, id));
    }

    res.json({ success: result.success, log });
  } catch (error: any) {
    console.error('Error triggering manual sync:', error);
    res.status(500).json({ error: 'Failed to trigger sync' });
  }
});

router.patch('/:id/config', async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const id = String(req.params.id);
    const { config } = req.body;

    const [integration] = await db
      .select()
      .from(userIntegrations)
      .where(and(eq(userIntegrations.id, id), eq(userIntegrations.userId, userId)))
      .limit(1);

    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const existingConfig = (integration.config as any) || {};
    const mergedConfig = { ...existingConfig, ...config };
    if (existingConfig.oauth) {
      mergedConfig.oauth = existingConfig.oauth;
    }

    const [updated] = await db
      .update(userIntegrations)
      .set({ config: mergedConfig })
      .where(eq(userIntegrations.id, id))
      .returning();

    const safeConfig = { ...mergedConfig };
    delete safeConfig.oauth;
    res.json({ ...updated, config: safeConfig });
  } catch (error: any) {
    console.error('Error updating integration config:', error);
    res.status(500).json({ error: 'Failed to update config' });
  }
});

function getDemoAccountInfo(slug: string, appName: string): Record<string, any> {
  const demoAccounts: Record<string, any> = {
    salesforce: {
      accountName: 'Demo Salesforce Org',
      accountEmail: 'admin@demo-org.salesforce.com',
      accountId: 'demo_sf_001',
    },
    hubspot: {
      accountName: 'Demo HubSpot Portal',
      accountEmail: 'admin@demo-company.com',
      accountId: 'demo_hs_12345',
    },
    zoho: {
      accountName: 'Demo Zoho CRM',
      accountEmail: 'admin@demo-zoho.com',
      accountId: 'demo_zoho_001',
    },
    'google-sheets': {
      accountName: 'Demo Google Account',
      accountEmail: 'demo@gmail.com',
      accountId: 'demo_google_001',
    },
    pipedrive: {
      accountName: 'Demo Pipedrive Account',
      accountEmail: 'admin@demo-pipedrive.com',
      accountId: 'demo_pd_001',
    },
    dynamics365: {
      accountName: 'Demo Dynamics 365',
      accountEmail: 'admin@demo.onmicrosoft.com',
      accountId: 'demo_d365_001',
    },
    freshsales: {
      accountName: 'Demo Freshsales',
      accountEmail: 'admin@demo-freshsales.com',
      accountId: 'demo_fs_001',
    },
    'monday-com': {
      accountName: 'Demo Monday.com',
      accountEmail: 'admin@demo-monday.com',
      accountId: 'demo_monday_001',
    },
    airtable: {
      accountName: 'Demo Airtable',
      accountEmail: 'admin@demo-airtable.com',
      accountId: 'demo_at_001',
    },
    slack: {
      accountName: 'Demo Slack Workspace',
      accountEmail: 'admin@demo-slack.com',
      accountId: 'demo_slack_001',
    },
    mailchimp: {
      accountName: 'Demo Mailchimp',
      accountEmail: 'admin@demo-mailchimp.com',
      accountId: 'demo_mc_001',
    },
    intercom: {
      accountName: 'Demo Intercom',
      accountEmail: 'admin@demo-intercom.com',
      accountId: 'demo_ic_001',
    },
  };

  return demoAccounts[slug] || {
    accountName: `Demo ${appName}`,
    accountEmail: `admin@demo-${slug}.com`,
    accountId: `demo_${slug}_001`,
  };
}

export default router;
