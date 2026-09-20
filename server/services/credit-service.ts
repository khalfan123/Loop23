/**
 * Centralized Credit Deduction Service
 * 
 * Provides atomic, idempotent credit deduction across all telephony engines.
 * Standardizes transaction types and prevents double charging.
 */

import { db } from '../db';
import { users, creditTransactions, smsCountryRates, messages } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '../utils/logger';

export type CreditEngine = 'elevenlabs-twilio' | 'twilio-openai';

export interface CreditDeductionParams {
  userId: string;
  creditsToDeduct: number;
  callId: string;
  fromNumber: string;
  toNumber: string;
  durationSeconds: number;
  engine: CreditEngine;
}

export interface CreditDeductionResult {
  success: boolean;
  creditsDeducted: number;
  newBalance?: number;
  error?: string;
  alreadyDeducted?: boolean;
}

/**
 * Generate a unique, namespaced reference for idempotency.
 * Format: {engine}:{callId}
 */
function generateReference(engine: CreditEngine, callId: string): string {
  return `${engine}:${callId}`;
}

/**
 * Format a SIP endpoint to show a clean phone number with engine label
 * @param endpoint - The SIP URI or phone number (e.g., "sip:12708221598@sip.rtc.elevenlabs.io:5060;transport=tcp")
 * @returns Formatted string like "+12708221598 (ElevenLabs SIP)" or the original if not a SIP URI
 */
function formatSipEndpoint(endpoint: string | null | undefined): string {
  if (!endpoint) {
    return 'Unknown';
  }

  if (!endpoint.startsWith('sip:')) {
    return endpoint;
  }

  const sipMatch = endpoint.match(/^sip:(\+?\d+)@(.+?)(?::\d+)?(?:;.*)?$/);
  
  if (!sipMatch) {
    return endpoint;
  }

  const phoneNumber = sipMatch[1].startsWith('+') ? sipMatch[1] : `+${sipMatch[1]}`;
  const domain = sipMatch[2].toLowerCase();

  let engineLabel = 'SIP';
  if (domain.includes('elevenlabs')) {
    engineLabel = 'ElevenLabs SIP';
  } else if (domain.includes('openai')) {
    engineLabel = 'OpenAI SIP';
  }

  return `${phoneNumber} (${engineLabel})`;
}

/**
 * Atomically deducts credits from a user's balance with idempotency protection.
 * 
 * Features:
 * - Uses advisory lock to prevent concurrent deductions for same reference
 * - Atomic SQL update using GREATEST(0, credits - amount) to prevent negative balance
 * - Idempotent: Won't double-charge if called multiple times for same call
 * - Consistent transaction type: 'usage' with negative amount
 * - Per-user reference checking to prevent cross-tenant collisions
 */
export async function deductCallCredits(params: CreditDeductionParams): Promise<CreditDeductionResult> {
  const { userId, creditsToDeduct, callId, fromNumber, toNumber, durationSeconds, engine } = params;

  if (creditsToDeduct <= 0) {
    return { success: true, creditsDeducted: 0, alreadyDeducted: false };
  }

  const reference = generateReference(engine, callId);
  const description = `${engine.replace('-', '+')} call: ${formatSipEndpoint(fromNumber)} → ${formatSipEndpoint(toNumber)} (${durationSeconds}s)`;

  try {
    // Use database transaction with advisory lock for true atomic idempotency
    const result = await db.transaction(async (tx) => {
      // Generate deterministic lock keys using two 32-bit hashes
      // pg_advisory_xact_lock(int, int) accepts two 32-bit integers
      const userHash = hashCode32(userId);
      const refHash = hashCode32(reference);
      
      // Acquire advisory lock to serialize concurrent requests for this exact reference+userId
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${userHash}, ${refHash})`);

      // Check for existing transaction with same reference AND userId (tenant isolation)
      const existingTransactions = await tx
        .select()
        .from(creditTransactions)
        .where(and(
          eq(creditTransactions.reference, reference),
          eq(creditTransactions.userId, userId)
        ));

      if (existingTransactions.length > 0) {
        logger.info(`Credits already deducted for ${reference} - skipping duplicate`, undefined, 'CreditService');
        return { 
          success: true, 
          creditsDeducted: 0, 
          alreadyDeducted: true 
        } as CreditDeductionResult;
      }

      // Lock the user row and get current balance atomically
      // This prevents concurrent calls for same user from racing
      const lockResult = await tx.execute(
        sql`SELECT credits FROM users WHERE id = ${userId} FOR UPDATE`
      );
      const currentCredits = Number(lockResult.rows?.[0]?.credits) || 0;
      const actualDeduction = Math.min(creditsToDeduct, currentCredits);

      // If user has insufficient credits (partial or zero), return failure to allow retry
      // This ensures no free calls - user must have FULL credits required
      if (actualDeduction < creditsToDeduct) {
        logger.warn(
          `[${engine}] Insufficient credits for ${reference}. Balance: ${currentCredits}, Requested: ${creditsToDeduct}`,
          undefined,
          'CreditService'
        );

        // Return failure so callers can handle appropriately
        // Don't record transaction to allow retry when credits are available
        return {
          success: false,
          creditsDeducted: 0,
          newBalance: currentCredits,
          alreadyDeducted: false,
          error: 'Insufficient credits',
        } as CreditDeductionResult;
      }

      // Atomically update user credits using actual deduction amount
      await tx
        .update(users)
        .set({
          credits: sql`${users.credits} - ${actualDeduction}`,
        })
        .where(eq(users.id, userId));

      // Record the credit transaction with actual deducted amount
      await tx.insert(creditTransactions).values({
        userId,
        type: 'usage',
        amount: -actualDeduction,
        description,
        reference,
      });

      // Get updated balance for logging
      const [updatedUser] = await tx
        .select({ credits: users.credits })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const newBalance = updatedUser?.credits || 0;

      logger.info(
        `[${engine}] Deducted ${actualDeduction} credits for ${reference}. New balance: ${newBalance}`,
        undefined,
        'CreditService'
      );

      return {
        success: true,
        creditsDeducted: actualDeduction,
        newBalance,
        alreadyDeducted: false,
      } as CreditDeductionResult;
    });

    return result;

  } catch (error: any) {
    // Handle unique constraint violation (double submission caught by DB)
    if (error.code === '23505' || error.message?.includes('duplicate')) {
      logger.info(`Credits already deducted for ${reference} (caught by constraint)`, undefined, 'CreditService');
      return {
        success: true,
        creditsDeducted: 0,
        alreadyDeducted: true,
      };
    }

    logger.error(`Failed to deduct credits for ${reference}: ${error.message}`, error, 'CreditService');
    return {
      success: false,
      creditsDeducted: 0,
      error: error.message,
    };
  }
}

/**
 * Generate a deterministic 32-bit signed integer hash for PostgreSQL advisory locks.
 * Uses djb2 hash algorithm for good distribution within 32-bit range.
 */
function hashCode32(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash | 0; // Convert to 32-bit integer
  }
  return hash;
}

/**
 * Check if a user has sufficient credits for a call.
 */
export async function checkSufficientCredits(userId: string, requiredCredits: number = 1): Promise<boolean> {
  try {
    const [user] = await db
      .select({ credits: users.credits })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return (user?.credits || 0) >= requiredCredits;
  } catch (error: any) {
    logger.error(`Failed to check credits for user ${userId}: ${error.message}`, error, 'CreditService');
    return false;
  }
}

/**
 * Get user's current credit balance.
 */
export async function getUserCredits(userId: string): Promise<number> {
  try {
    const [user] = await db
      .select({ credits: users.credits })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user?.credits || 0;
  } catch (error: any) {
    logger.error(`Failed to get credits for user ${userId}: ${error.message}`, error, 'CreditService');
    return 0;
  }
}

export type RefundGateway = 'stripe' | 'razorpay' | 'paypal' | 'paystack' | 'mercadopago';

export interface RefundParams {
  userId: string;
  creditsToReverse: number;
  gateway: RefundGateway;
  gatewayRefundId: string;
  transactionId: string;
  reason?: string;
}

export interface RefundResult {
  success: boolean;
  creditsReversed: number;
  newBalance?: number;
  transactionId?: string;
  error?: string;
  alreadyProcessed?: boolean;
}

/**
 * Atomically reverses credits for a refund with transaction logging.
 * 
 * Features:
 * - Uses advisory lock to prevent concurrent refunds for same gateway refund
 * - Idempotent: Won't double-process if called multiple times for same refund
 * - Creates audit trail in credit_transactions table
 * - Uses negative amount to indicate credit reversal
 */
export async function applyRefund(params: RefundParams): Promise<RefundResult> {
  const { userId, creditsToReverse, gateway, gatewayRefundId, transactionId, reason } = params;

  if (creditsToReverse <= 0) {
    return { success: true, creditsReversed: 0, alreadyProcessed: false };
  }

  const reference = `refund:${gateway}:${gatewayRefundId}`;
  const description = reason 
    ? `${gateway.charAt(0).toUpperCase() + gateway.slice(1)} refund: ${reason}` 
    : `${gateway.charAt(0).toUpperCase() + gateway.slice(1)} refund for transaction ${transactionId}`;

  try {
    const result = await db.transaction(async (tx) => {
      // Generate deterministic lock keys for this refund
      const userHash = hashCode32(userId);
      const refHash = hashCode32(reference);
      
      // Acquire advisory lock to serialize concurrent requests for this exact refund
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${userHash}, ${refHash})`);

      // Check for existing refund transaction (idempotency)
      const existingTransactions = await tx
        .select()
        .from(creditTransactions)
        .where(and(
          eq(creditTransactions.reference, reference),
          eq(creditTransactions.userId, userId)
        ));

      if (existingTransactions.length > 0) {
        logger.info(`Refund already processed for ${reference} - skipping duplicate`, undefined, 'CreditService');
        return { 
          success: true, 
          creditsReversed: 0, 
          alreadyProcessed: true 
        } as RefundResult;
      }

      // Lock the user row and get current balance
      const lockResult = await tx.execute(
        sql`SELECT credits FROM users WHERE id = ${userId} FOR UPDATE`
      );
      const currentCredits = Number(lockResult.rows?.[0]?.credits) || 0;
      
      // Deduct credits (can't go below 0)
      const actualReversal = Math.min(creditsToReverse, currentCredits);

      // Update user credits
      const newBalance = Math.max(0, currentCredits - actualReversal);
      await tx
        .update(users)
        .set({ credits: newBalance })
        .where(eq(users.id, userId));

      // Record the refund transaction (negative amount)
      const [insertedTransaction] = await tx.insert(creditTransactions).values({
        userId,
        type: 'refund',
        amount: -actualReversal,
        description,
        reference,
      }).returning();

      logger.info(
        `[${gateway}] Reversed ${actualReversal} credits for refund ${gatewayRefundId}. New balance: ${newBalance}`,
        undefined,
        'CreditService'
      );

      return {
        success: true,
        creditsReversed: actualReversal,
        newBalance,
        transactionId: insertedTransaction?.id,
        alreadyProcessed: false,
      } as RefundResult;
    });

    return result;

  } catch (error: any) {
    // Handle unique constraint violation (double submission caught by DB)
    if (error.code === '23505' || error.message?.includes('duplicate')) {
      logger.info(`Refund already processed for ${reference} (caught by constraint)`, undefined, 'CreditService');
      return {
        success: true,
        creditsReversed: 0,
        alreadyProcessed: true,
      };
    }

    logger.error(`Failed to apply refund for ${reference}: ${error.message}`, error, 'CreditService');
    return {
      success: false,
      creditsReversed: 0,
      error: error.message,
    };
  }
}

// ============================================================
// SMS — per-segment credit charging
// ============================================================

export interface SmsChargeParams {
  userId: string;
  twilioMessageSid: string;
  segments: number;
  destinationCountry: string | null;
  /**
   * Optional sub-identifier so we can charge for the same Twilio message SID
   * multiple times if needed (e.g. a delta reconciliation after the status
   * callback reports a higher NumSegments than we estimated at send time).
   *
   * Use 'send' for the initial provisional charge and 'reconcile' for the
   * delta charge. Different sub-references → different credit_transactions
   * rows, while same sub-reference → idempotent skip.
   */
  subRef?: 'send' | 'reconcile';
}

export interface SmsChargeResult {
  success: boolean;
  creditsDeducted: number;
  newBalance?: number;
  rate: number;
  alreadyDeducted?: boolean;
  error?: string;
}

/**
 * Look up credits-per-segment for an ISO 3166-1 alpha-2 country code,
 * falling back to the iso_country='*' default row. Returns 0 if no default
 * row is configured (caller should treat as "free / not configured").
 */
export async function getSmsRateForCountry(isoCountry: string | null): Promise<number> {
  try {
    if (isoCountry) {
      const [row] = await db
        .select()
        .from(smsCountryRates)
        .where(eq(smsCountryRates.isoCountry, isoCountry.toUpperCase()))
        .limit(1);
      if (row) return row.creditsPerSegment;
    }
    const [fallback] = await db
      .select()
      .from(smsCountryRates)
      .where(eq(smsCountryRates.isoCountry, '*'))
      .limit(1);
    return fallback?.creditsPerSegment ?? 0;
  } catch (err: any) {
    logger.error(`Failed to resolve SMS rate for ${isoCountry}: ${err.message}`, err, 'CreditService');
    return 0;
  }
}

/**
 * Charge a user for an outbound SMS message. Atomic and idempotent on
 * `(userId, reference)` where reference = `sms:${twilioMessageSid}:${subRef}`.
 *
 * Workflow:
 *   1. Provisional charge at send time with subRef='send' using estimated
 *      segment count from body length.
 *   2. When Twilio status callback fires, if NumSegments > estimate the
 *      webhook reconciles by calling this again with subRef='reconcile' and
 *      `segments = NumSegments - estimate`.
 *
 * The `messages.credits_charged` column is bumped by the actual amount
 * deducted so the UI can show "X credits used on this message".
 */
export async function chargeSmsSegments(params: SmsChargeParams): Promise<SmsChargeResult> {
  const { userId, twilioMessageSid, segments, destinationCountry } = params;
  const subRef = params.subRef ?? 'send';

  if (segments <= 0) {
    return { success: true, creditsDeducted: 0, rate: 0, alreadyDeducted: false };
  }

  const ratePerSegment = await getSmsRateForCountry(destinationCountry);
  if (ratePerSegment <= 0) {
    logger.warn(
      `[sms] No SMS rate configured for ${destinationCountry ?? 'unknown'} and no default; skipping charge for ${twilioMessageSid}`,
      undefined,
      'CreditService'
    );
    return { success: true, creditsDeducted: 0, rate: 0, alreadyDeducted: false };
  }

  const creditsToDeduct = ratePerSegment * segments;
  const reference = `sms:${twilioMessageSid}:${subRef}`;
  const description = `SMS ${subRef === 'send' ? 'send' : 'reconcile'}: ${segments} segment${segments === 1 ? '' : 's'} × ${ratePerSegment} credit${ratePerSegment === 1 ? '' : 's'}/segment (${destinationCountry ?? '??'})`;

  try {
    const result = await db.transaction(async (tx) => {
      const userHash = hashCode32(userId);
      const refHash = hashCode32(reference);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${userHash}, ${refHash})`);

      const existing = await tx
        .select()
        .from(creditTransactions)
        .where(and(
          eq(creditTransactions.reference, reference),
          eq(creditTransactions.userId, userId)
        ));
      if (existing.length > 0) {
        logger.info(`[sms] Credits already deducted for ${reference} — skipping duplicate`, undefined, 'CreditService');
        return { success: true, creditsDeducted: 0, rate: ratePerSegment, alreadyDeducted: true } as SmsChargeResult;
      }

      const lockResult = await tx.execute(sql`SELECT credits FROM users WHERE id = ${userId} FOR UPDATE`);
      const currentCredits = Number(lockResult.rows?.[0]?.credits) || 0;

      if (currentCredits < creditsToDeduct) {
        // We deliberately do NOT short-charge here. The send route should
        // have called checkSufficientCredits() before calling Twilio; if we
        // get here, it's a reconcile delta. Record a transaction with the
        // best-effort amount so the audit log reflects what happened.
        const actual = Math.max(0, currentCredits);
        if (actual > 0) {
          await tx
            .update(users)
            .set({ credits: sql`${users.credits} - ${actual}` })
            .where(eq(users.id, userId));
          await tx.insert(creditTransactions).values({
            userId,
            type: 'usage',
            amount: -actual,
            description: `${description} (partial — insufficient balance)`,
            reference,
          });
          await tx
            .update(messages)
            .set({ creditsCharged: sql`${messages.creditsCharged} + ${actual}` })
            .where(eq(messages.twilioMessageSid, twilioMessageSid));
        }
        return {
          success: false,
          creditsDeducted: actual,
          rate: ratePerSegment,
          newBalance: Math.max(0, currentCredits - actual),
          error: 'Insufficient credits',
        } as SmsChargeResult;
      }

      await tx
        .update(users)
        .set({ credits: sql`${users.credits} - ${creditsToDeduct}` })
        .where(eq(users.id, userId));

      await tx.insert(creditTransactions).values({
        userId,
        type: 'usage',
        amount: -creditsToDeduct,
        description,
        reference,
      });

      await tx
        .update(messages)
        .set({ creditsCharged: sql`${messages.creditsCharged} + ${creditsToDeduct}` })
        .where(eq(messages.twilioMessageSid, twilioMessageSid));

      const [updated] = await tx
        .select({ credits: users.credits })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      logger.info(
        `[sms] Deducted ${creditsToDeduct} credits for ${reference}. New balance: ${updated?.credits ?? 0}`,
        undefined,
        'CreditService'
      );

      return {
        success: true,
        creditsDeducted: creditsToDeduct,
        rate: ratePerSegment,
        newBalance: updated?.credits ?? 0,
        alreadyDeducted: false,
      } as SmsChargeResult;
    });

    return result;
  } catch (error: any) {
    if (error.code === '23505' || error.message?.includes('duplicate')) {
      logger.info(`[sms] Credits already deducted for ${reference} (caught by constraint)`, undefined, 'CreditService');
      return { success: true, creditsDeducted: 0, rate: ratePerSegment, alreadyDeducted: true };
    }
    logger.error(`[sms] Failed to charge SMS credits for ${reference}: ${error.message}`, error, 'CreditService');
    return { success: false, creditsDeducted: 0, rate: ratePerSegment, error: error.message };
  }
}

/**
 * Estimate the number of SMS segments a body will take. Conservative: assumes
 * GSM-7 unless any character is outside the basic Latin range, in which case
 * we assume UCS-2. Real segment counts come back via Twilio's status callback.
 *
 *   GSM-7 single:  ≤ 160 chars
 *   GSM-7 multi:    70-char segments after that? — actually 153 chars per
 *                   segment (7-bit UDH eats some).
 *   UCS-2 single:  ≤ 70 chars
 *   UCS-2 multi:    67 chars per segment.
 */
export function estimateSmsSegments(body: string): number {
  if (!body) return 0;
  // Treat anything outside basic GSM-7 as UCS-2 (emoji, RTL scripts, etc.)
  const isUcs2 = /[^\u0000-\u007F\u00A0-\u00FF€]/.test(body);
  const len = body.length;
  if (isUcs2) {
    return len <= 70 ? 1 : Math.ceil(len / 67);
  }
  return len <= 160 ? 1 : Math.ceil(len / 153);
}
