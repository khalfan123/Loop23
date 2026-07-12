import crypto from "crypto";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { whatsappSenders } from "@shared/schema";
import { WorkspaceService } from "./workspace-service";
import twilio from "twilio";

type SenderCreateResult = {
  senderSid: string;
  status: string;
};

async function getSubaccountTwilioClient(workspaceId: string) {
  const creds = await WorkspaceService.ensureTwilioSubaccountProvisioned(workspaceId);
  return twilio(creds.accountSid, creds.authToken, { accountSid: creds.accountSid });
}

export class WhatsappSenderService {
  /**
   * Create (or connect) a WhatsApp Sender in the workspace subaccount.
   * Uses Twilio Messaging Senders API (v2).
   */
  static async createSender(params: {
    senderId: string; // local DB id
    baseUrl: string; // public https origin
  }): Promise<SenderCreateResult> {
    const [sender] = await db.select().from(whatsappSenders).where(eq(whatsappSenders.id, params.senderId)).limit(1);
    if (!sender) throw new Error("Sender not found");

    const client = await getSubaccountTwilioClient(sender.workspaceId);

    // Ensure webhook secret exists (defense in depth; schema requires it)
    const webhookSecret = sender.webhookSecret || crypto.randomBytes(16).toString("hex");
    if (webhookSecret !== sender.webhookSecret) {
      await db.update(whatsappSenders).set({ webhookSecret, updatedAt: new Date() }).where(eq(whatsappSenders.id, sender.id));
    }

    // Twilio expects "whatsapp:+E164"
    const twilioSenderIdentifier = `whatsapp:${sender.phoneNumberE164}`;

    const inboundUrl = `${params.baseUrl}/api/webhooks/twilio/whatsapp/inbound/${sender.id}/${webhookSecret}`;
    const statusUrl = `${params.baseUrl}/api/webhooks/twilio/whatsapp/status/${sender.id}/${webhookSecret}`;

    // NOTE: Twilio's exact parameter names may vary slightly by SDK version.
    // We use low-level request so we can ship without waiting on typings.
    const resp: any = await (client as any).request({
      method: "POST",
      uri: "/v2/Messaging/Senders",
      form: {
        sender_id: twilioSenderIdentifier,
        "configuration[waba_id]": sender.wabaId,
        "webhook[callback_url]": inboundUrl,
        "webhook[callback_method]": "POST",
        "webhook[status_callback_url]": statusUrl,
        "profile[name]": sender.profileName || "WhatsApp",
      },
    });

    const body = resp?.body || {};
    const senderSid = body.sid || body.sender_sid || body.id;
    const status = body.status || "pending_review";

    if (!senderSid) throw new Error("Twilio Senders API did not return a sender SID");

    await db
      .update(whatsappSenders)
      .set({
        twilioSenderSid: senderSid,
        status,
        updatedAt: new Date(),
      })
      .where(eq(whatsappSenders.id, sender.id));

    return { senderSid, status };
  }
}

