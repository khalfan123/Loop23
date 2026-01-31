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
  knowledgeBase
} from "@shared/schema";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { createCrawler } from "../services/knowledge-crawler";
import { createContentProcessor } from "../services/content-processor";
import { createKnowledgeAIAnalyzer } from "../services/knowledge-ai-analyzer";
import { createContentGenerator } from "../services/content-generator";

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

    const knowledgeItems = await db.select().from(ragKnowledge)
      .where(eq(ragKnowledge.userId, req.userId))
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

export function createKnowledgeIntelligenceRoutes(): Router {
  return router;
}
