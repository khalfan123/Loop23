import {
  fetchPage,
  isUrlSafe,
  discoverAllInternalLinks,
  fetchSitemap,
  extractStructuredMetadata,
  extractContactInfo,
  extractStructuredContent,
  formatStructuredContentAsText,
  categorizeContent,
  type StructuredContentExtraction,
} from "./advanced-scraper";
import { estimateTokenCount } from "./aws-bedrock";

const MAX_DEEP_PAGES = 50;
const MAX_TOKENS_PER_JOB = 500000;
const MAX_CRAWL_DEPTH = 3;
const DEDUP_SIMILARITY_THRESHOLD = 0.85;
const CONCURRENT_FETCHES = 5;
const FETCH_DELAY_MS = 200;

export interface DeepScrapeJobConfig {
  url: string;
  maxPages?: number;
  maxTokens?: number;
  maxDepth?: number;
  followSitemap?: boolean;
  extractStructured?: boolean;
}

export interface ScrapedPage {
  url: string;
  title: string;
  content: string;
  html: string;
  depth: number;
  tokens: number;
  categories: string[];
  metadata: Record<string, any>;
  structuredContent?: StructuredContentExtraction;
}

export interface DeepScrapeProgress {
  status: 'discovering' | 'fetching' | 'extracting' | 'deduplicating' | 'accumulating' | 'completed' | 'failed';
  totalUrlsDiscovered: number;
  pagesFetched: number;
  pagesProcessed: number;
  totalTokens: number;
  currentUrl?: string;
  errors: string[];
}

export interface DeepScrapeResult {
  pages: ScrapedPage[];
  allContent: string;
  totalTokens: number;
  totalPages: number;
  metadata: {
    siteName?: string;
    domain: string;
    contactInfo: Record<string, any>;
    structuredData: StructuredContentExtraction;
    sitemapFound: boolean;
    crawlDepthReached: number;
    duplicatesRemoved: number;
  };
  progress: DeepScrapeProgress;
}

function extractTextFromHtml(html: string): string {
  let text = html;
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, '');
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, '');
  text = text.replace(/<header[\s\S]*?<\/header>/gi, '');
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/\s+/g, ' ');
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
  return text.trim();
}

function generateNGrams(text: string, n: number = 3): Set<string> {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const ngrams = new Set<string>();
  for (let i = 0; i <= words.length - n; i++) {
    ngrams.add(words.slice(i, i + n).join(' '));
  }
  return ngrams;
}

function computeJaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  const smaller = a.size <= b.size ? a : b;
  const larger = a.size <= b.size ? b : a;

  const smallerArr = Array.from(smaller);
  for (let i = 0; i < smallerArr.length; i++) {
    if (larger.has(smallerArr[i])) intersection++;
  }

  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function isNearDuplicate(
  newContent: string,
  existingNGrams: Set<string>[],
  threshold: number = DEDUP_SIMILARITY_THRESHOLD
): boolean {
  const newNGrams = generateNGrams(newContent);
  if (newNGrams.size < 5) return false;

  for (const existing of existingNGrams) {
    const similarity = computeJaccardSimilarity(newNGrams, existing);
    if (similarity >= threshold) return true;
  }

  return false;
}

function getPageTitle(html: string): string {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (titleMatch) {
    return titleMatch[1].replace(/<[^>]+>/g, '').trim();
  }
  const h1Match = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  if (h1Match) {
    return h1Match[1].replace(/<[^>]+>/g, '').trim();
  }
  return '';
}

async function fetchWithDelay(url: string, delayMs: number): Promise<string | null> {
  if (delayMs > 0) {
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return fetchPage(url);
}

export class DeepScrapeService {
  private progressCallbacks: Map<string, (progress: DeepScrapeProgress) => void> = new Map();

  onProgress(jobId: string, callback: (progress: DeepScrapeProgress) => void): void {
    this.progressCallbacks.set(jobId, callback);
  }

  removeProgressCallback(jobId: string): void {
    this.progressCallbacks.delete(jobId);
  }

  private emitProgress(jobId: string, progress: DeepScrapeProgress): void {
    const callback = this.progressCallbacks.get(jobId);
    if (callback) {
      callback(progress);
    }
  }

  async deepScrape(jobId: string, config: DeepScrapeJobConfig): Promise<DeepScrapeResult> {
    const maxPages = Math.min(config.maxPages || MAX_DEEP_PAGES, MAX_DEEP_PAGES);
    const maxTokens = Math.min(config.maxTokens || MAX_TOKENS_PER_JOB, MAX_TOKENS_PER_JOB);
    const maxDepth = Math.min(config.maxDepth || MAX_CRAWL_DEPTH, MAX_CRAWL_DEPTH);
    const followSitemap = config.followSitemap !== false;
    const extractStructured = config.extractStructured !== false;

    const progress: DeepScrapeProgress = {
      status: 'discovering',
      totalUrlsDiscovered: 0,
      pagesFetched: 0,
      pagesProcessed: 0,
      totalTokens: 0,
      errors: [],
    };

    const baseUrl = config.url;
    const base = new URL(baseUrl);
    const domain = base.hostname;

    const pages: ScrapedPage[] = [];
    const existingNGrams: Set<string>[] = [];
    let totalTokens = 0;
    let duplicatesRemoved = 0;
    let maxDepthReached = 0;
    let sitemapFound = false;

    const mergedStructured: StructuredContentExtraction = {
      pricingTables: [],
      featureComparisons: [],
      teamMembers: [],
      testimonials: [],
      caseStudies: [],
    };
    const mergedContact: Record<string, any> = {};
    let siteName: string | undefined;

    const urlQueue: { url: string; depth: number }[] = [{ url: baseUrl, depth: 0 }];
    const visitedUrls = new Set<string>();
    const discoveredUrls = new Set<string>();
    discoveredUrls.add(baseUrl);

    this.emitProgress(jobId, progress);

    if (followSitemap) {
      try {
        const sitemapUrls = await fetchSitemap(baseUrl);
        if (sitemapUrls.length > 0) {
          sitemapFound = true;
          for (const sUrl of sitemapUrls) {
            if (!discoveredUrls.has(sUrl) && isUrlSafe(sUrl)) {
              discoveredUrls.add(sUrl);
              urlQueue.push({ url: sUrl, depth: 1 });
            }
          }
          console.log(`[DeepScrape] Sitemap added ${sitemapUrls.length} URLs`);
        }
      } catch (err: any) {
        console.log(`[DeepScrape] Sitemap fetch failed: ${err.message}`);
      }
    }

    progress.totalUrlsDiscovered = discoveredUrls.size;
    this.emitProgress(jobId, progress);

    progress.status = 'fetching';
    this.emitProgress(jobId, progress);

    while (urlQueue.length > 0 && pages.length < maxPages && totalTokens < maxTokens) {
      const batch = urlQueue.splice(0, CONCURRENT_FETCHES);

      const fetchPromises = batch.map(async ({ url, depth }) => {
        if (visitedUrls.has(url)) return null;
        if (depth > maxDepth) return null;
        if (!isUrlSafe(url)) return null;

        visitedUrls.add(url);
        progress.currentUrl = url;

        try {
          const html = await fetchWithDelay(url, pages.length > 0 ? FETCH_DELAY_MS : 0);
          if (!html || html.trim().length < 200) return null;

          progress.pagesFetched++;
          this.emitProgress(jobId, progress);

          return { url, depth, html };
        } catch (err: any) {
          progress.errors.push(`Failed to fetch ${url}: ${err.message}`);
          return null;
        }
      });

      const results = await Promise.all(fetchPromises);

      for (const result of results) {
        if (!result) continue;
        if (pages.length >= maxPages || totalTokens >= maxTokens) break;

        const { url, depth, html } = result;

        progress.status = 'extracting';
        this.emitProgress(jobId, progress);

        const text = extractTextFromHtml(html);
        if (text.length < 100) continue;

        progress.status = 'deduplicating';
        this.emitProgress(jobId, progress);

        if (isNearDuplicate(text, existingNGrams)) {
          duplicatesRemoved++;
          console.log(`[DeepScrape] Skipped near-duplicate: ${url}`);
          continue;
        }

        const pageTokens = estimateTokenCount(text);
        if (totalTokens + pageTokens > maxTokens) {
          console.log(`[DeepScrape] Token limit approaching, truncating content for ${url}`);
          const remainingTokens = maxTokens - totalTokens;
          const truncatedText = text.substring(0, remainingTokens * 4);
          const truncatedTokens = estimateTokenCount(truncatedText);

          const title = getPageTitle(html) || url;
          const categories = categorizeContent(truncatedText, url);
          const metadata = extractStructuredMetadata(html);
          const contactInfo = extractContactInfo(html, truncatedText);

          Object.assign(mergedContact, contactInfo);
          if (metadata.siteName && !siteName) siteName = metadata.siteName;

          pages.push({
            url, title, content: truncatedText, html: '',
            depth, tokens: truncatedTokens, categories, metadata,
          });
          existingNGrams.push(generateNGrams(truncatedText));
          totalTokens += truncatedTokens;
          if (depth > maxDepthReached) maxDepthReached = depth;
          break;
        }

        progress.status = 'accumulating';
        this.emitProgress(jobId, progress);

        const title = getPageTitle(html) || url;
        const categories = categorizeContent(text, url);
        const metadata = extractStructuredMetadata(html);
        const contactInfo = extractContactInfo(html, text);

        Object.assign(mergedContact, contactInfo);
        if (metadata.siteName && !siteName) siteName = metadata.siteName;
        if (metadata.businessName && !siteName) siteName = metadata.businessName;

        let pageStructured: StructuredContentExtraction | undefined;
        if (extractStructured) {
          pageStructured = extractStructuredContent(html, text);
          mergedStructured.pricingTables.push(...pageStructured.pricingTables);
          mergedStructured.featureComparisons.push(...pageStructured.featureComparisons);
          mergedStructured.teamMembers.push(...pageStructured.teamMembers);
          mergedStructured.testimonials.push(...pageStructured.testimonials);
          mergedStructured.caseStudies.push(...pageStructured.caseStudies);
        }

        pages.push({
          url, title, content: text, html: '',
          depth, tokens: pageTokens, categories, metadata,
          structuredContent: pageStructured,
        });

        existingNGrams.push(generateNGrams(text));
        totalTokens += pageTokens;
        if (depth > maxDepthReached) maxDepthReached = depth;

        progress.pagesProcessed++;
        progress.totalTokens = totalTokens;
        this.emitProgress(jobId, progress);

        if (depth < maxDepth) {
          const newLinks = discoverAllInternalLinks(html, url, 100);
          for (const link of newLinks) {
            if (!discoveredUrls.has(link) && !visitedUrls.has(link)) {
              discoveredUrls.add(link);
              urlQueue.push({ url: link, depth: depth + 1 });
            }
          }
          progress.totalUrlsDiscovered = discoveredUrls.size;
        }
      }
    }

    const allContent = pages.map(p => {
      return `=== PAGE: ${p.title} ===\nURL: ${p.url}\nCategories: ${p.categories.join(', ')}\n\n${p.content}\n`;
    }).join('\n---\n\n');

    const structuredText = formatStructuredContentAsText(mergedStructured);
    const finalContent = structuredText.length > 50
      ? `${allContent}\n\n=== STRUCTURED DATA ===\n${structuredText}`
      : allContent;

    progress.status = 'completed';
    progress.totalTokens = totalTokens;
    this.emitProgress(jobId, progress);

    console.log(`[DeepScrape] Completed: ${pages.length} pages, ${totalTokens} tokens, ${duplicatesRemoved} duplicates removed, depth ${maxDepthReached}`);

    return {
      pages,
      allContent: finalContent,
      totalTokens,
      totalPages: pages.length,
      metadata: {
        siteName,
        domain,
        contactInfo: mergedContact,
        structuredData: mergedStructured,
        sitemapFound,
        crawlDepthReached: maxDepthReached,
        duplicatesRemoved,
      },
      progress,
    };
  }
}

export const deepScrapeService = new DeepScrapeService();
