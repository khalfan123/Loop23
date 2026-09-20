'use strict';
import crypto from 'crypto';
import { getOAuthProvider, isOAuthProvider, type OAuthProviderConfig } from './oauth-providers';

const OAUTH_STATE_SECRET = process.env.LOOP9_WEBHOOK_SECRET || 'loop9-default-secret';
const STATE_EXPIRY_MS = 10 * 60 * 1000;

export interface UserOAuthCredentials {
  clientId: string;
  clientSecret: string;
}

interface OAuthState {
  integrationId: string;
  userId: string;
  slug: string;
  timestamp: number;
}

function getBaseUrl(): string {
  const isProduction = process.env.NODE_ENV === 'production';

  // Explicit override (recommended for production)
  if (process.env.APP_DOMAIN) {
    const d = process.env.APP_DOMAIN.replace(/^https?:\/\//, '');
    return `https://${d}`;
  }
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL;
  }
  // In production, prefer the Replit-provided deployment domain over the dev workspace domain
  if (isProduction && process.env.REPLIT_DOMAINS) {
    return `https://${process.env.REPLIT_DOMAINS.split(',')[0].trim()}`;
  }
  // Workspace dev domain (only valid when NOT running in production)
  if (!isProduction && process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  // Last-resort: REPLIT_DOMAINS even when NODE_ENV isn't set
  if (process.env.REPLIT_DOMAINS) {
    return `https://${process.env.REPLIT_DOMAINS.split(',')[0].trim()}`;
  }
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  }
  return 'http://localhost:5000';
}

export const oauthService = {
  getRedirectUri: (): string => {
    return `${getBaseUrl()}/api/integrations/oauth/callback`;
  },

  generateState: (integrationId: string, userId: string, slug: string): string => {
    const stateData: OAuthState = {
      integrationId,
      userId,
      slug,
      timestamp: Date.now(),
    };
    const payload = JSON.stringify(stateData);
    const encoded = Buffer.from(payload).toString('base64url');
    const signature = crypto
      .createHmac('sha256', OAUTH_STATE_SECRET)
      .update(payload)
      .digest('base64url');
    return `${encoded}.${signature}`;
  },

  verifyState: (state: string): OAuthState | null => {
    try {
      const [encoded, signature] = state.split('.');
      if (!encoded || !signature) return null;

      const payload = Buffer.from(encoded, 'base64url').toString('utf-8');
      const expectedSignature = crypto
        .createHmac('sha256', OAUTH_STATE_SECRET)
        .update(payload)
        .digest('base64url');

      if (signature !== expectedSignature) {
        console.error('[OAuth] State signature mismatch');
        return null;
      }

      const data: OAuthState = JSON.parse(payload);

      if (Date.now() - data.timestamp > STATE_EXPIRY_MS) {
        console.error('[OAuth] State expired');
        return null;
      }

      return data;
    } catch (err) {
      console.error('[OAuth] State verification error:', err);
      return null;
    }
  },

  buildAuthorizationUrl: (slug: string, integrationId: string, userId: string, credentials: UserOAuthCredentials): string | null => {
    const provider = getOAuthProvider(slug);
    if (!provider || provider.authType !== 'oauth2') return null;

    const state = oauthService.generateState(integrationId, userId, slug);
    const redirectUri = oauthService.getRedirectUri();

    const params = new URLSearchParams({
      client_id: credentials.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
    });

    if (provider.scopes.length > 0) {
      params.set('scope', provider.scopes.join(' '));
    }

    if (provider.additionalAuthParams) {
      for (const [key, value] of Object.entries(provider.additionalAuthParams)) {
        params.set(key, value);
      }
    }

    return `${provider.authUrl}?${params.toString()}`;
  },

  exchangeCodeForTokens: async (
    slug: string,
    code: string,
    credentials: UserOAuthCredentials,
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
    tokenType?: string;
    rawResponse: Record<string, any>;
  } | null> => {
    const provider = getOAuthProvider(slug);
    if (!provider) return null;

    const redirectUri = oauthService.getRedirectUri();

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    });

    try {
      const response = await fetch(provider.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[OAuth] Token exchange failed for ${slug}: ${response.status} ${errorText}`);
        return null;
      }

      const data = await response.json();

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        tokenType: data.token_type,
        rawResponse: data,
      };
    } catch (err) {
      console.error(`[OAuth] Token exchange error for ${slug}:`, err);
      return null;
    }
  },

  refreshAccessToken: async (
    slug: string,
    refreshToken: string,
    credentials: UserOAuthCredentials,
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  } | null> => {
    const provider = getOAuthProvider(slug);
    if (!provider) return null;

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    });

    try {
      const response = await fetch(provider.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!response.ok) {
        console.error(`[OAuth] Token refresh failed for ${slug}: ${response.status}`);
        return null;
      }

      const data = await response.json();

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresIn: data.expires_in,
      };
    } catch (err) {
      console.error(`[OAuth] Token refresh error for ${slug}:`, err);
      return null;
    }
  },

  fetchAccountInfo: async (
    slug: string,
    accessToken: string,
  ): Promise<{ accountId: string; accountName: string; accountEmail?: string } | null> => {
    const provider = getOAuthProvider(slug);
    if (!provider || !provider.accountInfoUrl || !provider.accountInfoHeaders || !provider.parseAccountInfo) {
      return null;
    }

    try {
      const headers = provider.accountInfoHeaders(accessToken);

      let response: Response;
      if (slug === 'monday-com') {
        response = await fetch(provider.accountInfoUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ query: '{ me { id name email } }' }),
        });
      } else if (slug === 'hubspot') {
        response = await fetch(`${provider.accountInfoUrl}${accessToken}`, {
          headers: { 'Content-Type': 'application/json' },
        });
      } else {
        response = await fetch(provider.accountInfoUrl, { headers });
      }

      if (!response.ok) {
        console.error(`[OAuth] Account info fetch failed for ${slug}: ${response.status}`);
        return null;
      }

      const data = await response.json();
      return provider.parseAccountInfo(data);
    } catch (err) {
      console.error(`[OAuth] Account info error for ${slug}:`, err);
      return null;
    }
  },

  encryptToken: (token: string): string => {
    const key = crypto.scryptSync(OAUTH_STATE_SECRET, 'loop9-salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  },

  decryptToken: (encryptedToken: string): string => {
    try {
      const [ivHex, encrypted] = encryptedToken.split(':');
      const key = crypto.scryptSync(OAUTH_STATE_SECRET, 'loop9-salt', 32);
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      return '';
    }
  },
};
