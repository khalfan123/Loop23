import { Router, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import nodemailer from "nodemailer";

interface AuthRequest extends Request {
  user?: any;
}

const smtpSettingsSchema = z.object({
  smtpHost: z.string().min(1, "SMTP host is required"),
  smtpPort: z.number().int().min(1).max(65535).default(587),
  smtpUsername: z.string().min(1, "SMTP username is required"),
  smtpPassword: z.string().min(1, "SMTP password is required"),
  smtpSecure: z.boolean().default(false),
  fromEmail: z.string().email("Valid email address required"),
  fromName: z.string().optional().nullable(),
});

export function createUserSmtpRoutes(authenticate: any) {
  const router = Router();

  router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const settings = await storage.getUserSmtpSettings(userId);
      if (!settings) {
        return res.json({ configured: false });
      }

      res.json({
        configured: true,
        smtpHost: settings.smtpHost,
        smtpPort: settings.smtpPort,
        smtpUsername: settings.smtpUsername,
        smtpSecure: settings.smtpSecure,
        fromEmail: settings.fromEmail,
        fromName: settings.fromName,
        isVerified: settings.isVerified,
        hasPassword: true,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post("/", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const parsed = smtpSettingsSchema.parse(req.body);
      const settings = await storage.upsertUserSmtpSettings({
        ...parsed,
        userId,
      });

      res.json({
        success: true,
        configured: true,
        smtpHost: settings.smtpHost,
        smtpPort: settings.smtpPort,
        smtpUsername: settings.smtpUsername,
        smtpSecure: settings.smtpSecure,
        fromEmail: settings.fromEmail,
        fromName: settings.fromName,
        isVerified: settings.isVerified,
        hasPassword: true,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  router.post("/test", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const settings = await storage.getUserSmtpSettings(userId);
      if (!settings) {
        return res.json({ success: false, error: "SMTP not configured. Please save your settings first." });
      }

      const transporter = nodemailer.createTransport({
        host: settings.smtpHost,
        port: settings.smtpPort,
        secure: settings.smtpSecure,
        auth: {
          user: settings.smtpUsername,
          pass: settings.smtpPassword,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
      });

      await transporter.verify();

      await transporter.sendMail({
        from: `"${settings.fromName || 'Email Test'}" <${settings.fromEmail}>`,
        to: settings.fromEmail,
        subject: "SMTP Configuration Test",
        text: "This is a test email to verify your SMTP configuration is working correctly.",
        html: "<p>This is a test email to verify your SMTP configuration is working correctly.</p><p>If you received this, your email setup is ready!</p>",
      });

      await storage.updateUserSmtpVerified(userId, true);

      res.json({
        success: true,
        message: `Test email sent to ${settings.fromEmail}. Check your inbox!`,
      });
    } catch (error: any) {
      console.error("[UserSMTP] Test failed:", error.message);
      res.json({
        success: false,
        error: error.code === "EAUTH"
          ? "Authentication failed. Please check your username and password."
          : error.code === "ECONNREFUSED"
          ? "Connection refused. Please check your SMTP host and port."
          : error.code === "ETIMEDOUT"
          ? "Connection timed out. Please check your SMTP host and port."
          : `SMTP error: ${error.message}`,
      });
    }
  });

  router.delete("/", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      await storage.deleteUserSmtpSettings(userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
