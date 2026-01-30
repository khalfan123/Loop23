'use strict';
import { Router, Response } from 'express';
import { storage } from '../../storage';
import { AdminRequest } from '../../middleware/admin-auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadsDir = path.join(process.cwd(), 'client', 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const uploadStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: uploadStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/x-icon'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'));
    }
  }
});

export function registerBrandingRoutes(router: Router) {
  router.get('/branding', async (req: AdminRequest, res: Response) => {
    try {
      const brandingKeys = ['app_name', 'app_tagline', 'logo_url', 'logo_url_light', 'logo_url_dark', 'favicon_url', 'branding_updated_at'];
      const branding: Record<string, any> = {};
      
      for (const key of brandingKeys) {
        const setting = await storage.getGlobalSetting(key);
        if (setting) {
          branding[key] = setting.value;
        }
      }
      
      res.json(branding);
    } catch (error) {
      console.error('Error fetching branding:', error);
      res.status(500).json({ error: 'Failed to fetch branding' });
    }
  });

  router.patch('/branding', async (req: AdminRequest, res: Response) => {
    try {
      const { app_name, app_tagline, logo_url, logo_url_light, logo_url_dark, favicon_url } = req.body;
      
      if (app_name !== undefined) await storage.updateGlobalSetting('app_name', app_name);
      if (app_tagline !== undefined) await storage.updateGlobalSetting('app_tagline', app_tagline);
      if (logo_url !== undefined) await storage.updateGlobalSetting('logo_url', logo_url);
      if (logo_url_light !== undefined) await storage.updateGlobalSetting('logo_url_light', logo_url_light);
      if (logo_url_dark !== undefined) await storage.updateGlobalSetting('logo_url_dark', logo_url_dark);
      if (favicon_url !== undefined) await storage.updateGlobalSetting('favicon_url', favicon_url);
      
      await storage.updateGlobalSetting('branding_updated_at', new Date().toISOString());
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating branding:', error);
      res.status(500).json({ error: 'Failed to update branding' });
    }
  });

  router.post('/branding/upload-logo', upload.single('logo'), async (req: AdminRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const logoUrl = `/uploads/${req.file.filename}`;
      await storage.updateGlobalSetting('logo_url', logoUrl);
      await storage.updateGlobalSetting('branding_updated_at', new Date().toISOString());
      
      res.json({ success: true, url: logoUrl, logo_url: logoUrl });
    } catch (error) {
      console.error('Error uploading logo:', error);
      res.status(500).json({ error: 'Failed to upload logo' });
    }
  });

  router.post('/branding/upload-logo-light', upload.single('logo'), async (req: AdminRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const logoUrl = `/uploads/${req.file.filename}`;
      await storage.updateGlobalSetting('logo_url_light', logoUrl);
      await storage.updateGlobalSetting('branding_updated_at', new Date().toISOString());
      
      res.json({ success: true, url: logoUrl, logo_url_light: logoUrl });
    } catch (error) {
      console.error('Error uploading light logo:', error);
      res.status(500).json({ error: 'Failed to upload light logo' });
    }
  });

  router.post('/branding/upload-logo-dark', upload.single('logo'), async (req: AdminRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const logoUrl = `/uploads/${req.file.filename}`;
      await storage.updateGlobalSetting('logo_url_dark', logoUrl);
      await storage.updateGlobalSetting('branding_updated_at', new Date().toISOString());
      
      res.json({ success: true, url: logoUrl, logo_url_dark: logoUrl });
    } catch (error) {
      console.error('Error uploading dark logo:', error);
      res.status(500).json({ error: 'Failed to upload dark logo' });
    }
  });

  router.post('/branding/upload-favicon', upload.single('favicon'), async (req: AdminRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const faviconUrl = `/uploads/${req.file.filename}`;
      await storage.updateGlobalSetting('favicon_url', faviconUrl);
      await storage.updateGlobalSetting('branding_updated_at', new Date().toISOString());
      
      res.json({ success: true, url: faviconUrl, favicon_url: faviconUrl });
    } catch (error) {
      console.error('Error uploading favicon:', error);
      res.status(500).json({ error: 'Failed to upload favicon' });
    }
  });

  router.delete('/branding/logo', async (req: AdminRequest, res: Response) => {
    try {
      await storage.updateGlobalSetting('logo_url', '');
      await storage.updateGlobalSetting('branding_updated_at', new Date().toISOString());
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting logo:', error);
      res.status(500).json({ error: 'Failed to delete logo' });
    }
  });

  router.delete('/branding/logo-light', async (req: AdminRequest, res: Response) => {
    try {
      await storage.updateGlobalSetting('logo_url_light', '');
      await storage.updateGlobalSetting('branding_updated_at', new Date().toISOString());
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting light logo:', error);
      res.status(500).json({ error: 'Failed to delete light logo' });
    }
  });

  router.delete('/branding/logo-dark', async (req: AdminRequest, res: Response) => {
    try {
      await storage.updateGlobalSetting('logo_url_dark', '');
      await storage.updateGlobalSetting('branding_updated_at', new Date().toISOString());
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting dark logo:', error);
      res.status(500).json({ error: 'Failed to delete dark logo' });
    }
  });

  router.delete('/branding/favicon', async (req: AdminRequest, res: Response) => {
    try {
      await storage.updateGlobalSetting('favicon_url', '');
      await storage.updateGlobalSetting('branding_updated_at', new Date().toISOString());
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting favicon:', error);
      res.status(500).json({ error: 'Failed to delete favicon' });
    }
  });
}
