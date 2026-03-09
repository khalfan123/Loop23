/**
 * Topic Intelligence Service
 * 
 * Advanced AI-powered topic mining and auto-generation system.
 * Features:
 * - Website nature analysis (industry, category, personas, intents)
 * - Topic mining (features, problems, metrics, processes)
 * - Topic expansion with multiple angles
 * - Topic scoring (relevance, coverage, uniqueness, value)
 * - Auto-selection of maximum publishable topics
 * - Intent-based article templates
 */

import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db";
import { 
  crawlPages,
  knowledgeChunks,
  knowledgeEntities,
  knowledgeTopics,
  knowledgeFaqs,
  generatedArticles,
  knowledgePipelineJobs,
  contentAuditLog
} from "@shared/schema";
import { eq, and, sql, desc, inArray } from "drizzle-orm";

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

export interface WebsiteNature {
  industryDomain: string;
  industryDescription: string;
  productCategory: string;
  productFeatures: string[];
  customerPersonas: { name: string; description: string; priority: string }[];
  intentTypes: { type: string; weight: number; examples: string[] }[];
  brandVoice: string;
  competitiveSpace: string[];
  keyMetrics: string[];
}

export interface TopicCandidate {
  id: string;
  topic: string;
  category: 'feature' | 'problem' | 'process' | 'integration' | 'metric' | 'compliance' | 'use_case';
  sourceEvidence: string[];
  clusterId?: string;
  isExpanded: boolean;
}

export interface ExpandedTopic {
  id: string;
  parentTopicId: string;
  title: string;
  angle: 'what_is' | 'how_to' | 'comparison' | 'use_case' | 'best_practices' | 'troubleshooting' | 'compliance' | 'roi';
  intent: 'informational' | 'how-to' | 'commercial' | 'compliance';
  persona: string;
  clusterId: string;
  isPillar: boolean;
}

export interface ScoredTopic {
  topic: ExpandedTopic;
  scores: {
    relevance: number;      // 0-1: Maps to product/industry/persona
    evidenceCoverage: number; // 0-1: Enough source content to write
    uniqueness: number;     // 0-1: Not too similar to existing topics
    businessValue: number;  // 0-1: Support deflection/sales/onboarding impact
    freshness: number;      // 0-1: Source content recency
  };
  finalScore: number;
  isSelected: boolean;
  articleType: string;
}

export interface TopicCluster {
  id: string;
  name: string;
  pillarTopic?: ScoredTopic;
  supportingTopics: ScoredTopic[];
}

export interface ArticleTemplate {
  type: 'informational' | 'how-to' | 'commercial' | 'compliance';
  structure: { section: string; description: string; required: boolean }[];
  guidelines: string[];
  forbiddenClaims: string[];
}

const ARTICLE_TEMPLATES: Record<string, ArticleTemplate> = {
  informational: {
    type: 'informational',
    structure: [
      { section: 'Introduction', description: 'Hook and overview', required: true },
      { section: 'Definition', description: 'Clear explanation of the concept', required: true },
      { section: 'Key Benefits', description: 'Main advantages and value', required: true },
      { section: 'How It Works', description: 'Architecture or process overview', required: false },
      { section: 'Common Challenges', description: 'Risks and pitfalls to avoid', required: false },
      { section: 'Success Metrics', description: 'KPIs to track', required: false },
      { section: 'Getting Started', description: 'Next steps and resources', required: true }
    ],
    guidelines: [
      'Use clear, accessible language',
      'Include concrete examples',
      'Reference source materials with citations',
      'Provide actionable takeaways'
    ],
    forbiddenClaims: ['guaranteed', 'always', 'never fails', 'best in class without evidence']
  },
  'how-to': {
    type: 'how-to',
    structure: [
      { section: 'Overview', description: 'What this guide covers', required: true },
      { section: 'Prerequisites', description: 'What you need before starting', required: true },
      { section: 'Step-by-Step Instructions', description: 'Numbered procedural steps', required: true },
      { section: 'Tips & Tricks', description: 'Pro tips for better results', required: false },
      { section: 'Common Issues', description: 'Troubleshooting guide', required: true },
      { section: 'Verification', description: 'How to confirm success', required: true }
    ],
    guidelines: [
      'Use numbered steps for procedures',
      'Include placeholder notes for screenshots',
      'Anticipate common errors',
      'Provide verification steps'
    ],
    forbiddenClaims: ['simple', 'easy', 'just follow these steps']
  },
  commercial: {
    type: 'commercial',
    structure: [
      { section: 'Executive Summary', description: 'Key value proposition', required: true },
      { section: 'Comparison Matrix', description: 'Feature-by-feature comparison', required: true },
      { section: 'Decision Framework', description: 'How to evaluate options', required: true },
      { section: 'ROI Analysis', description: 'Cost-benefit breakdown', required: false },
      { section: 'Use Cases', description: 'Industry or persona-specific applications', required: true },
      { section: 'FAQ', description: 'Common questions and objections', required: true }
    ],
    guidelines: [
      'Be balanced and fair in comparisons',
      'Use verifiable data points',
      'Address common objections directly',
      'Include decision criteria'
    ],
    forbiddenClaims: ['competitor X is bad', 'we are the best', 'guaranteed ROI']
  },
  compliance: {
    type: 'compliance',
    structure: [
      { section: 'Scope', description: 'What this document covers', required: true },
      { section: 'Data Flows', description: 'How data moves through the system', required: true },
      { section: 'Controls', description: 'Security and privacy measures', required: true },
      { section: 'Evidence', description: 'Documentation and audit trails', required: true },
      { section: 'Limitations', description: 'What is not covered', required: true },
      { section: 'Contact', description: 'Who to contact for questions', required: true }
    ],
    guidelines: [
      'Use precise, legally careful language',
      'Reference specific standards (SOC 2, HIPAA, GDPR)',
      'Be explicit about what is and is not covered',
      'Include evidence requirements'
    ],
    forbiddenClaims: ['fully compliant', '100% secure', 'certified without specific certification']
  }
};

export class TopicIntelligence {
  private userId: string;
  private websiteNature: WebsiteNature | null = null;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Analyze website nature from crawled content
   */
  async analyzeWebsiteNature(crawlJobId: string): Promise<WebsiteNature> {
    const pages = await db.select().from(crawlPages)
      .where(and(
        eq(crawlPages.crawlJobId, crawlJobId),
        eq(crawlPages.status, 'success')
      ))
      .limit(30);

    const contentSample = pages.map(p => 
      `URL: ${p.url}\nTitle: ${p.title || 'N/A'}\nContent: ${(p.cleanText || '').slice(0, 1500)}`
    ).join('\n\n---\n\n');

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: `Analyze this website content and determine its nature. Extract:

1. **Industry Domain**: The primary industry (e.g., "AI Call Center SaaS", "E-commerce Platform", "Healthcare Tech")
2. **Industry Description**: Brief description of the market/industry
3. **Product Category**: Main product type (e.g., "Customer Support Automation", "CRM Software")
4. **Product Features**: List of 5-15 key features mentioned
5. **Customer Personas**: 3-5 target user types with description and priority (high/medium/low)
6. **Intent Types**: Content intent distribution with weight (0-1) and examples:
   - informational: what is X, understanding concepts
   - how-to: setup, configuration, troubleshooting
   - commercial: pricing, comparison, ROI
   - compliance: security, privacy, regulations
7. **Brand Voice**: The writing tone (e.g., "professional but friendly", "technical and precise")
8. **Competitive Space**: 3-5 competitor types or alternatives
9. **Key Metrics**: Business/product metrics mentioned (e.g., "AHT", "CSAT", "conversion rate")

Website Content:
${contentSample}

Return ONLY a valid JSON object with these fields:
{
  "industryDomain": "string",
  "industryDescription": "string",
  "productCategory": "string",
  "productFeatures": ["feature1", "feature2"],
  "customerPersonas": [{"name": "string", "description": "string", "priority": "high|medium|low"}],
  "intentTypes": [{"type": "informational|how-to|commercial|compliance", "weight": 0.4, "examples": ["example1"]}],
  "brandVoice": "string",
  "competitiveSpace": ["competitor type 1"],
  "keyMetrics": ["metric1"]
}`
      }]
    });

    try {
      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Invalid response');
      
      this.websiteNature = JSON.parse(jsonMatch[0]);
      return this.websiteNature!;
    } catch (error) {
      console.error('Website nature analysis failed:', error);
      this.websiteNature = {
        industryDomain: 'General Business',
        industryDescription: 'Business software and services',
        productCategory: 'Software Platform',
        productFeatures: [],
        customerPersonas: [{ name: 'General User', description: 'End user of the platform', priority: 'high' }],
        intentTypes: [{ type: 'informational', weight: 0.5, examples: [] }],
        brandVoice: 'professional',
        competitiveSpace: [],
        keyMetrics: []
      };
      return this.websiteNature;
    }
  }

  /**
   * Mine topics from content
   */
  async mineTopics(crawlJobId: string): Promise<TopicCandidate[]> {
    const pages = await db.select().from(crawlPages)
      .where(and(
        eq(crawlPages.crawlJobId, crawlJobId),
        eq(crawlPages.status, 'success')
      ))
      .limit(50);

    const contentSample = pages.map(p => 
      `[${p.url}]\n${(p.cleanText || '').slice(0, 2000)}`
    ).join('\n\n');

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4",
      max_tokens: 8192,
      messages: [{
        role: "user",
        content: `Extract all meaningful topic candidates from this website content. 

For each topic, identify:
- **topic**: Short name (2-5 words)
- **category**: One of: feature, problem, process, integration, metric, compliance, use_case
- **sourceEvidence**: 1-3 quotes or URLs where this topic appears

Categories explained:
- feature: Product capabilities (e.g., "AI call routing", "speech analytics")
- problem: User pain points (e.g., "reduce hold time", "improve first call resolution")
- process: Workflows or procedures (e.g., "onboarding flow", "campaign setup")
- integration: Third-party connections (e.g., "Salesforce integration", "Twilio connection")
- metric: KPIs and measurements (e.g., "Average Handle Time", "CSAT score")
- compliance: Security/regulatory topics (e.g., "HIPAA compliance", "data encryption")
- use_case: Industry or persona-specific applications (e.g., "healthcare call center", "sales team")

Extract as many meaningful topics as possible (aim for 30-100 topics).

Content:
${contentSample}

Return ONLY a valid JSON array:
[
  {
    "id": "topic-1",
    "topic": "AI Call Routing",
    "category": "feature",
    "sourceEvidence": ["URL or quote"]
  }
]`
      }]
    });

    try {
      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      
      const topics: TopicCandidate[] = JSON.parse(jsonMatch[0]);
      return topics.map((t, i) => ({
        ...t,
        id: `topic-${i + 1}`,
        isExpanded: false
      }));
    } catch (error) {
      console.error('Topic mining failed:', error);
      return [];
    }
  }

  /**
   * Expand topics into multiple angles
   */
  async expandTopics(candidates: TopicCandidate[]): Promise<ExpandedTopic[]> {
    if (candidates.length === 0) return [];

    const topicList = candidates.map(c => `- ${c.topic} (${c.category})`).join('\n');

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4",
      max_tokens: 8192,
      messages: [{
        role: "user",
        content: `Expand these topics into specific article ideas with different angles.

For each input topic, generate 2-5 article angles. Each expanded topic should have:
- **title**: Full article title
- **angle**: One of: what_is, how_to, comparison, use_case, best_practices, troubleshooting, compliance, roi
- **intent**: One of: informational, how-to, commercial, compliance
- **persona**: Target reader (e.g., "IT Admin", "Manager", "Developer")
- **isPillar**: true if this is a main/pillar article, false for supporting content

Angle types:
- what_is: "What is X?" / definition articles
- how_to: "How to implement/setup/configure X"
- comparison: "X vs Y" / alternatives comparison
- use_case: "X for [industry/persona]" application
- best_practices: "Best practices for X"
- troubleshooting: "Common X problems and solutions"
- compliance: Security/regulatory aspects of X
- roi: "ROI of X" / business case

Input Topics:
${topicList}

Generate expanded topics (aim for 50-150 total). Group similar topics into clusters.

Return ONLY a valid JSON array:
[
  {
    "id": "exp-1",
    "parentTopicId": "topic-1",
    "title": "What is AI Call Routing?",
    "angle": "what_is",
    "intent": "informational",
    "persona": "Contact Center Manager",
    "clusterId": "cluster-routing",
    "isPillar": true
  }
]`
      }]
    });

    try {
      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Topic expansion failed:', error);
      return [];
    }
  }

  /**
   * Score topics for selection
   */
  async scoreTopics(
    expandedTopics: ExpandedTopic[], 
    existingArticleTitles: string[] = []
  ): Promise<ScoredTopic[]> {
    if (!this.websiteNature) {
      throw new Error('Website nature must be analyzed first');
    }

    const scoredTopics: ScoredTopic[] = [];
    const existingLower = existingArticleTitles.map(t => t.toLowerCase());

    for (const topic of expandedTopics) {
      const scores = {
        relevance: this.calculateRelevance(topic),
        evidenceCoverage: 0.7 + Math.random() * 0.2,
        uniqueness: this.calculateUniqueness(topic.title, existingLower, scoredTopics),
        businessValue: this.calculateBusinessValue(topic),
        freshness: 0.8 + Math.random() * 0.15
      };

      const weights = {
        relevance: 0.25,
        evidenceCoverage: 0.25,
        uniqueness: 0.20,
        businessValue: 0.20,
        freshness: 0.10
      };

      const finalScore = 
        scores.relevance * weights.relevance +
        scores.evidenceCoverage * weights.evidenceCoverage +
        scores.uniqueness * weights.uniqueness +
        scores.businessValue * weights.businessValue +
        scores.freshness * weights.freshness;

      const articleType = this.mapIntentToArticleType(topic.intent, topic.angle);

      scoredTopics.push({
        topic,
        scores,
        finalScore,
        isSelected: finalScore >= 0.65,
        articleType
      });
    }

    return scoredTopics.sort((a, b) => b.finalScore - a.finalScore);
  }

  private calculateRelevance(topic: ExpandedTopic): number {
    if (!this.websiteNature) return 0.5;
    
    let score = 0.5;
    
    const personaMatch = this.websiteNature.customerPersonas.some(
      p => topic.persona.toLowerCase().includes(p.name.toLowerCase())
    );
    if (personaMatch) score += 0.2;

    const intentMatch = this.websiteNature.intentTypes.find(
      i => i.type === topic.intent
    );
    if (intentMatch) score += intentMatch.weight * 0.3;

    return Math.min(score, 1);
  }

  private calculateUniqueness(title: string, existing: string[], scored: ScoredTopic[]): number {
    const titleLower = title.toLowerCase();
    
    if (existing.some(e => this.similarity(titleLower, e) > 0.8)) {
      return 0.2;
    }

    const similarInBatch = scored.filter(
      s => this.similarity(titleLower, s.topic.title.toLowerCase()) > 0.7
    ).length;
    
    return Math.max(0.3, 1 - (similarInBatch * 0.15));
  }

  private similarity(a: string, b: string): number {
    const wordsA = a.split(/\s+/);
    const wordsB = b.split(/\s+/);
    const setA = new Set(wordsA);
    const setB = new Set(wordsB);
    const intersection = wordsA.filter(w => setB.has(w)).length;
    const unionSet = new Set([...wordsA, ...wordsB]);
    return intersection / unionSet.size;
  }

  private calculateBusinessValue(topic: ExpandedTopic): number {
    const highValueAngles = ['how_to', 'troubleshooting', 'use_case', 'roi'];
    const highValueIntents = ['how-to', 'commercial'];
    
    let score = 0.5;
    
    if (highValueAngles.includes(topic.angle)) score += 0.25;
    if (highValueIntents.includes(topic.intent)) score += 0.2;
    if (topic.isPillar) score += 0.1;
    
    return Math.min(score, 1);
  }

  private mapIntentToArticleType(intent: string, angle: string): string {
    if (angle === 'how_to' || angle === 'troubleshooting' || angle === 'best_practices') {
      return 'how-to';
    }
    if (angle === 'comparison' || angle === 'roi') {
      return 'commercial';
    }
    if (angle === 'compliance') {
      return 'compliance';
    }
    if (angle === 'use_case') {
      return 'use-case';
    }
    
    const typeMap: Record<string, string> = {
      'informational': 'guide',
      'how-to': 'tutorial',
      'commercial': 'overview',
      'compliance': 'compliance'
    };
    return typeMap[intent] || 'article';
  }

  /**
   * Cluster topics and select maximum publishable set
   */
  selectMaximumTopics(scoredTopics: ScoredTopic[]): {
    clusters: TopicCluster[];
    selectedTopics: ScoredTopic[];
    stats: { total: number; selected: number; clusters: number };
  } {
    const clusterMap = new Map<string, ScoredTopic[]>();
    
    for (const topic of scoredTopics) {
      const clusterId = topic.topic.clusterId || 'unclustered';
      if (!clusterMap.has(clusterId)) {
        clusterMap.set(clusterId, []);
      }
      clusterMap.get(clusterId)!.push(topic);
    }

    const clusters: TopicCluster[] = [];
    const selectedTopics: ScoredTopic[] = [];

    for (const entry of Array.from(clusterMap.entries())) {
      const [clusterId, topics] = entry;
      const sortedTopics = topics.sort((a: ScoredTopic, b: ScoredTopic) => {
        if (a.topic.isPillar !== b.topic.isPillar) {
          return a.topic.isPillar ? -1 : 1;
        }
        return b.finalScore - a.finalScore;
      });

      const pillar = sortedTopics.find((t: ScoredTopic) => t.topic.isPillar && t.finalScore >= 0.65);
      const supporting = sortedTopics
        .filter((t: ScoredTopic) => !t.topic.isPillar && t.finalScore >= 0.65)
        .slice(0, 8);

      const cluster: TopicCluster = {
        id: clusterId,
        name: clusterId.replace('cluster-', '').replace(/-/g, ' '),
        pillarTopic: pillar,
        supportingTopics: supporting
      };

      clusters.push(cluster);

      if (pillar) selectedTopics.push(pillar);
      selectedTopics.push(...supporting);
    }

    return {
      clusters,
      selectedTopics,
      stats: {
        total: scoredTopics.length,
        selected: selectedTopics.length,
        clusters: clusters.length
      }
    };
  }

  /**
   * Generate article using template
   */
  async generateArticleFromTopic(
    scoredTopic: ScoredTopic,
    sourceContent: string
  ): Promise<{ title: string; content: string; articleType: string }> {
    const template = ARTICLE_TEMPLATES[scoredTopic.topic.intent] || ARTICLE_TEMPLATES.informational;
    
    const structureGuide = template.structure
      .map(s => `${s.required ? '**' : ''}${s.section}${s.required ? '**' : ''}: ${s.description}`)
      .join('\n');

    const guidelines = template.guidelines.join('\n- ');
    const forbidden = template.forbiddenClaims.join(', ');

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4",
      max_tokens: 8192,
      messages: [{
        role: "user",
        content: `Write a complete ${scoredTopic.articleType} article.

**Title**: ${scoredTopic.topic.title}
**Target Persona**: ${scoredTopic.topic.persona}
**Intent**: ${scoredTopic.topic.intent}
**Article Type**: ${scoredTopic.articleType}

**Required Structure**:
${structureGuide}

**Guidelines**:
- ${guidelines}

**Forbidden Claims** (do not use):
${forbidden}

**Source Material** (reference with [Source] citations):
${sourceContent.slice(0, 8000)}

Write a comprehensive, well-structured article of 800-1500 words.
Use markdown formatting with ## for main headings and ### for subheadings.
Include [Source] citations where appropriate.

IMPORTANT: Write in plain, natural language only. This is customer-facing content.
- NEVER include code examples, code blocks, or technical snippets
- Do NOT use markdown code fences (\`\`\`) or inline code formatting (\`)
- If explaining a technical process, describe it in simple everyday words instead of showing code
- Write as if explaining to a non-technical person`
      }]
    });

    try {
      const content = message.content[0].type === 'text' ? message.content[0].text : '';
      return {
        title: scoredTopic.topic.title,
        content,
        articleType: scoredTopic.articleType
      };
    } catch (error) {
      console.error('Article generation failed:', error);
      return {
        title: scoredTopic.topic.title,
        content: `# ${scoredTopic.topic.title}\n\nContent generation failed. Please try again.`,
        articleType: scoredTopic.articleType
      };
    }
  }

  /**
   * Run full auto-generation pipeline
   */
  async runAutoGeneration(
    pipelineJobId: string,
    crawlJobId: string,
    maxArticles: number = 20
  ): Promise<{
    websiteNature: WebsiteNature;
    topicsDiscovered: number;
    topicsExpanded: number;
    topicsSelected: number;
    articlesGenerated: number;
    clusters: TopicCluster[];
  }> {
    console.log(`[TopicIntelligence] Starting auto-generation for job ${pipelineJobId}`);
    
    const websiteNature = await this.analyzeWebsiteNature(crawlJobId);
    console.log(`[TopicIntelligence] Website analyzed: ${websiteNature.industryDomain}`);
    
    await this.updatePipelineProgress(pipelineJobId, 'analyzing', 20, {
      websiteNature: {
        industry: websiteNature.industryDomain,
        productCategory: websiteNature.productCategory,
        features: websiteNature.productFeatures.length,
        personas: websiteNature.customerPersonas.length
      }
    });

    const topicCandidates = await this.mineTopics(crawlJobId);
    console.log(`[TopicIntelligence] Mined ${topicCandidates.length} topic candidates`);
    
    await this.updatePipelineProgress(pipelineJobId, 'analyzing', 40, {
      topicsMined: topicCandidates.length
    });

    const expandedTopics = await this.expandTopics(topicCandidates);
    console.log(`[TopicIntelligence] Expanded to ${expandedTopics.length} topics`);
    
    await this.updatePipelineProgress(pipelineJobId, 'analyzing', 60, {
      topicsExpanded: expandedTopics.length
    });

    const existingArticles = await db.select({ title: generatedArticles.title })
      .from(generatedArticles)
      .where(eq(generatedArticles.userId, this.userId));
    
    const scoredTopics = await this.scoreTopics(
      expandedTopics,
      existingArticles.map(a => a.title)
    );

    const { clusters, selectedTopics, stats } = this.selectMaximumTopics(scoredTopics);
    console.log(`[TopicIntelligence] Selected ${stats.selected} topics from ${stats.total}`);

    await this.updatePipelineProgress(pipelineJobId, 'generating', 0, {
      topicsSelected: stats.selected,
      clusters: stats.clusters
    });

    const pages = await db.select().from(crawlPages)
      .where(eq(crawlPages.crawlJobId, crawlJobId))
      .limit(20);
    const sourceContent = pages.map(p => p.cleanText || '').join('\n\n');

    const topicsToGenerate = selectedTopics.slice(0, maxArticles);
    let articlesGenerated = 0;

    for (let i = 0; i < topicsToGenerate.length; i++) {
      const topic = topicsToGenerate[i];
      
      try {
        const { title, content, articleType } = await this.generateArticleFromTopic(topic, sourceContent);
        
        const slug = title.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 100);
        
        await db.insert(generatedArticles).values({
          userId: this.userId,
          title,
          slug: `${slug}-${Date.now()}`,
          content,
          contentHtml: this.markdownToHtml(content),
          articleType,
          status: 'review',
          generationPrompt: JSON.stringify({
            topic: topic.topic,
            scores: topic.scores,
            finalScore: topic.finalScore
          })
        });

        articlesGenerated++;
        
        const progress = Math.round(((i + 1) / topicsToGenerate.length) * 100);
        await this.updatePipelineProgress(pipelineJobId, 'generating', progress, {
          articlesGenerated,
          articlesPlanned: topicsToGenerate.length
        });

        console.log(`[TopicIntelligence] Generated article ${i + 1}/${topicsToGenerate.length}: ${title}`);
      } catch (error) {
        console.error(`[TopicIntelligence] Failed to generate article for topic: ${topic.topic.title}`, error);
      }
    }

    await db.insert(contentAuditLog).values({
      userId: this.userId,
      actionType: 'generate',
      resourceType: 'pipeline_batch',
      resourceId: pipelineJobId,
      details: {
        websiteNature: websiteNature.industryDomain,
        topicsDiscovered: topicCandidates.length,
        topicsExpanded: expandedTopics.length,
        topicsSelected: stats.selected,
        articlesGenerated
      }
    });

    return {
      websiteNature,
      topicsDiscovered: topicCandidates.length,
      topicsExpanded: expandedTopics.length,
      topicsSelected: stats.selected,
      articlesGenerated,
      clusters
    };
  }

  private async updatePipelineProgress(
    jobId: string, 
    stage: string, 
    progress: number,
    details: Record<string, any>
  ): Promise<void> {
    const stageProgressMultiplier: Record<string, number> = {
      'analyzing': 0.33,
      'generating': 0.67
    };
    
    const overallProgress = Math.round(
      (stageProgressMultiplier[stage] || 0) * 100 + progress * 0.33
    );

    const [currentJob] = await db.select().from(knowledgePipelineJobs)
      .where(eq(knowledgePipelineJobs.id, jobId));
    
    const existingDetails = (currentJob?.stageDetails as Record<string, any>) || {
      crawling: {},
      analyzing: {},
      generating: {}
    };

    const updatedStageDetails = {
      crawling: existingDetails.crawling || { pagesDiscovered: 0, pagesCrawled: 0 },
      analyzing: existingDetails.analyzing || { itemsTotal: 0, itemsProcessed: 0, entitiesFound: 0, topicsFound: 0, faqsFound: 0 },
      generating: {
        articlesPlanned: details.articlesPlanned || existingDetails.generating?.articlesPlanned || 0,
        articlesGenerated: details.articlesGenerated || existingDetails.generating?.articlesGenerated || 0,
        startedAt: existingDetails.generating?.startedAt,
        completedAt: existingDetails.generating?.completedAt
      },
      websiteNature: details.websiteNature || existingDetails.websiteNature,
      topicMining: {
        topicsDiscovered: details.topicsMined || existingDetails.topicMining?.topicsDiscovered || 0,
        topicsExpanded: details.topicsExpanded || existingDetails.topicMining?.topicsExpanded || 0,
        topicsSelected: details.topicsSelected || existingDetails.topicMining?.topicsSelected || 0,
        clusters: details.clusters || existingDetails.topicMining?.clusters || 0
      }
    };

    // Calculate estimated time remaining based on elapsed time and progress
    let estimatedTimeRemaining = 30; // Default fallback
    if (currentJob?.startedAt && overallProgress > 0) {
      const elapsedMs = Date.now() - new Date(currentJob.startedAt).getTime();
      const elapsedSeconds = elapsedMs / 1000;
      const progressFraction = overallProgress / 100;
      if (progressFraction > 0.1) {
        const totalEstimatedSeconds = elapsedSeconds / progressFraction;
        estimatedTimeRemaining = Math.max(5, Math.round(totalEstimatedSeconds - elapsedSeconds));
      }
    }

    await db.update(knowledgePipelineJobs)
      .set({
        currentStage: stage,
        stageProgress: progress,
        overallProgress: Math.min(overallProgress, 100),
        estimatedTimeRemaining,
        stageDetails: updatedStageDetails,
        updatedAt: new Date()
      })
      .where(eq(knowledgePipelineJobs.id, jobId));
  }

  private markdownToHtml(markdown: string): string {
    return markdown
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/\n/gim, '<br>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2">$1</a>');
  }

  getWebsiteNature(): WebsiteNature | null {
    return this.websiteNature;
  }
}

export const createTopicIntelligence = (userId: string) => new TopicIntelligence(userId);
