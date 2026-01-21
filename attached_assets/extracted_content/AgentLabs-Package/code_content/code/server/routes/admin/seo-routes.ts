'use strict';
import { Router, Response } from 'express';
import { storage } from '../../storage';
import { AdminRequest } from '../../middleware/admin-auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const uploadStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'seo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: uploadStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type.'));
    }
  }
});

export function registerSeoRoutes(router: Router) {
  router.get('/seo', async (req: AdminRequest, res: Response) => {
    try {
      const seoKeys = [
        'seo_title', 'seo_description', 'seo_keywords', 'seo_og_image',
        'seo_og_type', 'seo_twitter_card', 'seo_twitter_site',
        'seo_canonical_url', 'seo_robots', 'seo_sitemap_urls',
        'seo_structured_data_org', 'seo_structured_data_faq', 'seo_structured_data_product',
        'seo_twitter_handle', 'seo_facebook_app_id', 'seo_robots_rules', 'seo_robots_crawl_delay'
      ];
      const seoSettings: Record<string, any> = {};
      
      for (const key of seoKeys) {
        const setting = await storage.getGlobalSetting(key);
        if (setting) {
          seoSettings[key] = setting.value;
        }
      }
      
      // Map backend keys to frontend-expected field names for structured data
      const mappedSettings: Record<string, any> = {
        ...seoSettings,
        // Map to frontend field names
        defaultTitle: seoSettings.seo_title,
        defaultDescription: seoSettings.seo_description,
        defaultKeywords: seoSettings.seo_keywords,
        defaultOgImage: seoSettings.seo_og_image,
        structuredDataOrg: seoSettings.seo_structured_data_org,
        structuredDataFaq: seoSettings.seo_structured_data_faq,
        structuredDataProduct: seoSettings.seo_structured_data_product,
        twitterHandle: seoSettings.seo_twitter_handle,
        facebookAppId: seoSettings.seo_facebook_app_id,
        robotsRules: seoSettings.seo_robots_rules,
        robotsCrawlDelay: seoSettings.seo_robots_crawl_delay,
        canonicalBaseUrl: seoSettings.seo_canonical_url,
        sitemapUrls: seoSettings.seo_sitemap_urls || []
      };
      
      res.json(mappedSettings);
    } catch (error) {
      console.error('Error fetching SEO settings:', error);
      res.status(500).json({ error: 'Failed to fetch SEO settings' });
    }
  });

  router.patch('/seo', async (req: AdminRequest, res: Response) => {
    try {
      const {
        seo_title, seo_description, seo_keywords, seo_og_image,
        seo_og_type, seo_twitter_card, seo_twitter_site,
        seo_canonical_url, seo_robots,
        // Structured data fields
        structuredDataOrg, structuredDataFaq, structuredDataProduct,
        // Additional fields from frontend
        defaultTitle, defaultDescription, defaultKeywords,
        twitterHandle, facebookAppId, robotsRules, robotsCrawlDelay
      } = req.body;
      
      // Basic SEO fields
      if (seo_title !== undefined) await storage.updateGlobalSetting('seo_title', seo_title);
      if (seo_description !== undefined) await storage.updateGlobalSetting('seo_description', seo_description);
      if (seo_keywords !== undefined) await storage.updateGlobalSetting('seo_keywords', seo_keywords);
      if (seo_og_image !== undefined) await storage.updateGlobalSetting('seo_og_image', seo_og_image);
      if (seo_og_type !== undefined) await storage.updateGlobalSetting('seo_og_type', seo_og_type);
      if (seo_twitter_card !== undefined) await storage.updateGlobalSetting('seo_twitter_card', seo_twitter_card);
      if (seo_twitter_site !== undefined) await storage.updateGlobalSetting('seo_twitter_site', seo_twitter_site);
      if (seo_canonical_url !== undefined) await storage.updateGlobalSetting('seo_canonical_url', seo_canonical_url);
      if (seo_robots !== undefined) await storage.updateGlobalSetting('seo_robots', seo_robots);
      
      // Structured data fields
      if (structuredDataOrg !== undefined) await storage.updateGlobalSetting('seo_structured_data_org', structuredDataOrg);
      if (structuredDataFaq !== undefined) await storage.updateGlobalSetting('seo_structured_data_faq', structuredDataFaq);
      if (structuredDataProduct !== undefined) await storage.updateGlobalSetting('seo_structured_data_product', structuredDataProduct);
      
      // Additional fields (frontend uses different naming)
      if (defaultTitle !== undefined) await storage.updateGlobalSetting('seo_title', defaultTitle);
      if (defaultDescription !== undefined) await storage.updateGlobalSetting('seo_description', defaultDescription);
      if (defaultKeywords !== undefined) await storage.updateGlobalSetting('seo_keywords', defaultKeywords);
      if (twitterHandle !== undefined) await storage.updateGlobalSetting('seo_twitter_handle', twitterHandle);
      if (facebookAppId !== undefined) await storage.updateGlobalSetting('seo_facebook_app_id', facebookAppId);
      if (robotsRules !== undefined) await storage.updateGlobalSetting('seo_robots_rules', robotsRules);
      if (robotsCrawlDelay !== undefined) await storage.updateGlobalSetting('seo_robots_crawl_delay', robotsCrawlDelay);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating SEO settings:', error);
      res.status(500).json({ error: 'Failed to update SEO settings' });
    }
  });

  router.post('/seo/sitemap-urls', async (req: AdminRequest, res: Response) => {
    try {
      const { urls } = req.body;
      
      if (!Array.isArray(urls)) {
        return res.status(400).json({ error: 'URLs must be an array' });
      }
      
      const existingSetting = await storage.getGlobalSetting('seo_sitemap_urls');
      const existingUrls = (existingSetting?.value as string[]) || [];
      const urlSet = new Set([...existingUrls, ...urls]);
      const newUrls = Array.from(urlSet);
      
      await storage.updateGlobalSetting('seo_sitemap_urls', newUrls);
      
      res.json({ success: true, urls: newUrls });
    } catch (error) {
      console.error('Error adding sitemap URLs:', error);
      res.status(500).json({ error: 'Failed to add sitemap URLs' });
    }
  });

  router.delete('/seo/sitemap-urls', async (req: AdminRequest, res: Response) => {
    try {
      const { urls } = req.body;
      
      if (!Array.isArray(urls)) {
        return res.status(400).json({ error: 'URLs must be an array' });
      }
      
      const existingSetting = await storage.getGlobalSetting('seo_sitemap_urls');
      const existingUrls = (existingSetting?.value as string[]) || [];
      const newUrls = existingUrls.filter(url => !urls.includes(url));
      
      await storage.updateGlobalSetting('seo_sitemap_urls', newUrls);
      
      res.json({ success: true, urls: newUrls });
    } catch (error) {
      console.error('Error removing sitemap URLs:', error);
      res.status(500).json({ error: 'Failed to remove sitemap URLs' });
    }
  });

  router.post('/seo/generate-sitemap', async (req: AdminRequest, res: Response) => {
    try {
      const baseUrl = process.env.BASE_URL || process.env.APP_URL || 'https://example.com';
      const urlsSetting = await storage.getGlobalSetting('seo_sitemap_urls');
      const customUrls = (urlsSetting?.value as string[]) || [];
      
      const defaultUrls = ['/', '/login', '/register', '/pricing', '/about', '/contact', '/privacy', '/terms'];
      const urlSet1 = new Set([...defaultUrls, ...customUrls]);
      const allUrls = Array.from(urlSet1);
      
      let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
      sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
      
      for (const url of allUrls) {
        const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
        sitemap += `  <url>\n    <loc>${fullUrl}</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n  </url>\n`;
      }
      
      sitemap += '</urlset>';
      
      const sitemapPath = path.join(process.cwd(), 'public', 'sitemap.xml');
      fs.writeFileSync(sitemapPath, sitemap);
      
      res.json({ success: true, message: 'Sitemap generated successfully', urlCount: allUrls.length });
    } catch (error) {
      console.error('Error generating sitemap:', error);
      res.status(500).json({ error: 'Failed to generate sitemap' });
    }
  });

  router.post('/seo/rebuild-sitemap', async (req: AdminRequest, res: Response) => {
    try {
      const baseUrl = process.env.BASE_URL || process.env.APP_URL || 'https://example.com';
      const urlsSetting = await storage.getGlobalSetting('seo_sitemap_urls');
      const customUrls = (urlsSetting?.value as string[]) || [];
      
      const defaultUrls = ['/', '/login', '/register', '/pricing', '/about', '/contact', '/privacy', '/terms'];
      const urlSet2 = new Set([...defaultUrls, ...customUrls]);
      const allUrls = Array.from(urlSet2);
      
      let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
      sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
      
      for (const url of allUrls) {
        const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
        sitemap += `  <url>\n    <loc>${fullUrl}</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n  </url>\n`;
      }
      
      sitemap += '</urlset>';
      
      const sitemapPath = path.join(process.cwd(), 'public', 'sitemap.xml');
      fs.writeFileSync(sitemapPath, sitemap);
      
      res.json({ success: true, message: 'Sitemap rebuilt successfully', urlCount: allUrls.length });
    } catch (error) {
      console.error('Error rebuilding sitemap:', error);
      res.status(500).json({ error: 'Failed to rebuild sitemap' });
    }
  });

  router.post('/seo/upload-image', async (req: AdminRequest, res: Response) => {
    try {
      const { imageData, imageType, fileName, field } = req.body;
      
      // Handle base64 image data from frontend
      if (imageData && typeof imageData === 'string' && imageData.startsWith('data:')) {
        const matches = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!matches) {
          return res.status(400).json({ error: 'Invalid image data format' });
        }
        
        const mimeType = matches[1].toLowerCase();
        const allowedTypes = ['jpeg', 'jpg', 'png', 'gif', 'webp'];
        if (!allowedTypes.includes(mimeType)) {
          return res.status(400).json({ error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.' });
        }
        
        const ext = mimeType === 'jpeg' ? 'jpg' : mimeType;
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Enforce file size limit (5MB)
        const maxSize = 5 * 1024 * 1024;
        if (buffer.length > maxSize) {
          return res.status(400).json({ error: 'File size exceeds 5MB limit' });
        }
        
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const newFileName = `seo-${imageType || 'image'}-${uniqueSuffix}.${ext}`;
        const filePath = path.join(uploadsDir, newFileName);
        
        fs.writeFileSync(filePath, buffer);
        
        const imageUrl = `/uploads/${newFileName}`;
        
        // Save to settings based on image type or legacy field name
        if (imageType === 'ogImage' || field === 'seo_og_image') {
          await storage.updateGlobalSetting('seo_og_image', imageUrl);
        }
        
        return res.json({ success: true, url: imageUrl, imageType });
      }
      
      return res.status(400).json({ error: 'No valid image data provided' });
    } catch (error) {
      console.error('Error uploading SEO image:', error);
      res.status(500).json({ error: 'Failed to upload SEO image' });
    }
  });
  
  // Also keep multipart form upload endpoint for backward compatibility
  router.post('/seo/upload-image-form', upload.single('image'), async (req: AdminRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const imageUrl = `/uploads/${req.file.filename}`;
      const { field } = req.body;
      
      if (field === 'seo_og_image') {
        await storage.updateGlobalSetting('seo_og_image', imageUrl);
      }
      
      res.json({ success: true, url: imageUrl });
    } catch (error) {
      console.error('Error uploading SEO image:', error);
      res.status(500).json({ error: 'Failed to upload SEO image' });
    }
  });

  router.get('/analytics-scripts', async (req: AdminRequest, res: Response) => {
    try {
      const scripts = await storage.getAllAnalyticsScripts();
      res.json(scripts);
    } catch (error) {
      console.error('Error fetching analytics scripts:', error);
      res.status(500).json({ error: 'Failed to fetch analytics scripts' });
    }
  });

  router.post('/analytics-scripts', async (req: AdminRequest, res: Response) => {
    try {
      const { name, type, code, headCode, bodyCode, placement, loadPriority, async: asyncLoad, defer, enabled, hideOnInternalPages, description } = req.body;
      
      // Accept either legacy 'code' field or the new headCode/bodyCode fields
      const hasCode = code && code.trim().length > 0;
      const hasHeadCode = headCode && headCode.trim().length > 0;
      const hasBodyCode = bodyCode && bodyCode.trim().length > 0;
      
      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }
      if (!hasCode && !hasHeadCode && !hasBodyCode) {
        return res.status(400).json({ error: 'At least one of code, headCode, or bodyCode is required' });
      }
      
      // For backward compatibility, populate code from headCode/bodyCode if empty
      const effectiveCode = hasCode ? code : (hasHeadCode ? headCode : bodyCode);
      
      const newScript = await storage.createAnalyticsScript({
        name,
        type: type || 'custom',
        code: effectiveCode,
        headCode,
        bodyCode,
        placement: placement ? (Array.isArray(placement) ? placement : [placement]) : ['head'],
        loadPriority: loadPriority || 0,
        async: asyncLoad || false,
        defer: defer || false,
        enabled: enabled !== false,
        hideOnInternalPages: hideOnInternalPages || false,
        description
      });
      
      res.json(newScript);
    } catch (error) {
      console.error('Error creating analytics script:', error);
      res.status(500).json({ error: 'Failed to create analytics script' });
    }
  });

  router.patch('/analytics-scripts/:id', async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { 
        name, 
        type,
        code, 
        headCode,
        bodyCode,
        placement, 
        loadPriority,
        async: asyncLoad,
        defer,
        enabled,
        hideOnInternalPages,
        description
      } = req.body;
      
      const updateData: Record<string, any> = {};
      if (name !== undefined) updateData.name = name;
      if (type !== undefined) updateData.type = type;
      if (code !== undefined) updateData.code = code;
      if (headCode !== undefined) updateData.headCode = headCode;
      if (bodyCode !== undefined) updateData.bodyCode = bodyCode;
      if (placement !== undefined) updateData.placement = Array.isArray(placement) ? placement : [placement];
      if (loadPriority !== undefined) updateData.loadPriority = loadPriority;
      if (asyncLoad !== undefined) updateData.async = asyncLoad;
      if (defer !== undefined) updateData.defer = defer;
      if (enabled !== undefined) updateData.enabled = enabled;
      if (hideOnInternalPages !== undefined) updateData.hideOnInternalPages = hideOnInternalPages;
      if (description !== undefined) updateData.description = description;
      
      await storage.updateAnalyticsScript(id, updateData);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating analytics script:', error);
      res.status(500).json({ error: 'Failed to update analytics script' });
    }
  });

  router.delete('/analytics-scripts/:id', async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteAnalyticsScript(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting analytics script:', error);
      res.status(500).json({ error: 'Failed to delete analytics script' });
    }
  });
}
