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
'use strict';
import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import cookieParser from "cookie-parser";
import compression from "compression";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startPhoneBillingCron } from "./services/phone-billing-cron";
import { startCallpilotWorker } from "./services/callpilot-auto-analyze";
import { runStartupHealthCheck, getHealthStatus } from "./services/startup-health-check";
import { setupGlobalHandlers, registerServer, signalReady } from "./services/graceful-shutdown";
import { startWatchdog } from "./services/resource-watchdog";
import { webhookRetryService } from "./services/webhook-retry-service";
import { preloadJwtExpiry } from "./middleware/auth";
import { storage } from "./storage";
import { initializeMigrationEngine } from "./engines/elevenlabs-migration";
import { startStaleCallsCleanup } from "./services/stale-calls-cleanup";
import { correlationIdMiddleware } from "./middleware/correlation-id";
import { emailService } from "./services/email-service";
import { initializeDirectories } from "./utils/init-directories";
import { RAGKnowledgeService } from "./services/rag-knowledge";
import { bootstrapElevenLabsPoolFromEnv } from "./services/bootstrap-elevenlabs-pool";
import { callErrorLogger } from "./services/call-error-logger";
import { seedPlatformLanguages } from "./seed-platform-languages";
import { seedIntegrationApps } from "./seed-integration-apps";

// Setup global error handlers and shutdown signals FIRST
// This ensures crashes are caught even during initialization
setupGlobalHandlers();

// Ensure all required directories exist before starting
initializeDirectories();

// Diploy startup signature
console.log(`
====================================
Platform Initialized
©diploy
Unauthorized distribution prohibited
`);

const app = express();

app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    const contentType = res.getHeader('content-type');
    if (typeof contentType === 'string' && contentType.includes('text/xml')) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  limit: '10mb', // Increase limit for large webhook payloads (transcripts can be large)
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));
app.use(cookieParser()); // Parse cookies for refresh token handling

// Static file caching options (7 days for images/audio, reduces repeat requests)
const staticCacheOptions = { maxAge: '7d', etag: true, lastModified: true };

// Serve static files from client/public folder (for uploads like SEO images)
// This must come before API routes so /uploads/* URLs are served correctly
app.use('/uploads', express.static(path.join(process.cwd(), 'client', 'public', 'uploads'), staticCacheOptions));

// Serve static images from client/public/images folder (for logos, favicons, SEO images)
// Images are stored as files instead of base64 to prevent database timeouts
app.use('/images', express.static(path.join(process.cwd(), 'client', 'public', 'images'), staticCacheOptions));

// Serve audio files from public/audio folder (for flow automation play_audio nodes)
app.use('/audio', express.static(path.join(process.cwd(), 'public', 'audio'), staticCacheOptions));

// Serve avatar images from public/avatars folder (for agent profile pictures)
app.use('/avatars', express.static(path.join(process.cwd(), 'public', 'avatars'), staticCacheOptions));

// Serve widget files from public/widget folder (for embeddable voice widgets)
// CORS enabled for cross-origin embedding on external websites
app.use('/widget', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
}, express.static(path.join(process.cwd(), 'public', 'widget')));

// Correlation ID middleware for distributed request tracing
app.use(correlationIdMiddleware);

// Diploy author attribution header
app.use((_req, res, next) => {
  res.setHeader('X-Author', 'Diploy');
  res.setHeader('X-Powered-By', 'Diploy');
  next();
});

// Baseline security headers (keep CSP in Report-Only to avoid breaking the app).
app.use((req, res, next) => {
  // Only enable HSTS when behind HTTPS (Replit autoscale uses TLS at the edge).
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '');
  if (forwardedProto.includes('https') || req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-Frame-Options', 'DENY');

  // Very permissive report-only CSP; tighten after observing reports.
  res.setHeader(
    'Content-Security-Policy-Report-Only',
    [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data: https:",
      "font-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline' https:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
      "connect-src 'self' https: wss:",
      // Allow third-party payment / checkout iframes (Stripe, Razorpay, PayPal, etc.)
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://api.razorpay.com https://checkout.razorpay.com https://www.paypal.com https://www.sandbox.paypal.com",
    ].join('; '),
  );
  next();
});

// Simple health check endpoint for deployment
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Early root handler so deployment health checks to "/" pass during initialization.
// Once the full app is ready, this falls through to the real SPA/static handler.
let appFullyInitialized = false;
app.get("/", (req, res, next) => {
  if (appFullyInitialized) return next();
  res.status(200).send("OK");
});

// Detailed health check endpoint with integration status
app.get("/health/detailed", async (_req, res) => {
  try {
    const status = await getHealthStatus();
    const httpStatus = status.status === 'healthy' ? 200 : status.status === 'degraded' ? 200 : 503;
    res.status(httpStatus).json(status);
  } catch (error: any) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Include correlation ID (first 8 chars) in logs for request tracing
      const correlationPrefix = req.correlationId ? `[${req.correlationId.slice(0, 8)}] ` : '';
      let logLine = `${correlationPrefix}${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 90) {
        logLine = logLine.slice(0, 89) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Create the HTTP server and start listening EARLY so deployment health checks
// can be answered immediately (the /health endpoint is already registered above).
// Heavy async initialization (DB seeding, route registration, etc.) runs after.
const port = parseInt(process.env.PORT || '5000', 10);
const server = createServer(app);

registerServer(server);

server.listen({
  port,
  host: "0.0.0.0",
  reusePort: true,
}, () => {
  log(`serving on port ${port}`);
});

(async () => {
  try {
    const emailInitialized = await emailService.reinitializeFromDatabase();
    if (emailInitialized) {
      console.log('📧 [Email] Service initialized from database settings');
    }
  } catch (error) {
    console.error('⚠️ [Email] Failed to initialize from database:', error);
  }
  
  try {
    await runStartupHealthCheck();
  } catch (error) {
    console.error('❌ [Startup] Health check failed:', error);
  }

  // Boot marker in DB for observability. This makes it obvious when a deploy/restart
  // is actually running the latest server code (useful when debugging call latency).
  // Never include callId/userId here to avoid foreign key issues.
  callErrorLogger.logCallError({
    engineType: 'bedrock-polly',
    errorCategory: 'latency',
    severity: 'info',
    message: `server_boot ${new Date().toISOString()}`,
    metadata: {
      nodeEnv: process.env.NODE_ENV,
      region: process.env.AWS_REGION,
      bedrockRegion: process.env.BEDROCK_REGION,
    },
  }).catch(() => undefined);

  try {
    const backfilled = await RAGKnowledgeService.backfillPgvectorEmbeddings();
    console.log(`🔍 [RAG] pgvector ready — ${backfilled} embeddings backfilled`);
  } catch (error: any) {
    console.warn(`⚠️ [RAG] pgvector startup init failed: ${error.message}`);
  }
  
  await preloadJwtExpiry(storage);

  // Ensure platform UI languages exist (required for language picker + IVR language selection UX).
  // Safe to run on every boot; the seeder is a no-op if languages already exist.
  try {
    const seedResult = await seedPlatformLanguages(false);
    if (seedResult.success) {
      console.log(`🌐 [Startup] ${seedResult.message}`);
    }
  } catch (err: any) {
    console.warn("⚠️ [Startup] Platform languages seed failed:", err?.message || err);
  }

  // Ensure the integration apps catalog is populated and up to date.
  // Uses ON CONFLICT DO UPDATE on `slug` so re-running is idempotent and any
  // metadata updates (description / category / popular flag / n8n node type)
  // automatically propagate. Required so the marketplace + concierge wizard
  // can resolve apps like Zendesk, Slack, HubSpot, etc. by slug.
  try {
    await seedIntegrationApps();
    console.log("🔌 [Startup] Integration apps catalog ready");
  } catch (err: any) {
    console.warn("⚠️ [Startup] Integration apps seed failed:", err?.message || err);
  }

  try {
    await bootstrapElevenLabsPoolFromEnv();
  } catch (err: any) {
    console.warn("⚠️ [Startup] ElevenLabs pool bootstrap failed:", err?.message || err);
  }

  await registerRoutes(app, server);

  try {
    const { fixExistingConnectionWebhooks } = await import('./routes/incoming-connections-routes');
    await fixExistingConnectionWebhooks();
  } catch (fixError: any) {
    console.warn('⚠️  [Startup] Webhook fix failed:', fixError.message);
  }

  // Ensure Twilio phone number Voice webhook URLs are correct for this deployment (SaaS-safe).
  try {
    const { syncTwilioPhoneNumberWebhooks } = await import('./services/twilio-phone-number-webhook-sync');
    await syncTwilioPhoneNumberWebhooks();
  } catch (err: any) {
    console.warn('⚠️  [Startup] Twilio phone number webhook sync failed:', err?.message || err);
  }

  startCallpilotWorker();

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    const correlationId = req.correlationId;
    const errorResponse: any = { 
      success: false,
      error: message, 
      message 
    };
    if (correlationId) {
      errorResponse.correlationId = correlationId;
    }

    console.error(`[Error Handler] ${req.method} ${req.path}:`, err.message || err);
    
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json');
      res.status(status).json(errorResponse);
    }
  });

  app.use('/api', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.status(404).json({
      success: false,
      error: "API endpoint not found",
      path: req.originalUrl,
      method: req.method
    });
  });

  const isProduction = app.get("env") === "production" || process.env.NODE_ENV === "production";
  
  const injectSeoMetaTags = async (html: string, baseUrl: string): Promise<string> => {
    try {
      const [seoSettings, appNameSetting, appTaglineSetting] = await Promise.all([
        storage.getSeoSettings(),
        storage.getGlobalSetting('app_name'),
        storage.getGlobalSetting('app_tagline')
      ]);

      const escapeHtml = (str: string): string => {
        return str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      };

      const siteName: string = String(appNameSetting?.value || 'AI Platform');
      const title: string = String(seoSettings?.defaultTitle || siteName);
      const description: string = String(seoSettings?.defaultDescription || appTaglineSetting?.value || 'AI-powered voice agents for automated calling');
      
      let ogImageUrl: string = String(seoSettings?.defaultOgImage || '/og-image.png');
      if (!ogImageUrl.startsWith('http')) {
        ogImageUrl = `${baseUrl}${ogImageUrl}`;
      }

      const seoMetaTags = `
    <!-- Server-side SEO meta tags for social sharing -->
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${escapeHtml(siteName)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />
    <!-- End server-side SEO meta tags -->`;

      return html.replace('</head>', `${seoMetaTags}\n  </head>`);
    } catch (error) {
      console.error('Error injecting SEO meta tags:', error);
      return html;
    }
  };
  
  const crawlerUserAgents = [
    'facebookexternalhit',
    'Facebot',
    'WhatsApp',
    'Twitterbot',
    'LinkedInBot',
    'Slackbot',
    'Discordbot',
    'TelegramBot',
    'Pinterest',
    'Googlebot',
    'bingbot'
  ];
  
  const isCrawler = (userAgent: string | undefined): boolean => {
    if (!userAgent) return false;
    return crawlerUserAgents.some(crawler => userAgent.toLowerCase().includes(crawler.toLowerCase()));
  };
  
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    const userAgent = req.headers['user-agent'];
    
    if (!req.path.startsWith('/api') && !req.path.includes('.') && isCrawler(userAgent)) {
      try {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
        const baseUrl = `${protocol}://${host}`;
        
        const fs = await import('fs').then(m => m.promises);
        const prodPath = path.resolve(import.meta.dirname, 'public', 'index.html');
        const devPath = path.join(process.cwd(), 'client', 'index.html');
        
        let indexPath = devPath;
        try {
          await fs.access(prodPath);
          if (isProduction) {
            indexPath = prodPath;
          }
        } catch {
        }
        
        let html = await fs.readFile(indexPath, 'utf-8');
        
        html = await injectSeoMetaTags(html, baseUrl);
        
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
        return;
      } catch (error) {
        console.error('Error serving crawler-optimized HTML:', error);
      }
    }
    next();
  });
  
  if (!isProduction) {
    await setupVite(app, server);
  } else {
    process.env.NODE_ENV = "production";
    app.set("env", "production");
    log("Running in PRODUCTION mode");
    
    const fs = await import('fs');
    const distPath = path.resolve(import.meta.dirname, "public");
    
    if (!fs.existsSync(distPath)) {
      throw new Error(
        `Could not find the build directory: ${distPath}, make sure to build the client first`,
      );
    }
    
    const sendFromDist = (res: Response, fileName: string, contentType?: string) => {
      const filePath = path.resolve(distPath, fileName);
      if (!fs.existsSync(filePath)) {
        return res.status(404).end();
      }
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }
      return res.sendFile(filePath);
    };

    // Serve common static/special endpoints explicitly so they don't get swallowed
    // by the SPA HTML fallback. Also avoids noisy 500s when crawlers probe these paths.
    app.get("/favicon.ico", (_req, res) => sendFromDist(res, "favicon.ico", "image/x-icon"));
    app.get("/favicon.png", (_req, res) => sendFromDist(res, "favicon.png", "image/png"));
    app.get("/apple-touch-icon.png", (_req, res) => {
      // We don't currently ship a dedicated apple touch icon; reuse favicon.png.
      return sendFromDist(res, "favicon.png", "image/png");
    });

    // Additional lightweight health endpoint for external uptime checks.
    app.get("/healthz", (_req, res) => {
      res.status(200).type('text/plain').send('ok');
    });

    app.get("/robots.txt", (req, res) => {
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
      const baseUrl = `${protocol}://${host}`;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send(
        [
          'User-agent: *',
          'Disallow: /api/',
          'Disallow: /app/',
          '',
          `Sitemap: ${baseUrl}/sitemap.xml`,
          '',
        ].join('\n'),
      );
    });

    app.get("/sitemap.xml", (req, res) => {
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
      const baseUrl = `${protocol}://${host}`;
      const urls = ["/", "/login", "/privacy", "/terms", "/cookies"].map((p) => `${baseUrl}${p}`);
      const now = new Date().toISOString();

      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.send(
        [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...urls.map(
            (loc) =>
              [
                '  <url>',
                `    <loc>${loc}</loc>`,
                `    <lastmod>${now}</lastmod>`,
                '  </url>',
              ].join('\n'),
          ),
          '</urlset>',
          '',
        ].join('\n'),
      );
    });

    app.get("/.well-known/security.txt", (req, res) => {
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
      const baseUrl = `${protocol}://${host}`;
      const contact = process.env.SECURITY_CONTACT || 'mailto:security@loopnine.replit.app';

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send(
        [
          `Contact: ${contact}`,
          `Canonical: ${baseUrl}/.well-known/security.txt`,
          'Preferred-Languages: en',
          '',
        ].join('\n'),
      );
    });

    app.use(express.static(distPath));
    
    app.get("*", async (req, res) => {
      // Only serve the SPA HTML shell for known client-side routes.
      // Everything else should return a real 404 (important for SEO and correct probing).
      const p = (() => {
        // `app.use("*")` style mounting can strip `req.url`/`req.path` in Express.
        // Use `originalUrl` as the source of truth.
        try {
          return new URL(req.originalUrl, "http://localhost").pathname;
        } catch {
          return req.path;
        }
      })();
      const isKnownClientRoute =
        p === "/" ||
        p === "/login" ||
        p === "/register" ||
        p === "/onboarding" ||
        p === "/team/login" ||
        p === "/privacy" ||
        p === "/terms" ||
        p === "/cookies" ||
        p === "/ops" ||
        p.startsWith("/app/");

      if (!isKnownClientRoute) {
        res.status(404).type('text/plain').send('Not found');
        return;
      }

      try {
        const indexPath = path.resolve(distPath, "index.html");
        let html = await fs.promises.readFile(indexPath, 'utf-8');
        
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
        const baseUrl = `${protocol}://${host}`;
        
        html = await injectSeoMetaTags(html, baseUrl);
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
      } catch (error) {
        console.error('Error serving index.html:', error);
        res.sendFile(path.resolve(distPath, "index.html"));
      }
    });
  }

  startPhoneBillingCron();
  startWatchdog();
  webhookRetryService.start();
  initializeMigrationEngine();
  startStaleCallsCleanup();
  signalReady();
  
  appFullyInitialized = true;
  log("All services initialized successfully");
})();
