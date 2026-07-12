import { db } from "../db";
import { phoneNumbers, ivrConfigurations } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getTwilioClient } from "./twilio-connector";
import { getDomain } from "../utils/domain";

type SyncResult = {
  phoneNumberId: string;
  phoneNumber: string;
  twilioSid: string;
  updated: boolean;
  reason?: string;
};

function normalizeUrl(url?: string | null): string {
  return String(url || "").trim();
}

function urlsEqual(a?: string | null, b?: string | null): boolean {
  return normalizeUrl(a) === normalizeUrl(b);
}

/**
 * Ensures every active Twilio phone number in the DB points to the correct
 * incoming voice webhook URL for THIS deployment.
 *
 * Prefer an active Deprock IVR answer URL when the number has an IVR config.
 * Blindly forcing `/api/webhooks/twilio/incoming` was wiping IVR VoiceUrls on
 * every deploy and causing Twilio 11200 / "out of service" until manually fixed.
 */
export async function syncTwilioPhoneNumberWebhooks(): Promise<SyncResult[]> {
  const enabled = (process.env.TWILIO_AUTO_WEBHOOK_SYNC || "true").toLowerCase() !== "false";
  if (!enabled) {
    console.log("🔧 [Twilio Webhooks] Auto-sync disabled via TWILIO_AUTO_WEBHOOK_SYNC=false");
    return [];
  }

  const baseUrl = normalizeUrl(getDomain());
  const defaultVoiceUrl = `${baseUrl}/api/webhooks/twilio/incoming`;
  const desiredStatusUrl = `${baseUrl}/api/webhooks/twilio/status`;
  const desiredFallbackUrl = defaultVoiceUrl;

  const rows = await db
    .select({
      id: phoneNumbers.id,
      phoneNumber: phoneNumbers.phoneNumber,
      twilioSid: phoneNumbers.twilioSid,
      status: phoneNumbers.status,
    })
    .from(phoneNumbers)
    .where(eq(phoneNumbers.status, "active"));

  const candidates = rows.filter((r) => !!r.twilioSid);
  if (candidates.length === 0) {
    console.log("🔧 [Twilio Webhooks] No active Twilio numbers found to sync");
    return [];
  }

  const activeIvrs = await db
    .select({
      id: ivrConfigurations.id,
      phoneNumberId: ivrConfigurations.phoneNumberId,
    })
    .from(ivrConfigurations)
    .where(eq(ivrConfigurations.isActive, true));

  const ivrByPhoneId = new Map<string, string>();
  for (const ivr of activeIvrs) {
    if (ivr.phoneNumberId && !ivrByPhoneId.has(ivr.phoneNumberId)) {
      ivrByPhoneId.set(ivr.phoneNumberId, ivr.id);
    }
  }

  const client = await getTwilioClient();
  const results: SyncResult[] = [];

  console.log(
    `🔧 [Twilio Webhooks] Syncing ${candidates.length} phone number(s) (IVR-aware; default → ${defaultVoiceUrl})`
  );

  for (const row of candidates) {
    let twilioSid = String(row.twilioSid);
    const ivrId = ivrByPhoneId.get(row.id);
    const desiredVoiceUrl = ivrId
      ? `${baseUrl}/api/deprock/ivr/answer?ivrId=${encodeURIComponent(ivrId)}&attempt=1`
      : defaultVoiceUrl;

    try {
      let current: any;
      try {
        current = await client.incomingPhoneNumbers(twilioSid).fetch();
      } catch (fetchErr: any) {
        const status = Number(fetchErr?.status);
        const code = Number(fetchErr?.code);
        const isNotFound = status === 404 || code === 20404;
        if (!isNotFound) throw fetchErr;

        // The stored Twilio SID doesn't exist under the currently-active account
        // (common after auth-token rotation, account migration, or moving a number
        // between sub-accounts). Re-discover by E.164 number in the active account.
        console.warn(
          `⚠️  [Twilio Webhooks] SID ${twilioSid} not found in active account for ${row.phoneNumber}. Re-discovering by phone number…`
        );
        const matches = await client.incomingPhoneNumbers.list({
          phoneNumber: row.phoneNumber,
          limit: 5,
        });
        if (!matches || matches.length === 0) {
          results.push({
            phoneNumberId: row.id,
            phoneNumber: row.phoneNumber,
            twilioSid,
            updated: false,
            reason: `Phone number not found in active Twilio account (SID ${twilioSid} is from a different account)`,
          });
          console.warn(
            `   ↳ ${row.phoneNumber} does not exist in this Twilio account. Re-import or update credentials in the admin panel.`
          );
          continue;
        }
        if (matches.length > 1) {
          // Refuse to auto-rebind on ambiguity — operator must pick the right SID.
          results.push({
            phoneNumberId: row.id,
            phoneNumber: row.phoneNumber,
            twilioSid,
            updated: false,
            reason: `Ambiguous: ${matches.length} Twilio numbers match ${row.phoneNumber}. Refusing to auto-rebind. SIDs: ${matches.map((m: any) => m.sid).join(", ")}`,
          });
          console.warn(
            `   ↳ ${row.phoneNumber} matched ${matches.length} records (${matches.map((m: any) => m.sid).join(", ")}). Resolve manually in the admin panel.`
          );
          continue;
        }
        const rediscovered: any = matches[0];
        const newSid = String(rediscovered.sid);
        console.log(
          `   ↳ Re-discovered ${row.phoneNumber}: updating DB twilioSid ${twilioSid} → ${newSid}`
        );
        await db
          .update(phoneNumbers)
          .set({ twilioSid: newSid })
          .where(eq(phoneNumbers.id, row.id));
        twilioSid = newSid;
        current = rediscovered;
      }

      const currentVoiceUrl = String((current as any).voiceUrl || "");
      const currentVoiceMethod = String((current as any).voiceMethod || "").toUpperCase();
      const currentStatusUrl = String((current as any).statusCallback || "");
      const currentStatusMethod = String((current as any).statusCallbackMethod || "").toUpperCase();
      const currentFallbackUrl = String((current as any).voiceFallbackUrl || "");

      const needsUpdate =
        !urlsEqual(currentVoiceUrl, desiredVoiceUrl) ||
        currentVoiceMethod !== "POST" ||
        !urlsEqual(currentStatusUrl, desiredStatusUrl) ||
        (currentStatusUrl && currentStatusMethod !== "POST") ||
        (ivrId && !urlsEqual(currentFallbackUrl, desiredFallbackUrl));

      if (!needsUpdate) {
        results.push({
          phoneNumberId: row.id,
          phoneNumber: row.phoneNumber,
          twilioSid,
          updated: false,
        });
        continue;
      }

      console.log(
        `   ↳ Updating ${row.phoneNumber}: voiceUrl → ${desiredVoiceUrl}${ivrId ? " (IVR)" : ""}`
      );

      await client.incomingPhoneNumbers(twilioSid).update({
        voiceUrl: desiredVoiceUrl,
        voiceMethod: "POST",
        voiceFallbackUrl: desiredFallbackUrl,
        voiceFallbackMethod: "POST",
        statusCallback: desiredStatusUrl,
        statusCallbackMethod: "POST",
      } as any);

      results.push({
        phoneNumberId: row.id,
        phoneNumber: row.phoneNumber,
        twilioSid,
        updated: true,
      });
    } catch (e: any) {
      results.push({
        phoneNumberId: row.id,
        phoneNumber: row.phoneNumber,
        twilioSid,
        updated: false,
        reason: e?.message || String(e),
      });
      console.warn(
        `⚠️  [Twilio Webhooks] Failed to sync ${row.phoneNumber} (${twilioSid}): ${e?.message || e}`
      );
    }
  }

  const updatedCount = results.filter((r) => r.updated).length;
  const failedCount = results.filter((r) => r.reason).length;
  console.log(
    `✅ [Twilio Webhooks] Sync complete: updated=${updatedCount}, failed=${failedCount}, total=${results.length}`
  );

  return results;
}

