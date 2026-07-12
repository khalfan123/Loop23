import { db } from "../db";
import { whatsappDidPool, whatsappSenders, workspaces } from "@shared/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import crypto from "crypto";
import { logger } from "../utils/logger";

type AddDidInput = {
  phoneNumberE164: string;
  twilioPhoneNumberSid?: string | null;
  metaPhoneNumberId?: string | null;
  wabaId?: string | null;
  notes?: string | null;
};

export class WhatsappDidPoolService {
  static async listPool() {
    return db.select().from(whatsappDidPool).orderBy(desc(whatsappDidPool.createdAt));
  }

  static async addDid(input: AddDidInput) {
    const wabaId = input.wabaId || process.env.META_WABA_ID || null;
    const [row] = await db
      .insert(whatsappDidPool)
      .values({
        phoneNumberE164: input.phoneNumberE164,
        twilioPhoneNumberSid: input.twilioPhoneNumberSid || null,
        metaPhoneNumberId: input.metaPhoneNumberId || null,
        wabaId,
        notes: input.notes || null,
        status: "available",
        updatedAt: new Date(),
      })
      .returning();
    return row;
  }

  static async deleteDid(id: string) {
    const [existing] = await db.select().from(whatsappDidPool).where(eq(whatsappDidPool.id, id)).limit(1);
    if (!existing) throw new Error("DID not found");
    if (existing.status === "assigned") {
      throw new Error("Cannot delete an assigned DID. Release it first.");
    }
    await db.delete(whatsappDidPool).where(eq(whatsappDidPool.id, id));
    return { id };
  }

  static async disableDid(id: string) {
    const [row] = await db
      .update(whatsappDidPool)
      .set({ status: "disabled", updatedAt: new Date() })
      .where(eq(whatsappDidPool.id, id))
      .returning();
    return row;
  }

  static async releaseDid(id: string) {
    const [existing] = await db.select().from(whatsappDidPool).where(eq(whatsappDidPool.id, id)).limit(1);
    if (!existing) throw new Error("DID not found");
    if (existing.assignedSenderId) {
      // Soft-delete the sender row to free the workspace from this number
      await db
        .update(whatsappSenders)
        .set({ status: "offline", failureReason: "Released by admin", updatedAt: new Date() })
        .where(eq(whatsappSenders.id, existing.assignedSenderId));
    }
    const [row] = await db
      .update(whatsappDidPool)
      .set({
        status: "available",
        assignedWorkspaceId: null,
        assignedSenderId: null,
        assignedAt: null,
        displayName: null,
        displayNameStatus: "not_requested",
        updatedAt: new Date(),
      })
      .where(eq(whatsappDidPool.id, id))
      .returning();
    return row;
  }

  static async getAssignedForWorkspace(workspaceId: string) {
    const [row] = await db
      .select()
      .from(whatsappDidPool)
      .where(and(eq(whatsappDidPool.assignedWorkspaceId, workspaceId), eq(whatsappDidPool.status, "assigned")))
      .limit(1);
    if (!row) return null;
    // Self-heal: if the linked sender row was deleted out from under us, free the pool entry.
    if (row.assignedSenderId) {
      const [s] = await db
        .select({ id: whatsappSenders.id })
        .from(whatsappSenders)
        .where(eq(whatsappSenders.id, row.assignedSenderId))
        .limit(1);
      if (!s) {
        await db
          .update(whatsappDidPool)
          .set({
            status: "available",
            assignedWorkspaceId: null,
            assignedSenderId: null,
            assignedAt: null,
            displayName: null,
            displayNameStatus: "not_requested",
            updatedAt: new Date(),
          })
          .where(eq(whatsappDidPool.id, row.id));
        return null;
      }
    }
    return row;
  }

  /**
   * Atomically pick the next available DID and assign it to the workspace.
   * Uses SELECT ... FOR UPDATE SKIP LOCKED to avoid races between concurrent assignments.
   * Creates a whatsapp_senders row and links it back to the pool entry.
   */
  static async assignNextAvailable(workspaceId: string, displayName: string) {
    // Confirm workspace exists
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
    if (!ws) throw new Error("Workspace not found");

    // Refuse to double-assign
    const existing = await this.getAssignedForWorkspace(workspaceId);
    if (existing) {
      return { pool: existing, alreadyAssigned: true as const };
    }

    return await db.transaction(async (tx) => {
      // Pick one available DID with row lock
      const picked = await tx.execute(
        sql`select * from whatsapp_did_pool where status = 'available' order by created_at asc for update skip locked limit 1`,
      );
      const rows = (picked as any).rows as Array<{ id: string; phone_number_e164: string; waba_id: string | null }>;
      if (!rows || rows.length === 0) {
        throw new Error(
          "No WhatsApp numbers available in the pool. Please contact support — an administrator needs to add more numbers.",
        );
      }
      const did = rows[0];

      // Create whatsapp_senders row
      const webhookSecret = crypto.randomBytes(16).toString("hex");
      const [sender] = await tx
        .insert(whatsappSenders)
        .values({
          workspaceId,
          phoneNumberE164: did.phone_number_e164,
          wabaId: did.waba_id,
          profileName: displayName,
          status: "creating",
          webhookSecret,
          updatedAt: new Date(),
        })
        .returning();

      // Mark pool entry assigned
      const [poolRow] = await tx
        .update(whatsappDidPool)
        .set({
          status: "assigned",
          assignedWorkspaceId: workspaceId,
          assignedSenderId: sender.id,
          assignedAt: new Date(),
          displayName,
          displayNameStatus: "pending",
          updatedAt: new Date(),
        })
        .where(eq(whatsappDidPool.id, did.id))
        .returning();

      return { pool: poolRow, sender, alreadyAssigned: false as const };
    });
  }

  /**
   * STUB: send a display-name change request to Meta Graph for the assigned WABA phone number.
   * Wire this up with your BSP system-user access token (META_SYSTEM_USER_TOKEN) when you go live.
   * Meta endpoint: POST /{phone-number-id} with { messaging_product: "whatsapp", verified_name: "<name>" }.
   * Approval is async (1–3 business days); poll `code_verification_status` / `name_status`.
   */
  static async requestMetaDisplayName(params: { metaPhoneNumberId: string; displayName: string }) {
    const token = process.env.META_SYSTEM_USER_TOKEN;
    if (!token) {
      logger.warn(
        "[WhatsappDidPool] META_SYSTEM_USER_TOKEN not set — display name request not sent to Meta. Stored locally as pending.",
        { metaPhoneNumberId: params.metaPhoneNumberId },
      );
      return { skipped: true as const };
    }
    logger.info(
      "[WhatsappDidPool] requestMetaDisplayName stub invoked — wire up Meta Graph call here.",
      { metaPhoneNumberId: params.metaPhoneNumberId, displayName: params.displayName },
    );
    return { skipped: false as const };
  }

  /**
   * STUB: create a Twilio WhatsApp Sender for an existing pool DID and bind it
   * into the customer subaccount's messaging service.
   * Wire to Twilio Senders API (POST /v1/Senders) with the BSP master credentials.
   */
  static async registerTwilioWhatsappSender(params: {
    twilioPhoneNumberSid?: string | null;
    phoneNumberE164: string;
    workspaceId: string;
  }) {
    logger.info(
      "[WhatsappDidPool] registerTwilioWhatsappSender stub invoked — wire up Twilio Senders API call here.",
      { phoneNumberE164: params.phoneNumberE164, workspaceId: params.workspaceId },
    );
    return { skipped: true as const };
  }
}
