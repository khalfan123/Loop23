import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
} from "@aws-sdk/client-bedrock-runtime";

// Use a global cross-region inference profile so this works in any AWS region
// where Bedrock + Claude is available (incl. me-central-1 which doesn't host
// the on-demand model directly).
const DEFAULT_MODEL =
  process.env.BEDROCK_URL_EXTRACTOR_MODEL_ID ||
  process.env.BEDROCK_CLAUDE_MODEL_ID ||
  "global.anthropic.claude-sonnet-4-5-20250929-v1:0";

const MAX_INPUT_CHARS = 180_000;

export function isBedrockConfigured(): boolean {
  return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}

function getClient(): BedrockRuntimeClient {
  return new BedrockRuntimeClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

function stripScriptsAndStyles(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--([\s\S]*?)-->/g, " ");
}

/**
 * Use Claude on Bedrock to turn raw page HTML/text into clean, structured Markdown
 * suitable for a knowledge-base entry. Returns null on any failure so the caller
 * can fall back to the existing behavior.
 */
export async function extractUrlContentWithBedrock(
  rawContent: string,
  url: string,
  contentType: string
): Promise<string | null> {
  if (!isBedrockConfigured()) {
    console.warn("[Bedrock URL Extractor] AWS credentials not configured; skipping");
    return null;
  }
  if (!rawContent || !rawContent.trim()) {
    return null;
  }

  const isHtml = contentType.includes("text/html") || /<html|<body|<head/i.test(rawContent);
  const cleaned = isHtml ? stripScriptsAndStyles(rawContent) : rawContent;
  const truncated = cleaned.length > MAX_INPUT_CHARS ? cleaned.slice(0, MAX_INPUT_CHARS) : cleaned;

  const prompt = [
    `You are extracting the substantive content of a web page so it can be stored in a knowledge base.`,
    ``,
    `Source URL: ${url}`,
    `Content type: ${contentType || "unknown"}`,
    ``,
    `Below is the raw page content (HTML may include navigation, footers, scripts, ads — ignore those).`,
    `Produce a clean, well-structured Markdown document that captures every piece of information a reader would care about, including:`,
    `- Page title (as an H1)`,
    `- Section headings`,
    `- Body paragraphs`,
    `- Bullet/numbered lists`,
    `- Tables (Markdown tables)`,
    `- Pricing, plans, contact info, addresses, FAQs if present`,
    `- Important inline links (as Markdown links, only if they add information)`,
    ``,
    `Rules:`,
    `1. Output ONLY the cleaned Markdown — no commentary, no preamble, no code fences around the whole document.`,
    `2. Do not invent content that is not present.`,
    `3. Strip navigation menus, cookie banners, footers, ads, social widgets, sidebars, and boilerplate.`,
    `4. Preserve original wording; do not summarize unless content is clearly redundant.`,
    `5. If the page has multiple distinct sections, keep them as separate H2 sections.`,
    ``,
    `--- BEGIN PAGE CONTENT ---`,
    truncated,
    `--- END PAGE CONTENT ---`,
  ].join("\n");

  const messages: Message[] = [{ role: "user", content: [{ text: prompt }] }];

  try {
    const client = getClient();
    const response = await client.send(
      new ConverseCommand({
        modelId: DEFAULT_MODEL,
        messages,
        inferenceConfig: { maxTokens: 8000, temperature: 0.2 },
      })
    );

    const textPart = response.output?.message?.content?.find((c: any) => c.text)?.text;
    if (!textPart || textPart.trim().length < 50) {
      console.warn(`[Bedrock URL Extractor] Output too short for ${url}`);
      return null;
    }
    return textPart.trim();
  } catch (err: any) {
    console.error(`[Bedrock URL Extractor] Failed for ${url}:`, err?.message || err);
    return null;
  }
}
