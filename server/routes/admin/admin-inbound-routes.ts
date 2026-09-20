import { Router, Request, Response } from "express";
import { db } from "../../db";
import { agents, incomingConnections, phoneNumbers, humanIncomingConnections, ivrConfigurations } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

// Inbound routing overview (AI agent routing)
router.get("/inbound/incoming-connections", async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select({
        id: incomingConnections.id,
        userId: incomingConnections.userId,
        agentId: incomingConnections.agentId,
        phoneNumberId: incomingConnections.phoneNumberId,
        createdAt: incomingConnections.createdAt,
        updatedAt: incomingConnections.updatedAt,
        phoneNumber: phoneNumbers.phoneNumber,
        phoneStatus: phoneNumbers.status,
        agentName: agents.name,
        agentType: agents.type,
      })
      .from(incomingConnections)
      .innerJoin(phoneNumbers, eq(incomingConnections.phoneNumberId, phoneNumbers.id))
      .innerJoin(agents, eq(incomingConnections.agentId, agents.id))
      .orderBy(desc(incomingConnections.updatedAt));

    res.json({ data: rows });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch incoming connections" });
  }
});

// Human transfer routing (if configured)
router.get("/inbound/human-incoming-connections", async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select({
        id: humanIncomingConnections.id,
        userId: humanIncomingConnections.userId,
        phoneNumberId: humanIncomingConnections.phoneNumberId,
        transferNumber: humanIncomingConnections.transferNumber,
        transferTargetType: humanIncomingConnections.transferTargetType,
        ivrEnabled: humanIncomingConnections.ivrEnabled,
        label: humanIncomingConnections.label,
        createdAt: humanIncomingConnections.createdAt,
        updatedAt: humanIncomingConnections.updatedAt,
        phoneNumber: phoneNumbers.phoneNumber,
      })
      .from(humanIncomingConnections)
      .innerJoin(phoneNumbers, eq(humanIncomingConnections.phoneNumberId, phoneNumbers.id))
      .orderBy(desc(humanIncomingConnections.updatedAt));

    res.json({ data: rows });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch human incoming connections" });
  }
});

router.get("/inbound/ivr-configurations", async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(ivrConfigurations).orderBy(desc(ivrConfigurations.updatedAt));
    res.json({ data: rows });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch IVR configurations" });
  }
});

export default router;

