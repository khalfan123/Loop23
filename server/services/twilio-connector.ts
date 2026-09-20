'use strict';
/**
 * ============================================================
 * © 2025 Diploy — a brand of Bisht Technologies Private Limited
 * Original Author: BTPL Engineering Team
 * Website: https://diploy.in
 * Contact: cs@diploy.in
 *
 * Distributed under the Envato / CodeCanyon License Agreement.
 * Licensed to the purchaser for use as defined by the
 * Envato Market (CodeCanyon) Regular or Extended License.
 *
 * You are NOT permitted to redistribute, resell, sublicense,
 * or share this source code, in whole or in part.
 * Respect the author's rights and Envato licensing terms.
 * ============================================================
 */
import twilio from 'twilio';
import { storage } from '../storage';
import { ExternalServiceError } from '../utils/errors';
import { WorkspaceService } from './workspace-service';

/**
 * Get Twilio credentials from database or environment variables
 * 
 * Environment Variables:
 * - TWILIO_ACCOUNT_SID: Your Twilio Account SID
 * - TWILIO_AUTH_TOKEN: Your Twilio Auth Token
 * 
 * Alternatively, configure via Admin Panel > Settings > Twilio Configuration
 */
async function getCredentials() {
  // First, check if credentials are stored in database (Admin Panel configuration)
  const dbAccountSid = await storage.getGlobalSetting('twilio_account_sid');
  const dbAuthToken = await storage.getGlobalSetting('twilio_auth_token');
  
  if (dbAccountSid?.value && dbAuthToken?.value) {
    console.log('📞 Using Twilio credentials from database');
    return {
      accountSid: dbAccountSid.value,
      apiKey: dbAccountSid.value,
      apiKeySecret: dbAuthToken.value,
      phoneNumber: null
    };
  }

  // Fall back to environment variables.
  // Project-specific names (TWILIO_ACCOUNT_SID_UAE / AUTH_TWILIO_UAE) take
  // priority over the generic names so deployments with multiple Twilio
  // accounts can scope which one this app uses without disturbing others.
  // IMPORTANT: pair atomicity — never mix the SID from one pair with the
  // token from another. If only one half of the UAE pair is set, fall
  // through to the generic pair as a complete unit.
  const envCreds = getEnvTwilioCredentials();

  if (envCreds.accountSid && envCreds.authToken) {
    const usingUae = !!(process.env.TWILIO_ACCOUNT_SID_UAE && process.env.AUTH_TWILIO_UAE);
    console.log(`📞 Using Twilio credentials from environment variables (${usingUae ? 'UAE-scoped' : 'standard'})`);
    return {
      accountSid: envCreds.accountSid,
      apiKey: envCreds.accountSid,
      apiKeySecret: envCreds.authToken,
      phoneNumber: null
    };
  }

  throw new ExternalServiceError(
    'Twilio',
    'No Twilio credentials found. Set TWILIO_ACCOUNT_SID_UAE + AUTH_TWILIO_UAE (or TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN) in Secrets, or configure via Admin Panel > Settings.',
    undefined,
    { operation: 'getCredentials' }
  );
}

export async function getTwilioClient() {
  const credentials = await getCredentials();
  return twilio(credentials.apiKey as string, credentials.apiKeySecret as string, {
    accountSid: credentials.accountSid as string
  });
}

/**
 * Workspace-scoped Twilio client (customer subaccount).
 * Requires the workspace to have a provisioned subaccount.
 */
export async function getWorkspaceTwilioClient(workspaceId: string) {
  const creds = await WorkspaceService.getWorkspaceTwilioSubaccountCredentials(workspaceId);
  if (!creds) {
    throw new ExternalServiceError(
      'Twilio',
      'Workspace Twilio subaccount is not provisioned yet.',
      undefined,
      { operation: 'getWorkspaceTwilioClient', workspaceId }
    );
  }
  return twilio(creds.accountSid, creds.authToken, { accountSid: creds.accountSid });
}

export async function getTwilioFromPhoneNumber() {
  const { phoneNumber } = await getCredentials();
  return phoneNumber;
}

export async function getTwilioAccountSid(): Promise<string> {
  const credentials = await getCredentials();
  return credentials.accountSid as string;
}

export async function getTwilioAuthToken(): Promise<string> {
  const credentials = await getCredentials();
  return credentials.apiKeySecret as string;
}

/**
 * Resolve Twilio credentials from environment variables only (no DB lookup).
 *
 * Priority: project-specific TWILIO_ACCOUNT_SID_UAE / AUTH_TWILIO_UAE pair
 * over the generic TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN pair. This mirrors
 * the priority used by getCredentials() so endpoints that need to read env
 * directly (e.g. webhook signature validation, status pages, the
 * "import existing Twilio numbers" view) all see the same active account.
 *
 * Pair atomicity: a SID and token are only returned together if both halves
 * of the SAME pair are set. We never mix the SID from one pair with the
 * token from another, since that would talk to the wrong account or fail
 * signature validation. If neither pair is complete, returns nulls.
 */
export function getEnvTwilioCredentials(): { accountSid: string | null; authToken: string | null } {
  const uaeSid = process.env.TWILIO_ACCOUNT_SID_UAE;
  const uaeToken = process.env.AUTH_TWILIO_UAE;
  if (uaeSid && uaeToken) {
    return { accountSid: uaeSid, authToken: uaeToken };
  }

  const stdSid = process.env.TWILIO_ACCOUNT_SID;
  const stdToken = process.env.TWILIO_AUTH_TOKEN;
  if (stdSid && stdToken) {
    return { accountSid: stdSid, authToken: stdToken };
  }

  return { accountSid: null, authToken: null };
}

/**
 * True if either Twilio env var pair is fully configured. Used by status /
 * health-check endpoints that just need a yes/no signal.
 */
export function isTwilioEnvConfigured(): boolean {
  const { accountSid, authToken } = getEnvTwilioCredentials();
  return !!(accountSid && authToken);
}