import crypto from "crypto";
import { db } from "../db";
import { calendarConnections, type CalendarConnection } from "@shared/schema";
import { and, eq } from "drizzle-orm";

type Provider = "google" | "microsoft";

function nowPlusSeconds(sec: number): Date {
  return new Date(Date.now() + sec * 1000);
}

function isExpired(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() <= Date.now() + 30_000; // refresh 30s early
}

function buildAppointmentStartEnd(args: {
  appointmentDate: string;
  appointmentTime: string;
  durationMinutes: number;
}): { startIso: string; endIso: string } {
  const start = new Date(`${args.appointmentDate}T${args.appointmentTime}:00.000Z`);
  const end = new Date(start.getTime() + args.durationMinutes * 60_000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

async function refreshGoogleToken(conn: CalendarConnection): Promise<CalendarConnection> {
  if (!conn.refreshToken) return conn;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return conn;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: conn.refreshToken,
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return conn;
  const json: any = await res.json();
  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : 3600;

  const [updated] = await db
    .update(calendarConnections)
    .set({
      accessToken: json.access_token || conn.accessToken,
      tokenType: json.token_type || conn.tokenType,
      scope: json.scope || conn.scope,
      expiresAt: nowPlusSeconds(expiresIn),
      updatedAt: new Date(),
    })
    .where(eq(calendarConnections.id, conn.id))
    .returning();

  return updated || conn;
}

async function refreshMicrosoftToken(conn: CalendarConnection): Promise<CalendarConnection> {
  if (!conn.refreshToken) return conn;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return conn;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: conn.refreshToken,
    scope: conn.scope || "offline_access Calendars.ReadWrite",
  });

  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return conn;
  const json: any = await res.json();
  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : 3600;

  const [updated] = await db
    .update(calendarConnections)
    .set({
      accessToken: json.access_token || conn.accessToken,
      refreshToken: json.refresh_token || conn.refreshToken,
      tokenType: json.token_type || conn.tokenType,
      scope: json.scope || conn.scope,
      expiresAt: nowPlusSeconds(expiresIn),
      updatedAt: new Date(),
    })
    .where(eq(calendarConnections.id, conn.id))
    .returning();

  return updated || conn;
}

async function ensureValidAccessToken(conn: CalendarConnection): Promise<CalendarConnection> {
  if (!isExpired(conn.expiresAt as any)) return conn;
  if (conn.provider === "google") return refreshGoogleToken(conn);
  if (conn.provider === "microsoft") return refreshMicrosoftToken(conn);
  return conn;
}

export async function getCalendarConnection(userId: string, provider: Provider): Promise<CalendarConnection | null> {
  const [conn] = await db
    .select()
    .from(calendarConnections)
    .where(and(eq(calendarConnections.userId, userId), eq(calendarConnections.provider, provider), eq(calendarConnections.isActive, true)))
    .limit(1);
  return conn || null;
}

export async function upsertCalendarConnection(args: {
  userId: string;
  provider: Provider;
  accessToken: string;
  refreshToken?: string | null;
  scope?: string | null;
  tokenType?: string | null;
  expiresIn?: number | null;
}): Promise<CalendarConnection> {
  const expiresAt = args.expiresIn ? nowPlusSeconds(args.expiresIn) : null;

  const existing = await getCalendarConnection(args.userId, args.provider);
  if (existing) {
    const [updated] = await db
      .update(calendarConnections)
      .set({
        accessToken: args.accessToken,
        refreshToken: args.refreshToken ?? existing.refreshToken,
        scope: args.scope ?? existing.scope,
        tokenType: args.tokenType ?? existing.tokenType,
        expiresAt: expiresAt ?? existing.expiresAt,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(calendarConnections.id, existing.id))
      .returning();
    return updated!;
  }

  const [created] = await db
    .insert(calendarConnections)
    .values({
      id: crypto.randomUUID(),
      userId: args.userId,
      provider: args.provider,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken ?? null,
      scope: args.scope ?? null,
      tokenType: args.tokenType ?? null,
      expiresAt: expiresAt ?? null,
      calendarId: "primary",
      isActive: true,
      updatedAt: new Date(),
    })
    .returning();

  return created!;
}

export async function createCalendarEventForAppointment(args: {
  userId: string;
  appointment: {
    id: string;
    contactName: string;
    contactPhone: string;
    contactEmail?: string | null;
    appointmentDate: string;
    appointmentTime: string;
    duration: number;
    serviceName?: string | null;
    notes?: string | null;
  };
}): Promise<{ google?: boolean; microsoft?: boolean }> {
  const { startIso, endIso } = buildAppointmentStartEnd({
    appointmentDate: args.appointment.appointmentDate,
    appointmentTime: args.appointment.appointmentTime,
    durationMinutes: args.appointment.duration || 30,
  });

  const results: { google?: boolean; microsoft?: boolean } = {};

  // Google Calendar
  const googleConnRaw = await getCalendarConnection(args.userId, "google");
  if (googleConnRaw) {
    const googleConn = await ensureValidAccessToken(googleConnRaw);
    try {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(googleConn.calendarId || "primary")}/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${googleConn.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary: args.appointment.serviceName || `Appointment — ${args.appointment.contactName}`,
            description: [
              `Contact: ${args.appointment.contactName}`,
              `Phone: ${args.appointment.contactPhone}`,
              args.appointment.contactEmail ? `Email: ${args.appointment.contactEmail}` : null,
              args.appointment.notes ? `Notes: ${args.appointment.notes}` : null,
              `Appointment ID: ${args.appointment.id}`,
            ].filter(Boolean).join("\n"),
            start: { dateTime: startIso, timeZone: "UTC" },
            end: { dateTime: endIso, timeZone: "UTC" },
          }),
        }
      );
      results.google = res.ok;
    } catch {
      results.google = false;
    }
  }

  // Microsoft Outlook Calendar (Graph)
  const msConnRaw = await getCalendarConnection(args.userId, "microsoft");
  if (msConnRaw) {
    const msConn = await ensureValidAccessToken(msConnRaw);
    try {
      const res = await fetch("https://graph.microsoft.com/v1.0/me/events", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${msConn.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject: args.appointment.serviceName || `Appointment — ${args.appointment.contactName}`,
          body: {
            contentType: "Text",
            content: [
              `Contact: ${args.appointment.contactName}`,
              `Phone: ${args.appointment.contactPhone}`,
              args.appointment.contactEmail ? `Email: ${args.appointment.contactEmail}` : null,
              args.appointment.notes ? `Notes: ${args.appointment.notes}` : null,
              `Appointment ID: ${args.appointment.id}`,
            ].filter(Boolean).join("\n"),
          },
          start: { dateTime: startIso.replace("Z", ""), timeZone: "UTC" },
          end: { dateTime: endIso.replace("Z", ""), timeZone: "UTC" },
        }),
      });
      results.microsoft = res.ok;
    } catch {
      results.microsoft = false;
    }
  }

  return results;
}

