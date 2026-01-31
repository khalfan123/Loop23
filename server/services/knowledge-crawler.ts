/**
 * Knowledge Crawler Service
 * 
 * Handles web crawling for the Knowledge Intelligence System.
 * Features:
 * - Sitemap.xml parsing
 * - Robots.txt compliance
 * - Multi-page recursive crawling
 * - Rate limiting and politeness
 * - Change detection (ETag, Last-Modified, content hash)
 */

import { db } from "../db";
import { 
  crawlJobs, 
  crawlPages, 
  knowledgeBase,
  contentAuditLog,
  type CrawlJob,
  type CrawlPage 
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { createHash } from "crypto";

// Crawl configuration
const DEFAULT_USER_AGENT = "AgentLabs-KnowledgeBot/1.0 (+https://agentlabs.io/bot)";
const DEFAULT_CRAWL_DELAY = 1000; // 1 second between requests
const MAX_CONTENT_SIZE = 10 * 1024 * 1024; // 10MB max per page
const REQUEST_TIMEOUT = 30000; // 30 seconds

interface RobotsRules {
  allowed: string[];
  disallowed: string[];
  crawlDelay: number;
  sitemaps: string[];
}

interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

/**
 * Parse robots.txt content
 */
export function parseRobotsTxt(content: string, userAgent: string = "*"): RobotsRules {
  const rules: RobotsRules = {
    allowed: [],
    disallowed: [],
    crawlDelay: DEFAULT_CRAWL_DELAY,
    sitemaps: []
  };

  const lines = content.split('\n').map(l => l.trim());
  let currentAgent = "";
  let matchesAgent = false;

  for (const line of lines) {
    if (line.startsWith('#') || !line) continue;

    const [directive, ...valueParts] = line.split(':');
    const value = valueParts.join(':').trim();

    switch (directive.toLowerCase()) {
      case 'user-agent':
        currentAgent = value;
        matchesAgent = currentAgent === '*' || currentAgent.toLowerCase().includes('agentlabs');
        break;
      case 'allow':
        if (matchesAgent && value) rules.allowed.push(value);
        break;
      case 'disallow':
        if (matchesAgent && value) rules.disallowed.push(value);
        break;
      case 'crawl-delay':
        if (matchesAgent) {
          const delay = parseFloat(value);
          if (!isNaN(delay)) rules.crawlDelay = delay * 1000;
        }
        break;
      case 'sitemap':
        if (value) rules.sitemaps.push(value);
        break;
    }
  }

  return rules;
}

/**
 * Check if a URL is allowed by robots.txt rules
 */
export function isUrlAllowed(url: string, rules: RobotsRules): boolean {
  const urlPath = new URL(url).pathname;
  
  for (const pattern of rules.disallowed) {
    if (matchRobotsPattern(urlPath, pattern)) {
      for (const allowPattern of rules.allowed) {
        if (matchRobotsPattern(urlPath, allowPattern) && allowPattern.length > pattern.length) {
          return true;
        }
      }
      return false;
    }
  }
  
  return true;
}

function matchRobotsPattern(path: string, pattern: string): boolean {
  if (pattern === '/') return true;
  if (pattern.endsWith('*')) {
    return path.startsWith(pattern.slice(0, -1));
  }
  if (pattern.endsWith('$')) {
    return path === pattern.slice(0, -1);
  }
  return path.startsWith(pattern);
}

/**
 * Parse sitemap XML content
 */
export function parseSitemap(content: string): SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  
  const urlMatches = content.matchAll(/<url>([\s\S]*?)<\/url>/g);
  for (const match of urlMatches) {
    const urlContent = match[1];
    const loc = urlContent.match(/<loc>(.*?)<\/loc>/)?.[1];
    if (loc) {
      entries.push({
        loc: loc.trim(),
        lastmod: urlContent.match(/<lastmod>(.*?)<\/lastmod>/)?.[1]?.trim(),
        changefreq: urlContent.match(/<changefreq>(.*?)<\/changefreq>/)?.[1]?.trim(),
        priority: urlContent.match(/<priority>(.*?)<\/priority>/)?.[1]?.trim()
      });
    }
  }

  const sitemapIndexMatches = content.matchAll(/<sitemap>([\s\S]*?)<\/sitemap>/g);
  for (const match of sitemapIndexMatches) {
    const sitemapContent = match[1];
    const loc = sitemapContent.match(/<loc>(.*?)<\/loc>/)?.[1];
    if (loc) {
      entries.push({ loc: loc.trim() });
    }
  }

  return entries;
}

/**
 * Fetch a URL with proper headers and timeout
 */
async function fetchUrl(url: string, options: {
  etag?: string;
  lastModified?: string;
} = {}): Promise<{
  status: number;
  content: string;
  contentType: string;
  etag?: string;
  lastModified?: string;
  notModified: boolean;
}> {
  const headers: Record<string, string> = {
    'User-Agent': DEFAULT_USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
  };

  if (options.etag) {
    headers['If-None-Match'] = options.etag;
  }
  if (options.lastModified) {
    headers['If-Modified-Since'] = options.lastModified;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
      redirect: 'follow'
    });

    clearTimeout(timeout);

    if (response.status === 304) {
      return {
        status: 304,
        content: '',
        contentType: '',
        notModified: true
      };
    }

    const contentType = response.headers.get('content-type') || '';
    const content = await response.text();

    return {
      status: response.status,
      content,
      contentType,
      etag: response.headers.get('etag') || undefined,
      lastModified: response.headers.get('last-modified') || undefined,
      notModified: false
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Calculate content hash for change detection
 */
export function calculateContentHash(content: string): string {
  return createHash('md5').update(content).digest('hex');
}

/**
 * Extract links from HTML content
 */
export function extractLinks(html: string, baseUrl: string): string[] {
  const links: Set<string> = new Set();
  const base = new URL(baseUrl);
  
  const hrefMatches = html.matchAll(/href=["']([^"']+)["']/gi);
  for (const match of hrefMatches) {
    try {
      const href = match[1];
      if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) {
        continue;
      }
      
      const absoluteUrl = new URL(href, baseUrl);
      if (absoluteUrl.hostname === base.hostname && 
          (absoluteUrl.protocol === 'http:' || absoluteUrl.protocol === 'https:')) {
        absoluteUrl.hash = '';
        links.add(absoluteUrl.href);
      }
    } catch {
    }
  }
  
  return Array.from(links);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main crawler class
 */
export class KnowledgeCrawler {
  private userId: string;
  private robotsCache: Map<string, RobotsRules> = new Map();

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Start a crawl job
   */
  async startCrawl(jobId: string): Promise<void> {
    const [job] = await db.select().from(crawlJobs).where(eq(crawlJobs.id, jobId));
    if (!job) throw new Error('Crawl job not found');

    await db.update(crawlJobs)
      .set({ status: 'running', updatedAt: new Date() })
      .where(eq(crawlJobs.id, jobId));

    try {
      const baseUrl = new URL(job.startUrl);
      const robotsRules = await this.getRobotsRules(baseUrl.origin);

      let urlsToProcess: string[] = [];

      if (job.crawlType === 'sitemap') {
        urlsToProcess = await this.discoverFromSitemap(job.startUrl, robotsRules);
      } else if (job.crawlType === 'recursive') {
        urlsToProcess = [job.startUrl];
      } else {
        urlsToProcess = [job.startUrl];
      }

      await db.update(crawlJobs)
        .set({ pagesDiscovered: urlsToProcess.length, updatedAt: new Date() })
        .where(eq(crawlJobs.id, jobId));

      for (const url of urlsToProcess.slice(0, job.maxPages)) {
        const [existingPage] = await db.select().from(crawlPages)
          .where(and(eq(crawlPages.crawlJobId, jobId), eq(crawlPages.url, url)));
        
        if (!existingPage) {
          await db.insert(crawlPages).values({
            crawlJobId: jobId,
            url,
            depth: 0,
            status: 'pending'
          });
        }
      }

      const processed = new Set<string>();
      let currentDepth = 0;

      while (currentDepth <= job.maxDepth) {
        const pendingPages = await db.select().from(crawlPages)
          .where(and(
            eq(crawlPages.crawlJobId, jobId),
            eq(crawlPages.status, 'pending'),
            eq(crawlPages.depth, currentDepth)
          ));

        if (pendingPages.length === 0) {
          if (job.crawlType !== 'recursive') break;
          currentDepth++;
          continue;
        }

        for (const page of pendingPages) {
          if (processed.has(page.url)) continue;
          processed.add(page.url);

          const [currentJob] = await db.select().from(crawlJobs).where(eq(crawlJobs.id, jobId));
          if (currentJob?.status === 'paused' || currentJob?.status === 'failed') {
            return;
          }

          if (currentJob && currentJob.pagesCrawled >= job.maxPages) {
            break;
          }

          if (job.respectRobotsTxt && !isUrlAllowed(page.url, robotsRules)) {
            await db.update(crawlPages)
              .set({ status: 'skipped', errorMessage: 'Blocked by robots.txt' })
              .where(eq(crawlPages.id, page.id));
            continue;
          }

          if (this.shouldExclude(page.url, job.includePaths, job.excludePaths)) {
            await db.update(crawlPages)
              .set({ status: 'skipped', errorMessage: 'Excluded by path filter' })
              .where(eq(crawlPages.id, page.id));
            continue;
          }

          try {
            await this.crawlPage(page, job, robotsRules.crawlDelay);

            if (job.crawlType === 'recursive' && currentDepth < job.maxDepth) {
              const [updatedPage] = await db.select().from(crawlPages)
                .where(eq(crawlPages.id, page.id));
              
              if (updatedPage?.rawHtml) {
                const newLinks = extractLinks(updatedPage.rawHtml, page.url);
                for (const link of newLinks) {
                  if (!processed.has(link)) {
                    const [existing] = await db.select().from(crawlPages)
                      .where(and(eq(crawlPages.crawlJobId, jobId), eq(crawlPages.url, link)));
                    
                    if (!existing) {
                      await db.insert(crawlPages).values({
                        crawlJobId: jobId,
                        url: link,
                        depth: currentDepth + 1,
                        status: 'pending'
                      });
                    }
                  }
                }
              }
            }

            await db.update(crawlJobs)
              .set({ 
                pagesCrawled: sql`${crawlJobs.pagesCrawled} + 1`,
                updatedAt: new Date() 
              })
              .where(eq(crawlJobs.id, jobId));

          } catch (error) {
            await db.update(crawlPages)
              .set({ 
                status: 'failed', 
                errorMessage: error instanceof Error ? error.message : 'Unknown error'
              })
              .where(eq(crawlPages.id, page.id));
          }

          await sleep(robotsRules.crawlDelay);
        }

        if (job.crawlType !== 'recursive') break;
        currentDepth++;
      }

      await db.update(crawlJobs)
        .set({ status: 'completed', lastCrawledAt: new Date(), updatedAt: new Date() })
        .where(eq(crawlJobs.id, jobId));

      await db.insert(contentAuditLog).values({
        userId: this.userId,
        actionType: 'crawl',
        resourceType: 'crawl_job',
        resourceId: jobId,
        details: { status: 'completed', pagesCrawled: processed.size }
      });

    } catch (error) {
      await db.update(crawlJobs)
        .set({ 
          status: 'failed', 
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          updatedAt: new Date() 
        })
        .where(eq(crawlJobs.id, jobId));
    }
  }

  /**
   * Crawl a single page
   */
  private async crawlPage(
    page: CrawlPage, 
    job: CrawlJob, 
    crawlDelay: number
  ): Promise<void> {
    const result = await fetchUrl(page.url, {
      etag: page.etag || undefined,
      lastModified: page.lastModified || undefined
    });

    if (result.notModified) {
      await db.update(crawlPages)
        .set({ status: 'skipped', errorMessage: 'Not modified' })
        .where(eq(crawlPages.id, page.id));
      return;
    }

    if (result.status !== 200) {
      await db.update(crawlPages)
        .set({ 
          status: 'failed', 
          httpStatus: result.status,
          errorMessage: `HTTP ${result.status}` 
        })
        .where(eq(crawlPages.id, page.id));
      return;
    }

    const contentHash = calculateContentHash(result.content);

    if (page.contentHash && page.contentHash === contentHash) {
      await db.update(crawlPages)
        .set({ status: 'skipped', errorMessage: 'Content unchanged' })
        .where(eq(crawlPages.id, page.id));
      return;
    }

    const title = result.content.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
    const canonical = result.content.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1];

    await db.update(crawlPages)
      .set({
        status: 'fetched',
        httpStatus: result.status,
        contentType: result.contentType,
        contentHash,
        etag: result.etag,
        lastModified: result.lastModified,
        rawHtml: result.content,
        title,
        canonicalUrl: canonical,
        fetchedAt: new Date()
      })
      .where(eq(crawlPages.id, page.id));
  }

  /**
   * Get robots.txt rules for a domain
   */
  private async getRobotsRules(origin: string): Promise<RobotsRules> {
    if (this.robotsCache.has(origin)) {
      return this.robotsCache.get(origin)!;
    }

    try {
      const result = await fetchUrl(`${origin}/robots.txt`);
      if (result.status === 200) {
        const rules = parseRobotsTxt(result.content);
        this.robotsCache.set(origin, rules);
        return rules;
      }
    } catch {
    }

    const defaultRules: RobotsRules = {
      allowed: [],
      disallowed: [],
      crawlDelay: DEFAULT_CRAWL_DELAY,
      sitemaps: []
    };
    this.robotsCache.set(origin, defaultRules);
    return defaultRules;
  }

  /**
   * Discover URLs from sitemap
   */
  private async discoverFromSitemap(startUrl: string, robotsRules: RobotsRules): Promise<string[]> {
    const urls: Set<string> = new Set();
    const sitemapsToProcess: string[] = [];

    if (startUrl.includes('sitemap')) {
      sitemapsToProcess.push(startUrl);
    } else if (robotsRules.sitemaps.length > 0) {
      sitemapsToProcess.push(...robotsRules.sitemaps);
    } else {
      const origin = new URL(startUrl).origin;
      sitemapsToProcess.push(`${origin}/sitemap.xml`);
    }

    for (const sitemapUrl of sitemapsToProcess) {
      try {
        const result = await fetchUrl(sitemapUrl);
        if (result.status === 200) {
          const entries = parseSitemap(result.content);
          for (const entry of entries) {
            if (entry.loc.includes('sitemap') && entry.loc.endsWith('.xml')) {
              sitemapsToProcess.push(entry.loc);
            } else {
              urls.add(entry.loc);
            }
          }
        }
      } catch {
      }
    }

    return Array.from(urls);
  }

  /**
   * Check if URL should be excluded
   */
  private shouldExclude(
    url: string, 
    includePaths: string[] | null, 
    excludePaths: string[] | null
  ): boolean {
    const path = new URL(url).pathname;

    if (excludePaths?.length) {
      for (const pattern of excludePaths) {
        if (path.includes(pattern) || path.match(new RegExp(pattern))) {
          return true;
        }
      }
    }

    if (includePaths?.length) {
      for (const pattern of includePaths) {
        if (path.includes(pattern) || path.match(new RegExp(pattern))) {
          return false;
        }
      }
      return true;
    }

    return false;
  }
}

export const createCrawler = (userId: string) => new KnowledgeCrawler(userId);
