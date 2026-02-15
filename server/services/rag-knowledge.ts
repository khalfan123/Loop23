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
        
        const queryEmbedding = await generateEmbedding(query);
        
        chunkResults = chunks
          .filter(chunk => chunk.embedding && Array.isArray(chunk.embedding))
          .map(chunk => ({
            chunk,
            score: cosineSimilarity(queryEmbedding, chunk.embedding as number[]),
            source: chunk.knowledgeBaseId
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, maxResults);
        
        console.log(`[RAG] Found ${chunkResults.length} relevant chunks (top score: ${chunkResults[0]?.score.toFixed(3) || 'N/A'})`);
      }
      
      const combined = [...faqResults, ...chunkResults]
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);
      
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
      
      const scoredEntries = kbEntries
        .filter(entry => entry.content && entry.content.trim().length > 0)
        .map(entry => {
          const contentLower = (entry.content || '').toLowerCase();
          const titleLower = (entry.title || '').toLowerCase();
          let relevanceScore = 0;
          
          for (const word of queryWords) {
            if (contentLower.includes(word)) relevanceScore += 0.15;
            if (titleLower.includes(word)) relevanceScore += 0.25;
          }
          
          relevanceScore = Math.min(relevanceScore, 0.95);
          if (relevanceScore === 0) relevanceScore = 0.3;
          
          return {
            chunk: {
              chunkText: (entry.content || '').substring(0, MAX_CHUNK_CHARS),
            } as Pick<KnowledgeChunk, 'chunkText'> as KnowledgeChunk,
            score: relevanceScore,
            source: entry.id,
          };
        })
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
        .filter(f => f.score > 0.3)
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
    maxTokens: number = 800
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
    
    output += "---\nUse the above information to answer the user's question naturally and conversationally.";
    
    return output.trim();
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
