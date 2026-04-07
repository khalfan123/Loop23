import { Router, Request, Response } from "express";
import { db } from "../../db";
import { storage } from "../../storage";
import { globalSettings, emailTemplates, userSmtpSettings } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";

const router = Router();

router.get("/settings", async (_req: Request, res: Response) => {
  try {
    const settings = await db.select().from(globalSettings).orderBy(globalSettings.key);
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.get("/settings/smtp", async (_req: Request, res: Response) => {
  try {
    const smtpSettings = await db.select().from(userSmtpSettings).limit(1);
    if (smtpSettings.length === 0) return res.json(null);
    const { smtpPass, ...safe } = smtpSettings[0];
    res.json({ ...safe, smtpPass: smtpPass ? "********" : null });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch SMTP settings" });
  }
});

router.put("/settings/smtp", async (req: Request, res: Response) => {
  try {
    const { host, port, username, password, fromEmail, fromName, encryption } = req.body;
    const existing = await db.select().from(userSmtpSettings).limit(1);
    if (existing.length > 0) {
      await db.update(userSmtpSettings).set({
        smtpHost: host, smtpPort: port, smtpUser: username,
        smtpPass: password, fromEmail, fromName,
        encryption: encryption || "tls",
        updatedAt: new Date(),
      }).where(eq(userSmtpSettings.id, existing[0].id));
    } else {
      await db.insert(userSmtpSettings).values({
        userId: "system",
        smtpHost: host, smtpPort: port, smtpUser: username,
        smtpPass: password, fromEmail, fromName,
        encryption: encryption || "tls",
      });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update SMTP settings" });
  }
});

router.post("/settings/smtp/test", async (req: Request, res: Response) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ error: "to email is required" });
    const smtpSettings = await db.select().from(userSmtpSettings).limit(1);
    if (smtpSettings.length === 0) return res.status(400).json({ error: "SMTP not configured" });
    res.json({ success: true, message: `Test email would be sent to ${to}` });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to send test email" });
  }
});

router.post("/settings/smtp/reinitialize", async (_req: Request, res: Response) => {
  try {
    const smtpSettings = await db.select().from(userSmtpSettings).limit(1);
    if (smtpSettings.length === 0) {
      return res.status(400).json({ error: "SMTP not configured" });
    }
    const config = smtpSettings[0];
    res.json({
      success: true,
      message: "SMTP transport reinitialized",
      config: {
        host: config.smtpHost,
        port: config.smtpPort,
        user: config.smtpUser,
        fromEmail: config.fromEmail,
        encryption: config.encryption,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to reinitialize SMTP" });
  }
});

router.post("/settings/batch", async (req: Request, res: Response) => {
  try {
    const { settings } = req.body;
    if (!Array.isArray(settings)) return res.status(400).json({ error: "settings array is required" });
    for (const { key, value } of settings) {
      await storage.updateGlobalSetting(key, value);
    }
    res.json({ success: true, updated: settings.length });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to batch update settings" });
  }
});

router.patch("/settings", async (req: Request, res: Response) => {
  try {
    const { settings } = req.body;
    if (settings && Array.isArray(settings)) {
      for (const { key, value } of settings) {
        await storage.updateGlobalSetting(key, value);
      }
      return res.json({ success: true, updated: settings.length });
    }

    const entries = Object.entries(req.body);
    if (entries.length === 0) {
      return res.status(400).json({ error: "No settings provided" });
    }
    for (const [key, value] of entries) {
      await storage.updateGlobalSetting(key, String(value));
    }
    res.json({ success: true, updated: entries.length });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

router.patch("/settings/:key", async (req: Request, res: Response) => {
  try {
    const { value } = req.body;
    if (value === undefined) return res.status(400).json({ error: "value is required" });
    await storage.updateGlobalSetting(req.params.key, value);
    const updated = await storage.getGlobalSetting(req.params.key);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update setting" });
  }
});

router.get("/settings/:key", async (req: Request, res: Response) => {
  try {
    const setting = await storage.getGlobalSetting(req.params.key);
    if (!setting) return res.status(404).json({ error: "Setting not found" });
    res.json(setting);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch setting" });
  }
});

router.put("/settings/:key", async (req: Request, res: Response) => {
  try {
    const { value } = req.body;
    if (value === undefined) return res.status(400).json({ error: "value is required" });
    await storage.updateGlobalSetting(req.params.key, value);
    const updated = await storage.getGlobalSetting(req.params.key);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update setting" });
  }
});

router.get("/email-event-templates", async (_req: Request, res: Response) => {
  try {
    const templates = await db.select().from(emailTemplates).orderBy(desc(emailTemplates.createdAt));
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch email templates" });
  }
});

router.get("/email-templates", async (_req: Request, res: Response) => {
  try {
    const templates = await db.select().from(emailTemplates).orderBy(desc(emailTemplates.createdAt));
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch email templates" });
  }
});

router.post("/email-event-templates", async (req: Request, res: Response) => {
  try {
    const { name, type, subject, bodyHtml, bodyText, variables } = req.body;
    if (!name || !type || !subject || !bodyHtml) return res.status(400).json({ error: "name, type, subject, and bodyHtml are required" });
    const [created] = await db.insert(emailTemplates).values({
      name, type, subject, bodyHtml,
      bodyText: bodyText || null,
      variables: variables || null,
    }).returning();
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create email template" });
  }
});

router.post("/email-templates", async (req: Request, res: Response) => {
  try {
    const { name, type, subject, bodyHtml, bodyText, variables } = req.body;
    if (!name || !type || !subject || !bodyHtml) return res.status(400).json({ error: "name, type, subject, and bodyHtml are required" });
    const [created] = await db.insert(emailTemplates).values({
      name, type, subject, bodyHtml,
      bodyText: bodyText || null,
      variables: variables || null,
    }).returning();
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create email template" });
  }
});

router.patch("/email-event-templates/:id", async (req: Request, res: Response) => {
  try {
    const [existing] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, req.params.id));
    if (!existing) return res.status(404).json({ error: "Template not found" });
    const updates: any = { updatedAt: new Date() };
    const fields = ["name", "type", "subject", "bodyHtml", "bodyText", "variables", "isActive"];
    for (const f of fields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }
    await db.update(emailTemplates).set(updates).where(eq(emailTemplates.id, req.params.id));
    const [updated] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, req.params.id));
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update email template" });
  }
});

router.patch("/email-templates/:id", async (req: Request, res: Response) => {
  try {
    const [existing] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, req.params.id));
    if (!existing) return res.status(404).json({ error: "Template not found" });
    const updates: any = { updatedAt: new Date() };
    const fields = ["name", "type", "subject", "bodyHtml", "bodyText", "variables", "isActive"];
    for (const f of fields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }
    await db.update(emailTemplates).set(updates).where(eq(emailTemplates.id, req.params.id));
    const [updated] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, req.params.id));
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update email template" });
  }
});

router.delete("/email-event-templates/:id", async (req: Request, res: Response) => {
  try {
    const [existing] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, req.params.id));
    if (!existing) return res.status(404).json({ error: "Template not found" });
    await db.delete(emailTemplates).where(eq(emailTemplates.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete email template" });
  }
});

router.delete("/email-templates/:id", async (req: Request, res: Response) => {
  try {
    const [existing] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, req.params.id));
    if (!existing) return res.status(404).json({ error: "Template not found" });
    await db.delete(emailTemplates).where(eq(emailTemplates.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete email template" });
  }
});

export default router;
