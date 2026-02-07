import OpenAI from "openai";
import { db } from "../db";
import { globalSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

const clientCache = new Map<string, OpenAI>();

async function resolveApiKey(): Promise<string> {
  let apiKey = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  try {
    const [dbSetting] = await db
      .select()
      .from(globalSettings)
      .where(eq(globalSettings.key, "openai_api_key"))
      .limit(1);

    if (dbSetting?.value) {
      apiKey = dbSetting.value as string;
    }
  } catch {}

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for ML analysis");
  }

  return apiKey;
}

export async function getOpenAIClient(_userId?: string): Promise<OpenAI> {
  const cacheKey = _userId || "__global__";

  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey)!;
  }

  const apiKey = await resolveApiKey();
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
  clientCache.set(cacheKey, client);
  return client;
}
