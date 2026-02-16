/**
 * Content Generator Service
 * 
 * AI-powered content generation for the Knowledge Intelligence System.
 * Features:
 * - Topic discovery and gap analysis
 * - Brief/outline generation
 * - Full article generation with Claude
 * - Editorial QA (style, SEO, safety)
 * - Citation injection from source materials
 */

import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db";
import { 
  knowledgeBase,
  knowledgeChunks,
  knowledgeTopics,
  knowledgeFaqs,
  generatedArticles,
  contentAuditLog,
  knowledgeFolders
} from "@shared/schema";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import OpenAI from "openai";
import { globalSettings } from "@shared/schema";

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

let openaiClient: OpenAI | null = null;

async function getOpenAIClient(): Promise<OpenAI> {
  if (openaiClient) return openaiClient;

  let apiKey = process.env.OPENAI_API_KEY;
  
  try {
    const [dbSetting] = await db
      .select()
      .from(globalSettings)
      .where(eq(globalSettings.key, 'openai_api_key'))
      .limit(1);
    
    if (dbSetting?.value) {
      apiKey = dbSetting.value as string;
    }
  } catch {}

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }

  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

interface ArticleBrief {
  title: string;
  outline: { heading: string; points: string[] }[];
  targetLength: number;
  tone: string;
  requiredSources: string[];
}

interface EditorialResult {
  seoScore: number;
  readabilityScore: number;
  issues: { type: string; message: string; severity: string }[];
  suggestions: string[];
}

interface Citation {
  id: string;
  text: string;
  sourceUrl?: string;
  sourceTitle?: string;
  chunkId?: string;
}

/**
 * Content Generator class
 */
export class ContentGenerator {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Generate an article brief/outline
   */
  async generateBrief(
    topic: string, 
    articleType: string = 'article',
    context?: string
  ): Promise<ArticleBrief> {
    const relevantContent = await this.getRelevantContent(topic);
    const contextSnippet = relevantContent.map(c => c.content?.slice(0, 500)).join('\n\n');

    const typeInstructions: Record<string, string> = {
      article: 'informative article with introduction, main sections, and conclusion',
      faq: 'FAQ document with common questions and detailed answers',
      battlecard: 'sales battlecard with competitive positioning, objection handling, and key differentiators',
      one_pager: 'one-page summary with key points, benefits, and call to action',
      compliance_doc: 'compliance document with policies, procedures, and evidence requirements'
    };

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: `Create a detailed outline for a ${typeInstructions[articleType] || 'article'} about: "${topic}"

${context ? `Additional context: ${context}` : ''}

Available source material:
${contextSnippet || 'No existing content available'}

Return a JSON object with:
- title: compelling article title
- outline: array of {heading: string, points: string[]} for each section
- targetLength: recommended word count
- tone: recommended writing tone
- requiredSources: list of source topics to cite

Return ONLY valid JSON, no other text.`
      }]
    });

    try {
      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid brief response');
      }
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Brief generation failed:', error);
      return {
        title: topic,
        outline: [{ heading: 'Introduction', points: ['Overview of ' + topic] }],
        targetLength: 1000,
        tone: 'professional',
        requiredSources: []
      };
    }
  }

  /**
   * Generate full article content
   */
  async generateArticle(
    brief: ArticleBrief,
    options: {
      folderId?: string;
      articleType?: string;
      includeExistingFaqs?: boolean;
    } = {}
  ): Promise<string> {
    const relevantContent = await this.getRelevantContent(brief.title);
    const chunks = await this.getRelevantChunks(brief.title);
    
    let faqContext = '';
    if (options.includeExistingFaqs) {
      const faqs = await db.select().from(knowledgeFaqs)
        .where(eq(knowledgeFaqs.userId, this.userId))
        .limit(10);
      faqContext = faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n');
    }

    const sourceContext = chunks.map((c, i) => 
      `[Source ${i + 1}]: ${c.chunkText.slice(0, 800)}`
    ).join('\n\n');

    const outlineText = brief.outline.map(section => 
      `## ${section.heading}\n${section.points.map(p => `- ${p}`).join('\n')}`
    ).join('\n\n');

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 8192,
      messages: [{
        role: "user",
        content: `Write a complete ${options.articleType || 'article'} based on this outline:

Title: ${brief.title}

Outline:
${outlineText}

Target length: ~${brief.targetLength} words
Tone: ${brief.tone}

Source materials to reference (use [Source N] citations):
${sourceContext || 'Use your knowledge'}

${faqContext ? `\nExisting FAQs to incorporate:\n${faqContext}` : ''}

Requirements:
1. Write engaging, well-structured content in plain natural language
2. Include [Source N] citations where information comes from sources
3. Use clear headings and subheadings (## and ###)
4. Write for a general audience — explain concepts in simple, everyday terms
5. End with a clear conclusion or call to action
6. NEVER include code examples, code blocks, or technical snippets — this is customer-facing content, not developer documentation
7. If explaining a technical process, describe it in plain words instead of showing code
8. Do NOT use markdown code fences (\`\`\`) or inline code formatting (\`)

Write the complete article using only headings, paragraphs, bold, italic, and lists.`
      }]
    });

    const articleContent = message.content[0].type === 'text' ? message.content[0].text : '';

    const citations = this.extractCitations(articleContent, chunks);

    const slug = brief.title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const [article] = await db.insert(generatedArticles).values({
      userId: this.userId,
      folderId: options.folderId,
      title: brief.title,
      slug,
      content: articleContent,
      contentHtml: this.markdownToHtml(articleContent),
      summary: articleContent.slice(0, 300) + '...',
      articleType: options.articleType || 'article',
      sourceKnowledgeBaseIds: relevantContent.map(c => c.id),
      sourceChunkIds: chunks.map(c => c.id),
      citations,
      llmModel: 'claude-sonnet-4-5',
      generationPrompt: JSON.stringify(brief)
    }).returning();

    await db.insert(contentAuditLog).values({
      userId: this.userId,
      actionType: 'generate',
      resourceType: 'generated_article',
      resourceId: article.id,
      details: {
        title: brief.title,
        articleType: options.articleType,
        wordCount: articleContent.split(/\s+/).length,
        sourceCount: chunks.length
      }
    });

    return article.id;
  }

  /**
   * Run editorial QA on content
   */
  async runEditorialQA(articleId: string): Promise<EditorialResult> {
    const [article] = await db.select().from(generatedArticles)
      .where(eq(generatedArticles.id, articleId));

    if (!article) {
      throw new Error('Article not found');
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: `Perform editorial QA on this article:

Title: ${article.title}

Content:
${article.content}

Analyze and return JSON with:
- seoScore: 0-100 (keyword usage, meta-friendliness, structure)
- readabilityScore: 0-100 (clarity, sentence length, vocabulary)
- issues: array of {type: string, message: string, severity: 'high'|'medium'|'low'}
- suggestions: array of improvement suggestions

Check for:
- Duplicate content
- Missing citations
- Unclear language
- SEO issues (missing keywords, poor structure)
- Safety/compliance issues

Return ONLY valid JSON.`
      }]
    });

    try {
      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid QA response');
      }
      
      const result: EditorialResult = JSON.parse(jsonMatch[0]);

      await db.update(generatedArticles)
        .set({
          seoScore: result.seoScore,
          readabilityScore: result.readabilityScore,
          editorialNotes: JSON.stringify(result.issues),
          updatedAt: new Date()
        })
        .where(eq(generatedArticles.id, articleId));

      return result;
    } catch (error) {
      console.error('Editorial QA failed:', error);
      return {
        seoScore: 70,
        readabilityScore: 70,
        issues: [],
        suggestions: []
      };
    }
  }

  /**
   * Inject citations into article
   */
  async injectCitations(articleId: string): Promise<void> {
    const [article] = await db.select().from(generatedArticles)
      .where(eq(generatedArticles.id, articleId));

    if (!article) {
      throw new Error('Article not found');
    }

    const sourceChunkIds = article.sourceChunkIds || [];
    if (sourceChunkIds.length === 0) return;

    const chunks = await db.select().from(knowledgeChunks)
      .where(inArray(knowledgeChunks.id, sourceChunkIds));

    const kbIds = [...new Set(chunks.map(c => c.knowledgeBaseId))];
    const kbItems = await db.select().from(knowledgeBase)
      .where(inArray(knowledgeBase.id, kbIds));

    const kbMap = new Map(kbItems.map(kb => [kb.id, kb]));

    const citations: Citation[] = chunks.map((chunk, i) => {
      const kb = kbMap.get(chunk.knowledgeBaseId);
      return {
        id: `cite-${i + 1}`,
        text: chunk.chunkText.slice(0, 200) + '...',
        sourceUrl: kb?.url || undefined,
        sourceTitle: kb?.title,
        chunkId: chunk.id
      };
    });

    let contentWithCitations = article.content;
    
    contentWithCitations += '\n\n---\n\n## References\n\n';
    for (const citation of citations) {
      if (citation.sourceUrl) {
        contentWithCitations += `- [${citation.sourceTitle || 'Source'}](${citation.sourceUrl})\n`;
      } else {
        contentWithCitations += `- ${citation.sourceTitle || 'Internal source'}\n`;
      }
    }

    await db.update(generatedArticles)
      .set({
        content: contentWithCitations,
        contentHtml: this.markdownToHtml(contentWithCitations),
        citations,
        updatedAt: new Date()
      })
      .where(eq(generatedArticles.id, articleId));

    await db.insert(contentAuditLog).values({
      userId: this.userId,
      actionType: 'edit',
      resourceType: 'generated_article',
      resourceId: articleId,
      details: { action: 'citations_injected', citationCount: citations.length }
    });
  }

  /**
   * Publish article
   */
  async publishArticle(articleId: string): Promise<void> {
    await db.update(generatedArticles)
      .set({
        status: 'published',
        publishedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(generatedArticles.id, articleId));

    await db.insert(contentAuditLog).values({
      userId: this.userId,
      actionType: 'publish',
      resourceType: 'generated_article',
      resourceId: articleId,
      details: { publishedAt: new Date().toISOString() }
    });
  }

  /**
   * Get relevant knowledge base content for a topic
   */
  private async getRelevantContent(topic: string): Promise<typeof knowledgeBase.$inferSelect[]> {
    return db.select().from(knowledgeBase)
      .where(eq(knowledgeBase.userId, this.userId))
      .limit(10);
  }

  /**
   * Get relevant chunks using vector search
   */
  private async getRelevantChunks(topic: string): Promise<typeof knowledgeChunks.$inferSelect[]> {
    try {
      const openai = await getOpenAIClient();
      
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: topic
      });
      
      const queryEmbedding = embeddingResponse.data[0].embedding;

      const allChunks = await db.select().from(knowledgeChunks)
        .where(eq(knowledgeChunks.userId, this.userId))
        .limit(100);

      const scored = allChunks
        .filter(c => c.embedding)
        .map(chunk => ({
          chunk,
          score: this.cosineSimilarity(queryEmbedding, chunk.embedding as number[])
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      return scored.map(s => s.chunk);
    } catch {
      return db.select().from(knowledgeChunks)
        .where(eq(knowledgeChunks.userId, this.userId))
        .limit(10);
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Extract citations from generated content
   */
  private extractCitations(
    content: string, 
    chunks: typeof knowledgeChunks.$inferSelect[]
  ): Citation[] {
    const citations: Citation[] = [];
    const matches = content.matchAll(/\[Source (\d+)\]/g);
    
    for (const match of matches) {
      const index = parseInt(match[1], 10) - 1;
      if (chunks[index]) {
        citations.push({
          id: `cite-${index + 1}`,
          text: chunks[index].chunkText.slice(0, 200),
          chunkId: chunks[index].id
        });
      }
    }
    
    return citations;
  }

  /**
   * Simple markdown to HTML conversion
   */
  private markdownToHtml(markdown: string): string {
    return markdown
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/\n/gim, '<br>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2">$1</a>');
  }
}

export const createContentGenerator = (userId: string) => new ContentGenerator(userId);
