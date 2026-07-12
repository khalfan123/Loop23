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
import { createHash } from "crypto";
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

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;
const MAX_CHUNK_CHARS = 2000;

const DEFAULT_STORAGE_LIMIT_BYTES = 20 * 1024 * 1024;

const MIN_VECTOR_RELEVANCE = 0.45;
const MIN_FAQ_RELEVANCE = 0.50;
const MIN_FALLBACK_RELEVANCE = 0.30;

class LRUCache<K, V> {
  private cache = new Map<K, { value: V; expiresAt: number }>();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize: number = 500, ttlMs: number = 300_000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  get size(): number { return this.cache.size; }
}

function hashKey(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

const embeddingCache = new LRUCache<string, number[]>(1000, 600_000);
const queryExpansionCache = new LRUCache<string, string[]>(200, 300_000);
const searchResultCache = new LRUCache<string, Array<{ chunk: KnowledgeChunk; score: number; source: string }>>(100, 60_000);

type QueryIntent = 'faq' | 'product' | 'support' | 'general';

function classifyQueryIntent(query: string): QueryIntent {
  const q = query.toLowerCase().trim();
  
  const faqPatterns = [
    /^(what|how|can|do|is|are|does|will|should|would)\s/,
    /\?$/,
    /^(tell me|explain|describe)\s/,
  ];
  const isFaqStyle = faqPatterns.some(p => p.test(q));
  
  if (isProductServiceQuery(query)) return 'product';
  
  const supportPatterns = [
    /\b(not working|broken|error|issue|problem|help|fix|trouble|fail|crash|bug)\b/,
    /\b(can't|cannot|unable|won't|doesn't work)\b/,
  ];
  if (supportPatterns.some(p => p.test(q))) return 'support';
  
  if (isFaqStyle && q.length < 100) return 'faq';
  
  return 'general';
}

function computeBM25Score(query: string, text: string): number {
  const k1 = 1.5;
  const b = 0.75;
  const avgDocLength = 500;
  
  const queryTerms = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const docTerms = text.toLowerCase().split(/\s+/);
  const docLength = docTerms.length;
  
  if (queryTerms.length === 0 || docLength === 0) return 0;
  
  const termFreqs = new Map<string, number>();
  for (const t of docTerms) {
    termFreqs.set(t, (termFreqs.get(t) || 0) + 1);
  }
  
  let score = 0;
  for (const qt of queryTerms) {
    const tf = termFreqs.get(qt) || 0;
    if (tf === 0) {
      for (const [term, freq] of termFreqs) {
        if (term.includes(qt) || qt.includes(term)) {
          const partialTf = freq * 0.5;
          const numerator = partialTf * (k1 + 1);
          const denominator = partialTf + k1 * (1 - b + b * (docLength / avgDocLength));
          score += (numerator / denominator) * 0.5;
          break;
        }
      }
      continue;
    }
    const numerator = tf * (k1 + 1);
    const denominator = tf + k1 * (1 - b + b * (docLength / avgDocLength));
    score += numerator / denominator;
  }
  
  return score / queryTerms.length;
}

function reciprocalRankFusion(
  vectorResults: Array<{ id: string; score: number }>,
  keywordResults: Array<{ id: string; score: number }>,
  k: number = 60
): Map<string, number> {
  const fusedScores = new Map<string, number>();
  
  for (let i = 0; i < vectorResults.length; i++) {
    const { id } = vectorResults[i];
    fusedScores.set(id, (fusedScores.get(id) || 0) + 1 / (k + i + 1));
  }
  
  for (let i = 0; i < keywordResults.length; i++) {
    const { id } = keywordResults[i];
    fusedScores.set(id, (fusedScores.get(id) || 0) + 1 / (k + i + 1));
  }
  
  return fusedScores;
}

async function generateEmbeddingBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  
  const results: number[][] = new Array(texts.length);
  const uncachedIndices: number[] = [];
  const uncachedTexts: string[] = [];
  
  for (let i = 0; i < texts.length; i++) {
    const cacheKey = hashKey(texts[i]);
    const cached = embeddingCache.get(cacheKey);
    if (cached) {
      results[i] = cached;
    } else {
      uncachedIndices.push(i);
      uncachedTexts.push(texts[i]);
    }
  }
  
  if (uncachedTexts.length > 0) {
    const openai = await getOpenAIClient();
    const BATCH_SIZE = 100;
    
    for (let batchStart = 0; batchStart < uncachedTexts.length; batchStart += BATCH_SIZE) {
      const batch = uncachedTexts.slice(batchStart, batchStart + BATCH_SIZE);
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch,
      });
      
      for (let j = 0; j < response.data.length; j++) {
        const globalIdx = uncachedIndices[batchStart + j];
        const embedding = response.data[j].embedding;
        results[globalIdx] = embedding;
        embeddingCache.set(hashKey(texts[globalIdx]), embedding);
      }
    }
  }
  
  return results;
}

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
  'installation', 'compatible', 'device', 'phone', 'mobile',
  'سعر', 'أسعار', 'منتج', 'منتجات', 'خدمة', 'خدمات', 'باقة', 'باقات',
  'شراء', 'اشتراك', 'تكلفة', 'كم', 'عرض', 'عروض', 'متاح', 'توفر',
  'تفعيل', 'جهاز', 'هاتف', 'موبايل', 'تغطية', 'شبكة', 'بيانات',
  'سفر', 'دولي', 'دول', 'بلد', 'شريحة', 'ميزة', 'مميزات',
  'prix', 'produit', 'acheter', 'abonnement', 'coût', 'forfait',
  'precio', 'producto', 'comprar', 'costo', 'paquete',
  '价格', '产品', '服务', '套餐', '购买', '订阅', '费用', '多少钱',
  '优惠', '可用', '激活', '设备', '手机', '覆盖', '网络', '数据', '流量',
  'कीमत', 'उत्पाद', 'सेवा', 'पैकेज', 'खरीद', 'सदस्यता', 'लागत',
  'कितना', 'ऑफर', 'उपलब्ध', 'सक्रिय', 'डिवाइस', 'फोन', 'मोबाइल',
  'नेटवर्क', 'डेटा', 'प्लान', 'योजना'
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

async function generateEmbedding(text: string): Promise<number[]> {
  const cacheKey = hashKey(text);
  const cached = embeddingCache.get(cacheKey);
  if (cached) return cached;

  const openai = await getOpenAIClient();
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  
  const embedding = response.data[0].embedding;
  embeddingCache.set(cacheKey, embedding);
  return embedding;
}

/**
 * Estimate token count (rough approximation)
 */
function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token for English
  return Math.ceil(text.length / 4);
}

async function expandQuery(query: string): Promise<string[]> {
  const cacheKey = query.toLowerCase().trim();
  const cached = queryExpansionCache.get(cacheKey);
  if (cached) {
    console.log(`[RAG] Query expansion cache hit for: "${query.substring(0, 50)}..."`);
    return cached;
  }

  try {
    const openai = await getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert query expansion assistant for a product/service knowledge base. Given any user question in ANY language:

1. ALWAYS translate the query to English first if it's not in English.
2. Generate 3-4 focused English search queries covering different angles of the user's intent.
3. Include specific product/service terms, synonyms, and related concepts.
4. One query should be broad (category-level), one specific (exact match attempt), and one intent-based.

Return ONLY the search queries in ENGLISH, one per line. No numbering, no explanations.`
        },
        {
          role: "user",
          content: query
        }
      ],
      temperature: 0.3,
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return [query];

    const expandedQueries = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && line.length < 200);

    if (expandedQueries.length === 0) return [query];

    queryExpansionCache.set(cacheKey, expandedQueries);
    console.log(`[RAG] Expanded query "${query}" into ${expandedQueries.length} queries: ${expandedQueries.join(' | ')}`);
    return expandedQueries;
  } catch (error: any) {
    console.error(`[RAG] Query expansion failed, using original:`, error.message);
    return [query];
  }
}

function needsQueryExpansion(query: string): boolean {
  if (query.length > 200) return false;
  const words = query.split(/\s+/).filter(w => w.length > 1);
  if (words.length > 25) return false;
  const hasProductTerms = PRODUCT_SERVICE_KEYWORDS.some(kw => query.toLowerCase().includes(kw));
  if (hasProductTerms) return true;
  const hasNonLatinChars = /[^\u0000-\u007F]/.test(query);
  if (hasNonLatinChars) return true;
  const conversationalPatterns = [
    /^i('m| am| want| need| would)/i,
    /^(hey|hi|hello|can you|could you|please)/i,
    /^(tell me|show me|help me|i('d| would) like)/i,
    /^(looking for|interested in|thinking about)/i,
    /^(what|how|which|where|when|why|is there|are there|do you)/i,
  ];
  const isConversational = conversationalPatterns.some(p => p.test(query.trim()));
  if (isConversational) return true;
  if (words.length <= 10) return true;
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
      
      let processedCount = 0;
      const EMBED_BATCH_SIZE = 50;
      
      for (let batchStart = 0; batchStart < chunks.length; batchStart += EMBED_BATCH_SIZE) {
        const batchChunks = chunks.slice(batchStart, batchStart + EMBED_BATCH_SIZE);
        
        try {
          const embeddings = await generateEmbeddingBatch(batchChunks);
          
          for (let j = 0; j < batchChunks.length; j++) {
            const globalIdx = batchStart + j;
            try {
              await db.insert(knowledgeChunks).values({
                knowledgeBaseId,
                userId,
                chunkIndex: globalIdx,
                chunkText: batchChunks[j],
                embedding: embeddings[j] as any,
                tokenCount: estimateTokens(batchChunks[j]),
                metadata: { ...metadata, chunkIndex: globalIdx, totalChunks: chunks.length },
              });
              processedCount++;
            } catch (chunkError: any) {
              console.error(`[RAG] Error storing chunk ${globalIdx}:`, chunkError.message);
            }
          }

          await db
            .update(knowledgeProcessingQueue)
            .set({ processedChunks: processedCount, updatedAt: new Date() })
            .where(eq(knowledgeProcessingQueue.id, queueEntry.id));
          
        } catch (batchError: any) {
          console.error(`[RAG] Batch embedding error at chunk ${batchStart}:`, batchError.message);
          for (let j = 0; j < batchChunks.length; j++) {
            try {
              const embedding = await generateEmbedding(batchChunks[j]);
              await db.insert(knowledgeChunks).values({
                knowledgeBaseId,
                userId,
                chunkIndex: batchStart + j,
                chunkText: batchChunks[j],
                embedding: embedding as any,
                tokenCount: estimateTokens(batchChunks[j]),
                metadata: { ...metadata, chunkIndex: batchStart + j, totalChunks: chunks.length },
              });
              processedCount++;
            } catch (fallbackErr: any) {
              console.error(`[RAG] Fallback error for chunk ${batchStart + j}:`, fallbackErr.message);
            }
          }
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
   * Prefetch common FAQ-style queries for a KB item so runtime calls can hit
   * the fast FAQ path (knowledge_faqs) before vector search.
   *
   * Retrieval-only (no LLM) for reliability and cost.
   */
  static async prefetchCommonFaqs(
    knowledgeBaseId: string,
    userId: string,
    sourceUrl?: string
  ): Promise<{ created: number }> {
    const commonQuestions = [
      // English
      'What are your working hours?',
      'How do I book or reserve?',
      'What documents are required?',
      'What is the cancellation policy?',
      'How much is the deposit?',
      'Do you accept international driving licenses?',
      'Is insurance included?',
      // Arabic
      'ما هي ساعات العمل؟',
      'كيف يمكنني الحجز؟',
      'ما هي المستندات المطلوبة؟',
      'ما هي سياسة الإلغاء؟',
      'كم مبلغ التأمين (الوديعة)؟',
      'هل تقبلون رخصة قيادة دولية؟',
      'هل التأمين مشمول؟',
    ];

    let created = 0;
    try {
      const qEmbeddings = await generateEmbeddingBatch(commonQuestions);

      for (let i = 0; i < commonQuestions.length; i++) {
        const question = commonQuestions[i];
        const results = await this.searchKnowledge(question, [knowledgeBaseId], userId, 3);
        if (!results || results.length === 0) continue;

        const top = results[0];
        const answer = String(top.chunk.chunkText || '').trim().slice(0, 1200);
        if (!answer || answer.length < 20) continue;

        try {
          await db.insert(knowledgeFaqs).values({
            userId,
            knowledgeBaseId,
            question,
            answer,
            sourceUrl: sourceUrl || 'prefetch',
            sourceChunkId: top.chunk.id,
            confidence: Math.max(0.3, Math.min(0.95, top.score)),
            isVerified: false,
            embedding: qEmbeddings[i] as any,
            updatedAt: new Date(),
          } as any);
          created++;
        } catch {
          // Best effort; ignore duplicates/insert errors.
        }
      }
    } catch (err: any) {
      console.warn(`[RAG] FAQ prefetch failed for ${knowledgeBaseId}: ${err?.message || err}`);
    }

    return { created };
  }
  
  static async searchKnowledge(
    query: string,
    knowledgeBaseIds: string[],
    userId: string,
    maxResults: number = 8
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

      const cacheKey = `${query.toLowerCase().trim()}|${knowledgeBaseIds.sort().join(',')}|${userId}|${maxResults}`;
      const cachedResults = searchResultCache.get(cacheKey);
      if (cachedResults) {
        console.log(`[RAG] Search cache hit (${cachedResults.length} results)`);
        return cachedResults;
      }

      const intent = classifyQueryIntent(query);
      console.log(`[RAG] Query intent: ${intent}`);

      let faqResults: Array<{ chunk: KnowledgeChunk; score: number; source: string }> = [];
      if (intent === 'faq' || intent === 'product' || intent === 'support') {
        faqResults = await this.searchFAQs(query, knowledgeBaseIds, userId);
        if (faqResults.length > 0) {
          console.log(`[RAG] Found ${faqResults.length} FAQ matches`);
        }
        if (intent === 'faq' && faqResults.length >= 2 && faqResults[0].score > 0.75) {
          console.log(`[RAG] Strong FAQ match found (score: ${faqResults[0].score.toFixed(3)}), skipping vector+expansion`);
          searchResultCache.set(cacheKey, faqResults.slice(0, maxResults));
          return faqResults.slice(0, maxResults);
        }
      }

      let expandedQueries: string[] | null = null;
      if (needsQueryExpansion(query)) {
        expandedQueries = await expandQuery(query);
      }
      
      let chunkResults: Array<{ chunk: KnowledgeChunk; score: number; source: string }> = [];

      const allQueries = [query, ...(expandedQueries || [])];
      const queryEmbeddings = await generateEmbeddingBatch(allQueries);

      let usedSqlSearch = false;
      if (this.sqlSearchMode !== 'disabled') {
        try {
          const vectorScoreMap = new Map<string, { chunk: KnowledgeChunk; score: number; source: string }>();
          for (const embedding of queryEmbeddings) {
            const sqlResults = await this.sqlCosineSearch(
              embedding,
              knowledgeBaseIds,
              userId,
              maxResults * 3
            );
            for (const r of sqlResults) {
              const existing = vectorScoreMap.get(r.chunk.id);
              if (!existing || r.score > existing.score) {
                vectorScoreMap.set(r.chunk.id, r);
              }
            }
          }

          if (vectorScoreMap.size > 0) {
            usedSqlSearch = true;

            const keywordChunks = await this.sqlKeywordSearch(
              query,
              knowledgeBaseIds,
              userId,
              maxResults * 2
            );

            const allChunks = new Map<string, { chunk: KnowledgeChunk; source: string }>();
            for (const [id, r] of vectorScoreMap) {
              allChunks.set(id, { chunk: r.chunk, source: r.source });
            }
            for (const kc of keywordChunks) {
              if (!allChunks.has(kc.id)) {
                allChunks.set(kc.id, { chunk: kc, source: kc.knowledgeBaseId });
              }
            }

            const vectorResults = Array.from(vectorScoreMap.entries())
              .map(([id, r]) => ({ id, score: r.score }))
              .sort((a, b) => b.score - a.score);

            const keywordResults = Array.from(allChunks.entries())
              .map(([id, { chunk }]) => ({
                id,
                score: computeBM25Score(query, chunk.chunkText),
              }))
              .filter(r => r.score > 0.1)
              .sort((a, b) => b.score - a.score);

            const fusedScores = reciprocalRankFusion(vectorResults, keywordResults);
            const maxRRFSql = Math.max(...Array.from(fusedScores.values()), 0.001);

            chunkResults = Array.from(fusedScores.entries())
              .map(([id, rrfScore]) => {
                const vectorEntry = vectorScoreMap.get(id);
                const chunkEntry = allChunks.get(id)!;
                const vectorScore = vectorEntry?.score || 0;
                const normalizedRRF = rrfScore / maxRRFSql;
                const hasBM25 = keywordResults.some(kr => kr.id === id);
                let finalScore: number;
                if (vectorScore > 0 && hasBM25) {
                  finalScore = vectorScore * 0.55 + normalizedRRF * 0.45;
                } else if (vectorScore > 0) {
                  finalScore = vectorScore * 0.85 + normalizedRRF * 0.15;
                } else {
                  finalScore = normalizedRRF * 0.7;
                }
                return { chunk: chunkEntry.chunk, score: Math.min(finalScore, 0.99), source: chunkEntry.source };
              })
              .filter(r => r.score >= MIN_FALLBACK_RELEVANCE)
              .sort((a, b) => b.score - a.score)
              .slice(0, maxResults);

            console.log(`[RAG] SQL hybrid search: ${chunkResults.length} results (vector: ${vectorScoreMap.size}, keyword: ${keywordChunks.length}, fused: ${fusedScores.size})`);
          }
        } catch (e: any) {
          console.log(`[RAG] SQL search failed, falling back to JS-based search: ${e.message}`);
          if (this.sqlSearchMode === 'jsonb') {
            this.sqlSearchMode = 'disabled';
            console.log(`[RAG] SQL JSONB search disabled for this session, using JS fallback`);
          }
        }
      }

      if (!usedSqlSearch) {
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
          console.log(`[RAG] Searching ${chunks.length} chunks via JS hybrid search (vector + BM25)`);

          const chunksWithEmbeddings = chunks.filter(chunk => chunk.embedding && Array.isArray(chunk.embedding));

          const vectorScoreMap = new Map<string, { chunk: KnowledgeChunk; score: number; source: string }>();

          for (const embedding of queryEmbeddings) {
            for (const chunk of chunksWithEmbeddings) {
              const score = cosineSimilarity(embedding, chunk.embedding as number[]);
              const existing = vectorScoreMap.get(chunk.id);
              if (!existing || score > existing.score) {
                vectorScoreMap.set(chunk.id, {
                  chunk,
                  score,
                  source: chunk.knowledgeBaseId
                });
              }
            }
          }

          const vectorResults = Array.from(vectorScoreMap.entries())
            .map(([id, r]) => ({ id, score: r.score }))
            .filter(r => r.score >= MIN_VECTOR_RELEVANCE * 0.8)
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults * 3);

          const keywordResults = chunks
            .map(chunk => ({
              id: chunk.id,
              score: computeBM25Score(query, chunk.chunkText),
            }))
            .filter(r => r.score > 0.1)
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults * 3);

          const fusedScores = reciprocalRankFusion(vectorResults, keywordResults);

          const chunkMap = new Map<string, KnowledgeChunk>();
          for (const chunk of chunks) {
            chunkMap.set(chunk.id, chunk);
          }

          const maxRRF = Math.max(...Array.from(fusedScores.values()), 0.001);

          const allScoredChunks = Array.from(fusedScores.entries())
            .map(([id, rrfScore]) => {
              const vectorEntry = vectorScoreMap.get(id);
              const chunk = vectorEntry?.chunk || chunkMap.get(id)!;
              const vectorScore = vectorEntry?.score || 0;
              const normalizedRRF = rrfScore / maxRRF;
              const hasVector = vectorScore > 0;
              const hasBM25 = keywordResults.some(kr => kr.id === id);
              let finalScore: number;
              if (hasVector && hasBM25) {
                finalScore = vectorScore * 0.55 + normalizedRRF * 0.45;
              } else if (hasVector) {
                finalScore = vectorScore * 0.85 + normalizedRRF * 0.15;
              } else {
                finalScore = normalizedRRF * 0.7;
              }
              return {
                chunk,
                score: Math.min(finalScore, 0.99),
                source: chunk.knowledgeBaseId,
              };
            })
            .filter(r => r.chunk && r.score >= MIN_FALLBACK_RELEVANCE)
            .sort((a, b) => b.score - a.score);

          const preFilterCount = allScoredChunks.length;
          chunkResults = allScoredChunks.slice(0, maxResults);

          console.log(`[RAG] JS hybrid search: ${chunkResults.length}/${preFilterCount} chunks above threshold (top: ${allScoredChunks[0]?.score.toFixed(3) || 'N/A'}, vector: ${vectorResults.length}, keyword: ${keywordResults.length}, expanded: ${expandedQueries ? 'yes' : 'no'})`);
        }
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
        searchResultCache.set(cacheKey, combined);
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
          
          if (isProductQuery && relevanceScore < MIN_FALLBACK_RELEVANCE) {
            const hasPrice = /\$|€|£|price|cost|sar|ريال|سعر/i.test(contentLower);
            const hasProduct = /product|plan|package|service|offer|باقة|منتج/i.test(contentLower);
            if ((hasPrice || hasProduct) && (entry.content || '').length > 20) {
              relevanceScore = Math.max(relevanceScore, MIN_FALLBACK_RELEVANCE);
            }
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
    if (results.length <= topK) {
      return results.slice(0, topK);
    }
    
    const candidateTexts = results.map((r, i) => `[${i}] ${r.chunk.chunkText.substring(0, 500)}`).join('\n\n');
    const rerankPrompt = `You are a search relevance ranker. Given a query and numbered candidate passages, return a JSON array of the indices of the ${topK} most relevant passages, ordered by relevance (most relevant first). Return ONLY a JSON array of numbers. Example: [3, 0, 7, 1, 5]`;
    const userContent = `Query: "${query}"\n\nCandidate passages:\n${candidateTexts}`;

    if (awsBedrockService.isConfigured()) {
      try {
        const response = await awsBedrockService.invoke({
          model: awsBedrockService.selectModelForTask('rerank'),
          messages: [{ role: "user", content: userContent }],
          systemPrompt: rerankPrompt,
          maxTokens: 100,
          temperature: 0,
        });
        
        const parsed = this.parseRerankResponse(response.content, results, topK);
        if (parsed) return parsed;
      } catch (e: any) {
        console.log(`[RAG] Bedrock re-ranking failed, trying GPT-4o-mini: ${e.message}`);
      }
    }

    try {
      const openai = await getOpenAIClient();
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: rerankPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0,
        max_tokens: 100,
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (content) {
        const parsed = this.parseRerankResponse(content, results, topK);
        if (parsed) return parsed;
      }
    } catch (e: any) {
      console.log(`[RAG] GPT-4o-mini re-ranking failed (non-critical): ${e.message}`);
    }
    
    return results.slice(0, topK);
  }

  private static parseRerankResponse(
    content: string,
    results: Array<{ chunk: KnowledgeChunk; score: number; source: string }>,
    topK: number
  ): Array<{ chunk: KnowledgeChunk; score: number; source: string }> | null {
    try {
      const jsonMatch = content.match(/\[[\d\s,]+\]/);
      if (!jsonMatch) return null;
      const ranked = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(ranked)) return null;
      
      const reranked: typeof results = [];
      for (const idx of ranked) {
        if (typeof idx === 'number' && idx >= 0 && idx < results.length) {
          reranked.push({
            ...results[idx],
            score: Math.min(results[idx].score + 0.1, 0.99),
          });
        }
      }
      if (reranked.length > 0) {
        console.log(`[RAG] Semantic re-ranking: ${results.length} → ${reranked.length} results`);
        return reranked.slice(0, topK);
      }
    } catch {}
    return null;
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
  ): Promise<{
    results: Array<{ chunk: KnowledgeChunk; score: number; source: string }>;
    extractedAnswer?: string;
    meta?: { topScore: number; avgScore: number; confidence: number; sourcesCount: number };
  }> {
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

    const avgScore = allResults.length > 0
      ? allResults.reduce((sum, r) => sum + r.score, 0) / allResults.length
      : 0;
    const LOW_CONFIDENCE_THRESHOLD = 0.5;

    if (avgScore < LOW_CONFIDENCE_THRESHOLD && allResults.length > 0 && reasoningMode !== 'quick') {
      console.log(`[RAG Enhanced] Low confidence (avg: ${avgScore.toFixed(3)}), attempting reformulated search`);
      try {
        const openai = await getOpenAIClient();
        const reformulateResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "The original search query returned low-relevance results. Reformulate it into 2 simpler, more specific keyword-based queries. Return ONLY the queries, one per line."
            },
            { role: "user", content: query }
          ],
          temperature: 0.2,
          max_tokens: 100,
        });

        const reformulated = reformulateResponse.choices[0]?.message?.content?.trim()
          ?.split('\n')
          .map(l => l.trim())
          .filter(l => l.length > 3 && l.length < 150) || [];

        if (reformulated.length > 0) {
          const retryResults = await Promise.all(
            reformulated.map(q => this.searchKnowledge(q, knowledgeBaseIds, userId, maxResults))
          );
          const retryFlat = retryResults.flat();
          const retryBest = retryFlat.filter(r => r.score > avgScore);
          if (retryBest.length > 0) {
            console.log(`[RAG Enhanced] Reformulated search found ${retryBest.length} better results`);
            const combined = [...retryBest, ...allResults];
            const dedupRetry = new Map<string, typeof combined[0]>();
            for (const r of combined) {
              const k = r.chunk.id || r.chunk.chunkText.substring(0, 100);
              const existing = dedupRetry.get(k);
              if (!existing || r.score > existing.score) {
                dedupRetry.set(k, r);
              }
            }
            allResults = Array.from(dedupRetry.values())
              .sort((a, b) => b.score - a.score)
              .slice(0, maxResults);
          }
        }
      } catch (e: any) {
        console.log(`[RAG Enhanced] Reformulation failed (non-critical): ${e.message}`);
      }
    }

    let extractedAnswer: string | undefined;
    if (useAnswerExtraction && allResults.length > 0 && reasoningMode !== 'quick') {
      extractedAnswer = await this.extractAnswer(query, allResults);
    }

    const topScore = allResults[0]?.score || 0;
    const secondScore = allResults[1]?.score || 0;
    const scoreGap = Math.max(0, topScore - secondScore);
    const confidence = Math.max(
      0,
      Math.min(1, topScore * 0.75 + avgScore * 0.2 + Math.min(scoreGap, 0.2) * 0.25)
    );

    console.log(`[RAG Enhanced] Final: ${allResults.length} results (top: ${topScore.toFixed(3)}, avg: ${avgScore.toFixed(3)}, conf: ${confidence.toFixed(3)}), answer extracted: ${!!extractedAnswer}`);

    return {
      results: allResults,
      extractedAnswer,
      meta: {
        topScore,
        avgScore,
        confidence,
        sourcesCount: allResults.length,
      },
    };
  }

  static buildDataSchemaContext(
    dataSchema: Array<{ name: string; type: string; description: string; required?: boolean }>,
    collectedData?: Record<string, string | null>
  ): string {
    if (!dataSchema || dataSchema.length === 0) return '';

    const lines: string[] = ['', 'DATA COLLECTION STATUS:'];
    const collected: string[] = [];
    const pending: string[] = [];

    for (const field of dataSchema) {
      const value = collectedData?.[field.name];
      if (value !== undefined && value !== null) {
        collected.push(`- ${field.name}: "${value}" (collected)`);
      } else {
        const requiredLabel = field.required ? ' [REQUIRED]' : '';
        pending.push(`- ${field.name} (${field.type}): ${field.description}${requiredLabel}`);
      }
    }

    if (collected.length > 0) {
      lines.push('Already collected:');
      lines.push(...collected);
    }

    if (pending.length > 0) {
      lines.push('Still needed:');
      lines.push(...pending);
      lines.push('Focus your responses on helping collect the missing information when relevant.');
    }

    if (pending.length === 0) {
      lines.push('All required data has been collected.');
    }

    lines.push('');
    return lines.join('\n');
  }

  static formatResultsForAgent(
    results: Array<{ chunk: KnowledgeChunk; score: number; source: string }>,
    maxTokens: number = 1500,
    dataSchemaContext?: string
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
    
    if (dataSchemaContext) {
      output += dataSchemaContext + '\n';
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

  private static sqlSearchMode: 'jsonb' | 'pgvector' | 'disabled' | undefined = undefined;

  private static pgvectorReady: boolean | null = null;
  private static pgvectorLastAttempt: number = 0;
  private static readonly PGVECTOR_RETRY_INTERVAL_MS = 60000;

  private static async ensurePgvectorColumn(): Promise<boolean> {
    if (this.pgvectorReady === true) return true;
    if (this.pgvectorReady === false) {
      const now = Date.now();
      if (now - this.pgvectorLastAttempt < this.PGVECTOR_RETRY_INTERVAL_MS) return false;
      this.pgvectorReady = null;
    }
    try {
      await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
      await db.execute(sql`ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS embedding_vec vector(1536)`);
      const migrated = await db.execute(sql`
        UPDATE knowledge_chunks
        SET embedding_vec = (
          SELECT array_agg(elem::float)::vector(1536)
          FROM jsonb_array_elements_text(embedding) AS elem
        )
        WHERE embedding IS NOT NULL
          AND embedding_vec IS NULL
          AND jsonb_typeof(embedding) = 'array'
          AND jsonb_array_length(embedding) = 1536
      `);
      const migratedCount = (migrated as any).rowCount || 0;
      if (migratedCount > 0) console.log(`[RAG] Migrated ${migratedCount} embeddings to pgvector column`);
      try {
        await db.execute(sql`
          CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding_vec
          ON knowledge_chunks USING hnsw (embedding_vec vector_cosine_ops)
          WITH (m = 16, ef_construction = 64)
        `);
      } catch (idxErr: any) {
        console.warn(`[RAG] HNSW index creation failed (will use sequential scan): ${idxErr.message}`);
        try {
          await db.execute(sql`
            CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding_vec_ivf
            ON knowledge_chunks USING ivfflat (embedding_vec vector_cosine_ops)
            WITH (lists = 50)
          `);
        } catch (ivfErr: any) {
          console.warn(`[RAG] IVFFlat index also failed: ${ivfErr.message}`);
        }
      }
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_user_kb
        ON knowledge_chunks (user_id, knowledge_base_id)
      `);
      try {
        await db.execute(sql`
          CREATE OR REPLACE FUNCTION sync_embedding_vec()
          RETURNS TRIGGER AS $$
          BEGIN
            IF NEW.embedding IS NOT NULL AND jsonb_typeof(NEW.embedding) = 'array' AND jsonb_array_length(NEW.embedding) = 1536 THEN
              NEW.embedding_vec := (
                SELECT array_agg(elem::float)::vector(1536)
                FROM jsonb_array_elements_text(NEW.embedding) AS elem
              );
            ELSE
              NEW.embedding_vec := NULL;
            END IF;
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql
        `);
        await db.execute(sql`
          DROP TRIGGER IF EXISTS trg_sync_embedding_vec ON knowledge_chunks
        `);
        await db.execute(sql`
          CREATE TRIGGER trg_sync_embedding_vec
          BEFORE INSERT OR UPDATE OF embedding ON knowledge_chunks
          FOR EACH ROW EXECUTE FUNCTION sync_embedding_vec()
        `);
        console.log(`[RAG] Created trigger for auto-syncing embedding_vec`);
      } catch (trigErr: any) {
        console.warn(`[RAG] Trigger creation failed (manual backfill needed): ${trigErr.message}`);
      }
      this.pgvectorReady = true;
      return true;
    } catch (e: any) {
      console.error(`[RAG] pgvector setup failed: ${e.message}`);
      this.pgvectorReady = false;
      this.pgvectorLastAttempt = Date.now();
      return false;
    }
  }

  static async backfillPgvectorEmbeddings(): Promise<number> {
    const hasPgvector = await this.ensurePgvectorColumn();
    if (!hasPgvector) return 0;
    const result = await db.execute(sql`
      UPDATE knowledge_chunks
      SET embedding_vec = (
        SELECT array_agg(elem::float)::vector(1536)
        FROM jsonb_array_elements_text(embedding) AS elem
      )
      WHERE embedding IS NOT NULL
        AND embedding_vec IS NULL
        AND jsonb_typeof(embedding) = 'array'
        AND jsonb_array_length(embedding) = 1536
    `);
    const count = (result as any).rowCount || 0;
    if (count > 0) console.log(`[RAG] Backfilled ${count} pgvector embeddings`);
    return count;
  }

  private static async sqlCosineSearch(
    queryEmbedding: number[],
    knowledgeBaseIds: string[],
    userId: string,
    limit: number
  ): Promise<Array<{ chunk: KnowledgeChunk; score: number; source: string }>> {
    if (this.sqlSearchMode === 'disabled') {
      throw new Error('SQL search permanently disabled after repeated failures');
    }

    const hasPgvector = await this.ensurePgvectorColumn();

    if (hasPgvector) {
      if (this.sqlSearchMode !== 'pgvector') {
        this.sqlSearchMode = 'pgvector';
        console.log(`[RAG] Using pgvector cosine distance for vector search`);
      }

      try {
        const kbIdsArray = `{${knowledgeBaseIds.join(',')}}`;
        const embeddingStr = `[${queryEmbedding.join(',')}]`;

        const results = await db.execute(sql`
          SELECT kc.id, kc.knowledge_base_id, kc.user_id, kc.chunk_index,
                 kc.chunk_text, kc.token_count, kc.metadata, kc.created_at,
                 1 - (kc.embedding_vec <=> ${embeddingStr}::vector) AS cosine_score
          FROM knowledge_chunks kc
          WHERE kc.user_id = ${userId}
            AND kc.knowledge_base_id = ANY(${kbIdsArray}::text[])
            AND kc.embedding_vec IS NOT NULL
          ORDER BY kc.embedding_vec <=> ${embeddingStr}::vector ASC
          LIMIT ${limit}
        `);

        const rows = (results as any).rows || results;
        if (!Array.isArray(rows) || rows.length === 0) return [];

        return rows
          .filter((row: any) => row.cosine_score != null && parseFloat(row.cosine_score) >= MIN_VECTOR_RELEVANCE * 0.8)
          .map((row: any) => ({
            chunk: {
              id: row.id,
              knowledgeBaseId: row.knowledge_base_id,
              userId: row.user_id,
              chunkIndex: row.chunk_index,
              chunkText: row.chunk_text,
              embedding: null,
              tokenCount: row.token_count,
              metadata: row.metadata,
              createdAt: row.created_at,
            } as KnowledgeChunk,
            score: parseFloat(row.cosine_score),
            source: row.knowledge_base_id,
          }));
      } catch (pgvecErr: any) {
        console.warn(`[RAG] pgvector query failed, falling back to JSONB: ${pgvecErr.message}`);
      }
    }

    if (this.sqlSearchMode === undefined) {
      this.sqlSearchMode = 'jsonb';
      console.log(`[RAG] Using SQL JSONB cosine similarity for vector search (slow fallback)`);
    }

    const kbIdsArray = `{${knowledgeBaseIds.join(',')}}`;
    const embeddingJson = JSON.stringify(queryEmbedding);

    await db.execute(sql`SET LOCAL statement_timeout = '3000'`);
    const results = await db.execute(sql`
      SELECT kc.*,
        (
          SELECT sum(qe.val::float * de.val::float)
          FROM jsonb_array_elements_text(${embeddingJson}::jsonb) WITH ORDINALITY AS qe(val, idx),
               jsonb_array_elements_text(kc.embedding) WITH ORDINALITY AS de(val, idx)
          WHERE qe.idx = de.idx
        ) / NULLIF(
          sqrt((SELECT sum(power(v::float, 2)) FROM jsonb_array_elements_text(${embeddingJson}::jsonb) AS t(v))) *
          sqrt((SELECT sum(power(v::float, 2)) FROM jsonb_array_elements_text(kc.embedding) AS t(v))),
          0
        ) AS cosine_score
      FROM knowledge_chunks kc
      WHERE kc.user_id = ${userId}
        AND kc.knowledge_base_id = ANY(${kbIdsArray}::text[])
        AND kc.embedding IS NOT NULL
        AND jsonb_typeof(kc.embedding) = 'array'
        AND jsonb_array_length(kc.embedding) > 0
      ORDER BY cosine_score DESC NULLS LAST
      LIMIT ${limit}
    `);

    const rows = (results as any).rows || results;
    if (!Array.isArray(rows) || rows.length === 0) return [];

    return rows
      .filter((row: any) => row.cosine_score != null && parseFloat(row.cosine_score) >= MIN_VECTOR_RELEVANCE * 0.8)
      .map((row: any) => ({
        chunk: {
          id: row.id,
          knowledgeBaseId: row.knowledge_base_id,
          userId: row.user_id,
          chunkIndex: row.chunk_index,
          chunkText: row.chunk_text,
          embedding: row.embedding,
          tokenCount: row.token_count,
          metadata: row.metadata,
          createdAt: row.created_at,
        } as KnowledgeChunk,
        score: parseFloat(row.cosine_score),
        source: row.knowledge_base_id,
      }));
  }

  private static async sqlKeywordSearch(
    query: string,
    knowledgeBaseIds: string[],
    userId: string,
    limit: number
  ): Promise<KnowledgeChunk[]> {
    const queryTerms = query.toLowerCase().split(/\s+/)
      .filter(w => w.length > 2 && /^[\w\-]+$/i.test(w))
      .slice(0, 5);
    if (queryTerms.length === 0) return [];

    const searchPattern = `%${queryTerms.join('%')}%`;
    const kbIdsArray = `{${knowledgeBaseIds.join(',')}}`;

    try {
      const results = await db.execute(sql`
        SELECT kc.*
        FROM knowledge_chunks kc
        WHERE kc.user_id = ${userId}
          AND kc.knowledge_base_id = ANY(${kbIdsArray}::text[])
          AND kc.chunk_text ILIKE ${searchPattern}
        LIMIT ${limit}
      `);

      const rows = (results as any).rows || results;
      if (!Array.isArray(rows)) return [];

      return rows.map((row: any) => ({
        id: row.id,
        knowledgeBaseId: row.knowledge_base_id,
        userId: row.user_id,
        chunkIndex: row.chunk_index,
        chunkText: row.chunk_text,
        embedding: row.embedding,
        tokenCount: row.token_count,
        metadata: row.metadata,
        createdAt: row.created_at,
      } as KnowledgeChunk));
    } catch (e: any) {
      console.log(`[RAG] SQL keyword search failed: ${e.message}`);
      return [];
    }
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
