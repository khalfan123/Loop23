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

import { Router, Request, Response } from "express";
import { RouteContext, AuthRequest } from "./common";
import { eq, and, isNull, sql } from "drizzle-orm";
import { phoneNumbers, creditTransactions, phoneNumberRentals } from "@shared/schema";
import { WorkspaceService } from "../services/workspace-service";

const COUNTRY_PREFIX_MAP: Record<string, string> = {
  '+971': 'AE', '+966': 'SA', '+974': 'QA', '+973': 'BH', '+968': 'OM', '+965': 'KW',
  '+353': 'IE', '+351': 'PT', '+358': 'FI',
  '+61': 'AU', '+44': 'GB', '+49': 'DE', '+33': 'FR', '+39': 'IT',
  '+34': 'ES', '+31': 'NL', '+32': 'BE', '+43': 'AT', '+41': 'CH',
  '+46': 'SE', '+47': 'NO', '+45': 'DK',
  '+48': 'PL', '+64': 'NZ', '+65': 'SG', '+81': 'JP', '+82': 'KR',
  '+91': 'IN', '+86': 'CN', '+55': 'BR', '+52': 'MX',
  '+27': 'ZA', '+60': 'MY', '+63': 'PH', '+66': 'TH',
  '+1': 'US',
};
const SORTED_PREFIXES = Object.keys(COUNTRY_PREFIX_MAP).sort((a, b) => b.length - a.length);

function detectCountryFromNumber(phoneNumber: string): string {
  for (const prefix of SORTED_PREFIXES) {
    if (phoneNumber.startsWith(prefix)) {
      return COUNTRY_PREFIX_MAP[prefix];
    }
  }
  return 'US';
}

function detectNumberTypeFromNumber(phoneNumber: string): string {
  if (/^\+1(800|888|877|866|855|844|833)/.test(phoneNumber)) return 'toll_free';
  if (/^\+971800/.test(phoneNumber)) return 'toll_free';
  if (/^\+44(800|808)/.test(phoneNumber)) return 'toll_free';
  if (/^\+61(1800|1300)/.test(phoneNumber)) return 'toll_free';
  if (/^\+49(800)/.test(phoneNumber)) return 'toll_free';
  if (/^\+33(800|805)/.test(phoneNumber)) return 'toll_free';
  return 'local';
}

export function createPhoneRoutes(ctx: RouteContext): Router {
  const router = Router();
  const { db, storage, authenticateToken, authenticateHybrid, requireRole, checkActiveMembership, twilioService } = ctx;

  // Twilio Addresses - For regulatory compliance in countries like Australia, UK, Germany
  router.get("/api/twilio/addresses", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { country } = req.query;
      const addresses = await twilioService.listAddresses(country as string);
      res.json(addresses);
    } catch (error: any) {
      console.error("List Twilio addresses error:", error);
      
      if (error.message?.includes('Authentication') || error.message?.includes('not connected') || error.status === 401) {
        return res.status(503).json({ 
          error: "Twilio credentials not configured", 
          message: "Please configure your Twilio credentials to view addresses."
        });
      }
      
      res.status(500).json({ error: error.message || "Failed to list addresses" });
    }
  });
  
  router.get("/api/twilio/address-requirements/:country", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { country } = req.params;
      const requirement = await twilioService.getAddressRequirements(country.toUpperCase());
      res.json({ 
        country: country.toUpperCase(),
        requirement,
        requiresAddress: requirement !== 'none',
        requiresLocalAddress: requirement === 'local',
        message: requirement === 'none' 
          ? 'No address required for this country'
          : requirement === 'local'
            ? `An address within ${country.toUpperCase()} is required for phone number purchase`
            : 'Any verified address is required for phone number purchase'
      });
    } catch (error: any) {
      console.error("Get address requirements error:", error);
      res.status(500).json({ error: error.message || "Failed to get address requirements" });
    }
  });

  // Phone Numbers routes
  router.get("/api/phone-numbers", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const userPhoneNumbers = await storage.getUserPhoneNumbers(req.userId!);
      
      const user = await storage.getUser(req.userId!);
      
      let allPhoneNumbers = [...userPhoneNumbers];
      if (user && user.planType === 'free') {
        const systemPoolNumbers = await db
          .select()
          .from(phoneNumbers)
          .where(
            and(
              eq(phoneNumbers.isSystemPool, true),
              isNull(phoneNumbers.userId)
            )
          );
        allPhoneNumbers = [...allPhoneNumbers, ...systemPoolNumbers];
      }
      
      res.json(allPhoneNumbers);
    } catch (error: any) {
      console.error("Get phone numbers error:", error);
      res.status(500).json({ error: "Failed to get phone numbers" });
    }
  });

  /**
   * Provider inventory: list all inbound phone numbers present in the connected account for this user's workspace.
   * This is independent from whether the number has been "imported" into our DB.
   */
  router.get("/api/phone-numbers/inventory", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
      if (!workspace) {
        return res.status(400).json({ error: "No workspace found for user" });
      }
      await WorkspaceService.ensureTwilioSubaccountProvisioned(workspace.id);

      const owned = await twilioService.listOwnedNumbers({ workspaceId: workspace.id });

      const existingNumbersDb = await db.select({ phoneNumber: phoneNumbers.phoneNumber }).from(phoneNumbers);
      const existingSet = new Set(existingNumbersDb.map((n) => n.phoneNumber));

      const inventory = owned.map((n) => ({
        phoneNumber: n.phoneNumber,
        friendlyName: n.friendlyName,
        sid: n.sid,
        capabilities: n.capabilities,
        country: detectCountryFromNumber(n.phoneNumber),
        numberType: detectNumberTypeFromNumber(n.phoneNumber),
        allocated: existingSet.has(n.phoneNumber),
      }));

      res.json(inventory);
    } catch (error: any) {
      console.error("Get phone number inventory error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch phone number inventory" });
    }
  });

  router.get("/api/phone-numbers/search", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { country, areaCode, postalCode, locality, region, contains, numberType } = req.query;
      
      if (!country) {
        return res.status(400).json({ error: "Country is required" });
      }

      const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
      if (!workspace) {
        return res.status(400).json({ error: "No workspace found for user" });
      }
      await WorkspaceService.ensureTwilioSubaccountProvisioned(workspace.id);

      const availableNumbers = await twilioService.searchAvailableNumbers({
        workspaceId: workspace.id,
        country: (country as string),
        areaCode: areaCode as string,
        contains: contains as string,
        inPostalCode: postalCode as string,
        inLocality: locality as string,
        inRegion: region as string,
        numberType: (numberType as string) || 'local',
        limit: 20,
      });

      res.json(availableNumbers);
    } catch (error: any) {
      console.error("Search phone numbers error:", error);
      
      if (error.message?.includes('Authentication') || error.message?.includes('not connected') || error.status === 401) {
        return res.status(503).json({ 
          error: "Twilio credentials not configured", 
          message: "Please configure your Twilio credentials. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in your .env file, or configure via Admin Panel > Settings. Get your credentials from console.twilio.com"
        });
      }
      
      res.status(500).json({ error: error.message || "Failed to search phone numbers" });
    }
  });
  
  // Legacy route for backward compatibility
  router.get("/api/phone-numbers/search/:areaCode", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { areaCode } = req.params;
      
      if (!areaCode || areaCode.length !== 3) {
        return res.status(400).json({ error: "Area code must be exactly 3 digits" });
      }

      const availableNumbers = await twilioService.searchAvailableNumbers({
        areaCode,
        limit: 20,
      });

      res.json(availableNumbers);
    } catch (error: any) {
      console.error("Search phone numbers error:", error);
      
      if (error.message?.includes('Authentication') || error.message?.includes('not connected') || error.status === 401) {
        return res.status(503).json({ 
          error: "Twilio credentials not configured", 
          message: "Please configure your Twilio credentials. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in your .env file, or configure via Admin Panel > Settings. Get your credentials from console.twilio.com"
        });
      }
      
      res.status(500).json({ error: error.message || "Failed to search phone numbers" });
    }
  });

  router.get("/api/phone-numbers/twilio-existing", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const dbSid = await storage.getGlobalSetting('twilio_account_sid');
      const dbToken = await storage.getGlobalSetting('twilio_auth_token');

      const { getEnvTwilioCredentials } = await import('../services/twilio-connector');
      const envCreds = getEnvTwilioCredentials();
      const accountSid = (dbSid?.value as string) || envCreds.accountSid;
      const authToken = (dbToken?.value as string) || envCreds.authToken;

      if (!accountSid || !authToken) {
        return res.json({ numbers: [], _debug: { error: 'No Twilio credentials configured' } });
      }
      
      const twilio = (await import('twilio')).default;
      const client = twilio(accountSid, authToken);
      
      // Collect all numbers across main + all accessible accounts
      let allNumbers: any[] = [];
      const accountsScanned: Array<{ sid: string; friendlyName: string; status: string; numberCount: number; isMain: boolean }> = [];

      // 1. Fetch main account numbers
      try {
        const mainNumbers = await client.incomingPhoneNumbers.list({ limit: 1000 });
        console.log(`[UAE Numbers] Main account (${accountSid}): ${mainNumbers.length} number(s)`);
        mainNumbers.forEach(n => console.log(`[UAE Numbers]   Main: ${n.phoneNumber} (${n.friendlyName})`));
        allNumbers = allNumbers.concat(mainNumbers.map((n: any) => ({ ...n, _accountSid: accountSid })));
        accountsScanned.push({ sid: accountSid, friendlyName: 'Main account', status: 'active', numberCount: mainNumbers.length, isMain: true });
      } catch (err: any) {
        console.warn(`[UAE Numbers] Failed to list main account numbers: ${err.message}`);
      }

      // 2. List ALL accounts the credentials can see (main + sub-accounts)
      try {
        const allAccounts = await client.api.v2010.accounts.list({ limit: 100 });
        console.log(`[UAE Numbers] accounts.list() returned ${allAccounts.length} account(s) total`);
        allAccounts.forEach(a => console.log(`[UAE Numbers]   Account: ${a.sid} - "${a.friendlyName}" (status: ${a.status}, type: ${a.type})`));

        for (const acct of allAccounts) {
          if (acct.sid === accountSid) continue; // already scanned as main
          try {
            const acctNumbers = await client.api.v2010.accounts(acct.sid).incomingPhoneNumbers.list({ limit: 1000 });
            console.log(`[UAE Numbers] Sub-account ${acct.sid} ("${acct.friendlyName}"): ${acctNumbers.length} number(s)`);
            acctNumbers.forEach((n: any) => console.log(`[UAE Numbers]   Sub: ${n.phoneNumber} (${n.friendlyName})`));
            allNumbers = allNumbers.concat(acctNumbers.map((n: any) => ({ ...n, _accountSid: acct.sid })));
            accountsScanned.push({ sid: acct.sid, friendlyName: acct.friendlyName || '', status: acct.status, numberCount: acctNumbers.length, isMain: false });
          } catch (subErr: any) {
            console.warn(`[UAE Numbers] Could not fetch numbers for ${acct.sid}: ${subErr.message}`);
            accountsScanned.push({ sid: acct.sid, friendlyName: acct.friendlyName || '', status: acct.status, numberCount: -1, isMain: false });
          }
        }
      } catch (acctErr: any) {
        console.warn(`[UAE Numbers] Could not list accounts: ${acctErr.message}`);
      }

      console.log(`[UAE Numbers] Total numbers across all scanned accounts: ${allNumbers.length}`);
      
      // Get numbers already in our database to mark them as allocated
      const existingNumbersDb = await db.select({ phoneNumber: phoneNumbers.phoneNumber }).from(phoneNumbers);
      const existingSet = new Set(existingNumbersDb.map(n => n.phoneNumber));
      
      // Filter to UAE only — mark allocated ones so UI can disable them
      const uaeNumbers = allNumbers
        .filter(n => n.phoneNumber && n.phoneNumber.startsWith('+971'))
        .map(n => ({
          sid: n.sid,
          phoneNumber: n.phoneNumber,
          friendlyName: n.friendlyName,
          capabilities: n.capabilities,
          allocated: existingSet.has(n.phoneNumber),
          accountSid: n._accountSid,
        }));
      
      console.log(`[UAE Numbers] UAE numbers (+971) found: ${uaeNumbers.length}`);

      // Backwards compat: if numbers found, return array directly. Otherwise return diagnostic object.
      if (uaeNumbers.length > 0) {
        return res.json(uaeNumbers);
      }

      return res.json({
        numbers: [],
        _debug: {
          credentialsAccountSid: accountSid,
          accountsScanned,
          totalNumbersFound: allNumbers.length,
          allNumbers: allNumbers.map((n: any) => ({ phoneNumber: n.phoneNumber, accountSid: n._accountSid })),
          message: 'No UAE numbers (+971) found in the accounts accessible by these Twilio credentials. The numbers may be in a different Twilio account.',
        },
      });
    } catch (error: any) {
      console.error('Error fetching existing Twilio numbers:', error);
      res.json({ numbers: [], _debug: { error: error.message } });
    }
  });

  router.post("/api/phone-numbers/import-existing", authenticateToken, checkActiveMembership(storage), async (req: AuthRequest, res: Response) => {
    try {
      const { phoneNumber, twilioSid, friendlyName, capabilities } = req.body;

      if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number is required" });
      }

      const existing = await db.select().from(phoneNumbers).where(eq(phoneNumbers.phoneNumber, phoneNumber));
      if (existing.length > 0) {
        return res.status(400).json({ error: "Phone number already exists in the system" });
      }

      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { getUserPlanCapabilities } = await import('../services/membership-service');
      const planCapabilities = await getUserPlanCapabilities(req.userId!);
      if (!planCapabilities.canPurchaseNumbers) {
        return res.status(403).json({
          error: "Plan upgrade required",
          message: `Your ${planCapabilities.planDisplayName} plan does not allow purchasing phone numbers. Please upgrade to Pro.`,
          upgradeRequired: true
        });
      }

      const twilioKycSetting = await storage.getGlobalSetting('twilio_kyc_required');
      const twilioKycRequired = twilioKycSetting?.value === true || twilioKycSetting?.value === 'true';
      
      if (twilioKycRequired) {
        const { KycService } = await import('../engines/kyc/services/kyc.service');
        const kycStatus = await KycService.getUserKycStatus(req.userId!);
        
        if (kycStatus.status !== 'approved') {
          return res.status(403).json({
            error: "KYC verification required",
            message: "You must complete KYC verification before importing phone numbers.",
            kycRequired: true,
            kycStatus: kycStatus.status
          });
        }
      }

      const isAdmin = user.role === 'admin' || user.role === 'superadmin';
      
      if (!isAdmin) {
        const effectiveLimits = await storage.getUserEffectiveLimits(req.userId!);
        const currentPhoneCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(phoneNumbers)
          .where(eq(phoneNumbers.userId, req.userId!));
        
        const phoneCount = Number(currentPhoneCount[0]?.count || 0);
        const maxPhoneNumbers = typeof effectiveLimits.maxPhoneNumbers === 'number' ? effectiveLimits.maxPhoneNumbers : 0;
        if (maxPhoneNumbers !== 999 && maxPhoneNumbers !== -1 && phoneCount >= maxPhoneNumbers) {
          return res.status(403).json({ 
            error: "Phone number limit reached", 
            message: `You have reached your maximum of ${maxPhoneNumbers} phone numbers.`,
            limit: maxPhoneNumbers,
            current: phoneCount
          });
        }
      }

      const phoneNumberCostSetting = await storage.getGlobalSetting('phone_number_monthly_credits');
      const monthlyCredits = (phoneNumberCostSetting?.value as number) || 50;

      if (process.env.NODE_ENV !== 'development') {
        if ((user.credits || 0) < monthlyCredits) {
          return res.status(400).json({ 
            error: `Insufficient credits. Phone number import requires ${monthlyCredits} credits per month. You have ${user.credits || 0} credits.` 
          });
        }
      }

      const detectedCountry = detectCountryFromNumber(phoneNumber);
      const detectedNumberType = detectNumberTypeFromNumber(phoneNumber);

      const { ElevenLabsPoolService } = await import('../services/elevenlabs-pool');
      const credentialToUse = await ElevenLabsPoolService.getUserCredential(req.userId!);
      
      if (!credentialToUse) {
        return res.status(500).json({ error: 'No active ElevenLabs API keys available in pool' });
      }

      let dbPhoneNumber;
      const nextBillingDate = new Date();
      nextBillingDate.setDate(nextBillingDate.getDate() + 30);

      if (process.env.NODE_ENV !== 'development') {
        await db.transaction(async (tx) => {
          await tx.insert(creditTransactions).values({
            userId: req.userId!,
            type: 'debit',
            amount: monthlyCredits,
            description: `Phone number import: ${phoneNumber}`,
          });

          await tx.execute(sql`
            UPDATE users 
            SET credits = COALESCE(credits, 0) - ${monthlyCredits}
            WHERE id = ${req.userId!}
          `);

          const [phoneNumberRecord] = await tx.insert(phoneNumbers).values({
            userId: req.userId!,
            phoneNumber: phoneNumber,
            twilioSid: twilioSid || 'imported-' + Date.now(),
            friendlyName: friendlyName || phoneNumber,
            country: detectedCountry,
            capabilities: capabilities || null,
            numberType: detectedNumberType,
            status: "active",
            isSystemPool: false,
            monthlyCredits: monthlyCredits,
            nextBillingDate: nextBillingDate,
            elevenLabsCredentialId: credentialToUse.id,
          }).returning();

          dbPhoneNumber = phoneNumberRecord;

          await tx.insert(phoneNumberRentals).values({
            phoneNumberId: phoneNumberRecord.id,
            userId: req.userId!,
            creditsCharged: monthlyCredits,
            status: 'success',
          });
        });
      } else {
        const [devPhoneNumber] = await db.insert(phoneNumbers).values({
          userId: req.userId!,
          phoneNumber: phoneNumber,
          twilioSid: twilioSid || 'imported-' + Date.now(),
          friendlyName: friendlyName || phoneNumber,
          country: detectedCountry,
          capabilities: capabilities || null,
          numberType: detectedNumberType,
          status: "active",
          isSystemPool: false,
          monthlyCredits: monthlyCredits,
          nextBillingDate: nextBillingDate,
          elevenLabsCredentialId: credentialToUse.id,
        }).returning();
        
        dbPhoneNumber = devPhoneNumber;
      }

      if (dbPhoneNumber) {
        try {
          const { ElevenLabsService } = await import('../services/elevenlabs');
          const elevenLabsService = new ElevenLabsService(credentialToUse.apiKey);
          
          const { getTwilioAccountSid, getTwilioAuthToken } = await import('../services/twilio-connector');
          const twilioAccountSid = await getTwilioAccountSid();
          const twilioAuthToken = await getTwilioAuthToken();
          
          const elevenLabsResult = await elevenLabsService.syncPhoneNumberToElevenLabs({
            phoneNumber: phoneNumber,
            twilioAccountSid,
            twilioAuthToken,
            label: friendlyName || phoneNumber,
          });
          
          await db.update(phoneNumbers)
            .set({ 
              elevenLabsPhoneNumberId: elevenLabsResult.phone_number_id,
              elevenLabsCredentialId: credentialToUse.id,
            })
            .where(eq(phoneNumbers.id, dbPhoneNumber.id));
          
          dbPhoneNumber.elevenLabsPhoneNumberId = elevenLabsResult.phone_number_id;
          dbPhoneNumber.elevenLabsCredentialId = credentialToUse.id;
        } catch (elevenLabsError: any) {
          console.error('⚠️  [Import] Failed to sync imported number to ElevenLabs:', elevenLabsError.message);
        }
      }

      res.json(dbPhoneNumber);
    } catch (error: any) {
      console.error("Import phone number error:", error);
      res.status(500).json({ error: error.message || "Failed to import phone number" });
    }
  });

  router.post("/api/phone-numbers/buy", authenticateToken, checkActiveMembership(storage), async (req: AuthRequest, res: Response) => {
    try {
      const { phoneNumber, friendlyName, addressSid, bundleSid, country, numberType: reqNumberType } = req.body;

      if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number is required" });
      }

      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { getUserPlanCapabilities } = await import('../services/membership-service');
      const capabilities = await getUserPlanCapabilities(req.userId!);
      if (!capabilities.canPurchaseNumbers) {
        return res.status(403).json({
          error: "Plan upgrade required",
          message: `Your ${capabilities.planDisplayName} plan does not allow purchasing phone numbers. Please upgrade to Pro to purchase your own phone numbers.`,
          upgradeRequired: true
        });
      }
      
      // KYC Verification Check for Twilio
      const twilioKycSetting = await storage.getGlobalSetting('twilio_kyc_required');
      const twilioKycRequired = twilioKycSetting?.value === true || twilioKycSetting?.value === 'true';
      
      if (twilioKycRequired) {
        const { KycService } = await import('../engines/kyc/services/kyc.service');
        const kycStatus = await KycService.getUserKycStatus(req.userId!);
        
        if (kycStatus.status !== 'approved') {
          return res.status(403).json({
            error: "KYC verification required",
            message: "You must complete KYC verification before purchasing Twilio phone numbers. Please upload your documents in Settings.",
            kycRequired: true,
            kycStatus: kycStatus.status
          });
        }
      }
      
      // Admin users have unlimited phone numbers
      const isAdmin = user.role === 'admin' || user.role === 'superadmin';
      
      if (!isAdmin) {
        const effectiveLimits = await storage.getUserEffectiveLimits(req.userId!);
        const currentPhoneCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(phoneNumbers)
          .where(eq(phoneNumbers.userId, req.userId!));
        
        const phoneCount = Number(currentPhoneCount[0]?.count || 0);
        const maxPhoneNumbers = typeof effectiveLimits.maxPhoneNumbers === 'number' ? effectiveLimits.maxPhoneNumbers : 0;
        // Skip limit check if explicitly unlimited (999 or -1)
        if (maxPhoneNumbers !== 999 && maxPhoneNumbers !== -1 && phoneCount >= maxPhoneNumbers) {
          return res.status(403).json({ 
            error: "Phone number limit reached", 
            message: `You have reached your maximum of ${maxPhoneNumbers} phone numbers. Please upgrade your plan or release existing numbers.`,
            limit: maxPhoneNumbers,
            current: phoneCount
          });
        }
      }

      const phoneNumberCostSetting = await storage.getGlobalSetting('phone_number_monthly_credits');
      const monthlyCredits = (phoneNumberCostSetting?.value as number) || 50;

      if (process.env.NODE_ENV !== 'development') {
        if ((user.credits || 0) < monthlyCredits) {
          return res.status(400).json({ 
            error: `Insufficient credits. Phone number rental requires ${monthlyCredits} credits per month. You have ${user.credits || 0} credits.` 
          });
        }
      }

      // Server-side validation for address requirements (regulatory compliance)
      // Use country from request (preferred) or detect from phone number prefix as fallback
      let phoneCountry = country?.toUpperCase() || null;
      
      // Fallback: detect from phone number prefix if country not provided
      if (!phoneCountry) {
        const prefixMap: Record<string, string> = {
          '+61': 'AU', '+44': 'GB', '+49': 'DE', '+33': 'FR', '+39': 'IT',
          '+34': 'ES', '+31': 'NL', '+32': 'BE', '+43': 'AT', '+41': 'CH',
          '+353': 'IE', '+351': 'PT', '+48': 'PL', '+46': 'SE', '+47': 'NO',
          '+45': 'DK', '+358': 'FI', '+64': 'NZ', '+65': 'SG', '+81': 'JP', '+82': 'KR'
        };
        
        // Check longer prefixes first (e.g., +353 before +3)
        const sortedPrefixes = Object.keys(prefixMap).sort((a, b) => b.length - a.length);
        for (const prefix of sortedPrefixes) {
          if (phoneNumber.startsWith(prefix)) {
            phoneCountry = prefixMap[prefix];
            break;
          }
        }
        
        if (!phoneCountry) {
          console.log(`[Phone Purchase] Could not determine country for number: ${phoneNumber.substring(0, 5)}***. Address requirement check skipped.`);
        }
      }
      
      // Auto-select user's verified address for countries requiring address verification
      let effectiveAddressSid = addressSid;
      
      if (phoneCountry) {
        const addressReq = await twilioService.getAddressRequirements(phoneCountry);
        if (addressReq !== 'none' && !effectiveAddressSid) {
          // First, check if user has a verified address for this country
          const { userAddresses } = await import("@shared/schema");
          const { eq, and } = await import("drizzle-orm");
          
          let userAddressList;
          if (addressReq === 'local') {
            // Local address required - user must have an address in that specific country
            userAddressList = await db.select()
              .from(userAddresses)
              .where(and(
                eq(userAddresses.userId, req.userId!),
                eq(userAddresses.isoCountry, phoneCountry),
                eq(userAddresses.status, 'verified')
              ));
          } else {
            // 'any' address requirement - user can use any verified address
            userAddressList = await db.select()
              .from(userAddresses)
              .where(and(
                eq(userAddresses.userId, req.userId!),
                eq(userAddresses.status, 'verified')
              ));
          }
          
          if (userAddressList.length > 0 && userAddressList[0].twilioAddressSid) {
            effectiveAddressSid = userAddressList[0].twilioAddressSid;
            console.log(`[Phone Purchase] Using user's verified address: ${userAddressList[0].customerName} for ${phoneCountry}`);
          } else {
            // No verified user address - direct them to Settings to add one
            return res.status(400).json({
              error: "Address required",
              message: addressReq === 'local'
                ? `Phone numbers in ${phoneCountry} require a verified local address. Please add an address for ${phoneCountry} in Settings → Addresses.`
                : `Phone numbers in ${phoneCountry} require a verified address. Please add an address in Settings → Addresses.`,
              addressRequired: true,
              requiresLocalAddress: addressReq === 'local',
              country: phoneCountry,
              redirectToSettings: true
            });
          }
        }
      }

      const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
      if (!workspace) {
        return res.status(400).json({ error: "No workspace found for user" });
      }
      await WorkspaceService.ensureTwilioSubaccountProvisioned(workspace.id);

      const twilioNumber = await twilioService.buyPhoneNumber({
        workspaceId: workspace.id,
        phoneNumber,
        friendlyName,
        addressSid: effectiveAddressSid,
        bundleSid,
      });
      
      const pricing = await twilioService.getPhoneNumberPricing(phoneNumber);
      
      const { ElevenLabsPoolService } = await import('../services/elevenlabs-pool');
      const credentialToUse = await ElevenLabsPoolService.getUserCredential(req.userId!);
      
      if (!credentialToUse) {
        try {
          await twilioService.releasePhoneNumber(twilioNumber.sid, { workspaceId: workspace.id });
        } catch (releaseError: any) {
          console.error('Failed to release Twilio number after credential error:', releaseError);
        }
        return res.status(500).json({ error: 'No active ElevenLabs API keys available in pool' });
      }
      console.log(`📞 [ElevenLabs Pool] Using user's assigned credential: ${credentialToUse.name}`);
      
      let dbPhoneNumber;
      
      if (process.env.NODE_ENV !== 'development') {
        try {
          await db.transaction(async (tx) => {
            await tx.insert(creditTransactions).values({
              userId: req.userId!,
              type: 'debit',
              amount: monthlyCredits,
              description: `Phone number rental: ${twilioNumber.phoneNumber}`,
            });

            await tx.execute(sql`
              UPDATE users 
              SET credits = COALESCE(credits, 0) - ${monthlyCredits}
              WHERE id = ${req.userId!}
            `);

            const nextBillingDate = new Date();
            nextBillingDate.setDate(nextBillingDate.getDate() + 30);

            const finalNumberType = reqNumberType || detectNumberTypeFromNumber(twilioNumber.phoneNumber);
            const [phoneNumberRecord] = await tx.insert(phoneNumbers).values({
              userId: req.userId!,
              workspaceId: workspace.id,
              phoneNumber: twilioNumber.phoneNumber,
              twilioSid: twilioNumber.sid,
              friendlyName: twilioNumber.friendlyName,
              country: phoneCountry || "US",
              capabilities: twilioNumber.capabilities,
              numberType: finalNumberType,
              status: "active",
              purchasePrice: pricing.purchasePrice,
              monthlyPrice: pricing.monthlyPrice,
              monthlyCredits: monthlyCredits,
              nextBillingDate: nextBillingDate,
              elevenLabsCredentialId: credentialToUse.id,
            }).returning();

            dbPhoneNumber = phoneNumberRecord;

            await tx.insert(phoneNumberRentals).values({
              phoneNumberId: phoneNumberRecord.id,
              userId: req.userId!,
              creditsCharged: monthlyCredits,
              status: 'success',
            });
          });
        } catch (dbError: any) {
          console.error('Database transaction failed after Twilio purchase, releasing number:', {
            phoneNumber: twilioNumber.phoneNumber,
            sid: twilioNumber.sid,
            userId: req.userId,
            error: dbError.message
          });
          
          try {
            await twilioService.releasePhoneNumber(twilioNumber.sid);
            console.log('Successfully released orphaned Twilio number:', twilioNumber.sid);
          } catch (releaseError: any) {
            console.error('CRITICAL: Failed to release Twilio number after DB failure:', {
              phoneNumber: twilioNumber.phoneNumber,
              sid: twilioNumber.sid,
              userId: req.userId,
              originalError: dbError.message,
              releaseError: releaseError.message
            });
          }
          
          throw dbError;
        }
      } else {
        const nextBillingDate = new Date();
        nextBillingDate.setDate(nextBillingDate.getDate() + 30);

        const finalNumberType = reqNumberType || detectNumberTypeFromNumber(twilioNumber.phoneNumber);
        const [devPhoneNumber] = await db.insert(phoneNumbers).values({
          userId: req.userId!,
          phoneNumber: twilioNumber.phoneNumber,
          twilioSid: twilioNumber.sid,
          friendlyName: twilioNumber.friendlyName,
          country: phoneCountry || "US",
          capabilities: twilioNumber.capabilities,
          numberType: finalNumberType,
          status: "active",
          purchasePrice: pricing.purchasePrice,
          monthlyPrice: pricing.monthlyPrice,
          monthlyCredits: monthlyCredits,
          nextBillingDate: nextBillingDate,
          elevenLabsCredentialId: credentialToUse.id,
        }).returning();
        
        dbPhoneNumber = devPhoneNumber;
      }
      
      let elevenLabsPhoneNumberId: string | null = null;
      if (dbPhoneNumber) {
        try {
          console.log(`📞 [ElevenLabs Sync] Syncing phone number to ElevenLabs: ${twilioNumber.phoneNumber}`);
          
          const { ElevenLabsService } = await import('../services/elevenlabs');
          const elevenLabsService = new ElevenLabsService(credentialToUse.apiKey);
          
          // The number was purchased via the workspace's Twilio SUBACCOUNT (workspaceId
          // passed to buyPhoneNumber above), so ElevenLabs must verify against the SAME
          // subaccount creds — env-account creds 404 because the SID lives on the subaccount.
          const subCreds = await WorkspaceService.getWorkspaceTwilioSubaccountCredentials(workspace.id);
          let twilioAccountSid: string;
          let twilioAuthToken: string;
          if (subCreds) {
            twilioAccountSid = subCreds.accountSid;
            twilioAuthToken = subCreds.authToken;
          } else {
            const { getTwilioAccountSid, getTwilioAuthToken } = await import('../services/twilio-connector');
            twilioAccountSid = await getTwilioAccountSid();
            twilioAuthToken = await getTwilioAuthToken();
          }
          
          // Twilio's API has a short propagation delay after IncomingPhoneNumbers.create —
          // ElevenLabs verifies the number against Twilio and 404s if it queries too soon.
          // Retry the sync with backoff to absorb that propagation window.
          const syncWithRetry = async () => {
            const delaysMs = [1500, 3000, 5000, 8000];
            let lastErr: any;
            for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
              try {
                return await elevenLabsService.syncPhoneNumberToElevenLabs({
                  phoneNumber: twilioNumber.phoneNumber,
                  twilioAccountSid,
                  twilioAuthToken,
                  label: friendlyName || twilioNumber.phoneNumber,
                });
              } catch (err: any) {
                lastErr = err;
                const body = String(err?.context?.responseBody ?? err?.message ?? "");
                const isPropagation =
                  err?.context?.statusCode === 404 || body.includes("phone_number_not_found");
                if (!isPropagation || attempt === delaysMs.length) throw err;
                console.warn(
                  `⏳ [ElevenLabs Sync] Retry ${attempt + 1} after ${delaysMs[attempt]}ms (Twilio propagation lag)`
                );
                await new Promise((r) => setTimeout(r, delaysMs[attempt]));
              }
            }
            throw lastErr;
          };
          const elevenLabsResult = await syncWithRetry();
          
          elevenLabsPhoneNumberId = elevenLabsResult.phone_number_id;
          console.log(`✅ [ElevenLabs Sync] Phone number synced successfully: ${elevenLabsPhoneNumberId}`);
          
          try {
            await db.update(phoneNumbers)
              .set({ 
                elevenLabsPhoneNumberId: elevenLabsPhoneNumberId,
                elevenLabsCredentialId: credentialToUse.id,
              })
              .where(eq(phoneNumbers.id, dbPhoneNumber.id));
            
            console.log(`✅ [ElevenLabs Sync] Phone number record updated with ElevenLabs ID and credential`);
            
            dbPhoneNumber.elevenLabsPhoneNumberId = elevenLabsPhoneNumberId;
            dbPhoneNumber.elevenLabsCredentialId = credentialToUse.id;
          } catch (dbUpdateError: any) {
            console.error('❌ [ElevenLabs Sync] Database update failed after ElevenLabs sync - cleaning up');
            
            try {
              await elevenLabsService.deletePhoneNumber(elevenLabsPhoneNumberId);
              console.log(`✅ [Rollback] Deleted ElevenLabs phone number: ${elevenLabsPhoneNumberId}`);
            } catch (deleteError: any) {
              console.error('❌ [Rollback] Failed to delete ElevenLabs phone number:', deleteError);
            }
            
            throw dbUpdateError;
          }
          
        } catch (elevenLabsError: any) {
          console.error('⚠️  [ElevenLabs Sync] Failed to sync phone number to ElevenLabs:', elevenLabsError);
          console.error('⚠️  [ElevenLabs Sync] Phone number purchased successfully but ElevenLabs sync failed');
          
          try {
            if (process.env.NODE_ENV !== 'development') {
              await db.transaction(async (tx) => {
                await tx.insert(creditTransactions).values({
                  userId: req.userId!,
                  type: 'credit',
                  amount: monthlyCredits,
                  description: `Refund: Phone number purchase rollback (${twilioNumber.phoneNumber})`,
                });
                
                await tx.execute(sql`
                  UPDATE users 
                  SET credits = COALESCE(credits, 0) + ${monthlyCredits}
                  WHERE id = ${req.userId!}
                `);
                
                console.log(`✅ [Rollback] Restored ${monthlyCredits} credits to user`);
              });
            }
            
            await db.delete(phoneNumbers).where(eq(phoneNumbers.id, dbPhoneNumber.id));
            console.log('✅ [Rollback] Deleted phone number from database');
            
            // The number was purchased on the workspace SUBACCOUNT, so the release MUST also
            // pass workspaceId — otherwise we hit the parent account and get a 404. Also retry
            // briefly for any genuine Twilio propagation lag on the subaccount.
            const releaseDelaysMs = [1500, 3000, 5000];
            let released = false;
            let lastReleaseErr: any;
            for (let attempt = 0; attempt <= releaseDelaysMs.length; attempt++) {
              try {
                await twilioService.releasePhoneNumber(twilioNumber.sid, { workspaceId: workspace.id });
                released = true;
                break;
              } catch (relErr: any) {
                lastReleaseErr = relErr;
                if (relErr?.status !== 404 || attempt === releaseDelaysMs.length) break;
                console.warn(`⏳ [Rollback] Twilio release retry ${attempt + 1} after ${releaseDelaysMs[attempt]}ms`);
                await new Promise((r) => setTimeout(r, releaseDelaysMs[attempt]));
              }
            }
            if (!released) throw lastReleaseErr;
            console.log('✅ [Rollback] Released Twilio phone number');
            
            console.log('✅ [Rollback] Complete rollback successful - all state restored consistently');
            throw new Error('Failed to sync phone number to ElevenLabs. Purchase fully rolled back.');
          } catch (rollbackError: any) {
            console.error('❌ [CRITICAL ROLLBACK FAILURE] Rollback failed after ElevenLabs sync failure:', rollbackError);
            console.error('❌ [CRITICAL] Manual intervention required - database and billing may be inconsistent');
            console.error('❌ [CRITICAL] User ID:', req.userId);
            console.error('❌ [CRITICAL] Phone Number:', twilioNumber.phoneNumber);
            console.error('❌ [CRITICAL] Twilio SID:', twilioNumber.sid);
            throw elevenLabsError;
          }
        }
      }

      res.json(dbPhoneNumber);
    } catch (error: any) {
      console.error("Buy phone number error:", error);
      
      if (error.message?.includes('Authentication') || error.message?.includes('not connected') || error.status === 401) {
        return res.status(503).json({ 
          error: "Twilio credentials not configured", 
          message: "Please configure your Twilio credentials. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in your .env file, or configure via Admin Panel > Settings. Get your credentials from console.twilio.com"
        });
      }
      
      res.status(500).json({ error: error.message || "Failed to buy phone number" });
    }
  });

  router.delete("/api/phone-numbers/:id", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const phoneNumber = await storage.getPhoneNumber(req.params.id);
      if (!phoneNumber || phoneNumber.userId !== req.userId) {
        return res.status(404).json({ error: "Phone number not found" });
      }

      if (phoneNumber.elevenLabsPhoneNumberId) {
        try {
          console.log(`📞 [ElevenLabs Delete] Deleting phone number from ElevenLabs: ${phoneNumber.elevenLabsPhoneNumberId}`);
          
          const { ElevenLabsPoolService } = await import('../services/elevenlabs-pool');
          const userAgents = await storage.getUserAgents(req.userId!);
          
          if (userAgents.length > 0 && userAgents[0].elevenLabsCredentialId) {
            const credential = await ElevenLabsPoolService.getCredentialById(userAgents[0].elevenLabsCredentialId);
            if (credential) {
              const { ElevenLabsService } = await import('../services/elevenlabs');
              const elevenLabsService = new ElevenLabsService(credential.apiKey);
              await elevenLabsService.deletePhoneNumber(phoneNumber.elevenLabsPhoneNumberId);
              console.log(`✅ [ElevenLabs Delete] Phone number deleted from ElevenLabs successfully`);
            }
          }
        } catch (elevenLabsError: any) {
          console.error("⚠️  [ElevenLabs Delete] Failed to delete from ElevenLabs:", elevenLabsError);
        }
      }

      try {
        await twilioService.releasePhoneNumber(phoneNumber.twilioSid);
      } catch (twilioError: any) {
        console.error("Failed to release from Twilio:", twilioError);
      }

      await storage.deletePhoneNumber(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete phone number error:", error);
      res.status(500).json({ error: "Failed to delete phone number" });
    }
  });


  return router;
}
