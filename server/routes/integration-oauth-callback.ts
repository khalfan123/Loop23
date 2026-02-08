'use strict';
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { userIntegrations, integrationSyncLogs } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { n8nService } from '../services/n8n';
import { oauthService } from '../services/oauth';

const router = Router();

router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      console.error('[OAuth] Provider returned error:', oauthError);
      return res.redirect('/app/integrations?oauth_error=access_denied');
    }

    if (!code || !state) {
      return res.redirect('/app/integrations?oauth_error=missing_params');
    }

    const stateData = oauthService.verifyState(String(state));
    if (!stateData) {
      return res.redirect('/app/integrations?oauth_error=invalid_state');
    }

    const { integrationId, userId, slug } = stateData;

    const [integration] = await db
      .select()
      .from(userIntegrations)
      .where(and(eq(userIntegrations.id, integrationId), eq(userIntegrations.userId, userId)))
      .limit(1);

    if (!integration) {
      return res.redirect('/app/integrations?oauth_error=integration_not_found');
    }

    const config = (integration.config as any) || {};
    const oauthApp = config.oauthApp;
    if (!oauthApp?.clientId || !oauthApp?.clientSecret) {
      console.error('[OAuth] No stored OAuth credentials found for integration:', integrationId);
      return res.redirect(`/app/integrations/${slug}?oauth_error=missing_credentials`);
    }

    const userCredentials = {
      clientId: oauthService.decryptToken(oauthApp.clientId),
      clientSecret: oauthService.decryptToken(oauthApp.clientSecret),
    };

    if (!userCredentials.clientId || !userCredentials.clientSecret) {
      console.error('[OAuth] Failed to decrypt stored OAuth credentials');
      return res.redirect(`/app/integrations/${slug}?oauth_error=credential_error`);
    }

    const tokens = await oauthService.exchangeCodeForTokens(slug, String(code), userCredentials);
    if (!tokens) {
      await db
        .update(userIntegrations)
        .set({ status: 'error' })
        .where(eq(userIntegrations.id, integrationId));

      await db.insert(integrationSyncLogs).values({
        integrationId,
        eventType: 'oauth_callback',
        status: 'failed',
        errorMessage: 'Failed to exchange authorization code for tokens',
      });

      return res.redirect(`/app/integrations/${slug}?oauth_error=token_exchange_failed`);
    }

    const encryptedAccessToken = oauthService.encryptToken(tokens.accessToken);
    const encryptedRefreshToken = tokens.refreshToken ? oauthService.encryptToken(tokens.refreshToken) : null;

    let accountInfo: { accountId: string; accountName: string; accountEmail?: string } | null = null;
    try {
      accountInfo = await oauthService.fetchAccountInfo(slug, tokens.accessToken);
    } catch (err) {
      console.error('[OAuth] Failed to fetch account info:', err);
    }

    const updatedConfig = {
      ...config,
      oauth: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: tokens.expiresIn
          ? new Date(Date.now() + tokens.expiresIn * 1000).toISOString()
          : null,
        tokenType: tokens.tokenType || 'Bearer',
      },
      accountId: accountInfo?.accountId || null,
      accountName: accountInfo?.accountName || null,
      accountEmail: accountInfo?.accountEmail || null,
      connectedAt: new Date().toISOString(),
    };

    await db
      .update(userIntegrations)
      .set({
        status: 'active',
        config: updatedConfig,
        lastSyncAt: new Date(),
      })
      .where(eq(userIntegrations.id, integrationId));

    try {
      await n8nService.activateWorkflow(integration.n8nWorkflowId);
    } catch (err) {
      console.log('[OAuth] n8n workflow activation skipped (n8n not configured)');
    }

    await db.insert(integrationSyncLogs).values({
      integrationId,
      eventType: 'oauth_connected',
      status: 'success',
      recordsSynced: 0,
    });

    try {
      const testResult = await n8nService.sendWebhook(
        integration.webhookUrl,
        'test_connection',
        {
          message: 'OAuth connection verified',
          accountName: accountInfo?.accountName,
          timestamp: new Date().toISOString(),
        },
      );

      if (testResult.success) {
        await db.insert(integrationSyncLogs).values({
          integrationId,
          n8nExecutionId: testResult.executionId || null,
          eventType: 'test_connection',
          status: 'success',
          recordsSynced: 0,
        });
      }
    } catch (err) {
      console.log('[OAuth] n8n webhook test skipped (n8n not configured)');
    }

    return res.redirect(`/app/integrations/${slug}?oauth_success=true`);
  } catch (error: any) {
    console.error('[OAuth] Callback error:', error);
    return res.redirect('/app/integrations?oauth_error=server_error');
  }
});

export default router;
