import { and, eq } from "drizzle-orm";
import twilio from "twilio";
import { db } from "../db";
import { workspaces, workspaceMembers } from "@shared/schema";
import { sealString, unsealString } from "../utils/crypto-seal";
import { getTwilioAuthToken, getTwilioAccountSid } from "./twilio-connector";

export type WorkspaceRole = "owner" | "admin" | "member";

export class WorkspaceService {
  static async getPrimaryWorkspaceForUser(userId: string): Promise<typeof workspaces.$inferSelect | null> {
    const rows = await db
      .select({ w: workspaces })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, userId))
      .limit(1);

    return rows[0]?.w ?? null;
  }

  static async assertUserIsWorkspaceMember(params: { workspaceId: string; userId: string }): Promise<void> {
    const rows = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, params.workspaceId), eq(workspaceMembers.userId, params.userId)))
      .limit(1);
    if (!rows[0]) {
      throw new Error("Not a member of this workspace");
    }
  }

  static async getWorkspace(workspaceId: string): Promise<typeof workspaces.$inferSelect | null> {
    const rows = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
    return rows[0] ?? null;
  }

  static async getWorkspaceTwilioSubaccountCredentials(workspaceId: string): Promise<{ accountSid: string; authToken: string } | null> {
    const ws = await this.getWorkspace(workspaceId);
    if (!ws?.twilioSubaccountSid || !ws.twilioSubaccountAuthTokenEnc) return null;
    return {
      accountSid: ws.twilioSubaccountSid,
      authToken: unsealString(ws.twilioSubaccountAuthTokenEnc),
    };
  }

  /**
   * Creates a Twilio subaccount for the workspace if not present.
   * Stores the auth token encrypted at rest.
   */
  static async ensureTwilioSubaccountProvisioned(workspaceId: string): Promise<{ accountSid: string; authToken: string }> {
    const ws = await this.getWorkspace(workspaceId);
    if (!ws) throw new Error("Workspace not found");
    if (ws.twilioSubaccountSid && ws.twilioSubaccountAuthTokenEnc) {
      return {
        accountSid: ws.twilioSubaccountSid,
        authToken: unsealString(ws.twilioSubaccountAuthTokenEnc),
      };
    }

    const masterSid = await getTwilioAccountSid();
    const masterToken = await getTwilioAuthToken();
    const masterClient = twilio(masterSid, masterToken, { accountSid: masterSid });

    const created = await masterClient.api.v2010.accounts.create({
      friendlyName: `Byan AI - ${ws.slug}`,
    });

    // Twilio returns authToken on subaccount creation; if not present, we cannot proceed.
    const authToken = (created as any).authToken as string | undefined;
    if (!authToken) {
      throw new Error("Twilio subaccount created but auth token was not returned");
    }

    await db
      .update(workspaces)
      .set({
        twilioSubaccountSid: created.sid,
        twilioSubaccountAuthTokenEnc: sealString(authToken),
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, workspaceId));

    return { accountSid: created.sid, authToken };
  }
}

