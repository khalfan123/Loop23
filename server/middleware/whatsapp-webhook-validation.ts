import { NextFunction, Response } from "express";
import { db } from "../db";
import { whatsappSenders, workspaces } from "@shared/schema";
import { eq } from "drizzle-orm";
import { unsealString } from "../utils/crypto-seal";
import twilio from "twilio";
import type { Request } from "express";
import crypto from "crypto";

export interface WhatsappWebhookRequest extends Request {
  workspaceId?: string;
  senderId?: string;
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export async function validateWhatsappWebhook(req: WhatsappWebhookRequest, res: Response, next: NextFunction) {
  try {
    const { senderId, webhookSecret } = req.params as any;
    if (!senderId || !webhookSecret) return res.status(400).send("Missing senderId/webhookSecret");

    const senderRows = await db.select().from(whatsappSenders).where(eq(whatsappSenders.id, senderId)).limit(1);
    const sender = senderRows[0];
    if (!sender) return res.status(404).send("Sender not found");

    if (!timingSafeEqual(webhookSecret, sender.webhookSecret)) {
      return res.status(403).send("Invalid webhook secret");
    }

    const wsRows = await db.select().from(workspaces).where(eq(workspaces.id, sender.workspaceId)).limit(1);
    const ws = wsRows[0];
    if (!ws?.twilioSubaccountSid || !ws.twilioSubaccountAuthTokenEnc) {
      return res.status(503).send("Workspace subaccount not provisioned");
    }

    const authToken = unsealString(ws.twilioSubaccountAuthTokenEnc);
    const signature = req.header("X-Twilio-Signature") || "";

    // Build absolute URL used for signature validation.
    const proto = (req.header("x-forwarded-proto") || req.protocol || "https").split(",")[0].trim();
    const host = req.header("x-forwarded-host") || req.get("host");
    const url = `${proto}://${host}${req.originalUrl}`;

    const isValid = twilio.validateRequest(authToken, signature, url, req.body || {});
    if (!isValid) {
      return res.status(403).send("Invalid Twilio signature");
    }

    req.workspaceId = sender.workspaceId;
    req.senderId = sender.id;
    next();
  } catch (e) {
    console.error("[WhatsApp] webhook validation error:", e);
    res.status(500).send("Webhook validation error");
  }
}

