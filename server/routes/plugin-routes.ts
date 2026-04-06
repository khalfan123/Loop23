/**
 * ============================================================
 * Plugin Management Routes
 * 
 * User routes for checking plugin availability/capabilities.
 * ============================================================
 */

import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { 
  discoverPlugins, 
  getPluginStatus, 
  setPluginEnabled, 
  getPluginManifest,
  getPlugin
} from '../plugins/loader';
import { getUserPlanCapabilities } from '../services/membership-service';

// Handle both ESM (development) and CJS (production bundle) contexts
const getDirname = () => {
  try {
    if (typeof import.meta?.url === 'string') {
      return path.dirname(fileURLToPath(import.meta.url));
    }
  } catch {}
  return __dirname ?? process.cwd();
};

const currentDir = getDirname();
const pluginsDir = path.resolve(currentDir, '../../plugins');

const router = Router();

/**
 * User-accessible endpoint for plugin capabilities
 * This router can be mounted without admin auth
 */
export const userPluginRouter = Router();

/**
 * GET /api/plugins/capabilities
 * Returns which plugins are enabled (user-safe, no sensitive data)
 * This is used by the frontend to conditionally show plugin-dependent UI
 * 
 * Now also checks user's plan to determine if they have SIP access
 */
userPluginRouter.get('/capabilities', async (req, res) => {
  // Cache for 60 seconds - capabilities rarely change
  res.setHeader('Cache-Control', 'private, max-age=60');
  
  try {
    const plugins = await getPluginStatus();
    
    const capabilities: Record<string, boolean> = {};
    const pluginBundles: Record<string, string> = {};
    
    for (const plugin of plugins) {
      if (plugin.enabled && plugin.registered) {
        capabilities[plugin.name] = true;
        // If plugin has a frontend bundle, include its URL
        // Use /bundle (without .js) to avoid Vite middleware transformation
        if (plugin.hasFrontendBundle) {
          pluginBundles[plugin.name] = `/api/plugins/${plugin.name}/bundle`;
        }
      }
    }
    
    // Check if SIP Engine plugin is globally enabled
    const sipPluginEnabled = capabilities['sip-engine'] ?? false;
    
    // Check if user has SIP access via their plan
    let userHasSipAccess = false;
    let sipEnginesAllowed: string[] = [];
    let maxConcurrentSipCalls = 0;
    
    // Get user's plan capabilities if authenticated
    const userId = (req as any).userId;
    if (userId && sipPluginEnabled) {
      try {
        const planCapabilities = await getUserPlanCapabilities(userId);
        userHasSipAccess = planCapabilities.sipEnabled;
        sipEnginesAllowed = planCapabilities.sipEnginesAllowed;
        maxConcurrentSipCalls = planCapabilities.maxConcurrentSipCalls;
      } catch (err) {
        console.warn('[Plugin Capabilities] Could not get user plan capabilities:', err);
      }
    }
    
    // SIP Engine is accessible only if plugin is enabled AND user's plan allows it
    const sipEngineAccess = sipPluginEnabled && userHasSipAccess;
    
    res.json({
      success: true,
      data: {
        capabilities,
        pluginBundles,
        sipEngine: sipEngineAccess,
        sipEnginesAllowed: sipEngineAccess ? sipEnginesAllowed : [],
        maxConcurrentSipCalls: sipEngineAccess ? maxConcurrentSipCalls : 0,
        restApi: capabilities['rest-api'] ?? false,
        teamManagement: capabilities['team-management'] ?? false,
      }
    });
  } catch (error: any) {
    console.error('[Plugin Capabilities] Error getting capabilities:', error);
    res.json({
      success: true,
      data: {
        capabilities: {},
        pluginBundles: {},
        sipEngine: false,
        sipEnginesAllowed: [],
        maxConcurrentSipCalls: 0,
        restApi: false,
        teamManagement: false,
      }
    });
  }
});

/**
 * Public router for serving plugin bundles
 * No authentication required - bundles are just JavaScript code
 * Plugin enabled status is still checked
 */
export const publicPluginRouter = Router();

/**
 * GET /api/plugins/:name/bundle.js or /api/plugins/:name/bundle
 * Serve the frontend bundle for a plugin (public access)
 * This allows plugins to self-register their UI components at runtime
 * Uses .bundle extension to prevent Vite middleware transformation
 */
publicPluginRouter.get('/:name/bundle', async (req, res) => {
  try {
    const { name } = req.params;
    const plugin = getPlugin(name);
    
    if (!plugin) {
      return res.status(404).json({
        success: false,
        error: 'Plugin not found',
      });
    }
    
    if (!plugin.enabled || !plugin.registered) {
      return res.status(403).json({
        success: false,
        error: 'Plugin is not enabled',
      });
    }
    
    const manifest = plugin.manifest;
    if (!manifest.ui?.frontendBundle) {
      return res.status(404).json({
        success: false,
        error: 'Plugin has no frontend bundle',
      });
    }
    
    const bundlePath = path.join(pluginsDir, name, manifest.ui.frontendBundle);
    
    if (!fs.existsSync(bundlePath)) {
      return res.status(404).json({
        success: false,
        error: 'Bundle file not found',
      });
    }
    
    // Get file stats for ETag (cache-busting when file changes)
    const stats = fs.statSync(bundlePath);
    const etag = `"${stats.size}-${stats.mtime.getTime()}"`;
    const lastModified = stats.mtime.toUTCString();
    
    // Check If-None-Match for 304 response
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }
    
    // Read file content directly to prevent any middleware transformation
    const bundleContent = fs.readFileSync(bundlePath, 'utf-8');
    
    // Set headers to explicitly prevent Vite/middleware transformation
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('ETag', etag);
    res.setHeader('Last-Modified', lastModified);
    // Cache with revalidation - client caches but must check ETag on expiry
    res.setHeader('Cache-Control', process.env.NODE_ENV === 'production' ? 'public, max-age=300, must-revalidate' : 'no-cache');
    res.setHeader('X-Vite-Skip', 'true');
    
    // Send raw content as string
    res.send(bundleContent);
    
  } catch (error: any) {
    console.error('[Plugin Routes] Error serving bundle:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to serve plugin bundle',
    });
  }
});

export default router;
