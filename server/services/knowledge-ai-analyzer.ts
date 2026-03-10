/**
 * Knowledge AI Analyzer Service
 * 
 * Uses OpenAI and Anthropic Claude for intelligent content analysis.
 * Features:
 * - Entity extraction (people, organizations, products, concepts)
 * - Topic/taxonomy clustering
 * - FAQ detection
 * - Claim verification
 * - Knowledge graph construction
 */

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db";
import { 
  knowledgeBase,
  knowledgeChunks,
  knowledgeEntities,
  knowledgeTopics,
  knowledgeTopicAssignments,
  knowledgeFaqs,
  knowledgeGraphNodes,
  knowledgeGraphEdges,
  contentAuditLog,
  globalSettings
} from "@shared/schema";
import { eq, and, sql, ilike } from "drizzle-orm";

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
    throw new Error("OPENAI_API_KEY is required for AI analysis");
  }

  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

interface ExtractedEntity {
  type: string;
  name: string;
  description?: string;
  aliases?: string[];
  attributes?: Record<string, any>;
  confidence: number;
}

interface ExtractedTopic {
  name: string;
  description: string;
  keywords: string[];
  relevanceScore: number;
}

interface ExtractedFaq {
  question: string;
  answer: string;
  confidence: number;
}

interface GraphRelationship {
  sourceEntity: string;
  targetEntity: string;
  relationshipType: string;
  label: string;
  confidence: number;
}

/**
 * Knowledge AI Analyzer class
 */
export class KnowledgeAIAnalyzer {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Extract entities from content using Claude
   */
  async extractEntities(content: string, knowledgeBaseId?: string): Promise<ExtractedEntity[]> {
    const truncatedContent = content.slice(0, 15000);

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: `Analyze the following content and extract all named entities. For each entity, provide:
- type: one of (person, organization, product, feature, concept, location, date, technology)
- name: the entity name as it appears
- description: brief description if available
- aliases: alternative names or abbreviations
- confidence: 0.0 to 1.0

Return as JSON array. Only include entities with confidence >= 0.7.

Content:
${truncatedContent}

Return ONLY valid JSON array, no other text.`
      }]
    });

    try {
      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      
      const entities: ExtractedEntity[] = JSON.parse(jsonMatch[0]);
      
      for (const entity of entities) {
        const normalizedName = entity.name.toLowerCase().trim();
        
        const [existing] = await db.select().from(knowledgeEntities)
          .where(and(
            eq(knowledgeEntities.userId, this.userId),
            eq(knowledgeEntities.normalizedName, normalizedName)
          ))
          .limit(1);

        if (existing) {
          await db.update(knowledgeEntities)
            .set({
              mentionCount: sql`${knowledgeEntities.mentionCount} + 1`,
              updatedAt: new Date()
            })
            .where(eq(knowledgeEntities.id, existing.id));
        } else {
          await db.insert(knowledgeEntities).values({
            userId: this.userId,
            knowledgeBaseId,
            entityType: entity.type,
            name: entity.name,
            normalizedName,
            description: entity.description,
            aliases: entity.aliases,
            attributes: entity.attributes,
            confidence: entity.confidence
          });
        }
      }

      if (knowledgeBaseId) {
        await db.insert(contentAuditLog).values({
          userId: this.userId,
          actionType: 'extract',
          resourceType: 'knowledge_base',
          resourceId: knowledgeBaseId,
          details: { entitiesExtracted: entities.length }
        });
      }

      return entities;
    } catch (error) {
      console.error('Entity extraction failed:', error);
      return [];
    }
  }

  /**
   * Detect and cluster topics using Claude
   */
  async analyzeTopic(content: string, knowledgeBaseId: string): Promise<ExtractedTopic[]> {
    const truncatedContent = content.slice(0, 15000);

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: `Analyze the following content and identify the main topics it covers. For each topic:
- name: short topic name (2-4 words)
- description: brief description of what this topic covers
- keywords: list of 5-10 relevant keywords
- relevanceScore: 0.0 to 1.0 indicating how central this topic is to the content

Return as JSON array. Identify 1-5 main topics.

Content:
${truncatedContent}

Return ONLY valid JSON array, no other text.`
      }]
    });

    try {
      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      
      const topics: ExtractedTopic[] = JSON.parse(jsonMatch[0]);

      for (const topic of topics) {
        const slug = topic.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        
        let [existingTopic] = await db.select().from(knowledgeTopics)
          .where(and(
            eq(knowledgeTopics.userId, this.userId),
            eq(knowledgeTopics.slug, slug)
          ))
          .limit(1);

        if (!existingTopic) {
          [existingTopic] = await db.insert(knowledgeTopics).values({
            userId: this.userId,
            name: topic.name,
            slug,
            description: topic.description,
            keywords: topic.keywords,
            isAutoGenerated: true
          }).returning();
        }

        await db.update(knowledgeTopics)
          .set({ documentCount: sql`${knowledgeTopics.documentCount} + 1` })
          .where(eq(knowledgeTopics.id, existingTopic.id));

        await db.insert(knowledgeTopicAssignments).values({
          topicId: existingTopic.id,
          knowledgeBaseId,
          relevanceScore: topic.relevanceScore,
          isPrimary: topic.relevanceScore >= 0.8
        });
      }

      return topics;
    } catch (error) {
      console.error('Topic analysis failed:', error);
      return [];
    }
  }

  /**
   * Detect FAQs from content using Claude
   */
  async detectFaqs(content: string, knowledgeBaseId: string, sourceUrl?: string): Promise<ExtractedFaq[]> {
    const truncatedContent = content.slice(0, 15000);

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: `Analyze the following content and extract any question-answer pairs that could serve as FAQs. Look for:
- Explicit Q&A sections
- Implied questions that the content answers
- Common questions users might have based on the content

For each FAQ:
- question: the question in natural language
- answer: concise, complete answer
- confidence: 0.0 to 1.0

Return as JSON array. Only include FAQs with confidence >= 0.7.

Content:
${truncatedContent}

Return ONLY valid JSON array, no other text.`
      }]
    });

    try {
      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      
      const faqs: ExtractedFaq[] = JSON.parse(jsonMatch[0]);

      const openai = await getOpenAIClient();

      for (const faq of faqs) {
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: faq.question
        });

        await db.insert(knowledgeFaqs).values({
          userId: this.userId,
          knowledgeBaseId,
          question: faq.question,
          answer: faq.answer,
          sourceUrl,
          confidence: faq.confidence,
          embedding: embeddingResponse.data[0].embedding
        });
      }

      return faqs;
    } catch (error) {
      console.error('FAQ detection failed:', error);
      return [];
    }
  }

  /**
   * Build knowledge graph relationships using Claude
   */
  async buildKnowledgeGraph(knowledgeBaseId: string): Promise<void> {
    const entities = await db.select().from(knowledgeEntities)
      .where(eq(knowledgeEntities.knowledgeBaseId, knowledgeBaseId));

    if (entities.length < 2) return;

    const entityList = entities.map(e => `${e.name} (${e.entityType})`).join('\n');

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: `Given these entities, identify relationships between them:

${entityList}

For each relationship:
- sourceEntity: exact name of source entity
- targetEntity: exact name of target entity
- relationshipType: one of (is_a, has_part, related_to, works_for, uses, competes_with, owns, created_by, located_in)
- label: human-readable description
- confidence: 0.0 to 1.0

Return as JSON array. Only include relationships with confidence >= 0.7.

Return ONLY valid JSON array, no other text.`
      }]
    });

    try {
      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return;
      
      const relationships: GraphRelationship[] = JSON.parse(jsonMatch[0]);

      const entityMap = new Map(entities.map(e => [e.name.toLowerCase(), e]));

      for (const entity of entities) {
        const [existingNode] = await db.select().from(knowledgeGraphNodes)
          .where(eq(knowledgeGraphNodes.entityId, entity.id))
          .limit(1);

        if (!existingNode) {
          await db.insert(knowledgeGraphNodes).values({
            userId: this.userId,
            entityId: entity.id,
            nodeType: 'entity',
            label: entity.name,
            properties: { type: entity.entityType, description: entity.description }
          });
        }
      }

      const nodes = await db.select().from(knowledgeGraphNodes)
        .where(eq(knowledgeGraphNodes.userId, this.userId));
      const nodeMap = new Map<string, string>();
      for (const node of nodes) {
        const entity = entities.find(e => e.id === node.entityId);
        if (entity) {
          nodeMap.set(entity.name.toLowerCase(), node.id);
        }
      }

      for (const rel of relationships) {
        const sourceNodeId = nodeMap.get(rel.sourceEntity.toLowerCase());
        const targetNodeId = nodeMap.get(rel.targetEntity.toLowerCase());

        if (sourceNodeId && targetNodeId) {
          await db.insert(knowledgeGraphEdges).values({
            userId: this.userId,
            sourceNodeId,
            targetNodeId,
            relationshipType: rel.relationshipType,
            label: rel.label,
            confidence: rel.confidence
          });
        }
      }
    } catch (error) {
      console.error('Knowledge graph building failed:', error);
    }
  }

  /**
   * Analyze a knowledge base item completely
   */
  async analyzeKnowledgeBaseItem(knowledgeBaseId: string): Promise<{
    entities: number;
    topics: number;
    faqs: number;
  }> {
    const [item] = await db.select().from(knowledgeBase)
      .where(eq(knowledgeBase.id, knowledgeBaseId));

    if (!item?.content) {
      throw new Error('Knowledge base item not found or has no content');
    }

    const entities = await this.extractEntities(item.content, knowledgeBaseId);
    const topics = await this.analyzeTopic(item.content, knowledgeBaseId);
    const faqs = await this.detectFaqs(item.content, knowledgeBaseId, item.url || undefined);

    if (entities.length >= 2) {
      await this.buildKnowledgeGraph(knowledgeBaseId);
    }

    return {
      entities: entities.length,
      topics: topics.length,
      faqs: faqs.length
    };
  }

  /**
   * Find topic gaps - topics that might be missing coverage
   */
  async findTopicGaps(): Promise<{ topic: string; suggestion: string; priority: string }[]> {
    const topics = await db.select().from(knowledgeTopics)
      .where(eq(knowledgeTopics.userId, this.userId));

    const entities = await db.select().from(knowledgeEntities)
      .where(eq(knowledgeEntities.userId, this.userId));

    const topicNames = topics.map(t => t.name).join(', ');
    const entityNames = entities.slice(0, 50).map(e => e.name).join(', ');

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: `Based on these existing topics and entities in a knowledge base, identify potential gaps in coverage:

Existing Topics: ${topicNames || 'None'}
Key Entities: ${entityNames || 'None'}

Identify 3-5 topic gaps that might be missing. For each:
- topic: suggested topic name
- suggestion: what content should be added
- priority: high, medium, or low

Return as JSON array.`
      }]
    });

    try {
      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      
      return JSON.parse(jsonMatch[0]);
    } catch {
      return [];
    }
  }
}

export const createKnowledgeAIAnalyzer = (userId: string) => new KnowledgeAIAnalyzer(userId);
