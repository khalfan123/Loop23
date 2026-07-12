import { db } from "../db";
import {
  ivrConfigurations,
  phoneNumbers,
  incomingConnections,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { twilioService } from "./twilio";

interface IvrMenuOption {
  key: string;
  label: string;
  departmentId: string;
}

interface IvrLanguageOption {
  id: string;
  language?: string;
  greeting?: string;
  selectedDepartments?: string[];
  [k: string]: unknown;
}

/**
 * Remove a deleted department from every IVR that references it.
 * If an IVR ends up with no menu options and no fallback department,
 * the IVR row is deleted and the Twilio voiceUrl is cleared so the
 * phone number un-grays in the UI and is free to be re-assigned.
 */
export async function cleanupDepartmentReferences(
  userId: string,
  deletedDepartmentId: string
): Promise<{
  ivrsUpdated: number;
  ivrsDeleted: number;
  phonesFreed: string[];
}> {
  const result = { ivrsUpdated: 0, ivrsDeleted: 0, phonesFreed: [] as string[] };

  const userIvrs = await db
    .select()
    .from(ivrConfigurations)
    .where(eq(ivrConfigurations.userId, userId));

  for (const ivr of userIvrs) {
    const oldMenu = (ivr.menuOptions as IvrMenuOption[] | null) || [];
    const newMenu = oldMenu.filter((o) => o.departmentId !== deletedDepartmentId);

    const oldLangs = (ivr.languageOptions as IvrLanguageOption[] | null) || [];
    const newLangs = oldLangs.map((lang) => ({
      ...lang,
      selectedDepartments: (lang.selectedDepartments || []).filter(
        (d) => d !== deletedDepartmentId
      ),
    }));

    const fallbackCleared = ivr.fallbackDepartmentId === deletedDepartmentId;
    const menuChanged = newMenu.length !== oldMenu.length;
    const langsChanged = oldLangs.some(
      (l, i) =>
        (l.selectedDepartments || []).length !==
        (newLangs[i].selectedDepartments || []).length
    );

    if (!menuChanged && !langsChanged && !fallbackCleared) continue;

    const stillHasReferences =
      newMenu.length > 0 ||
      newLangs.some((l) => (l.selectedDepartments || []).length > 0) ||
      (!fallbackCleared && !!ivr.fallbackDepartmentId);

    if (stillHasReferences) {
      await db
        .update(ivrConfigurations)
        .set({
          menuOptions: newMenu,
          languageOptions: newLangs,
          fallbackDepartmentId: fallbackCleared ? null : ivr.fallbackDepartmentId,
          updatedAt: new Date(),
        })
        .where(eq(ivrConfigurations.id, ivr.id));
      result.ivrsUpdated += 1;
      console.log(
        `[DeptCleanup] Updated IVR ${ivr.id}: removed dept ${deletedDepartmentId} (menu: ${oldMenu.length}->${newMenu.length})`
      );
      continue;
    }

    // IVR has no remaining departments — delete it and free the phone number
    await db.delete(ivrConfigurations).where(eq(ivrConfigurations.id, ivr.id));
    result.ivrsDeleted += 1;
    console.log(`[DeptCleanup] Deleted empty IVR ${ivr.id}`);

    if (ivr.phoneNumberId) {
      const phone = await db
        .select()
        .from(phoneNumbers)
        .where(eq(phoneNumbers.id, ivr.phoneNumberId))
        .limit(1);

      if (phone[0]?.twilioSid) {
        try {
          await twilioService.updatePhoneNumber(phone[0].twilioSid, {
            voiceUrl: "",
          });
          console.log(
            `[DeptCleanup] Cleared Twilio webhook for ${phone[0].phoneNumber}`
          );
        } catch (err: any) {
          console.error(
            `[DeptCleanup] Failed to clear Twilio webhook for ${phone[0].phoneNumber}: ${err?.message}`
          );
        }
        result.phonesFreed.push(phone[0].phoneNumber);
      }

      try {
        await db
          .delete(incomingConnections)
          .where(
            and(
              eq(incomingConnections.userId, userId),
              eq(incomingConnections.phoneNumberId, ivr.phoneNumberId)
            )
          );
      } catch {
        // table or column may differ across deployments; non-fatal
      }
    }
  }

  return result;
}
