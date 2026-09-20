import { Router, Request, Response } from "express";
import { db } from "../../db";
import { syncedVoices } from "@shared/schema";
import { desc } from "drizzle-orm";

const router = Router();

// Vendor voice inventory synced into DB (ElevenLabs pool sync)
router.get("/voices/synced", async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(syncedVoices).orderBy(desc(syncedVoices.syncedAt));
    res.json({ data: rows });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch synced voices" });
  }
});

export default router;

