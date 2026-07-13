/**
 * ============================================================
 * Enterprise engineering — DB-backed GDPR data stores
 *
 * Concrete DataStore implementations over the real personal-data tables, so
 * the GdprExecutor's right-to-access (export) and right-to-erasure actually
 * operate on production data — not just a pluggable interface. Each store is
 * scoped by the record's owner column (user_id), and the executor only ever
 * receives owner ids the TenantGuard authorized for the data subject.
 *
 * `defaultGdprExecutor()` wires the standard personal-data categories. Add a
 * store per new personal-data table following the same pattern.
 * ============================================================
 */

import { eq } from 'drizzle-orm';
import { db } from '../db';
import { calls } from '@shared/schema';
import { GdprExecutor, type DataStore } from './compliance-controls';

/** Calls (transcripts, phone numbers, recordings metadata) owned by a user. */
export class CallsDataStore implements DataStore {
  readonly category = 'calls';

  async exportForOwner(ownerId: string): Promise<unknown> {
    // Explicit personal-data projection (not SELECT *): exports the meaningful
    // PII fields for a data-subject request and stays robust to schema drift
    // between the code and a not-yet-migrated database.
    return db
      .select({
        id: calls.id,
        phoneNumber: calls.phoneNumber,
        fromNumber: calls.fromNumber,
        toNumber: calls.toNumber,
        transcript: calls.transcript,
        createdAt: calls.createdAt,
      })
      .from(calls)
      .where(eq(calls.userId, ownerId));
  }

  async eraseForOwner(ownerId: string): Promise<number> {
    const deleted = await db.delete(calls).where(eq(calls.userId, ownerId)).returning({ id: calls.id });
    return deleted.length;
  }
}

/** A GdprExecutor pre-registered with the platform's personal-data stores. */
export function defaultGdprExecutor(): GdprExecutor {
  return new GdprExecutor().register(new CallsDataStore());
  // Extend here as more personal-data categories are covered (recordings,
  // caller_memory, etc.) — each is one DataStore over its owner column.
}
