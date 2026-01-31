/**
 * Content Processor Service
 * 
 * Handles content processing for the Knowledge Intelligence System.
 * Features:
 * - HTML parsing and DOM extraction
 * - Boilerplate removal (nav, footer, ads, sidebars)
 * - Structure detection (headings, tables, lists, code blocks)
 * - Text cleaning and normalization
 * - Language detection
 * - URL canonicalization
 */

import { db } from "../db";
import { 
  crawlPages, 
  crawlJobs,
  knowledgeBase,
  contentAuditLog,
  type CrawlPage 
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

interface StructureData {
  headings: { level: number; text: string }[];
  lists: { type: string; items: string[] }[];
  tables: { headers: string[]; rows: string[][] }[];
  codeBlocks: string[];
  links: { text: string; href: string }[];
}

interface ProcessedContent {
  cleanText: string;
  structure: StructureData;
  language: string;
  wordCount: number;
}

const BOILERPLATE_SELECTORS = [
  'nav', 'header', 'footer', 'aside', '.sidebar', '.navigation', '.nav',
  '.header', '.footer', '.menu', '.breadcrumb', '.social', '.share',
  '.advertisement', '.ad', '.ads', '.banner', '.popup', '.modal',
  '.cookie', '.newsletter', '.subscribe', '.comments', '.related',
  '#header', '#footer', '#nav', '#sidebar', '#menu', '#comments'
];

const CONTENT_SELECTORS = [
  'main', 'article', '.content', '.post', '.entry', '.article',
  '#content', '#main', '.main-content', '.post-content', '.entry-content'
];

/**
 * Remove HTML tags and decode entities
 */
function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract text content from HTML, removing boilerplate
 */
function extractMainContent(html: string): string {
  let content = html;

  for (const selector of BOILERPLATE_SELECTORS) {
    if (selector.startsWith('.') || selector.startsWith('#')) {
      const className = selector.slice(1);
      const classPattern = new RegExp(`<[^>]+class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>[\\s\\S]*?<\\/[^>]+>`, 'gi');
      const idPattern = new RegExp(`<[^>]+id=["']${className}["'][^>]*>[\\s\\S]*?<\\/[^>]+>`, 'gi');
      content = content.replace(classPattern, '');
      content = content.replace(idPattern, '');
    } else {
      const tagPattern = new RegExp(`<${selector}[^>]*>[\\s\\S]*?<\\/${selector}>`, 'gi');
      content = content.replace(tagPattern, '');
    }
  }

  content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  content = content.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');
  content = content.replace(/<!--[\s\S]*?-->/g, '');

  return content;
}

/**
 * Extract headings from HTML
 */
function extractHeadings(html: string): { level: number; text: string }[] {
  const headings: { level: number; text: string }[] = [];
  const pattern = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const level = parseInt(match[1], 10);
    const text = stripHtml(match[2]).trim();
    if (text) {
      headings.push({ level, text });
    }
  }
  
  return headings;
}

/**
 * Extract lists from HTML
 */
function extractLists(html: string): { type: string; items: string[] }[] {
  const lists: { type: string; items: string[] }[] = [];
  
  const ulPattern = /<ul[^>]*>([\s\S]*?)<\/ul>/gi;
  let match;
  while ((match = ulPattern.exec(html)) !== null) {
    const items = extractListItems(match[1]);
    if (items.length > 0) {
      lists.push({ type: 'unordered', items });
    }
  }

  const olPattern = /<ol[^>]*>([\s\S]*?)<\/ol>/gi;
  while ((match = olPattern.exec(html)) !== null) {
    const items = extractListItems(match[1]);
    if (items.length > 0) {
      lists.push({ type: 'ordered', items });
    }
  }

  return lists;
}

function extractListItems(listHtml: string): string[] {
  const items: string[] = [];
  const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  
  let match;
  while ((match = liPattern.exec(listHtml)) !== null) {
    const text = stripHtml(match[1]).trim();
    if (text) {
      items.push(text);
    }
  }
  
  return items;
}

/**
 * Extract tables from HTML
 */
function extractTables(html: string): { headers: string[]; rows: string[][] }[] {
  const tables: { headers: string[]; rows: string[][] }[] = [];
  const tablePattern = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  
  let match;
  while ((match = tablePattern.exec(html)) !== null) {
    const tableHtml = match[1];
    const headers: string[] = [];
    const rows: string[][] = [];

    const thPattern = /<th[^>]*>([\s\S]*?)<\/th>/gi;
    let thMatch;
    while ((thMatch = thPattern.exec(tableHtml)) !== null) {
      headers.push(stripHtml(thMatch[1]).trim());
    }

    const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch;
    while ((trMatch = trPattern.exec(tableHtml)) !== null) {
      const rowHtml = trMatch[1];
      const cells: string[] = [];
      
      const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let tdMatch;
      while ((tdMatch = tdPattern.exec(rowHtml)) !== null) {
        cells.push(stripHtml(tdMatch[1]).trim());
      }
      
      if (cells.length > 0) {
        rows.push(cells);
      }
    }

    if (headers.length > 0 || rows.length > 0) {
      tables.push({ headers, rows });
    }
  }
  
  return tables;
}

/**
 * Extract code blocks from HTML
 */
function extractCodeBlocks(html: string): string[] {
  const codeBlocks: string[] = [];
  
  const prePattern = /<pre[^>]*>([\s\S]*?)<\/pre>/gi;
  let match;
  while ((match = prePattern.exec(html)) !== null) {
    const code = stripHtml(match[1]).trim();
    if (code) {
      codeBlocks.push(code);
    }
  }

  const codePattern = /<code[^>]*>([\s\S]*?)<\/code>/gi;
  while ((match = codePattern.exec(html)) !== null) {
    const code = stripHtml(match[1]).trim();
    if (code && code.length > 50) {
      codeBlocks.push(code);
    }
  }
  
  return codeBlocks;
}

/**
 * Extract links from HTML
 */
function extractLinksWithText(html: string): { text: string; href: string }[] {
  const links: { text: string; href: string }[] = [];
  const pattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const href = match[1].trim();
    const text = stripHtml(match[2]).trim();
    if (href && text && !href.startsWith('#') && !href.startsWith('javascript:')) {
      links.push({ text, href });
    }
  }
  
  return links;
}

/**
 * Detect language from text content
 */
function detectLanguage(text: string): string {
  const commonEnglishWords = ['the', 'and', 'is', 'in', 'to', 'of', 'a', 'for', 'on', 'with'];
  const commonSpanishWords = ['el', 'la', 'de', 'en', 'y', 'que', 'es', 'por', 'con', 'para'];
  const commonFrenchWords = ['le', 'la', 'de', 'et', 'est', 'en', 'que', 'pour', 'avec', 'dans'];
  const commonGermanWords = ['der', 'die', 'und', 'ist', 'in', 'zu', 'den', 'das', 'mit', 'von'];
  
  const words = text.toLowerCase().split(/\s+/);
  const wordSet = new Set(words);
  
  const scores: Record<string, number> = {
    en: commonEnglishWords.filter(w => wordSet.has(w)).length,
    es: commonSpanishWords.filter(w => wordSet.has(w)).length,
    fr: commonFrenchWords.filter(w => wordSet.has(w)).length,
    de: commonGermanWords.filter(w => wordSet.has(w)).length
  };
  
  let maxScore = 0;
  let detectedLang = 'en';
  for (const [lang, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedLang = lang;
    }
  }
  
  return detectedLang;
}

/**
 * Normalize and clean text
 */
function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/^\s+|\s+$/gm, '')
    .trim();
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Process HTML content into structured data
 */
export function processHtmlContent(html: string): ProcessedContent {
  const mainContent = extractMainContent(html);
  const cleanText = normalizeText(stripHtml(mainContent));
  
  const structure: StructureData = {
    headings: extractHeadings(mainContent),
    lists: extractLists(mainContent),
    tables: extractTables(mainContent),
    codeBlocks: extractCodeBlocks(mainContent),
    links: extractLinksWithText(mainContent)
  };
  
  const language = detectLanguage(cleanText);
  const wordCount = countWords(cleanText);
  
  return {
    cleanText,
    structure,
    language,
    wordCount
  };
}

/**
 * Content Processor class
 */
export class ContentProcessor {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Process all fetched pages for a crawl job
   */
  async processJobPages(jobId: string): Promise<number> {
    const pages = await db.select().from(crawlPages)
      .where(and(
        eq(crawlPages.crawlJobId, jobId),
        eq(crawlPages.status, 'fetched')
      ));

    let processed = 0;

    for (const page of pages) {
      try {
        await this.processPage(page);
        processed++;

        await db.update(crawlJobs)
          .set({ 
            pagesProcessed: sql`${crawlJobs.pagesProcessed} + 1`,
            updatedAt: new Date() 
          })
          .where(eq(crawlJobs.id, jobId));
      } catch (error) {
        console.error(`Failed to process page ${page.url}:`, error);
        await db.update(crawlPages)
          .set({ 
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Processing failed'
          })
          .where(eq(crawlPages.id, page.id));
      }
    }

    return processed;
  }

  /**
   * Process a single page
   */
  async processPage(page: CrawlPage): Promise<void> {
    if (!page.rawHtml) {
      throw new Error('No HTML content to process');
    }

    const processed = processHtmlContent(page.rawHtml);

    await db.update(crawlPages)
      .set({
        cleanText: processed.cleanText,
        structureData: processed.structure,
        language: processed.language,
        wordCount: processed.wordCount,
        status: 'processed',
        processedAt: new Date()
      })
      .where(eq(crawlPages.id, page.id));

    const [job] = await db.select().from(crawlJobs)
      .where(eq(crawlJobs.id, page.crawlJobId));

    const [kbItem] = await db.insert(knowledgeBase).values({
      userId: this.userId,
      folderId: job?.folderId,
      type: 'url',
      title: page.title || page.url,
      content: processed.cleanText,
      url: page.url,
      metadata: {
        structure: processed.structure,
        language: processed.language,
        wordCount: processed.wordCount,
        crawlPageId: page.id,
        crawlJobId: page.crawlJobId
      },
      storageSize: Buffer.byteLength(processed.cleanText, 'utf8')
    }).returning();

    await db.update(crawlPages)
      .set({ knowledgeBaseId: kbItem.id })
      .where(eq(crawlPages.id, page.id));

    await db.insert(contentAuditLog).values({
      userId: this.userId,
      actionType: 'parse',
      resourceType: 'crawl_page',
      resourceId: page.id,
      sourceResourceType: 'crawl_job',
      sourceResourceId: page.crawlJobId,
      details: {
        url: page.url,
        wordCount: processed.wordCount,
        language: processed.language,
        knowledgeBaseId: kbItem.id
      }
    });
  }

  /**
   * Reprocess existing knowledge base item
   */
  async reprocessKnowledgeBaseItem(kbId: string): Promise<void> {
    const [item] = await db.select().from(knowledgeBase)
      .where(eq(knowledgeBase.id, kbId));

    if (!item) {
      throw new Error('Knowledge base item not found');
    }

    if (item.type !== 'url' || !item.url) {
      throw new Error('Can only reprocess URL-based items');
    }

    const response = await fetch(item.url, {
      headers: {
        'User-Agent': 'AgentLabs-KnowledgeBot/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }

    const html = await response.text();
    const processed = processHtmlContent(html);

    await db.update(knowledgeBase)
      .set({
        content: processed.cleanText,
        metadata: {
          ...item.metadata as object,
          structure: processed.structure,
          language: processed.language,
          wordCount: processed.wordCount,
          lastRefreshed: new Date().toISOString()
        },
        storageSize: Buffer.byteLength(processed.cleanText, 'utf8')
      })
      .where(eq(knowledgeBase.id, kbId));
  }
}

export const createContentProcessor = (userId: string) => new ContentProcessor(userId);
