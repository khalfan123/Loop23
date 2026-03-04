'use strict';
import { db } from '../db';
import { calls, twilioOpenaiCalls } from '@shared/schema';
import { eq, and, lt, sql } from 'drizzle-orm';
import { logger } from '../utils/logger';

const SOURCE = 'StaleCallsCleanup';
const STALE_THRESHOLD_MS = 5 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 2 * 60 * 1000;

let cleanupInterval: NodeJS.Timeout | null = null;

async function cleanupStalePendingCalls(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);

  try {
    const staleCalls = await db
      .update(calls)
      .set({
        status: 'failed',
        endReason: 'stale-pending-timeout',
        endedAt: new Date(),
      })
      .where(
        and(
          eq(calls.status, 'pending'),
          lt(calls.createdAt, cutoff)
        )
      )
      .returning({ id: calls.id });

    if (staleCalls.length > 0) {
      logger.info(`Cleaned up ${staleCalls.length} stale pending call(s) from calls table`, undefined, SOURCE);
    }
  } catch (err: any) {
    logger.error(`Failed to cleanup stale calls: ${err.message}`, err, SOURCE);
  }

  try {
    const staleTwilioCalls = await db
      .update(twilioOpenaiCalls)
      .set({
        status: 'failed',
        endedAt: new Date(),
        metadata: sql`COALESCE(metadata, '{}'::jsonb) || '{"endReason":"stale-pending-timeout"}'::jsonb`,
      })
      .where(
        and(
          eq(twilioOpenaiCalls.status, 'pending'),
          lt(twilioOpenaiCalls.createdAt, cutoff)
        )
      )
      .returning({ id: twilioOpenaiCalls.id });

    if (staleTwilioCalls.length > 0) {
      logger.info(`Cleaned up ${staleTwilioCalls.length} stale pending call(s) from twilio_openai_calls table`, undefined, SOURCE);
    }
  } catch (err: any) {
    logger.error(`Failed to cleanup stale twilio_openai_calls: ${err.message}`, err, SOURCE);
  }
}

export function startStaleCallsCleanup(): void {
  if (cleanupInterval) {
    return;
  }

  logger.info('Starting stale pending calls cleanup (every 2 min, threshold: 5 min)', undefined, SOURCE);

  cleanupStalePendingCalls().catch((err) => {
    logger.error(`Initial stale calls cleanup failed: ${err.message}`, err, SOURCE);
  });

  cleanupInterval = setInterval(() => {
    cleanupStalePendingCalls().catch((err) => {
      logger.error(`Stale calls cleanup failed: ${err.message}`, err, SOURCE);
    });
  }, CLEANUP_INTERVAL_MS);
}

export function stopStaleCallsCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.info('Stale pending calls cleanup stopped', undefined, SOURCE);
  }
}
