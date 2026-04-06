import { Router, Request, Response } from "express";
import { z } from "zod";
import OpenAI from "openai";
import { storage } from "../storage";
import { db } from "../db";
import { knowledgeBase, products, insertProductSchema } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { RAGKnowledgeService } from "../services/rag-knowledge";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface AuthRequest extends Request {
  user?: any;
}

const createProductSchema = insertProductSchema.pick({
  name: true,
  description: true,
  price: true,
  currency: true,
  category: true,
  sku: true,
  availability: true,
  productUrl: true,
  features: true,
}).extend({
  name: z.string().min(1, "Product name is required").max(500),
  price: z.number().min(0, "Price must be non-negative"),
  currency: z.string().default("USD"),
  availability: z.string().default("in_stock"),
});

const updateProductSchema = createProductSchema.partial();

function formatProductForRAG(product: any): string {
  const lines: string[] = [];
  lines.push(`Product: ${product.name}`);
  if (product.sku) lines.push(`SKU: ${product.sku}`);
  if (product.category) lines.push(`Category: ${product.category}`);
  lines.push(`Price: ${product.price} ${product.currency}`);
  lines.push(`Availability: ${product.availability === 'in_stock' ? 'In Stock' : product.availability === 'out_of_stock' ? 'Out of Stock' : 'Pre-Order'}`);
  if (product.description) lines.push(`Description: ${product.description}`);
  if (product.features && product.features.length > 0) {
    lines.push(`Key Features:`);
    product.features.forEach((f: string) => lines.push(`  - ${f}`));
  }
  if (product.productUrl) lines.push(`Product Link: ${product.productUrl}`);
  return lines.join('\n');
}

async function syncProductToRAG(product: any, userId: string): Promise<string | null> {
  try {
    const ragContent = formatProductForRAG(product);
    const title = `Product: ${product.name}${product.sku ? ` (${product.sku})` : ''}`;

    if (product.ragKnowledgeBaseId) {
      const kbItem = await storage.getKnowledgeBaseItem(product.ragKnowledgeBaseId);
      if (!kbItem || kbItem.userId !== userId) {
        return null;
      }
      await storage.updateKnowledgeBaseItem(product.ragKnowledgeBaseId, {
        title,
        content: ragContent,
      });
      try {
        await RAGKnowledgeService.deleteKnowledgeChunks(product.ragKnowledgeBaseId, userId);
        await RAGKnowledgeService.processKnowledgeItem(product.ragKnowledgeBaseId, userId, ragContent, {
          title,
          type: 'product',
          productId: product.id,
        });
      } catch (e) {
        console.error('[Products] RAG re-index error:', e);
      }
      return product.ragKnowledgeBaseId;
    }

    const kbItem = await storage.createKnowledgeBaseItem({
      userId,
      type: 'text',
      title,
      content: ragContent,
    });

    try {
      await RAGKnowledgeService.processKnowledgeItem(kbItem.id, userId, ragContent, {
        title,
        type: 'product',
        productId: product.id,
      });
    } catch (e) {
      console.error('[Products] RAG index error:', e);
    }

    return kbItem.id;
  } catch (error) {
    console.error('[Products] Failed to sync product to RAG:', error);
    return null;
  }
}

async function removeProductFromRAG(ragKnowledgeBaseId: string | null, userId: string): Promise<void> {
  if (!ragKnowledgeBaseId) return;
  try {
    const kbItem = await storage.getKnowledgeBaseItem(ragKnowledgeBaseId);
    if (!kbItem || kbItem.userId !== userId) return;
    await RAGKnowledgeService.deleteKnowledgeChunks(ragKnowledgeBaseId, userId);
    await storage.deleteKnowledgeBaseItem(ragKnowledgeBaseId);
  } catch (error) {
    console.error('[Products] Failed to remove product from RAG:', error);
  }
}

export function createProductRoutes(authenticate: any) {
  const router = Router();

  router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const userProducts = await storage.getUserProducts(userId);
      res.json(userProducts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get("/:id", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const product = await storage.getProduct(req.params.id);
      if (!product || product.userId !== userId) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post("/", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const parsed = createProductSchema.parse(req.body);
      const product = await storage.createProduct({ ...parsed, userId });

      const ragId = await syncProductToRAG(product, userId);
      if (ragId) {
        await db.update(products).set({ ragKnowledgeBaseId: ragId }).where(eq(products.id, product.id));
        product.ragKnowledgeBaseId = ragId;
      }

      res.status(201).json(product);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  router.post("/bulk-import", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "No items provided" });
      }

      if (items.length > 500) {
        return res.status(400).json({ error: "Maximum 500 products per import" });
      }

      const validatedItems = [];
      const errors = [];
      for (let i = 0; i < items.length; i++) {
        try {
          const parsed = createProductSchema.parse(items[i]);
          validatedItems.push({ ...parsed, userId });
        } catch (e: any) {
          errors.push({ row: i + 1, error: e.errors?.[0]?.message || "Invalid data" });
        }
      }

      if (validatedItems.length === 0) {
        return res.status(400).json({ error: "No valid products found", details: errors });
      }

      const created = await storage.createProducts(validatedItems);

      for (const product of created) {
        const ragId = await syncProductToRAG(product, userId);
        if (ragId) {
          await db.update(products).set({ ragKnowledgeBaseId: ragId }).where(eq(products.id, product.id));
        }
      }

      res.status(201).json({ imported: created.length, skipped: errors.length, errors: errors.slice(0, 10), products: created });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post("/bulk-delete", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "No product IDs provided" });
      }

      if (ids.length > 500) {
        return res.status(400).json({ error: "Maximum 500 products per bulk delete" });
      }

      let deleted = 0;
      for (const id of ids) {
        const existing = await storage.getProduct(id);
        if (existing && existing.userId === userId) {
          await removeProductFromRAG(existing.ragKnowledgeBaseId, userId);
          await storage.deleteProduct(id);
          deleted++;
        }
      }

      res.json({ deleted });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const bulkUpdateSchema = z.object({
    ids: z.array(z.string()).min(1).max(500),
    updates: z.object({
      category: z.string().max(200).optional(),
      availability: z.enum(['in_stock', 'out_of_stock', 'pre_order']).optional(),
      currency: z.string().min(2).max(5).optional(),
      price: z.number().min(0).finite().optional(),
      productUrl: z.string().url().or(z.literal('')).optional(),
    }).refine(obj => Object.values(obj).some(v => v !== undefined), {
      message: "At least one field must be provided",
    }),
  });

  router.patch("/bulk-update", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const parsed = bulkUpdateSchema.parse(req.body);
      const { ids, updates } = parsed;

      const cleanUpdates: Record<string, any> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined && value !== '') {
          cleanUpdates[key] = value;
        }
      }

      if (Object.keys(cleanUpdates).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      let updated = 0;
      for (const id of ids) {
        const existing = await storage.getProduct(id);
        if (existing && existing.userId === userId) {
          const result = await storage.updateProduct(id, cleanUpdates);
          if (result) {
            const ragId = await syncProductToRAG(result, userId);
            if (ragId && !result.ragKnowledgeBaseId) {
              await db.update(products).set({ ragKnowledgeBaseId: ragId }).where(eq(products.id, result.id));
            }
            updated++;
          }
        }
      }

      res.json({ updated });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  router.patch("/:id", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const existing = await storage.getProduct(req.params.id);
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ error: "Product not found" });
      }

      const parsed = updateProductSchema.parse(req.body);
      const updated = await storage.updateProduct(req.params.id, parsed);
      if (updated) {
        const ragId = await syncProductToRAG(updated, userId);
        if (ragId && !updated.ragKnowledgeBaseId) {
          await db.update(products).set({ ragKnowledgeBaseId: ragId }).where(eq(products.id, updated.id));
          updated.ragKnowledgeBaseId = ragId;
        }
      }

      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  router.delete("/:id", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const existing = await storage.getProduct(req.params.id);
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ error: "Product not found" });
      }

      await removeProductFromRAG(existing.ragKnowledgeBaseId, userId);
      await storage.deleteProduct(req.params.id);

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post("/ai-analyze-csv", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { csvText } = req.body;
      if (!csvText || typeof csvText !== "string") {
        return res.status(400).json({ error: "CSV text is required" });
      }

      if (csvText.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: "CSV too large (max 5MB)" });
      }

      const lines = csvText.trim().split("\n");
      if (lines.length < 2) {
        return res.status(400).json({ error: "CSV must have a header row and at least one data row" });
      }

      if (lines.length > 10001) {
        return res.status(400).json({ error: "CSV exceeds maximum of 10,000 data rows" });
      }
      const sampleLines = lines.slice(0, Math.min(lines.length, 8));
      const sampleCsv = sampleLines.join("\n");

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a CSV data analyst. Analyze the provided CSV sample and map its columns to a product database schema.

The target product fields are:
- name (string, REQUIRED): Product name/title
- description (string): Product description or details
- price (number, REQUIRED): Product price (numeric value only, strip currency symbols)
- currency (string): Currency code like USD, EUR, GBP, INR, AED, SAR etc. Default: USD
- category (string): Product category or type
- sku (string): Product SKU, item number, product code, or unique identifier
- availability (string): Must be one of: "in_stock", "out_of_stock", "pre_order". Map from values like "available"/"yes"/"true"/"1" → "in_stock", "unavailable"/"no"/"false"/"0"/"sold out" → "out_of_stock", "pre-order"/"preorder"/"coming soon" → "pre_order"
- productUrl (string): URL/link to the product page
- features (array of strings): Product features, specifications, or key highlights. If a single cell has comma/semicolon separated values, split them.

Respond with JSON:
{
  "mappings": {
    "<csv_column_header>": "<target_field_or_null>"
  },
  "delimiter": "," or "\\t",
  "detectedCurrency": "<currency_code_if_detected_in_data_or_null>",
  "confidence": "high" | "medium" | "low",
  "notes": "<brief explanation of your analysis>",
  "sampleMapped": [<first 3 rows mapped to product objects>]
}

Rules:
- Map each CSV column to the best matching product field or null if no match
- Be smart about synonyms: "item"/"product"/"title" → name, "cost"/"amount"/"rate" → price, "desc"/"details"/"info" → description, "type"/"group"/"department" → category, "code"/"id"/"item_no"/"barcode" → sku, "status"/"stock"/"in_stock" → availability, "link"/"url"/"href"/"page" → productUrl, "specs"/"highlights"/"bullet_points" → features
- If price contains currency symbols ($, €, £, ₹, etc.), strip them and set the currency accordingly
- If a column has mixed data or doesn't map well, set it to null
- In sampleMapped, convert values properly (prices as numbers, features as arrays, availability normalized)`
          },
          {
            role: "user",
            content: `Analyze this CSV:\n\n${sampleCsv}`
          }
        ],
      });

      const aiResponse = completion.choices[0]?.message?.content;
      if (!aiResponse) {
        return res.status(500).json({ error: "AI analysis returned empty response" });
      }

      let analysis;
      try {
        analysis = JSON.parse(aiResponse);
      } catch {
        return res.status(500).json({ error: "Failed to parse AI response" });
      }

      res.json({
        analysis,
        totalRows: lines.length - 1,
        headers: lines[0].split(analysis.delimiter === "\\t" || analysis.delimiter === "\t" ? "\t" : ",").map((h: string) => h.trim()),
      });
    } catch (error: any) {
      console.error('[Products] AI CSV analysis error:', error);
      res.status(500).json({ error: error.message || "AI analysis failed" });
    }
  });

  router.post("/ai-transform-csv", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { csvText, mappings, delimiter, detectedCurrency } = req.body;
      if (!csvText || !mappings) {
        return res.status(400).json({ error: "CSV text and mappings are required" });
      }

      if (typeof csvText === "string" && csvText.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: "CSV too large (max 5MB)" });
      }
      const delim = delimiter === "\\t" || delimiter === "\t" ? "\t" : ",";
      const lines = csvText.trim().split("\n");
      if (lines.length < 2) {
        return res.status(400).json({ error: "CSV must have a header and at least one data row" });
      }

      function parseCsvLine(line: string, d: string): string[] {
        if (d === "\t") return line.split("\t").map(c => c.trim());
        const result: string[] = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (ch === d && !inQuotes) {
            result.push(current.trim());
            current = "";
          } else {
            current += ch;
          }
        }
        result.push(current.trim());
        return result;
      }

      const headers = parseCsvLine(lines[0], delim);

      const reverseMap: Record<string, string> = {};
      for (const [csvCol, targetField] of Object.entries(mappings)) {
        if (targetField && typeof targetField === "string") {
          reverseMap[targetField] = csvCol;
        }
      }

      const items: any[] = [];
      const errors: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const cols = parseCsvLine(lines[i], delim);
        const row: any = {};

        for (const [field, csvCol] of Object.entries(reverseMap)) {
          const colIdx = headers.findIndex(h => h.toLowerCase().trim() === csvCol.toLowerCase().trim());
          if (colIdx === -1 || colIdx >= cols.length) continue;
          const val = cols[colIdx];
          if (!val) continue;

          switch (field) {
            case "name":
              row.name = val;
              break;
            case "description":
              row.description = val;
              break;
            case "price": {
              const cleaned = val.replace(/[^0-9.,\-]/g, "").replace(/,(\d{2})$/, ".$1").replace(/,/g, "");
              const num = parseFloat(cleaned);
              row.price = isNaN(num) ? 0 : Math.abs(num);
              break;
            }
            case "currency":
              row.currency = val.toUpperCase().trim().substring(0, 5);
              break;
            case "category":
              row.category = val;
              break;
            case "sku":
              row.sku = val;
              break;
            case "availability": {
              const lower = val.toLowerCase().trim();
              if (["in_stock", "in stock", "available", "yes", "true", "1", "active"].includes(lower)) {
                row.availability = "in_stock";
              } else if (["out_of_stock", "out of stock", "unavailable", "no", "false", "0", "sold out", "inactive"].includes(lower)) {
                row.availability = "out_of_stock";
              } else if (["pre_order", "pre-order", "preorder", "coming soon", "backorder", "back order"].includes(lower)) {
                row.availability = "pre_order";
              } else {
                row.availability = "in_stock";
              }
              break;
            }
            case "productUrl":
              row.productUrl = val;
              break;
            case "features": {
              const feats = val.split(/[;|]/).map((f: string) => f.trim()).filter(Boolean);
              if (feats.length > 0) row.features = feats;
              break;
            }
          }
        }

        if (!row.name) {
          errors.push({ row: i, error: "Missing product name" });
          continue;
        }
        if (row.price === undefined || row.price === null) {
          row.price = 0;
        }

        if (!row.currency) {
          row.currency = detectedCurrency || "USD";
        }
        if (!row.availability) {
          row.availability = "in_stock";
        }

        items.push(row);
      }

      res.json({ items, errors, totalProcessed: lines.length - 1 });
    } catch (error: any) {
      console.error('[Products] AI CSV transform error:', error);
      res.status(500).json({ error: error.message || "CSV transformation failed" });
    }
  });

  router.post("/fetch-csv-url", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const urlSchema = z.object({ url: z.string().url("Invalid URL") });
      const { url } = urlSchema.parse(req.body);

      const parsed = new URL(url);

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return res.status(400).json({ error: "Only HTTP and HTTPS URLs are allowed" });
      }

      const hostname = parsed.hostname.toLowerCase();
      const blockedPatterns = [
        /^localhost$/i,
        /^127\./,
        /^10\./,
        /^172\.(1[6-9]|2\d|3[01])\./,
        /^192\.168\./,
        /^169\.254\./,
        /^0\./,
        /^\[::1\]$/,
        /^\[fe80:/i,
        /^\[fc/i,
        /^\[fd/i,
        /^metadata\.google\.internal$/i,
      ];
      if (blockedPatterns.some(p => p.test(hostname))) {
        return res.status(400).json({ error: "Internal/private URLs are not allowed" });
      }

      const MAX_SIZE = 5 * 1024 * 1024;

      const response = await fetch(url, {
        headers: { 'Accept': 'text/csv, text/plain, */*' },
        signal: AbortSignal.timeout(15000),
        redirect: 'follow',
      });

      if (!response.ok) {
        return res.status(400).json({ error: `Failed to fetch URL (status ${response.status})` });
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_SIZE) {
        return res.status(400).json({ error: "File too large (max 5MB)" });
      }

      const contentType = response.headers.get('content-type') || '';
      const allowedExtensions = ['.csv', '.tsv', '.txt'];
      const urlPath = parsed.pathname.toLowerCase();
      const hasAllowedExt = allowedExtensions.some(ext => urlPath.endsWith(ext));

      if (!hasAllowedExt && !contentType.includes('text/') && !contentType.includes('csv')) {
        return res.status(400).json({ error: "URL does not appear to serve a CSV/text file" });
      }

      const reader = response.body?.getReader();
      if (!reader) {
        return res.status(400).json({ error: "Could not read response body" });
      }

      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.length;
        if (totalBytes > MAX_SIZE) {
          reader.cancel();
          return res.status(400).json({ error: "File too large (max 5MB)" });
        }
        chunks.push(value);
      }

      const decoder = new TextDecoder();
      const text = chunks.map(c => decoder.decode(c, { stream: true })).join('') + decoder.decode();

      res.json({ csvText: text });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error('[Products] CSV URL fetch error:', error);
      res.status(500).json({ error: "Failed to fetch CSV from the provided URL" });
    }
  });

  return router;
}
