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

  router.get("/api/phone-numbers/search", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { country, areaCode, postalCode, locality, region, contains } = req.query;
      
      // Country is required, but other filters are optional
      if (!country) {
        return res.status(400).json({ error: "Country is required" });
      }

      const availableNumbers = await twilioService.searchAvailableNumbers({
        country: (country as string),
        areaCode: areaCode as string,
        contains: contains as string,
        inPostalCode: postalCode as string,
        inLocality: locality as string,
        inRegion: region as string,
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

  router.post("/api/phone-numbers/buy", authenticateToken, checkActiveMembership(storage), async (req: AuthRequest, res: Response) => {
    try {
      const { phoneNumber, friendlyName, addressSid, bundleSid, country } = req.body;

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

      const twilioNumber = await twilioService.buyPhoneNumber({
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
          await twilioService.releasePhoneNumber(twilioNumber.sid);
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

            const [phoneNumberRecord] = await tx.insert(phoneNumbers).values({
              userId: req.userId!,
              phoneNumber: twilioNumber.phoneNumber,
              twilioSid: twilioNumber.sid,
              friendlyName: twilioNumber.friendlyName,
              country: "US",
              capabilities: twilioNumber.capabilities,
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

        const [devPhoneNumber] = await db.insert(phoneNumbers).values({
          userId: req.userId!,
          phoneNumber: twilioNumber.phoneNumber,
          twilioSid: twilioNumber.sid,
          friendlyName: twilioNumber.friendlyName,
          country: "US",
          capabilities: twilioNumber.capabilities,
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
          
          const { getTwilioAccountSid, getTwilioAuthToken } = await import('../services/twilio-connector');
          const twilioAccountSid = await getTwilioAccountSid();
          const twilioAuthToken = await getTwilioAuthToken();
          
          const elevenLabsResult = await elevenLabsService.syncPhoneNumberToElevenLabs({
            phoneNumber: twilioNumber.phoneNumber,
            twilioAccountSid,
            twilioAuthToken,
            label: friendlyName || twilioNumber.phoneNumber,
          });
          
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
            
            await twilioService.releasePhoneNumber(twilioNumber.sid);
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

  // Admin Phone Numbers routes
  router.get("/api/admin/phone-numbers/search/:areaCode", authenticateToken, requireRole("admin"), async (req: AuthRequest, res: Response) => {
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
      console.error("Search numbers error:", error);
      res.status(500).json({ error: error.message || "Failed to search numbers" });
    }
  });

  router.post("/api/admin/phone-numbers/buy-system", authenticateToken, requireRole("admin"), async (req: AuthRequest, res: Response) => {
    try {
      const { phoneNumber, friendlyName } = req.body;

      if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number is required" });
      }

      const twilioNumber = await twilioService.buyPhoneNumber(
        phoneNumber,
        friendlyName || "System Pool Number"
      );

      const pricing = await twilioService.getPhoneNumberPricing(phoneNumber);

      await storage.createPhoneNumber({
        userId: null,
        phoneNumber: twilioNumber.phoneNumber,
        twilioSid: twilioNumber.sid,
        friendlyName: twilioNumber.friendlyName,
        country: "US",
        capabilities: twilioNumber.capabilities,
        status: "active",
        isSystemPool: true,
        purchasePrice: pricing.purchasePrice,
        monthlyPrice: pricing.monthlyPrice,
        monthlyCredits: null,
        nextBillingDate: null,
      });

      res.json({ 
        success: true, 
        message: "System number added successfully",
        phoneNumber: twilioNumber.phoneNumber 
      });
    } catch (error: any) {
      console.error("Buy system number error:", error);
      
      if (error.message?.includes('Authentication') || error.message?.includes('not connected') || error.status === 401) {
        return res.status(503).json({ 
          error: "Twilio credentials not configured", 
          message: "Please configure your Twilio credentials. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in your .env file, or configure via Admin Panel > Settings. Get your credentials from console.twilio.com"
        });
      }
      
      res.status(500).json({ error: error.message || "Failed to add system number" });
    }
  });

  return router;
}
