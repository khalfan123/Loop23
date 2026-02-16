/**
 * ============================================================
 * © 2025 Diploy — a brand of Bisht Technologies Private Limited
 * Original Author: BTPL Engineering Team
 * Website: https://diploy.in
 * Contact: cs@diploy.in
 *
 * Distributed under the Envato / CodeCanyon License Agreement.
 * Licensed to the purchaser for use as defined by the
 * Envato Market (CodeCanyon) Regular or Extended License.
 *
 * You are NOT permitted to redistribute, resell, sublicense,
 * or share this source code, in whole or in part.
 * Respect the author's rights and Envato licensing terms.
 * ============================================================
 */
/**
 * RAG Knowledge Service
 * 
 * Scalable knowledge base system using Retrieval-Augmented Generation (RAG).
 * Stores knowledge locally with embeddings instead of using ElevenLabs 20MB limit.
 * 
 * Features:
 * - Document chunking with configurable overlap
 * - OpenAI embeddings generation
 * - Vector similarity search (cosine similarity)
 * - Per-user storage limits (20MB default)
 * - Async processing queue for large documents
 * 
 * This is a SEPARATE system from the legacy ElevenLabs KB.
 * Set USE_RAG_KNOWLEDGE=true to enable this system.
 */

import OpenAI from "openai";
import { db } from "../db";
import { 
  knowledgeBase, 
  knowledgeChunks, 
  knowledgeFaqs,
  knowledgeProcessingQueue,
  userKnowledgeStorageLimits,
  globalSettings,
  type KnowledgeChunk,
  type KnowledgeBase
} from "@shared/schema";
import { eq, and, inArray, sql, or, ilike } from "drizzle-orm";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025
// Using text-embedding-3-small for cost-effective embeddings
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

// Chunking configuration
const CHUNK_SIZE = 500; // tokens (roughly 2000 chars)
const CHUNK_OVERLAP = 50; // tokens overlap between chunks
const MAX_CHUNK_CHARS = 2000; // approximate chars per chunk

// Default storage limit per user (20MB)
const DEFAULT_STORAGE_LIMIT_BYTES = 20 * 1024 * 1024;

// Minimum relevance thresholds for filtering low-quality results
const MIN_VECTOR_RELEVANCE = 0.65; // Minimum cosine similarity for vector search results
const MIN_FAQ_RELEVANCE = 0.50; // FAQs can have lower threshold (keyword-based)
const MIN_FALLBACK_RELEVANCE = 0.40; // Direct content fallback threshold

const HR_CAREER_INDICATORS = [
  'career progression', 'open positions', 'view open positions', 'join us',
  'mentorship programs', 'leadership training', 'work-life balance',
  'collaboration tools', 'cross-functional', 'conference and workshop',
  '1-on-1s with your manager', 'become part of the team', 'hiring',
  'employee benefits', 'perks and benefits', 'company culture',
  'growth opportunities', 'ready to join', 'we encourage boundaries',
  'taking time off', 'connect in person'
];

const PRODUCT_SERVICE_KEYWORDS = [
  'offer', 'product', 'service', 'plan', 'price', 'pricing', 'cost',
  'feature', 'esim', 'sim', 'data', 'coverage', 'network', 'roaming',
  'subscription', 'package', 'buy', 'purchase', 'available', 'provide',
  'sell', 'what do you', 'what does', 'tell me about', 'how much',
  'how does', 'how do i', 'can i', 'do you have', 'what is',
  'international', 'travel', 'country', 'countries', 'activate',
  'installation', 'compatible', 'device', 'phone', 'mobile'
];

function isProductServiceQuery(query: string): boolean {
  const q = query.toLowerCase();
  return PRODUCT_SERVICE_KEYWORDS.some(kw => q.includes(kw));
}

function isHRCareerContent(text: string): boolean {
  const t = text.toLowerCase();
  let matchCount = 0;
  for (const indicator of HR_CAREER_INDICATORS) {
    if (t.includes(indicator)) matchCount++;
  }
  return matchCount >= 2;
}

// Initialize OpenAI client
let openaiClient: OpenAI | null = null;
let lastApiKey: string | null = null;

async function getOpenAIApiKey(): Promise<string> {
  // First check database for configured key
  try {
    const [dbSetting] = await db
      .select()
      .from(globalSettings)
      .where(eq(globalSettings.key, 'openai_api_key'))
      .limit(1);
    
    if (dbSetting?.value) {
      return dbSetting.value as string;
    }
  } catch (e) {
    // Table might not exist yet, fall back to env var
  }
  
  // Fall back to environment variable
  if (process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY;
  }
  
  throw new Error("OPENAI_API_KEY is required for RAG knowledge system. Configure it in Admin Settings or as an environment variable.");
}

async function getOpenAIClient(): Promise<OpenAI> {
  const apiKey = await getOpenAIApiKey();
  
  // Recreate client if API key changed
  if (!openaiClient || lastApiKey !== apiKey) {
    openaiClient = new OpenAI({ apiKey });
    lastApiKey = apiKey;
  }
  
  return openaiClient;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have same length");
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Split text into chunks with overlap
 */
function chunkText(text: string, maxChars: number = MAX_CHUNK_CHARS, overlapChars: number = 200): string[] {
  const chunks: string[] = [];
  
  const cleanText = text.replace(/\r\n/g, '\n').trim();
  
  if (cleanText.length <= maxChars) {
    return [cleanText];
  }
  
  const sections = splitIntoSections(cleanText);
  
  let currentHeading = '';
  
  for (const section of sections) {
    if (section.heading) {
      currentHeading = section.heading;
    }
    
    const content = section.content.trim();
    if (!content) continue;
    
    const prefix = currentHeading ? `[${currentHeading}]\n` : '';
    const prefixedContent = prefix + content;
    
    if (prefixedContent.length <= maxChars) {
      chunks.push(prefixedContent);
    } else {
      const qaBlocks = splitQAPairs(content);
      if (qaBlocks.length > 1) {
        let currentBlock = prefix;
        for (const block of qaBlocks) {
          if ((currentBlock + block).length > maxChars && currentBlock.length > prefix.length) {
            chunks.push(currentBlock.trim());
            currentBlock = prefix + block;
          } else {
            currentBlock += block;
          }
        }
        if (currentBlock.length > prefix.length) {
          chunks.push(currentBlock.trim());
        }
      } else {
        let start = 0;
        while (start < content.length) {
          let end = start + maxChars - prefix.length;
          
          if (end < content.length) {
            const searchWindow = content.substring(Math.max(start, end - 300), end);
            const lastDoubleNewline = searchWindow.lastIndexOf('\n\n');
            const lastPeriodSpace = searchWindow.lastIndexOf('. ');
            const lastNewline = searchWindow.lastIndexOf('\n');
            
            let breakAt = -1;
            if (lastDoubleNewline !== -1) {
              breakAt = Math.max(start, end - 300) + lastDoubleNewline + 2;
            } else if (lastPeriodSpace !== -1) {
              breakAt = Math.max(start, end - 300) + lastPeriodSpace + 2;
            } else if (lastNewline !== -1) {
              breakAt = Math.max(start, end - 300) + lastNewline + 1;
            }
            
            if (breakAt > start + maxChars / 3) {
              end = breakAt;
            }
          } else {
            end = content.length;
          }
          
          const chunk = content.slice(start, end).trim();
          if (chunk.length > 0) {
            chunks.push(prefix + chunk);
          }
          
          start = end - (end < content.length ? overlapChars : 0);
          if (start >= content.length) break;
        }
      }
    }
  }
  
  return chunks;
}

function splitQAPairs(text: string): string[] {
  const blocks: string[] = [];
  const lines = text.split('\n');
  let currentBlock = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const isQStart = /^(Q:|Question:)/i.test(trimmed);
    
    if (isQStart && currentBlock.trim()) {
      blocks.push(currentBlock);
      currentBlock = line + '\n';
    } else {
      currentBlock += line + '\n';
    }
  }
  
  if (currentBlock.trim()) {
    blocks.push(currentBlock);
  }
  
  return blocks;
}

function splitIntoSections(text: string): Array<{ heading: string; content: string }> {
  const sections: Array<{ heading: string; content: string }> = [];
  const lines = text.split('\n');
  
  let currentHeading = '';
  let currentContent: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    const isHeading = 
      /^#{1,4}\s+/.test(trimmed) ||
      (/^[A-Z][A-Z\s]{3,}$/.test(trimmed) && trimmed.length < 80) ||
      (/^[A-Z][\w\s]+:$/.test(trimmed) && trimmed.length < 80);
    
    const isQAStart = /^(Q:|A:|Question:|Answer:)/i.test(trimmed);
    
    if ((isHeading || (isQAStart && currentContent.length > 0)) && currentContent.length > 0) {
      sections.push({
        heading: currentHeading,
        content: currentContent.join('\n'),
      });
      currentContent = [];
      if (isHeading) {
        currentHeading = trimmed.replace(/^#+\s*/, '').replace(/:$/, '');
      } else {
        currentHeading = '';
      }
    } else if (isHeading) {
      currentHeading = trimmed.replace(/^#+\s*/, '').replace(/:$/, '');
    }
    
    currentContent.push(line);
  }
  
  if (currentContent.length > 0) {
    sections.push({
      heading: currentHeading,
      content: currentContent.join('\n'),
    });
  }
  
  if (sections.length === 0) {
    sections.push({ heading: '', content: text });
  }
  
  return sections;
}

/**
 * Generate embedding for text using OpenAI
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const openai = await getOpenAIClient();
  
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  
  return response.data[0].embedding;
}

/**
 * Estimate token count (rough approximation)
 */
function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token for English
  return Math.ceil(text.length / 4);
}

async function expandQuery(query: string): Promise<string[]> {
  try {
    const openai = await getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a query expansion assistant. Given a user's casual/incomplete question, generate 2-3 focused search queries that would help find relevant information in a knowledge base about products and services.

Return ONLY the search queries, one per line. No numbering, no explanations. Focus on extracting the user's intent and adding relevant product/service terms.`
        },
        {
          role: "user",
          content: query
        }
      ],
      temperature: 0.3,
      max_tokens: 150,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return [query];

    const expandedQueries = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && line.length < 200);

    if (expandedQueries.length === 0) return [query];

    console.log(`[RAG] Expanded query "${query}" into ${expandedQueries.length} queries: ${expandedQueries.join(' | ')}`);
    return expandedQueries;
  } catch (error: any) {
    console.error(`[RAG] Query expansion failed, using original:`, error.message);
    return [query];
  }
}

function needsQueryExpansion(query: string): boolean {
  if (query.length > 80) return false;
  const words = query.split(/\s+/).filter(w => w.length > 1);
  if (words.length > 15) return false;
  const hasProductTerms = PRODUCT_SERVICE_KEYWORDS.some(kw => query.toLowerCase().includes(kw));
  const conversationalPatterns = [
    /^i('m| am| want| need| would)/i,
    /^(hey|hi|hello|can you|could you|please)/i,
    /^(tell me|show me|help me|i('d| would) like)/i,
    /^(looking for|interested in|thinking about)/i,
  ];
  const isConversational = conversationalPatterns.some(p => p.test(query.trim()));
  if (isConversational) return true;
  if (words.length <= 6 && !hasProductTerms) return true;
  return false;
}

export class RAGKnowledgeService {
  
  /**
   * Get or create storage limit for user
   */
  static async getUserStorageLimit(userId: string): Promise<{ maxBytes: number; usedBytes: number }> {
    const [existing] = await db
      .select()
      .from(userKnowledgeStorageLimits)
      .where(eq(userKnowledgeStorageLimits.userId, userId));
    
    if (existing) {
      return { maxBytes: existing.maxStorageBytes, usedBytes: existing.usedStorageBytes };
    }
    
    // Create default limit
    await db.insert(userKnowledgeStorageLimits).values({
      userId,
      maxStorageBytes: DEFAULT_STORAGE_LIMIT_BYTES,
      usedStorageBytes: 0,
    });
    
    return { maxBytes: DEFAULT_STORAGE_LIMIT_BYTES, usedBytes: 0 };
  }
  
  /**
   * Update used storage for user
   */
  static async updateUsedStorage(userId: string, deltaBytes: number): Promise<void> {
    await db
      .update(userKnowledgeStorageLimits)
      .set({ 
        usedStorageBytes: sql`${userKnowledgeStorageLimits.usedStorageBytes} + ${deltaBytes}`,
        updatedAt: new Date()
      })
      .where(eq(userKnowledgeStorageLimits.userId, userId));
  }
  
  /**
   * Check if user has enough storage space
   */
  static async checkStorageSpace(userId: string, requiredBytes: number): Promise<boolean> {
    const { maxBytes, usedBytes } = await this.getUserStorageLimit(userId);
    return (usedBytes + requiredBytes) <= maxBytes;
  }
  
  /**
   * Process and store knowledge base item with embeddings
   */
  static async processKnowledgeItem(
    knowledgeBaseId: string, 
    userId: string, 
    content: string,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; chunksCreated: number; error?: string }> {
    try {
      console.log(`[RAG] Processing knowledge item ${knowledgeBaseId} for user ${userId}`);
      
      // Check storage limit
      const contentSize = Buffer.byteLength(content, 'utf8');
      const hasSpace = await this.checkStorageSpace(userId, contentSize);
      
      if (!hasSpace) {
        return { 
          success: false, 
          chunksCreated: 0, 
          error: "Storage limit exceeded. Please delete some knowledge items or upgrade your plan." 
        };
      }
      
      // Create processing queue entry
      const [queueEntry] = await db
        .insert(knowledgeProcessingQueue)
        .values({
          knowledgeBaseId,
          userId,
          status: 'processing',
        })
        .returning();
      
      // Split into chunks
      const chunks = chunkText(content);
      console.log(`[RAG] Created ${chunks.length} chunks from content`);
      
      // Update queue with total chunks
      await db
        .update(knowledgeProcessingQueue)
        .set({ totalChunks: chunks.length })
        .where(eq(knowledgeProcessingQueue.id, queueEntry.id));
      
      // Process each chunk
      let processedCount = 0;
      for (let i = 0; i < chunks.length; i++) {
        const chunkText = chunks[i];
        
        try {
          // Generate embedding
          const embedding = await generateEmbedding(chunkText);
          
          // Store chunk with embedding
          await db.insert(knowledgeChunks).values({
            knowledgeBaseId,
            userId,
            chunkIndex: i,
            chunkText,
            embedding: embedding as any, // Store as JSON array
            tokenCount: estimateTokens(chunkText),
            metadata: { ...metadata, chunkIndex: i, totalChunks: chunks.length },
          });
          
          processedCount++;
          
          // Update progress
          await db
            .update(knowledgeProcessingQueue)
            .set({ processedChunks: processedCount, updatedAt: new Date() })
            .where(eq(knowledgeProcessingQueue.id, queueEntry.id));
          
        } catch (chunkError: any) {
          console.error(`[RAG] Error processing chunk ${i}:`, chunkError.message);
        }
        
        // Small delay to avoid rate limits
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Update storage used
      await this.updateUsedStorage(userId, contentSize);
      
      // Mark as completed
      await db
        .update(knowledgeProcessingQueue)
        .set({ status: 'completed', updatedAt: new Date() })
        .where(eq(knowledgeProcessingQueue.id, queueEntry.id));
      
      console.log(`[RAG] Successfully processed ${processedCount}/${chunks.length} chunks`);
      
      return { success: true, chunksCreated: processedCount };
      
    } catch (error: any) {
      console.error(`[RAG] Error processing knowledge item:`, error.message);
      
      // Mark as failed
      await db
        .update(knowledgeProcessingQueue)
        .set({ status: 'failed', errorMessage: error.message, updatedAt: new Date() })
        .where(eq(knowledgeProcessingQueue.knowledgeBaseId, knowledgeBaseId));
      
      return { success: false, chunksCreated: 0, error: error.message };
    }
  }
  
  /**
   * Search knowledge base using semantic similarity
   */
  static async searchKnowledge(
    query: string,
    knowledgeBaseIds: string[],
    userId: string,
    maxResults: number = 5
  ): Promise<Array<{ chunk: KnowledgeChunk; score: number; source: string }>> {
    try {
      if (typeof knowledgeBaseIds === 'string') {
        console.error(`[RAG] searchKnowledge called with knowledgeBaseIds as string instead of array: "${knowledgeBaseIds}". Returning empty results.`);
        return [];
      }

      console.log(`[RAG] Searching knowledge for: "${query.substring(0, 50)}..."`);
      
      if (knowledgeBaseIds.length === 0) {
        return [];
      }

      let expandedQueries: string[] | null = null;
      if (needsQueryExpansion(query)) {
        expandedQueries = await expandQuery(query);
      }

      const faqResults = await this.searchFAQs(query, knowledgeBaseIds, userId);
      if (faqResults.length > 0) {
        console.log(`[RAG] Found ${faqResults.length} FAQ matches`);
      }
      
      let chunkResults: Array<{ chunk: KnowledgeChunk; score: number; source: string }> = [];
      
      const chunks = await db
        .select()
        .from(knowledgeChunks)
        .where(
          and(
            inArray(knowledgeChunks.knowledgeBaseId, knowledgeBaseIds),
            eq(knowledgeChunks.userId, userId)
          )
        );
      
      if (chunks.length > 0) {
        console.log(`[RAG] Searching ${chunks.length} chunks via vector similarity`);
        
        const allQueries = [query, ...(expandedQueries || [])];
        const queryEmbeddings = await Promise.all(
          allQueries.map(q => generateEmbedding(q))
        );
        
        const chunksWithEmbeddings = chunks.filter(chunk => chunk.embedding && Array.isArray(chunk.embedding));
        
        const scoreMap = new Map<string, { chunk: KnowledgeChunk; score: number; source: string }>();
        
        for (const embedding of queryEmbeddings) {
          for (const chunk of chunksWithEmbeddings) {
            const score = cosineSimilarity(embedding, chunk.embedding as number[]);
            const existing = scoreMap.get(chunk.id);
            if (!existing || score > existing.score) {
              scoreMap.set(chunk.id, {
                chunk,
                score,
                source: chunk.knowledgeBaseId
              });
            }
          }
        }
        
        const allScoredChunks = Array.from(scoreMap.values())
          .sort((a, b) => b.score - a.score);
        
        const preFilterCount = allScoredChunks.length;
        chunkResults = allScoredChunks
          .filter(r => r.score >= MIN_VECTOR_RELEVANCE)
          .slice(0, maxResults);
        
        console.log(`[RAG] Found ${chunkResults.length}/${preFilterCount} chunks above ${MIN_VECTOR_RELEVANCE} threshold (top score: ${allScoredChunks[0]?.score.toFixed(3) || 'N/A'}, cutoff filtered: ${preFilterCount - chunkResults.length}, expanded: ${expandedQueries ? 'yes' : 'no'})`);
      }
      
      let combined = [...faqResults, ...chunkResults]
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);
      
      if (combined.length > 0 && isProductServiceQuery(query)) {
        const beforeFilter = combined.length;
        combined = combined.filter(r => !isHRCareerContent(r.chunk.chunkText));
        if (beforeFilter !== combined.length) {
          console.log(`[RAG] Filtered out ${beforeFilter - combined.length} HR/career results for product/service query`);
        }
      }
      
      if (combined.length > 0) {
        console.log(`[RAG] Returning ${combined.length} combined results (${faqResults.length} FAQs + ${chunkResults.length} chunks)`);
        return combined;
      }
      
      // TIER 3: Direct content fallback (no chunks/embeddings available)
      console.log(`[RAG] No chunks found - falling back to direct knowledge base content`);
      
      const kbEntries = await db
        .select()
        .from(knowledgeBase)
        .where(
          and(
            inArray(knowledgeBase.id, knowledgeBaseIds),
            eq(knowledgeBase.userId, userId)
          )
        );
      
      if (kbEntries.length === 0) {
        console.log(`[RAG] No knowledge base entries found either`);
        return [];
      }
      
      console.log(`[RAG] Found ${kbEntries.length} KB entries for direct content fallback`);
      
      const queryLower = query.toLowerCase();
      const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
      
      const isProductQuery = isProductServiceQuery(query);
      const scoredEntries = kbEntries
        .filter(entry => entry.content && entry.content.trim().length > 0)
        .filter(entry => {
          if (isProductQuery && isHRCareerContent(entry.content || '')) {
            console.log(`[RAG] Filtered out HR/career KB entry: "${(entry.title || '').substring(0, 50)}"`);
            return false;
          }
          return true;
        })
        .map(entry => {
          const contentLower = (entry.content || '').toLowerCase();
          const titleLower = (entry.title || '').toLowerCase();
          let relevanceScore = 0;
          
          for (const word of queryWords) {
            if (contentLower.includes(word)) relevanceScore += 0.15;
            if (titleLower.includes(word)) relevanceScore += 0.25;
          }
          
          relevanceScore = Math.min(relevanceScore, 0.95);
          
          return {
            chunk: {
              chunkText: (entry.content || '').substring(0, MAX_CHUNK_CHARS),
            } as Pick<KnowledgeChunk, 'chunkText'> as KnowledgeChunk,
            score: relevanceScore,
            source: entry.id,
          };
        })
        .filter(e => e.score >= MIN_FALLBACK_RELEVANCE)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);
      
      console.log(`[RAG] Returning ${scoredEntries.length} direct content results`);
      return scoredEntries;
      
    } catch (error: any) {
      console.error(`[RAG] Search error:`, error.message);
      return [];
    }
  }

  static async searchFAQs(
    query: string,
    knowledgeBaseIds: string[],
    userId: string
  ): Promise<Array<{ chunk: KnowledgeChunk; score: number; source: string }>> {
    try {
      const queryLowerInit = query.toLowerCase();
      const keywords = queryLowerInit.split(/\s+/).filter(w => w.length > 2);

      let faqs: (typeof knowledgeFaqs.$inferSelect)[] = [];

      if (keywords.length > 0) {
        const keywordFilters = keywords.map(kw => ilike(knowledgeFaqs.question, `%${kw}%`));
        faqs = await db
          .select()
          .from(knowledgeFaqs)
          .where(
            and(
              inArray(knowledgeFaqs.knowledgeBaseId, knowledgeBaseIds),
              eq(knowledgeFaqs.userId, userId),
              or(...keywordFilters)
            )
          );
      }

      if (faqs.length === 0) {
        faqs = await db
          .select()
          .from(knowledgeFaqs)
          .where(
            and(
              inArray(knowledgeFaqs.knowledgeBaseId, knowledgeBaseIds),
              eq(knowledgeFaqs.userId, userId)
            )
          );
      }
      
      if (faqs.length === 0) return [];
      
      const queryLower = query.toLowerCase();
      const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
      
      const faqsWithEmbeddings = faqs.filter(f => f.embedding && Array.isArray(f.embedding));
      
      let scoredFaqs: Array<{ faq: typeof faqs[0]; score: number }>;
      
      if (faqsWithEmbeddings.length > 0) {
        try {
          const queryEmbedding = await generateEmbedding(query);
          scoredFaqs = faqsWithEmbeddings.map(faq => ({
            faq,
            score: cosineSimilarity(queryEmbedding, faq.embedding as number[]),
          }));
        } catch {
          scoredFaqs = faqs.map(faq => {
            const questionLower = faq.question.toLowerCase();
            let score = 0;
            for (const word of queryWords) {
              if (questionLower.includes(word)) score += 0.2;
            }
            return { faq, score: Math.min(score, 0.95) };
          });
        }
      } else {
        scoredFaqs = faqs.map(faq => {
          const questionLower = faq.question.toLowerCase();
          const answerLower = faq.answer.toLowerCase();
          let score = 0;
          for (const word of queryWords) {
            if (questionLower.includes(word)) score += 0.2;
            if (answerLower.includes(word)) score += 0.1;
          }
          return { faq, score: Math.min(score, 0.95) };
        });
      }
      
      const topFaqs = scoredFaqs
        .filter(f => f.score >= MIN_FAQ_RELEVANCE)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      
      if (topFaqs.length === 0) return [];
      
      console.log(`[RAG FAQ] Top FAQ match: "${topFaqs[0].faq.question}" (score: ${topFaqs[0].score.toFixed(3)})`);
      
      return topFaqs.map(f => ({
        chunk: {
          chunkText: `Q: ${f.faq.question}\nA: ${f.faq.answer}`,
        } as Pick<KnowledgeChunk, 'chunkText'> as KnowledgeChunk,
        score: f.score + 0.05,
        source: f.faq.knowledgeBaseId || '',
      }));
      
    } catch (error: any) {
      console.error(`[RAG FAQ] FAQ search error:`, error.message);
      return [];
    }
  }
  
  /**
   * Format search results for agent consumption
   */
  static formatResultsForAgent(
    results: Array<{ chunk: KnowledgeChunk; score: number; source: string }>,
    maxTokens: number = 1500
  ): string {
    if (results.length === 0) {
      return "No relevant information found in the knowledge base.";
    }
    
    let output = "KNOWLEDGE BASE RESULTS:\n\n";
    let totalTokens = estimateTokens(output);
    let resultIndex = 1;
    
    for (const result of results) {
      const chunkText = result.chunk.chunkText;
      const isFAQ = chunkText.startsWith('Q:') || chunkText.startsWith('Question:');
      const hasSection = chunkText.startsWith('[');
      
      let label = '';
      if (isFAQ) {
        label = `[FAQ Match - Relevance: ${Math.round(result.score * 100)}%]\n`;
      } else if (hasSection) {
        label = `[Document Section - Relevance: ${Math.round(result.score * 100)}%]\n`;
      } else {
        label = `[Knowledge Base - Relevance: ${Math.round(result.score * 100)}%]\n`;
      }
      
      const entry = `--- Result ${resultIndex} ---\n${label}${chunkText}\n\n`;
      const entryTokens = estimateTokens(entry);
      
      if (totalTokens + entryTokens > maxTokens) {
        const remainingTokens = maxTokens - totalTokens - 20;
        if (remainingTokens > 80) {
          const truncatedChars = remainingTokens * 4;
          output += `--- Result ${resultIndex} ---\n${label}${chunkText.substring(0, truncatedChars)}...\n\n`;
        }
        break;
      }
      
      output += entry;
      totalTokens += entryTokens;
      resultIndex++;
    }
    
    output += "---\nIMPORTANT: Use ONLY the above information to answer the user's question naturally and conversationally. If a result appears to be about internal company matters (careers, hiring, HR policies, employee benefits, work culture) but the user is asking about products or services, IGNORE that result and focus only on product/service-related information. If none of the results are relevant to the user's actual question, say you don't have that information available.";
    
    return output.trim();
  }
  
  static async generateProfessorAnswer(
    query: string,
    results: Array<{ chunk: KnowledgeChunk; score: number; source: string }>,
    formattedResults: string
  ): Promise<string> {
    if (results.length === 0) {
      return "I don't have specific information about that in my study materials. Could you rephrase your question?";
    }

    try {
      const openai = await getOpenAIClient();

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a direct, knowledgeable customer service representative. Your ONLY job is to answer based on the knowledge base content provided below.

STRICT RULES:
- ONLY answer using facts from the knowledge base content below — NEVER add general knowledge, travel tips, cultural information, or anything not explicitly in the KB
- Be DIRECT and specific — get straight to the point with product/service information
- If the user's query is vague (e.g., "I want to buy" or "I'm traveling to Europe"), interpret it in the context of what your knowledge base actually contains (products, services, plans, pricing) and answer about THOSE specifically
- Do NOT give generic advice, suggestions, or pleasantries unrelated to KB content
- Keep it concise — 2-4 sentences maximum unless the question requires more detail
- If the knowledge base has NO relevant information for the query, say exactly: "I don't have information about that in my knowledge base."
- NEVER invent details, prices, or features not explicitly stated in the KB content

Knowledge base content:
${formattedResults}`
          },
          {
            role: "user",
            content: query
          }
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      return response.choices[0]?.message?.content?.trim() || formattedResults;
    } catch (error: any) {
      console.error(`[RAG] generateProfessorAnswer error:`, error.message);
      return formattedResults;
    }
  }

  static async learnFromQuery(
    query: string,
    aiAnswer: string,
    knowledgeBaseIds: string[],
    userId: string
  ): Promise<void> {
    try {
      if (!knowledgeBaseIds || knowledgeBaseIds.length === 0) return;

      const kbId = knowledgeBaseIds[0];
      const qaText = `Q: ${query}\nA: ${aiAnswer}`;

      const existingChunks = await db
        .select({ cnt: sql<number>`count(*)::int` })
        .from(knowledgeChunks)
        .where(and(
          eq(knowledgeChunks.knowledgeBaseId, kbId),
          eq(knowledgeChunks.userId, userId)
        ));
      const nextIndex = (existingChunks[0]?.cnt || 0) + 1;

      const embedding = await generateEmbedding(qaText);

      await db.insert(knowledgeChunks).values({
        knowledgeBaseId: kbId,
        userId,
        chunkIndex: nextIndex,
        chunkText: qaText,
        embedding: embedding as any,
        tokenCount: estimateTokens(qaText),
        metadata: { autoLearned: true, originalQuery: query, learnedAt: new Date().toISOString() },
      });

      console.log(`[RAG] Auto-learned Q&A for: "${query.substring(0, 50)}..."`);
    } catch (error: any) {
      console.error(`[RAG] learnFromQuery error:`, error.message);
    }
  }

  /**
   * Delete all chunks for a knowledge base item
   */
  static async deleteKnowledgeChunks(knowledgeBaseId: string, userId: string): Promise<void> {
    // Get total size of chunks being deleted
    const chunks = await db
      .select()
      .from(knowledgeChunks)
      .where(
        and(
          eq(knowledgeChunks.knowledgeBaseId, knowledgeBaseId),
          eq(knowledgeChunks.userId, userId)
        )
      );
    
    const totalSize = chunks.reduce((sum, chunk) => {
      return sum + Buffer.byteLength(chunk.chunkText, 'utf8');
    }, 0);
    
    // Delete chunks
    await db
      .delete(knowledgeChunks)
      .where(eq(knowledgeChunks.knowledgeBaseId, knowledgeBaseId));
    
    // Delete processing queue entries
    await db
      .delete(knowledgeProcessingQueue)
      .where(eq(knowledgeProcessingQueue.knowledgeBaseId, knowledgeBaseId));
    
    // Update storage used (subtract deleted size)
    if (totalSize > 0) {
      await this.updateUsedStorage(userId, -totalSize);
    }
    
    console.log(`[RAG] Deleted ${chunks.length} chunks for knowledge base ${knowledgeBaseId}`);
  }
  
  /**
   * Get processing status for a knowledge base item
   */
  static async getProcessingStatus(knowledgeBaseId: string): Promise<{
    status: string;
    progress: number;
    error?: string;
  } | null> {
    const [entry] = await db
      .select()
      .from(knowledgeProcessingQueue)
      .where(eq(knowledgeProcessingQueue.knowledgeBaseId, knowledgeBaseId))
      .orderBy(sql`${knowledgeProcessingQueue.createdAt} DESC`)
      .limit(1);
    
    if (!entry) {
      return null;
    }
    
    const progress = entry.totalChunks 
      ? (entry.processedChunks || 0) / entry.totalChunks * 100 
      : 0;
    
    return {
      status: entry.status,
      progress: Math.round(progress),
      error: entry.errorMessage || undefined,
    };
  }
  
  /**
   * Get chunk count for a knowledge base item
   */
  static async getChunkCount(knowledgeBaseId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(knowledgeChunks)
      .where(eq(knowledgeChunks.knowledgeBaseId, knowledgeBaseId));
    
    return Number(result[0]?.count || 0);
  }

  private static processingKBs = new Set<string>();

  static async processUnchunkedKnowledgeBases(knowledgeBaseIds: string[], userId: string): Promise<void> {
    try {
      for (const kbId of knowledgeBaseIds) {
        if (this.processingKBs.has(kbId)) continue;

        const chunkCount = await this.getChunkCount(kbId);
        if (chunkCount > 0) continue;

        const [entry] = await db
          .select()
          .from(knowledgeBase)
          .where(
            and(
              eq(knowledgeBase.id, kbId),
              eq(knowledgeBase.userId, userId)
            )
          )
          .limit(1);

        if (!entry || !entry.content || entry.content.trim().length === 0) continue;

        this.processingKBs.add(kbId);
        try {
          console.log(`[RAG] Auto-processing unchunked KB: ${entry.title || kbId}`);
          await this.processKnowledgeItem(kbId, userId, entry.content, {
            title: entry.title,
            type: entry.type,
            autoProcessed: true,
          });
        } finally {
          this.processingKBs.delete(kbId);
        }
      }
    } catch (error: any) {
      console.error(`[RAG] Error auto-processing unchunked KBs:`, error.message);
    }
  }
}

export default RAGKnowledgeService;
