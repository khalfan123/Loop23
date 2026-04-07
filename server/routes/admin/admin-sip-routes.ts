import { Router, Request, Response } from "express";
import { db } from "../../db";
import { sipTrunks, sipPhoneNumbers, sipCalls, portRequests, users } from "@shared/schema";
import { eq, desc, sql, and } from "drizzle-orm";

const router = Router();

router.get("/sip/trunks", async (_req: Request, res: Response) => {
  try {
    const trunks = await db
      .select({
        id: sipTrunks.id,
        userId: sipTrunks.userId,
        name: sipTrunks.name,
        engine: sipTrunks.engine,
        provider: sipTrunks.provider,
        sipHost: sipTrunks.sipHost,
        sipPort: sipTrunks.sipPort,
        transport: sipTrunks.transport,
        mediaEncryption: sipTrunks.mediaEncryption,
        isActive: sipTrunks.isActive,
        healthStatus: sipTrunks.healthStatus,
        lastHealthCheck: sipTrunks.lastHealthCheck,
        createdAt: sipTrunks.createdAt,
        updatedAt: sipTrunks.updatedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(sipTrunks)
      .leftJoin(users, eq(sipTrunks.userId, users.id))
      .orderBy(desc(sipTrunks.createdAt));
    res.json(trunks);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch SIP trunks" });
  }
});

router.get("/sip/trunks/:id", async (req: Request, res: Response) => {
  try {
    const [trunk] = await db
      .select()
      .from(sipTrunks)
      .where(eq(sipTrunks.id, req.params.id))
      .limit(1);
    if (!trunk) return res.status(404).json({ error: "Trunk not found" });

    const numbers = await db
      .select()
      .from(sipPhoneNumbers)
      .where(eq(sipPhoneNumbers.sipTrunkId, trunk.id));

    res.json({ ...trunk, phoneNumbers: numbers });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch SIP trunk details" });
  }
});

router.patch("/sip/trunks/:id", async (req: Request, res: Response) => {
  try {
    const { isActive, healthStatus } = req.body;
    const updates: any = { updatedAt: new Date() };
    if (typeof isActive === "boolean") updates.isActive = isActive;
    if (healthStatus) updates.healthStatus = healthStatus;

    const [updated] = await db
      .update(sipTrunks)
      .set(updates)
      .where(eq(sipTrunks.id, req.params.id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Trunk not found" });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update SIP trunk" });
  }
});

router.delete("/sip/trunks/:id", async (req: Request, res: Response) => {
  try {
    const { ElevenLabsSipService } = await import("../../../plugins/sip-engine/services/elevenlabs-sip.service");
    const deleted = await ElevenLabsSipService.deleteSipTrunk(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Trunk not found" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete SIP trunk" });
  }
});

router.get("/sip/phone-numbers", async (_req: Request, res: Response) => {
  try {
    const numbers = await db
      .select({
        id: sipPhoneNumbers.id,
        sipTrunkId: sipPhoneNumbers.sipTrunkId,
        userId: sipPhoneNumbers.userId,
        phoneNumber: sipPhoneNumbers.phoneNumber,
        label: sipPhoneNumbers.label,
        engine: sipPhoneNumbers.engine,
        inboundEnabled: sipPhoneNumbers.inboundEnabled,
        outboundEnabled: sipPhoneNumbers.outboundEnabled,
        isActive: sipPhoneNumbers.isActive,
        createdAt: sipPhoneNumbers.createdAt,
        trunkName: sipTrunks.name,
        userName: users.name,
        userEmail: users.email,
      })
      .from(sipPhoneNumbers)
      .leftJoin(sipTrunks, eq(sipPhoneNumbers.sipTrunkId, sipTrunks.id))
      .leftJoin(users, eq(sipPhoneNumbers.userId, users.id))
      .orderBy(desc(sipPhoneNumbers.createdAt));
    res.json(numbers);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch SIP phone numbers" });
  }
});

router.get("/sip/stats", async (_req: Request, res: Response) => {
  try {
    const [trunkCount] = await db.select({ count: sql<number>`count(*)` }).from(sipTrunks);
    const [phoneCount] = await db.select({ count: sql<number>`count(*)` }).from(sipPhoneNumbers);
    const [activePhoneCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(sipPhoneNumbers)
      .where(eq(sipPhoneNumbers.isActive, true));
    const [callCount] = await db.select({ count: sql<number>`count(*)` }).from(sipCalls);

    res.json({
      totalTrunks: Number(trunkCount.count),
      totalPhoneNumbers: Number(phoneCount.count),
      activePhoneNumbers: Number(activePhoneCount.count),
      totalCalls: Number(callCount.count),
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch SIP stats" });
  }
});

router.get("/porting/requests", async (_req: Request, res: Response) => {
  try {
    const requests = await db
      .select({
        id: portRequests.id,
        userId: portRequests.userId,
        phoneNumber: portRequests.phoneNumber,
        countryCode: portRequests.countryCode,
        currentCarrier: portRequests.currentCarrier,
        authorizedName: portRequests.authorizedName,
        companyName: portRequests.companyName,
        status: portRequests.status,
        requestedPortDate: portRequests.requestedPortDate,
        completedAt: portRequests.completedAt,
        twilioPortSid: portRequests.twilioPortSid,
        adminNotes: portRequests.adminNotes,
        createdAt: portRequests.createdAt,
        updatedAt: portRequests.updatedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(portRequests)
      .leftJoin(users, eq(portRequests.userId, users.id))
      .orderBy(desc(portRequests.createdAt));
    res.json(requests);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch port requests" });
  }
});

router.get("/porting/requests/:id", async (req: Request, res: Response) => {
  try {
    const [request] = await db
      .select()
      .from(portRequests)
      .where(eq(portRequests.id, req.params.id))
      .limit(1);
    if (!request) return res.status(404).json({ error: "Port request not found" });
    res.json(request);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch port request" });
  }
});

router.patch("/porting/requests/:id", async (req: Request, res: Response) => {
  try {
    const { status, adminNotes, twilioPortSid, requestedPortDate } = req.body;
    const updates: any = { updatedAt: new Date() };
    if (status) updates.status = status;
    if (adminNotes !== undefined) updates.adminNotes = adminNotes;
    if (twilioPortSid) updates.twilioPortSid = twilioPortSid;
    if (requestedPortDate) updates.requestedPortDate = new Date(requestedPortDate);
    if (status === "completed") updates.completedAt = new Date();

    const [updated] = await db
      .update(portRequests)
      .set(updates)
      .where(eq(portRequests.id, req.params.id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Port request not found" });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update port request" });
  }
});

router.delete("/porting/requests/:id", async (req: Request, res: Response) => {
  try {
    const [request] = await db
      .select()
      .from(portRequests)
      .where(eq(portRequests.id, req.params.id))
      .limit(1);
    if (!request) return res.status(404).json({ error: "Port request not found" });

    await db.delete(portRequests).where(eq(portRequests.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete port request" });
  }
});

router.get("/porting/stats", async (_req: Request, res: Response) => {
  try {
    const [total] = await db.select({ count: sql<number>`count(*)` }).from(portRequests);
    const [pending] = await db
      .select({ count: sql<number>`count(*)` })
      .from(portRequests)
      .where(sql`${portRequests.status} IN ('submitted', 'under_review', 'approved', 'in_progress')`);
    const [completed] = await db
      .select({ count: sql<number>`count(*)` })
      .from(portRequests)
      .where(eq(portRequests.status, "completed"));

    res.json({
      totalRequests: Number(total.count),
      pendingRequests: Number(pending.count),
      completedRequests: Number(completed.count),
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch porting stats" });
  }
});

export default router;
