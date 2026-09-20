import { Router, Request, Response } from "express";
import crypto from "crypto";
import { db } from "../db";
import { calendarOauthStates } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { getDomain } from "../utils/domain";
import { upsertCalendarConnection, getCalendarConnection } from "../services/calendar-sync";

type Provider = "google" | "microsoft";

function base64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function sha256Base64Url(input: string): string {
  const hash = crypto.createHash("sha256").update(input).digest();
  return base64Url(hash);
}

function makeState(): string {
  return base64Url(crypto.randomBytes(24));
}

function makeVerifier(): string {
  return base64Url(crypto.randomBytes(32));
}

function requireUserId(req: any): string {
  const userId = req.userId || req?.user?.id;
  if (!userId) throw new Error("Unauthorized");
  return String(userId);
}

async function saveOauthState(args: {
  userId: string;
  provider: Provider;
  state: string;
  codeVerifier: string;
  redirectUri: string;
}) {
  await db.insert(calendarOauthStates).values({
    id: crypto.randomUUID(),
    userId: args.userId,
    provider: args.provider,
    state: args.state,
    codeVerifier: args.codeVerifier,
    redirectUri: args.redirectUri,
  });
}

async function consumeOauthState(state: string, provider: Provider) {
  const [row] = await db
    .select()
    .from(calendarOauthStates)
    .where(and(eq(calendarOauthStates.state, state), eq(calendarOauthStates.provider, provider)))
    .limit(1);
  if (!row) return null;
  await db.delete(calendarOauthStates).where(eq(calendarOauthStates.id, row.id));
  return row;
}

async function exchangeGoogleCode(args: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: args.code,
    code_verifier: args.codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: args.redirectUri,
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error_description || json.error || "Google token exchange failed");
  return json;
}

async function exchangeMicrosoftCode(args: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}) {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Missing MICROSOFT_CLIENT_ID/MICROSOFT_CLIENT_SECRET");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: args.code,
    code_verifier: args.codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: args.redirectUri,
    scope: "offline_access Calendars.ReadWrite",
  });

  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error_description || json.error || "Microsoft token exchange failed");
  return json;
}

function callbackHtml(payload: Record<string, any>) {
  const safe = JSON.stringify(payload).replace(/</g, "\\u003c");
  return `<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>Connected</title></head>
  <body>
    <script>
      try {
        const payload = ${safe};
        if (window.opener) window.opener.postMessage(payload, window.location.origin);
      } catch (e) {}
      window.close();
    </script>
    <p>You can close this window.</p>
  </body>
</html>`;
}

export const calendarOAuthPublicRouter = Router();
export const calendarOAuthAuthedRouter = Router();

calendarOAuthAuthedRouter.get("/connections", async (req: any, res: Response) => {
  try {
    const userId = requireUserId(req);
    const google = await getCalendarConnection(userId, "google");
    const microsoft = await getCalendarConnection(userId, "microsoft");
    res.json({
      google: { connected: !!google, updatedAt: google?.updatedAt || null },
      outlook: { connected: !!microsoft, updatedAt: microsoft?.updatedAt || null },
    });
  } catch (e: any) {
    res.status(401).json({ error: e.message || "Unauthorized" });
  }
});

calendarOAuthAuthedRouter.get("/:provider/start", async (req: any, res: Response) => {
  try {
    const provider = req.params.provider as Provider;
    if (provider !== "google" && provider !== "microsoft") return res.status(400).send("Invalid provider");
    const userId = requireUserId(req);

    const domain = getDomain();
    const redirectUri = `${domain}/api/calendar/${provider}/callback`;
    const state = makeState();
    const codeVerifier = makeVerifier();
    const codeChallenge = sha256Base64Url(codeVerifier);

    await saveOauthState({ userId, provider, state, codeVerifier, redirectUri });

    if (provider === "google") {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) return res.status(500).send("Missing GOOGLE_CLIENT_ID");
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("access_type", "offline");
      url.searchParams.set("prompt", "consent");
      url.searchParams.set("scope", "openid email profile https://www.googleapis.com/auth/calendar.events");
      url.searchParams.set("state", state);
      url.searchParams.set("code_challenge", codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
      return res.redirect(url.toString());
    }

    // Microsoft
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    if (!clientId) return res.status(500).send("Missing MICROSOFT_CLIENT_ID");
    const url = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("response_mode", "query");
    url.searchParams.set("scope", "offline_access Calendars.ReadWrite");
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    return res.redirect(url.toString());
  } catch (e: any) {
    return res.status(500).send(e.message || "Failed to start OAuth");
  }
});

calendarOAuthPublicRouter.get("/:provider/callback", async (req: Request, res: Response) => {
  const provider = req.params.provider as Provider;
  if (provider !== "google" && provider !== "microsoft") return res.status(400).send("Invalid provider");

  const code = typeof req.query.code === "string" ? req.query.code : null;
  const state = typeof req.query.state === "string" ? req.query.state : null;
  const error = typeof req.query.error === "string" ? req.query.error : null;

  if (error) {
    return res.status(200).send(callbackHtml({ ok: false, provider, error }));
  }
  if (!code || !state) {
    return res.status(200).send(callbackHtml({ ok: false, provider, error: "Missing code/state" }));
  }

  try {
    const row = await consumeOauthState(state, provider);
    if (!row) return res.status(200).send(callbackHtml({ ok: false, provider, error: "Invalid or expired state" }));

    const tokenJson =
      provider === "google"
        ? await exchangeGoogleCode({ code, codeVerifier: row.codeVerifier, redirectUri: row.redirectUri })
        : await exchangeMicrosoftCode({ code, codeVerifier: row.codeVerifier, redirectUri: row.redirectUri });

    await upsertCalendarConnection({
      userId: row.userId,
      provider,
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token || null,
      scope: tokenJson.scope || null,
      tokenType: tokenJson.token_type || null,
      expiresIn: tokenJson.expires_in || null,
    });

    return res.status(200).send(callbackHtml({ ok: true, provider }));
  } catch (e: any) {
    return res.status(200).send(callbackHtml({ ok: false, provider, error: e.message || "OAuth failed" }));
  }
});

export default calendarOAuthAuthedRouter;

