/**
 * Admin CRUD over sms_country_rates — the per-destination-country credit
 * rate that the platform charges for outbound SMS. A single row with
 * iso_country='*' is the global fallback used when the destination country
 * isn't listed.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { db } from '../../db';
import { smsCountryRates } from '@shared/schema';

const router = Router();

const upsertSchema = z.object({
  isoCountry: z.string().min(1).max(2).transform((v) => v.toUpperCase()),
  creditsPerSegment: z.number().int().min(0).max(1_000_000),
  label: z.string().max(120).optional().nullable(),
});

router.get('/sms-rates', async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(smsCountryRates)
      .orderBy(desc(smsCountryRates.isDefault), smsCountryRates.isoCountry);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load SMS rates' });
  }
});

router.post('/sms-rates', async (req: Request, res: Response) => {
  try {
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid rate', details: parsed.error.flatten() });
    }
    const { isoCountry, creditsPerSegment, label } = parsed.data;
    const isDefault = isoCountry === '*';

    const now = new Date();
    const [existing] = await db
      .select()
      .from(smsCountryRates)
      .where(eq(smsCountryRates.isoCountry, isoCountry))
      .limit(1);

    let row;
    if (existing) {
      [row] = await db
        .update(smsCountryRates)
        .set({ creditsPerSegment, label: label ?? existing.label, isDefault, updatedAt: now })
        .where(eq(smsCountryRates.id, existing.id))
        .returning();
    } else {
      [row] = await db
        .insert(smsCountryRates)
        .values({ isoCountry, creditsPerSegment, label: label ?? null, isDefault, createdAt: now, updatedAt: now })
        .returning();
    }
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to save rate' });
  }
});

router.delete('/sms-rates/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const [row] = await db.select().from(smsCountryRates).where(eq(smsCountryRates.id, id)).limit(1);
    if (!row) return res.status(404).json({ error: 'Rate not found' });
    if (row.isoCountry === '*') {
      return res.status(400).json({ error: 'The default rate (iso_country=*) cannot be deleted; edit it instead.' });
    }
    await db.delete(smsCountryRates).where(eq(smsCountryRates.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete rate' });
  }
});

export default router;
