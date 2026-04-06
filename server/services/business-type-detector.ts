/**
 * Business Type Detector
 *
 * Uses AWS Bedrock Claude (or OpenAI as fallback) to analyze scraped website
 * content and detect the type of business for the knowledge base enrichment pipeline.
 */

import { db } from "../db";
import { globalSettings } from "@shared/schema";
import { eq } from "drizzle-orm";
import { awsBedrockService } from "./aws-bedrock";

export interface BusinessTypeResult {
  type: string;
  industry: string;
  description: string;
}

async function getOpenAIApiKey(): Promise<string | undefined> {
  try {
    const [dbSetting] = await db
      .select()
      .from(globalSettings)
      .where(eq(globalSettings.key, "openai_api_key"))
      .limit(1);
    if (dbSetting?.value) return dbSetting.value as string;
  } catch {}
  return process.env.OPENAI_API_KEY;
}

function buildPrompt(content: string, url: string): string {
  return `Analyze the following website content and URL to determine the type of business.

URL: ${url}

Website Content (first 3000 characters):
${content.slice(0, 3000)}

Identify:
1. Business type — be specific (examples: "eSIM / Travel Technology", "E-commerce / Online Retail", "Healthcare Clinic", "Financial Services / Banking", "Telecom Provider", "SaaS / Software Platform", "Real Estate Agency", "Insurance Provider", "Education / EdTech", "Hospitality / Hotel", "Logistics / Shipping", "Food & Beverage", "Legal Services", "Automotive", "Government / Public Services")
2. Industry vertical (one or two words)
3. A one-sentence description of what this business does for its customers

Return ONLY valid JSON with no markdown or extra text:
{"type": "...", "industry": "...", "description": "..."}`;
}

function parseResult(text: string): BusinessTypeResult {
  try {
    const match = text.match(/\{[\s\S]*?\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        type: String(parsed.type || "General Business").slice(0, 80),
        industry: String(parsed.industry || "General").slice(0, 50),
        description: String(parsed.description || "").slice(0, 300),
      };
    }
  } catch {}
  return { type: "General Business", industry: "General", description: "" };
}

async function detectWithBedrock(content: string, url: string): Promise<BusinessTypeResult> {
  const response = await awsBedrockService.invoke({
    model: "claude-3-5-haiku",
    messages: [{ role: "user", content: buildPrompt(content, url) }],
    systemPrompt:
      "You are a business analyst. Analyze website content and return ONLY valid JSON. No markdown, no code blocks.",
    maxTokens: 512,
    temperature: 0.2,
  });
  return parseResult(response.content);
}

async function detectWithOpenAI(content: string, url: string): Promise<BusinessTypeResult> {
  const apiKey = await getOpenAIApiKey();
  if (!apiKey) {
    return { type: "General Business", industry: "General", description: "" };
  }

  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({ apiKey });

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    max_tokens: 512,
    messages: [
      {
        role: "system",
        content:
          "You are a business analyst. Analyze website content and return ONLY valid JSON. No markdown, no code blocks.",
      },
      { role: "user", content: buildPrompt(content, url) },
    ],
  });

  return parseResult(response.choices[0]?.message?.content || "{}");
}

export async function detectBusinessType(
  content: string,
  url: string
): Promise<BusinessTypeResult> {
  if (awsBedrockService.isConfigured()) {
    try {
      const result = await detectWithBedrock(content, url);
      console.log(`[BusinessTypeDetector] Detected via Bedrock: ${result.type} (${result.industry})`);
      return result;
    } catch (err: any) {
      console.warn("[BusinessTypeDetector] Bedrock failed, falling back to OpenAI:", err.message);
    }
  }

  try {
    const result = await detectWithOpenAI(content, url);
    console.log(`[BusinessTypeDetector] Detected via OpenAI: ${result.type} (${result.industry})`);
    return result;
  } catch (err: any) {
    console.error("[BusinessTypeDetector] OpenAI fallback failed:", err.message);
    return { type: "General Business", industry: "General", description: "" };
  }
}
