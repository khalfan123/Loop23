/**
 * Pipeline Orchestrator Service
 * 
 * Manages automated ML pipeline workflows for the Knowledge Intelligence System.
 * Features:
 * - Scheduled pipeline execution
 * - Event-triggered processing
 * - Pipeline state management
 * - Progress tracking and notifications
 * - Content refresh detection
 */

import { db } from "../db";
import { 
  knowledgePipelineJobs,
  crawlJobs,
  crawlPages,
  knowledgeBase,
  contentAuditLog
} from "@shared/schema";
import { eq, and, sql, desc, lte, gte, isNull } from "drizzle-orm";
import { createCrawler } from "./knowledge-crawler";
import { createContentProcessor } from "./content-processor";
import { createKnowledgeAIAnalyzer } from "./knowledge-ai-analyzer";
import { createTopicIntelligence } from "./topic-intelligence";
import { createMLContentAnalyzer } from "./ml-content-analyzer";

export interface PipelineConfig {
  name: string;
  crawlJobId?: string;
  startUrl?: string;
  crawlType?: 'single' | 'sitemap' | 'recursive' | 'comprehensive';
  maxPages?: number;
  maxDepth?: number;
  respectRobotsTxt?: boolean;
  includePaths?: string[];
  excludePaths?: string[];
  folderId?: string;
  maxArticles?: number;
  scheduleEnabled?: boolean;
  scheduleInterval?: 'daily' | 'weekly' | 'monthly';
  scheduledAt?: Date;
}

type KnowledgePipelineJobRecord = typeof knowledgePipelineJobs.$inferSelect & {
  maxArticles?: number | null;
};

export interface PipelineProgress {
  stage: string;
  stageProgress: number;
  overallProgress: number;
  estimatedTimeRemaining: number | null;
  stageDetails: {
    crawling: {
      pagesDiscovered: number;
      pagesCrawled: number;
      startedAt?: string;
      completedAt?: string;
    };
    analyzing: {
      itemsTotal: number;
      itemsProcessed: number;
      entitiesFound: number;
      topicsFound: number;
      faqsFound: number;
      startedAt?: string;
      completedAt?: string;
    };
    generating: {
      articlesPlanned: number;
      articlesGenerated: number;
      startedAt?: string;
      completedAt?: string;
    };
    websiteNature?: {
      industry: string;
      productCategory: string;
      features: number;
      personas: number;
    };
    topicMining?: {
      topicsDiscovered: number;
      topicsExpanded: number;
      topicsSelected: number;
      clusters: number;
    };
    contentQuality?: {
      averageScore: number;
      duplicatesFound: number;
      clustersDetected: number;
    };
  };
}

export interface ScheduledPipeline {
  id: string;
  name: string;
  config: PipelineConfig;
  nextRun: Date;
  lastRun?: Date;
  status: 'active' | 'paused' | 'error';
  runCount: number;
}

/**
 * Pipeline Orchestrator class
 */
export class PipelineOrchestrator {
  private userId: string;
  private activeJobs: Map<string, { cancel: () => void }> = new Map();

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Create and start a new pipeline
   */
  async createPipeline(config: PipelineConfig): Promise<string> {
    let crawlJobId = config.crawlJobId;

    if (!crawlJobId && config.startUrl) {
      const [crawlJob] = await db.insert(crawlJobs).values({
        userId: this.userId,
        name: `${config.name} - Crawl`,
        startUrl: config.startUrl,
        crawlType: config.crawlType || 'comprehensive',
        maxPages: config.maxPages || 50,
        maxDepth: config.maxDepth || 3,
        respectRobotsTxt: config.respectRobotsTxt ?? true,
        includePaths: config.includePaths,
        excludePaths: config.excludePaths,
        folderId: config.folderId
      }).returning();

      crawlJobId = crawlJob.id;
    }

    if (!crawlJobId) {
      throw new Error("Either crawlJobId or startUrl must be provided");
    }

    const [pipelineJob] = await db.insert(knowledgePipelineJobs).values({
      userId: this.userId,
      crawlJobId,
      name: config.name,
      status: "pending",
      currentStage: "pending",
      stageProgress: 0,
      overallProgress: 0
    }).returning();

    await db.insert(contentAuditLog).values({
      userId: this.userId,
      actionType: 'create',
      resourceType: 'pipeline_job',
      resourceId: pipelineJob.id,
      details: { config }
    });

    return pipelineJob.id;
  }

  /**
   * Start a pipeline execution
   */
  async startPipeline(pipelineJobId: string): Promise<void> {
    const [pipelineJob] = await db.select().from(knowledgePipelineJobs)
      .where(eq(knowledgePipelineJobs.id, pipelineJobId));

    if (!pipelineJob) {
      throw new Error("Pipeline job not found");
    }

    if (pipelineJob.status === "running" || pipelineJob.status === "crawling" || 
        pipelineJob.status === "analyzing" || pipelineJob.status === "generating") {
      throw new Error("Pipeline is already running");
    }

    this.runPipelineAsync(pipelineJobId).catch(err => {
      console.error(`Pipeline ${pipelineJobId} failed:`, err);
    });
  }

  /**
   * Run pipeline asynchronously
   */
  private async runPipelineAsync(pipelineJobId: string): Promise<void> {
    let cancelled = false;
    this.activeJobs.set(pipelineJobId, {
      cancel: () => { cancelled = true; }
    });

    const updateProgress = async (progress: Partial<PipelineProgress>) => {
      if (cancelled) return;
      
      await db.update(knowledgePipelineJobs)
        .set({
          currentStage: progress.stage,
          stageProgress: progress.stageProgress,
          overallProgress: progress.overallProgress,
          estimatedTimeRemaining: progress.estimatedTimeRemaining,
          stageDetails: progress.stageDetails as any,
          updatedAt: new Date()
        })
        .where(eq(knowledgePipelineJobs.id, pipelineJobId));
    };

    try {
      const [pipelineJob] = await db.select().from(knowledgePipelineJobs)
        .where(eq(knowledgePipelineJobs.id, pipelineJobId));

      if (!pipelineJob?.crawlJobId) {
        throw new Error("Pipeline job not found or missing crawl job");
      }

      const stageDetails: PipelineProgress['stageDetails'] = {
        crawling: { pagesDiscovered: 0, pagesCrawled: 0 },
        analyzing: { itemsTotal: 0, itemsProcessed: 0, entitiesFound: 0, topicsFound: 0, faqsFound: 0 },
        generating: { articlesPlanned: 0, articlesGenerated: 0 }
      };

      await db.update(knowledgePipelineJobs)
        .set({ status: "crawling", startedAt: new Date(), updatedAt: new Date() })
        .where(eq(knowledgePipelineJobs.id, pipelineJobId));

      stageDetails.crawling.startedAt = new Date().toISOString();
      await updateProgress({
        stage: "crawling",
        stageProgress: 0,
        overallProgress: 5,
        estimatedTimeRemaining: 120,
        stageDetails
      });

      const crawler = createCrawler(this.userId);
      await crawler.startCrawl(pipelineJob.crawlJobId);

      let crawlComplete = false;
      const crawlStartTime = Date.now();

      while (!crawlComplete && !cancelled) {
        await new Promise(resolve => setTimeout(resolve, 2000));

        const [crawlJob] = await db.select().from(crawlJobs)
          .where(eq(crawlJobs.id, pipelineJob.crawlJobId));

        if (!crawlJob) break;

        stageDetails.crawling.pagesDiscovered = crawlJob.pagesDiscovered;
        stageDetails.crawling.pagesCrawled = crawlJob.pagesCrawled;

        const progress = crawlJob.maxPages > 0
          ? Math.min(95, Math.round((crawlJob.pagesCrawled / crawlJob.maxPages) * 100))
          : 50;

        const elapsed = (Date.now() - crawlStartTime) / 1000;
        const remaining = Math.max(0, Math.round((elapsed / Math.max(progress, 1)) * (100 - progress)));

        await updateProgress({
          stage: "crawling",
          stageProgress: progress,
          overallProgress: Math.round(progress * 0.33),
          estimatedTimeRemaining: remaining + 60,
          stageDetails
        });

        if (crawlJob.status === "completed" || crawlJob.status === "failed") {
          crawlComplete = true;
          stageDetails.crawling.completedAt = new Date().toISOString();
        }
      }

      if (cancelled) return;

      const processor = createContentProcessor(this.userId);
      await processor.processJobPages(pipelineJob.crawlJobId);

      const mlAnalyzer = createMLContentAnalyzer(this.userId);
      const clusterResult = await mlAnalyzer.detectContentClusters();
      stageDetails.contentQuality = {
        averageScore: 0,
        duplicatesFound: 0,
        clustersDetected: clusterResult.clusters.length
      };

      await updateProgress({
        stage: "crawling",
        stageProgress: 100,
        overallProgress: 33,
        estimatedTimeRemaining: 60,
        stageDetails
      });

      if (cancelled) return;

      await db.update(knowledgePipelineJobs)
        .set({ status: "analyzing", updatedAt: new Date() })
        .where(eq(knowledgePipelineJobs.id, pipelineJobId));

      stageDetails.analyzing.startedAt = new Date().toISOString();
      await updateProgress({
        stage: "analyzing",
        stageProgress: 0,
        overallProgress: 35,
        estimatedTimeRemaining: 90,
        stageDetails
      });

      const knowledgeItems = await db.select().from(knowledgeBase)
        .where(eq(knowledgeBase.userId, this.userId))
        .limit(20);

      stageDetails.analyzing.itemsTotal = knowledgeItems.length;

      const analyzer = createKnowledgeAIAnalyzer(this.userId);
      let analyzed = 0;
      let totalQuality = 0;

      for (const item of knowledgeItems) {
        if (cancelled) return;

        try {
          const result = await analyzer.analyzeKnowledgeBaseItem(item.id);
          analyzed++;

          if (item.content) {
            const contentAnalysis = mlAnalyzer.analyzeContent(item.content);
            totalQuality += contentAnalysis.quality.overall;
          }

          stageDetails.analyzing.itemsProcessed = analyzed;
          stageDetails.analyzing.entitiesFound += result?.entities || 0;
          stageDetails.analyzing.topicsFound += result?.topics || 0;
          stageDetails.analyzing.faqsFound += result?.faqs || 0;

          if (stageDetails.contentQuality) {
            stageDetails.contentQuality.averageScore = Math.round(totalQuality / analyzed);
          }

          const progress = Math.round((analyzed / knowledgeItems.length) * 100);
          const remaining = Math.max(0, Math.round((knowledgeItems.length - analyzed) * 3));

          await updateProgress({
            stage: "analyzing",
            stageProgress: progress,
            overallProgress: 33 + Math.round(progress * 0.33),
            estimatedTimeRemaining: remaining + 30,
            stageDetails
          });
        } catch (error) {
          console.error(`Failed to analyze item ${item.id}:`, error);
        }
      }

      stageDetails.analyzing.completedAt = new Date().toISOString();
      await updateProgress({
        stage: "analyzing",
        stageProgress: 100,
        overallProgress: 66,
        estimatedTimeRemaining: 30,
        stageDetails
      });

      if (cancelled) return;

      await db.update(knowledgePipelineJobs)
        .set({ status: "generating", updatedAt: new Date() })
        .where(eq(knowledgePipelineJobs.id, pipelineJobId));

      stageDetails.generating.startedAt = new Date().toISOString();
      await updateProgress({
        stage: "generating",
        stageProgress: 0,
        overallProgress: 68,
        estimatedTimeRemaining: 120,
        stageDetails
      });

      const topicIntelligence = createTopicIntelligence(this.userId);

      try {
        const autoGenResult = await topicIntelligence.runAutoGeneration(
          pipelineJobId,
          pipelineJob.crawlJobId,
          (pipelineJob as KnowledgePipelineJobRecord).maxArticles || 15
        );

        stageDetails.websiteNature = {
          industry: autoGenResult.websiteNature.industryDomain,
          productCategory: autoGenResult.websiteNature.productCategory,
          features: autoGenResult.websiteNature.productFeatures?.length || 0,
          personas: autoGenResult.websiteNature.customerPersonas?.length || 0
        };

        stageDetails.topicMining = {
          topicsDiscovered: autoGenResult.topicsDiscovered,
          topicsExpanded: autoGenResult.topicsExpanded,
          topicsSelected: autoGenResult.topicsSelected,
          clusters: autoGenResult.clusters?.length || 0
        };

        stageDetails.generating.articlesPlanned = autoGenResult.topicsSelected;
        stageDetails.generating.articlesGenerated = autoGenResult.articlesGenerated;
        stageDetails.generating.completedAt = new Date().toISOString();
      } catch (error) {
        console.error("Topic intelligence failed:", error);
        stageDetails.generating.completedAt = new Date().toISOString();
      }

      await db.update(knowledgePipelineJobs)
        .set({
          status: "completed",
          currentStage: "completed",
          stageProgress: 100,
          overallProgress: 100,
          stageDetails: stageDetails as any,
          completedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(knowledgePipelineJobs.id, pipelineJobId));

      await db.insert(contentAuditLog).values({
        userId: this.userId,
        actionType: 'complete',
        resourceType: 'pipeline_job',
        resourceId: pipelineJobId,
        details: { stageDetails }
      });

    } catch (error) {
      console.error(`Pipeline ${pipelineJobId} failed:`, error);

      await db.update(knowledgePipelineJobs)
        .set({
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
          updatedAt: new Date()
        })
        .where(eq(knowledgePipelineJobs.id, pipelineJobId));
    } finally {
      this.activeJobs.delete(pipelineJobId);
    }
  }

  /**
   * Cancel a running pipeline
   */
  async cancelPipeline(pipelineJobId: string): Promise<void> {
    const activeJob = this.activeJobs.get(pipelineJobId);
    if (activeJob) {
      activeJob.cancel();
    }

    await db.update(knowledgePipelineJobs)
      .set({
        status: "failed",
        errorMessage: "Cancelled by user",
        updatedAt: new Date()
      })
      .where(eq(knowledgePipelineJobs.id, pipelineJobId));
  }

  /**
   * Get active pipeline job
   */
  async getActivePipeline(): Promise<any | null> {
    const [job] = await db.select()
      .from(knowledgePipelineJobs)
      .where(and(
        eq(knowledgePipelineJobs.userId, this.userId),
        sql`${knowledgePipelineJobs.status} IN ('pending', 'crawling', 'analyzing', 'generating')`
      ))
      .orderBy(desc(knowledgePipelineJobs.createdAt))
      .limit(1);

    return job || null;
  }

  /**
   * Get pipeline history
   */
  async getPipelineHistory(limit: number = 20): Promise<any[]> {
    const jobs = await db.select()
      .from(knowledgePipelineJobs)
      .where(eq(knowledgePipelineJobs.userId, this.userId))
      .orderBy(desc(knowledgePipelineJobs.createdAt))
      .limit(limit);

    return jobs;
  }

  /**
   * Check for content that needs refresh
   */
  async getStaleContent(daysThreshold: number = 30): Promise<{
    id: string;
    title: string;
    url?: string;
    lastUpdated: Date;
    staleDays: number;
  }[]> {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

    const staleItems = await db.select({
      id: knowledgeBase.id,
      title: knowledgeBase.title,
      url: knowledgeBase.url,
      createdAt: knowledgeBase.createdAt
    })
      .from(knowledgeBase)
      .where(and(
        eq(knowledgeBase.userId, this.userId),
        eq(knowledgeBase.type, 'url'),
        lte(knowledgeBase.createdAt, thresholdDate)
      ))
      .orderBy(knowledgeBase.createdAt)
      .limit(50);

    return staleItems.map(item => ({
      id: item.id,
      title: item.title,
      url: item.url || undefined,
      lastUpdated: item.createdAt,
      staleDays: Math.floor((Date.now() - item.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    }));
  }

  /**
   * Get pipeline analytics
   */
  async getPipelineAnalytics(): Promise<{
    totalPipelines: number;
    completedPipelines: number;
    failedPipelines: number;
    averageDuration: number;
    totalArticlesGenerated: number;
    totalPagesProcessed: number;
  }> {
    const jobs = await db.select()
      .from(knowledgePipelineJobs)
      .where(eq(knowledgePipelineJobs.userId, this.userId));

    const completed = jobs.filter(j => j.status === 'completed');
    const failed = jobs.filter(j => j.status === 'failed');

    let totalDuration = 0;
    let totalArticles = 0;
    let totalPages = 0;

    for (const job of completed) {
      if (job.startedAt && job.completedAt) {
        totalDuration += job.completedAt.getTime() - job.startedAt.getTime();
      }

      const details = job.stageDetails as any;
      if (details?.generating?.articlesGenerated) {
        totalArticles += details.generating.articlesGenerated;
      }
      if (details?.crawling?.pagesCrawled) {
        totalPages += details.crawling.pagesCrawled;
      }
    }

    return {
      totalPipelines: jobs.length,
      completedPipelines: completed.length,
      failedPipelines: failed.length,
      averageDuration: completed.length > 0 ? Math.round(totalDuration / completed.length / 1000) : 0,
      totalArticlesGenerated: totalArticles,
      totalPagesProcessed: totalPages
    };
  }
}

export const createPipelineOrchestrator = (userId: string) => new PipelineOrchestrator(userId);
