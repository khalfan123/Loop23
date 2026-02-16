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
  calls
} from "@shared/schema";
import { RAGKnowledgeService } from "../services/rag-knowledge";
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

    // Get available calls with transcripts
    const [callsWithTranscripts] = await db.select({ count: count() })
      .from(calls)
      .where(and(
        eq(calls.userId, req.userId),
        sql`${calls.transcript} IS NOT NULL AND ${calls.transcript} != ''`
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

    // Get calls with transcripts in date range
    let callsQuery = db.select().from(calls)
      .where(and(
        eq(calls.userId, req.userId),
        sql`${calls.transcript} IS NOT NULL AND ${calls.transcript} != ''`
      ));

    const callsToAnalyze = await callsQuery.orderBy(desc(calls.createdAt));

    if (callsToAnalyze.length === 0) {
      return res.status(400).json({ error: "No calls with transcripts available for analysis" });
    }

    // Create analysis job
    const [job] = await db.insert(mlAnalysisJobs).values({
      userId: req.userId,
      name: name || `Analysis ${new Date().toLocaleDateString()}`,
      totalCalls: callsToAnalyze.length,
      dateRangeStart: dateRangeStart ? new Date(dateRangeStart) : null,
      dateRangeEnd: dateRangeEnd ? new Date(dateRangeEnd) : null,
      status: "processing",
      startedAt: new Date(),
    }).returning();

    // Process calls in background
    processCallsForML(req.userId, job.id, callsToAnalyze).catch(err => {
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

    let query = db.select().from(mlTrainingSamples)
      .where(eq(mlTrainingSamples.userId, req.userId));

    if (status && status !== "all") {
      query = query.where(and(
        eq(mlTrainingSamples.userId, req.userId),
        eq(mlTrainingSamples.status, status)
      ));
    }

    const samples = await query.orderBy(desc(mlTrainingSamples.createdAt)).limit(limit);

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

  try {
    for (const call of callsToProcess) {
      if (!call.transcript) continue;

      try {
        const openai = await getOpenAIClient(userId);
        
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
              content: call.transcript
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
          transcriptLength: call.transcript.length,
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
        console.error(`Error processing call ${call.id}:`, callError);
      }
    }

    // Mark job complete
    await db.update(mlAnalysisJobs)
      .set({
        status: "completed",
        processedCalls: processedCount,
        issuesFound,
        trainingSamplesCreated: samplesCreated,
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

    const folderItemCounts = new Map<string, number>();
    for (const folder of folders) {
      folderItemCounts.set(folder.id, 0);
    }
    for (const item of existingItems) {
      if (item.folderId && folderItemCounts.has(item.folderId)) {
        folderItemCounts.set(item.folderId, (folderItemCounts.get(item.folderId) || 0) + 1);
      }
    }

    const existingContentSummary = existingItems
      .slice(0, 10)
      .map(item => `- ${item.title}: ${(item.content || '').substring(0, 200)}`)
      .join('\n');

    const folderAssignments: { folderName: string; folderId: string; articlesToGenerate: number }[] = [];
    let totalArticles = 0;

    for (const folder of folders) {
      const itemCount = folderItemCounts.get(folder.id) || 0;
      let articlesToGenerate = 0;
      if (itemCount === 0) {
        articlesToGenerate = totalArticles < 13 ? 2 : 1;
      } else {
        articlesToGenerate = 1;
      }
      if (totalArticles + articlesToGenerate > 15) {
        articlesToGenerate = 15 - totalArticles;
      }
      if (articlesToGenerate > 0) {
        folderAssignments.push({ folderName: folder.name, folderId: folder.id, articlesToGenerate });
        totalArticles += articlesToGenerate;
      }
      if (totalArticles >= 15) break;
    }

    const folderInstructions = folderAssignments
      .map(f => `- "${f.folderName}": generate exactly ${f.articlesToGenerate} article(s)`)
      .join('\n');

    const prompt = `You are a professional knowledge base content writer for Tejwal eSIM, an eSIM marketplace for travelers offering global connectivity in 200+ countries. Generate exactly ${totalArticles} knowledge base articles for a customer support team.

Here is existing knowledge base content for context:
${existingContentSummary || 'No existing content yet.'}

Generate articles for these folders (generate the exact number specified for each):
${folderInstructions}

Requirements:
- Each article should be 500-800 words
- Content should be professional, helpful, and specific to the Tejwal eSIM platform
- Articles should cover common customer support scenarios, policies, and procedures
- Include practical information that support agents can reference during calls
- Make content specific to eSIM technology, international travel connectivity, and the Tejwal platform

Return ONLY a valid JSON array with objects containing: folderName, title, content
Example format: [{"folderName": "FAQs", "title": "...", "content": "..."}]`;

    const { getOpenAIClient } = await import("../services/openai-modelfarm");
    const openai = await getOpenAIClient(req.userId);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a professional knowledge base content writer. Always respond with valid JSON only, no markdown formatting or code blocks." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 16000,
    });

    const responseText = completion.choices[0]?.message?.content || '[]';
    const cleanedResponse = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let generatedArticles: Array<{ folderName: string; title: string; content: string }>;
    try {
      generatedArticles = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", cleanedResponse.substring(0, 500));
      return res.status(500).json({ error: "Failed to parse AI-generated content" });
    }

    if (!Array.isArray(generatedArticles) || generatedArticles.length === 0) {
      return res.status(500).json({ error: "AI returned empty or invalid response" });
    }

    const folderNameToId = new Map<string, string>();
    for (const folder of folders) {
      folderNameToId.set(folder.name.toLowerCase(), folder.id);
    }

    const createdItems: any[] = [];

    for (const article of generatedArticles) {
      const folderId = folderNameToId.get(article.folderName?.toLowerCase() || '');
      if (!folderId) {
        console.warn(`Skipping article "${article.title}" - folder "${article.folderName}" not found`);
        continue;
      }

      const contentText = article.content || '';
      const storageSize = Buffer.byteLength(contentText, 'utf8');

      const [inserted] = await db.insert(knowledgeBase).values({
        userId: req.userId,
        folderId,
        type: 'text',
        title: article.title,
        content: contentText,
        url: null,
        fileUrl: null,
        elevenLabsDocId: null,
        metadata: { ragEnabled: true, aiGenerated: true },
        storageSize,
      }).returning();

      createdItems.push(inserted);

      RAGKnowledgeService.processKnowledgeItem(
        inserted.id,
        req.userId!,
        contentText,
        { source: 'text' }
      ).catch(err => console.error(`[KB Gen] RAG processing error for ${inserted.id}:`, err));
    }

    res.status(201).json({
      message: `Successfully generated ${createdItems.length} knowledge base articles`,
      articles: createdItems,
    });
  } catch (error: any) {
    console.error("Error generating KB articles:", error);
    res.status(500).json({ error: error.message || "Failed to generate knowledge base articles" });
  }
});

export function createKnowledgeIntelligenceRoutes(): Router {
  return router;
}
