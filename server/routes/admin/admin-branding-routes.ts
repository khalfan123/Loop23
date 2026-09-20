import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "../../storage";

const router = Router();

// Keys aligned with /api/branding and /api/init consumers.
const BRANDING_TEXT_KEYS = [
  "app_name",
  "app_tagline",
  "logo_size",
  "admin_email",
  "social_twitter_url",
  "social_linkedin_url",
  "social_github_url",
] as const;

const BRANDING_ASSET_KEYS = [
  "logo_url",
  "logo_url_light",
  "logo_url_dark",
  "favicon_url",
] as const;

const ALL_BRANDING_KEYS = [
  ...BRANDING_TEXT_KEYS,
  ...BRANDING_ASSET_KEYS,
  "branding_updated_at",
] as const;

const uploadsDir = path.join(process.cwd(), "client", "public", "uploads", "branding");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${unique}${path.extname(file.originalname)}`);
  },
});

const LOGO_MIME = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
const FAVICON_MIME = [...LOGO_MIME, "image/x-icon", "image/vnd.microsoft.icon"];

const uploadLogo = multer({
  storage: uploadStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (LOGO_MIME.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Invalid file type. Allowed: PNG, JPEG, GIF, WEBP, SVG."));
  },
});

const uploadFavicon = multer({
  storage: uploadStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (FAVICON_MIME.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Invalid file type. Allowed: PNG, JPEG, GIF, WEBP, SVG, ICO."));
  },
});

async function touchBrandingTimestamp() {
  await storage.updateGlobalSetting("branding_updated_at", new Date().toISOString());
}

router.get("/branding", async (_req: Request, res: Response) => {
  try {
    const branding: Record<string, any> = {};
    for (const key of ALL_BRANDING_KEYS) {
      const setting = await storage.getGlobalSetting(key);
      branding[key] = setting?.value ?? null;
    }
    res.json(branding);
  } catch (error: any) {
    console.error("Error fetching admin branding:", error);
    res.status(500).json({ error: "Failed to fetch branding" });
  }
});

async function applyBrandingPatch(updates: Record<string, any>) {
  for (const [key, value] of Object.entries(updates)) {
    if ((ALL_BRANDING_KEYS as readonly string[]).includes(key)) {
      await storage.updateGlobalSetting(key, value ?? null);
    }
  }
  await touchBrandingTimestamp();
}

router.put("/branding", async (req: Request, res: Response) => {
  try {
    await applyBrandingPatch(req.body ?? {});
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error updating branding:", error);
    res.status(500).json({ error: "Failed to update branding" });
  }
});

router.patch("/branding", async (req: Request, res: Response) => {
  try {
    await applyBrandingPatch(req.body ?? {});
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error updating branding:", error);
    res.status(500).json({ error: "Failed to update branding" });
  }
});

function makeUploadHandler(settingKey: (typeof BRANDING_ASSET_KEYS)[number]) {
  return async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const url = `/uploads/branding/${req.file.filename}`;
      await storage.updateGlobalSetting(settingKey, url);
      await touchBrandingTimestamp();
      res.json({ success: true, url, [settingKey]: url });
    } catch (error: any) {
      console.error(`Error uploading ${settingKey}:`, error);
      res.status(500).json({ error: `Failed to upload ${settingKey}` });
    }
  };
}

function wrapUpload(mw: (req: Request, res: Response, next: NextFunction) => void) {
  return (req: Request, res: Response, next: NextFunction) => {
    mw(req, res, (err?: any) => {
      if (err) {
        const status = err instanceof multer.MulterError ? 400 : 400;
        return res.status(status).json({ error: err.message || "Upload failed" });
      }
      next();
    });
  };
}

router.post("/branding/upload-logo", wrapUpload(uploadLogo.single("logo")), makeUploadHandler("logo_url"));
router.post("/branding/upload-logo-light", wrapUpload(uploadLogo.single("logo")), makeUploadHandler("logo_url_light"));
router.post("/branding/upload-logo-dark", wrapUpload(uploadLogo.single("logo")), makeUploadHandler("logo_url_dark"));
router.post("/branding/upload-favicon", wrapUpload(uploadFavicon.single("favicon")), makeUploadHandler("favicon_url"));

function makeDeleteHandler(settingKey: (typeof BRANDING_ASSET_KEYS)[number]) {
  return async (_req: Request, res: Response) => {
    try {
      await storage.updateGlobalSetting(settingKey, null);
      await touchBrandingTimestamp();
      res.json({ success: true });
    } catch (error: any) {
      console.error(`Error deleting ${settingKey}:`, error);
      res.status(500).json({ error: `Failed to delete ${settingKey}` });
    }
  };
}

router.delete("/branding/logo", makeDeleteHandler("logo_url"));
router.delete("/branding/logo-light", makeDeleteHandler("logo_url_light"));
router.delete("/branding/logo-dark", makeDeleteHandler("logo_url_dark"));
router.delete("/branding/favicon", makeDeleteHandler("favicon_url"));

router.post("/branding/reset", async (_req: Request, res: Response) => {
  try {
    for (const key of [...BRANDING_ASSET_KEYS, ...BRANDING_TEXT_KEYS]) {
      await storage.updateGlobalSetting(key, null);
    }
    await touchBrandingTimestamp();
    res.json({ success: true, message: "Branding reset to defaults" });
  } catch (error: any) {
    console.error("Error resetting branding:", error);
    res.status(500).json({ error: "Failed to reset branding" });
  }
});

export default router;
