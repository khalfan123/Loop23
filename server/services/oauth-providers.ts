'use strict';

export interface OAuthProviderConfig {
  slug: string;
  name: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientIdEnvVar: string;
  clientSecretEnvVar: string;
  authType: 'oauth2' | 'api_key';
  additionalAuthParams?: Record<string, string>;
  accountInfoUrl?: string;
  accountInfoHeaders?: (accessToken: string) => Record<string, string>;
  parseAccountInfo?: (data: any) => { accountId: string; accountName: string; accountEmail?: string };
}

export const oauthProviders: Record<string, OAuthProviderConfig> = {
  salesforce: {
    slug: 'salesforce',
    name: 'Salesforce',
    authUrl: 'https://login.salesforce.com/services/oauth2/authorize',
    tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
    scopes: ['api', 'refresh_token', 'full'],
    clientIdEnvVar: 'SALESFORCE_CLIENT_ID',
    clientSecretEnvVar: 'SALESFORCE_CLIENT_SECRET',
    authType: 'oauth2',
    additionalAuthParams: { prompt: 'consent' },
    accountInfoUrl: 'https://login.salesforce.com/services/oauth2/userinfo',
    accountInfoHeaders: (token: string) => ({ Authorization: `Bearer ${token}` }),
    parseAccountInfo: (data: any) => ({
      accountId: data.user_id || data.sub,
      accountName: data.name || data.preferred_username,
      accountEmail: data.email,
    }),
  },
  hubspot: {
    slug: 'hubspot',
    name: 'HubSpot',
    authUrl: 'https://app.hubspot.com/oauth/authorize',
    tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
    scopes: ['crm.objects.contacts.read', 'crm.objects.contacts.write', 'crm.objects.deals.read', 'crm.objects.deals.write'],
    clientIdEnvVar: 'HUBSPOT_CLIENT_ID',
    clientSecretEnvVar: 'HUBSPOT_CLIENT_SECRET',
    authType: 'oauth2',
    accountInfoUrl: 'https://api.hubapi.com/oauth/v1/access-tokens/',
    accountInfoHeaders: (token: string) => ({ Authorization: `Bearer ${token}` }),
    parseAccountInfo: (data: any) => ({
      accountId: data.hub_id?.toString() || data.user_id?.toString(),
      accountName: data.hub_domain || data.user,
      accountEmail: data.user,
    }),
  },
  zoho: {
    slug: 'zoho',
    name: 'Zoho CRM',
    authUrl: 'https://accounts.zoho.com/oauth/v2/auth',
    tokenUrl: 'https://accounts.zoho.com/oauth/v2/token',
    scopes: ['ZohoCRM.modules.ALL', 'ZohoCRM.settings.ALL'],
    clientIdEnvVar: 'ZOHO_CLIENT_ID',
    clientSecretEnvVar: 'ZOHO_CLIENT_SECRET',
    authType: 'oauth2',
    additionalAuthParams: { access_type: 'offline', prompt: 'consent' },
    accountInfoUrl: 'https://accounts.zoho.com/oauth/user/info',
    accountInfoHeaders: (token: string) => ({ Authorization: `Zoho-oauthtoken ${token}` }),
    parseAccountInfo: (data: any) => ({
      accountId: data.ZUID?.toString(),
      accountName: data.Display_Name || `${data.First_Name} ${data.Last_Name}`,
      accountEmail: data.Email,
    }),
  },
  'google-sheets': {
    slug: 'google-sheets',
    name: 'Google Sheets',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'],
    clientIdEnvVar: 'GOOGLE_CLIENT_ID',
    clientSecretEnvVar: 'GOOGLE_CLIENT_SECRET',
    authType: 'oauth2',
    additionalAuthParams: { access_type: 'offline', prompt: 'consent' },
    accountInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    accountInfoHeaders: (token: string) => ({ Authorization: `Bearer ${token}` }),
    parseAccountInfo: (data: any) => ({
      accountId: data.id,
      accountName: data.name,
      accountEmail: data.email,
    }),
  },
  pipedrive: {
    slug: 'pipedrive',
    name: 'Pipedrive',
    authUrl: 'https://oauth.pipedrive.com/oauth/authorize',
    tokenUrl: 'https://oauth.pipedrive.com/oauth/token',
    scopes: ['deals:full', 'contacts:full', 'activities:full'],
    clientIdEnvVar: 'PIPEDRIVE_CLIENT_ID',
    clientSecretEnvVar: 'PIPEDRIVE_CLIENT_SECRET',
    authType: 'oauth2',
    accountInfoUrl: 'https://api.pipedrive.com/v1/users/me',
    accountInfoHeaders: (token: string) => ({ Authorization: `Bearer ${token}` }),
    parseAccountInfo: (data: any) => ({
      accountId: data.data?.id?.toString(),
      accountName: data.data?.name,
      accountEmail: data.data?.email,
    }),
  },
  dynamics365: {
    slug: 'dynamics365',
    name: 'Microsoft Dynamics 365',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: ['https://org.crm.dynamics.com/.default', 'offline_access'],
    clientIdEnvVar: 'DYNAMICS365_CLIENT_ID',
    clientSecretEnvVar: 'DYNAMICS365_CLIENT_SECRET',
    authType: 'oauth2',
    accountInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    accountInfoHeaders: (token: string) => ({ Authorization: `Bearer ${token}` }),
    parseAccountInfo: (data: any) => ({
      accountId: data.id,
      accountName: data.displayName,
      accountEmail: data.mail || data.userPrincipalName,
    }),
  },
  freshsales: {
    slug: 'freshsales',
    name: 'Freshsales',
    authUrl: '',
    tokenUrl: '',
    scopes: [],
    clientIdEnvVar: 'FRESHSALES_API_KEY',
    clientSecretEnvVar: 'FRESHSALES_DOMAIN',
    authType: 'api_key',
  },
  'monday-com': {
    slug: 'monday-com',
    name: 'Monday.com',
    authUrl: 'https://auth.monday.com/oauth2/authorize',
    tokenUrl: 'https://auth.monday.com/oauth2/token',
    scopes: ['boards:read', 'boards:write'],
    clientIdEnvVar: 'MONDAY_CLIENT_ID',
    clientSecretEnvVar: 'MONDAY_CLIENT_SECRET',
    authType: 'oauth2',
    accountInfoUrl: 'https://api.monday.com/v2',
    accountInfoHeaders: (token: string) => ({ Authorization: token, 'Content-Type': 'application/json' }),
    parseAccountInfo: (data: any) => ({
      accountId: data.data?.me?.id?.toString(),
      accountName: data.data?.me?.name,
      accountEmail: data.data?.me?.email,
    }),
  },
  airtable: {
    slug: 'airtable',
    name: 'Airtable',
    authUrl: 'https://airtable.com/oauth2/v1/authorize',
    tokenUrl: 'https://airtable.com/oauth2/v1/token',
    scopes: ['data.records:read', 'data.records:write', 'schema.bases:read'],
    clientIdEnvVar: 'AIRTABLE_CLIENT_ID',
    clientSecretEnvVar: 'AIRTABLE_CLIENT_SECRET',
    authType: 'oauth2',
    accountInfoUrl: 'https://api.airtable.com/v0/meta/whoami',
    accountInfoHeaders: (token: string) => ({ Authorization: `Bearer ${token}` }),
    parseAccountInfo: (data: any) => ({
      accountId: data.id,
      accountName: data.email?.split('@')[0] || 'Airtable User',
      accountEmail: data.email,
    }),
  },
  slack: {
    slug: 'slack',
    name: 'Slack',
    authUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    scopes: ['chat:write', 'channels:read', 'users:read'],
    clientIdEnvVar: 'SLACK_CLIENT_ID',
    clientSecretEnvVar: 'SLACK_CLIENT_SECRET',
    authType: 'oauth2',
    accountInfoUrl: 'https://slack.com/api/auth.test',
    accountInfoHeaders: (token: string) => ({ Authorization: `Bearer ${token}` }),
    parseAccountInfo: (data: any) => ({
      accountId: data.user_id,
      accountName: data.team || data.user,
      accountEmail: undefined,
    }),
  },
  mailchimp: {
    slug: 'mailchimp',
    name: 'Mailchimp',
    authUrl: 'https://login.mailchimp.com/oauth2/authorize',
    tokenUrl: 'https://login.mailchimp.com/oauth2/token',
    scopes: [],
    clientIdEnvVar: 'MAILCHIMP_CLIENT_ID',
    clientSecretEnvVar: 'MAILCHIMP_CLIENT_SECRET',
    authType: 'oauth2',
    accountInfoUrl: 'https://login.mailchimp.com/oauth2/metadata',
    accountInfoHeaders: (token: string) => ({ Authorization: `OAuth ${token}` }),
    parseAccountInfo: (data: any) => ({
      accountId: data.user_id?.toString(),
      accountName: data.accountname || data.login?.login_name,
      accountEmail: data.login?.email,
    }),
  },
  intercom: {
    slug: 'intercom',
    name: 'Intercom',
    authUrl: 'https://app.intercom.com/oauth',
    tokenUrl: 'https://api.intercom.io/auth/eagle/token',
    scopes: [],
    clientIdEnvVar: 'INTERCOM_CLIENT_ID',
    clientSecretEnvVar: 'INTERCOM_CLIENT_SECRET',
    authType: 'oauth2',
    accountInfoUrl: 'https://api.intercom.io/me',
    accountInfoHeaders: (token: string) => ({ Authorization: `Bearer ${token}`, Accept: 'application/json' }),
    parseAccountInfo: (data: any) => ({
      accountId: data.id,
      accountName: data.name || data.app?.name,
      accountEmail: data.email,
    }),
  },
};

export function getOAuthProvider(slug: string): OAuthProviderConfig | undefined {
  return oauthProviders[slug];
}

export function isOAuthProvider(slug: string): boolean {
  const provider = oauthProviders[slug];
  return !!provider && provider.authType === 'oauth2';
}

export function getProviderCredentials(slug: string): { clientId: string; clientSecret: string } | null {
  const provider = oauthProviders[slug];
  if (!provider) return null;

  const clientId = process.env[provider.clientIdEnvVar] || '';
  const clientSecret = process.env[provider.clientSecretEnvVar] || '';

  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}
