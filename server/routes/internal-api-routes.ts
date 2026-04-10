import { Router, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { users, userSubscriptions, knowledgeBase, phoneNumbers } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import * as path from "path";
import * as fs from "fs";
import { KycService } from "../engines/kyc/services/kyc.service";
import { KycEngineConfig } from "../engines/kyc/config/kyc-config";
import adminRouter from "./admin/index";

const router = Router();

function validateInternalApiKey(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    return res.status(503).json({ error: "Internal API not configured" });
  }

  const provided = req.headers["x-internal-api-key"];
  if (!provided || provided !== secret) {
    return res.status(401).json({ error: "Invalid API key" });
  }

  next();
}

router.use(validateInternalApiKey);

router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

router.get("/users", async (_req: Request, res: Response) => {
  try {
    const allUsers = await storage.getAllUsers();
    const sanitized = allUsers.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      credits: u.credits,
      isActive: u.isActive,
      createdAt: u.createdAt,
    }));
    res.json(sanitized);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.get("/users/:id", async (req: Request, res: Response) => {
  try {
    const user = await storage.getUser(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      credits: user.credits,
      isActive: user.isActive,
      createdAt: user.createdAt,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

router.post("/users/:id/credits", async (req: Request, res: Response) => {
  try {
    const { amount, description } = req.body;
    if (typeof amount !== "number") {
      return res.status(400).json({ error: "Amount must be a number" });
    }

    const user = await storage.getUser(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const newCredits = user.credits + amount;
    await storage.updateUserCredits(user.id, newCredits);

    await storage.createCreditTransaction({
      userId: user.id,
      type: amount > 0 ? "credit" : "debit",
      amount,
      description: description || (amount > 0 ? "Credit added by admin" : "Credit deducted by admin"),
      reference: null,
      stripePaymentId: null,
    });

    res.json({ success: true, newCredits });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update credits" });
  }
});

router.get("/users/:id/limits", async (req: Request, res: Response) => {
  try {
    const user = await storage.getUser(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const limits = await storage.getUserEffectiveLimits(req.params.id);
    const subscription = await storage.getUserSubscription(req.params.id);

    const kbCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(knowledgeBase)
      .where(eq(knowledgeBase.userId, req.params.id));
    const phoneCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(phoneNumbers)
      .where(eq(phoneNumbers.userId, req.params.id));

    res.json({
      userId: req.params.id,
      effectiveLimits: limits,
      overrides: subscription ? {
        overrideMaxWebhooks: subscription.overrideMaxWebhooks,
        overrideMaxKnowledgeBases: subscription.overrideMaxKnowledgeBases,
        overrideMaxFlows: subscription.overrideMaxFlows,
        overrideMaxPhoneNumbers: subscription.overrideMaxPhoneNumbers,
      } : null,
      currentUsage: {
        knowledgeBases: Number(kbCount[0]?.count || 0),
        phoneNumbers: Number(phoneCount[0]?.count || 0),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch limits" });
  }
});

router.patch("/users/:id/limits", async (req: Request, res: Response) => {
  try {
    const user = await storage.getUser(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const coerce = (v: any): number | null | undefined => {
      if (v === undefined) return undefined;
      if (v === null || v === "" || v === "null") return null;
      const n = typeof v === "string" ? parseInt(v, 10) : v;
      if (typeof n !== "number" || isNaN(n) || n < 0 || !Number.isInteger(n)) {
        throw new Error("Must be null or a non-negative integer");
      }
      return n;
    };

    const overrideMaxWebhooks = coerce(req.body.overrideMaxWebhooks);
    const overrideMaxKnowledgeBases = coerce(req.body.overrideMaxKnowledgeBases);
    const overrideMaxFlows = coerce(req.body.overrideMaxFlows);
    const overrideMaxPhoneNumbers = coerce(req.body.overrideMaxPhoneNumbers);

    let subscription = await storage.getUserSubscription(req.params.id);
    if (!subscription) {
      subscription = await storage.createUserSubscription({
        userId: req.params.id,
        planId: "free",
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        overrideMaxWebhooks: overrideMaxWebhooks ?? null,
        overrideMaxKnowledgeBases: overrideMaxKnowledgeBases ?? null,
        overrideMaxFlows: overrideMaxFlows ?? null,
        overrideMaxPhoneNumbers: overrideMaxPhoneNumbers ?? null,
      });
    } else {
      await db.update(userSubscriptions).set({
        overrideMaxWebhooks: overrideMaxWebhooks !== undefined ? overrideMaxWebhooks : subscription.overrideMaxWebhooks,
        overrideMaxKnowledgeBases: overrideMaxKnowledgeBases !== undefined ? overrideMaxKnowledgeBases : subscription.overrideMaxKnowledgeBases,
        overrideMaxFlows: overrideMaxFlows !== undefined ? overrideMaxFlows : subscription.overrideMaxFlows,
        overrideMaxPhoneNumbers: overrideMaxPhoneNumbers !== undefined ? overrideMaxPhoneNumbers : subscription.overrideMaxPhoneNumbers,
      }).where(eq(userSubscriptions.id, subscription.id));
    }

    const newLimits = await storage.getUserEffectiveLimits(req.params.id);
    res.json({ success: true, effectiveLimits: newLimits });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update limits" });
  }
});

router.post("/notifications/broadcast", async (req: Request, res: Response) => {
  try {
    const {
      title,
      message,
      link,
      type = "system",
      icon,
      displayType = "bell",
      priority = 0,
      dismissible = true,
      expiresAt,
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: "Title and message are required" });
    }

    let parsedExpiresAt: Date | null = null;
    if (expiresAt) {
      parsedExpiresAt = new Date(expiresAt);
      if (isNaN(parsedExpiresAt.getTime())) {
        return res.status(400).json({ error: "expiresAt must be a valid date" });
      }
    }

    const allUsers = await storage.getAllUsers();
    const notifications = await Promise.all(
      allUsers.map(u =>
        storage.createNotification({
          userId: u.id,
          type,
          title,
          message,
          link: link || null,
          icon: icon || null,
          displayType,
          priority,
          dismissible,
          expiresAt: parsedExpiresAt,
        })
      )
    );

    res.json({
      success: true,
      recipientCount: notifications.length,
      message: `Broadcast sent to ${notifications.length} users`,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to send broadcast" });
  }
});

router.get("/users/:userId/kyc", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const status = await KycService.getUserKycStatus(userId);
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch user KYC" });
  }
});

router.get("/users/:userId/kyc/documents", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const documents = await KycService.getUserDocuments(userId);
    res.json(documents);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch user KYC documents" });
  }
});

router.post("/users/:userId/kyc/approve", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const status = await KycService.approveKyc(userId);
    res.json(status);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to approve KYC" });
  }
});

router.post("/users/:userId/kyc/reject", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const status = await KycService.rejectKyc(userId, reason);
    res.json(status);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to reject KYC" });
  }
});

router.get("/kyc/documents/:documentId/download", async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const document = await KycService.getDocumentById(documentId);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    const baseDir = path.resolve(process.cwd(), KycEngineConfig.storagePath);
    const filePath = path.resolve(process.cwd(), document.filePath);

    if (!filePath.startsWith(baseDir)) {
      return res.status(400).json({ error: "Invalid document path" });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Document file not found" });
    }

    res.sendFile(filePath);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to download document" });
  }
});

router.post("/kb-mastermind/run", async (req: Request, res: Response) => {
  try {
    const { runKBMastermind } = await import('../services/kb-mastermind');
    const { departmentId } = req.body;
    const stats = await runKBMastermind(departmentId || undefined);
    return res.json({ success: true, stats });
  } catch (error: any) {
    console.error('[KB Mastermind] Internal trigger error:', error.message);
    return res.status(500).json({ error: 'KB Mastermind run failed', message: error.message });
  }
});

router.get("/kb-mastermind/status", async (_req: Request, res: Response) => {
  try {
    const { getKBMastermindStatus } = await import('../services/kb-mastermind');
    const status = getKBMastermindStatus();
    return res.json({ success: true, ...status });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to get status', message: error.message });
  }
});

router.use("/admin", adminRouter);

export default router;
