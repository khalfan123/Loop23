/**
 * Knowledge Intelligence Routes
 * 
 * API routes for the enhanced Knowledge Base system.
 * Includes crawl management, AI analysis, and content generation.
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import { 
  crawlJobs, 
  crawlPages,
  knowledgeEntities,
  knowledgeTopics,
  knowledgeTopicAssignments,
  knowledgeFaqs,
  knowledgeGraphNodes,
  knowledgeGraphEdges,
  generatedArticles,
  contentAuditLog,
  knowledgeBase,
  knowledgeFolders,
  knowledgePipelineJobs,
  mlAnalysisJobs,
  mlConversationAnalyses,
  mlCommonIssues,
  mlTrainingSamples,
  mlTrainingStats,
  calls,
  campaigns,
  incomingConnections,
} from "@shared/schema";
import { RAGKnowledgeService } from "../services/rag-knowledge";
import { eq, and, desc, sql, count, or, isNotNull, gte, lte, type SQL } from "drizzle-orm";
import { createCrawler } from "../services/knowledge-crawler";
import { createContentProcessor } from "../services/content-processor";
import { createKnowledgeAIAnalyzer } from "../services/knowledge-ai-analyzer";
import { createContentGenerator } from "../services/content-generator";
import { createTopicIntelligence, type WebsiteNature, type TopicCluster } from "../services/topic-intelligence";
import { createBedrockClaudeGenerator } from "../services/bedrock-claude-generator";

interface AuthRequest extends Request {
  userId?: string;
}

const router = Router();

const ML_ANALYZE_CALL_LIMIT = 100;

/** Same ownership rules as Calls list: direct userId, or via campaign / incoming connection. */
function userOwnedCallsCondition(userId: string): SQL {
  return or(
    eq(calls.userId, userId),
    and(isNotNull(calls.campaignId), eq(campaigns.userId, userId)),
    and(isNotNull(calls.incomingConnectionId), eq(incomingConnections.userId, userId)),
  )!;
}

const nonEmptyTranscriptCondition = sql`length(trim(coalesce(${calls.transcript}, ''))) > 0`;

/** Normalize stored transcripts (plain text or JSON message arrays) for LLM analysis. */
function normalizeCallTranscript(raw: unknown): string {
  if (raw == null) return "";
  const text = String(raw).trim();
  if (!text) return "";
  if (text.startsWith("[") || text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed
          .map((entry) => {
            if (typeof entry === "string") return entry;
            if (!entry || typeof entry !== "object") return "";
            const role = (entry as any).role || (entry as any).speaker || "unknown";
            const content =
              (entry as any).content ||
              (entry as any).text ||
              (entry as any).message ||
              "";
            const contentText =
              typeof content === "string"
                ? content
                : Array.isArray(content)
                  ? content.map((c: any) => (typeof c === "string" ? c : c?.text || "")).join(" ")
                  : "";
            return contentText.trim() ? `${role}: ${contentText.trim()}` : "";
          })
          .filter(Boolean)
          .join("\n");
      }
    } catch {
      // Not JSON — use as plain transcript
    }
  }
  return text;
}

// ============================================================
// CRAWL MANAGEMENT
// ============================================================

router.get("/crawl-jobs", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const jobs = await db.select().from(crawlJobs)
      .where(eq(crawlJobs.userId, req.userId))
      .orderBy(desc(crawlJobs.createdAt));

    res.json(jobs);
  } catch (error) {
    console.error("Error fetching crawl jobs:", error);
    res.status(500).json({ error: "Failed to fetch crawl jobs" });
  }
});

router.get("/crawl-jobs/:id", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [job] = await db.select().from(crawlJobs)
      .where(and(
        eq(crawlJobs.id, req.params.id),
        eq(crawlJobs.userId, req.userId)
      ));

    if (!job) {
      return res.status(404).json({ error: "Crawl job not found" });
    }

    const pages = await db.select().from(crawlPages)
      .where(eq(crawlPages.crawlJobId, job.id))
      .orderBy(crawlPages.depth, crawlPages.url);

    res.json({ ...job, pages });
  } catch (error) {
    console.error("Error fetching crawl job:", error);
    res.status(500).json({ error: "Failed to fetch crawl job" });
  }
});

router.post("/crawl-jobs", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { 
      name, 
      startUrl, 
      crawlType = 'sitemap',
      maxPages = 50,
      maxDepth = 3,
      respectRobotsTxt = true,
      includePaths,
      excludePaths,
      folderId,
      scheduleEnabled = false,
      scheduleInterval
    } = req.body;

    if (!name || !startUrl) {
      return res.status(400).json({ error: "Name and start URL are required" });
    }

    try {
      new URL(startUrl);
    } catch {
      return res.status(400).json({ error: "Invalid URL format" });
    }

    const [job] = await db.insert(crawlJobs).values({
      userId: req.userId,
      name,
      startUrl,
      crawlType,
      maxPages,
      maxDepth,
      respectRobotsTxt,
      includePaths,
      excludePaths,
      folderId,
      scheduleEnabled,
      scheduleInterval
    }).returning();

    res.status(201).json(job);
  } catch (error) {
    console.error("Error creating crawl job:", error);
    res.status(500).json({ error: "Failed to create crawl job" });
  }
});

router.post("/crawl-jobs/:id/start", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [job] = await db.select().from(crawlJobs)
      .where(and(
        eq(crawlJobs.id, req.params.id),
        eq(crawlJobs.userId, req.userId)
      ));

    if (!job) {
      return res.status(404).json({ error: "Crawl job not found" });
    }

    if (job.status === 'running') {
      return res.status(400).json({ error: "Crawl job is already running" });
    }

    res.json({ message: "Crawl job started", jobId: job.id });

    const crawler = createCrawler(req.userId);
    crawler.startCrawl(job.id).catch(err => {
      console.error("Crawl failed:", err);
    });
  } catch (error) {
    console.error("Error starting crawl job:", error);
    res.status(500).json({ error: "Failed to start crawl job" });
  }
});

router.post("/crawl-jobs/:id/pause", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await db.update(crawlJobs)
      .set({ status: 'paused', updatedAt: new Date() })
      .where(and(
        eq(crawlJobs.id, req.params.id),
        eq(crawlJobs.userId, req.userId)
      ));

    res.json({ message: "Crawl job paused" });
  } catch (error) {
    console.error("Error pausing crawl job:", error);
    res.status(500).json({ error: "Failed to pause crawl job" });
  }
});

router.post("/crawl-jobs/:id/process", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const processor = createContentProcessor(req.userId);
    const processed = await processor.processJobPages(req.params.id);

    res.json({ message: "Processing complete", pagesProcessed: processed });
  } catch (error) {
    console.error("Error processing crawl job:", error);
    res.status(500).json({ error: "Failed to process crawl job" });
  }
});

router.get("/crawl-jobs/:id/pages", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [job] = await db.select().from(crawlJobs)
      .where(and(
        eq(crawlJobs.id, req.params.id),
        eq(crawlJobs.userId, req.userId)
      ));

    if (!job) {
      return res.status(404).json({ error: "Crawl job not found" });
    }

    const pages = await db.select({
      id: crawlPages.id,
      url: crawlPages.url,
      status: crawlPages.status,
      title: crawlPages.title,
      httpStatus: crawlPages.httpStatus,
      depth: crawlPages.depth,
      errorMessage: crawlPages.errorMessage,
      fetchedAt: crawlPages.fetchedAt,
    }).from(crawlPages)
      .where(eq(crawlPages.crawlJobId, req.params.id));

    res.json(pages);
  } catch (error) {
    console.error("Error fetching crawl pages:", error);
    res.status(500).json({ error: "Failed to fetch crawl pages" });
  }
});

router.delete("/crawl-jobs/:id", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await db.delete(crawlJobs)
      .where(and(
        eq(crawlJobs.id, req.params.id),
        eq(crawlJobs.userId, req.userId)
      ));

    res.json({ message: "Crawl job deleted" });
  } catch (error) {
    console.error("Error deleting crawl job:", error);
    res.status(500).json({ error: "Failed to delete crawl job" });
  }
});

// ============================================================
// AI ANALYSIS
// ============================================================

router.post("/analyze/:knowledgeBaseId", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const analyzer = createKnowledgeAIAnalyzer(req.userId);
    const result = await analyzer.analyzeKnowledgeBaseItem(req.params.knowledgeBaseId);

    res.json({
      message: "Analysis complete",
      ...result
    });
  } catch (error) {
    console.error("Error analyzing content:", error);
    res.status(500).json({ error: "Failed to analyze content" });
  }
});

router.post("/analyze-all", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const knowledgeItems = await db.select().from(knowledgeBase)
      .where(eq(knowledgeBase.userId, req.userId))
      .limit(20);

    if (knowledgeItems.length === 0) {
      return res.json({ message: "No content to analyze", analyzed: 0 });
    }

    const analyzer = createKnowledgeAIAnalyzer(req.userId);
    let analyzed = 0;
    const errors: string[] = [];

    for (const item of knowledgeItems) {
      try {
        await analyzer.analyzeKnowledgeBaseItem(item.id);
        analyzed++;
      } catch (error) {
        errors.push(`Failed to analyze ${item.title}: ${error}`);
      }
    }

    res.json({
      message: `Analysis complete`,
      analyzed,
      total: knowledgeItems.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error("Error in bulk analysis:", error);
    res.status(500).json({ error: "Failed to analyze content" });
  }
});

router.get("/entities", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const entities = await db.select().from(knowledgeEntities)
      .where(eq(knowledgeEntities.userId, req.userId))
      .orderBy(desc(knowledgeEntities.mentionCount));

    res.json(entities);
  } catch (error) {
    console.error("Error fetching entities:", error);
    res.status(500).json({ error: "Failed to fetch entities" });
  }
});

router.get("/topics", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const topics = await db.select().from(knowledgeTopics)
      .where(eq(knowledgeTopics.userId, req.userId))
      .orderBy(desc(knowledgeTopics.documentCount));

    res.json(topics);
  } catch (error) {
    console.error("Error fetching topics:", error);
    res.status(500).json({ error: "Failed to fetch topics" });
  }
});

router.get("/faqs", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const faqs = await db.select().from(knowledgeFaqs)
      .where(eq(knowledgeFaqs.userId, req.userId))
      .orderBy(desc(knowledgeFaqs.usageCount));

    res.json(faqs);
  } catch (error) {
    console.error("Error fetching FAQs:", error);
    res.status(500).json({ error: "Failed to fetch FAQs" });
  }
});

router.get("/knowledge-graph", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const nodes = await db.select().from(knowledgeGraphNodes)
      .where(eq(knowledgeGraphNodes.userId, req.userId));

    const edges = await db.select().from(knowledgeGraphEdges)
      .where(eq(knowledgeGraphEdges.userId, req.userId));

    res.json({ nodes, edges });
  } catch (error) {
    console.error("Error fetching knowledge graph:", error);
    res.status(500).json({ error: "Failed to fetch knowledge graph" });
  }
});

router.get("/topic-gaps", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const analyzer = createKnowledgeAIAnalyzer(req.userId);
    const gaps = await analyzer.findTopicGaps();

    res.json(gaps);
  } catch (error) {
    console.error("Error finding topic gaps:", error);
    res.status(500).json({ error: "Failed to find topic gaps" });
  }
});

// ============================================================
// CONTENT GENERATION
// ============================================================

router.post("/generate/brief", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { topic, articleType, context } = req.body;

    if (!topic) {
      return res.status(400).json({ error: "Topic is required" });
    }

    const generator = createContentGenerator(req.userId);
    const brief = await generator.generateBrief(topic, articleType, context);

    res.json(brief);
  } catch (error) {
    console.error("Error generating brief:", error);
    res.status(500).json({ error: "Failed to generate brief" });
  }
});

router.post("/generate/article", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { brief, folderId, articleType, includeExistingFaqs } = req.body;

    if (!brief || !brief.title || !brief.outline) {
      return res.status(400).json({ error: "Valid brief with title and outline is required" });
    }

    const generator = createContentGenerator(req.userId);
    const articleId = await generator.generateArticle(brief, {
      folderId,
      articleType,
      includeExistingFaqs
    });

    const [article] = await db.select().from(generatedArticles)
      .where(eq(generatedArticles.id, articleId));

    res.status(201).json(article);
  } catch (error) {
    console.error("Error generating article:", error);
    res.status(500).json({ error: "Failed to generate article" });
  }
});

router.get("/articles", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const articles = await db.select().from(generatedArticles)
      .where(eq(generatedArticles.userId, req.userId))
      .orderBy(desc(generatedArticles.createdAt));

    res.json(articles);
  } catch (error) {
    console.error("Error fetching articles:", error);
    res.status(500).json({ error: "Failed to fetch articles" });
  }
});

router.get("/articles/:id", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [article] = await db.select().from(generatedArticles)
      .where(and(
        eq(generatedArticles.id, req.params.id),
        eq(generatedArticles.userId, req.userId)
      ));

    if (!article) {
      return res.status(404).json({ error: "Article not found" });
    }

    res.json(article);
  } catch (error) {
    console.error("Error fetching article:", error);
    res.status(500).json({ error: "Failed to fetch article" });
  }
});

router.post("/articles/:id/qa", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const generator = createContentGenerator(req.userId);
    const result = await generator.runEditorialQA(req.params.id);

    res.json(result);
  } catch (error) {
    console.error("Error running editorial QA:", error);
    res.status(500).json({ error: "Failed to run editorial QA" });
  }
});

router.post("/articles/:id/citations", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const generator = createContentGenerator(req.userId);
    await generator.injectCitations(req.params.id);

    res.json({ message: "Citations injected" });
  } catch (error) {
    console.error("Error injecting citations:", error);
    res.status(500).json({ error: "Failed to inject citations" });
  }
});

router.post("/articles/:id/publish", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const generator = createContentGenerator(req.userId);
    await generator.publishArticle(req.params.id);

    res.json({ message: "Article published" });
  } catch (error) {
    console.error("Error publishing article:", error);
    res.status(500).json({ error: "Failed to publish article" });
  }
});

router.patch("/articles/:id", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { title, content, status } = req.body;

    await db.update(generatedArticles)
      .set({
        ...(title && { title }),
        ...(content && { content }),
        ...(status && { status }),
        updatedAt: new Date()
      })
      .where(and(
        eq(generatedArticles.id, req.params.id),
        eq(generatedArticles.userId, req.userId)
      ));

    const [article] = await db.select().from(generatedArticles)
      .where(eq(generatedArticles.id, req.params.id));

    res.json(article);
  } catch (error) {
    console.error("Error updating article:", error);
    res.status(500).json({ error: "Failed to update article" });
  }
});

router.delete("/articles/:id", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await db.delete(generatedArticles)
      .where(and(
        eq(generatedArticles.id, req.params.id),
        eq(generatedArticles.userId, req.userId)
      ));

    res.json({ message: "Article deleted" });
  } catch (error) {
    console.error("Error deleting article:", error);
    res.status(500).json({ error: "Failed to delete article" });
  }
});

// ============================================================
// PIPELINE JOBS - Automated crawl -> analyze -> generate
// ============================================================

// Background pipeline runner - runs the full pipeline asynchronously
async function runPipeline(pipelineJobId: string, userId: string) {
  const updateProgress = async (
    stage: string, 
    stageProgress: number, 
    overallProgress: number, 
    estimatedTimeRemaining: number | null,
    stageDetails?: any
  ) => {
    await db.update(knowledgePipelineJobs)
      .set({ 
        currentStage: stage, 
        stageProgress, 
        overallProgress, 
        estimatedTimeRemaining,
        stageDetails,
        updatedAt: new Date()
      })
      .where(eq(knowledgePipelineJobs.id, pipelineJobId));
  };

  try {
    const [pipelineJob] = await db.select().from(knowledgePipelineJobs)
      .where(eq(knowledgePipelineJobs.id, pipelineJobId));
    
    if (!pipelineJob || !pipelineJob.crawlJobId) {
      throw new Error("Pipeline job not found or missing crawl job");
    }

    // Update to running
    await db.update(knowledgePipelineJobs)
      .set({ status: "crawling", startedAt: new Date(), updatedAt: new Date() })
      .where(eq(knowledgePipelineJobs.id, pipelineJobId));

    // ========== STAGE 1: CRAWLING ==========
    const crawler = createCrawler(userId);
    const crawlStartTime = Date.now();
    let stageDetails: any = {
      crawling: { pagesDiscovered: 0, pagesCrawled: 0, startedAt: new Date().toISOString() },
      analyzing: { itemsTotal: 0, itemsProcessed: 0, entitiesFound: 0, topicsFound: 0, faqsFound: 0 },
      generating: { articlesPlanned: 0, articlesGenerated: 0 }
    };

    await updateProgress("crawling", 0, 5, 120, stageDetails);

    // Start the crawl
    await crawler.startCrawl(pipelineJob.crawlJobId);

    // Poll crawl status until complete
    let crawlComplete = false;
    while (!crawlComplete) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const [crawlJob] = await db.select().from(crawlJobs)
        .where(eq(crawlJobs.id, pipelineJob.crawlJobId));
      
      if (!crawlJob) break;

      const progress = crawlJob.maxPages > 0 
        ? Math.min(95, Math.round((crawlJob.pagesCrawled / crawlJob.maxPages) * 100))
        : 50;
      
      stageDetails.crawling.pagesDiscovered = crawlJob.pagesDiscovered;
      stageDetails.crawling.pagesCrawled = crawlJob.pagesCrawled;
      
      const elapsed = (Date.now() - crawlStartTime) / 1000;
      const estimatedTotal = progress > 0 ? (elapsed / progress) * 100 : 120;
      const remaining = Math.max(0, Math.round(estimatedTotal - elapsed));
      
      await updateProgress("crawling", progress, Math.round(progress * 0.33), remaining + 60, stageDetails);

      if (crawlJob.status === "completed" || crawlJob.status === "failed") {
        crawlComplete = true;
        stageDetails.crawling.completedAt = new Date().toISOString();
      }
    }

    // Process crawled pages
    const processor = createContentProcessor(userId);
    await processor.processJobPages(pipelineJob.crawlJobId);

    await updateProgress("crawling", 100, 33, 60, stageDetails);

    // ========== STAGE 2: AI ANALYSIS ==========
    await db.update(knowledgePipelineJobs)
      .set({ status: "analyzing", updatedAt: new Date() })
      .where(eq(knowledgePipelineJobs.id, pipelineJobId));

    stageDetails.analyzing.startedAt = new Date().toISOString();
    await updateProgress("analyzing", 0, 35, 90, stageDetails);

    const knowledgeItems = await db.select().from(knowledgeBase)
      .where(eq(knowledgeBase.userId, userId))
      .limit(20);

    stageDetails.analyzing.itemsTotal = knowledgeItems.length;
    
    const analyzer = createKnowledgeAIAnalyzer(userId);
    let analyzed = 0;

    for (const item of knowledgeItems) {
      try {
        const result = await analyzer.analyzeKnowledgeBaseItem(item.id);
        analyzed++;
        stageDetails.analyzing.itemsProcessed = analyzed;
        stageDetails.analyzing.entitiesFound += result?.entities || 0;
        stageDetails.analyzing.topicsFound += result?.topics || 0;
        stageDetails.analyzing.faqsFound += result?.faqs || 0;
        
        const progress = Math.round((analyzed / knowledgeItems.length) * 100);
        const remaining = Math.max(0, Math.round((knowledgeItems.length - analyzed) * 3));
        await updateProgress("analyzing", progress, 33 + Math.round(progress * 0.33), remaining + 30, stageDetails);
      } catch (error) {
        console.error(`Failed to analyze item ${item.id}:`, error);
      }
    }

    stageDetails.analyzing.completedAt = new Date().toISOString();
    await updateProgress("analyzing", 100, 66, 30, stageDetails);

    // ========== STAGE 3: INTELLIGENT CONTENT GENERATION ==========
    // Primary: Use AWS Bedrock Claude for fold-based article generation (10-20 articles)
    // Fallback: Use Topic Intelligence (Anthropic Claude) if Bedrock is not configured
    await db.update(knowledgePipelineJobs)
      .set({ status: "generating", updatedAt: new Date() })
      .where(eq(knowledgePipelineJobs.id, pipelineJobId));

    stageDetails.generating.startedAt = new Date().toISOString();
    await updateProgress("generating", 0, 68, 120, stageDetails);

    // Try Bedrock Claude first
    const bedrockGenerator = createBedrockClaudeGenerator(userId);

    if (bedrockGenerator) {
      try {
        console.log("[Pipeline] Using AWS Bedrock Claude for fold-based article generation");

        const bedrockResult = await bedrockGenerator.runFoldArticleGeneration(
          pipelineJob.crawlJobId,
          15, // max articles (10-20)
          async (generated: number, total: number) => {
            const progress = Math.round((generated / total) * 100);
            stageDetails.generating.articlesPlanned = total;
            stageDetails.generating.articlesGenerated = generated;
            await updateProgress(
              "generating",
              progress,
              68 + Math.round(progress * 0.32),
              Math.max(0, (total - generated) * 6),
              stageDetails
            );
          }
        );

        stageDetails.generating.articlesPlanned = bedrockResult.foldsDiscovered * 3;
        stageDetails.generating.articlesGenerated = bedrockResult.articlesGenerated;
        stageDetails.bedrockFolds = {
          foldsDiscovered: bedrockResult.foldsDiscovered,
          foldNames: bedrockResult.folds.map((f) => f.name),
          articlesGenerated: bedrockResult.articlesGenerated,
          generator: "aws-bedrock-claude",
        };

        console.log(`[Pipeline] Bedrock Claude generation completed:`, {
          foldsDiscovered: bedrockResult.foldsDiscovered,
          articlesGenerated: bedrockResult.articlesGenerated,
        });
      } catch (bedrockError) {
        console.error("[Pipeline] Bedrock Claude generation failed, falling back to Topic Intelligence:", bedrockError);

        // Fallback to Topic Intelligence
        const topicIntelligence = createTopicIntelligence(userId);
        try {
          const autoGenResult = await topicIntelligence.runAutoGeneration(
            pipelineJobId,
            pipelineJob.crawlJobId,
            15
          );
          stageDetails.generating.articlesPlanned = autoGenResult.topicsSelected;
          stageDetails.generating.articlesGenerated = autoGenResult.articlesGenerated;
        } catch (fallbackError) {
          console.error("[Pipeline] Topic Intelligence fallback also failed:", fallbackError);
        }
      }
    } else {
      // Bedrock not configured — use Topic Intelligence (Anthropic Claude)
      console.log("[Pipeline] AWS Bedrock not configured, using Topic Intelligence (Anthropic Claude)");
      const topicIntelligence = createTopicIntelligence(userId);
      
      try {
        const autoGenResult = await topicIntelligence.runAutoGeneration(
          pipelineJobId,
          pipelineJob.crawlJobId,
          15
        );

        stageDetails.websiteNature = {
          industry: autoGenResult.websiteNature.industryDomain,
          productCategory: autoGenResult.websiteNature.productCategory,
          features: autoGenResult.websiteNature.productFeatures.length,
          personas: autoGenResult.websiteNature.customerPersonas.length
        };
        stageDetails.topicMining = {
          topicsDiscovered: autoGenResult.topicsDiscovered,
          topicsExpanded: autoGenResult.topicsExpanded,
          topicsSelected: autoGenResult.topicsSelected,
          clusters: autoGenResult.clusters.length
        };
        stageDetails.generating.articlesPlanned = autoGenResult.topicsSelected;
        stageDetails.generating.articlesGenerated = autoGenResult.articlesGenerated;

        console.log(`[Pipeline] Topic Intelligence completed:`, {
          websiteNature: autoGenResult.websiteNature.industryDomain,
          topicsDiscovered: autoGenResult.topicsDiscovered,
          topicsSelected: autoGenResult.topicsSelected,
          articlesGenerated: autoGenResult.articlesGenerated
        });
      } catch (error) {
        console.error("[Pipeline] Topic Intelligence failed, falling back to basic generation:", error);
        
        const topics = await db.select().from(knowledgeTopics)
          .where(eq(knowledgeTopics.userId, userId))
          .limit(10);

        const articleTypes = ["guide", "how-to", "overview", "faq", "tutorial"];
        const generator = createContentGenerator(userId);
        let generated = 0;

        stageDetails.generating.articlesPlanned = topics.length;

        for (let i = 0; i < topics.length; i++) {
          const topic = topics[i];
          const articleType = articleTypes[i % articleTypes.length];
          
          try {
            const brief = await generator.generateBrief(topic.name, articleType);
            await generator.generateArticle(brief, { articleType });
            generated++;
            stageDetails.generating.articlesGenerated = generated;
            
            const progress = Math.round((generated / topics.length) * 100);
            await updateProgress("generating", progress, 66 + Math.round(progress * 0.34), 
              Math.max(0, (topics.length - generated) * 8), stageDetails);
          } catch (genError) {
            console.error(`Failed to generate ${articleType} for topic ${topic.name}:`, genError);
          }
        }
      }
    }

    stageDetails.generating.completedAt = new Date().toISOString();

    // Complete the pipeline
    await db.update(knowledgePipelineJobs)
      .set({ 
        status: "completed", 
        currentStage: "generating",
        overallProgress: 100,
        stageProgress: 100,
        estimatedTimeRemaining: 0,
        stageDetails,
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(knowledgePipelineJobs.id, pipelineJobId));

    console.log(`[Pipeline] Completed pipeline job ${pipelineJobId}`);

  } catch (error) {
    console.error(`[Pipeline] Error in pipeline ${pipelineJobId}:`, error);
    await db.update(knowledgePipelineJobs)
      .set({ 
        status: "failed", 
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        updatedAt: new Date()
      })
      .where(eq(knowledgePipelineJobs.id, pipelineJobId));
  }
}

// Get all pipeline jobs for user
router.get("/pipeline-jobs", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const jobs = await db.select().from(knowledgePipelineJobs)
      .where(eq(knowledgePipelineJobs.userId, req.userId))
      .orderBy(desc(knowledgePipelineJobs.createdAt));

    res.json(jobs);
  } catch (error) {
    console.error("Error fetching pipeline jobs:", error);
    res.status(500).json({ error: "Failed to fetch pipeline jobs" });
  }
});

// Get active pipeline job — returns running jobs OR recently-completed URL enrichment jobs
// (done/error stage within the last 2 minutes so the frontend can render the completion banner)
router.get("/pipeline-jobs/active", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [activeJob] = await db.select().from(knowledgePipelineJobs)
      .where(and(
        eq(knowledgePipelineJobs.userId, req.userId),
        sql`(
          ${knowledgePipelineJobs.status} IN ('pending', 'crawling', 'analyzing', 'generating')
          OR (
            ${knowledgePipelineJobs.status} IN ('completed', 'failed')
            AND ${knowledgePipelineJobs.currentStage} IN ('done', 'error')
            AND ${knowledgePipelineJobs.completedAt} > NOW() - INTERVAL '2 minutes'
          )
        )`
      ))
      .orderBy(desc(knowledgePipelineJobs.createdAt))
      .limit(1);

    res.json(activeJob || null);
  } catch (error) {
    console.error("Error fetching active pipeline job:", error);
    res.status(500).json({ error: "Failed to fetch active pipeline job" });
  }
});

// Get specific pipeline job
router.get("/pipeline-jobs/:id", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [job] = await db.select().from(knowledgePipelineJobs)
      .where(and(
        eq(knowledgePipelineJobs.id, req.params.id),
        eq(knowledgePipelineJobs.userId, req.userId)
      ));

    if (!job) {
      return res.status(404).json({ error: "Pipeline job not found" });
    }

    res.json(job);
  } catch (error) {
    console.error("Error fetching pipeline job:", error);
    res.status(500).json({ error: "Failed to fetch pipeline job" });
  }
});

// ============================================================
// STATS & DASHBOARD
// ============================================================

router.get("/intelligence-stats", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [crawlJobCount] = await db.select({ count: count() }).from(crawlJobs)
      .where(eq(crawlJobs.userId, req.userId));

    const [entityCount] = await db.select({ count: count() }).from(knowledgeEntities)
      .where(eq(knowledgeEntities.userId, req.userId));

    const [topicCount] = await db.select({ count: count() }).from(knowledgeTopics)
      .where(eq(knowledgeTopics.userId, req.userId));

    const [faqCount] = await db.select({ count: count() }).from(knowledgeFaqs)
      .where(eq(knowledgeFaqs.userId, req.userId));

    const [articleCount] = await db.select({ count: count() }).from(generatedArticles)
      .where(eq(generatedArticles.userId, req.userId));

    const [graphNodeCount] = await db.select({ count: count() }).from(knowledgeGraphNodes)
      .where(eq(knowledgeGraphNodes.userId, req.userId));

    const recentActivity = await db.select().from(contentAuditLog)
      .where(eq(contentAuditLog.userId, req.userId))
      .orderBy(desc(contentAuditLog.createdAt))
      .limit(10);

    res.json({
      crawlJobs: crawlJobCount.count,
      entities: entityCount.count,
      topics: topicCount.count,
      faqs: faqCount.count,
      articles: articleCount.count,
      graphNodes: graphNodeCount.count,
      recentActivity
    });
  } catch (error) {
    console.error("Error fetching intelligence stats:", error);
    res.status(500).json({ error: "Failed to fetch intelligence stats" });
  }
});

// ============================================================
// PIPELINE JOBS
// ============================================================

router.get("/pipeline-jobs/:id", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [job] = await db.select().from(knowledgePipelineJobs)
      .where(and(
        eq(knowledgePipelineJobs.id, req.params.id),
        eq(knowledgePipelineJobs.userId, req.userId)
      ));

    if (!job) {
      return res.status(404).json({ error: "Pipeline job not found" });
    }

    res.json(job);
  } catch (error) {
    console.error("Error fetching pipeline job:", error);
    res.status(500).json({ error: "Failed to fetch pipeline job" });
  }
});

router.post("/pipeline-jobs", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { name, startUrl, crawlType = "sitemap", maxPages = 50 } = req.body;

    if (!name || !startUrl) {
      return res.status(400).json({ error: "Name and start URL are required" });
    }

    const existingActive = await db.select().from(knowledgePipelineJobs)
      .where(and(
        eq(knowledgePipelineJobs.userId, req.userId),
        sql`${knowledgePipelineJobs.status} IN ('pending', 'crawling', 'analyzing', 'generating')`
      ))
      .limit(1);

    if (existingActive.length > 0) {
      return res.status(400).json({ error: "A pipeline is already running. Please wait for it to complete." });
    }

    // First create the crawl job
    const [crawlJob] = await db.insert(crawlJobs).values({
      userId: req.userId,
      name: `Pipeline: ${name}`,
      startUrl,
      crawlType,
      maxPages,
      status: "pending",
      pagesDiscovered: 0,
      pagesCrawled: 0
    }).returning();

    // Then create the pipeline job with the crawl job ID
    const [job] = await db.insert(knowledgePipelineJobs).values({
      userId: req.userId,
      name,
      startUrl,
      crawlType,
      maxPages,
      crawlJobId: crawlJob.id,
      status: "pending",
      currentStage: "crawling",
      overallProgress: 0,
      stageProgress: 0,
      stageDetails: {
        crawling: { pagesDiscovered: 0, pagesCrawled: 0 },
        analyzing: { itemsTotal: 0, itemsProcessed: 0, entitiesFound: 0, topicsFound: 0, faqsFound: 0 },
        generating: { articlesPlanned: 0, articlesGenerated: 0 }
      }
    }).returning();

    // Run pipeline asynchronously (non-blocking)
    setImmediate(() => {
      runPipeline(job.id, req.userId).catch(err => {
        console.error(`Pipeline ${job.id} failed:`, err);
      });
    });

    res.json(job);
  } catch (error) {
    console.error("Error creating pipeline job:", error);
    res.status(500).json({ error: "Failed to create pipeline job" });
  }
});

// ============================================================
// ML CONTENT ANALYSIS
// ============================================================

router.get("/content-analysis/:knowledgeBaseId", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { createMLContentAnalyzer } = await import("../services/ml-content-analyzer");
    const analyzer = createMLContentAnalyzer(req.userId);

    const [item] = await db.select().from(knowledgeBase)
      .where(and(
        eq(knowledgeBase.id, req.params.knowledgeBaseId),
        eq(knowledgeBase.userId, req.userId)
      ));

    if (!item?.content) {
      return res.status(404).json({ error: "Content not found" });
    }

    const analysis = analyzer.analyzeContent(item.content);
    res.json(analysis);
  } catch (error) {
    console.error("Error analyzing content:", error);
    res.status(500).json({ error: "Failed to analyze content" });
  }
});

router.get("/similar-content/:knowledgeBaseId", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { createMLContentAnalyzer } = await import("../services/ml-content-analyzer");
    const analyzer = createMLContentAnalyzer(req.userId);

    const [item] = await db.select().from(knowledgeBase)
      .where(and(
        eq(knowledgeBase.id, req.params.knowledgeBaseId),
        eq(knowledgeBase.userId, req.userId)
      ));

    if (!item?.content) {
      return res.status(404).json({ error: "Content not found" });
    }

    const similar = await analyzer.findSimilarContent(item.content, item.id);
    res.json(similar);
  } catch (error) {
    console.error("Error finding similar content:", error);
    res.status(500).json({ error: "Failed to find similar content" });
  }
});

router.get("/content-clusters", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { createMLContentAnalyzer } = await import("../services/ml-content-analyzer");
    const analyzer = createMLContentAnalyzer(req.userId);

    const clusters = await analyzer.detectContentClusters();
    res.json(clusters);
  } catch (error) {
    console.error("Error detecting content clusters:", error);
    res.status(500).json({ error: "Failed to detect content clusters" });
  }
});

router.get("/stale-content", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { createPipelineOrchestrator } = await import("../services/pipeline-orchestrator");
    const orchestrator = createPipelineOrchestrator(req.userId);

    const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 365);
    const staleContent = await orchestrator.getStaleContent(days);
    res.json(staleContent);
  } catch (error) {
    console.error("Error fetching stale content:", error);
    res.status(500).json({ error: "Failed to fetch stale content" });
  }
});

router.get("/pipeline-analytics", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { createPipelineOrchestrator } = await import("../services/pipeline-orchestrator");
    const orchestrator = createPipelineOrchestrator(req.userId);

    const analytics = await orchestrator.getPipelineAnalytics();
    res.json(analytics);
  } catch (error) {
    console.error("Error fetching pipeline analytics:", error);
    res.status(500).json({ error: "Failed to fetch pipeline analytics" });
  }
});

router.get("/pipeline-history", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { createPipelineOrchestrator } = await import("../services/pipeline-orchestrator");
    const orchestrator = createPipelineOrchestrator(req.userId);

    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100);
    const history = await orchestrator.getPipelineHistory(limit);
    res.json(history);
  } catch (error) {
    console.error("Error fetching pipeline history:", error);
    res.status(500).json({ error: "Failed to fetch pipeline history" });
  }
});

router.post("/pipeline-jobs/:id/cancel", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { createPipelineOrchestrator } = await import("../services/pipeline-orchestrator");
    const orchestrator = createPipelineOrchestrator(req.userId);

    await orchestrator.cancelPipeline(req.params.id);
    res.json({ message: "Pipeline cancelled" });
  } catch (error) {
    console.error("Error cancelling pipeline:", error);
    res.status(500).json({ error: "Failed to cancel pipeline" });
  }
});

// ============================================================
// ML CONVERSATIONS - AI Training from Call Transcripts
// ============================================================

// Get ML Conversations Stats
router.get("/ml-conversations/stats", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get or create stats for user
    let [stats] = await db.select().from(mlTrainingStats)
      .where(eq(mlTrainingStats.userId, req.userId));

    if (!stats) {
      // Create default stats
      const [newStats] = await db.insert(mlTrainingStats).values({
        userId: req.userId,
        totalCallsAnalyzed: 0,
        totalIssuesDiscovered: 0,
        totalTrainingSamples: 0,
        approvedSamples: 0,
      }).returning();
      stats = newStats;
    }

    // Get counts
    const [analysisCount] = await db.select({ count: count() })
      .from(mlConversationAnalyses)
      .where(eq(mlConversationAnalyses.userId, req.userId));

    const [issueCount] = await db.select({ count: count() })
      .from(mlCommonIssues)
      .where(eq(mlCommonIssues.userId, req.userId));

    const [sampleCount] = await db.select({ count: count() })
      .from(mlTrainingSamples)
      .where(eq(mlTrainingSamples.userId, req.userId));

    const [approvedCount] = await db.select({ count: count() })
      .from(mlTrainingSamples)
      .where(and(
        eq(mlTrainingSamples.userId, req.userId),
        eq(mlTrainingSamples.status, "approved")
      ));

    // Match Calls page ownership (direct + campaign + incoming connection)
    const [callsWithTranscripts] = await db.select({ count: count() })
      .from(calls)
      .leftJoin(campaigns, eq(calls.campaignId, campaigns.id))
      .leftJoin(incomingConnections, eq(calls.incomingConnectionId, incomingConnections.id))
      .where(and(
        userOwnedCallsCondition(req.userId),
        nonEmptyTranscriptCondition,
      ));

    res.json({
      ...stats,
      totalCallsAnalyzed: analysisCount?.count || 0,
      totalIssuesDiscovered: issueCount?.count || 0,
      totalTrainingSamples: sampleCount?.count || 0,
      approvedSamples: approvedCount?.count || 0,
      availableCallsForAnalysis: callsWithTranscripts?.count || 0,
    });
  } catch (error) {
    console.error("Error fetching ML stats:", error);
    res.status(500).json({ error: "Failed to fetch ML stats" });
  }
});

// Get Analysis Jobs
router.get("/ml-conversations/jobs", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const jobs = await db.select().from(mlAnalysisJobs)
      .where(eq(mlAnalysisJobs.userId, req.userId))
      .orderBy(desc(mlAnalysisJobs.createdAt));

    res.json(jobs);
  } catch (error) {
    console.error("Error fetching analysis jobs:", error);
    res.status(500).json({ error: "Failed to fetch analysis jobs" });
  }
});

// Start Analysis Job
router.post("/ml-conversations/analyze", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { name, dateRangeStart, dateRangeEnd } = req.body;

    const conditions: SQL[] = [
      userOwnedCallsCondition(req.userId),
      nonEmptyTranscriptCondition,
    ];

    if (dateRangeStart) {
      const start = new Date(dateRangeStart);
      if (!Number.isNaN(start.getTime())) {
        conditions.push(gte(calls.createdAt, start));
      }
    }
    if (dateRangeEnd) {
      const end = new Date(dateRangeEnd);
      if (!Number.isNaN(end.getTime())) {
        conditions.push(lte(calls.createdAt, end));
      }
    }

    const callsToAnalyze = await db.select({ call: calls })
      .from(calls)
      .leftJoin(campaigns, eq(calls.campaignId, campaigns.id))
      .leftJoin(incomingConnections, eq(calls.incomingConnectionId, incomingConnections.id))
      .where(and(...conditions))
      .orderBy(desc(calls.createdAt))
      .limit(ML_ANALYZE_CALL_LIMIT);

    const callRows = callsToAnalyze.map((row) => row.call);

    if (callRows.length === 0) {
      return res.status(400).json({
        error: "No calls with transcripts available for analysis. Complete some calls first, then return here.",
      });
    }

    // Create analysis job
    const [job] = await db.insert(mlAnalysisJobs).values({
      userId: req.userId,
      name: name || `Analysis ${new Date().toLocaleDateString()}`,
      totalCalls: callRows.length,
      dateRangeStart: dateRangeStart ? new Date(dateRangeStart) : null,
      dateRangeEnd: dateRangeEnd ? new Date(dateRangeEnd) : null,
      status: "processing",
      startedAt: new Date(),
    }).returning();

    // Process calls in background
    processCallsForML(req.userId, job.id, callRows).catch(err => {
      console.error("ML analysis error:", err);
    });

    res.json(job);
  } catch (error) {
    console.error("Error starting ML analysis:", error);
    res.status(500).json({ error: "Failed to start analysis" });
  }
});

// Get Common Issues
router.get("/ml-conversations/issues", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const issues = await db.select().from(mlCommonIssues)
      .where(eq(mlCommonIssues.userId, req.userId))
      .orderBy(desc(mlCommonIssues.occurrenceCount));

    res.json(issues);
  } catch (error) {
    console.error("Error fetching common issues:", error);
    res.status(500).json({ error: "Failed to fetch common issues" });
  }
});

// Update Common Issue
router.patch("/ml-conversations/issues/:id", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { suggestedResponse, isTrainingApproved } = req.body;

    const [updated] = await db.update(mlCommonIssues)
      .set({
        suggestedResponse,
        isTrainingApproved,
        approvedAt: isTrainingApproved ? new Date() : null,
        approvedBy: isTrainingApproved ? req.userId : null,
        updatedAt: new Date(),
      })
      .where(and(
        eq(mlCommonIssues.id, req.params.id),
        eq(mlCommonIssues.userId, req.userId)
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Issue not found" });
    }

    res.json(updated);
  } catch (error) {
    console.error("Error updating issue:", error);
    res.status(500).json({ error: "Failed to update issue" });
  }
});

// Get Training Samples
router.get("/ml-conversations/samples", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const status = req.query.status as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    const conditions = [eq(mlTrainingSamples.userId, req.userId)];
    if (status && status !== "all") {
      conditions.push(eq(mlTrainingSamples.status, status));
    }

    const samples = await db.select().from(mlTrainingSamples)
      .where(and(...conditions))
      .orderBy(desc(mlTrainingSamples.createdAt))
      .limit(limit);

    res.json(samples);
  } catch (error) {
    console.error("Error fetching training samples:", error);
    res.status(500).json({ error: "Failed to fetch training samples" });
  }
});

// Approve/Reject Training Sample
router.patch("/ml-conversations/samples/:id", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { status, rejectionReason, outputText } = req.body;

    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const [updated] = await db.update(mlTrainingSamples)
      .set({
        status,
        outputText: outputText || undefined,
        rejectionReason: status === "rejected" ? rejectionReason : null,
        reviewedBy: req.userId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(mlTrainingSamples.id, req.params.id),
        eq(mlTrainingSamples.userId, req.userId)
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Sample not found" });
    }

    res.json(updated);
  } catch (error) {
    console.error("Error updating sample:", error);
    res.status(500).json({ error: "Failed to update sample" });
  }
});

// Get Conversation Analyses
router.get("/ml-conversations/analyses", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    const analyses = await db.select().from(mlConversationAnalyses)
      .where(eq(mlConversationAnalyses.userId, req.userId))
      .orderBy(desc(mlConversationAnalyses.analyzedAt))
      .limit(limit);

    res.json(analyses);
  } catch (error) {
    console.error("Error fetching analyses:", error);
    res.status(500).json({ error: "Failed to fetch analyses" });
  }
});

// Background function to process calls for ML
async function processCallsForML(userId: string, jobId: string, callsToProcess: any[]) {
  const { getOpenAIClient } = await import("../services/openai-modelfarm");
  
  let processedCount = 0;
  let issuesFound = 0;
  let samplesCreated = 0;
  let failedCount = 0;
  let lastError: string | null = null;

  try {
    let openai: Awaited<ReturnType<typeof getOpenAIClient>>;
    try {
      openai = await getOpenAIClient(userId);
    } catch (clientError) {
      const message = clientError instanceof Error ? clientError.message : "OpenAI client unavailable";
      console.error("ML analysis OpenAI client error:", clientError);
      await db.update(mlAnalysisJobs)
        .set({
          status: "failed",
          errorMessage: message,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(mlAnalysisJobs.id, jobId));
      return;
    }

    for (const call of callsToProcess) {
      const transcript = normalizeCallTranscript(call.transcript);
      if (!transcript) {
        failedCount++;
        continue;
      }

      try {
        // Analyze transcript with AI
        const analysisResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are an AI conversation analyst. Analyze the following call transcript and extract:
1. Overall sentiment (positive, negative, neutral, mixed) and score (-1 to 1)
2. Key issues or problems mentioned by the customer
3. Customer's intent/goal
4. Resolution status (resolved, unresolved, escalated, transferred)
5. Quality question-answer pairs that could be used for training
6. Suggested improvements for the AI agent

Respond in JSON format:
{
  "sentiment": "positive|negative|neutral|mixed",
  "sentimentScore": 0.5,
  "issues": [{"issue": "description", "severity": "low|medium|high", "context": "excerpt from transcript"}],
  "keyTopics": ["topic1", "topic2"],
  "customerIntent": "what the customer wanted",
  "resolutionStatus": "resolved|unresolved|escalated|transferred",
  "agentPerformance": {"helpfulness": 80, "clarity": 75, "empathy": 70},
  "questionAnswerPairs": [{"question": "customer question", "answer": "good response", "quality": 85}],
  "suggestedImprovements": ["improvement 1", "improvement 2"]
}`
            },
            {
              role: "user",
              content: transcript
            }
          ],
          response_format: { type: "json_object" },
          max_tokens: 2000,
        });

        const analysis = JSON.parse(analysisResponse.choices[0].message.content || "{}");

        // Save conversation analysis
        await db.insert(mlConversationAnalyses).values({
          userId,
          callId: call.id,
          analysisJobId: jobId,
          sentiment: analysis.sentiment,
          sentimentScore: analysis.sentimentScore,
          issuesDetected: analysis.issues || [],
          keyTopics: analysis.keyTopics || [],
          customerIntent: analysis.customerIntent,
          resolutionStatus: analysis.resolutionStatus,
          agentPerformance: analysis.agentPerformance,
          questionAnswerPairs: analysis.questionAnswerPairs || [],
          suggestedImprovements: analysis.suggestedImprovements || [],
          transcriptLength: transcript.length,
          callDuration: call.duration,
        });

        // Process issues - aggregate into common issues
        if (analysis.issues && analysis.issues.length > 0) {
          for (const issue of analysis.issues) {
            // Check if similar issue exists
            const existingIssues = await db.select().from(mlCommonIssues)
              .where(eq(mlCommonIssues.userId, userId));

            const similarIssue = existingIssues.find(
              existing => existing.issueName.toLowerCase().includes(issue.issue.toLowerCase().slice(0, 20)) ||
                         issue.issue.toLowerCase().includes(existing.issueName.toLowerCase().slice(0, 20))
            );

            if (similarIssue) {
              // Update existing issue count
              await db.update(mlCommonIssues)
                .set({
                  occurrenceCount: similarIssue.occurrenceCount + 1,
                  lastSeenAt: new Date(),
                  updatedAt: new Date(),
                })
                .where(eq(mlCommonIssues.id, similarIssue.id));
            } else {
              // Create new common issue
              await db.insert(mlCommonIssues).values({
                userId,
                issueName: issue.issue,
                description: issue.context,
                severity: issue.severity || "medium",
                category: "general",
              });
              issuesFound++;
            }
          }
        }

        // Create training samples from Q&A pairs
        if (analysis.questionAnswerPairs && analysis.questionAnswerPairs.length > 0) {
          for (const qa of analysis.questionAnswerPairs) {
            if (qa.quality >= 70) { // Only create samples from high-quality pairs
              await db.insert(mlTrainingSamples).values({
                userId,
                sourceCallId: call.id,
                sampleType: "qa_pair",
                inputText: qa.question,
                outputText: qa.answer,
                qualityScore: qa.quality,
                status: "pending",
              });
              samplesCreated++;
            }
          }
        }

        processedCount++;

        // Update job progress
        await db.update(mlAnalysisJobs)
          .set({
            processedCalls: processedCount,
            issuesFound,
            trainingSamplesCreated: samplesCreated,
            updatedAt: new Date(),
          })
          .where(eq(mlAnalysisJobs.id, jobId));

      } catch (callError) {
        failedCount++;
        lastError = callError instanceof Error ? callError.message : "Unknown call processing error";
        console.error(`Error processing call ${call.id}:`, callError);
      }
    }

    if (processedCount === 0) {
      await db.update(mlAnalysisJobs)
        .set({
          status: "failed",
          processedCalls: 0,
          issuesFound,
          trainingSamplesCreated: samplesCreated,
          errorMessage: lastError || `Failed to analyze ${failedCount || callsToProcess.length} call(s). Check OpenAI configuration and transcripts.`,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(mlAnalysisJobs.id, jobId));
      return;
    }

    // Mark job complete
    await db.update(mlAnalysisJobs)
      .set({
        status: "completed",
        processedCalls: processedCount,
        issuesFound,
        trainingSamplesCreated: samplesCreated,
        errorMessage: failedCount > 0 ? `${failedCount} call(s) skipped or failed` : null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(mlAnalysisJobs.id, jobId));

  } catch (error) {
    console.error("ML processing error:", error);
    await db.update(mlAnalysisJobs)
      .set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        updatedAt: new Date(),
      })
      .where(eq(mlAnalysisJobs.id, jobId));
  }
}

router.get("/knowledge-recommendations", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const topicsList = await db.select().from(knowledgeTopics)
      .where(eq(knowledgeTopics.userId, req.userId))
      .orderBy(desc(knowledgeTopics.documentCount))
      .limit(20);

    const faqsList = await db.select().from(knowledgeFaqs)
      .where(eq(knowledgeFaqs.userId, req.userId))
      .limit(50);

    const entitiesList = await db.select().from(knowledgeEntities)
      .where(eq(knowledgeEntities.userId, req.userId))
      .limit(50);

    const articlesList = await db.select().from(generatedArticles)
      .where(eq(generatedArticles.userId, req.userId));

    const kbItems = await db.select({
      id: knowledgeBase.id,
      type: knowledgeBase.type,
      title: knowledgeBase.title,
      createdAt: knowledgeBase.createdAt,
    }).from(knowledgeBase)
      .where(eq(knowledgeBase.userId, req.userId));

    const recommendations: Array<{
      id: string;
      type: "expand_topic" | "fill_gap" | "update_stale" | "add_faq" | "cross_reference";
      priority: "high" | "medium" | "low";
      title: string;
      description: string;
      actionLabel: string;
      relatedTopics: string[];
    }> = [];

    topicsList.filter(t => t.documentCount < 3).forEach((topic, idx) => {
      recommendations.push({
        id: `expand-${topic.id}`,
        type: "expand_topic",
        priority: idx < 3 ? "high" : "medium",
        title: `Expand coverage on "${topic.name}"`,
        description: `This topic only has ${topic.documentCount} document(s). Adding more content will strengthen the AI's knowledge in this area.`,
        actionLabel: "Add Content",
        relatedTopics: [topic.name],
      });
    });

    const topicsWithFaqs = new Set(faqsList.map(f => f.question?.toLowerCase().split(' ').slice(0, 3).join(' ')));
    topicsList.filter(t => !topicsWithFaqs.has(t.name.toLowerCase().split(' ').slice(0, 3).join(' '))).slice(0, 5).forEach(topic => {
      recommendations.push({
        id: `faq-${topic.id}`,
        type: "add_faq",
        priority: "medium",
        title: `Create FAQ coverage for "${topic.name}"`,
        description: `No FAQ entries found related to this topic. Adding Q&A pairs improves AI response accuracy.`,
        actionLabel: "Generate FAQ",
        relatedTopics: [topic.name],
      });
    });

    const entityGroups = new Map<string, typeof entitiesList>();
    entitiesList.forEach(e => {
      const group = entityGroups.get(e.entityType) || [];
      group.push(e);
      entityGroups.set(e.entityType, group);
    });
    
    entityGroups.forEach((entities, type) => {
      if (entities.length > 3) {
        recommendations.push({
          id: `crossref-${type}`,
          type: "cross_reference",
          priority: "low",
          title: `Cross-reference ${entities.length} ${type} entities`,
          description: `Multiple ${type} entities detected. Creating connections between them strengthens the knowledge graph.`,
          actionLabel: "Analyze Links",
          relatedTopics: entities.slice(0, 3).map(e => e.name),
        });
      }
    });

    const priorityOrder = { high: 0, medium: 1, low: 2 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    res.json({
      recommendations: recommendations.slice(0, 12),
      summary: {
        totalTopics: topicsList.length,
        totalEntities: entitiesList.length,
        totalFaqs: faqsList.length,
        totalArticles: articlesList.length,
        totalSources: kbItems.length,
        coverageScore: Math.min(100, Math.round(
          ((topicsList.length > 0 ? 25 : 0) + 
           (entitiesList.length > 5 ? 25 : entitiesList.length * 5) +
           (faqsList.length > 10 ? 25 : faqsList.length * 2.5) +
           (articlesList.length > 5 ? 25 : articlesList.length * 5))
        )),
      }
    });
  } catch (error) {
    console.error("Error generating recommendations:", error);
    res.status(500).json({ error: "Failed to generate recommendations" });
  }
});

router.get("/training-insights", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const approvedSamples = await db.select({ count: count() })
      .from(mlTrainingSamples)
      .where(and(
        eq(mlTrainingSamples.userId, req.userId),
        eq(mlTrainingSamples.status, "approved")
      ));

    const totalSamples = await db.select({ count: count() })
      .from(mlTrainingSamples)
      .where(eq(mlTrainingSamples.userId, req.userId));

    const kbCount = await db.select({ count: count() })
      .from(knowledgeBase)
      .where(eq(knowledgeBase.userId, req.userId));

    const topicsCount = await db.select({ count: count() })
      .from(knowledgeTopics)
      .where(eq(knowledgeTopics.userId, req.userId));

    const entitiesCount = await db.select({ count: count() })
      .from(knowledgeEntities)
      .where(eq(knowledgeEntities.userId, req.userId));

    const faqsCount = await db.select({ count: count() })
      .from(knowledgeFaqs)
      .where(eq(knowledgeFaqs.userId, req.userId));

    const articlesCount = await db.select({ count: count() })
      .from(generatedArticles)
      .where(eq(generatedArticles.userId, req.userId));

    const graphNodesCount = await db.select({ count: count() })
      .from(knowledgeGraphNodes)
      .where(eq(knowledgeGraphNodes.userId, req.userId));

    const sources = kbCount[0]?.count || 0;
    const topics = topicsCount[0]?.count || 0;
    const entities = entitiesCount[0]?.count || 0;
    const faqs = faqsCount[0]?.count || 0;
    const articles = articlesCount[0]?.count || 0;
    const graphNodes = graphNodesCount[0]?.count || 0;
    const approved = approvedSamples[0]?.count || 0;
    const total = totalSamples[0]?.count || 0;

    const dimensions = [
      {
        name: "Data Ingestion",
        score: Math.min(100, sources * 10),
        description: `${sources} knowledge sources ingested`,
        status: sources >= 10 ? "excellent" : sources >= 5 ? "good" : sources > 0 ? "developing" : "not_started",
      },
      {
        name: "Topic Coverage",
        score: Math.min(100, topics * 8),
        description: `${topics} topics identified`,
        status: topics >= 12 ? "excellent" : topics >= 5 ? "good" : topics > 0 ? "developing" : "not_started",
      },
      {
        name: "Entity Recognition",
        score: Math.min(100, entities * 4),
        description: `${entities} entities extracted`,
        status: entities >= 25 ? "excellent" : entities >= 10 ? "good" : entities > 0 ? "developing" : "not_started",
      },
      {
        name: "FAQ Readiness",
        score: Math.min(100, faqs * 5),
        description: `${faqs} FAQ pairs detected`,
        status: faqs >= 20 ? "excellent" : faqs >= 8 ? "good" : faqs > 0 ? "developing" : "not_started",
      },
      {
        name: "Content Generation",
        score: Math.min(100, articles * 10),
        description: `${articles} articles generated`,
        status: articles >= 10 ? "excellent" : articles >= 3 ? "good" : articles > 0 ? "developing" : "not_started",
      },
      {
        name: "Knowledge Graph",
        score: Math.min(100, graphNodes * 3),
        description: `${graphNodes} graph nodes connected`,
        status: graphNodes >= 30 ? "excellent" : graphNodes >= 10 ? "good" : graphNodes > 0 ? "developing" : "not_started",
      },
      {
        name: "Training Samples",
        score: total > 0 ? Math.round((approved / total) * 100) : 0,
        description: `${approved}/${total} samples approved`,
        status: approved >= 50 ? "excellent" : approved >= 20 ? "good" : approved > 0 ? "developing" : "not_started",
      },
    ];

    const overallScore = Math.round(dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length);

    res.json({
      overallScore,
      dimensions,
      overallStatus: overallScore >= 80 ? "production_ready" : overallScore >= 50 ? "training" : overallScore > 0 ? "early_stage" : "not_started",
      totalDataPoints: sources + topics + entities + faqs + articles + graphNodes,
    });
  } catch (error) {
    console.error("Error fetching training insights:", error);
    res.status(500).json({ error: "Failed to fetch training insights" });
  }
});

// ============================================================
// GENERATE KB ARTICLES (AI-powered bulk article generation)
// ============================================================

router.post("/generate-kb-articles", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const existingItems = await db.select().from(knowledgeBase)
      .where(eq(knowledgeBase.userId, req.userId));

    const folders = await db.select().from(knowledgeFolders)
      .where(eq(knowledgeFolders.userId, req.userId));

    if (folders.length === 0) {
      return res.status(400).json({ error: "No knowledge folders found. Please create folders first." });
    }

    const existingContentSummary = existingItems
      .filter(item => !((item.metadata as any)?.aiGenerated))
      .slice(0, 10)
      .map(item => `- ${item.title}: ${(item.content || '').substring(0, 300)}`)
      .join('\n');

    const { awsBedrockService } = await import("../services/aws-bedrock");
    const bedrockConfigured = awsBedrockService.isConfigured();
    let openai: any = null;
    if (!bedrockConfigured) {
      const { getOpenAIClient } = await import("../services/openai-modelfarm");
      openai = await getOpenAIClient(req.userId);
    }

    const categoryArticleCounts: Record<string, number> = {
      "Products": 25,
      "Technical Support": 23,
      "FAQs": 23,
      "Billing & Payments": 22,
      "Account Management": 22,
      "Orders": 21,
      "Policies": 21,
      "Security & Privacy": 21,
      "Delivery": 20,
      "Glossary": 20,
      "Escalation": 20,
      "Contact Info": 20,
      "Conversation Scenarios": 20,
      "Call Center Operations": 20,
    };

    const allCreatedItems: any[] = [];
    const folderResults: Record<string, number> = {};

    for (const folder of folders) {
      const targetCount = categoryArticleCounts[folder.name] || 20;
      const existingInFolder = existingItems.filter(i => i.folderId === folder.id && !((i.metadata as any)?.aiGenerated)).length;

      console.log(`[KB Gen] Generating ${targetCount} articles for "${folder.name}" (has ${existingInFolder} existing)...`);

      const topicGuidance: Record<string, string> = {
        "Products": "eSIM product overview, data plan comparisons, regional vs global plans, compatible device list, plan features deep-dive, prepaid vs postpaid eSIMs, data speeds by region, interactive coverage maps, multi-device support, family plan options, business plan options, special introductory offers, seasonal travel promotions, bundle packages, product technical specifications, how to choose the right plan, unlimited data plans, short-term vs long-term plans, top destination country plans, marketplace overview and navigation",
        "Technical Support": "eSIM installation step-by-step, activation failure troubleshooting, no data connectivity fix, APN settings configuration, device compatibility guide, manual network switching, improving signal strength, VPN usage with eSIM, hotspot and tethering setup, dual SIM configuration, QR code scanning problems, data not working abroad, slow data speed fixes, roaming settings guide, firmware update impact on eSIM, eSIM profile deletion and reinstall, carrier lock issues, iOS eSIM setup guide, Android eSIM setup guide, Windows and Mac eSIM support",
        "FAQs": "what is an eSIM, how does eSIM work, eSIM vs physical SIM card, which devices support eSIM, how to activate your eSIM, tracking your data usage, what happens when plan expires, using multiple eSIMs on one device, can you share eSIM data, which countries are covered, am I eligible for a refund, recovering a locked account, available support languages, how payments are secured, what support channels are available, is eSIM permanent or removable, can I reuse my eSIM, eSIM for cruise ships, eSIM for remote work travelers, eSIM coverage in developing countries",
        "Billing & Payments": "accepted payment methods, pricing tier breakdown, multi-currency support, how invoices are generated, auto-renewal settings and cancellation, step-by-step refund process, using promo and coupon codes, managing your subscription, handling payment failures, viewing full transaction history, tax and VAT information, enterprise and volume billing, using the credit wallet, payment security and encryption, resolving billing disputes, split payment options, prepaid top-up process, invoicing for business accounts, upgrading or downgrading plans mid-cycle, free trial and promotional credit terms",
        "Account Management": "creating a new account, updating profile information, resetting your password, verifying your email address, enabling two-factor authentication, permanently deleting your account, managing notification preferences, fixing login and access issues, active session management, managing linked devices, reviewing account security settings, exporting your personal data, checking subscription status, upgrading your account tier, setting up team or sub-accounts, social login setup, language and region preferences, referral program management, account suspension recovery, switching account ownership",
        "Orders": "how to place an order, understanding your order confirmation, tracking your active order, cancelling an order before activation, modifying a pending order, placing bulk orders for groups, purchasing eSIMs as gifts, viewing full order history, how to reorder a previous plan, international order processing, express activation after purchase, order status notification settings, what to do when an order fails, downloading order receipts, enterprise and corporate orders, order placed but no email received, order confirmation delays, applying store credit to an order, order verification requirements, managing multiple simultaneous orders",
        "Policies": "terms of service summary, privacy policy highlights, acceptable use policy, fair usage policy explained, data retention and deletion policy, GDPR rights and compliance, cookie policy and consent management, refund and return policy, plan cancellation policy, service level agreement, content and conduct policy, intellectual property rights, platform liability limitations, dispute resolution process, minimum age requirements, anti-spam policy, reseller and partner policy, affiliate program terms, promotional terms and conditions, changes to terms notification process",
        "Security & Privacy": "how user data is encrypted, account security best practices, fraud prevention measures, how to spot phishing attacks, secure payment handling, managing your privacy settings, data sharing with third parties, security breach notification process, compliance certifications overview, VPN compatibility and recommendations, staying safe on public WiFi, identity verification process, how to report suspicious activity, security update notifications, your data rights and access requests, two-factor authentication setup guide, session hijacking prevention, device trust and management, password strength requirements, responding to unauthorized access",
        "Delivery": "how eSIM delivery works, instant QR code delivery explained, eSIM delivered by email guide, activation timeline after purchase, receiving your delivery confirmation, what to do if delivery is delayed, requesting a re-send of your eSIM, troubleshooting delivery issues, bulk delivery for teams, scheduling delivery for a future date, delivering eSIM to multiple recipients, tracking delivery status, setting up eSIM before you travel, eSIM as an airport alternative to local SIMs, resolving failed delivery, eSIM QR code expiry policy, forwarding an eSIM QR code safely, delivery to international email addresses, business delivery workflows, eSIM delivery for cruise and ship travel",
        "Glossary": "eSIM definition and meaning, APN explained, IMEI number guide, LTE vs 5G band differences, roaming definition, MNO vs MVNO comparison, SIM lock and unlock explained, data throttling and fair use, QR code provisioning process, SM-DP+ server role, EID number explained, carrier aggregation, VoLTE definition, ICCID number, IMSI explained, profile download process, eUICC explained, network slicing, dual connectivity, eSIM discovery and push methods",
        "Escalation": "when to escalate a customer issue, supervisor handoff process, handling formal complaints, what constitutes an SLA breach, escalation priority levels, escalation workflow step-by-step, customer retention during escalation, compensation and goodwill guidelines, executive escalation process, filing a regulatory complaint, managing social media escalations, legal escalation procedure, technical escalation tier system, closing the feedback loop post-escalation, post-escalation follow-up process, de-escalation communication techniques, escalation documentation requirements, time-to-resolve standards, escalation for payment disputes, escalation for connectivity outages",
        "Contact Info": "available support channels overview, customer support business hours, emergency contact procedures, official social media accounts, regional office locations, how to reach email support, live chat availability and hours, phone support numbers by region, country-specific support contacts, partner and reseller contacts, enterprise support team contact, accessibility support options, language-specific support availability, holiday and closure schedule, expected response times by channel, support ticket creation guide, escalating through the contact form, WhatsApp and messaging support, reporting abuse or fraud, press and media contact information",
        "Conversation Scenarios": "handling a first-time activation call, customer confused about plan options, billing dispute conversation flow, customer reporting no connectivity, angry customer de-escalation script, upselling to a higher-tier plan, cross-selling additional countries, welcome call for new customers, cancellation retention script, account recovery conversation, troubleshooting QR code via phone, addressing refund requests verbally, guiding a non-technical customer, handling language barriers, follow-up call after a complaint, confirming order status by phone, explaining eSIM compatibility, discussing travel itinerary and plan fit, after-hours call handling script, transferring to specialist or supervisor",
        "Call Center Operations": "call center agent onboarding, using the agent dashboard, handling inbound vs outbound calls, quality assurance and call monitoring, call wrap-up and disposition codes, knowledge base usage during a call, escalation protocols for agents, shift handover procedures, compliance and call recording rules, handling high call volume periods, agent performance metrics, customer satisfaction score tracking, after-call work best practices, CRM data entry during a call, using scripts and prompts effectively, multi-channel support coordination, agent coaching and feedback, handling technical issues mid-call, break and schedule management, emergency procedures during system outages",
      };

      const topics = topicGuidance[folder.name] || `Generate 20 comprehensive knowledge base articles covering all important customer support topics relevant to the "${folder.name}" category for an eSIM marketplace platform`;

      const prompt = `You are a professional knowledge base writer for Tejwal eSIM — an eSIM marketplace for travelers providing instant global connectivity in 200+ countries starting from $3.30.

Business context from existing knowledge base:
${existingContentSummary || 'Tejwal eSIM offers instant eSIM activation, no physical SIM needed, covering 200+ countries with 500K+ happy travelers, 4.9/5 rating, and 24/7 support.'}

Generate exactly ${targetCount} knowledge base articles for the "${folder.name}" category.

Topic areas to cover (one article per topic, prioritized by customer importance):
${topics}

Requirements:
- Each article must be 400-700 words
- Write in a professional, clear support-agent style
- Include specific details relevant to Tejwal eSIM (pricing starting from $3.30, 200+ countries, instant activation, QR code delivery, etc.)
- Each article should have a clear, descriptive title
- Content should help customer support agents handle real customer inquiries
- Include step-by-step instructions where applicable
- Mention specific features, processes, and policies
- Every article must be on a DIFFERENT topic — do not repeat topics

Return ONLY a valid JSON array: [{"title": "...", "content": "..."}]
Do NOT include any markdown, code blocks, or extra text.`;

      try {
        let responseText: string;

        if (bedrockConfigured) {
          console.log(`[KB Gen] Using Claude Bedrock (claude-3-5-haiku) for "${folder.name}"...`);
          try {
            const bedrockResponse = await awsBedrockService.invoke({
              model: "claude-3-5-haiku",
              messages: [{ role: "user", content: prompt }],
              systemPrompt: "You are a professional knowledge base content writer. Always respond with valid JSON only. No markdown, no code blocks, no explanations.",
              maxTokens: 16000,
              temperature: 0.7,
            });
            responseText = bedrockResponse.content;
          } catch (bedrockErr: any) {
            console.warn(`[KB Gen] Bedrock failed for "${folder.name}", falling back to OpenAI: ${bedrockErr.message}`);
            if (!openai) {
              const { getOpenAIClient } = await import("../services/openai-modelfarm");
              openai = await getOpenAIClient(req.userId);
            }
            const completion = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: "You are a professional knowledge base content writer. Always respond with valid JSON only. No markdown, no code blocks, no explanations." },
                { role: "user", content: prompt }
              ],
              temperature: 0.7,
              max_tokens: 16000,
            });
            responseText = completion.choices[0]?.message?.content || '[]';
          }
        } else {
          console.log(`[KB Gen] Bedrock not configured, using OpenAI for "${folder.name}"...`);
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: "You are a professional knowledge base content writer. Always respond with valid JSON only. No markdown, no code blocks, no explanations." },
              { role: "user", content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 16000,
          });
          responseText = completion.choices[0]?.message?.content || '[]';
        }

        const parseArticles = (raw: string): Array<{ title: string; content: string }> => {
          const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          try {
            const parsed = JSON.parse(cleaned);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            console.error(`[KB Gen] JSON parse failed for "${folder.name}":`, cleaned.substring(0, 200));
            return [];
          }
        };

        const insertArticles = async (articles: Array<{ title: string; content: string }>): Promise<number> => {
          let count = 0;
          for (const article of articles) {
            if (!article.title || !article.content) continue;
            const contentText = article.content;
            const storageSize = Buffer.byteLength(contentText, 'utf8');
            const [inserted] = await db.insert(knowledgeBase).values({
              userId: req.userId,
              folderId: folder.id,
              type: 'text',
              title: article.title,
              content: contentText,
              url: null,
              fileUrl: null,
              elevenLabsDocId: null,
              metadata: { ragEnabled: true, aiGenerated: true },
              storageSize,
            }).returning();
            allCreatedItems.push({ id: inserted.id, title: inserted.title, folder: folder.name });
            count++;
            RAGKnowledgeService.processKnowledgeItem(
              inserted.id,
              req.userId!,
              contentText,
              { source: 'text' }
            ).catch(err => console.error(`[KB Gen] RAG error for ${inserted.id}:`, err));
          }
          return count;
        };

        const generateArticleText = async (count: number, extraContext?: string): Promise<string> => {
          const topUpPrompt = `${prompt}${extraContext ? `\n\nNote: You previously generated some articles. Generate ${count} ADDITIONAL articles on DIFFERENT topics not already covered.` : ''}`;
          if (bedrockConfigured) {
            try {
              const br = await awsBedrockService.invoke({
                model: "claude-3-5-haiku",
                messages: [{ role: "user", content: topUpPrompt }],
                systemPrompt: "You are a professional knowledge base content writer. Always respond with valid JSON only. No markdown, no code blocks, no explanations.",
                maxTokens: 16000,
                temperature: 0.75,
              });
              return br.content;
            } catch (e: any) {
              console.warn(`[KB Gen] Bedrock top-up failed, using OpenAI: ${e.message}`);
            }
          }
          if (!openai) {
            const { getOpenAIClient } = await import("../services/openai-modelfarm");
            openai = await getOpenAIClient(req.userId);
          }
          const c = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: "You are a professional knowledge base content writer. Always respond with valid JSON only. No markdown, no code blocks, no explanations." },
              { role: "user", content: topUpPrompt }
            ],
            temperature: 0.75,
            max_tokens: 16000,
          });
          return c.choices[0]?.message?.content || '[]';
        };

        let articles = parseArticles(responseText);
        let insertedCount = await insertArticles(articles);

        const MAX_TOPUP_ROUNDS = 2;
        let topUpRound = 0;
        while (insertedCount < targetCount && topUpRound < MAX_TOPUP_ROUNDS) {
          const needed = targetCount - insertedCount;
          console.log(`[KB Gen] "${folder.name}" under-returned (${insertedCount}/${targetCount}). Top-up round ${topUpRound + 1}: requesting ${needed} more...`);
          try {
            const topUpText = await generateArticleText(needed, `already_generated_${insertedCount}`);
            const topUpArticles = parseArticles(topUpText);
            if (topUpArticles.length === 0) break;
            const added = await insertArticles(topUpArticles);
            insertedCount += added;
          } catch (topUpErr: any) {
            console.warn(`[KB Gen] Top-up round ${topUpRound + 1} failed for "${folder.name}": ${topUpErr.message}`);
            break;
          }
          topUpRound++;
        }

        folderResults[folder.name] = insertedCount;
        const modelUsed = bedrockConfigured ? 'claude-3-5-haiku (Bedrock)' : 'gpt-4o-mini (OpenAI)';
        console.log(`[KB Gen] "${folder.name}": ${insertedCount}/${targetCount} articles created (model: ${modelUsed}, top-up rounds: ${topUpRound})`);
      } catch (folderError: any) {
        console.error(`[KB Gen] Error generating for "${folder.name}":`, folderError.message);
        folderResults[folder.name] = 0;
      }
    }

    res.status(201).json({
      message: `Successfully generated ${allCreatedItems.length} knowledge base articles across ${Object.keys(folderResults).length} categories`,
      summary: folderResults,
      totalArticles: allCreatedItems.length,
      articles: allCreatedItems,
    });
  } catch (error: any) {
    console.error("Error generating KB articles:", error);
    res.status(500).json({ error: error.message || "Failed to generate knowledge base articles" });
  }
});

async function fetchWebContent(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AgentLabs-KnowledgeBot/1.0', 'Accept': 'text/html, */*' },
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    let html = await response.text();
    html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
    html = html.replace(/<style[\s\S]*?<\/style>/gi, '');
    let text = html.replace(/<[^>]+>/g, ' ');
    text = text.replace(/\s+/g, ' ').trim();
    return text.substring(0, 4000);
  } catch {
    return null;
  }
}

router.post("/generate-from-recommendation", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { title, description, type, relatedTopics } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: "Title and description are required" });
    }

    let sourceUrl: string | null = null;

    const userCrawlJobs = await db.select({ startUrl: crawlJobs.startUrl })
      .from(crawlJobs)
      .where(eq(crawlJobs.userId, req.userId))
      .orderBy(desc(crawlJobs.createdAt))
      .limit(5);

    if (userCrawlJobs.length > 0) {
      sourceUrl = userCrawlJobs[0].startUrl;
    }

    if (!sourceUrl) {
      const kbWithUrls = await db.select({ url: knowledgeBase.url })
        .from(knowledgeBase)
        .where(and(eq(knowledgeBase.userId, req.userId), sql`${knowledgeBase.url} IS NOT NULL`))
        .limit(1);
      if (kbWithUrls.length > 0 && kbWithUrls[0].url) {
        sourceUrl = kbWithUrls[0].url;
      }
    }

    let websiteContent: string | null = null;
    if (sourceUrl) {
      websiteContent = await fetchWebContent(sourceUrl);
    }

    const { getOpenAIClient } = await import("../services/openai-modelfarm");
    const openai = await getOpenAIClient(req.userId);

    const topicsContext = relatedTopics && relatedTopics.length > 0
      ? `\nRelated Topics: ${relatedTopics.join(", ")}`
      : "";

    const websiteContentSection = websiteContent
      ? `\n\nSource Website Content:\n${websiteContent}\n\nUse the above website content as the primary source of truth when writing the article. Ensure all facts, details, and information come directly from this content.`
      : "";

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a professional knowledge base writer. Generate comprehensive, well-structured articles for a knowledge base. Write in a clear, professional style suitable for customer support agents and end users. Include relevant details, step-by-step instructions where applicable, and practical examples.`
        },
        {
          role: "user",
          content: `Generate a comprehensive knowledge base article based on the following recommendation:

Title: ${title}
Description: ${description}
Type: ${type || "general"}${topicsContext}${websiteContentSection}

Requirements:
- Write a detailed, well-structured article (500-1000 words)
- Use clear headings and subheadings
- Include practical information and actionable guidance
- Make it suitable for a professional knowledge base
- Do not include meta-commentary about the article itself`
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const generatedContent = response.choices[0]?.message?.content?.trim();
    if (!generatedContent) {
      return res.status(500).json({ error: "Failed to generate content from AI" });
    }

    const storageSize = Buffer.byteLength(generatedContent, 'utf8');

    const [created] = await db.insert(knowledgeBase).values({
      userId: req.userId,
      type: 'text',
      title,
      content: generatedContent,
      url: null,
      fileUrl: null,
      elevenLabsDocId: null,
      metadata: {
        ragEnabled: true,
        aiGenerated: true,
        recommendationType: type,
        sourceUrl: sourceUrl || undefined,
        hasWebContent: !!websiteContent,
        generatedWithoutSource: !websiteContent,
      },
      storageSize,
      ragStatus: 'pending',
    }).returning();

    try {
      RAGKnowledgeService.processKnowledgeItem(
        created.id,
        req.userId,
        generatedContent,
        { source: 'text' }
      ).catch(err => console.error(`[Recommendation Gen] RAG error for ${created.id}:`, err));
    } catch (ragError) {
      console.error("[Recommendation Gen] RAG processing trigger failed:", ragError);
    }

    res.status(201).json(created);
  } catch (error: any) {
    console.error("Error generating from recommendation:", error);
    res.status(500).json({ error: error.message || "Failed to generate article from recommendation" });
  }
});

export function createKnowledgeIntelligenceRoutes(): Router {
  return router;
}
