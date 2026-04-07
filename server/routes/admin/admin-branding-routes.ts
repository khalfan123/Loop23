import { Router, Request, Response } from "express";
import { db } from "../../db";
import { storage } from "../../storage";
import { globalSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

const BRANDING_KEYS = [
  "platform_name", "platform_logo", "platform_favicon", "platform_primary_color",
  "platform_secondary_color", "platform_footer_text", "platform_support_email",
  "platform_support_url", "login_page_title", "login_page_subtitle",
  "signup_page_title", "signup_page_subtitle", "custom_css",
];

router.get("/branding", async (_req: Request, res: Response) => {
  try {
    const branding: Record<string, any> = {};
    for (const key of BRANDING_KEYS) {
      const setting = await storage.getGlobalSetting(key);
      branding[key] = setting?.value ?? null;
    }
    res.json(branding);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch branding" });
  }
});

router.put("/branding", async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      if (BRANDING_KEYS.includes(key)) {
        await storage.updateGlobalSetting(key, value);
      }
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update branding" });
  }
});

router.patch("/branding", async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      if (BRANDING_KEYS.includes(key)) {
        await storage.updateGlobalSetting(key, value);
      }
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update branding" });
  }
});

router.post("/branding/reset", async (_req: Request, res: Response) => {
  try {
    for (const key of BRANDING_KEYS) {
      await storage.updateGlobalSetting(key, null);
    }
    res.json({ success: true, message: "Branding reset to defaults" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to reset branding" });
  }
});

export default router;
