import { Router, Request, Response } from "express";
import { db } from "../db";
import { apiKeys } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";
import bcrypt from "bcrypt";

interface AuthRequest extends Request {
  user?: any;
}

const ALLOWED_SCOPES = [
  'calls:read', 'calls:write',
  'campaigns:read', 'campaigns:write',
  'agents:read', 'agents:write',
  'contacts:read', 'contacts:write',
  'credits:read',
  'webhooks:read', 'webhooks:write',
  'analytics:read',
];

function generateApiKey(): string {
  const prefix = "agl_";
  const secret = crypto.randomBytes(32).toString("hex");
  return `${prefix}${secret}`;
}

function validateScopes(scopes: any): string[] | null {
  if (!Array.isArray(scopes)) return null;
  const filtered = scopes.filter((s: any) => typeof s === 'string' && ALLOWED_SCOPES.includes(s));
  return filtered.length > 0 ? filtered : null;
}

export function createUserApiKeysRoutes(authenticate: any) {
  const router = Router();

  router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const keys = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.userId, userId))
        .orderBy(desc(apiKeys.createdAt));

      const sanitized = keys.map((k) => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        scopes: k.scopes,
        ipWhitelist: k.ipWhitelist,
        rateLimit: k.rateLimit,
        rateLimitWindow: k.rateLimitWindow,
        isActive: k.isActive,
        expiresAt: k.expiresAt,
        lastUsedAt: k.lastUsedAt,
        createdAt: k.createdAt,
      }));

      res.json({ success: true, data: sanitized });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch API keys" });
    }
  });

  router.post("/", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { name, scopes, ipWhitelist } = req.body;
      if (!name || typeof name !== 'string') return res.status(400).json({ error: "Name is required" });

      const validatedScopes = validateScopes(scopes) || ["calls:read", "credits:read"];

      const validatedIpWhitelist = Array.isArray(ipWhitelist)
        ? ipWhitelist.filter((ip: any) => typeof ip === 'string' && ip.trim().length > 0)
        : [];

      const rawKey = generateApiKey();
      const keyPrefix = rawKey.substring(0, 12);
      const hashedSecret = await bcrypt.hash(rawKey, 10);

      const [created] = await db
        .insert(apiKeys)
        .values({
          userId,
          name: name.trim(),
          keyPrefix,
          hashedSecret,
          scopes: validatedScopes,
          ipWhitelist: validatedIpWhitelist,
        })
        .returning();

      res.status(201).json({
        success: true,
        data: {
          id: created.id,
          name: created.name,
          keyPrefix: created.keyPrefix,
          scopes: created.scopes,
          key: rawKey,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create API key" });
    }
  });

  router.post("/:id/regenerate", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const ownershipCondition = and(eq(apiKeys.id, req.params.id), eq(apiKeys.userId, userId));

      const [key] = await db
        .select()
        .from(apiKeys)
        .where(ownershipCondition);

      if (!key) return res.status(404).json({ error: "API key not found" });

      const rawKey = generateApiKey();
      const keyPrefix = rawKey.substring(0, 12);
      const hashedSecret = await bcrypt.hash(rawKey, 10);

      await db
        .update(apiKeys)
        .set({ keyPrefix, hashedSecret, updatedAt: new Date() })
        .where(ownershipCondition);

      res.json({
        success: true,
        data: {
          id: key.id,
          name: key.name,
          keyPrefix,
          key: rawKey,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to regenerate API key" });
    }
  });

  router.delete("/:id", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const ownershipCondition = and(eq(apiKeys.id, req.params.id), eq(apiKeys.userId, userId));

      const [key] = await db
        .select()
        .from(apiKeys)
        .where(ownershipCondition);

      if (!key) return res.status(404).json({ error: "API key not found" });

      await db.delete(apiKeys).where(ownershipCondition);

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete API key" });
    }
  });

  return router;
}
