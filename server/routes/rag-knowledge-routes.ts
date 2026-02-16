/**
 * ============================================================
 * © 2025 Diploy — a brand of Bisht Technologies Private Limited
 * Original Author: BTPL Engineering Team
 * Website: https://diploy.in
 * Contact: cs@diploy.in
 *
 * Distributed under the Envato / CodeCanyon License Agreement.
 * Licensed to the purchaser for use as defined by the
 * Envato Market (CodeCanyon) Regular or Extended License.
 *
 * You are NOT permitted to redistribute, resell, sublicense,
 * or share this source code, in whole or in part.
 * Respect the author's rights and Envato licensing terms.
 * ============================================================
 */
/**
 * RAG Knowledge Base Routes
 * 
 * Separate from legacy ElevenLabs KB routes.
 * Provides scalable knowledge storage with per-user 20MB limits.
 * 
 * Set USE_RAG_KNOWLEDGE=true to use these routes instead of legacy.
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import { RAGKnowledgeService } from "../services/rag-knowledge";
import { KBEnhancedProcessor } from "../services/kb-enhanced-processor";
import { advancedScrapeUrl, generateAutoFAQs, categorizeContent } from "../services/advanced-scraper";
import { storage } from "../storage";
import { db } from "../db";
import { knowledgeBase, knowledgeChunks, knowledgeFolders, knowledgeFaqs, knowledgeEntities, knowledgeTopics } from "@shared/schema";
import { eq, and, sql, desc, asc, count, inArray } from "drizzle-orm";

// Extend Request to include userId
interface AuthRequest extends Request {
  userId?: string;
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB max file size
  },
});

// Allowed file extensions for text-based files
const ALLOWED_TEXT_EXTENSIONS = ['.txt', '.md', '.html', '.htm', '.json', '.xml', '.csv'];

// URL fetch limits
const MAX_URL_CONTENT_SIZE = 5 * 1024 * 1024; // 5MB max for URL content
const ALLOWED_URL_PROTOCOLS = ['http:', 'https:'];

// Call-center knowledge folders
const CALL_CENTER_FOLDERS = [
  { name: 'Account Management', icon: 'user-cog', sortOrder: 1 },
  { name: 'Billing & Payments', icon: 'credit-card', sortOrder: 2 },
  { name: 'Contact Info', icon: 'phone', sortOrder: 3 },
  { name: 'Delivery', icon: 'truck', sortOrder: 4 },
  { name: 'Escalation', icon: 'alert-triangle', sortOrder: 5 },
  { name: 'FAQs', icon: 'help-circle', sortOrder: 6 },
  { name: 'Glossary', icon: 'book-open', sortOrder: 7 },
  { name: 'Orders', icon: 'shopping-cart', sortOrder: 8 },
  { name: 'Policies', icon: 'shield', sortOrder: 9 },
  { name: 'Products', icon: 'package', sortOrder: 10 },
  { name: 'Security & Privacy', icon: 'lock', sortOrder: 11 },
  { name: 'Technical Support', icon: 'wrench', sortOrder: 12 },
];

/**
 * Ensure call-center knowledge folders exist for a user
 * Creates missing folders on first use (during URL scrape)
 */
async function ensureCallCenterFolders(userId: string): Promise<Map<string, string>> {
  // Check if user already has folders
  const existingFolders = await db
    .select()
    .from(knowledgeFolders)
    .where(eq(knowledgeFolders.userId, userId));

  // Map folder names to IDs for existing ones
  const folderMap = new Map<string, string>();
  for (const f of existingFolders) {
    folderMap.set(f.name, f.id);
  }

  // Only create missing folders
  const missingFolders = CALL_CENTER_FOLDERS.filter(f => !folderMap.has(f.name));
  
  if (missingFolders.length > 0) {
    console.log(`[RAG Routes] Creating ${missingFolders.length} call-center folders for user ${userId}`);
    for (const folder of missingFolders) {
      const [created] = await db
        .insert(knowledgeFolders)
        .values({
          userId,
          name: folder.name,
          icon: folder.icon,
          sortOrder: folder.sortOrder,
        })
        .returning();
      folderMap.set(created.name, created.id);
    }
  }

  return folderMap;
}

/**
 * Validate file type - only allow text-based files for now
 * Binary formats (PDF, DOCX) would require additional parsers
 */
function isTextBasedFile(filename: string, mimeType: string): boolean {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  
  // Check extension
  if (ALLOWED_TEXT_EXTENSIONS.includes(ext)) {
    return true;
  }
  
  // Check mime type
  const textMimeTypes = [
    'text/plain',
    'text/html',
    'text/markdown',
    'text/csv',
    'application/json',
    'application/xml',
    'text/xml',
  ];
  
  return textMimeTypes.includes(mimeType) || mimeType.startsWith('text/');
}

/**
 * Validate URL for security (prevent SSRF)
 */
function isValidUrl(urlString: string): { valid: boolean; error?: string } {
  try {
    const url = new URL(urlString);
    
    // Only allow http/https
    if (!ALLOWED_URL_PROTOCOLS.includes(url.protocol)) {
      return { valid: false, error: "Only HTTP and HTTPS URLs are allowed" };
    }
    
    // Block localhost and private IPs
    const hostname = url.hostname.toLowerCase();
    const blockedPatterns = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '10.',
      '172.16.',
      '172.17.',
      '172.18.',
      '172.19.',
      '172.20.',
      '172.21.',
      '172.22.',
      '172.23.',
      '172.24.',
      '172.25.',
      '172.26.',
      '172.27.',
      '172.28.',
      '172.29.',
      '172.30.',
      '172.31.',
      '192.168.',
      '169.254.',
      'metadata.google',
      '169.254.169.254',
    ];
    
    for (const pattern of blockedPatterns) {
      if (hostname.includes(pattern) || hostname.startsWith(pattern)) {
        return { valid: false, error: "Internal/private URLs are not allowed" };
      }
    }
    
    return { valid: true };
  } catch (e) {
    return { valid: false, error: "Invalid URL format" };
  }
}

/**
 * Fetch URL with size limit and timeout
 */
async function fetchUrlWithLimits(url: string): Promise<{ content: string; contentType: string; size: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout
  
  try {
    let response: globalThis.Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Platform-Knowledge-Bot/1.0',
          'Accept': 'text/html, text/plain, application/json, text/markdown, */*',
        },
      });
    } catch (firstErr: any) {
      const certErrors = ['CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'ERR_TLS_CERT_ALTNAME_INVALID', 'SELF_SIGNED_CERT_IN_CHAIN'];
      const isCertError = certErrors.some(code => firstErr?.cause?.code === code) || firstErr?.message?.includes('certificate');
      if (isCertError) {
        console.log(`[RAG Routes] SSL cert issue for ${url}, retrying with curl -k...`);
        const { execSync } = await import('child_process');
        const safeUrl = url.replace(/["`$\\]/g, '');
        const html = execSync(`curl -sSLk --max-time 25 -H "User-Agent: Platform-Knowledge-Bot/1.0" "${safeUrl}"`, { encoding: 'utf-8', maxBuffer: MAX_URL_CONTENT_SIZE });
        clearTimeout(timeout);
        return { content: html, contentType: 'text/html', size: Buffer.byteLength(html) };
      }
      throw firstErr;
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type') || '';
    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    
    // Check content length header if available
    if (contentLength > MAX_URL_CONTENT_SIZE) {
      throw new Error(`Content too large: ${(contentLength / (1024 * 1024)).toFixed(2)}MB exceeds ${MAX_URL_CONTENT_SIZE / (1024 * 1024)}MB limit`);
    }
    
    // Read response in chunks with size tracking
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Unable to read response body");
    }
    
    const chunks: Uint8Array[] = [];
    let totalSize = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      totalSize += value.length;
      if (totalSize > MAX_URL_CONTENT_SIZE) {
        reader.cancel();
        throw new Error(`Content too large: exceeds ${MAX_URL_CONTENT_SIZE / (1024 * 1024)}MB limit`);
      }
      
      chunks.push(value);
    }
    
    const combined = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    
    const content = new TextDecoder('utf-8').decode(combined);
    
    return { content, contentType, size: totalSize };
    
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Extract text from HTML content with preserved structure
 * Extracts tables, lists, headings, and pricing information
 */
function extractTextFromHtml(html: string): string {
  // Helper function to decode HTML entities
  function decodeHtmlEntities(text: string): string {
    return text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/');
  }

  // Helper function to strip HTML tags
  function stripHtml(text: string): string {
    return text.replace(/<[^>]+>/g, ' ').trim();
  }

  // Helper function to normalize whitespace
  function normalizeWhitespace(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  // Helper function to check if element is in a pricing section
  function isPricingSection(elementHtml: string): boolean {
    const pricingKeywords = ['price', 'pricing', 'plan', 'product', 'package', 'bundle', 'tariff', 'rate', 'cost', 'subscription'];
    const classIdMatch = elementHtml.match(/(?:class|id)=["']([^"']*?)["']/gi);
    
    if (classIdMatch) {
      const fullText = classIdMatch.join(' ').toLowerCase();
      return pricingKeywords.some(keyword => fullText.includes(keyword));
    }
    return false;
  }

  // Helper function to extract tables
  function extractTables(text: string): string {
    let result = '';
    const tablePattern = /<table[^>]*>([\s\S]*?)<\/table>/gi;
    let match;

    while ((match = tablePattern.exec(text)) !== null) {
      const tableHtml = match[1];
      const headers: string[] = [];
      const rows: string[][] = [];

      // Extract headers from <th> tags
      const thPattern = /<th[^>]*>([\s\S]*?)<\/th>/gi;
      let thMatch;
      while ((thMatch = thPattern.exec(tableHtml)) !== null) {
        headers.push(normalizeWhitespace(decodeHtmlEntities(stripHtml(thMatch[1]))));
      }

      // Extract rows from <tr> tags
      const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let trMatch;
      while ((trMatch = trPattern.exec(tableHtml)) !== null) {
        const rowHtml = trMatch[1];
        const cells: string[] = [];

        // Extract cells from <td> tags
        const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        let tdMatch;
        while ((tdMatch = tdPattern.exec(rowHtml)) !== null) {
          cells.push(normalizeWhitespace(decodeHtmlEntities(stripHtml(tdMatch[1]))));
        }

        if (cells.length > 0) {
          rows.push(cells);
        }
      }

      // Format table as structured text
      if (headers.length > 0 || rows.length > 0) {
        result += '\n[Pricing Table]\n';
        
        if (headers.length > 0 && rows.length > 0) {
          // Header-based format: "Header: Value"
          for (const row of rows) {
            const pairs: string[] = [];
            for (let i = 0; i < headers.length && i < row.length; i++) {
              pairs.push(`${headers[i]}: ${row[i]}`);
            }
            result += pairs.join(' | ') + '\n';
          }
        } else if (rows.length > 0) {
          // No headers, pipe-separated format
          for (const row of rows) {
            result += row.join(' | ') + '\n';
          }
        }
      }
    }

    return result;
  }

  // Helper function to extract lists
  function extractLists(text: string): string {
    let result = '';

    // Extract unordered lists
    const ulPattern = /<ul[^>]*>([\s\S]*?)<\/ul>/gi;
    let match;
    while ((match = ulPattern.exec(text)) !== null) {
      const listHtml = match[1];
      const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let liMatch;
      let listItems = '';

      while ((liMatch = liPattern.exec(listHtml)) !== null) {
        const itemText = normalizeWhitespace(decodeHtmlEntities(stripHtml(liMatch[1])));
        if (itemText) {
          listItems += '• ' + itemText + '\n';
        }
      }

      if (listItems) {
        result += '\n' + listItems;
      }
    }

    // Extract ordered lists
    const olPattern = /<ol[^>]*>([\s\S]*?)<\/ol>/gi;
    let olMatch;
    let olCounter = 1;
    while ((olMatch = olPattern.exec(text)) !== null) {
      const listHtml = olMatch[1];
      const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let liMatch;
      let listItems = '';
      olCounter = 1;

      while ((liMatch = liPattern.exec(listHtml)) !== null) {
        const itemText = normalizeWhitespace(decodeHtmlEntities(stripHtml(liMatch[1])));
        if (itemText) {
          listItems += olCounter + '. ' + itemText + '\n';
          olCounter++;
        }
      }

      if (listItems) {
        result += '\n' + listItems;
      }
    }

    return result;
  }

  // Helper function to extract headings
  function extractHeadings(text: string): string {
    let result = '';

    for (let level = 1; level <= 6; level++) {
      const hPattern = new RegExp(`<h${level}[^>]*>([\\s\\S]*?)<\\/h${level}>`, 'gi');
      let match;

      while ((match = hPattern.exec(text)) !== null) {
        const headingText = normalizeWhitespace(decodeHtmlEntities(stripHtml(match[1])));
        if (headingText) {
          result += '\n[Section: ' + headingText + ']\n';
        }
      }
    }

    return result;
  }

  let content = html;

  // Step 1: Remove boilerplate elements
  const boilerplatePatterns = [
    /<script[^>]*>[\s\S]*?<\/script>/gi,
    /<style[^>]*>[\s\S]*?<\/style>/gi,
    /<noscript[^>]*>[\s\S]*?<\/noscript>/gi,
    /<nav[^>]*>[\s\S]*?<\/nav>/gi,
    /<footer[^>]*>[\s\S]*?<\/footer>/gi,
    /<header[^>]*>[\s\S]*?<\/header>/gi,
    /<[^>]+class=["']([^"']*?)(?:cookie|popup|modal|newsletter|sidebar|menu|breadcrumb)[^"']*?["'][^>]*>[\s\S]*?<\/[^>]+>/gi,
    /<[^>]+id=["']([^"']*?)(?:cookie|popup|modal|newsletter|sidebar|menu|breadcrumb)[^"']*?["'][^>]*>[\s\S]*?<\/[^>]+>/gi,
  ];

  for (const pattern of boilerplatePatterns) {
    content = content.replace(pattern, '');
  }

  let result = '';

  // Step 2: Check if this is a pricing section and add prefix
  const isPricing = isPricingSection(content);
  if (isPricing) {
    result += '[Product/Pricing Information]\n';
  }

  // Step 3: Extract structured elements (tables, lists, headings) in order
  const tableResults = extractTables(content);
  const listResults = extractLists(content);
  const headingResults = extractHeadings(content);

  // Step 4: Remove extracted elements from content
  let textContent = content
    .replace(/<table[^>]*>[\s\S]*?<\/table>/gi, '')
    .replace(/<ul[^>]*>[\s\S]*?<\/ul>/gi, '')
    .replace(/<ol[^>]*>[\s\S]*?<\/ol>/gi, '')
    .replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, '');

  // Step 5: Strip remaining HTML tags and decode entities
  textContent = stripHtml(textContent);
  textContent = decodeHtmlEntities(textContent);
  textContent = normalizeWhitespace(textContent);

  // Step 6: Combine all parts
  result += headingResults + tableResults + listResults + textContent;

  // Step 7: Normalize final output - preserve paragraph breaks but clean up excessive whitespace
  result = result
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s*\n\s*/g, '\n')
    .trim();

  return result;
}

export function createRAGKnowledgeRoutes(authenticateToken: any): Router {
  const router = Router();

  /**
   * Get user's storage usage and limits
   */
  router.get("/storage", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { maxBytes, usedBytes } = await RAGKnowledgeService.getUserStorageLimit(req.userId!);
      
      res.json({
        maxStorageBytes: maxBytes,
        usedStorageBytes: usedBytes,
        remainingBytes: maxBytes - usedBytes,
        usagePercent: Math.round((usedBytes / maxBytes) * 100),
      });
    } catch (error: any) {
      console.error("[RAG Routes] Storage usage error:", error);
      res.status(500).json({ error: "Failed to get storage usage" });
    }
  });

  /**
   * Get all knowledge base items for user
   */
  router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const items = await storage.getUserKnowledgeBase(req.userId!);
      
      // Enhance with RAG processing status
      const enhancedItems = await Promise.all(
        items.map(async (item) => {
          const status = await RAGKnowledgeService.getProcessingStatus(item.id);
          const chunkCount = await RAGKnowledgeService.getChunkCount(item.id);
          
          return {
            ...item,
            ragStatus: status?.status || (chunkCount > 0 ? 'completed' : 'pending'),
            ragProgress: status?.progress || (chunkCount > 0 ? 100 : 0),
            chunkCount,
            isRAGEnabled: chunkCount > 0,
          };
        })
      );
      
      res.json(enhancedItems);
    } catch (error: any) {
      console.error("[RAG Routes] Get knowledge base error:", error);
      res.status(500).json({ error: "Failed to get knowledge base" });
    }
  });

  /**
   * Upload file to RAG knowledge base
   * Only supports text-based files (TXT, MD, HTML, JSON, XML, CSV)
   */
  router.post("/upload", authenticateToken, upload.single('file'), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { name } = req.body;
      const filename = req.file.originalname;
      const mimeType = req.file.mimetype;
      const fileSize = req.file.size;

      // Validate file type
      if (!isTextBasedFile(filename, mimeType)) {
        return res.status(400).json({ 
          error: "Unsupported file type. Currently supported: TXT, MD, HTML, JSON, XML, CSV. PDF and DOCX support coming soon.",
          supportedTypes: ALLOWED_TEXT_EXTENSIONS.join(', ')
        });
      }

      // Parse file content as text
      let fileContent: string;
      try {
        fileContent = req.file.buffer.toString('utf8');
      } catch (parseError) {
        return res.status(400).json({ 
          error: "Failed to read file content. Please ensure the file is valid text."
        });
      }

      // Check storage limit
      const hasSpace = await RAGKnowledgeService.checkStorageSpace(req.userId!, fileSize);
      if (!hasSpace) {
        return res.status(400).json({ 
          error: "Storage limit exceeded. Please delete some items or upgrade your plan.",
          code: "STORAGE_LIMIT_EXCEEDED"
        });
      }

      // Create knowledge base item in database (WITHOUT uploading to ElevenLabs)
      const item = await storage.createKnowledgeBaseItem({
        userId: req.userId!,
        type: 'file',
        title: name || filename,
        content: fileContent,
        url: null,
        fileUrl: filename,
        elevenLabsDocId: null, // No ElevenLabs upload
        metadata: { 
          filename, 
          mimeType,
          ragEnabled: true,
        },
        storageSize: fileSize,
      });

      // Process with RAG (async - chunks and embeddings)
      RAGKnowledgeService.processKnowledgeItem(
        item.id,
        req.userId!,
        fileContent,
        { source: 'file', filename }
      ).catch(err => console.error("[RAG Routes] Background processing error:", err));

      res.json({
        ...item,
        ragStatus: 'processing',
        message: "File uploaded. Processing embeddings in background.",
      });
    } catch (error: any) {
      console.error("[RAG Routes] Upload error:", error);
      res.status(500).json({ error: error.message || "Failed to upload file" });
    }
  });

  /**
   * Add URL to RAG knowledge base
   * Fetches content with security validation and size limits
   */
  router.post("/url", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { url, name } = req.body;

      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      // Validate URL security
      const urlValidation = isValidUrl(url);
      if (!urlValidation.valid) {
        return res.status(400).json({ error: urlValidation.error });
      }

      // Ensure call-center folders exist for this user
      const folderMap = await ensureCallCenterFolders(req.userId!);

      // Fetch URL content with limits
      let content: string;
      let rawHtml: string = '';
      let contentType: string;
      let contentSize: number;
      
      try {
        const result = await fetchUrlWithLimits(url);
        content = result.content;
        rawHtml = result.content;
        contentType = result.contentType;
        contentSize = result.size;
      } catch (fetchError: any) {
        console.error("[RAG Routes] URL fetch error:", fetchError.message, fetchError.cause || '');
        const userMessage = fetchError.message?.includes('fetch failed') || fetchError.message?.includes('ENOTFOUND')
          ? `Could not reach this URL. Please check the address and try again.`
          : fetchError.message?.includes('abort')
          ? `The URL took too long to respond (30s timeout). Try again later.`
          : `Failed to fetch URL: ${fetchError.message}`;
        return res.status(400).json({ error: userMessage });
      }

      const isHtml = contentType.includes('text/html');
      if (isHtml) {
        content = extractTextFromHtml(content);
        contentSize = Buffer.byteLength(content, 'utf8');
      }

      if (content.trim().length < 50) {
        return res.status(400).json({ error: "URL content is too short or empty" });
      }

      const hasSpace = await RAGKnowledgeService.checkStorageSpace(req.userId!, contentSize);
      if (!hasSpace) {
        return res.status(400).json({ 
          error: "Storage limit exceeded. Please delete some items or upgrade your plan.",
          code: "STORAGE_LIMIT_EXCEEDED"
        });
      }

      const mainCategories = categorizeContent(content, url);
      const primaryFolder = mainCategories[0] || 'Products';
      const mainFolderId = folderMap.get(primaryFolder) || null;

      const item = await storage.createKnowledgeBaseItem({
        userId: req.userId!,
        type: 'url',
        title: name || url,
        content: content,
        url: url,
        folderId: mainFolderId,
        fileUrl: null,
        elevenLabsDocId: null,
        metadata: { 
          url,
          contentType,
          ragEnabled: true,
          categories: mainCategories,
        },
        storageSize: contentSize,
      });

      RAGKnowledgeService.processKnowledgeItem(
        item.id,
        req.userId!,
        content,
        { source: 'url', url }
      ).catch(err => console.error("[RAG Routes] Background processing error:", err));

      // Advanced scraping: sub-pages, metadata, contact info, FAQs (async background)
      if (isHtml && rawHtml.length > 100) {
        (async () => {
          try {
            console.log(`[RAG Routes] Starting advanced scrape for ${url}`);
            const scrapeResult = await advancedScrapeUrl(
              rawHtml,
              url,
              content,
              req.userId!,
              folderMap,
              extractTextFromHtml,
              (data: any) => storage.createKnowledgeBaseItem(data)
            );

            // Auto-generate FAQs from main content
            const faqFolderId = folderMap.get('FAQs') || null;
            await generateAutoFAQs(content, url, req.userId!, item.id, faqFolderId);

            // Also generate FAQs for each discovered sub-page
            for (const subPage of scrapeResult.subPages) {
              if (subPage.content.length > 100) {
                await generateAutoFAQs(subPage.content, subPage.url, req.userId!, item.id, faqFolderId);
              }
            }

            console.log(`[RAG Routes] Advanced scrape complete: ${scrapeResult.totalPages} pages, ${scrapeResult.subPages.length} sub-pages discovered`);
          } catch (err: any) {
            console.error(`[RAG Routes] Advanced scrape error:`, err.message);
          }
        })();
      }

      res.json({
        ...item,
        ragStatus: 'processing',
        categories: mainCategories,
        folderId: mainFolderId,
        message: "URL content fetched. Processing embeddings, discovering related pages, and generating FAQs in background.",
      });
    } catch (error: any) {
      console.error("[RAG Routes] URL add error:", error);
      res.status(500).json({ error: error.message || "Failed to add URL" });
    }
  });

  /**
   * Add text to RAG knowledge base
   */
  router.post("/text", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { text, name } = req.body;

      if (!text || !name) {
        return res.status(400).json({ error: "Text and name are required" });
      }

      const contentSize = Buffer.byteLength(text, 'utf8');

      // Check storage limit
      const hasSpace = await RAGKnowledgeService.checkStorageSpace(req.userId!, contentSize);
      if (!hasSpace) {
        return res.status(400).json({ 
          error: "Storage limit exceeded. Please delete some items or upgrade your plan.",
          code: "STORAGE_LIMIT_EXCEEDED"
        });
      }

      // Create knowledge base item (WITHOUT uploading to ElevenLabs)
      const item = await storage.createKnowledgeBaseItem({
        userId: req.userId!,
        type: 'text',
        title: name,
        content: text,
        url: null,
        fileUrl: null,
        elevenLabsDocId: null, // No ElevenLabs upload
        metadata: { 
          ragEnabled: true,
        },
        storageSize: contentSize,
      });

      // Process with RAG (async)
      RAGKnowledgeService.processKnowledgeItem(
        item.id,
        req.userId!,
        text,
        { source: 'text' }
      ).catch(err => console.error("[RAG Routes] Background processing error:", err));

      res.json({
        ...item,
        ragStatus: 'processing',
        message: "Text added. Processing embeddings in background.",
      });
    } catch (error: any) {
      console.error("[RAG Routes] Text add error:", error);
      res.status(500).json({ error: error.message || "Failed to add text" });
    }
  });

  /**
   * Delete ALL knowledge base items for user
   */
  router.delete("/purge-all", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const items = await storage.getUserKnowledgeBase(req.userId!);
      
      for (const item of items) {
        await RAGKnowledgeService.deleteKnowledgeChunks(item.id, req.userId!);
        await storage.deleteKnowledgeBaseItem(item.id);
      }
      
      res.json({ success: true, deletedCount: items.length });
    } catch (error: any) {
      console.error("[RAG Routes] Purge all error:", error);
      res.status(500).json({ error: "Failed to delete all resources" });
    }
  });

  /**
   * Delete knowledge base item
   */
  router.delete("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const item = await storage.getKnowledgeBaseItem(req.params.id);
      if (!item || item.userId !== req.userId) {
        return res.status(404).json({ error: "Knowledge base item not found" });
      }

      // Delete RAG chunks (also updates storage usage)
      await RAGKnowledgeService.deleteKnowledgeChunks(req.params.id, req.userId!);

      // Delete from database
      await storage.deleteKnowledgeBaseItem(req.params.id);

      res.json({ success: true });
    } catch (error: any) {
      console.error("[RAG Routes] Delete error:", error);
      res.status(500).json({ error: "Failed to delete knowledge base item" });
    }
  });

  /**
   * Get processing status for an item
   */
  router.get("/:id/status", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const item = await storage.getKnowledgeBaseItem(req.params.id);
      if (!item || item.userId !== req.userId) {
        return res.status(404).json({ error: "Knowledge base item not found" });
      }

      const status = await RAGKnowledgeService.getProcessingStatus(req.params.id);
      const chunkCount = await RAGKnowledgeService.getChunkCount(req.params.id);

      res.json({
        status: status?.status || (chunkCount > 0 ? 'completed' : 'pending'),
        progress: status?.progress || (chunkCount > 0 ? 100 : 0),
        chunkCount,
        error: status?.error,
      });
    } catch (error: any) {
      console.error("[RAG Routes] Status check error:", error);
      res.status(500).json({ error: "Failed to get status" });
    }
  });

  /**
   * Search knowledge base - internal API for agents
   * This is called by the ElevenLabs custom tool
   */
  router.post("/search", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { query, knowledgeBaseIds, maxResults = 5 } = req.body;

      if (!query) {
        return res.status(400).json({ error: "Query is required" });
      }

      if (!knowledgeBaseIds || !Array.isArray(knowledgeBaseIds) || knowledgeBaseIds.length === 0) {
        return res.status(400).json({ error: "Knowledge base IDs are required" });
      }

      console.log(`[RAG Routes] Search query: "${query}"`);

      const results = await RAGKnowledgeService.searchKnowledge(
        query,
        knowledgeBaseIds,
        req.userId!,
        maxResults
      );

      // Format for agent consumption
      const formattedResponse = RAGKnowledgeService.formatResultsForAgent(results);

      const aiAnswer = await RAGKnowledgeService.generateProfessorAnswer(query, results, formattedResponse);

      const sourceIds = [...new Set(results.map(r => r.source).filter(Boolean))];
      let kbNameMap: Record<string, string> = {};
      if (sourceIds.length > 0) {
        const kbEntries = await db
          .select({ id: knowledgeBase.id, title: knowledgeBase.title })
          .from(knowledgeBase)
          .where(inArray(knowledgeBase.id, sourceIds));
        for (const entry of kbEntries) {
          kbNameMap[entry.id] = entry.title;
        }
      }

      const topScore = results.length > 0 ? results[0].score : 0;
      const noInfoPhrases = ["don't have", "no relevant", "no specific", "rephrase"];
      const isLowQualityAnswer = noInfoPhrases.some(p => aiAnswer.toLowerCase().includes(p));
      if (results.length > 0 && aiAnswer && topScore >= 0.65 && !isLowQualityAnswer) {
        const bestKbId = results[0].source;
        RAGKnowledgeService.learnFromQuery(query, aiAnswer, [bestKbId], req.userId!)
          .catch(err => console.error('[RAG Routes] Auto-learn error:', err.message));
      }

      res.json({
        results: results.map(r => ({
          text: r.chunk.chunkText,
          score: r.score,
          source: r.source,
          title: kbNameMap[r.source] || undefined,
        })),
        formattedResponse,
        aiAnswer,
      });
    } catch (error: any) {
      console.error("[RAG Routes] Search error:", error);
      res.status(500).json({ error: "Failed to search knowledge base" });
    }
  });

  // ============================================
  // FOLDER MANAGEMENT ROUTES
  // ============================================

  /**
   * Get all folders for user
   */
  router.get("/folders", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const folders = await db
        .select()
        .from(knowledgeFolders)
        .where(eq(knowledgeFolders.userId, req.userId!))
        .orderBy(asc(knowledgeFolders.sortOrder), asc(knowledgeFolders.name));

      res.json(folders);
    } catch (error: any) {
      console.error("[RAG Routes] Get folders error:", error);
      res.status(500).json({ error: "Failed to fetch folders" });
    }
  });

  /**
   * Get folder stats (item counts per folder)
   */
  router.get("/folders/stats", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const folderStats = await db
        .select({
          folderId: knowledgeBase.folderId,
          count: count(),
        })
        .from(knowledgeBase)
        .where(eq(knowledgeBase.userId, req.userId!))
        .groupBy(knowledgeBase.folderId);

      const statsMap: Record<string, number> = {};
      let uncategorizedCount = 0;
      
      for (const stat of folderStats) {
        if (stat.folderId) {
          statsMap[stat.folderId] = stat.count;
        } else {
          uncategorizedCount = stat.count;
        }
      }

      res.json({ folders: statsMap, uncategorized: uncategorizedCount });
    } catch (error: any) {
      console.error("[RAG Routes] Get folder stats error:", error);
      res.status(500).json({ error: "Failed to fetch folder stats" });
    }
  });

  /**
   * Create a new folder
   */
  router.post("/folders", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { name, icon, color } = req.body;

      if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: "Folder name is required" });
      }

      const existingFolders = await db
        .select({ sortOrder: knowledgeFolders.sortOrder })
        .from(knowledgeFolders)
        .where(eq(knowledgeFolders.userId, req.userId!))
        .orderBy(desc(knowledgeFolders.sortOrder))
        .limit(1);

      const maxSortOrder = existingFolders.length > 0 ? existingFolders[0].sortOrder : 0;

      const [folder] = await db
        .insert(knowledgeFolders)
        .values({
          userId: req.userId!,
          name: name.trim(),
          icon: icon || "folder",
          color: color || null,
          sortOrder: maxSortOrder + 1,
        })
        .returning();

      res.json(folder);
    } catch (error: any) {
      console.error("[RAG Routes] Create folder error:", error);
      res.status(500).json({ error: "Failed to create folder" });
    }
  });

  /**
   * Update a folder
   */
  router.patch("/folders/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, icon, color, sortOrder } = req.body;

      const existingFolder = await db
        .select()
        .from(knowledgeFolders)
        .where(and(eq(knowledgeFolders.id, id), eq(knowledgeFolders.userId, req.userId!)))
        .limit(1);

      if (existingFolder.length === 0) {
        return res.status(404).json({ error: "Folder not found" });
      }

      const updateData: any = { updatedAt: new Date() };
      if (name !== undefined) updateData.name = name.trim();
      if (icon !== undefined) updateData.icon = icon;
      if (color !== undefined) updateData.color = color;
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

      const [folder] = await db
        .update(knowledgeFolders)
        .set(updateData)
        .where(and(eq(knowledgeFolders.id, id), eq(knowledgeFolders.userId, req.userId!)))
        .returning();

      res.json(folder);
    } catch (error: any) {
      console.error("[RAG Routes] Update folder error:", error);
      res.status(500).json({ error: "Failed to update folder" });
    }
  });

  /**
   * Delete a folder (items become uncategorized)
   */
  router.delete("/folders/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const existingFolder = await db
        .select()
        .from(knowledgeFolders)
        .where(and(eq(knowledgeFolders.id, id), eq(knowledgeFolders.userId, req.userId!)))
        .limit(1);

      if (existingFolder.length === 0) {
        return res.status(404).json({ error: "Folder not found" });
      }

      // Move items from this folder to uncategorized before deleting
      await db
        .update(knowledgeBase)
        .set({ folderId: null })
        .where(and(eq(knowledgeBase.folderId, id), eq(knowledgeBase.userId, req.userId!)));

      await db
        .delete(knowledgeFolders)
        .where(and(eq(knowledgeFolders.id, id), eq(knowledgeFolders.userId, req.userId!)));

      res.json({ success: true });
    } catch (error: any) {
      console.error("[RAG Routes] Delete folder error:", error);
      res.status(500).json({ error: "Failed to delete folder" });
    }
  });

  /**
   * Assign item to folder
   */
  router.patch("/:id/folder", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { folderId } = req.body;

      const existingItem = await db
        .select()
        .from(knowledgeBase)
        .where(and(eq(knowledgeBase.id, id), eq(knowledgeBase.userId, req.userId!)))
        .limit(1);

      if (existingItem.length === 0) {
        return res.status(404).json({ error: "Item not found" });
      }

      if (folderId) {
        const existingFolder = await db
          .select()
          .from(knowledgeFolders)
          .where(and(eq(knowledgeFolders.id, folderId), eq(knowledgeFolders.userId, req.userId!)))
          .limit(1);

        if (existingFolder.length === 0) {
          return res.status(404).json({ error: "Folder not found" });
        }
      }

      const [item] = await db
        .update(knowledgeBase)
        .set({ folderId: folderId || null })
        .where(and(eq(knowledgeBase.id, id), eq(knowledgeBase.userId, req.userId!)))
        .returning();

      res.json(item);
    } catch (error: any) {
      console.error("[RAG Routes] Assign folder error:", error);
      res.status(500).json({ error: "Failed to assign folder" });
    }
  });

  /**
   * Get dashboard stats
   */
  router.get("/stats", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const items = await db
        .select()
        .from(knowledgeBase)
        .where(eq(knowledgeBase.userId, req.userId!));

      const chunks = await db
        .select({ count: count() })
        .from(knowledgeChunks)
        .where(eq(knowledgeChunks.userId, req.userId!));

      const typeDistribution: Record<string, number> = {};
      let totalSize = 0;

      for (const item of items) {
        typeDistribution[item.type] = (typeDistribution[item.type] || 0) + 1;
        totalSize += item.storageSize || 0;
      }

      const recentItems = await db
        .select()
        .from(knowledgeBase)
        .where(eq(knowledgeBase.userId, req.userId!))
        .orderBy(desc(knowledgeBase.createdAt))
        .limit(5);

      res.json({
        totalResources: items.length,
        totalChunks: chunks[0]?.count || 0,
        totalSize,
        typeDistribution,
        recentItems,
      });
    } catch (error: any) {
      console.error("[RAG Routes] Get stats error:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  /**
   * Internal endpoint for ElevenLabs tool webhook
   * Called when agent invokes the ask_knowledge tool
   */
  router.post("/tool-webhook", async (req: Request, res: Response) => {
    try {
      const { query, agent_id, knowledge_base_ids, user_id } = req.body;

      console.log(`[RAG Tool] Received query: "${query}" for agent ${agent_id}`);

      if (!query || !knowledge_base_ids || !user_id) {
        return res.status(400).json({ 
          error: "Missing required parameters",
          response: "I couldn't access the knowledge base. Please try asking again."
        });
      }

      const results = await RAGKnowledgeService.searchKnowledge(
        query,
        knowledge_base_ids,
        user_id,
        5 // Return more results for richer agent context
      );

      const formattedResponse = RAGKnowledgeService.formatResultsForAgent(results, 1500);

      console.log(`[RAG Tool] Found ${results.length} results, returning formatted response`);

      res.json({
        response: formattedResponse,
        sources: results.map(r => ({
          id: r.chunk.knowledgeBaseId,
          relevance: r.score,
        })),
      });
    } catch (error: any) {
      console.error("[RAG Tool] Webhook error:", error);
      res.status(500).json({ 
        error: error.message,
        response: "I encountered an error accessing the knowledge base. Please try again."
      });
    }
  });

  router.post("/enhanced-reprocess", async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { knowledgeBaseIds, skipIfProcessed = false } = req.body;

      let targetIds: string[] = knowledgeBaseIds;

      if (!targetIds || targetIds.length === 0) {
        const allEntries = await db
          .select({ id: knowledgeBase.id })
          .from(knowledgeBase)
          .where(eq(knowledgeBase.userId, userId));
        targetIds = allEntries.map(e => e.id);
      }

      if (targetIds.length === 0) {
        return res.json({ message: "No knowledge base entries found", result: null });
      }

      console.log(`[KB Enhanced Route] Starting enhanced reprocessing for ${targetIds.length} entries`);

      res.json({
        message: `Enhanced processing started for ${targetIds.length} entries. This runs in the background.`,
        totalEntries: targetIds.length,
        status: "processing",
      });

      KBEnhancedProcessor.processKnowledgeBasesEnhanced(targetIds, userId, { skipIfProcessed })
        .then(result => {
          console.log(`[KB Enhanced Route] Processing complete:`, JSON.stringify(result));
        })
        .catch(err => {
          console.error(`[KB Enhanced Route] Processing failed:`, err.message);
        });

    } catch (error: any) {
      console.error("[KB Enhanced Route] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  router.get("/enhanced-status", async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const [chunkStats] = await db
        .select({ count: sql<number>`count(*)` })
        .from(knowledgeChunks)
        .where(eq(knowledgeChunks.userId, userId));

      const [faqStats] = await db
        .select({ count: sql<number>`count(*)` })
        .from(knowledgeFaqs)
        .where(eq(knowledgeFaqs.userId, userId));

      const [entityStats] = await db
        .select({ count: sql<number>`count(*)` })
        .from(knowledgeEntities)
        .where(eq(knowledgeEntities.userId, userId));

      const [topicStats] = await db
        .select({ count: sql<number>`count(*)` })
        .from(knowledgeTopics)
        .where(eq(knowledgeTopics.userId, userId));

      res.json({
        chunks: Number(chunkStats?.count || 0),
        faqs: Number(faqStats?.count || 0),
        entities: Number(entityStats?.count || 0),
        topics: Number(topicStats?.count || 0),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

export default createRAGKnowledgeRoutes;
