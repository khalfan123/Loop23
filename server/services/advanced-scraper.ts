import OpenAI from "openai";
import { db } from "../db";
import { globalSettings, knowledgeBase, knowledgeFolders, knowledgeFaqs } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { RAGKnowledgeService } from "./rag-knowledge";

const MAX_SUB_PAGES = 10;
const FETCH_TIMEOUT_MS = 20000;
const MAX_SCRAPE_TOTAL_BYTES = 2 * 1024 * 1024;

const SUB_PAGE_PATTERNS = [
  /\/(pricing|plans?|packages?|tariff)/i,
  /\/(faq|faqs|frequently-asked|help-center|help)/i,
  /\/(about|about-us|company|who-we-are)/i,
  /\/(products?|services?|solutions?|offerings?)/i,
  /\/(support|contact|contact-us|get-in-touch)/i,
  /\/(terms|privacy|policy|policies|legal|tos|cookie)/i,
  /\/(shipping|delivery|returns?|refund)/i,
  /\/(billing|payment|checkout)/i,
  /\/(features?|how-it-works|getting-started)/i,
  /\/(coverage|countries|destinations|networks?)/i,
  /\/(setup|install|installation|activate|activation)/i,
  /\/(account|login|register|signup|sign-up)/i,
  /\/(security|data-protection|gdpr)/i,
  /\/(orders?|tracking|order-status)/i,
];

const FOLDER_CATEGORIZATION: Record<string, string[]> = {
  'Account Management': ['account', 'login', 'register', 'signup', 'sign up', 'profile', 'settings', 'password', 'reset', 'manage account', 'my account', 'dashboard'],
  'Billing & Payments': ['billing', 'payment', 'invoice', 'charge', 'refund', 'pricing', 'price', 'cost', 'plan', 'subscription', 'credit card', 'checkout', 'discount', 'coupon', 'promo'],
  'Contact Info': ['contact', 'email', 'phone', 'address', 'hours', 'location', 'office', 'reach us', 'get in touch', 'customer service', 'support@', 'info@', 'help@'],
  'Delivery': ['delivery', 'shipping', 'ship', 'dispatch', 'tracking', 'estimated delivery', 'express', 'standard delivery', 'instant', 'activation time', 'receive'],
  'Escalation': ['escalat', 'complaint', 'dispute', 'issue', 'problem', 'unresolved', 'manager', 'supervisor', 'feedback', 'dissatisf'],
  'FAQs': ['faq', 'frequently asked', 'common question', 'how do i', 'how to', 'can i', 'what is', 'what are', 'do you', 'is it possible'],
  'Glossary': ['glossary', 'definition', 'terminology', 'what does', 'meaning of', 'term', 'acronym', 'abbreviation', 'esim', 'apn', 'sim', 'lte', '5g', '4g', '3g'],
  'Orders': ['order', 'purchase', 'buy', 'cart', 'checkout', 'confirm order', 'order status', 'order history', 'cancel order', 'modify order'],
  'Policies': ['policy', 'policies', 'terms', 'conditions', 'terms of service', 'terms of use', 'acceptable use', 'disclaimer', 'legal', 'copyright', 'license'],
  'Products': ['product', 'service', 'plan', 'package', 'bundle', 'offer', 'feature', 'esim', 'data plan', 'coverage', 'country', 'destination', 'network', 'roaming', 'gb', 'unlimited'],
  'Security & Privacy': ['security', 'privacy', 'data protection', 'gdpr', 'encrypt', 'secure', 'cookie', 'consent', 'personal data', 'two-factor', '2fa', 'authentication'],
  'Technical Support': ['technical', 'support', 'troubleshoot', 'not working', 'error', 'fix', 'install', 'setup', 'configure', 'compatible', 'device', 'android', 'ios', 'iphone', 'samsung', 'qr code', 'activate', 'apn'],
};

let openaiClient: OpenAI | null = null;
let lastApiKey: string | null = null;

async function getOpenAIClient(): Promise<OpenAI> {
  let apiKey: string | undefined;
  try {
    const [dbSetting] = await db.select().from(globalSettings).where(eq(globalSettings.key, 'openai_api_key')).limit(1);
    if (dbSetting?.value) apiKey = dbSetting.value as string;
  } catch (_e) {}
  if (!apiKey) apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY required");
  if (!openaiClient || lastApiKey !== apiKey) {
    openaiClient = new OpenAI({ apiKey });
    lastApiKey = apiKey;
  }
  return openaiClient;
}

const BLOCKED_HOSTS = [
  'localhost', '127.0.0.1', '0.0.0.0', '10.', '172.16.', '172.17.', '172.18.',
  '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.',
  '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.', '192.168.',
  '169.254.', '[::1]', 'metadata.google', 'metadata.aws',
];

const MAX_PAGE_SIZE = 5 * 1024 * 1024;

function isUrlSafe(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return !BLOCKED_HOSTS.some(b => host.startsWith(b) || host === b);
  } catch {
    return false;
  }
}

async function fetchPage(url: string): Promise<string | null> {
  if (!isUrlSafe(url)) {
    console.log(`[AdvancedScrape] Blocked unsafe URL: ${url}`);
    return null;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Platform-Knowledge-Bot/1.0', 'Accept': 'text/html, */*' },
    });
    if (!response.ok) return null;
    const text = await response.text();
    if (text.length > MAX_PAGE_SIZE) return null;
    return text;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function discoverSubPageUrls(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const domain = base.hostname;
  const discovered = new Set<string>();

  const linkPattern = /<a[^>]+href=["']([^"'#]+)["'][^>]*>/gi;
  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    try {
      const href = match[1].trim();
      if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue;

      let fullUrl: URL;
      if (href.startsWith('http')) {
        fullUrl = new URL(href);
      } else {
        fullUrl = new URL(href, baseUrl);
      }

      if (fullUrl.hostname !== domain) continue;

      const path = fullUrl.pathname.toLowerCase();
      if (path === '/' || path === base.pathname.toLowerCase()) continue;
      if (/\.(jpg|jpeg|png|gif|svg|css|js|ico|pdf|zip|mp4|webp|woff|ttf)$/i.test(path)) continue;

      const isRelevant = SUB_PAGE_PATTERNS.some(p => p.test(path));
      if (isRelevant) {
        fullUrl.hash = '';
        discovered.add(fullUrl.toString());
      }
    } catch {}
  }

  return Array.from(discovered).slice(0, MAX_SUB_PAGES);
}

export function extractStructuredMetadata(html: string): Record<string, any> {
  const metadata: Record<string, any> = {};

  const jsonLdPattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const jsonLdItems: any[] = [];
  let m;
  while ((m = jsonLdPattern.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (Array.isArray(parsed)) {
        jsonLdItems.push(...parsed);
      } else {
        jsonLdItems.push(parsed);
      }
    } catch {}
  }
  if (jsonLdItems.length > 0) {
    metadata.jsonLd = jsonLdItems;

    for (const item of jsonLdItems) {
      const type = item['@type'];
      if (type === 'Organization' || type === 'LocalBusiness') {
        metadata.businessName = item.name;
        if (item.telephone) metadata.phone = item.telephone;
        if (item.email) metadata.email = item.email;
        if (item.address) metadata.address = item.address;
        if (item.openingHours) metadata.hours = item.openingHours;
        if (item.url) metadata.websiteUrl = item.url;
      }
      if (type === 'Product' || type === 'Offer') {
        if (!metadata.products) metadata.products = [];
        metadata.products.push({
          name: item.name,
          description: item.description,
          price: item.offers?.price || item.price,
          currency: item.offers?.priceCurrency || item.priceCurrency,
        });
      }
    }
  }

  const ogTags: Record<string, string> = {};
  const ogPattern = /<meta[^>]+property=["'](og:[^"']+)["'][^>]+content=["']([^"']*)["'][^>]*>/gi;
  const ogPattern2 = /<meta[^>]+content=["']([^"']*)["'][^>]+property=["'](og:[^"']+)["'][^>]*>/gi;
  while ((m = ogPattern.exec(html)) !== null) {
    ogTags[m[1]] = m[2];
  }
  while ((m = ogPattern2.exec(html)) !== null) {
    ogTags[m[2]] = m[1];
  }
  if (Object.keys(ogTags).length > 0) {
    metadata.openGraph = ogTags;
    if (ogTags['og:site_name']) metadata.siteName = ogTags['og:site_name'];
    if (ogTags['og:title']) metadata.pageTitle = ogTags['og:title'];
    if (ogTags['og:description']) metadata.pageDescription = ogTags['og:description'];
  }

  const descPattern = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i;
  const descPattern2 = /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i;
  const descMatch = descPattern.exec(html) || descPattern2.exec(html);
  if (descMatch) {
    metadata.metaDescription = descMatch[1];
  }

  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (titleMatch) {
    metadata.pageTitle = metadata.pageTitle || titleMatch[1].replace(/<[^>]+>/g, '').trim();
  }

  return metadata;
}

export function extractContactInfo(html: string, text: string): Record<string, any> {
  const contact: Record<string, any> = {};

  const phonePatterns = [
    /(?:tel|phone|call|mobile|whatsapp)[:\s]*([+]?[\d\s\-().]{7,20})/gi,
    /href=["']tel:([^"']+)["']/gi,
  ];
  const phones = new Set<string>();
  for (const pattern of phonePatterns) {
    let m;
    while ((m = pattern.exec(html)) !== null) {
      const cleaned = m[1].replace(/\s+/g, '').replace(/[()]/g, '');
      if (cleaned.length >= 7) phones.add(cleaned);
    }
  }
  const textPhonePattern = /(?:\+\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g;
  let pm;
  while ((pm = textPhonePattern.exec(text)) !== null) {
    const cleaned = pm[0].replace(/\s+/g, '').replace(/[()]/g, '');
    if (cleaned.length >= 7 && cleaned.length <= 15) phones.add(cleaned);
  }
  if (phones.size > 0) contact.phones = Array.from(phones).slice(0, 5);

  const emailPattern = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const emails = new Set<string>();
  let em;
  while ((em = emailPattern.exec(text)) !== null) {
    const email = em[0].toLowerCase();
    if (!email.endsWith('.png') && !email.endsWith('.jpg') && !email.endsWith('.svg') && !email.includes('example.com')) {
      emails.add(email);
    }
  }
  if (emails.size > 0) contact.emails = Array.from(emails).slice(0, 5);

  const addressPatterns = [
    /(?:address|location|office|headquarters)[:\s]*([^<\n]{10,100})/gi,
  ];
  for (const pattern of addressPatterns) {
    let am;
    while ((am = pattern.exec(text)) !== null) {
      if (!contact.addresses) contact.addresses = [];
      contact.addresses.push(am[1].trim());
    }
  }

  const hoursPatterns = [
    /(?:hours|open|business hours|working hours|office hours)[:\s]*([^<\n]{5,80})/gi,
  ];
  for (const pattern of hoursPatterns) {
    let hm;
    while ((hm = pattern.exec(text)) !== null) {
      contact.businessHours = hm[1].trim();
    }
  }

  return contact;
}

export function categorizeContent(text: string, url: string): string[] {
  const combined = (text + ' ' + url).toLowerCase();
  const matches: { folder: string; score: number }[] = [];

  for (const [folder, keywords] of Object.entries(FOLDER_CATEGORIZATION)) {
    let score = 0;
    for (const kw of keywords) {
      const regex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matchCount = (combined.match(regex) || []).length;
      if (matchCount > 0) {
        score += matchCount;
      }
    }
    if (score >= 2) {
      matches.push({ folder, score });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  const result = matches.slice(0, 3).map(m => m.folder);

  if (result.length === 0) {
    result.push('Products');
  }

  return result;
}

export async function generateAutoFAQs(
  content: string,
  url: string,
  userId: string,
  knowledgeBaseId: string,
  faqFolderId: string | null
): Promise<number> {
  try {
    const client = await getOpenAIClient();
    const truncatedContent = content.substring(0, 4000);

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `You are analyzing a business website to create customer service FAQ pairs. Generate practical Q&A pairs that a customer calling a call center would actually ask. Focus on products, services, pricing, policies, and how-to questions. Output ONLY valid JSON array.`
        },
        {
          role: "user",
          content: `Based on this website content, generate 5-8 customer FAQ pairs. Each should be a real question a customer might ask when calling.

URL: ${url}
Content:
${truncatedContent}

Return a JSON array of objects with "question" and "answer" keys. Answers should be direct, 1-3 sentences, using ONLY information from the content. Do not invent information.`
        }
      ],
    });

    const text = response.choices[0]?.message?.content || '[]';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return 0;

    const faqs: { question: string; answer: string }[] = JSON.parse(jsonMatch[0]);
    let created = 0;

    for (const faq of faqs) {
      if (!faq.question || !faq.answer) continue;
      try {
        await db.insert(knowledgeFaqs).values({
          userId,
          knowledgeBaseId,
          question: faq.question.trim(),
          answer: faq.answer.trim(),
          sourceUrl: url,
          confidence: 0.8,
        });
        created++;
      } catch (e: any) {
        console.error(`[AutoFAQ] Failed to insert FAQ:`, e.message);
      }
    }

    console.log(`[AutoFAQ] Generated ${created} FAQs from ${url}`);
    return created;
  } catch (error: any) {
    console.error(`[AutoFAQ] Error generating FAQs:`, error.message);
    return 0;
  }
}

export interface AdvancedScrapeResult {
  mainContent: string;
  subPages: { url: string; content: string; title: string }[];
  metadata: Record<string, any>;
  contactInfo: Record<string, any>;
  categories: string[];
  totalPages: number;
  faqsGenerated: number;
}

export async function advancedScrapeUrl(
  mainHtml: string,
  mainUrl: string,
  mainExtractedText: string,
  userId: string,
  folderMap: Map<string, string>,
  extractTextFn: (html: string) => string,
  storageCreateFn: (data: any) => Promise<any>
): Promise<AdvancedScrapeResult> {
  const result: AdvancedScrapeResult = {
    mainContent: mainExtractedText,
    subPages: [],
    metadata: {},
    contactInfo: {},
    categories: [],
    totalPages: 1,
    faqsGenerated: 0,
  };

  result.metadata = extractStructuredMetadata(mainHtml);
  result.contactInfo = extractContactInfo(mainHtml, mainExtractedText);
  result.categories = categorizeContent(mainExtractedText, mainUrl);

  console.log(`[AdvancedScrape] Metadata extracted: ${Object.keys(result.metadata).length} keys`);
  console.log(`[AdvancedScrape] Contact info: ${Object.keys(result.contactInfo).length} fields`);
  console.log(`[AdvancedScrape] Categories: ${result.categories.join(', ')}`);

  const subPageUrls = discoverSubPageUrls(mainHtml, mainUrl);
  console.log(`[AdvancedScrape] Discovered ${subPageUrls.length} sub-pages from ${mainUrl}`);

  if (subPageUrls.length > 0) {
    let totalBytesAdded = 0;

    for (const subUrl of subPageUrls) {
      if (totalBytesAdded >= MAX_SCRAPE_TOTAL_BYTES) {
        console.log(`[AdvancedScrape] Reached ${(MAX_SCRAPE_TOTAL_BYTES / 1024 / 1024).toFixed(1)}MB scrape cap, stopping sub-page discovery`);
        break;
      }

      try {
        const html = await fetchPage(subUrl);
        if (!html || html.trim().length < 100) continue;
        const text = extractTextFn(html);
        if (text.trim().length < 50) continue;

        const contentSize = Buffer.byteLength(text, 'utf8');
        if (totalBytesAdded + contentSize > MAX_SCRAPE_TOTAL_BYTES) {
          console.log(`[AdvancedScrape] Sub-page ${subUrl} would exceed scrape cap, skipping`);
          continue;
        }

        const hasSpace = await RAGKnowledgeService.checkStorageSpace(userId, contentSize);
        if (!hasSpace) {
          console.log(`[AdvancedScrape] Storage limit reached, stopping sub-page discovery`);
          break;
        }

        const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
        const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : subUrl;

        const pageMetadata = extractStructuredMetadata(html);
        const pageContactInfo = extractContactInfo(html, text);
        const pageCategories = categorizeContent(text, subUrl);

        if (Object.keys(pageContactInfo).length > 0) {
          Object.assign(result.contactInfo, pageContactInfo);
        }
        if (pageMetadata.products) {
          result.metadata.products = [...(result.metadata.products || []), ...pageMetadata.products];
        }

        const primaryFolder = pageCategories[0] || 'Products';
        const folderId = folderMap.get(primaryFolder) || null;

        const item = await storageCreateFn({
          userId,
          type: 'url',
          title: title,
          content: text,
          url: subUrl,
          folderId: folderId,
          fileUrl: null,
          elevenLabsDocId: null,
          metadata: {
            url: subUrl,
            contentType: 'text/html',
            ragEnabled: true,
            parentUrl: mainUrl,
            autoDiscovered: true,
            categories: pageCategories,
            structuredMetadata: pageMetadata,
          },
          storageSize: contentSize,
        });

        totalBytesAdded += contentSize;

        RAGKnowledgeService.processKnowledgeItem(
          item.id,
          userId,
          text,
          { source: 'url', url: subUrl }
        ).catch(err => console.error(`[AdvancedScrape] Processing error for ${subUrl}:`, err));

        result.subPages.push({ url: subUrl, content: text, title });
      } catch (err: any) {
        console.error(`[AdvancedScrape] Failed to process sub-page ${subUrl}:`, err.message);
      }
    }

    result.totalPages = 1 + result.subPages.length;
    console.log(`[AdvancedScrape] Successfully scraped ${result.subPages.length} sub-pages (${(totalBytesAdded / 1024).toFixed(1)}KB added)`);
  }

  if (Object.keys(result.contactInfo).length > 0) {
    const contactFolderId = folderMap.get('Contact Info') || null;
    if (contactFolderId) {
      const contactText = formatContactInfoAsText(result.contactInfo);
      if (contactText.length > 30) {
        const contactSize = Buffer.byteLength(contactText, 'utf8');
        const hasSpace = await RAGKnowledgeService.checkStorageSpace(userId, contactSize);
        if (hasSpace) {
          const siteName = result.metadata.siteName || result.metadata.businessName || new URL(mainUrl).hostname;
          const contactItem = await storageCreateFn({
            userId,
            type: 'text',
            title: `${siteName} - Contact Information`,
            content: contactText,
            url: null,
            folderId: contactFolderId,
            fileUrl: null,
            elevenLabsDocId: null,
            metadata: {
              ragEnabled: true,
              autoGenerated: true,
              sourceUrl: mainUrl,
              categories: ['Contact Info'],
            },
            storageSize: contactSize,
          });

          RAGKnowledgeService.processKnowledgeItem(
            contactItem.id,
            userId,
            contactText,
            { source: 'auto_extracted', url: mainUrl }
          ).catch(err => console.error(`[AdvancedScrape] Contact info processing error:`, err));
        }
      }
    }
  }

  if (result.metadata.products && result.metadata.products.length > 0) {
    const productText = formatProductsAsText(result.metadata.products, result.metadata.siteName || '');
    if (productText.length > 30) {
      const productFolderId = folderMap.get('Products') || null;
      if (productFolderId) {
        const productSize = Buffer.byteLength(productText, 'utf8');
        const hasSpace = await RAGKnowledgeService.checkStorageSpace(userId, productSize);
        if (hasSpace) {
          const productItem = await storageCreateFn({
            userId,
            type: 'text',
            title: `${result.metadata.siteName || 'Website'} - Structured Product Data`,
            content: productText,
            url: null,
            folderId: productFolderId,
            fileUrl: null,
            elevenLabsDocId: null,
            metadata: {
              ragEnabled: true,
              autoGenerated: true,
              sourceUrl: mainUrl,
              categories: ['Products'],
            },
            storageSize: productSize,
          });

          RAGKnowledgeService.processKnowledgeItem(
            productItem.id,
            userId,
            productText,
            { source: 'auto_extracted', url: mainUrl }
          ).catch(err => console.error(`[AdvancedScrape] Product data processing error:`, err));
        }
      }
    }
  }

  return result;
}

function formatContactInfoAsText(contact: Record<string, any>): string {
  const parts: string[] = ['[Business Contact Information]'];

  if (contact.phones && contact.phones.length > 0) {
    parts.push(`Phone Numbers: ${contact.phones.join(', ')}`);
  }
  if (contact.emails && contact.emails.length > 0) {
    parts.push(`Email Addresses: ${contact.emails.join(', ')}`);
  }
  if (contact.addresses && contact.addresses.length > 0) {
    parts.push(`Addresses: ${contact.addresses.join('; ')}`);
  }
  if (contact.businessHours) {
    parts.push(`Business Hours: ${contact.businessHours}`);
  }

  return parts.join('\n');
}

function formatProductsAsText(products: any[], siteName: string): string {
  const parts: string[] = [`[${siteName || 'Website'} Product/Service Information]`];

  for (const product of products) {
    const details: string[] = [];
    if (product.name) details.push(`Product: ${product.name}`);
    if (product.description) details.push(`Description: ${product.description}`);
    if (product.price) details.push(`Price: ${product.currency || ''} ${product.price}`);
    if (details.length > 0) {
      parts.push(details.join(' | '));
    }
  }

  return parts.join('\n');
}
