'use strict';
import { Router, Request, Response } from 'express';
import { RouteContext, AuthRequest } from './common';
import Papa from 'papaparse';
import { oauthService } from '../services/oauth';
import { getProviderCredentials } from '../services/oauth-providers';
import { batchInsertContacts } from '../utils/batch-utils';
import type { InsertContact } from '@shared/schema';

const MAX_IMPORT_CONTACTS = 10000;
const IMPORT_CAMPAIGN_NAME = 'Imported Contacts';

interface ContactImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  source: string;
}

interface ParsedImportContact {
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  customFields: Record<string, any> | null;
}

function parseVCard(content: string): ParsedImportContact[] {
  const vcards = content.split('BEGIN:VCARD');
  const parsed: ParsedImportContact[] = [];

  for (const vcard of vcards) {
    if (!vcard.trim()) continue;

    const lines = vcard.split(/\r?\n/);
    let firstName = '';
    let lastName = '';
    let phone = '';
    let email: string | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('N:') || trimmed.startsWith('N;')) {
        const nValue = trimmed.replace(/^N[;:][^:]*:?/, '').replace(/^N:/, '');
        const parts = nValue.split(';');
        lastName = parts[0] || '';
        firstName = parts[1] || '';
      } else if (trimmed.startsWith('FN:') || trimmed.startsWith('FN;')) {
        if (!firstName && !lastName) {
          const fnValue = trimmed.replace(/^FN[;:][^:]*:?/, '').replace(/^FN:/, '');
          const parts = fnValue.trim().split(/\s+/);
          firstName = parts[0] || '';
          lastName = parts.slice(1).join(' ') || '';
        }
      } else if ((trimmed.startsWith('TEL:') || trimmed.startsWith('TEL;')) && !phone) {
        phone = trimmed.replace(/^TEL[;:][^:]*:?/, '').replace(/^TEL:/, '').replace(/[\s-()]/g, '');
      } else if ((trimmed.startsWith('EMAIL:') || trimmed.startsWith('EMAIL;')) && !email) {
        email = trimmed.replace(/^EMAIL[;:][^:]*:?/, '').replace(/^EMAIL:/, '').trim();
      }
    }

    if (phone || firstName || email) {
      parsed.push({
        firstName: firstName || 'Unknown',
        lastName: lastName || '',
        phone: phone || '',
        email: email || null,
        customFields: null,
      });
    }
  }

  return parsed;
}

function parseCSVContacts(fileContent: string): ParsedImportContact[] {
  const parsed = Papa.parse(fileContent, {
    header: true,
    skipEmptyLines: true,
  });

  const standardFields = [
    'firstName', 'FirstName', 'first_name',
    'lastName', 'LastName', 'last_name',
    'name', 'Name', 'Full Name', 'full_name',
    'phone', 'Phone', 'phone_number', 'Phone Number', 'Mobile', 'mobile',
    'email', 'Email', 'E-mail', 'e-mail', 'Email Address',
  ];

  return parsed.data.map((row: any) => {
    let firstName = row.firstName || row.FirstName || row.first_name || '';
    let lastName = row.lastName || row.LastName || row.last_name || '';
    const phone = row.phone || row.Phone || row.phone_number || row['Phone Number'] || row.Mobile || row.mobile || '';
    const email = row.email || row.Email || row['E-mail'] || row['e-mail'] || row['Email Address'] || null;

    if (!firstName && (row.name || row.Name || row['Full Name'] || row.full_name)) {
      const fullName = row.name || row.Name || row['Full Name'] || row.full_name || '';
      const parts = fullName.trim().split(/\s+/);
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }

    const customFields: Record<string, any> = {};
    for (const key of Object.keys(row)) {
      if (!standardFields.includes(key) && row[key] && String(row[key]).trim() !== '') {
        customFields[key] = row[key];
      }
    }

    return {
      firstName: firstName || 'Unknown',
      lastName: lastName || '',
      phone,
      email: email || null,
      customFields: Object.keys(customFields).length > 0 ? customFields : null,
    };
  });
}

function cleanContactName(raw: string | undefined | null): string {
  if (!raw) return '';
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/\s*com>\s*$/i, '');
  cleaned = cleaned.replace(/[<>]/g, '');
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) return '';
  return cleaned.trim();
}

function deduplicateNameParts(firstName: string, lastName: string): { firstName: string; lastName: string } {
  const fn = firstName.trim();
  const ln = lastName.trim();
  if (fn && ln && fn.toLowerCase() === ln.toLowerCase()) {
    return { firstName: fn, lastName: '' };
  }
  if (ln) {
    const lastParts = ln.split(' ');
    if (lastParts.length > 1 && lastParts[lastParts.length - 1].toLowerCase() === lastParts[lastParts.length - 2].toLowerCase()) {
      return { firstName: fn, lastName: lastParts.slice(0, -1).join(' ') };
    }
  }
  return { firstName: fn, lastName: ln };
}

async function fetchGoogleContacts(accessToken: string): Promise<ParsedImportContact[]> {
  const allContacts: ParsedImportContact[] = [];
  let nextPageToken: string | undefined;

  do {
    const url = new URL('https://people.googleapis.com/v1/people/me/connections');
    url.searchParams.set('personFields', 'names,phoneNumbers,emailAddresses,organizations');
    url.searchParams.set('pageSize', '1000');
    url.searchParams.set('sortOrder', 'FIRST_NAME_ASCENDING');
    if (nextPageToken) {
      url.searchParams.set('pageToken', nextPageToken);
    }

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google People API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const connections = data.connections || [];

    for (const person of connections) {
      const name = person.names?.[0] || {};
      const phones = person.phoneNumbers || [];
      const emails = person.emailAddresses || [];
      const org = person.organizations?.[0]?.name || null;

      const primaryPhone = phones[0]?.value || '';
      const primaryEmail = emails[0]?.value || null;

      let rawFirst = name.givenName || '';
      let rawLast = name.familyName || '';

      if (!rawFirst && !rawLast && name.displayName) {
        const display = cleanContactName(name.displayName);
        if (display) {
          const parts = display.split(' ');
          rawFirst = parts[0] || '';
          rawLast = parts.slice(1).join(' ') || '';
        }
      }

      rawFirst = cleanContactName(rawFirst);
      rawLast = cleanContactName(rawLast);

      const { firstName, lastName } = deduplicateNameParts(rawFirst, rawLast);

      if (!primaryPhone && !primaryEmail) continue;

      const cleanedPhone = primaryPhone.replace(/[\s\-()\.]/g, '');

      const customFields: Record<string, string> = {};
      if (org) customFields.organization = org;
      if (phones.length > 1) {
        phones.slice(1, 4).forEach((p: any, i: number) => {
          if (p.value) customFields[`phone${i + 2}`] = p.value.replace(/[\s\-()\.]/g, '');
        });
      }
      if (emails.length > 1) {
        emails.slice(1, 3).forEach((e: any, i: number) => {
          if (e.value) customFields[`email${i + 2}`] = e.value;
        });
      }

      allContacts.push({
        firstName: firstName || 'Unknown',
        lastName,
        phone: cleanedPhone,
        email: primaryEmail,
        customFields: Object.keys(customFields).length > 0 ? customFields : null,
      });
    }

    nextPageToken = data.nextPageToken;
  } while (nextPageToken);

  return allContacts;
}

async function fetchMicrosoftContacts(accessToken: string): Promise<ParsedImportContact[]> {
  const allContacts: ParsedImportContact[] = [];
  let nextLink: string | undefined = 'https://graph.microsoft.com/v1.0/me/contacts?$top=100&$select=givenName,surname,displayName,mobilePhone,homePhones,businessPhones,emailAddresses';

  while (nextLink) {
    const msResponse = await fetch(nextLink, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!msResponse.ok) {
      const errorText = await msResponse.text();
      throw new Error(`Microsoft Graph API error: ${msResponse.status} ${errorText}`);
    }

    const data: any = await msResponse.json();
    const msContacts = data.value || [];

    for (const contact of msContacts) {
      const phone = contact.mobilePhone ||
        contact.businessPhones?.[0] ||
        contact.homePhones?.[0] || '';
      const email = contact.emailAddresses?.[0]?.address || null;

      if (phone || contact.displayName || email) {
        allContacts.push({
          firstName: contact.givenName || contact.displayName?.split(' ')[0] || 'Unknown',
          lastName: contact.surname || contact.displayName?.split(' ').slice(1).join(' ') || '',
          phone: phone.replace(/[\s-()]/g, ''),
          email,
          customFields: null,
        });
      }
    }

    nextLink = data['@odata.nextLink'];
  }

  return allContacts;
}

async function fetchHubSpotContacts(accessToken: string): Promise<ParsedImportContact[]> {
  const allContacts: ParsedImportContact[] = [];
  let after: string | undefined;

  do {
    const url = new URL('https://api.hubapi.com/crm/v3/objects/contacts');
    url.searchParams.set('limit', '100');
    url.searchParams.set('properties', 'firstname,lastname,phone,mobilephone,email');
    if (after) {
      url.searchParams.set('after', after);
    }

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HubSpot API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const results = data.results || [];

    for (const contact of results) {
      const props = contact.properties || {};
      const phone = props.phone || props.mobilephone || '';
      const email = props.email || null;

      if (phone || props.firstname || email) {
        allContacts.push({
          firstName: props.firstname || 'Unknown',
          lastName: props.lastname || '',
          phone: phone.replace(/[\s-()]/g, ''),
          email,
          customFields: null,
        });
      }
    }

    after = data.paging?.next?.after;
  } while (after);

  return allContacts;
}

async function fetchSalesforceContacts(accessToken: string, instanceUrl?: string): Promise<ParsedImportContact[]> {
  const baseUrl = instanceUrl || 'https://login.salesforce.com';
  const allContacts: ParsedImportContact[] = [];

  const response = await fetch(`${baseUrl}/services/data/v59.0/query?q=SELECT+FirstName,LastName,Phone,MobilePhone,Email+FROM+Contact+LIMIT+2000`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Salesforce API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const records = data.records || [];

  for (const contact of records) {
    const phone = contact.Phone || contact.MobilePhone || '';
    const email = contact.Email || null;

    if (phone || contact.FirstName || email) {
      allContacts.push({
        firstName: contact.FirstName || 'Unknown',
        lastName: contact.LastName || '',
        phone: phone.replace(/[\s-()]/g, ''),
        email,
        customFields: null,
      });
    }
  }

  return allContacts;
}

export default function contactImportRoutes(ctx: RouteContext): Router {
  const { db, storage, authenticateToken, upload } = ctx;
  const router = Router();

  async function getOrCreateImportCampaign(userId: string) {
    const userCampaigns = await storage.getUserCampaigns(userId);
    const existing = userCampaigns.find(c => c.name === IMPORT_CAMPAIGN_NAME);
    if (existing) return existing;
    return await storage.createCampaign({
      userId,
      name: IMPORT_CAMPAIGN_NAME,
      type: 'outbound',
      status: 'pending',
      totalContacts: 0,
    } as any);
  }

  router.post('/csv', authenticateToken, upload.single('file'), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const campaign = await getOrCreateImportCampaign(req.userId!);
      const campaignId = campaign.id;

      const fileContent = req.file.buffer
        ? req.file.buffer.toString('utf-8')
        : '';

      if (!fileContent.trim()) {
        return res.status(400).json({ error: 'File is empty' });
      }

      const parsedContacts = parseCSVContacts(fileContent);
      const validContacts = parsedContacts.filter(c => c.phone || c.email);

      if (validContacts.length === 0) {
        return res.status(400).json({ error: 'No valid contacts found in CSV. Ensure the file has phone or email columns.' });
      }

      if (validContacts.length > MAX_IMPORT_CONTACTS) {
        return res.status(400).json({ error: `Too many contacts. Maximum ${MAX_IMPORT_CONTACTS} contacts per import. Found ${validContacts.length}.` });
      }

      const insertData: InsertContact[] = validContacts.map(c => ({
        campaignId,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        email: c.email,
        customFields: c.customFields,
        status: 'pending',
      }));

      const result = await batchInsertContacts(insertData, '📥 [CSV Import]');

      await storage.updateCampaign(campaignId, {
        totalContacts: campaign.totalContacts + result.inserted,
      });

      const importResult: ContactImportResult = {
        imported: result.inserted,
        skipped: parsedContacts.length - validContacts.length,
        errors: result.failed > 0 ? [`${result.failed} contacts failed to insert`] : [],
        source: 'csv',
      };

      res.json(importResult);
    } catch (error: any) {
      console.error('[Contact Import] CSV error:', error);
      res.status(500).json({ error: 'Failed to import CSV contacts: ' + error.message });
    }
  });

  router.post('/vcard', authenticateToken, upload.single('file'), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const campaign = await getOrCreateImportCampaign(req.userId!);
      const campaignId = campaign.id;

      const fileContent = req.file.buffer
        ? req.file.buffer.toString('utf-8')
        : '';

      if (!fileContent.trim()) {
        return res.status(400).json({ error: 'File is empty' });
      }

      const parsedContacts = parseVCard(fileContent);
      const validContacts = parsedContacts.filter(c => c.phone || c.email);

      if (validContacts.length === 0) {
        return res.status(400).json({ error: 'No valid contacts found in vCard file' });
      }

      const insertData: InsertContact[] = validContacts.map(c => ({
        campaignId,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        email: c.email,
        customFields: c.customFields,
        status: 'pending',
      }));

      const result = await batchInsertContacts(insertData, '📥 [vCard Import]');

      await storage.updateCampaign(campaignId, {
        totalContacts: campaign.totalContacts + result.inserted,
      });

      const importResult: ContactImportResult = {
        imported: result.inserted,
        skipped: parsedContacts.length - validContacts.length,
        errors: result.failed > 0 ? [`${result.failed} contacts failed to insert`] : [],
        source: 'vcard',
      };

      res.json(importResult);
    } catch (error: any) {
      console.error('[Contact Import] vCard error:', error);
      res.status(500).json({ error: 'Failed to import vCard contacts: ' + error.message });
    }
  });

  router.post('/preview-csv', authenticateToken, upload.single('file'), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const fileContent = req.file.buffer
        ? req.file.buffer.toString('utf-8')
        : '';

      const parsed = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        preview: 5,
      });

      res.json({
        headers: parsed.meta.fields || [],
        preview: parsed.data.slice(0, 5),
        totalRows: fileContent.split('\n').length - 1,
      });
    } catch (error: any) {
      console.error('[Contact Import] Preview error:', error);
      res.status(500).json({ error: 'Failed to preview CSV' });
    }
  });

  router.get('/oauth/callback', async (req: Request, res: Response) => {
    const sendPopupMessage = (script: string, fallbackText: string) => {
      res.send(`<!DOCTYPE html><html><head><title>Authorization</title></head><body>
        <script>${script}</script>
        <p>${fallbackText}</p>
      </body></html>`);
    };

    try {
      console.log('[Contact Import] OAuth callback received. Full query:', JSON.stringify(req.query));
      console.log('[Contact Import] OAuth callback URL:', req.originalUrl);
      const { code, state, error: oauthError, scope: grantedScope } = req.query;

      if (oauthError) {
        return sendPopupMessage(
          `window.opener.postMessage({ type: 'oauth-error', error: ${JSON.stringify(String(oauthError))} }, window.location.origin); window.close();`,
          'Authorization failed. You can close this window.'
        );
      }

      if (!code || !state) {
        return sendPopupMessage(
          `window.opener.postMessage({ type: 'oauth-error', error: 'missing_params' }, window.location.origin); window.close();`,
          'Missing parameters. You can close this window.'
        );
      }

      const stateData = oauthService.verifyState(state as string);
      if (!stateData) {
        return sendPopupMessage(
          `window.opener.postMessage({ type: 'oauth-error', error: 'invalid_state' }, window.location.origin); window.close();`,
          'Invalid or expired state. You can close this window.'
        );
      }

      const providerSlug = stateData.slug;

      if (providerSlug === 'google-contacts' && grantedScope) {
        const scopeStr = String(grantedScope);
        if (!scopeStr.includes('contacts.readonly')) {
          console.warn('[Contact Import] Google did not grant contacts.readonly scope. Granted:', scopeStr);
          return sendPopupMessage(
            `window.opener.postMessage({ type: 'oauth-error', error: 'Google did not grant contacts permission. Please ensure the Google People API is enabled in your Google Cloud Console, then try again.' }, window.location.origin); window.close();`,
            'Contacts permission was not granted. Please enable the Google People API and try again.'
          );
        }
      }

      const credentials = getProviderCredentials(providerSlug);
      if (!credentials) {
        return sendPopupMessage(
          `window.opener.postMessage({ type: 'oauth-error', error: 'no_credentials' }, window.location.origin); window.close();`,
          'Platform credentials not configured. You can close this window.'
        );
      }

      const protocol = req.get('x-forwarded-proto') || req.protocol;
      const callbackUri = `${protocol}://${req.get('host')}/api/contact-import/oauth/callback`;
      const tokenBody = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: callbackUri,
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
      });

      const { getOAuthProvider } = await import('../services/oauth-providers');
      const provider = getOAuthProvider(providerSlug);
      if (!provider) {
        return sendPopupMessage(
          `window.opener.postMessage({ type: 'oauth-error', error: 'unknown_provider' }, window.location.origin); window.close();`,
          'Unknown provider. You can close this window.'
        );
      }

      const tokenResponse = await fetch(provider.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenBody.toString(),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error(`[Contact Import] Token exchange failed: ${tokenResponse.status} ${errorText}`);
        return sendPopupMessage(
          `window.opener.postMessage({ type: 'oauth-error', error: 'token_exchange_failed' }, window.location.origin); window.close();`,
          'Failed to exchange authorization code. You can close this window.'
        );
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      const accountInfo = await oauthService.fetchAccountInfo(providerSlug, accessToken);

      const messageData = JSON.stringify({
        type: 'oauth-success',
        provider: providerSlug,
        accessToken: accessToken,
        accountName: accountInfo?.accountName || '',
        accountEmail: accountInfo?.accountEmail || '',
      });

      sendPopupMessage(
        `window.opener.postMessage(${messageData}, window.location.origin); window.close();`,
        'Authorization successful! You can close this window.'
      );
    } catch (error: any) {
      console.error('[Contact Import] OAuth callback error:', error);
      sendPopupMessage(
        `window.opener.postMessage({ type: 'oauth-error', error: 'server_error' }, window.location.origin); window.close();`,
        'An error occurred. You can close this window.'
      );
    }
  });

  router.post('/google/auth-url', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const credentials = getProviderCredentials('google-contacts');
      if (!credentials) {
        return res.status(500).json({ error: 'Google OAuth credentials are not configured on the platform' });
      }

      const state = oauthService.generateState('contact-import', req.userId!, 'google-contacts');
      const protocol = req.get('x-forwarded-proto') || req.protocol;
      const callbackUri = `${protocol}://${req.get('host')}/api/contact-import/oauth/callback`;

      const params = new URLSearchParams({
        client_id: credentials.clientId,
        redirect_uri: callbackUri,
        response_type: 'code',
        state,
        scope: 'https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true',
      });

      res.json({
        authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      });
    } catch (error: any) {
      console.error('[Contact Import] Google auth URL error:', error);
      res.status(500).json({ error: 'Failed to generate Google auth URL' });
    }
  });

  router.post('/google/fetch', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { accessToken } = req.body;

      if (!accessToken) {
        return res.status(400).json({ error: 'Access token is required' });
      }

      const campaign = await getOrCreateImportCampaign(req.userId!);
      const campaignId = campaign.id;

      let googleContacts;
      try {
        googleContacts = await fetchGoogleContacts(accessToken);
      } catch (fetchErr: any) {
        if (fetchErr.message?.includes('403') && fetchErr.message?.includes('SCOPE_INSUFFICIENT')) {
          return res.status(403).json({ 
            error: 'Google Contacts permission was not granted. Please sign in with Google again and make sure to allow contacts access.',
            code: 'SCOPE_INSUFFICIENT'
          });
        }
        throw fetchErr;
      }
      const validContacts = googleContacts.filter(c => c.phone || c.email).slice(0, MAX_IMPORT_CONTACTS);

      if (validContacts.length === 0) {
        return res.json({ imported: 0, skipped: 0, errors: ['No contacts with phone or email found in Google'], source: 'google' });
      }

      const insertData: InsertContact[] = validContacts.map(c => ({
        campaignId,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        email: c.email,
        customFields: c.customFields,
        status: 'pending',
      }));

      const result = await batchInsertContacts(insertData, '📥 [Google Import]');

      await storage.updateCampaign(campaignId, {
        totalContacts: campaign.totalContacts + result.inserted,
      });

      res.json({
        imported: result.inserted,
        skipped: googleContacts.length - validContacts.length,
        errors: result.failed > 0 ? [`${result.failed} contacts failed to insert`] : [],
        source: 'google',
      });
    } catch (error: any) {
      console.error('[Contact Import] Google fetch error:', error);
      res.status(500).json({ error: 'Failed to import Google contacts: ' + error.message });
    }
  });

  router.post('/google/exchange-code', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({ error: 'Authorization code is required' });
      }

      const credentials = getProviderCredentials('google-contacts');
      if (!credentials) {
        return res.status(500).json({ error: 'Google OAuth credentials are not configured on the platform' });
      }

      const protocol = req.get('x-forwarded-proto') || req.protocol;
      const callbackUri = `${protocol}://${req.get('host')}/api/contact-import/oauth/callback`;
      const tokenBody = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUri,
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
      });

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenBody.toString(),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error(`[Contact Import] Google token exchange failed: ${tokenResponse.status} ${errorText}`);
        return res.status(400).json({ error: 'Failed to exchange authorization code' });
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      const accountInfo = await oauthService.fetchAccountInfo('google-contacts', accessToken);

      res.json({
        accessToken,
        accountName: accountInfo?.accountName || null,
        accountEmail: accountInfo?.accountEmail || null,
      });
    } catch (error: any) {
      console.error('[Contact Import] Google code exchange error:', error);
      res.status(500).json({ error: 'Failed to exchange Google auth code' });
    }
  });

  router.post('/microsoft/auth-url', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const credentials = getProviderCredentials('microsoft-contacts');
      if (!credentials) {
        return res.status(500).json({ error: 'Microsoft OAuth credentials are not configured on the platform' });
      }

      const state = oauthService.generateState('contact-import', req.userId!, 'microsoft-contacts');
      const protocol = req.get('x-forwarded-proto') || req.protocol;
      const callbackUri = `${protocol}://${req.get('host')}/api/contact-import/oauth/callback`;

      const params = new URLSearchParams({
        client_id: credentials.clientId,
        redirect_uri: callbackUri,
        response_type: 'code',
        state,
        scope: 'openid profile email offline_access Contacts.Read User.Read',
        prompt: 'consent',
      });

      const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
      console.log('[Contact Import] Microsoft auth URL generated:', authUrl);
      console.log('[Contact Import] Microsoft client_id used:', credentials.clientId);
      console.log('[Contact Import] Microsoft redirect_uri:', callbackUri);
      res.json({ authUrl });
    } catch (error: any) {
      console.error('[Contact Import] Microsoft auth URL error:', error);
      res.status(500).json({ error: 'Failed to generate Microsoft auth URL' });
    }
  });

  router.post('/microsoft/exchange-code', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({ error: 'Authorization code is required' });
      }

      const credentials = getProviderCredentials('microsoft-contacts');
      if (!credentials) {
        return res.status(500).json({ error: 'Microsoft OAuth credentials are not configured on the platform' });
      }

      const protocol = req.get('x-forwarded-proto') || req.protocol;
      const callbackUri = `${protocol}://${req.get('host')}/api/contact-import/oauth/callback`;
      const tokenBody = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUri,
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
      });

      const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenBody.toString(),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error(`[Contact Import] Microsoft token exchange failed: ${tokenResponse.status} ${errorText}`);
        return res.status(400).json({ error: 'Failed to exchange authorization code' });
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      const accountInfo = await oauthService.fetchAccountInfo('microsoft-contacts', accessToken);

      res.json({
        accessToken,
        accountName: accountInfo?.accountName || null,
        accountEmail: accountInfo?.accountEmail || null,
      });
    } catch (error: any) {
      console.error('[Contact Import] Microsoft code exchange error:', error);
      res.status(500).json({ error: 'Failed to exchange Microsoft auth code' });
    }
  });

  router.post('/microsoft/fetch', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { accessToken } = req.body;

      if (!accessToken) {
        return res.status(400).json({ error: 'Access token is required' });
      }

      const campaign = await getOrCreateImportCampaign(req.userId!);
      const campaignId = campaign.id;

      const msContacts = await fetchMicrosoftContacts(accessToken);
      const validContacts = msContacts.filter(c => c.phone || c.email).slice(0, MAX_IMPORT_CONTACTS);

      if (validContacts.length === 0) {
        return res.json({ imported: 0, skipped: 0, errors: ['No contacts with phone or email found in Outlook'], source: 'microsoft' });
      }

      const insertData: InsertContact[] = validContacts.map(c => ({
        campaignId,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        email: c.email,
        customFields: c.customFields,
        status: 'pending',
      }));

      const result = await batchInsertContacts(insertData, '📥 [Microsoft Import]');

      await storage.updateCampaign(campaignId, {
        totalContacts: campaign.totalContacts + result.inserted,
      });

      res.json({
        imported: result.inserted,
        skipped: msContacts.length - validContacts.length,
        errors: result.failed > 0 ? [`${result.failed} contacts failed to insert`] : [],
        source: 'microsoft',
      });
    } catch (error: any) {
      console.error('[Contact Import] Microsoft fetch error:', error);
      res.status(500).json({ error: 'Failed to import Outlook contacts: ' + error.message });
    }
  });

  router.post('/hubspot/fetch', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { accessToken } = req.body;

      if (!accessToken) {
        return res.status(400).json({ error: 'Access token is required' });
      }

      const campaign = await getOrCreateImportCampaign(req.userId!);
      const campaignId = campaign.id;

      const hubspotContacts = await fetchHubSpotContacts(accessToken);
      const validContacts = hubspotContacts.filter(c => c.phone || c.email);

      if (validContacts.length === 0) {
        return res.json({ imported: 0, skipped: 0, errors: ['No contacts with phone or email found in HubSpot'], source: 'hubspot' });
      }

      const insertData: InsertContact[] = validContacts.map(c => ({
        campaignId,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        email: c.email,
        customFields: c.customFields,
        status: 'pending',
      }));

      const result = await batchInsertContacts(insertData, '📥 [HubSpot Import]');

      await storage.updateCampaign(campaignId, {
        totalContacts: campaign.totalContacts + result.inserted,
      });

      res.json({
        imported: result.inserted,
        skipped: hubspotContacts.length - validContacts.length,
        errors: result.failed > 0 ? [`${result.failed} contacts failed to insert`] : [],
        source: 'hubspot',
      });
    } catch (error: any) {
      console.error('[Contact Import] HubSpot fetch error:', error);
      res.status(500).json({ error: 'Failed to import HubSpot contacts: ' + error.message });
    }
  });

  router.post('/salesforce/fetch', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { accessToken, instanceUrl } = req.body;

      if (!accessToken) {
        return res.status(400).json({ error: 'Access token is required' });
      }

      const campaign = await getOrCreateImportCampaign(req.userId!);
      const campaignId = campaign.id;

      const sfContacts = await fetchSalesforceContacts(accessToken, instanceUrl);
      const validContacts = sfContacts.filter(c => c.phone || c.email);

      if (validContacts.length === 0) {
        return res.json({ imported: 0, skipped: 0, errors: ['No contacts with phone or email found in Salesforce'], source: 'salesforce' });
      }

      const insertData: InsertContact[] = validContacts.map(c => ({
        campaignId,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        email: c.email,
        customFields: c.customFields,
        status: 'pending',
      }));

      const result = await batchInsertContacts(insertData, '📥 [Salesforce Import]');

      await storage.updateCampaign(campaignId, {
        totalContacts: campaign.totalContacts + result.inserted,
      });

      res.json({
        imported: result.inserted,
        skipped: sfContacts.length - validContacts.length,
        errors: result.failed > 0 ? [`${result.failed} contacts failed to insert`] : [],
        source: 'salesforce',
      });
    } catch (error: any) {
      console.error('[Contact Import] Salesforce fetch error:', error);
      res.status(500).json({ error: 'Failed to import Salesforce contacts: ' + error.message });
    }
  });

  return router;
}
