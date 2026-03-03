import OpenAI from "openai";
import { db } from "../db";
import { globalSettings, knowledgeBase, knowledgeFolders, knowledgeFaqs } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { RAGKnowledgeService } from "./rag-knowledge";

const MAX_SUB_PAGES = 50;
const FETCH_TIMEOUT_MS = 20000;
const MAX_SCRAPE_TOTAL_BYTES = 10 * 1024 * 1024;

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

const URL_PATH_FOLDER_MAP: Record<string, string> = {
  '/help': 'Technical Support',
  '/support': 'Technical Support',
  '/troubleshoot': 'Technical Support',
  '/faq': 'FAQs',
  '/faqs': 'FAQs',
  '/frequently-asked': 'FAQs',
  '/contact': 'Contact Info',
  '/contact-us': 'Contact Info',
  '/about': 'Products',
  '/pricing': 'Billing & Payments',
  '/plans': 'Billing & Payments',
  '/checkout': 'Orders',
  '/cart': 'Orders',
  '/order': 'Orders',
  '/terms': 'Policies',
  '/terms-and-conditions': 'Policies',
  '/privacy': 'Security & Privacy',
  '/privacy-policy': 'Security & Privacy',
  '/legal': 'Policies',
  '/refund': 'Billing & Payments',
  '/return': 'Delivery',
  '/shipping': 'Delivery',
  '/delivery': 'Delivery',
  '/track': 'Delivery',
  '/account': 'Account Management',
  '/login': 'Account Management',
  '/signin': 'Account Management',
  '/sign-in': 'Account Management',
  '/signup': 'Account Management',
  '/register': 'Account Management',
  '/profile': 'Account Management',
  '/settings': 'Account Management',
  '/dashboard': 'Account Management',
  '/how-it-works': 'Products',
  '/features': 'Products',
  '/products': 'Products',
  '/marketplace': 'Products',
  '/blog': 'Glossary',
  '/glossary': 'Glossary',
  '/what-is': 'Glossary',
  '/careers': 'Products',
  '/complaint': 'Escalation',
  '/feedback': 'Escalation',
};

export function categorizeContent(text: string, url: string): string[] {
  const combined = (text + ' ' + url).toLowerCase();
  const matches: { folder: string; score: number }[] = [];

  try {
    const urlPath = new URL(url).pathname.toLowerCase().replace(/\/$/, '');
    for (const [pathPrefix, folder] of Object.entries(URL_PATH_FOLDER_MAP)) {
      if (urlPath === pathPrefix || urlPath.startsWith(pathPrefix + '/') || urlPath.startsWith(pathPrefix + '?')) {
        const existing = matches.find(m => m.folder === folder);
        if (existing) {
          existing.score += 5;
        } else {
          matches.push({ folder, score: 5 });
        }
      }
    }
  } catch {}

  for (const [folder, keywords] of Object.entries(FOLDER_CATEGORIZATION)) {
    let score = 0;
    for (const kw of keywords) {
      const regex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matchCount = (combined.match(regex) || []).length;
      if (matchCount > 0) {
        score += matchCount;
      }
    }
    if (score > 0) {
      const existing = matches.find(m => m.folder === folder);
      if (existing) {
        existing.score += score;
      } else {
        matches.push({ folder, score });
      }
    }
  }

  const threshold = combined.length < 500 ? 1 : 2;
  const qualified = matches.filter(m => m.score >= threshold);
  qualified.sort((a, b) => b.score - a.score);
  const result = qualified.slice(0, 3).map(m => m.folder);

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

export interface PricingTable {
  planName: string;
  price: string;
  features: string[];
  period?: string;
}

export interface FeatureComparison {
  feature: string;
  plans: Record<string, string>;
}

export interface TeamMember {
  name: string;
  role?: string;
  bio?: string;
}

export interface Testimonial {
  quote: string;
  author?: string;
  company?: string;
  role?: string;
}

export interface CaseStudy {
  title: string;
  summary: string;
  results?: string[];
}

export interface StructuredContentExtraction {
  pricingTables: PricingTable[];
  featureComparisons: FeatureComparison[];
  teamMembers: TeamMember[];
  testimonials: Testimonial[];
  caseStudies: CaseStudy[];
}

export function extractStructuredContent(html: string, text: string): StructuredContentExtraction {
  return {
    pricingTables: extractPricingTables(html, text),
    featureComparisons: extractFeatureComparisons(html, text),
    teamMembers: extractTeamMembers(html, text),
    testimonials: extractTestimonials(html, text),
    caseStudies: extractCaseStudies(html, text),
  };
}

function extractPricingTables(html: string, text: string): PricingTable[] {
  const tables: PricingTable[] = [];

  const pricingBlockPattern = /(?:class=["'][^"']*(?:pricing|plan|tier|package)[^"']*["'])[^>]*>([\s\S]*?)(?=<\/(?:div|section|article)>)/gi;
  let m;
  while ((m = pricingBlockPattern.exec(html)) !== null) {
    const block = m[1];
    const nameMatch = /<(?:h[1-4]|span|strong)[^>]*>([\s\S]*?)<\/(?:h[1-4]|span|strong)>/i.exec(block);
    const priceMatch = /(?:\$|€|£|¥)[\d,.]+(?:\s*\/\s*(?:mo|month|year|yr|annually))?/i.exec(block);

    if (nameMatch && priceMatch) {
      const features: string[] = [];
      const featurePattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let fm;
      while ((fm = featurePattern.exec(block)) !== null) {
        const feat = fm[1].replace(/<[^>]+>/g, '').trim();
        if (feat.length > 2 && feat.length < 200) features.push(feat);
      }

      tables.push({
        planName: nameMatch[1].replace(/<[^>]+>/g, '').trim(),
        price: priceMatch[0].trim(),
        features: features.slice(0, 20),
        period: /\/(mo|month|year|yr|annually)/i.exec(priceMatch[0])?.[1],
      });
    }
  }

  if (tables.length === 0) {
    const textPricePattern = /(\w[\w\s]{2,30})\s*[-–:]\s*(\$|€|£|¥)([\d,.]+)\s*(?:\/\s*(mo|month|year|yr))?/gi;
    let tp;
    while ((tp = textPricePattern.exec(text)) !== null) {
      tables.push({
        planName: tp[1].trim(),
        price: `${tp[2]}${tp[3]}`,
        features: [],
        period: tp[4],
      });
    }
  }

  return tables;
}

function extractFeatureComparisons(_html: string, text: string): FeatureComparison[] {
  const comparisons: FeatureComparison[] = [];

  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/\|/.test(line) && line.split('|').length >= 3) {
      const cells = line.split('|').map(c => c.trim()).filter(c => c.length > 0);
      if (cells.length >= 2 && cells[0].length > 2 && cells[0].length < 80) {
        const feature = cells[0];
        const plans: Record<string, string> = {};
        for (let j = 1; j < cells.length; j++) {
          plans[`Column ${j}`] = cells[j];
        }
        comparisons.push({ feature, plans });
      }
    }
  }

  return comparisons.slice(0, 50);
}

function extractTeamMembers(html: string, _text: string): TeamMember[] {
  const members: TeamMember[] = [];

  const teamBlockPattern = /(?:class=["'][^"']*(?:team|staff|people|member|leadership|founder|executive)[^"']*["'])[^>]*>([\s\S]*?)(?=<\/(?:div|section|article)>)/gi;
  let m;
  while ((m = teamBlockPattern.exec(html)) !== null) {
    const block = m[1];
    const nameMatch = /<(?:h[2-5]|strong|b)[^>]*>([\s\S]*?)<\/(?:h[2-5]|strong|b)>/i.exec(block);
    if (nameMatch) {
      const name = nameMatch[1].replace(/<[^>]+>/g, '').trim();
      if (name.length < 60 && name.split(' ').length <= 5) {
        const roleMatch = /<(?:span|p|small)[^>]*(?:class=["'][^"']*(?:title|role|position)[^"']*["'])?[^>]*>([\s\S]*?)<\/(?:span|p|small)>/i.exec(block);
        const bioMatch = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(block);
        members.push({
          name,
          role: roleMatch ? roleMatch[1].replace(/<[^>]+>/g, '').trim().substring(0, 100) : undefined,
          bio: bioMatch ? bioMatch[1].replace(/<[^>]+>/g, '').trim().substring(0, 300) : undefined,
        });
      }
    }
  }

  return members.slice(0, 30);
}

function extractTestimonials(html: string, text: string): Testimonial[] {
  const testimonials: Testimonial[] = [];

  const testimonialPattern = /(?:class=["'][^"']*(?:testimonial|review|quote|feedback|client-say)[^"']*["'])[^>]*>([\s\S]*?)(?=<\/(?:div|section|article|blockquote)>)/gi;
  let m;
  while ((m = testimonialPattern.exec(html)) !== null) {
    const block = m[1];
    const quoteMatch = /<(?:p|blockquote|q|span)[^>]*>([\s\S]*?)<\/(?:p|blockquote|q|span)>/i.exec(block);
    if (quoteMatch) {
      const quote = quoteMatch[1].replace(/<[^>]+>/g, '').trim();
      if (quote.length > 20 && quote.length < 1000) {
        const authorMatch = /<(?:cite|strong|b|span)[^>]*(?:class=["'][^"']*(?:author|name|client)[^"']*["'])?[^>]*>([\s\S]*?)<\/(?:cite|strong|b|span)>/i.exec(block);
        testimonials.push({
          quote,
          author: authorMatch ? authorMatch[1].replace(/<[^>]+>/g, '').trim() : undefined,
        });
      }
    }
  }

  if (testimonials.length === 0) {
    const quotePattern = /[""]([\s\S]{30,500}?)[""][\s\S]{0,50}?[-–—]\s*([A-Z][\w\s.]{2,40})/g;
    let qm;
    while ((qm = quotePattern.exec(text)) !== null) {
      testimonials.push({
        quote: qm[1].trim(),
        author: qm[2].trim(),
      });
    }
  }

  return testimonials.slice(0, 20);
}

function extractCaseStudies(html: string, text: string): CaseStudy[] {
  const studies: CaseStudy[] = [];

  const casePattern = /(?:class=["'][^"']*(?:case-study|case_study|success-story|success_story|portfolio|client-result)[^"']*["'])[^>]*>([\s\S]*?)(?=<\/(?:div|section|article)>)/gi;
  let m;
  while ((m = casePattern.exec(html)) !== null) {
    const block = m[1];
    const titleMatch = /<(?:h[1-4]|strong)[^>]*>([\s\S]*?)<\/(?:h[1-4]|strong)>/i.exec(block);
    const summaryMatch = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(block);
    if (titleMatch || summaryMatch) {
      const results: string[] = [];
      const resultPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let rm;
      while ((rm = resultPattern.exec(block)) !== null) {
        const r = rm[1].replace(/<[^>]+>/g, '').trim();
        if (r.length > 5) results.push(r);
      }
      studies.push({
        title: titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'Case Study',
        summary: summaryMatch ? summaryMatch[1].replace(/<[^>]+>/g, '').trim().substring(0, 500) : '',
        results: results.length > 0 ? results.slice(0, 10) : undefined,
      });
    }
  }

  return studies.slice(0, 15);
}

export function formatStructuredContentAsText(extraction: StructuredContentExtraction): string {
  const parts: string[] = [];

  if (extraction.pricingTables.length > 0) {
    parts.push('[Pricing Information]');
    for (const plan of extraction.pricingTables) {
      parts.push(`Plan: ${plan.planName} - ${plan.price}${plan.period ? '/' + plan.period : ''}`);
      if (plan.features.length > 0) {
        parts.push(`  Features: ${plan.features.join(', ')}`);
      }
    }
    parts.push('');
  }

  if (extraction.featureComparisons.length > 0) {
    parts.push('[Feature Comparison]');
    for (const comp of extraction.featureComparisons) {
      const planDetails = Object.entries(comp.plans).map(([k, v]) => `${k}: ${v}`).join(' | ');
      parts.push(`${comp.feature}: ${planDetails}`);
    }
    parts.push('');
  }

  if (extraction.teamMembers.length > 0) {
    parts.push('[Team Members]');
    for (const member of extraction.teamMembers) {
      let line = member.name;
      if (member.role) line += ` - ${member.role}`;
      if (member.bio) line += `: ${member.bio}`;
      parts.push(line);
    }
    parts.push('');
  }

  if (extraction.testimonials.length > 0) {
    parts.push('[Testimonials]');
    for (const t of extraction.testimonials) {
      let line = `"${t.quote}"`;
      if (t.author) line += ` - ${t.author}`;
      if (t.company) line += `, ${t.company}`;
      parts.push(line);
    }
    parts.push('');
  }

  if (extraction.caseStudies.length > 0) {
    parts.push('[Case Studies]');
    for (const cs of extraction.caseStudies) {
      parts.push(`${cs.title}: ${cs.summary}`);
      if (cs.results && cs.results.length > 0) {
        parts.push(`  Results: ${cs.results.join('; ')}`);
      }
    }
    parts.push('');
  }

  return parts.join('\n');
}

export function discoverAllInternalLinks(html: string, baseUrl: string, maxLinks: number = 200): string[] {
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
      if (/\.(jpg|jpeg|png|gif|svg|css|js|ico|pdf|zip|mp4|webp|woff|woff2|ttf|eot|map)$/i.test(path)) continue;

      fullUrl.hash = '';
      fullUrl.search = '';
      discovered.add(fullUrl.toString());

      if (discovered.size >= maxLinks) break;
    } catch {}
  }

  return Array.from(discovered);
}

export function parseSitemapXml(xml: string, baseUrl: string): string[] {
  const urls: string[] = [];
  const base = new URL(baseUrl);
  const domain = base.hostname;

  const locPattern = /<loc>([\s\S]*?)<\/loc>/gi;
  let m;
  while ((m = locPattern.exec(xml)) !== null) {
    try {
      const url = m[1].trim();
      const parsed = new URL(url);
      if (parsed.hostname === domain) {
        urls.push(url);
      }
    } catch {}
  }

  return urls;
}

export async function fetchSitemap(baseUrl: string): Promise<string[]> {
  const base = new URL(baseUrl);
  const sitemapUrls = [
    `${base.origin}/sitemap.xml`,
    `${base.origin}/sitemap_index.xml`,
    `${base.origin}/sitemap/sitemap.xml`,
  ];

  for (const sitemapUrl of sitemapUrls) {
    try {
      const xml = await fetchPage(sitemapUrl);
      if (xml && xml.includes('<urlset') || xml?.includes('<sitemapindex')) {
        if (xml.includes('<sitemapindex')) {
          const subSitemaps = parseSitemapXml(xml, baseUrl);
          const allUrls: string[] = [];
          for (const sub of subSitemaps.slice(0, 5)) {
            const subXml = await fetchPage(sub);
            if (subXml) {
              allUrls.push(...parseSitemapXml(subXml, baseUrl));
            }
          }
          if (allUrls.length > 0) {
            console.log(`[Sitemap] Found ${allUrls.length} URLs from sitemap index`);
            return allUrls;
          }
        }
        const urls = parseSitemapXml(xml, baseUrl);
        if (urls.length > 0) {
          console.log(`[Sitemap] Found ${urls.length} URLs from ${sitemapUrl}`);
          return urls;
        }
      }
    } catch {}
  }

  return [];
}

export { fetchPage, isUrlSafe };
