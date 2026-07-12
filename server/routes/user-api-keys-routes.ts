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
      // #region agent log
      fetch('http://localhost:7746/ingest/ec574942-2377-44b6-882c-8880d97b9664',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ec03c4'},body:JSON.stringify({sessionId:'ec03c4',runId:'api-key-pre',hypothesisId:'H5',location:'server/routes/user-api-keys-routes.ts:40',message:'List API keys hit',data:{userIdPresent:!!userId},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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

      // #region agent log
      fetch('http://localhost:7746/ingest/ec574942-2377-44b6-882c-8880d97b9664',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ec03c4'},body:JSON.stringify({sessionId:'ec03c4',runId:'api-key-pre',hypothesisId:'H6',location:'server/routes/user-api-keys-routes.ts:62',message:'List API keys success',data:{count:sanitized.length,names:sanitized.slice(0,3).map(k=>k.name),prefixes:sanitized.slice(0,3).map(k=>k.keyPrefix)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      res.json({ success: true, data: sanitized });
    } catch (error: any) {
      // #region agent log
      fetch('http://localhost:7746/ingest/ec574942-2377-44b6-882c-8880d97b9664',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ec03c4'},body:JSON.stringify({sessionId:'ec03c4',runId:'api-key-pre',hypothesisId:'H7',location:'server/routes/user-api-keys-routes.ts:64',message:'List API keys failed',data:{error:String(error?.message||error||'unknown')},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      res.status(500).json({ error: "Failed to fetch API keys" });
    }
  });

  router.post("/", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.userId;
      // #region agent log
      fetch('http://localhost:7746/ingest/ec574942-2377-44b6-882c-8880d97b9664',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ec03c4'},body:JSON.stringify({sessionId:'ec03c4',runId:'api-key-multi-pre',hypothesisId:'K1',location:'server/routes/user-api-keys-routes.ts:79',message:'Create API key hit',data:{userIdPresent:!!userId,nameType:typeof (req.body?.name),nameLen:typeof (req.body?.name)==='string'?(req.body.name as string).length:0,scopesType:Array.isArray(req.body?.scopes)?'array':typeof req.body?.scopes,ipWhitelistType:Array.isArray(req.body?.ipWhitelist)?'array':typeof req.body?.ipWhitelist},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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

      // #region agent log
      fetch('http://localhost:7746/ingest/ec574942-2377-44b6-882c-8880d97b9664',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ec03c4'},body:JSON.stringify({sessionId:'ec03c4',runId:'api-key-multi-pre',hypothesisId:'K2',location:'server/routes/user-api-keys-routes.ts:107',message:'Create API key success',data:{id:created.id,name:created.name,keyPrefix:created.keyPrefix},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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
      // #region agent log
      fetch('http://localhost:7746/ingest/ec574942-2377-44b6-882c-8880d97b9664',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ec03c4'},body:JSON.stringify({sessionId:'ec03c4',runId:'api-key-multi-pre',hypothesisId:'K3',location:'server/routes/user-api-keys-routes.ts:118',message:'Create API key failed',data:{error:String(error?.message||error||'unknown')},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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
