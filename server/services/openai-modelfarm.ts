import OpenAI from "openai";
import { db } from "../db";
import { globalSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

const clientCache = new Map<string, OpenAI>();
let lastResolvedKey: string | null = null;
let cachedApiKey: string | null = null;
let cachedKeyTimestamp = 0;
const KEY_CACHE_TTL_MS = 30_000;

export async function resolveOpenAIApiKey(): Promise<string> {
  const now = Date.now();
  if (cachedApiKey && (now - cachedKeyTimestamp) < KEY_CACHE_TTL_MS) {
    return cachedApiKey;
  }

  let apiKey: string | undefined;

  try {
    const [dbSetting] = await db
      .select()
      .from(globalSettings)
      .where(eq(globalSettings.key, "openai_api_key"))
      .limit(1);

    if (dbSetting?.value) {
      const raw = dbSetting.value as string;
      apiKey = raw.replace(/^"+|"+$/g, '');
    }
  } catch (dbErr) {
    console.debug("[OpenAI] Could not read API key from database:", dbErr instanceof Error ? dbErr.message : dbErr);
  }

  if (!apiKey && process.env.OPENAI_API_KEY) {
    apiKey = process.env.OPENAI_API_KEY;
  }

  if (!apiKey && process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  }

  if (!apiKey) {
    throw new Error(
      "No OpenAI API key found. Configure it in Admin Settings (Credentials → OpenAI), " +
      "or set the OPENAI_API_KEY environment variable."
    );
  }

  cachedApiKey = apiKey;
  cachedKeyTimestamp = now;
  return apiKey;
}

export async function getOpenAIClient(_userId?: string): Promise<OpenAI> {
  const apiKey = await resolveOpenAIApiKey();
  const cacheKey = _userId || "__global__";

  if (lastResolvedKey !== apiKey) {
    clientCache.clear();
    lastResolvedKey = apiKey;
  }

  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey)!;
  }

  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
  clientCache.set(cacheKey, client);
  return client;
}
