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
import { awsBedrockService } from "./aws-bedrock";

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
  let inTable = false;
  let inList = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    if (/^\[(?:Pricing|Product|Table|Section)/.test(trimmed)) {
      inTable = true;
    }
    if (inTable && trimmed === '' && i + 1 < lines.length && !/\|/.test(lines[i + 1]?.trim() || '')) {
      inTable = false;
    }

    if (/^[•\-]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
      inList = true;
    }
    if (inList && trimmed === '' && i + 1 < lines.length && !/^[•\-]\s/.test(lines[i + 1]?.trim() || '') && !/^\d+\.\s/.test(lines[i + 1]?.trim() || '')) {
      inList = false;
    }

    const isHeading = 
      /^#{1,4}\s+/.test(trimmed) ||
      (/^[A-Z][A-Z\s]{3,}$/.test(trimmed) && trimmed.length < 80) ||
      (/^[A-Z][\w\s]+:$/.test(trimmed) && trimmed.length < 80) ||
      /^\[Section:/.test(trimmed);
    
    const isQAStart = /^(Q:|A:|Question:|Answer:)/i.test(trimmed);
    
    const shouldSplit = !inTable && !inList && (isHeading || (isQAStart && currentContent.length > 0));
    
    if (shouldSplit && currentContent.length > 0) {
      sections.push({
        heading: currentHeading,
        content: currentContent.join('\n'),
      });
      currentContent = [];
      if (isHeading) {
        currentHeading = trimmed.replace(/^#+\s*/, '').replace(/:$/, '').replace(/^\[Section:\s*/, '').replace(/\]$/, '');
      } else {
        currentHeading = '';
      }
    } else if (isHeading && !inTable && !inList) {
      currentHeading = trimmed.replace(/^#+\s*/, '').replace(/:$/, '').replace(/^\[Section:\s*/, '').replace(/\]$/, '');
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
  static async expandQuery(query: string): Promise<string[]> {
    const queries = [query];
    
    if (!awsBedrockService.isConfigured()) {
      return queries;
    }
    
    try {
      const response = await awsBedrockService.invoke({
        model: awsBedrockService.selectModelForTask('quick'),
        messages: [{ role: "user", content: query }],
        systemPrompt: `Generate 3 alternative phrasings of this question/query for a knowledge base search. Return ONLY a JSON array of strings. Keep each variant concise. Example: ["variant 1", "variant 2", "variant 3"]`,
        maxTokens: 300,
        temperature: 0.5,
      });
      
      const parsed = JSON.parse(response.content.trim());
      if (Array.isArray(parsed)) {
        queries.push(...parsed.slice(0, 3).filter((v: any) => typeof v === 'string'));
      }
    } catch (e: any) {
      console.log(`[RAG] Query expansion failed (non-critical): ${e.message}`);
    }
    
    return queries;
  }

  static async semanticRerank(
    query: string,
    results: Array<{ chunk: KnowledgeChunk; score: number; source: string }>,
    topK: number = 5
  ): Promise<Array<{ chunk: KnowledgeChunk; score: number; source: string }>> {
    if (results.length <= topK || !awsBedrockService.isConfigured()) {
      return results.slice(0, topK);
    }
    
    try {
      const candidateTexts = results.map((r, i) => `[${i}] ${r.chunk.chunkText.substring(0, 500)}`).join('\n\n');
      
      const response = await awsBedrockService.invoke({
        model: awsBedrockService.selectModelForTask('rerank'),
        messages: [{ role: "user", content: `Query: "${query}"\n\nCandidate passages:\n${candidateTexts}` }],
        systemPrompt: `You are a search relevance ranker. Given a query and numbered candidate passages, return a JSON array of the indices of the ${topK} most relevant passages, ordered by relevance (most relevant first). Return ONLY a JSON array of numbers. Example: [3, 0, 7, 1, 5]`,
        maxTokens: 100,
        temperature: 0,
      });
      
      const ranked = JSON.parse(response.content.trim());
      if (Array.isArray(ranked)) {
        const reranked: typeof results = [];
        for (const idx of ranked) {
          if (typeof idx === 'number' && idx >= 0 && idx < results.length) {
            const result = results[idx];
            reranked.push({
              ...result,
              score: Math.min(result.score + 0.1, 0.99),
            });
          }
        }
        if (reranked.length > 0) {
          console.log(`[RAG] Semantic re-ranking: ${results.length} → ${reranked.length} results`);
          return reranked.slice(0, topK);
        }
      }
    } catch (e: any) {
      console.log(`[RAG] Semantic re-ranking failed (non-critical): ${e.message}`);
    }
    
    return results.slice(0, topK);
  }

  static async extractAnswer(
    query: string,
    results: Array<{ chunk: KnowledgeChunk; score: number; source: string }>
  ): Promise<string> {
    if (results.length === 0) {
      return "I don't have specific information about that right now, but I'd be happy to help you find what you need. Could you tell me a bit more about what you're looking for?";
    }
    
    if (!awsBedrockService.isConfigured()) {
      return this.formatResultsForAgent(results, 1500);
    }
    
    try {
      const context = results.map(r => r.chunk.chunkText).join('\n\n---\n\n');
      
      const response = await awsBedrockService.invoke({
        model: awsBedrockService.selectModelForTask('quick'),
        messages: [{ role: "user", content: `Question: ${query}\n\nKnowledge base context:\n${context}` }],
        systemPrompt: `You are a friendly call center agent answering a caller's question on the phone. Extract the answer from the knowledge base context and deliver it naturally.

VOICE OUTPUT RULES (your response will be SPOKEN aloud):
- NEVER include URLs — say "you can find that on our website" or "I can send you a link after the call"
- NEVER use bullet points or numbered lists — convert to flowing sentences: "You'll need three things: first..., second..., and finally..."
- Use contractions naturally: I'm, you'll, we're, that's, it's, don't, can't
- Replace jargon with plain language: "APN configuration" → "your phone's internet settings", "QR code provisioning" → "the code we send you"
- NEVER say "according to our records" or "as per our policy" — say "from what I can see" or "our guidelines say"
- Keep it to 2-4 sentences maximum
- Include specific details (prices, numbers, steps) when available
- Use ONLY facts from the provided context — don't make things up

PROACTIVE FOLLOW-UP:
After answering, add ONE natural follow-up suggestion based on related topics in the context:
- "By the way, you might also want to know about..."
- "One more thing that could be helpful..."
- "Would you also like to know about...?"
Only suggest if genuinely relevant. Don't force it.`,
        maxTokens: 600,
        temperature: 0.3,
      });
      
      return response.content.trim();
    } catch (e: any) {
      console.log(`[RAG] Answer extraction failed, falling back to formatted results: ${e.message}`);
      return this.formatResultsForAgent(results, 1500);
    }
  }

  static async enhancedSearch(
    query: string,
    knowledgeBaseIds: string[],
    userId: string,
    options: {
      maxResults?: number;
      useReranking?: boolean;
      useQueryExpansion?: boolean;
      useAnswerExtraction?: boolean;
      reasoningMode?: 'quick' | 'deep' | 'expert';
    } = {}
  ): Promise<{ results: Array<{ chunk: KnowledgeChunk; score: number; source: string }>; extractedAnswer?: string }> {
    const {
      maxResults = 5,
      useReranking = true,
      useQueryExpansion = true,
      useAnswerExtraction = true,
      reasoningMode = 'deep',
    } = options;

    const retrieveCount = useReranking ? Math.min(maxResults * 3, 15) : maxResults;
    
    let allResults: Array<{ chunk: KnowledgeChunk; score: number; source: string }> = [];

    if (useQueryExpansion && reasoningMode !== 'quick') {
      const expandedQueries = await this.expandQuery(query);
      console.log(`[RAG Enhanced] Expanded query into ${expandedQueries.length} variants`);
      
      const resultSets = await Promise.all(
        expandedQueries.map(q => this.searchKnowledge(q, knowledgeBaseIds, userId, retrieveCount))
      );
      
      const seen = new Set<string>();
      for (const resultSet of resultSets) {
        for (const result of resultSet) {
          const key = result.chunk.chunkText.substring(0, 100);
          if (!seen.has(key)) {
            seen.add(key);
            allResults.push(result);
          }
        }
      }
    } else {
      allResults = await this.searchKnowledge(query, knowledgeBaseIds, userId, retrieveCount);
    }

    const faqResults = await this.searchFAQs(query, knowledgeBaseIds, userId);
    if (faqResults.length > 0) {
      allResults = [...faqResults, ...allResults];
    }

    allResults.sort((a, b) => b.score - a.score);

    const deduped: typeof allResults = [];
    const dedupKeys = new Set<string>();
    for (const r of allResults) {
      const key = r.chunk.id || r.chunk.chunkText.normalize('NFC').trim();
      if (!dedupKeys.has(key)) {
        dedupKeys.add(key);
        deduped.push(r);
      }
    }
    allResults = deduped;

    if (useReranking && allResults.length > maxResults && reasoningMode !== 'quick') {
      allResults = await this.semanticRerank(query, allResults, maxResults);
    } else {
      allResults = allResults.slice(0, maxResults);
    }

    let extractedAnswer: string | undefined;
    if (useAnswerExtraction && allResults.length > 0 && reasoningMode !== 'quick') {
      extractedAnswer = await this.extractAnswer(query, allResults);
    }

    console.log(`[RAG Enhanced] Final: ${allResults.length} results, answer extracted: ${!!extractedAnswer}`);

    return { results: allResults, extractedAnswer };
  }

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
    
    output += `---
IMPORTANT RULES FOR YOUR RESPONSE:
- Use ONLY the above information to answer the user's question
- Your response will be SPOKEN on a phone call — write as if you're talking, not writing
- NEVER read URLs aloud — say "you can find that on our website" or "I can send you a link"
- NEVER list bullet points — use flowing sentences instead
- Use contractions naturally (I'm, you'll, we're, that's)
- Keep your response to 4 sentences maximum
- If a result is about careers/HR but the user asked about products, IGNORE it
- After answering, suggest one related topic the caller might find helpful
- If none of the results are relevant, say "I don't have that specific information right now, but let me see what else I can help you with."
- Sound like a real person on the phone, not a bot reading a database`;
    
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
            content: `You are a helpful, knowledgeable assistant. Your job is to answer the user's question using the knowledge base content provided below.

RULES:
- Answer using facts from the knowledge base content below
- Be DIRECT and specific — get straight to the point
- If the user's query is broad or vague, summarize the most relevant information you can find in the knowledge base content
- Keep it concise — 2-4 sentences maximum unless the question requires more detail
- NEVER invent details, prices, or features not explicitly stated in the KB content
- Do NOT add general knowledge or information that is not in the KB content below
- If the knowledge base content below is COMPLETELY unrelated to the user's question with zero overlap, say: "I don't have information about that in my knowledge base."
- However, if there is ANY relevant information at all, even partially related, provide what you can from the KB content

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

  static scoreResponseQuality(
    query: string,
    answer: string,
    searchResults: Array<{ chunk: KnowledgeChunk; score: number; source: string }>,
    confidence: number
  ): { score: number; flags: string[] } {
    const flags: string[] = [];
    let score = 0;

    if (confidence >= 0.7) score += 30;
    else if (confidence >= 0.4) score += 15;
    else { score += 5; flags.push('low_confidence'); }

    if (searchResults.length >= 3) score += 15;
    else if (searchResults.length >= 1) score += 10;
    else { score += 0; flags.push('no_results'); }

    const avgSearchScore = searchResults.length > 0
      ? searchResults.reduce((sum, r) => sum + r.score, 0) / searchResults.length
      : 0;
    score += Math.round(avgSearchScore * 20);

    if (answer.length >= 50 && answer.length <= 500) score += 15;
    else if (answer.length < 50) { score += 5; flags.push('too_short'); }
    else if (answer.length > 500) { score += 8; flags.push('too_long_for_voice'); }

    const voiceReadySignals = ["i'm", "you'll", "we're", "that's", "don't", "can't", "won't"];
    const hasContractions = voiceReadySignals.some(s => answer.toLowerCase().includes(s));
    if (hasContractions) score += 5;

    const badSignals = ['http://', 'https://', '•', '- ', '1.', '2.', '3.', '```', '**'];
    const hasBadFormatting = badSignals.some(s => answer.includes(s));
    if (hasBadFormatting) { score -= 10; flags.push('not_voice_ready'); }

    const hedgingPhrases = ['i\'m not sure', 'i don\'t have', 'no information', 'cannot find'];
    const hasHedging = hedgingPhrases.some(p => answer.toLowerCase().includes(p));
    if (hasHedging) { score -= 5; flags.push('hedging'); }

    const hasFollowUp = answer.includes('?') && answer.indexOf('?') > answer.length / 2;
    if (hasFollowUp) score += 5;

    return { score: Math.max(0, Math.min(100, score)), flags };
  }

  static async learnFromQuery(
    query: string,
    aiAnswer: string,
    knowledgeBaseIds: string[],
    userId: string,
    qualityScore?: number
  ): Promise<void> {
    try {
      if (!knowledgeBaseIds || knowledgeBaseIds.length === 0) return;

      const minScoreToLearn = 60;
      if (qualityScore !== undefined && qualityScore < minScoreToLearn) {
        console.log(`[RAG] Skipping auto-learn — quality score ${qualityScore} below threshold ${minScoreToLearn}`);
        return;
      }

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
        metadata: { 
          autoLearned: true, 
          provenScript: qualityScore !== undefined && qualityScore >= 80,
          qualityScore: qualityScore || 0,
          originalQuery: query, 
          learnedAt: new Date().toISOString() 
        },
      });

      console.log(`[RAG] Auto-learned Q&A (quality: ${qualityScore || 'unscored'}): "${query.substring(0, 50)}..."`);
    } catch (error: any) {
      console.error(`[RAG] learnFromQuery error:`, error.message);
    }
  }

  static async getKnowledgeGaps(userId: string): Promise<Array<{ query: string; timestamp: string }>> {
    try {
      const gaps = await db
        .select()
        .from(knowledgeChunks)
        .where(and(
          eq(knowledgeChunks.userId, userId),
          sql`(metadata->>'autoLearned')::boolean = false OR metadata->>'qualityScore' IS NOT NULL AND (metadata->>'qualityScore')::int < 40`
        ))
        .limit(50);

      return gaps.map(g => ({
        query: (g.metadata as any)?.originalQuery || g.chunkText.substring(0, 100),
        timestamp: (g.metadata as any)?.learnedAt || '',
      }));
    } catch {
      return [];
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
