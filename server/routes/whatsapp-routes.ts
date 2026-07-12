import { Router, Response } from "express";
import crypto from "crypto";
import { RouteContext, AuthRequest } from "./common";
import { WorkspaceService } from "../services/workspace-service";
import { db } from "../db";
import {
  whatsappSenders,
  whatsappDidPool,
  insertWhatsappDidPoolSchema,
  phoneNumbers,
  whatsappBusinessAccounts,
  whatsappPhoneNumbersRemote,
  whatsappMessageTemplates,
  whatsappBusinessProfiles,
} from "@shared/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDomain } from "../utils/domain";
import { WhatsappSenderService } from "../services/whatsapp-sender.service";
import { whatsappContacts, conversations, messages } from "@shared/schema";
import { getWorkspaceTwilioClient } from "../services/twilio-connector";
import { WhatsappDidPoolService } from "../services/whatsapp-did-pool.service";
import { checkAdmin, AdminRequest } from "../middleware/admin-auth";
import { z } from "zod";
import { sealString, unsealString } from "../utils/crypto-seal";
import {
  exchangeCodeForToken,
  exchangeLongLivedToken,
  fetchWaba,
  fetchWabaPhoneNumbers,
  fetchWabaTemplates,
  fetchBusinessProfile,
  updateBusinessProfile,
  createTemplate,
  subscribeWabaWebhook,
  listAllAccessibleWabas,
  MetaGraphError,
  type AccessibleWaba,
} from "../services/meta-graph.service";

/** Compare Meta display_phone_number to our DB phone_number (handles spaces / formatting). */
function normalizePhoneDigits(input: string): string {
  return String(input).replace(/\D/g, "");
}

/**
 * ManyChat-style "import everything" from the Meta side after Embedded Signup.
 * Runs in the background after the callback returns to the user. Best-effort:
 * any one source failing (templates / phone numbers / business profile) does
 * not block the others. Records progress in `whatsapp_business_accounts.syncStatus`.
 */
async function importWabaAssets(params: {
  wabaRowId: string;
  wabaId: string;
  accessToken: string;
  graphVersion?: string;
  primarySenderId?: string;
  primaryPhoneNumberId?: string;
}): Promise<void> {
  const { wabaRowId, wabaId, accessToken, graphVersion, primarySenderId, primaryPhoneNumberId } = params;
  const now = () => new Date();

  await db
    .update(whatsappBusinessAccounts)
    .set({ syncStatus: "running", syncStartedAt: now(), syncError: null, updatedAt: now() })
    .where(eq(whatsappBusinessAccounts.id, wabaRowId));

  const errors: string[] = [];

  // 1. WABA metadata (best-effort refresh; the callback already wrote a baseline).
  try {
    const waba = await fetchWaba({ wabaId, accessToken, graphVersion });
    await db
      .update(whatsappBusinessAccounts)
      .set({
        name: waba.name ?? null,
        currency: waba.currency ?? null,
        timezoneId: waba.timezone_id ?? null,
        messageTemplateNamespace: waba.message_template_namespace ?? null,
        accountReviewStatus: waba.account_review_status ?? null,
        businessId: waba.on_behalf_of_business_info?.id ?? null,
        onBehalfOfBusinessInfo: (waba.on_behalf_of_business_info as any) ?? null,
        lastSyncedAt: now(),
        updatedAt: now(),
      })
      .where(eq(whatsappBusinessAccounts.id, wabaRowId));
  } catch (e: any) {
    errors.push(`waba: ${e?.message || e}`);
  }

  // 2. Phone numbers on this WABA.
  try {
    const numbers = await fetchWabaPhoneNumbers({ wabaId, accessToken, graphVersion });
    for (const n of numbers) {
      const existing = await db
        .select({ id: whatsappPhoneNumbersRemote.id })
        .from(whatsappPhoneNumbersRemote)
        .where(
          and(eq(whatsappPhoneNumbersRemote.wabaRowId, wabaRowId), eq(whatsappPhoneNumbersRemote.phoneNumberId, n.id)),
        )
        .limit(1);
      const row = {
        displayPhoneNumber: n.display_phone_number ?? null,
        verifiedName: n.verified_name ?? null,
        codeVerificationStatus: n.code_verification_status ?? null,
        qualityRating: n.quality_rating ?? null,
        nameStatus: n.name_status ?? null,
        platformType: n.platform_type ?? null,
        throughputLevel: n.throughput?.level ?? null,
        messagingLimitTier: n.messaging_limit_tier ?? null,
        rawJson: n as any,
        lastSyncedAt: now(),
        updatedAt: now(),
      };
      if (existing[0]) {
        await db.update(whatsappPhoneNumbersRemote).set(row).where(eq(whatsappPhoneNumbersRemote.id, existing[0].id));
      } else {
        await db.insert(whatsappPhoneNumbersRemote).values({ wabaRowId, phoneNumberId: n.id, ...row });
      }
    }
  } catch (e: any) {
    errors.push(`phone_numbers: ${e?.message || e}`);
  }

  // 3. Templates.
  try {
    const templates = await fetchWabaTemplates({ wabaId, accessToken, graphVersion });
    for (const t of templates) {
      const existing = await db
        .select({ id: whatsappMessageTemplates.id })
        .from(whatsappMessageTemplates)
        .where(
          and(
            eq(whatsappMessageTemplates.wabaRowId, wabaRowId),
            eq(whatsappMessageTemplates.name, t.name),
            eq(whatsappMessageTemplates.language, t.language),
          ),
        )
        .limit(1);
      const row = {
        metaTemplateId: t.id ?? null,
        status: t.status ?? "UNKNOWN",
        category: t.category ?? null,
        components: (t.components as any) ?? null,
        rejectionReason: t.rejected_reason ?? null,
        qualityScore: (t.quality_score as any) ?? null,
        lastSyncedAt: now(),
        updatedAt: now(),
      };
      if (existing[0]) {
        await db.update(whatsappMessageTemplates).set(row).where(eq(whatsappMessageTemplates.id, existing[0].id));
      } else {
        await db
          .insert(whatsappMessageTemplates)
          .values({ wabaRowId, name: t.name, language: t.language, ...row });
      }
    }
  } catch (e: any) {
    errors.push(`templates: ${e?.message || e}`);
  }

  // 4. Business profile for the primary sender's phone number.
  if (primarySenderId && primaryPhoneNumberId) {
    try {
      const profile = await fetchBusinessProfile({
        phoneNumberId: primaryPhoneNumberId,
        accessToken,
        graphVersion,
      });
      if (profile) {
        const existing = await db
          .select({ id: whatsappBusinessProfiles.id })
          .from(whatsappBusinessProfiles)
          .where(eq(whatsappBusinessProfiles.senderId, primarySenderId))
          .limit(1);
        const row = {
          about: profile.about ?? null,
          description: profile.description ?? null,
          email: profile.email ?? null,
          address: profile.address ?? null,
          vertical: profile.vertical ?? null,
          websites: (profile.websites as any) ?? null,
          profilePictureUrl: profile.profile_picture_url ?? null,
          profilePictureHandle: profile.profile_picture_handle ?? null,
          lastSyncedAt: now(),
          updatedAt: now(),
        };
        if (existing[0]) {
          await db.update(whatsappBusinessProfiles).set(row).where(eq(whatsappBusinessProfiles.id, existing[0].id));
        } else {
          await db.insert(whatsappBusinessProfiles).values({ senderId: primarySenderId, ...row });
        }
      }
    } catch (e: any) {
      errors.push(`business_profile: ${e?.message || e}`);
    }
  }

  // 5. Subscribe webhooks at WABA level (idempotent).
  try {
    await subscribeWabaWebhook({ wabaId, accessToken, graphVersion });
  } catch (e: any) {
    errors.push(`subscribed_apps: ${e?.message || e}`);
  }

  await db
    .update(whatsappBusinessAccounts)
    .set({
      syncStatus: errors.length ? "completed_with_errors" : "completed",
      syncCompletedAt: now(),
      syncError: errors.length ? errors.join("; ") : null,
      lastSyncedAt: now(),
      updatedAt: now(),
    })
    .where(eq(whatsappBusinessAccounts.id, wabaRowId));
}

/**
 * Upsert a workspace-scoped WABA row from a Meta WABA summary, storing the
 * encrypted access token and the expiry. Returns the local row id.
 */
async function upsertWabaRow(params: {
  workspaceId: string;
  waba: AccessibleWaba | { id: string; name?: string; currency?: string; timezone_id?: string; message_template_namespace?: string; account_review_status?: string; on_behalf_of_business_info?: { id?: string; name?: string } };
  accessToken: string;
  expiresAt: Date | null;
}): Promise<string> {
  const { workspaceId, waba, accessToken, expiresAt } = params;
  const existing = await db
    .select({ id: whatsappBusinessAccounts.id })
    .from(whatsappBusinessAccounts)
    .where(
      and(eq(whatsappBusinessAccounts.workspaceId, workspaceId), eq(whatsappBusinessAccounts.wabaId, waba.id)),
    )
    .limit(1);
  if (existing[0]) {
    await db
      .update(whatsappBusinessAccounts)
      .set({
        name: waba.name ?? null,
        currency: waba.currency ?? null,
        timezoneId: waba.timezone_id ?? null,
        messageTemplateNamespace: waba.message_template_namespace ?? null,
        accountReviewStatus: waba.account_review_status ?? null,
        businessId: waba.on_behalf_of_business_info?.id ?? null,
        onBehalfOfBusinessInfo: (waba.on_behalf_of_business_info as any) ?? null,
        accessTokenEnc: sealString(accessToken),
        accessTokenExpiresAt: expiresAt,
        syncStatus: "pending",
        syncStartedAt: null,
        syncCompletedAt: null,
        syncError: null,
        updatedAt: new Date(),
      })
      .where(eq(whatsappBusinessAccounts.id, existing[0].id));
    return existing[0].id;
  }
  const [created] = await db
    .insert(whatsappBusinessAccounts)
    .values({
      workspaceId,
      wabaId: waba.id,
      name: waba.name ?? null,
      currency: waba.currency ?? null,
      timezoneId: waba.timezone_id ?? null,
      messageTemplateNamespace: waba.message_template_namespace ?? null,
      accountReviewStatus: waba.account_review_status ?? null,
      businessId: waba.on_behalf_of_business_info?.id ?? null,
      onBehalfOfBusinessInfo: (waba.on_behalf_of_business_info as any) ?? null,
      accessTokenEnc: sealString(accessToken),
      accessTokenExpiresAt: expiresAt,
      syncStatus: "pending",
      updatedAt: new Date(),
    })
    .returning();
  return created.id;
}

/**
 * Discover all WABAs the Facebook user can access (owned + client + assigned)
 * and upsert + import each into the current workspace. Best-effort: a single
 * WABA failing doesn't stop the others. Skips any WABA already handled this
 * request (the "primary" one passed in `skipWabaIds`).
 */
async function importAllAccessibleWabas(params: {
  workspaceId: string;
  accessToken: string;
  graphVersion?: string;
  expiresAt: Date | null;
  skipWabaIds?: string[];
}): Promise<void> {
  const { workspaceId, accessToken, graphVersion, expiresAt, skipWabaIds } = params;
  const skip = new Set(skipWabaIds || []);
  let wabas: AccessibleWaba[] = [];
  try {
    wabas = await listAllAccessibleWabas({ accessToken, graphVersion });
  } catch (e: any) {
    console.warn("[WhatsApp] listAllAccessibleWabas failed:", e?.message || e);
    return;
  }
  for (const w of wabas) {
    if (skip.has(w.id)) continue;
    try {
      const wabaRowId = await upsertWabaRow({
        workspaceId,
        waba: w,
        accessToken,
        expiresAt,
      });
      await importWabaAssets({
        wabaRowId,
        wabaId: w.id,
        accessToken,
        graphVersion,
      });
    } catch (e: any) {
      console.warn(`[WhatsApp] import for WABA ${w.id} failed:`, e?.message || e);
    }
  }
}

/** Loads the access token stored on whatsapp_business_accounts (decrypted). */
async function getWabaAccessToken(workspaceId: string, wabaId: string): Promise<{ wabaRowId: string; accessToken: string } | null> {
  const [row] = await db
    .select()
    .from(whatsappBusinessAccounts)
    .where(and(eq(whatsappBusinessAccounts.workspaceId, workspaceId), eq(whatsappBusinessAccounts.wabaId, wabaId)))
    .limit(1);
  if (!row?.accessTokenEnc) return null;
  try {
    return { wabaRowId: row.id, accessToken: unsealString(row.accessTokenEnc) };
  } catch {
    return null;
  }
}

export function createWhatsappRoutes(ctx: RouteContext): Router {
  const router = Router();
  const { authenticateToken } = ctx;

  router.get("/api/whatsapp/verification-call-status", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const twilioPhoneNumberId = String(req.query.twilioPhoneNumberId || "").trim();
      if (!twilioPhoneNumberId) {
        return res.status(400).json({ error: "twilioPhoneNumberId is required" });
      }

      const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
      if (!workspace) return res.status(400).json({ error: "No workspace found for user" });
      await WorkspaceService.ensureTwilioSubaccountProvisioned(workspace.id);

      const rows = await db
        .select({
          id: phoneNumbers.id,
          phoneNumber: phoneNumbers.phoneNumber,
        })
        .from(phoneNumbers)
        .where(and(eq(phoneNumbers.id, twilioPhoneNumberId), eq(phoneNumbers.userId, req.userId!)))
        .limit(1);
      const owned = rows[0];
      if (!owned) {
        return res.status(404).json({ error: "Phone number not found" });
      }

      const client = await getWorkspaceTwilioClient(workspace.id);

      // Twilio returns most-recent first in practice, but we still sort defensively.
      const calls: any[] = await (client as any).calls.list({ to: owned.phoneNumber, pageSize: 20 });
      const inbound = (calls || [])
        .filter((c) => String(c?.direction || "").startsWith("inbound"))
        .sort((a, b) => {
          const at = new Date(a?.startTime || a?.dateCreated || 0).getTime();
          const bt = new Date(b?.startTime || b?.dateCreated || 0).getTime();
          return bt - at;
        });

      const latest = inbound[0] || null;
      return res.json({
        phoneNumber: owned.phoneNumber,
        found: !!latest,
        latest: latest
          ? {
              sid: latest.sid,
              from: latest.from,
              to: latest.to,
              status: latest.status,
              direction: latest.direction,
              startTime: latest.startTime || latest.dateCreated || null,
              duration: latest.duration ?? null,
            }
          : null,
      });
    } catch (e: any) {
      console.error("[WhatsApp] verification-call-status failed:", e);
      return res.status(500).json({ error: e?.message || "Failed to check verification call status" });
    }
  });

  router.post("/api/whatsapp/embedded-signup/callback", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { code, wabaId, phoneNumberId, graphVersion, twilioPhoneNumberId } = req.body as {
        code?: string;
        wabaId?: string;
        phoneNumberId?: string;
        graphVersion?: string;
        twilioPhoneNumberId?: string;
      };

      if (!code || !wabaId || !phoneNumberId) {
        return res.status(400).json({ error: "code, wabaId, and phoneNumberId are required" });
      }

      const gv = graphVersion || process.env.META_GRAPH_VERSION || "v21.0";

      const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
      if (!workspace) return res.status(400).json({ error: "No workspace found for user" });

      // Ensure customer subaccount exists (lazy provisioning)
      await WorkspaceService.ensureTwilioSubaccountProvisioned(workspace.id);

      const tokenInfo = await exchangeCodeForToken({ code, graphVersion: gv });
      const longLived = await exchangeLongLivedToken({ shortLivedToken: tokenInfo.accessToken, graphVersion: gv });
      const accessToken = longLived.accessToken;
      const expiresInSec = longLived.expiresIn ?? tokenInfo.expiresIn;

      // Validate that objects are real and read basic fields
      const waba = await fetchWaba({ wabaId, accessToken, graphVersion: gv });
      const phone = await (async () => {
        try {
          const numbers = await fetchWabaPhoneNumbers({ wabaId, accessToken, graphVersion: gv });
          return numbers.find((n) => n.id === phoneNumberId) || null;
        } catch {
          return null;
        }
      })();

      const phoneE164 = phone?.display_phone_number;
      if (!phoneE164) {
        return res.status(400).json({ error: "Meta did not return display_phone_number" });
      }

      // Resolve the Twilio inventory row to link, if any.
      // 1) If the client passed an explicit twilioPhoneNumberId, validate it matches Meta's E.164.
      // 2) Otherwise try to auto-match Meta's display_phone_number to any Twilio number the user owns.
      let resolvedTwilioPhoneNumberId: string | null = twilioPhoneNumberId || null;

      if (resolvedTwilioPhoneNumberId) {
        const ownedRows = await db
          .select({ id: phoneNumbers.id, phoneNumber: phoneNumbers.phoneNumber })
          .from(phoneNumbers)
          .where(and(eq(phoneNumbers.id, resolvedTwilioPhoneNumberId), eq(phoneNumbers.userId, req.userId!)))
          .limit(1);
        const owned = ownedRows[0];
        if (!owned) {
          return res.status(400).json({
            error:
              "The selected phone number was not found in your account, or you no longer have access to it. Pick a number from your list and try again.",
          });
        }
        const expectedDigits = normalizePhoneDigits(owned.phoneNumber);
        const metaDigits = normalizePhoneDigits(phoneE164);
        if (expectedDigits !== metaDigits) {
          return res.status(400).json({
            error:
              "The number you finished in Meta does not match the Twilio number you selected in step 1. In the Meta window, register exactly this number, then try again: " +
              owned.phoneNumber,
            metaPhone: phoneE164,
            expectedPhone: owned.phoneNumber,
          });
        }
      } else {
        // Auto-match: look for a Twilio number the user already owns that matches the E.164 from Meta.
        const metaDigits = normalizePhoneDigits(phoneE164);
        const userNumbers = await db
          .select({ id: phoneNumbers.id, phoneNumber: phoneNumbers.phoneNumber })
          .from(phoneNumbers)
          .where(eq(phoneNumbers.userId, req.userId!));
        const match = userNumbers.find((n) => normalizePhoneDigits(n.phoneNumber) === metaDigits);
        if (match) resolvedTwilioPhoneNumberId = match.id;
      }

      const webhookSecret = crypto.randomBytes(16).toString("hex");
      // If no Twilio number is linked, we still create the sender (so all the Meta data
      // shows up in the app), but flag it as "needs_twilio_number" — Twilio sender
      // registration is skipped until the user provides one.
      const initialStatus = resolvedTwilioPhoneNumberId ? "creating" : "needs_twilio_number";
      const [sender] = await db
        .insert(whatsappSenders)
        .values({
          workspaceId: workspace.id,
          twilioPhoneNumberId: resolvedTwilioPhoneNumberId,
          wabaId: waba.id,
          metaBusinessId: waba.on_behalf_of_business_info?.id ?? null,
          phoneNumberE164: phoneE164,
          profileName: phone?.verified_name || waba.name || "WhatsApp",
          status: initialStatus,
          webhookSecret,
          updatedAt: new Date(),
        })
        .returning();

      // Upsert workspace-scoped WABA row with stored encrypted access token.
      const expiresAt = expiresInSec ? new Date(Date.now() + expiresInSec * 1000) : null;
      const wabaRowId = await upsertWabaRow({ workspaceId: workspace.id, waba, accessToken, expiresAt });

      // Create/connect sender in the workspace Twilio subaccount via Senders API,
      // only when we actually have a Twilio inventory number linked. Without it,
      // Twilio Senders API would have nothing to attach the WhatsApp sender to.
      const baseUrl = getDomain(req.get("host") || undefined);
      let twilioSenderSid: string | undefined;
      let twilioSenderStatus: string | undefined;
      if (resolvedTwilioPhoneNumberId) {
        try {
          const createdSender = await WhatsappSenderService.createSender({ senderId: sender.id, baseUrl });
          twilioSenderSid = createdSender.senderSid;
          twilioSenderStatus = createdSender.status;
        } catch (e: any) {
          console.warn("[WhatsApp] Twilio sender registration failed (will still import Meta data):", e?.message || e);
          await db
            .update(whatsappSenders)
            .set({ status: "failed", failureReason: e?.message || "Twilio sender creation failed", updatedAt: new Date() })
            .where(eq(whatsappSenders.id, sender.id));
        }
      }

      // Fire-and-forget Meta-side asset import (templates, business profile, phone numbers, webhooks).
      void importWabaAssets({
        wabaRowId,
        wabaId: waba.id,
        accessToken,
        graphVersion: gv,
        primarySenderId: sender.id,
        primaryPhoneNumberId: phoneNumberId,
      }).catch((e) => console.error("[WhatsApp] importWabaAssets failed:", e));

      // ManyChat parity: discover EVERY WABA accessible via this Facebook login
      // (owned + client + assigned) and import each one in the background.
      void importAllAccessibleWabas({
        workspaceId: workspace.id,
        accessToken,
        graphVersion: gv,
        expiresAt,
        skipWabaIds: [waba.id],
      }).catch((e) => console.error("[WhatsApp] multi-WABA import failed:", e));

      return res.json({
        senderId: sender.id,
        wabaRowId,
        wabaId: waba.id,
        phoneNumberE164: phoneE164,
        status: twilioSenderStatus || "creating",
        twilioSenderSid,
      });
    } catch (e: any) {
      console.error("[WhatsApp] embedded signup callback failed:", e);
      const detail = e instanceof MetaGraphError ? { metaPayload: e.payload, metaStatus: e.status } : {};
      return res.status(500).json({ error: e?.message || "Failed to complete Embedded Signup", ...detail });
    }
  });

  router.get("/api/whatsapp/config", authenticateToken, async (_req: AuthRequest, res: Response) => {
    const appId = process.env.META_APP_ID;
    const configId = process.env.META_CONFIG_ID;
    const graphVersion = process.env.META_GRAPH_VERSION || "v21.0";

    if (!appId || !configId) {
      return res.status(503).json({
        error: "WhatsApp Embedded Signup is not configured",
        missing: {
          META_APP_ID: !appId,
          META_CONFIG_ID: !configId,
        },
      });
    }

    const requiredWabaId = process.env.META_WHATSAPP_REQUIRED_WABA_ID?.trim() || undefined;

    // Safe to expose (public identifiers only; secrets remain server-side)
    return res.json({
      appId,
      configId,
      graphVersion,
      ...(requiredWabaId ? { requiredWabaId } : {}),
    });
  });

  router.get("/api/whatsapp/senders", authenticateToken, async (req: AuthRequest, res: Response) => {
    const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
    if (!workspace) return res.status(400).json({ error: "No workspace found for user" });
    const rows = await db.select().from(whatsappSenders).where(eq(whatsappSenders.workspaceId, workspace.id));
    res.json(rows);
  });

  router.get("/api/inbox/conversations", authenticateToken, async (req: AuthRequest, res: Response) => {
    const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
    if (!workspace) return res.status(400).json({ error: "No workspace found for user" });

    const rows = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.workspaceId, workspace.id), eq(conversations.channel, "whatsapp")))
      .orderBy(desc(conversations.lastMessageAt))
      .limit(100);
    res.json(rows);
  });

  router.get("/api/inbox/conversations/:id/messages", authenticateToken, async (req: AuthRequest, res: Response) => {
    const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
    if (!workspace) return res.status(400).json({ error: "No workspace found for user" });

    const conversationId = String(req.params.id);
    const convo = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
    if (!convo[0] || convo[0].workspaceId !== workspace.id) return res.status(404).json({ error: "Conversation not found" });

    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(200);
    res.json(rows.reverse());
  });

  router.post("/api/whatsapp/messages", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { conversationId, body } = req.body as { conversationId?: string; body?: string };
      if (!conversationId || !body) return res.status(400).json({ error: "conversationId and body are required" });

      const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
      if (!workspace) return res.status(400).json({ error: "No workspace found for user" });

      const [convo] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
      if (!convo || convo.workspaceId !== workspace.id) return res.status(404).json({ error: "Conversation not found" });
      if (!convo.whatsappSenderId || !convo.contactId) return res.status(400).json({ error: "Conversation missing sender/contact" });

      const [sender] = await db.select().from(whatsappSenders).where(eq(whatsappSenders.id, convo.whatsappSenderId)).limit(1);
      const [contact] = await db.select().from(whatsappContacts).where(eq(whatsappContacts.id, convo.contactId)).limit(1);
      if (!sender || !contact) return res.status(400).json({ error: "Sender/contact not found" });

      await WorkspaceService.ensureTwilioSubaccountProvisioned(workspace.id);
      const twilioClient = await getWorkspaceTwilioClient(workspace.id);

      const msg = await (twilioClient as any).messages.create({
        from: `whatsapp:${sender.phoneNumberE164}`,
        to: `whatsapp:${contact.phoneNumberE164}`,
        body,
        statusCallback: `${getDomain(req.get("host") || undefined)}/api/webhooks/twilio/whatsapp/status/${sender.id}/${sender.webhookSecret}`,
      });

      const now = new Date();
      await db.insert(messages).values({
        conversationId,
        direction: "outbound",
        body,
        mediaUrls: [],
        twilioMessageSid: msg.sid,
        status: msg.status || "queued",
        createdAt: now,
      });
      await db.update(conversations).set({ lastMessageAt: now, updatedAt: now }).where(eq(conversations.id, conversationId));

      res.json({ sid: msg.sid, status: msg.status });
    } catch (e: any) {
      console.error("[WhatsApp] send message failed:", e);
      res.status(500).json({ error: e?.message || "Failed to send message" });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ManyChat-style "Channels → WhatsApp" model
  // ──────────────────────────────────────────────────────────────────────────

  router.get("/api/whatsapp/channels", authenticateToken, async (req: AuthRequest, res: Response) => {
    const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
    if (!workspace) return res.status(400).json({ error: "No workspace found for user" });

    const wabas = await db
      .select()
      .from(whatsappBusinessAccounts)
      .where(eq(whatsappBusinessAccounts.workspaceId, workspace.id))
      .orderBy(desc(whatsappBusinessAccounts.createdAt));

    const wabaIds = wabas.map((w) => w.id);
    const phones = wabaIds.length
      ? await db.select().from(whatsappPhoneNumbersRemote)
      : [];

    const senders = await db
      .select()
      .from(whatsappSenders)
      .where(eq(whatsappSenders.workspaceId, workspace.id));

    const byWaba: Record<string, any> = {};
    for (const w of wabas) {
      byWaba[w.id] = {
        id: w.id,
        wabaId: w.wabaId,
        name: w.name,
        currency: w.currency,
        timezoneId: w.timezoneId,
        accountReviewStatus: w.accountReviewStatus,
        businessId: w.businessId,
        syncStatus: w.syncStatus,
        syncError: w.syncError,
        lastSyncedAt: w.lastSyncedAt,
        phoneNumbers: [] as any[],
        senders: [] as any[],
      };
    }
    for (const p of phones) {
      if (byWaba[p.wabaRowId]) byWaba[p.wabaRowId].phoneNumbers.push(p);
    }
    for (const s of senders) {
      const match = wabas.find((w) => w.wabaId === s.wabaId);
      if (match) byWaba[match.id].senders.push({
        id: s.id,
        twilioSenderSid: s.twilioSenderSid,
        phoneNumberE164: s.phoneNumberE164,
        profileName: s.profileName,
        status: s.status,
        twilioPhoneNumberId: s.twilioPhoneNumberId,
        failureReason: s.failureReason,
      });
    }
    res.json(Object.values(byWaba));
  });

  router.get("/api/whatsapp/sync-status/:wabaRowId", authenticateToken, async (req: AuthRequest, res: Response) => {
    const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
    if (!workspace) return res.status(400).json({ error: "No workspace found for user" });

    const [w] = await db
      .select()
      .from(whatsappBusinessAccounts)
      .where(
        and(
          eq(whatsappBusinessAccounts.id, String(req.params.wabaRowId)),
          eq(whatsappBusinessAccounts.workspaceId, workspace.id),
        ),
      )
      .limit(1);
    if (!w) return res.status(404).json({ error: "WABA not found" });

    const [tplCountRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(whatsappMessageTemplates)
      .where(eq(whatsappMessageTemplates.wabaRowId, w.id));
    const [phoneCountRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(whatsappPhoneNumbersRemote)
      .where(eq(whatsappPhoneNumbersRemote.wabaRowId, w.id));

    res.json({
      wabaRowId: w.id,
      wabaId: w.wabaId,
      syncStatus: w.syncStatus,
      syncError: w.syncError,
      syncStartedAt: w.syncStartedAt,
      syncCompletedAt: w.syncCompletedAt,
      lastSyncedAt: w.lastSyncedAt,
      counts: {
        templates: Number(tplCountRow?.count || 0),
        phoneNumbers: Number(phoneCountRow?.count || 0),
      },
    });
  });

  router.post("/api/whatsapp/sync/:wabaRowId", authenticateToken, async (req: AuthRequest, res: Response) => {
    const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
    if (!workspace) return res.status(400).json({ error: "No workspace found for user" });
    const [w] = await db
      .select()
      .from(whatsappBusinessAccounts)
      .where(
        and(
          eq(whatsappBusinessAccounts.id, String(req.params.wabaRowId)),
          eq(whatsappBusinessAccounts.workspaceId, workspace.id),
        ),
      )
      .limit(1);
    if (!w) return res.status(404).json({ error: "WABA not found" });
    if (!w.accessTokenEnc) return res.status(400).json({ error: "No stored access token for this WABA" });

    let token: string;
    try {
      token = unsealString(w.accessTokenEnc);
    } catch {
      return res.status(500).json({ error: "Failed to decrypt stored access token" });
    }

    // Find primary sender + phone_number_id for business profile sync.
    const [primarySender] = await db
      .select()
      .from(whatsappSenders)
      .where(
        and(
          eq(whatsappSenders.workspaceId, workspace.id),
          eq(whatsappSenders.wabaId, w.wabaId),
        ),
      )
      .limit(1);
    const [primaryRemote] = primarySender
      ? await db
          .select()
          .from(whatsappPhoneNumbersRemote)
          .where(
            and(
              eq(whatsappPhoneNumbersRemote.wabaRowId, w.id),
              eq(whatsappPhoneNumbersRemote.displayPhoneNumber, primarySender.phoneNumberE164),
            ),
          )
          .limit(1)
      : [];

    void importWabaAssets({
      wabaRowId: w.id,
      wabaId: w.wabaId,
      accessToken: token,
      primarySenderId: primarySender?.id,
      primaryPhoneNumberId: primaryRemote?.phoneNumberId,
    }).catch((e) => console.error("[WhatsApp] manual import failed:", e));
    res.json({ ok: true });
  });

  router.get("/api/whatsapp/templates", authenticateToken, async (req: AuthRequest, res: Response) => {
    const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
    if (!workspace) return res.status(400).json({ error: "No workspace found for user" });
    const wabaRowId = String(req.query.wabaRowId || "");
    if (!wabaRowId) return res.status(400).json({ error: "wabaRowId is required" });
    const [w] = await db
      .select({ id: whatsappBusinessAccounts.id })
      .from(whatsappBusinessAccounts)
      .where(and(eq(whatsappBusinessAccounts.id, wabaRowId), eq(whatsappBusinessAccounts.workspaceId, workspace.id)))
      .limit(1);
    if (!w) return res.status(404).json({ error: "WABA not found" });

    const rows = await db
      .select()
      .from(whatsappMessageTemplates)
      .where(eq(whatsappMessageTemplates.wabaRowId, wabaRowId))
      .orderBy(desc(whatsappMessageTemplates.updatedAt));
    res.json(rows);
  });

  router.post("/api/whatsapp/templates", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
      if (!workspace) return res.status(400).json({ error: "No workspace found for user" });

      const parsed = z
        .object({
          wabaRowId: z.string().min(1),
          name: z.string().min(1),
          language: z.string().min(2),
          category: z.string().min(1),
          components: z.array(z.any()).min(1),
        })
        .parse(req.body);

      const [w] = await db
        .select()
        .from(whatsappBusinessAccounts)
        .where(
          and(
            eq(whatsappBusinessAccounts.id, parsed.wabaRowId),
            eq(whatsappBusinessAccounts.workspaceId, workspace.id),
          ),
        )
        .limit(1);
      if (!w || !w.accessTokenEnc) return res.status(404).json({ error: "WABA not found or has no token" });
      const token = unsealString(w.accessTokenEnc);

      const created = await createTemplate({
        wabaId: w.wabaId,
        accessToken: token,
        payload: {
          name: parsed.name,
          language: parsed.language,
          category: parsed.category,
          components: parsed.components,
        },
      });

      // Upsert local copy so it shows up immediately.
      const existing = await db
        .select({ id: whatsappMessageTemplates.id })
        .from(whatsappMessageTemplates)
        .where(
          and(
            eq(whatsappMessageTemplates.wabaRowId, w.id),
            eq(whatsappMessageTemplates.name, parsed.name),
            eq(whatsappMessageTemplates.language, parsed.language),
          ),
        )
        .limit(1);
      const row = {
        metaTemplateId: created.id ?? null,
        status: created.status || "PENDING",
        category: created.category || parsed.category,
        components: parsed.components as any,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      };
      if (existing[0]) {
        await db.update(whatsappMessageTemplates).set(row).where(eq(whatsappMessageTemplates.id, existing[0].id));
      } else {
        await db
          .insert(whatsappMessageTemplates)
          .values({ wabaRowId: w.id, name: parsed.name, language: parsed.language, ...row });
      }
      res.json({ ok: true, ...created });
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Invalid input", issues: e.issues });
      const detail = e instanceof MetaGraphError ? { metaPayload: e.payload, metaStatus: e.status } : {};
      res.status(500).json({ error: e?.message || "Failed to create template", ...detail });
    }
  });

  /**
   * Post-hoc link of a Twilio inventory number to an existing whatsapp_sender,
   * then run Twilio Senders API registration. Used by the ManyChat-style flow
   * where the user first signs in with Facebook, sees the imported numbers,
   * then picks a Twilio number to attach to each WABA phone number.
   */
  router.post("/api/whatsapp/senders/:senderId/link-twilio-number", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
      if (!workspace) return res.status(400).json({ error: "No workspace found for user" });

      const parsed = z.object({ twilioPhoneNumberId: z.string().min(1) }).parse(req.body);

      const [sender] = await db
        .select()
        .from(whatsappSenders)
        .where(and(eq(whatsappSenders.id, String(req.params.senderId)), eq(whatsappSenders.workspaceId, workspace.id)))
        .limit(1);
      if (!sender) return res.status(404).json({ error: "Sender not found" });

      const [owned] = await db
        .select({ id: phoneNumbers.id, phoneNumber: phoneNumbers.phoneNumber })
        .from(phoneNumbers)
        .where(and(eq(phoneNumbers.id, parsed.twilioPhoneNumberId), eq(phoneNumbers.userId, req.userId!)))
        .limit(1);
      if (!owned) return res.status(400).json({ error: "Twilio number not found in your account" });

      const expectedDigits = normalizePhoneDigits(owned.phoneNumber);
      const metaDigits = normalizePhoneDigits(sender.phoneNumberE164);
      if (expectedDigits !== metaDigits) {
        return res.status(400).json({
          error:
            "Selected Twilio number does not match this WhatsApp number. Twilio number must match the E.164 from Meta.",
          metaPhone: sender.phoneNumberE164,
          twilioPhone: owned.phoneNumber,
        });
      }

      await db
        .update(whatsappSenders)
        .set({ twilioPhoneNumberId: owned.id, status: "creating", failureReason: null, updatedAt: new Date() })
        .where(eq(whatsappSenders.id, sender.id));

      try {
        const baseUrl = getDomain(req.get("host") || undefined);
        const created = await WhatsappSenderService.createSender({ senderId: sender.id, baseUrl });
        res.json({ ok: true, twilioSenderSid: created.senderSid, status: created.status });
      } catch (e: any) {
        await db
          .update(whatsappSenders)
          .set({ status: "failed", failureReason: e?.message || "Twilio sender creation failed", updatedAt: new Date() })
          .where(eq(whatsappSenders.id, sender.id));
        res.status(500).json({ error: e?.message || "Failed to create Twilio sender" });
      }
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Invalid input", issues: e.issues });
      res.status(500).json({ error: e?.message || "Failed to link Twilio number" });
    }
  });

  router.get("/api/whatsapp/business-profile/:senderId", authenticateToken, async (req: AuthRequest, res: Response) => {
    const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
    if (!workspace) return res.status(400).json({ error: "No workspace found for user" });
    const [sender] = await db
      .select()
      .from(whatsappSenders)
      .where(and(eq(whatsappSenders.id, String(req.params.senderId)), eq(whatsappSenders.workspaceId, workspace.id)))
      .limit(1);
    if (!sender) return res.status(404).json({ error: "Sender not found" });

    const [profile] = await db
      .select()
      .from(whatsappBusinessProfiles)
      .where(eq(whatsappBusinessProfiles.senderId, sender.id))
      .limit(1);
    res.json({
      sender: {
        id: sender.id,
        phoneNumberE164: sender.phoneNumberE164,
        wabaId: sender.wabaId,
        status: sender.status,
        profileName: sender.profileName,
      },
      profile: profile || null,
    });
  });

  router.put("/api/whatsapp/business-profile/:senderId", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
      if (!workspace) return res.status(400).json({ error: "No workspace found for user" });

      const [sender] = await db
        .select()
        .from(whatsappSenders)
        .where(and(eq(whatsappSenders.id, String(req.params.senderId)), eq(whatsappSenders.workspaceId, workspace.id)))
        .limit(1);
      if (!sender || !sender.wabaId) return res.status(404).json({ error: "Sender not found" });

      const wabaCreds = await getWabaAccessToken(workspace.id, sender.wabaId);
      if (!wabaCreds) return res.status(400).json({ error: "No stored token for this WABA" });

      // Find the Meta phone_number_id for this sender via the remote phone numbers table.
      const [remote] = await db
        .select()
        .from(whatsappPhoneNumbersRemote)
        .where(
          and(
            eq(whatsappPhoneNumbersRemote.wabaRowId, wabaCreds.wabaRowId),
            eq(whatsappPhoneNumbersRemote.displayPhoneNumber, sender.phoneNumberE164),
          ),
        )
        .limit(1);
      if (!remote) return res.status(400).json({ error: "Remote phone number not yet synced. Try again in a moment." });

      const parsed = z
        .object({
          about: z.string().optional(),
          description: z.string().optional(),
          email: z.string().optional(),
          address: z.string().optional(),
          vertical: z.string().optional(),
          websites: z.array(z.string()).optional(),
        })
        .parse(req.body);

      await updateBusinessProfile({
        phoneNumberId: remote.phoneNumberId,
        accessToken: wabaCreds.accessToken,
        profile: parsed,
      });

      const existing = await db
        .select({ id: whatsappBusinessProfiles.id })
        .from(whatsappBusinessProfiles)
        .where(eq(whatsappBusinessProfiles.senderId, sender.id))
        .limit(1);
      const row = {
        about: parsed.about ?? null,
        description: parsed.description ?? null,
        email: parsed.email ?? null,
        address: parsed.address ?? null,
        vertical: parsed.vertical ?? null,
        websites: (parsed.websites as any) ?? null,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      };
      if (existing[0]) {
        await db.update(whatsappBusinessProfiles).set(row).where(eq(whatsappBusinessProfiles.id, existing[0].id));
      } else {
        await db.insert(whatsappBusinessProfiles).values({ senderId: sender.id, ...row });
      }
      res.json({ ok: true });
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Invalid input", issues: e.issues });
      const detail = e instanceof MetaGraphError ? { metaPayload: e.payload, metaStatus: e.status } : {};
      res.status(500).json({ error: e?.message || "Failed to update business profile", ...detail });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Tier 1 BSP DID pool — admin CRUD + customer auto-assign
  // ──────────────────────────────────────────────────────────────────────────

  router.get("/api/admin/whatsapp/did-pool", checkAdmin, async (_req: AdminRequest, res: Response) => {
    try {
      const rows = await WhatsappDidPoolService.listPool();
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Failed to list DID pool" });
    }
  });

  router.post("/api/admin/whatsapp/did-pool", checkAdmin, async (req: AdminRequest, res: Response) => {
    try {
      const parsed = insertWhatsappDidPoolSchema
        .pick({ phoneNumberE164: true, twilioPhoneNumberSid: true, metaPhoneNumberId: true, wabaId: true, notes: true })
        .parse(req.body);
      const row = await WhatsappDidPoolService.addDid(parsed);
      res.json(row);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Invalid input", issues: e.issues });
      const msg = e?.message || "Failed to add DID";
      // Unique constraint on phone_number_e164
      if (msg.includes("duplicate key") || msg.includes("unique")) {
        return res.status(409).json({ error: "This phone number is already in the pool" });
      }
      res.status(500).json({ error: msg });
    }
  });

  router.delete("/api/admin/whatsapp/did-pool/:id", checkAdmin, async (req: AdminRequest, res: Response) => {
    try {
      const r = await WhatsappDidPoolService.deleteDid(String(req.params.id));
      res.json(r);
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "Failed to delete DID" });
    }
  });

  router.post("/api/admin/whatsapp/did-pool/:id/disable", checkAdmin, async (req: AdminRequest, res: Response) => {
    try {
      const row = await WhatsappDidPoolService.disableDid(String(req.params.id));
      res.json(row);
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "Failed to disable DID" });
    }
  });

  router.post("/api/admin/whatsapp/did-pool/:id/release", checkAdmin, async (req: AdminRequest, res: Response) => {
    try {
      const row = await WhatsappDidPoolService.releaseDid(String(req.params.id));
      res.json(row);
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "Failed to release DID" });
    }
  });

  router.get("/api/whatsapp/assigned-sender", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
      if (!workspace) return res.status(400).json({ error: "No workspace found for user" });
      const row = await WhatsappDidPoolService.getAssignedForWorkspace(workspace.id);
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Failed to fetch assigned sender" });
    }
  });

  router.post("/api/whatsapp/auto-assign", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const schema = z.object({
        displayName: z
          .string()
          .min(2, "Display name must be at least 2 characters")
          .max(80, "Display name must be 80 characters or fewer"),
      });
      const { displayName } = schema.parse(req.body);

      const workspace = await WorkspaceService.getPrimaryWorkspaceForUser(req.userId!);
      if (!workspace) return res.status(400).json({ error: "No workspace found for user" });

      // Ensure workspace has a Twilio subaccount provisioned (parity with Embedded Signup flow)
      await WorkspaceService.ensureTwilioSubaccountProvisioned(workspace.id);

      const result = await WhatsappDidPoolService.assignNextAvailable(workspace.id, displayName);

      // Fire-and-log: request display name on Meta, register sender on Twilio (stubs in v1)
      if (!result.alreadyAssigned && result.pool.metaPhoneNumberId) {
        WhatsappDidPoolService.requestMetaDisplayName({
          metaPhoneNumberId: result.pool.metaPhoneNumberId,
          displayName,
        }).catch(() => undefined);
      }
      if (!result.alreadyAssigned) {
        WhatsappDidPoolService.registerTwilioWhatsappSender({
          twilioPhoneNumberSid: result.pool.twilioPhoneNumberSid,
          phoneNumberE164: result.pool.phoneNumberE164,
          workspaceId: workspace.id,
        }).catch(() => undefined);
      }

      res.json(result);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Invalid input", issues: e.issues });
      const msg = e?.message || "Failed to auto-assign WhatsApp number";
      const isPoolEmpty = msg.includes("No WhatsApp numbers available");
      res.status(isPoolEmpty ? 503 : 500).json({ error: msg });
    }
  });

  return router;
}

