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
  knowledgePipelineJobs
} from "@shared/schema";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { createCrawler } from "../services/knowledge-crawler";
import { createContentProcessor } from "../services/content-processor";
import { createKnowledgeAIAnalyzer } from "../services/knowledge-ai-analyzer";
import { createContentGenerator } from "../services/content-generator";
import { createTopicIntelligence, type WebsiteNature, type TopicCluster } from "../services/topic-intelligence";

interface AuthRequest extends Request {
  userId?: string;
}

const router = Router();

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
      crawlType = 'single',
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
    await processor.processAllPages(pipelineJob.crawlJobId);

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
        stageDetails.analyzing.entitiesFound += result?.entitiesExtracted || 0;
        stageDetails.analyzing.topicsFound += result?.topicsAssigned || 0;
        stageDetails.analyzing.faqsFound += result?.faqsDetected || 0;
        
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
    // Use Topic Intelligence to automatically mine topics, score them, and generate articles
    await db.update(knowledgePipelineJobs)
      .set({ status: "generating", updatedAt: new Date() })
      .where(eq(knowledgePipelineJobs.id, pipelineJobId));

    stageDetails.generating.startedAt = new Date().toISOString();
    await updateProgress("generating", 0, 68, 120, stageDetails);

    const topicIntelligence = createTopicIntelligence(userId);
    
    try {
      // Run the intelligent auto-generation pipeline
      // This analyzes website nature, mines topics, expands them, scores them, and generates articles
      const autoGenResult = await topicIntelligence.runAutoGeneration(
        pipelineJobId,
        pipelineJob.crawlJobId,
        15 // Max articles to generate
      );

      // Update stage details with topic intelligence results
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
      
      // Fallback to basic topic-based generation
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

// Get active pipeline job (most recent running job)
router.get("/pipeline-jobs/active", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [activeJob] = await db.select().from(knowledgePipelineJobs)
      .where(and(
        eq(knowledgePipelineJobs.userId, req.userId),
        sql`${knowledgePipelineJobs.status} IN ('pending', 'crawling', 'analyzing', 'generating')`
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

router.get("/pipeline-jobs/active", async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [job] = await db.select().from(knowledgePipelineJobs)
      .where(and(
        eq(knowledgePipelineJobs.userId, req.userId),
        sql`${knowledgePipelineJobs.status} IN ('pending', 'crawling', 'analyzing', 'generating', 'completed', 'failed')`
      ))
      .orderBy(desc(knowledgePipelineJobs.createdAt))
      .limit(1);

    if (!job) {
      return res.json(null);
    }

    res.json(job);
  } catch (error) {
    console.error("Error fetching active pipeline job:", error);
    res.status(500).json({ error: "Failed to fetch active pipeline job" });
  }
});

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

export function createKnowledgeIntelligenceRoutes(): Router {
  return router;
}
