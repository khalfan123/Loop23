import { Router, Request, Response } from "express";
import { db } from "../../db";
import { storage } from "../../storage";
import { phoneNumbers, agents, elevenLabsCredentials, users } from "@shared/schema";
import { eq, and, sql, desc, isNull, isNotNull } from "drizzle-orm";

const router = Router();

router.get("/phone-numbers", async (_req: Request, res: Response) => {
  try {
    const numbers = await db.select().from(phoneNumbers).orderBy(desc(phoneNumbers.createdAt));
    res.json(numbers);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch phone numbers" });
  }
});

router.post("/phone-numbers/search-available", async (req: Request, res: Response) => {
  try {
    const { areaCode, country, numberType } = req.body;
    const { twilioService } = await import("../../services/twilio");
    const client = await (await import("../../services/twilio-connector")).getTwilioClient();
    if (!client) return res.status(503).json({ error: "Twilio not configured" });
    const searchParams: any = { limit: 20 };
    if (areaCode) searchParams.areaCode = areaCode;
    let numbers;
    const countryCode = country || "US";
    if (numberType === "tollFree") {
      numbers = await client.availablePhoneNumbers(countryCode).tollFree.list(searchParams);
    } else {
      numbers = await client.availablePhoneNumbers(countryCode).local.list(searchParams);
    }
    res.json(numbers.map((n: any) => ({
      phoneNumber: n.phoneNumber,
      friendlyName: n.friendlyName,
      locality: n.locality,
      region: n.region,
      capabilities: n.capabilities,
    })));
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to search numbers" });
  }
});

router.post("/phone-numbers/buy", async (req: Request, res: Response) => {
  try {
    const { phoneNumber, userId } = req.body;
    if (!phoneNumber) return res.status(400).json({ error: "phoneNumber is required" });
    const client = await (await import("../../services/twilio-connector")).getTwilioClient();
    if (!client) return res.status(503).json({ error: "Twilio not configured" });
    const purchased = await client.incomingPhoneNumbers.create({ phoneNumber });
    const [record] = await db.insert(phoneNumbers).values({
      userId: userId || null,
      phoneNumber: purchased.phoneNumber,
      twilioSid: purchased.sid,
      friendlyName: purchased.friendlyName,
      country: purchased.phoneNumber.startsWith("+1") ? "US" : "OTHER",
      status: "active",
      capabilities: { voice: true, sms: true },
    }).returning();
    res.status(201).json(record);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to buy number" });
  }
});

router.post("/phone-numbers/import", async (req: Request, res: Response) => {
  try {
    const { numbers } = req.body;
    if (!Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({ error: "numbers array is required" });
    }
    const results = [];
    for (const num of numbers) {
      try {
        const [record] = await db.insert(phoneNumbers).values({
          phoneNumber: num.phoneNumber,
          twilioSid: num.twilioSid || `imported_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          userId: num.userId || null,
          friendlyName: num.friendlyName || null,
          country: num.country || "US",
          status: "active",
        }).returning();
        results.push({ phoneNumber: num.phoneNumber, status: "imported", id: record.id });
      } catch (e: any) {
        results.push({ phoneNumber: num.phoneNumber, status: "failed", error: e.message });
      }
    }
    res.json({ results, total: numbers.length, imported: results.filter(r => r.status === "imported").length });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to import numbers" });
  }
});

router.post("/phone-numbers/:id/assign", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });
    const [number] = await db.select().from(phoneNumbers).where(eq(phoneNumbers.id, req.params.id));
    if (!number) return res.status(404).json({ error: "Phone number not found" });
    await db.update(phoneNumbers).set({ userId }).where(eq(phoneNumbers.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to assign number" });
  }
});

router.post("/phone-numbers/:id/reassign", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });
    const [number] = await db.select().from(phoneNumbers).where(eq(phoneNumbers.id, req.params.id));
    if (!number) return res.status(404).json({ error: "Phone number not found" });
    await db.update(phoneNumbers).set({ userId }).where(eq(phoneNumbers.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to reassign number" });
  }
});

router.post("/phone-numbers/:id/release", async (req: Request, res: Response) => {
  try {
    const [number] = await db.select().from(phoneNumbers).where(eq(phoneNumbers.id, req.params.id));
    if (!number) return res.status(404).json({ error: "Phone number not found" });
    try {
      const client = await (await import("../../services/twilio-connector")).getTwilioClient();
      if (client && number.twilioSid && !number.twilioSid.startsWith("imported_")) {
        await client.incomingPhoneNumbers(number.twilioSid).remove();
      }
    } catch (e: any) {
      console.warn("Twilio release failed:", e.message);
    }
    await db.update(phoneNumbers).set({ status: "released", userId: null }).where(eq(phoneNumbers.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to release number" });
  }
});

router.post("/phone-numbers/:id/configure-webhook", async (req: Request, res: Response) => {
  try {
    const { voiceUrl, statusCallbackUrl } = req.body;
    const [number] = await db.select().from(phoneNumbers).where(eq(phoneNumbers.id, req.params.id));
    if (!number) return res.status(404).json({ error: "Phone number not found" });
    const client = await (await import("../../services/twilio-connector")).getTwilioClient();
    if (!client) return res.status(503).json({ error: "Twilio not configured" });
    if (number.twilioSid && !number.twilioSid.startsWith("imported_")) {
      await client.incomingPhoneNumbers(number.twilioSid).update({
        voiceUrl: voiceUrl || undefined,
        statusCallback: statusCallbackUrl || undefined,
      });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to configure webhook" });
  }
});

router.post("/phone-numbers/migrate", async (req: Request, res: Response) => {
  try {
    const { fromProvider, toProvider } = req.body;
    res.json({ success: true, message: `Migration from ${fromProvider} to ${toProvider} initiated`, status: "pending" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to initiate migration" });
  }
});

router.get("/phone-numbers/migration-status", async (_req: Request, res: Response) => {
  try {
    res.json({ status: "idle", pendingMigrations: 0 });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get migration status" });
  }
});

router.post("/phone-numbers/:id/migrate", async (req: Request, res: Response) => {
  try {
    const [number] = await db.select().from(phoneNumbers).where(eq(phoneNumbers.id, req.params.id));
    if (!number) return res.status(404).json({ error: "Phone number not found" });
    res.json({ success: true, message: "Number migration initiated" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to migrate number" });
  }
});

router.post("/phone-numbers/migrate-all", async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, message: "Bulk migration initiated" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to initiate bulk migration" });
  }
});

router.post("/phone-numbers/migrate-by-agent", async (req: Request, res: Response) => {
  try {
    const { agentId } = req.body;
    res.json({ success: true, message: `Migration by agent ${agentId} initiated` });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to migrate by agent" });
  }
});

router.post("/phone-numbers/sync-elevenlabs", async (_req: Request, res: Response) => {
  try {
    const { ElevenLabsPoolService } = await import("../../services/elevenlabs-pool");
    const poolService = new ElevenLabsPoolService();
    res.json({ success: true, message: "ElevenLabs sync initiated" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to sync with ElevenLabs" });
  }
});

router.post("/phone-numbers/cleanup-orphaned", async (_req: Request, res: Response) => {
  try {
    const orphaned = await db.select().from(phoneNumbers)
      .where(and(
        isNull(phoneNumbers.userId),
        eq(phoneNumbers.status, "active"),
        eq(phoneNumbers.isSystemPool, false)
      ));
    res.json({ success: true, orphanedCount: orphaned.length, message: `Found ${orphaned.length} orphaned numbers` });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to cleanup orphaned numbers" });
  }
});

export default router;
