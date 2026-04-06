import { Router, Request, Response } from "express";
import { db } from "../../db";
import { seoSettings, analyticsScripts } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/seo", async (_req: Request, res: Response) => {
  try {
    const settings = await db.select().from(seoSettings);
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch SEO settings" });
  }
});

router.get("/seo/sitemap", async (_req: Request, res: Response) => {
  try {
    const settings = await db.select().from(seoSettings);
    const pages = settings.map(s => ({
      page: s.page,
      title: s.title,
      canonicalUrl: s.canonicalUrl,
      robots: s.robots,
      updatedAt: s.updatedAt,
    }));
    res.json({
      pages,
      totalPages: pages.length,
      sitemapEnabled: true,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch sitemap data" });
  }
});

router.get("/seo/analytics-scripts", async (_req: Request, res: Response) => {
  try {
    const scripts = await db.select().from(analyticsScripts).orderBy(desc(analyticsScripts.createdAt));
    res.json(scripts);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch analytics scripts" });
  }
});

router.put("/seo/:page", async (req: Request, res: Response) => {
  try {
    const { page } = req.params;
    const { title, description, keywords, ogImage, canonicalUrl, robots, structuredData, customHeadTags } = req.body;
    const [existing] = await db.select().from(seoSettings).where(eq(seoSettings.page, page));
    if (existing) {
      await db.update(seoSettings).set({
        title, description, keywords, ogImage, canonicalUrl, robots, structuredData, customHeadTags,
        updatedAt: new Date(),
      }).where(eq(seoSettings.id, existing.id));
    } else {
      await db.insert(seoSettings).values({
        page, title, description, keywords, ogImage, canonicalUrl, robots, structuredData, customHeadTags,
      });
    }
    const [updated] = await db.select().from(seoSettings).where(eq(seoSettings.page, page));
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update SEO settings" });
  }
});

router.get("/analytics-scripts", async (_req: Request, res: Response) => {
  try {
    const scripts = await db.select().from(analyticsScripts).orderBy(desc(analyticsScripts.createdAt));
    res.json(scripts);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch analytics scripts" });
  }
});

router.post("/analytics-scripts", async (req: Request, res: Response) => {
  try {
    const { name, type, script, placement, isActive } = req.body;
    if (!name || !script) return res.status(400).json({ error: "name and script are required" });
    const [created] = await db.insert(analyticsScripts).values({
      name, type: type || "custom", script,
      placement: placement || "head",
      isActive: isActive !== undefined ? isActive : true,
    }).returning();
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create analytics script" });
  }
});

router.patch("/analytics-scripts/:id", async (req: Request, res: Response) => {
  try {
    const [existing] = await db.select().from(analyticsScripts).where(eq(analyticsScripts.id, req.params.id));
    if (!existing) return res.status(404).json({ error: "Script not found" });
    const updates: any = {};
    const fields = ["name", "type", "script", "placement", "isActive"];
    for (const f of fields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }
    await db.update(analyticsScripts).set(updates).where(eq(analyticsScripts.id, req.params.id));
    const [updated] = await db.select().from(analyticsScripts).where(eq(analyticsScripts.id, req.params.id));
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update analytics script" });
  }
});

router.delete("/analytics-scripts/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(analyticsScripts).where(eq(analyticsScripts.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete analytics script" });
  }
});

export default router;
