/**
 * Bedrock Claude Article Generator
 *
 * Uses AWS Bedrock's Claude model to automatically generate 10-20 articles
 * from crawled URL content. Articles are organized by topic folds
 * (e.g., Billing & Payments, Account Management) discovered in the content.
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
} from "@aws-sdk/client-bedrock-runtime";
import { db } from "../db";
import {
  crawlPages,
  knowledgeChunks,
  generatedArticles,
  contentAuditLog,
  knowledgeFolders,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { BEDROCK_MODELS, type BedrockModelAlias } from "./aws-bedrock";

// Default to the central alias resolver so this works in any AWS region
// (incl. me-central-1). The `claude-sonnet-4-6` alias is mapped to a global
// cross-region inference profile in `aws-bedrock.ts`.
const DEFAULT_MODEL_ALIAS: BedrockModelAlias = "claude-sonnet-4-6";

function resolveBedrockModelId(input?: string): string {
  const candidate = input || process.env.BEDROCK_CLAUDE_MODEL_ID || DEFAULT_MODEL_ALIAS;
  if (candidate in BEDROCK_MODELS) {
    return BEDROCK_MODELS[candidate as BedrockModelAlias];
  }
  return candidate;
}

const DEFAULT_BEDROCK_CLAUDE_MODEL = resolveBedrockModelId();

export interface ArticleFold {
  name: string;
  description: string;
  topics: string[];
}

export interface BedrockArticle {
  title: string;
  fold: string;
  content: string;
  summary: string;
  articleType: string;
}

export interface BedrockGenerationResult {
  foldsDiscovered: number;
  articlesGenerated: number;
  articleIds: string[];
  folds: ArticleFold[];
}

function isBedrockConfigured(): boolean {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
  );
}

function getBedrockClient(): BedrockRuntimeClient {
  return new BedrockRuntimeClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

/**
 * Invoke Claude on Bedrock with a simple user message
 */
async function invokeBedrockClaude(
  client: BedrockRuntimeClient,
  userMessage: string,
  maxTokens: number = 4096,
  modelId: string = DEFAULT_BEDROCK_CLAUDE_MODEL
): Promise<string> {
  const messages: Message[] = [{ role: "user", content: [{ text: userMessage }] }];

  const command = new ConverseCommand({
    modelId,
    messages,
    inferenceConfig: { maxTokens, temperature: 0.7 },
  });

  const response = await client.send(command);
  const block = response.output?.message?.content?.[0];
  if (block && "text" in block) return block.text;
  return "";
}

/**
 * Extract JSON from a raw Claude text response
 */
function extractJson<T>(text: string, fallback: T): T {
  try {
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    const objectMatch = text.match(/\{[\s\S]*\}/);
    const raw = arrayMatch || objectMatch;
    if (raw) return JSON.parse(raw[0]) as T;
  } catch {}
  return fallback;
}

/**
 * BedrockClaudeGenerator
 *
 * Main class for crawl-URL → fold discovery → article generation pipeline
 * using AWS Bedrock Claude.
 */
export class BedrockClaudeGenerator {
  private userId: string;
  private client: BedrockRuntimeClient;

  constructor(userId: string) {
    this.userId = userId;
    this.client = getBedrockClient();
  }

  /**
   * Step 1: Discover topic folds from crawled content
   * Folds are natural sections/categories in the website (e.g., Billing & Payments,
   * Account Management, Getting Started, Integrations, etc.)
   */
  async discoverFolds(crawlJobId: string): Promise<ArticleFold[]> {
    const pages = await db
      .select()
      .from(crawlPages)
      .where(
        and(eq(crawlPages.crawlJobId, crawlJobId), eq(crawlPages.status, "success"))
      )
      .limit(30);

    if (pages.length === 0) {
      // Fallback: use knowledge chunks for existing content
      const chunks = await db
        .select()
        .from(knowledgeChunks)
        .where(eq(knowledgeChunks.userId, this.userId))
        .orderBy(desc(knowledgeChunks.createdAt))
        .limit(40);

      if (chunks.length === 0) return this.getDefaultFolds();

      const contentSample = chunks
        .map((c) => c.chunkText.slice(0, 1500))
        .join("\n\n---\n\n");
      return this.discoverFoldsFromContent(contentSample);
    }

    const contentSample = pages
      .map((p) => `[URL: ${p.url}]\n${(p.cleanText || p.title || "").slice(0, 2000)}`)
      .join("\n\n---\n\n");

    return this.discoverFoldsFromContent(contentSample);
  }

  private async discoverFoldsFromContent(contentSample: string): Promise<ArticleFold[]> {
    console.log("[BedrockClaudeGenerator] Discovering topic folds from content...");

    const prompt = `You are an expert content strategist. Analyze the following website content and identify the main topic folds (sections/categories) that a help center or knowledge base should cover.

Look for patterns like:
- Navigation menu sections
- Product areas (Billing & Payments, Account Management, Getting Started, Integrations, etc.)
- User workflow stages (Setup, Configuration, Troubleshooting, etc.)
- Feature categories

For each fold, provide:
- name: Short category name (e.g., "Billing & Payments", "Account Management")
- description: One sentence about what this fold covers
- topics: 5-10 specific article topics that belong in this fold

Aim to discover 5-10 distinct folds that cover the full scope of the website.

Website Content:
${contentSample}

Return ONLY a valid JSON array:
[
  {
    "name": "Billing & Payments",
    "description": "Everything related to invoices, subscriptions, and payment methods",
    "topics": [
      "How to update your payment method",
      "Understanding your invoice",
      "Billing cycles explained",
      "Subscription plans and pricing",
      "How to cancel your subscription"
    ]
  }
]`;

    try {
      const response = await invokeBedrockClaude(this.client, prompt, 4096);
      const folds = extractJson<ArticleFold[]>(response, []);
      if (folds.length > 0) {
        console.log(`[BedrockClaudeGenerator] Discovered ${folds.length} folds`);
        return folds;
      }
    } catch (error) {
      console.error("[BedrockClaudeGenerator] Fold discovery failed:", error);
    }

    return this.getDefaultFolds();
  }

  private getDefaultFolds(): ArticleFold[] {
    return [
      {
        name: "Getting Started",
        description: "Onboarding guides and initial setup instructions",
        topics: [
          "How to create your account",
          "Setting up your first project",
          "Quick start guide",
          "Understanding the dashboard",
          "Initial configuration steps",
        ],
      },
      {
        name: "Billing & Payments",
        description: "Subscription management, invoices, and payment methods",
        topics: [
          "How to update your payment method",
          "Understanding your invoice",
          "Subscription plans explained",
          "How to upgrade or downgrade your plan",
          "Billing cycle and renewal dates",
        ],
      },
      {
        name: "Account Management",
        description: "Profile settings, team management, and security",
        topics: [
          "How to update your profile",
          "Managing team members and permissions",
          "Changing your password",
          "Two-factor authentication setup",
          "Account security best practices",
        ],
      },
      {
        name: "Integrations",
        description: "Connecting with third-party tools and services",
        topics: [
          "Available integrations overview",
          "How to connect your CRM",
          "API authentication guide",
          "Webhook setup and configuration",
          "Troubleshooting integration issues",
        ],
      },
      {
        name: "Troubleshooting",
        description: "Common issues and how to resolve them",
        topics: [
          "Common error messages and fixes",
          "How to contact support",
          "Reporting a bug",
          "Performance optimization tips",
          "What to do when a feature is not working",
        ],
      },
    ];
  }

  /**
   * Step 2: Generate a full article for a given topic and fold
   * using AWS Bedrock Claude
   */
  async generateArticle(
    topic: string,
    fold: string,
    contentContext: string = ""
  ): Promise<{ title: string; content: string; summary: string; articleType: string }> {
    const articleType = this.determineArticleType(topic);

    const prompt = `You are a professional technical writer creating a knowledge base article.

Write a comprehensive, helpful article for:

**Category (Fold):** ${fold}
**Topic:** ${topic}
**Article Type:** ${articleType}

${contentContext ? `\nRelevant background context from our website:\n${contentContext}\n` : ""}

Requirements:
1. Write in clear, friendly, professional language suitable for customers
2. Use ## and ### for headings, bullet points for lists
3. Include practical step-by-step instructions where appropriate
4. Aim for 400-800 words
5. End with a "Need More Help?" section pointing users to support
6. Do NOT include code blocks or technical snippets
7. Write as if you are the company's support team helping a customer

Start directly with the article content (no preamble). Use the topic as the H1 title.`;

    try {
      const content = await invokeBedrockClaude(this.client, prompt, 3000);
      const summary =
        content
          .replace(/^#+\s+.+\n/m, "")
          .replace(/[#*_]/g, "")
          .slice(0, 300)
          .trim() + "...";

      // Extract H1 title if present, fallback to topic name
      const titleMatch = content.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1].trim() : topic;

      return { title, content, summary, articleType };
    } catch (error) {
      console.error(`[BedrockClaudeGenerator] Article generation failed for "${topic}":`, error);
      return {
        title: topic,
        content: `## ${topic}\n\nThis article is currently being prepared. Please check back soon.`,
        summary: `Information about ${topic}.`,
        articleType,
      };
    }
  }

  private determineArticleType(topic: string): string {
    const lower = topic.toLowerCase();
    if (lower.startsWith("how to") || lower.startsWith("how do")) return "how-to";
    if (lower.includes("troubleshoot") || lower.includes("fix") || lower.includes("error"))
      return "troubleshooting";
    if (lower.startsWith("what is") || lower.startsWith("understanding") || lower.includes("overview"))
      return "guide";
    if (lower.includes("faq") || lower.includes("common question")) return "faq";
    return "article";
  }

  /**
   * Main entry point: run the full fold-discovery + article generation pipeline
   * Generates 10-20 articles covering all discovered folds
   */
  async runFoldArticleGeneration(
    crawlJobId: string,
    maxArticles: number = 15,
    onProgress?: (generated: number, total: number) => Promise<void>
  ): Promise<BedrockGenerationResult> {
    console.log(
      `[BedrockClaudeGenerator] Starting fold-based article generation (max: ${maxArticles})`
    );

    // 1. Discover folds
    const folds = await this.discoverFolds(crawlJobId);

    // 2. Build a flat list of (fold, topic) pairs, distributing evenly across folds
    const articlePlan: { fold: string; topic: string }[] = [];
    let foldIndex = 0;
    while (articlePlan.length < maxArticles) {
      let added = false;
      for (const fold of folds) {
        const topicIndex = Math.floor(articlePlan.filter((p) => p.fold === fold.name).length);
        if (topicIndex < fold.topics.length && articlePlan.length < maxArticles) {
          articlePlan.push({ fold: fold.name, topic: fold.topics[topicIndex] });
          added = true;
        }
      }
      if (!added) break; // All fold topics exhausted
      foldIndex++;
    }

    console.log(
      `[BedrockClaudeGenerator] Planned ${articlePlan.length} articles across ${folds.length} folds`
    );

    // 3. Get a snippet of crawled content for context
    const pages = await db
      .select({ cleanText: crawlPages.cleanText, url: crawlPages.url })
      .from(crawlPages)
      .where(and(eq(crawlPages.crawlJobId, crawlJobId), eq(crawlPages.status, "success")))
      .limit(5);

    const contentContext = pages
      .map((p) => (p.cleanText || "").slice(0, 800))
      .join("\n\n");

    // 4. Get or create folders for each fold
    const folderMap = await this.ensureFolders(folds);

    // 5. Generate each article
    const articleIds: string[] = [];
    let generated = 0;

    for (const plan of articlePlan) {
      try {
        const article = await this.generateArticle(plan.topic, plan.fold, contentContext);

        const slug = article.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 80);

        const folderId = folderMap.get(plan.fold);

        const [saved] = await db
          .insert(generatedArticles)
          .values({
            userId: this.userId,
            folderId: folderId || null,
            title: article.title,
            slug: `${slug}-${Date.now()}`,
            content: article.content,
            contentHtml: this.markdownToHtml(article.content),
            summary: article.summary,
            articleType: article.articleType,
            llmModel: DEFAULT_BEDROCK_CLAUDE_MODEL,
            generationPrompt: JSON.stringify({ fold: plan.fold, topic: plan.topic }),
            status: "published",
          })
          .returning();

        await db.insert(contentAuditLog).values({
          userId: this.userId,
          actionType: "generate",
          resourceType: "generated_article",
          resourceId: saved.id,
          details: {
            title: article.title,
            fold: plan.fold,
            articleType: article.articleType,
            generator: "aws-bedrock-claude",
            wordCount: article.content.split(/\s+/).length,
          },
        });

        articleIds.push(saved.id);
        generated++;

        if (onProgress) {
          await onProgress(generated, articlePlan.length);
        }

        console.log(
          `[BedrockClaudeGenerator] Generated [${generated}/${articlePlan.length}]: "${article.title}" (${plan.fold})`
        );

        // Politeness delay between Bedrock calls
        await new Promise((r) => setTimeout(r, 500));
      } catch (error) {
        console.error(
          `[BedrockClaudeGenerator] Failed to generate article for "${plan.topic}":`,
          error
        );
      }
    }

    console.log(
      `[BedrockClaudeGenerator] Completed: ${generated} articles generated across ${folds.length} folds`
    );

    return {
      foldsDiscovered: folds.length,
      articlesGenerated: generated,
      articleIds,
      folds,
    };
  }

  /**
   * Ensure knowledge folders exist for each discovered fold
   * Returns a map of fold name → folder ID
   */
  private async ensureFolders(folds: ArticleFold[]): Promise<Map<string, string>> {
    const folderMap = new Map<string, string>();

    // Load existing folders
    const existing = await db
      .select()
      .from(knowledgeFolders)
      .where(eq(knowledgeFolders.userId, this.userId));

    const existingByName = new Map(existing.map((f) => [f.name.toLowerCase(), f]));

    for (const fold of folds) {
      const key = fold.name.toLowerCase();
      if (existingByName.has(key)) {
        folderMap.set(fold.name, existingByName.get(key)!.id);
      } else {
        try {
          const [created] = await db
            .insert(knowledgeFolders)
            .values({
              userId: this.userId,
              name: fold.name,
              icon: this.getFoldIcon(fold.name),
              color: this.getFoldColor(fold.name),
              sortOrder: folds.indexOf(fold),
            })
            .returning();
          folderMap.set(fold.name, created.id);
          existingByName.set(key, created);
        } catch (err) {
          console.error(`[BedrockClaudeGenerator] Failed to create folder "${fold.name}":`, err);
        }
      }
    }

    return folderMap;
  }

  private getFoldIcon(foldName: string): string {
    const lower = foldName.toLowerCase();
    if (lower.includes("billing") || lower.includes("payment")) return "credit-card";
    if (lower.includes("account") || lower.includes("profile")) return "user";
    if (lower.includes("getting started") || lower.includes("onboard")) return "rocket";
    if (lower.includes("integration") || lower.includes("api")) return "plug";
    if (lower.includes("troubleshoot") || lower.includes("support")) return "life-buoy";
    if (lower.includes("security") || lower.includes("privacy")) return "shield";
    if (lower.includes("report") || lower.includes("analytics")) return "bar-chart";
    return "book-open";
  }

  private getFoldColor(foldName: string): string {
    const lower = foldName.toLowerCase();
    if (lower.includes("billing") || lower.includes("payment")) return "#10b981";
    if (lower.includes("account")) return "#6366f1";
    if (lower.includes("getting started")) return "#f59e0b";
    if (lower.includes("integration")) return "#3b82f6";
    if (lower.includes("troubleshoot") || lower.includes("support")) return "#ef4444";
    if (lower.includes("security")) return "#8b5cf6";
    return "#64748b";
  }

  /**
   * Generate multiple articles for a specific knowledge category from raw scraped content.
   * Used by the URL enrichment pipeline to populate call-center KB folders.
   *
   * @param category  - The KB folder name (e.g. "FAQs", "Billing & Payments")
   * @param targetCount - How many articles to generate
   * @param contentContext - Scraped website content (used as grounding context)
   * @param businessContext - Short description of the business type
   * @returns Array of generated article objects
   */
  async generateArticlesBatch(
    category: string,
    targetCount: number,
    contentContext: string,
    businessContext: string
  ): Promise<Array<{ title: string; content: string }>> {
    const contextSnippet = contentContext.slice(0, 4000);
    const prompt = `You are a professional knowledge base writer for ${businessContext}.

SOURCE CONTENT:
---
${contextSnippet}
---

Generate exactly ${targetCount} knowledge base articles for the "${category}" support category.

Requirements:
- Ground each article in the ACTUAL content above — use real names, prices, features, processes from the source
- Each article must be 300-500 words
- Write in a clear, professional customer-support style
- Each article must cover a DIFFERENT, specific topic relevant to "${category}"
- Include step-by-step instructions or FAQs where applicable
- Do NOT invent information not present in the source content

Return ONLY a valid JSON array (no markdown, no code blocks, no extra text):
[{"title": "Article Title Here", "content": "Full article content here..."}]`;

    const rawResponse = await invokeBedrockClaude(this.client, prompt, 8000);
    const articles = extractJson<Array<{ title: string; content: string }>>(rawResponse, []);
    return articles.filter((a) => a.title && a.content);
  }

  private markdownToHtml(markdown: string): string {
    return markdown
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/^## (.+)$/gm, "<h2>$1</h2>")
      .replace(/^# (.+)$/gm, "<h1>$1</h1>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/^- (.+)$/gm, "<li>$1</li>")
      .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
      .replace(/\n\n/g, "</p><p>")
      .replace(/^(?!<[hul])/gm, "<p>")
      .replace(/(?<![>])$/gm, "</p>")
      .replace(/<p><\/p>/g, "");
  }
}

/**
 * Factory function
 */
export function createBedrockClaudeGenerator(userId: string): BedrockClaudeGenerator | null {
  if (!isBedrockConfigured()) {
    console.log(
      "[BedrockClaudeGenerator] AWS credentials not configured — skipping Bedrock generation"
    );
    return null;
  }
  return new BedrockClaudeGenerator(userId);
}
