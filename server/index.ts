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
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startPhoneBillingCron } from "./services/phone-billing-cron";
import { runStartupHealthCheck, getHealthStatus } from "./services/startup-health-check";
import { setupGlobalHandlers, registerServer, signalReady } from "./services/graceful-shutdown";
import { startWatchdog } from "./services/resource-watchdog";
import { webhookRetryService } from "./services/webhook-retry-service";
import { preloadJwtExpiry } from "./middleware/auth";
import { storage } from "./storage";
import { initializeMigrationEngine } from "./engines/elevenlabs-migration";
import { correlationIdMiddleware } from "./middleware/correlation-id";
import { emailService } from "./services/email-service";
import { initializeDirectories } from "./utils/init-directories";

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

// Simple health check endpoint for deployment
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
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

(async () => {
  // Initialize email service from database settings FIRST (before health check)
  // This ensures database SMTP settings take precedence over env vars
  try {
    const emailInitialized = await emailService.reinitializeFromDatabase();
    if (emailInitialized) {
      console.log('📧 [Email] Service initialized from database settings');
    }
  } catch (error) {
    console.error('⚠️ [Email] Failed to initialize from database:', error);
  }
  
  // Run startup health checks before serving traffic
  try {
    await runStartupHealthCheck();
  } catch (error) {
    console.error('❌ [Startup] Health check failed:', error);
  }
  
  // Preload JWT expiry settings from database
  await preloadJwtExpiry(storage);
  
  const server = await registerRoutes(app);

  // Global error handler - ALWAYS returns JSON for API routes
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    // Include correlation ID in error response for debugging
    const correlationId = req.correlationId;
    const errorResponse: any = { 
      success: false,
      error: message, 
      message 
    };
    if (correlationId) {
      errorResponse.correlationId = correlationId;
    }

    // Log the error for debugging (don't re-throw as that crashes the server)
    console.error(`[Error Handler] ${req.method} ${req.path}:`, err.message || err);
    
    // Always return JSON response for API routes, never crash the server
    if (!res.headersSent) {
      // Explicitly set Content-Type to prevent HTML responses
      res.setHeader('Content-Type', 'application/json');
      res.status(status).json(errorResponse);
    }
  });

  // API 404 handler - catches any /api route that wasn't matched
  // This MUST run before Vite catch-all to prevent HTML responses for API routes
  app.use('/api', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.status(404).json({
      success: false,
      error: "API endpoint not found",
      path: req.originalUrl,
      method: req.method
    });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  const isProduction = app.get("env") === "production" || process.env.NODE_ENV === "production";
  
  // SEO meta tag injection middleware for social sharing (Facebook, WhatsApp, Twitter, etc.)
  // This injects og:image and other meta tags server-side since crawlers don't execute JavaScript
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
  
  // Crawler user agents that need server-rendered OG meta tags
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
  
  // Middleware to serve SEO-optimized HTML for social media crawlers
  // This runs BEFORE Vite/static file serving to catch crawler requests
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    const userAgent = req.headers['user-agent'];
    
    // Only intercept non-API HTML page requests from crawlers
    if (!req.path.startsWith('/api') && !req.path.includes('.') && isCrawler(userAgent)) {
      try {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
        const baseUrl = `${protocol}://${host}`;
        
        // Read the appropriate HTML template based on environment
        const fs = await import('fs').then(m => m.promises);
        const prodPath = path.resolve(import.meta.dirname, 'public', 'index.html');
        const devPath = path.join(process.cwd(), 'client', 'index.html');
        
        // Use production build in production, dev template in development
        let indexPath = devPath;
        try {
          await fs.access(prodPath);
          if (isProduction) {
            indexPath = prodPath;
          }
        } catch {
          // Production build doesn't exist, use dev path
        }
        
        let html = await fs.readFile(indexPath, 'utf-8');
        
        // Inject SEO meta tags
        html = await injectSeoMetaTags(html, baseUrl);
        
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
        return;
      } catch (error) {
        console.error('Error serving crawler-optimized HTML:', error);
        // Fall through to normal serving if error occurs
      }
    }
    next();
  });
  
  if (!isProduction) {
    await setupVite(app, server);
  } else {
    // Set NODE_ENV to production for proper middleware behavior
    process.env.NODE_ENV = "production";
    app.set("env", "production");
    log("Running in PRODUCTION mode");
    
    // In production, serve static files with SEO injection
    const fs = await import('fs');
    const distPath = path.resolve(import.meta.dirname, "public");
    
    if (!fs.existsSync(distPath)) {
      throw new Error(
        `Could not find the build directory: ${distPath}, make sure to build the client first`,
      );
    }
    
    app.use(express.static(distPath));
    
    // Serve index.html with SEO meta tags for all non-file routes
    app.use("*", async (req, res) => {
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

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  
  // Register the server for graceful shutdown
  registerServer(server);
  
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Start phone number billing cron job
    startPhoneBillingCron();
    
    // Start resource watchdog for auto-restart monitoring
    startWatchdog();
    
    // Start webhook retry service for failed payment webhooks
    webhookRetryService.start();
    
    // Start ElevenLabs migration engine (handles retry queue for capacity errors)
    initializeMigrationEngine();
    
    // Signal PM2 that the process is ready to receive connections
    signalReady();
  });
})();
