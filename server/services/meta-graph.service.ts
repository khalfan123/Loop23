/**
 * Meta Graph helper for ManyChat-style WhatsApp onboarding.
 *
 * Centralises:
 *  - OAuth code → access token exchange
 *  - Token debug + long-lived exchange (best-effort; the access_token returned
 *    by Embedded Signup's response_type=code is already long-lived in practice
 *    for Tech Providers, but we expose helpers regardless)
 *  - Paginated Graph reads (templates, phone numbers, business profile)
 *  - WABA webhook subscription
 */

type MetaTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

type Json = Record<string, unknown> | unknown[];

export class MetaGraphError extends Error {
  status: number;
  payload: any;
  constructor(message: string, status: number, payload: any) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

function getGraphVersion(override?: string): string {
  return override || process.env.META_GRAPH_VERSION || "v21.0";
}

function getAppCreds(): { appId: string; appSecret: string } {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("META_APP_ID and META_APP_SECRET are required");
  }
  return { appId, appSecret };
}

async function graphFetch<T = any>(url: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(url, init);
  let json: any = null;
  try {
    json = await resp.json();
  } catch {
    // ignore
  }
  if (!resp.ok) {
    const msg = json?.error?.message || resp.statusText || "Meta Graph request failed";
    throw new MetaGraphError(msg, resp.status, json);
  }
  return json as T;
}

export async function exchangeCodeForToken(params: {
  code: string;
  graphVersion?: string;
}): Promise<{ accessToken: string; expiresIn: number | null }> {
  const { appId, appSecret } = getAppCreds();
  const gv = getGraphVersion(params.graphVersion);
  const qs = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    code: params.code,
  });
  const url = `https://graph.facebook.com/${gv}/oauth/access_token?${qs.toString()}`;
  const json = await graphFetch<MetaTokenResponse>(url);
  if (!json.access_token) throw new Error("Meta did not return access_token");
  return {
    accessToken: json.access_token,
    expiresIn: typeof json.expires_in === "number" ? json.expires_in : null,
  };
}

export async function exchangeLongLivedToken(params: {
  shortLivedToken: string;
  graphVersion?: string;
}): Promise<{ accessToken: string; expiresIn: number | null }> {
  const { appId, appSecret } = getAppCreds();
  const gv = getGraphVersion(params.graphVersion);
  const qs = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: params.shortLivedToken,
  });
  const url = `https://graph.facebook.com/${gv}/oauth/access_token?${qs.toString()}`;
  try {
    const json = await graphFetch<MetaTokenResponse>(url);
    if (!json.access_token) return { accessToken: params.shortLivedToken, expiresIn: null };
    return {
      accessToken: json.access_token,
      expiresIn: typeof json.expires_in === "number" ? json.expires_in : null,
    };
  } catch (e: any) {
    // If long-lived exchange isn't permitted for this token type, fall back to the original.
    console.warn("[MetaGraph] long-lived token exchange failed, keeping original:", e?.message || e);
    return { accessToken: params.shortLivedToken, expiresIn: null };
  }
}

export async function fetchObject<T = any>(params: {
  id: string;
  accessToken: string;
  fields?: string[];
  graphVersion?: string;
}): Promise<T> {
  const gv = getGraphVersion(params.graphVersion);
  const qs = new URLSearchParams({ access_token: params.accessToken });
  if (params.fields?.length) qs.set("fields", params.fields.join(","));
  const url = `https://graph.facebook.com/${gv}/${params.id}?${qs.toString()}`;
  return graphFetch<T>(url);
}

export async function fetchPaginated<T = any>(params: {
  initialUrl: string;
  accessToken: string;
  maxPages?: number;
}): Promise<T[]> {
  const maxPages = params.maxPages ?? 25;
  const out: T[] = [];
  let nextUrl: string | undefined = params.initialUrl;
  // Some "next" cursors already include the access_token; we still pass header as fallback.
  for (let page = 0; page < maxPages && nextUrl; page++) {
    const url = nextUrl;
    const resp: any = await graphFetch<any>(url, {
      headers: { Authorization: `Bearer ${params.accessToken}` },
    });
    const data: T[] = Array.isArray(resp?.data) ? resp.data : [];
    out.push(...data);
    nextUrl = resp?.paging?.next;
  }
  return out;
}

export type WabaSummary = {
  id: string;
  name?: string;
  currency?: string;
  timezone_id?: string;
  message_template_namespace?: string;
  account_review_status?: string;
  on_behalf_of_business_info?: { id?: string; name?: string };
};

const WABA_FIELDS = [
  "id",
  "name",
  "currency",
  "timezone_id",
  "message_template_namespace",
  "account_review_status",
  "on_behalf_of_business_info",
];

export async function fetchWaba(params: {
  wabaId: string;
  accessToken: string;
  graphVersion?: string;
}): Promise<WabaSummary> {
  return fetchObject<WabaSummary>({
    id: params.wabaId,
    accessToken: params.accessToken,
    fields: WABA_FIELDS,
    graphVersion: params.graphVersion,
  });
}

const PHONE_NUMBER_FIELDS = [
  "id",
  "display_phone_number",
  "verified_name",
  "code_verification_status",
  "quality_rating",
  "name_status",
  "platform_type",
  "throughput",
  "messaging_limit_tier",
];

export type WabaPhoneNumber = {
  id: string;
  display_phone_number?: string;
  verified_name?: string;
  code_verification_status?: string;
  quality_rating?: string;
  name_status?: string;
  platform_type?: string;
  throughput?: { level?: string };
  messaging_limit_tier?: string;
};

export async function fetchWabaPhoneNumbers(params: {
  wabaId: string;
  accessToken: string;
  graphVersion?: string;
}): Promise<WabaPhoneNumber[]> {
  const gv = getGraphVersion(params.graphVersion);
  const url = `https://graph.facebook.com/${gv}/${params.wabaId}/phone_numbers?fields=${PHONE_NUMBER_FIELDS.join(",")}`;
  return fetchPaginated<WabaPhoneNumber>({ initialUrl: url, accessToken: params.accessToken });
}

const TEMPLATE_FIELDS = [
  "id",
  "name",
  "language",
  "status",
  "category",
  "components",
  "rejected_reason",
  "quality_score",
];

export type WabaTemplate = {
  id?: string;
  name: string;
  language: string;
  status: string;
  category?: string;
  components?: Json;
  rejected_reason?: string;
  quality_score?: Json;
};

export async function fetchWabaTemplates(params: {
  wabaId: string;
  accessToken: string;
  graphVersion?: string;
}): Promise<WabaTemplate[]> {
  const gv = getGraphVersion(params.graphVersion);
  const url = `https://graph.facebook.com/${gv}/${params.wabaId}/message_templates?fields=${TEMPLATE_FIELDS.join(",")}&limit=100`;
  return fetchPaginated<WabaTemplate>({ initialUrl: url, accessToken: params.accessToken });
}

export type WabaBusinessProfile = {
  about?: string;
  description?: string;
  email?: string;
  address?: string;
  vertical?: string;
  websites?: string[];
  profile_picture_url?: string;
  profile_picture_handle?: string;
};

const BUSINESS_PROFILE_FIELDS = [
  "about",
  "description",
  "email",
  "address",
  "vertical",
  "websites",
  "profile_picture_url",
];

export async function fetchBusinessProfile(params: {
  phoneNumberId: string;
  accessToken: string;
  graphVersion?: string;
}): Promise<WabaBusinessProfile | null> {
  const gv = getGraphVersion(params.graphVersion);
  const url = `https://graph.facebook.com/${gv}/${params.phoneNumberId}/whatsapp_business_profile?fields=${BUSINESS_PROFILE_FIELDS.join(",")}`;
  try {
    const resp: any = await graphFetch<any>(url, {
      headers: { Authorization: `Bearer ${params.accessToken}` },
    });
    const data = Array.isArray(resp?.data) ? resp.data[0] : resp;
    return (data || null) as WabaBusinessProfile | null;
  } catch (e: any) {
    if (e instanceof MetaGraphError && e.status === 404) return null;
    throw e;
  }
}

export async function updateBusinessProfile(params: {
  phoneNumberId: string;
  accessToken: string;
  profile: Partial<WabaBusinessProfile> & { profile_picture_handle?: string };
  graphVersion?: string;
}): Promise<{ success: boolean }> {
  const gv = getGraphVersion(params.graphVersion);
  const url = `https://graph.facebook.com/${gv}/${params.phoneNumberId}/whatsapp_business_profile`;
  const body = JSON.stringify({ messaging_product: "whatsapp", ...params.profile });
  const resp: any = await graphFetch<any>(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.accessToken}`,
    },
    body,
  });
  return { success: !!resp?.success };
}

export type CreateTemplatePayload = {
  name: string;
  language: string;
  category: string;
  components: any[];
};

export async function createTemplate(params: {
  wabaId: string;
  accessToken: string;
  payload: CreateTemplatePayload;
  graphVersion?: string;
}): Promise<{ id?: string; status?: string; category?: string }> {
  const gv = getGraphVersion(params.graphVersion);
  const url = `https://graph.facebook.com/${gv}/${params.wabaId}/message_templates`;
  return graphFetch<{ id?: string; status?: string; category?: string }>(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: JSON.stringify(params.payload),
  });
}

/**
 * Walk the Facebook user's businesses (`/me/businesses`) and collect every
 * accessible WABA — both `owned_whatsapp_business_accounts` and
 * `client_whatsapp_business_accounts`. This is what ManyChat-style platforms
 * use after Facebook login to import *every* WABA the user can administer.
 */
export type AccessibleWaba = {
  id: string;
  name?: string;
  currency?: string;
  timezone_id?: string;
  message_template_namespace?: string;
  account_review_status?: string;
  on_behalf_of_business_info?: { id?: string; name?: string };
  businessId?: string;
  businessName?: string;
};

export async function listAllAccessibleWabas(params: {
  accessToken: string;
  graphVersion?: string;
}): Promise<AccessibleWaba[]> {
  const gv = getGraphVersion(params.graphVersion);
  const fields = [
    "id",
    "name",
    "owned_whatsapp_business_accounts{id,name,currency,timezone_id,message_template_namespace,account_review_status,on_behalf_of_business_info}",
    "client_whatsapp_business_accounts{id,name,currency,timezone_id,message_template_namespace,account_review_status,on_behalf_of_business_info}",
  ].join(",");
  const url = `https://graph.facebook.com/${gv}/me/businesses?fields=${encodeURIComponent(fields)}&limit=100`;

  const businesses = await fetchPaginated<any>({ initialUrl: url, accessToken: params.accessToken });
  const wabas: AccessibleWaba[] = [];
  const seen = new Set<string>();
  for (const biz of businesses) {
    const businessId = biz?.id as string | undefined;
    const businessName = biz?.name as string | undefined;
    const groups = [biz?.owned_whatsapp_business_accounts?.data, biz?.client_whatsapp_business_accounts?.data];
    for (const arr of groups) {
      if (!Array.isArray(arr)) continue;
      for (const w of arr) {
        if (!w?.id || seen.has(w.id)) continue;
        seen.add(w.id);
        wabas.push({
          id: w.id,
          name: w.name,
          currency: w.currency,
          timezone_id: w.timezone_id,
          message_template_namespace: w.message_template_namespace,
          account_review_status: w.account_review_status,
          on_behalf_of_business_info: w.on_behalf_of_business_info,
          businessId,
          businessName,
        });
      }
    }
  }
  // Also try /me/assigned_whatsapp_business_accounts for system-user-style grants.
  try {
    const assignedUrl = `https://graph.facebook.com/${gv}/me/assigned_whatsapp_business_accounts?fields=id,name,currency,timezone_id,message_template_namespace,account_review_status,on_behalf_of_business_info&limit=100`;
    const assigned = await fetchPaginated<any>({ initialUrl: assignedUrl, accessToken: params.accessToken });
    for (const w of assigned) {
      if (!w?.id || seen.has(w.id)) continue;
      seen.add(w.id);
      wabas.push({
        id: w.id,
        name: w.name,
        currency: w.currency,
        timezone_id: w.timezone_id,
        message_template_namespace: w.message_template_namespace,
        account_review_status: w.account_review_status,
        on_behalf_of_business_info: w.on_behalf_of_business_info,
      });
    }
  } catch (e: any) {
    console.warn("[MetaGraph] assigned_whatsapp_business_accounts failed:", e?.message || e);
  }
  return wabas;
}

export async function subscribeWabaWebhook(params: {
  wabaId: string;
  accessToken: string;
  graphVersion?: string;
}): Promise<{ success: boolean }> {
  const gv = getGraphVersion(params.graphVersion);
  const url = `https://graph.facebook.com/${gv}/${params.wabaId}/subscribed_apps`;
  try {
    const resp: any = await graphFetch<any>(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${params.accessToken}` },
    });
    return { success: !!resp?.success };
  } catch (e: any) {
    console.warn("[MetaGraph] subscribed_apps failed:", e?.message || e);
    return { success: false };
  }
}
