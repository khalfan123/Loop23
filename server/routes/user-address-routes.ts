'use strict';
import { Router, Response } from "express";
import { RouteContext, AuthRequest } from "./common";
import { db } from "../db";
import { userAddresses } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { TwilioService } from "../services/twilio";
import { z } from "zod";

const createAddressSchema = z.object({
  customerName: z.string().min(1, "Name is required"),
  street: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  region: z.string().min(1, "State/Province is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  isoCountry: z.string().length(2, "Country code must be 2 characters"),
});

export function createUserAddressRoutes(ctx: RouteContext): Router {
  const router = Router();
  const { authenticateHybrid, twilioService } = ctx;

  router.get("/api/user/addresses", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      
      const addresses = await db.select()
        .from(userAddresses)
        .where(eq(userAddresses.userId, userId))
        .orderBy(userAddresses.createdAt);
      
      res.json(addresses);
    } catch (error: any) {
      console.error("[User Addresses] Error fetching addresses:", error);
      res.status(500).json({ error: "Failed to fetch addresses" });
    }
  });

  router.post("/api/user/addresses", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const parsed = createAddressSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Invalid address data", 
          details: parsed.error.errors 
        });
      }
      
      const { customerName, street, city, region, postalCode, isoCountry } = parsed.data;
      
      const twilioAddress = await twilioService.createAddress({
        customerName,
        street,
        city,
        region,
        postalCode,
        isoCountry,
        friendlyName: `${customerName} - ${city}, ${isoCountry}`,
      });
      
      // Determine address status based on Twilio's validation response
      // validated=true means address is valid, validated=false means validation failed
      // Note: On initial creation, Twilio may return validated=false while still processing
      // We'll set to 'submitted' initially and let the refresh endpoint handle final status
      const isVerified = twilioAddress.verified || twilioAddress.validated;
      
      const [address] = await db.insert(userAddresses).values({
        userId,
        customerName,
        street,
        city,
        region,
        postalCode,
        isoCountry,
        twilioAddressSid: twilioAddress.sid,
        status: isVerified ? 'verified' : 'submitted',
        verificationStatus: isVerified ? 'verified' : 'pending',
        validationStatus: twilioAddress.validated ? 'validated' : 'pending',
      }).returning();
      
      res.status(201).json(address);
    } catch (error: any) {
      console.error("[User Addresses] Error creating address:", error);
      res.status(500).json({ error: error.message || "Failed to create address" });
    }
  });

  router.get("/api/user/addresses/:id/refresh", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      const [address] = await db.select()
        .from(userAddresses)
        .where(and(
          eq(userAddresses.id, id),
          eq(userAddresses.userId, userId)
        ));
      
      if (!address) {
        return res.status(404).json({ error: "Address not found" });
      }
      
      if (!address.twilioAddressSid) {
        return res.status(400).json({ error: "Address not linked to Twilio" });
      }
      
      const twilioAddress = await twilioService.getAddress(address.twilioAddressSid);
      
      if (!twilioAddress) {
        await db.update(userAddresses)
          .set({ 
            status: 'rejected',
            rejectionReason: 'Address no longer exists in Twilio',
            updatedAt: new Date(),
          })
          .where(eq(userAddresses.id, id));
        
        return res.status(404).json({ error: "Address no longer exists in Twilio" });
      }
      
      // Address is verified if either verified=true OR validated=true (validated is sufficient for most countries)
      const isVerified = twilioAddress.verified || twilioAddress.validated;
      
      // Determine status based on Twilio's response
      let status: string;
      let verificationStatus: string;
      let validationStatus: string;
      let rejectionReason: string | null = null;
      
      if (isVerified) {
        status = 'verified';
        verificationStatus = 'verified';
        validationStatus = 'validated';
      } else {
        // Check if enough time has passed for Twilio to complete validation
        // Twilio typically validates addresses within 1-2 minutes
        const createdTime = address.createdAt.getTime();
        const now = Date.now();
        const minutesSinceCreation = (now - createdTime) / (1000 * 60);
        
        if (minutesSinceCreation < 5) {
          // Address was created recently, validation may still be in progress
          status = 'submitted';
          verificationStatus = 'pending';
          validationStatus = 'pending';
        } else {
          // Address was created more than 5 minutes ago and still not validated
          // This indicates validation has failed
          status = 'rejected';
          verificationStatus = 'failed';
          validationStatus = 'failed';
          rejectionReason = 'Address validation failed - please verify the address details are correct';
        }
      }
      
      const [updated] = await db.update(userAddresses)
        .set({
          status,
          verificationStatus,
          validationStatus,
          rejectionReason,
          updatedAt: new Date(),
        })
        .where(eq(userAddresses.id, id))
        .returning();
      
      res.json(updated);
    } catch (error: any) {
      console.error("[User Addresses] Error refreshing address:", error);
      res.status(500).json({ error: "Failed to refresh address status" });
    }
  });

  router.delete("/api/user/addresses/:id", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      
      const [address] = await db.select()
        .from(userAddresses)
        .where(and(
          eq(userAddresses.id, id),
          eq(userAddresses.userId, userId)
        ));
      
      if (!address) {
        return res.status(404).json({ error: "Address not found" });
      }
      
      if (address.twilioAddressSid) {
        try {
          await twilioService.deleteAddress(address.twilioAddressSid);
        } catch (twilioError: any) {
          console.error("[User Addresses] Failed to delete from Twilio:", twilioError);
        }
      }
      
      await db.delete(userAddresses)
        .where(eq(userAddresses.id, id));
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("[User Addresses] Error deleting address:", error);
      res.status(500).json({ error: "Failed to delete address" });
    }
  });

  router.get("/api/user/addresses/countries", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    const countries = [
      { code: 'AU', name: 'Australia', requirement: 'local' },
      { code: 'GB', name: 'United Kingdom', requirement: 'any' },
      { code: 'DE', name: 'Germany', requirement: 'local' },
      { code: 'FR', name: 'France', requirement: 'local' },
      { code: 'ES', name: 'Spain', requirement: 'local' },
      { code: 'IT', name: 'Italy', requirement: 'local' },
      { code: 'NL', name: 'Netherlands', requirement: 'any' },
      { code: 'BE', name: 'Belgium', requirement: 'local' },
      { code: 'AT', name: 'Austria', requirement: 'local' },
      { code: 'CH', name: 'Switzerland', requirement: 'local' },
      { code: 'SE', name: 'Sweden', requirement: 'any' },
      { code: 'NO', name: 'Norway', requirement: 'any' },
      { code: 'DK', name: 'Denmark', requirement: 'any' },
      { code: 'FI', name: 'Finland', requirement: 'any' },
      { code: 'IE', name: 'Ireland', requirement: 'any' },
      { code: 'NZ', name: 'New Zealand', requirement: 'local' },
      { code: 'JP', name: 'Japan', requirement: 'local' },
      { code: 'SG', name: 'Singapore', requirement: 'local' },
      { code: 'HK', name: 'Hong Kong', requirement: 'local' },
    ];
    
    res.json(countries);
  });

  return router;
}
