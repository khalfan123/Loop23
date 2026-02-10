import OpenAI from "openai";
import { db } from "../db";
import { 
  knowledgeBase, knowledgeChunks, knowledgeFaqs, knowledgeEntities, 
  knowledgeTopics, knowledgeTopicAssignments, knowledgeProcessingQueue,
  globalSettings
} from "@shared/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

const EMBEDDING_MODEL = "text-embedding-3-small";

let openaiClient: OpenAI | null = null;
let lastApiKey: string | null = null;

async function getOpenAIApiKey(): Promise<string> {
  try {
    const [dbSetting] = await db
      .select()
      .from(globalSettings)
      .where(eq(globalSettings.key, 'openai_api_key'))
      .limit(1);
    if (dbSetting?.value) {
      return dbSetting.value as string;
    }
  } catch (e) {}
  
  const envKey = process.env.OPENAI_API_KEY;
  if (!envKey) throw new Error("No OpenAI API key found");
  return envKey;
}

async function getOpenAIClient(): Promise<OpenAI> {
  const apiKey = await getOpenAIApiKey();
  
  if (!openaiClient || lastApiKey !== apiKey) {
    openaiClient = new OpenAI({ apiKey });
    lastApiKey = apiKey;
  }
  
  return openaiClient;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const openai = await getOpenAIClient();
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.substring(0, 8000),
  });
  return response.data[0].embedding;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export class KBEnhancedProcessor {

  static cleanWebContent(rawContent: string, title: string): string {
    let cleaned = rawContent;
    
    cleaned = cleaned.replace(/Sign\s*(Out|In)\s*/gi, '');
    
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
    cleaned = cleaned.replace(/\{[^}]*\}/g, '');
    cleaned = cleaned.replace(/[.#@][a-zA-Z][\w-]*\s*\{[^}]*\}/g, '');
    
    cleaned = cleaned.replace(/(Home|About|Contact|Blog|Careers|Sign In|Login|Register|Sign Up|Menu|Navigation|Footer|Copyright|©.*$)/gim, '');
    
    cleaned = cleaned.replace(/https?:\/\/[^\s)]+/g, '');
    
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    cleaned = cleaned.replace(/\s{3,}/g, ' ');
    cleaned = cleaned.trim();
    
    const titlePrefix = title.replace(/ - Tejwal eSIM$/, '');
    if (cleaned.startsWith(title)) {
      cleaned = cleaned.substring(title.length).trim();
    } else if (cleaned.startsWith(titlePrefix)) {
      cleaned = cleaned.substring(titlePrefix.length).trim();
    }
    
    return cleaned;
  }

  static isUselessContent(content: string, title: string): boolean {
    if (!content || content.trim().length < 50) return true;
    if (title.includes('.css') || title.includes('.js') || title.includes('favicon') || title.includes('manifest.json')) return true;
    
    const codeRatio = (content.match(/[{};:]/g) || []).length / content.length;
    if (codeRatio > 0.05) return true;
    
    return false;
  }

  static async deduplicateEntries(entries: Array<{id: string; title: string; content: string}>): Promise<Array<{id: string; title: string; content: string}>> {
    const grouped = new Map<string, Array<{id: string; title: string; content: string}>>();
    
    for (const entry of entries) {
      const key = entry.title.trim().toLowerCase();
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(entry);
    }
    
    const deduplicated: Array<{id: string; title: string; content: string}> = [];
    grouped.forEach((group) => {
      group.sort((a: {id: string; title: string; content: string}, b: {id: string; title: string; content: string}) => b.content.length - a.content.length);
      deduplicated.push(group[0]);
    });
    
    return deduplicated;
  }

  static semanticChunk(content: string, title: string, maxChunkChars: number = 1500): Array<{text: string; heading: string; index: number}> {
    const chunks: Array<{text: string; heading: string; index: number}> = [];
    
    const sectionPatterns = [
      /(?=\n\d+\.\s+[A-Z])/g,
      /(?=\n[A-Z][^.!?\n]{5,50}\n)/g,
      /(?=\n(?:How|What|Why|When|Where|Can|Do|Is|Are)\s[^?\n]+\?)/gi,
    ];
    
    let sections: string[] = [];
    
    for (const pattern of sectionPatterns) {
      const splits = content.split(pattern).filter(s => s.trim().length > 20);
      if (splits.length > 1) {
        sections = splits;
        break;
      }
    }
    
    if (sections.length <= 1) {
      sections = content.split(/\n\n+/).filter(s => s.trim().length > 20);
    }
    
    if (sections.length <= 1) {
      let start = 0;
      const text = content;
      let idx = 0;
      while (start < text.length) {
        let end = Math.min(start + maxChunkChars, text.length);
        if (end < text.length) {
          const lastPeriod = text.lastIndexOf('.', end);
          const lastQuestion = text.lastIndexOf('?', end);
          const breakPoint = Math.max(lastPeriod, lastQuestion);
          if (breakPoint > start + maxChunkChars / 3) {
            end = breakPoint + 1;
          }
        }
        const chunk = text.slice(start, end).trim();
        if (chunk.length > 20) {
          chunks.push({ text: chunk, heading: title, index: idx++ });
        }
        start = end;
      }
      return chunks;
    }
    
    let currentChunk = '';
    let currentHeading = title;
    let idx = 0;
    
    for (const section of sections) {
      const trimmed = section.trim();
      if (!trimmed) continue;
      
      const firstLine = trimmed.split('\n')[0].trim();
      const isHeading = firstLine.length < 80 && !firstLine.endsWith('.') && firstLine.length > 3;
      const heading = isHeading ? firstLine : currentHeading;
      
      if (currentChunk.length + trimmed.length > maxChunkChars && currentChunk.length > 100) {
        chunks.push({ text: currentChunk.trim(), heading: currentHeading, index: idx++ });
        currentChunk = trimmed;
        currentHeading = heading;
      } else {
        currentChunk += '\n\n' + trimmed;
        if (isHeading) currentHeading = heading;
      }
    }
    
    if (currentChunk.trim().length > 20) {
      chunks.push({ text: currentChunk.trim(), heading: currentHeading, index: idx });
    }
    
    return chunks;
  }

  static async extractFAQs(content: string, title: string, knowledgeBaseId: string, userId: string): Promise<Array<{question: string; answer: string; confidence: number}>> {
    try {
      const openai = await getOpenAIClient();
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a data extraction specialist. Extract all question-answer pairs from the provided content. Include both explicit Q&A (where questions are literally asked) and implicit Q&A (where the content answers a question that a customer would likely ask).

Return JSON in this format:
{
  "faqs": [
    {
      "question": "The question a customer might ask",
      "answer": "The accurate answer based ONLY on the content provided",
      "confidence": 0.95
    }
  ]
}

Rules:
- Only extract information that is explicitly stated in the content
- Do NOT make up or infer answers
- Set confidence: 0.9+ for explicitly stated Q&A, 0.7-0.9 for clearly implied Q&A, 0.5-0.7 for loosely implied
- Keep answers concise but complete
- Generate customer-friendly questions (how a caller would ask)
- Maximum 15 FAQs per content piece`
          },
          {
            role: "user",
            content: `Content from page "${title}":\n\n${content.substring(0, 6000)}`
          }
        ],
      });
      
      const parsed = JSON.parse(response.choices[0].message.content || '{"faqs":[]}');
      return parsed.faqs || [];
    } catch (error: any) {
      console.error(`[KB Enhanced] FAQ extraction error:`, error.message);
      return [];
    }
  }

  static async extractEntitiesAndTopics(content: string, title: string): Promise<{
    entities: Array<{name: string; type: string; description: string; aliases: string[]}>;
    topics: Array<{name: string; slug: string; description: string; keywords: string[]}>;
  }> {
    try {
      const openai = await getOpenAIClient();
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a data scientist extracting structured information from website content. Extract entities and topics.

Return JSON:
{
  "entities": [
    {
      "name": "Tejwal",
      "type": "product|company|feature|policy|service|location|concept",
      "description": "Brief description",
      "aliases": ["alternative names"]
    }
  ],
  "topics": [
    {
      "name": "eSIM Installation",
      "slug": "esim-installation",
      "description": "How to install and activate eSIM",
      "keywords": ["install", "activate", "setup", "QR code"]
    }
  ]
}

Rules:
- Extract real entities mentioned in the content (products, services, features, companies)
- Topics should be broad categories that group related content
- Slugs should be lowercase, hyphenated
- Keep it focused on what's actually in the content`
          },
          {
            role: "user",
            content: `Content from page "${title}":\n\n${content.substring(0, 6000)}`
          }
        ],
      });
      
      const parsed = JSON.parse(response.choices[0].message.content || '{"entities":[],"topics":[]}');
      return {
        entities: parsed.entities || [],
        topics: parsed.topics || [],
      };
    } catch (error: any) {
      console.error(`[KB Enhanced] Entity/topic extraction error:`, error.message);
      return { entities: [], topics: [] };
    }
  }

  static async processKnowledgeBasesEnhanced(
    knowledgeBaseIds: string[],
    userId: string,
    options: { skipIfProcessed?: boolean } = {}
  ): Promise<{
    processed: number;
    skipped: number;
    chunksCreated: number;
    faqsExtracted: number;
    entitiesFound: number;
    topicsFound: number;
    errors: string[];
  }> {
    const result = {
      processed: 0, skipped: 0, chunksCreated: 0,
      faqsExtracted: 0, entitiesFound: 0, topicsFound: 0,
      errors: [] as string[],
    };
    
    console.log(`[KB Enhanced] Starting enhanced processing for ${knowledgeBaseIds.length} knowledge bases`);
    
    const entries = await db
      .select()
      .from(knowledgeBase)
      .where(
        and(
          inArray(knowledgeBase.id, knowledgeBaseIds),
          eq(knowledgeBase.userId, userId)
        )
      );
    
    if (entries.length === 0) {
      console.log(`[KB Enhanced] No entries found`);
      return result;
    }
    
    const validEntries = entries.filter(e => !this.isUselessContent(e.content || '', e.title || ''));
    console.log(`[KB Enhanced] ${validEntries.length}/${entries.length} entries have useful content`);
    
    const deduped = await this.deduplicateEntries(
      validEntries.map(e => ({ id: e.id, title: e.title || '', content: e.content || '' }))
    );
    console.log(`[KB Enhanced] ${deduped.length} unique entries after deduplication`);
    
    const topicMap = new Map<string, string>();
    
    for (const entry of deduped) {
      try {
        if (options.skipIfProcessed) {
          const existingChunks = await db
            .select({ count: sql<number>`count(*)` })
            .from(knowledgeChunks)
            .where(eq(knowledgeChunks.knowledgeBaseId, entry.id));
          if (Number(existingChunks[0]?.count) > 0) {
            result.skipped++;
            continue;
          }
        }
        
        console.log(`[KB Enhanced] Processing: ${entry.title}`);
        
        const cleanedContent = this.cleanWebContent(entry.content, entry.title);
        if (cleanedContent.length < 30) {
          console.log(`[KB Enhanced] Skipping ${entry.title} - too short after cleaning`);
          result.skipped++;
          continue;
        }
        
        const semanticChunks = this.semanticChunk(cleanedContent, entry.title);
        console.log(`[KB Enhanced] Created ${semanticChunks.length} semantic chunks for "${entry.title}"`);
        
        for (const chunk of semanticChunks) {
          try {
            const embedding = await generateEmbedding(chunk.text);
            
            await db.insert(knowledgeChunks).values({
              knowledgeBaseId: entry.id,
              userId,
              chunkIndex: chunk.index,
              chunkText: chunk.text,
              embedding: embedding as any,
              tokenCount: estimateTokens(chunk.text),
              metadata: { 
                heading: chunk.heading, 
                sourceTitle: entry.title,
                enhancedProcessing: true 
              },
            });
            
            result.chunksCreated++;
          } catch (chunkError: any) {
            console.error(`[KB Enhanced] Chunk embedding error:`, chunkError.message);
            result.errors.push(`Chunk error for ${entry.title}: ${chunkError.message}`);
          }
          
          await new Promise(resolve => setTimeout(resolve, 150));
        }
        
        const faqs = await this.extractFAQs(cleanedContent, entry.title, entry.id, userId);
        for (const faq of faqs) {
          try {
            let faqEmbedding: number[] | null = null;
            try {
              faqEmbedding = await generateEmbedding(faq.question + ' ' + faq.answer);
            } catch (e) {}
            
            await db.insert(knowledgeFaqs).values({
              userId,
              knowledgeBaseId: entry.id,
              question: faq.question,
              answer: faq.answer,
              confidence: faq.confidence,
              isVerified: false,
              usageCount: 0,
              embedding: faqEmbedding as any,
            });
            
            result.faqsExtracted++;
          } catch (faqError: any) {
            console.error(`[KB Enhanced] FAQ storage error:`, faqError.message);
          }
          
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const { entities, topics } = await this.extractEntitiesAndTopics(cleanedContent, entry.title);
        
        for (const entity of entities) {
          try {
            await db.insert(knowledgeEntities).values({
              userId,
              knowledgeBaseId: entry.id,
              entityType: entity.type,
              name: entity.name,
              normalizedName: entity.name.toLowerCase().trim(),
              description: entity.description,
              aliases: entity.aliases,
              confidence: 0.8,
              mentionCount: 1,
            });
            result.entitiesFound++;
          } catch (entityError: any) {
            if (!entityError.message?.includes('duplicate')) {
              console.error(`[KB Enhanced] Entity storage error:`, entityError.message);
            }
          }
        }
        
        for (const topic of topics) {
          try {
            let topicId = topicMap.get(topic.slug);
            
            if (!topicId) {
              const [existing] = await db
                .select()
                .from(knowledgeTopics)
                .where(
                  and(
                    eq(knowledgeTopics.slug, topic.slug),
                    eq(knowledgeTopics.userId, userId)
                  )
                )
                .limit(1);
              
              if (existing) {
                topicId = existing.id;
                await db
                  .update(knowledgeTopics)
                  .set({ documentCount: sql`${knowledgeTopics.documentCount} + 1` })
                  .where(eq(knowledgeTopics.id, existing.id));
              } else {
                const [newTopic] = await db
                  .insert(knowledgeTopics)
                  .values({
                    userId,
                    name: topic.name,
                    slug: topic.slug,
                    description: topic.description,
                    keywords: topic.keywords,
                    level: 0,
                    documentCount: 1,
                    isAutoGenerated: true,
                  })
                  .returning();
                topicId = newTopic.id;
              }
              topicMap.set(topic.slug, topicId);
            }
            
            if (topicId) {
              try {
                await db.insert(knowledgeTopicAssignments).values({
                  topicId,
                  knowledgeBaseId: entry.id,
                  relevanceScore: 0.8,
                  isPrimary: topics.indexOf(topic) === 0,
                });
              } catch (assignError: any) {
                if (!assignError.message?.includes('duplicate')) {
                  console.error(`[KB Enhanced] Topic assignment error:`, assignError.message);
                }
              }
              result.topicsFound++;
            }
          } catch (topicError: any) {
            console.error(`[KB Enhanced] Topic storage error:`, topicError.message);
          }
        }
        
        result.processed++;
        console.log(`[KB Enhanced] Completed: ${entry.title} (${semanticChunks.length} chunks, ${faqs.length} FAQs)`);
        
      } catch (entryError: any) {
        console.error(`[KB Enhanced] Error processing ${entry.title}:`, entryError.message);
        result.errors.push(`${entry.title}: ${entryError.message}`);
      }
    }
    
    console.log(`[KB Enhanced] Processing complete:`, result);
    return result;
  }
}

export default KBEnhancedProcessor;
