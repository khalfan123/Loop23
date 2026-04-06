import { Router, Request, Response } from "express";
import { db } from "../../db";
import { storage } from "../../storage";
import { globalSettings, elevenLabsCredentials, openaiCredentials, awsCredentials, fonosterCredentials, tcxcCredentials, users } from "@shared/schema";
import { eq, sql, desc } from "drizzle-orm";

const router = Router();

const CREDENTIAL_KEYS: Record<string, { keys: string[]; label: string }> = {
  twilio: {
    label: "Twilio",
    keys: ["twilio_account_sid", "twilio_auth_token", "twilio_phone_number"],
  },
  stripe: {
    label: "Stripe",
    keys: ["stripe_secret_key", "stripe_publishable_key", "stripe_webhook_secret"],
  },
  razorpay: {
    label: "Razorpay",
    keys: ["razorpay_key_id", "razorpay_key_secret", "razorpay_webhook_secret"],
  },
  paypal: {
    label: "PayPal",
    keys: ["paypal_client_id", "paypal_client_secret", "paypal_webhook_id"],
  },
  paystack: {
    label: "Paystack",
    keys: ["paystack_public_key", "paystack_secret_key", "paystack_webhook_secret"],
  },
  mercadopago: {
    label: "MercadoPago",
    keys: ["mercadopago_access_token", "mercadopago_public_key"],
  },
  openai: {
    label: "OpenAI",
    keys: ["openai_api_key"],
  },
  elevenlabs: {
    label: "ElevenLabs",
    keys: ["elevenlabs_api_key", "elevenlabs_webhook_secret", "elevenlabs_hmac_secret"],
  },
  n8n: {
    label: "n8n",
    keys: ["n8n_base_url", "n8n_api_key"],
  },
  smtp: {
    label: "SMTP",
    keys: ["smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_from_email", "smtp_from_name"],
  },
};

const SECRET_KEYS = new Set([
  "twilio_auth_token", "stripe_secret_key", "stripe_webhook_secret",
  "razorpay_key_secret", "razorpay_webhook_secret",
  "paypal_client_secret", "paystack_secret_key", "paystack_webhook_secret",
  "mercadopago_access_token", "openai_api_key",
  "elevenlabs_api_key", "elevenlabs_webhook_secret", "elevenlabs_hmac_secret",
  "n8n_api_key", "smtp_password",
]);

function maskValue(key: string, value: any): string | null {
  if (!value) return null;
  const strVal = String(value);
  if (SECRET_KEYS.has(key)) {
    if (strVal.length <= 8) return "********";
    return strVal.substring(0, 4) + "..." + strVal.substring(strVal.length - 4);
  }
  return strVal;
}

router.get("/credentials/status", async (_req: Request, res: Response) => {
  try {
    const result: Record<string, any> = {};
    for (const [service, config] of Object.entries(CREDENTIAL_KEYS)) {
      const serviceStatus: Record<string, any> = { label: config.label, configured: false, keys: {} };
      let hasAnyKey = false;
      for (const key of config.keys) {
        const setting = await storage.getGlobalSetting(key);
        const dbValue = setting?.value;
        const envKey = key.toUpperCase();
        const envValue = process.env[envKey];
        const value = dbValue || envValue || null;
        if (value) hasAnyKey = true;
        serviceStatus.keys[key] = {
          configured: !!value,
          source: dbValue ? "database" : envValue ? "environment" : "none",
          value: maskValue(key, value),
        };
      }
      serviceStatus.configured = hasAnyKey;
      result[service] = serviceStatus;
    }

    const elCreds = await db.select({ count: sql<number>`count(*)` }).from(elevenLabsCredentials).where(eq(elevenLabsCredentials.isActive, true));
    const oaiCreds = await db.select({ count: sql<number>`count(*)` }).from(openaiCredentials).where(eq(openaiCredentials.isActive, true));
    const awsCreds = await db.select({ count: sql<number>`count(*)` }).from(awsCredentials).where(eq(awsCredentials.isActive, true));
    result._pools = {
      elevenlabs: { activeCredentials: Number(elCreds[0]?.count || 0) },
      openai: { activeCredentials: Number(oaiCreds[0]?.count || 0) },
      aws: { activeCredentials: Number(awsCreds[0]?.count || 0) },
    };

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch credential status" });
  }
});

router.get("/credentials/:service", async (req: Request, res: Response) => {
  try {
    const config = CREDENTIAL_KEYS[req.params.service];
    if (!config) return res.status(404).json({ error: `Unknown service: ${req.params.service}` });
    const result: Record<string, any> = { service: req.params.service, label: config.label, keys: {} };
    for (const key of config.keys) {
      const setting = await storage.getGlobalSetting(key);
      const dbValue = setting?.value;
      const envKey = key.toUpperCase();
      const envValue = process.env[envKey];
      const value = dbValue || envValue || null;
      result.keys[key] = {
        configured: !!value,
        source: dbValue ? "database" : envValue ? "environment" : "none",
        value: maskValue(key, value),
      };
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch credentials" });
  }
});

router.put("/credentials/:service", async (req: Request, res: Response) => {
  try {
    const config = CREDENTIAL_KEYS[req.params.service];
    if (!config) return res.status(404).json({ error: `Unknown service: ${req.params.service}` });
    const updates = req.body;
    const updated: string[] = [];
    for (const [key, value] of Object.entries(updates)) {
      if (config.keys.includes(key)) {
        await storage.updateGlobalSetting(key, value);
        updated.push(key);
      }
    }
    res.json({ success: true, service: req.params.service, updated });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update credentials" });
  }
});

router.delete("/credentials/:service", async (req: Request, res: Response) => {
  try {
    const config = CREDENTIAL_KEYS[req.params.service];
    if (!config) return res.status(404).json({ error: `Unknown service: ${req.params.service}` });
    for (const key of config.keys) {
      await storage.updateGlobalSetting(key, null);
    }
    res.json({ success: true, service: req.params.service, message: `All ${config.label} credentials cleared from database` });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete credentials" });
  }
});

router.post("/credentials/:service/test", async (req: Request, res: Response) => {
  try {
    const service = req.params.service;
    const config = CREDENTIAL_KEYS[service];
    if (!config) return res.status(404).json({ error: `Unknown service: ${service}` });

    const getVal = async (key: string) => {
      const setting = await storage.getGlobalSetting(key);
      return (setting?.value as string) || process.env[key.toUpperCase()] || null;
    };

    switch (service) {
      case "twilio": {
        const sid = await getVal("twilio_account_sid");
        const token = await getVal("twilio_auth_token");
        if (!sid || !token) return res.json({ success: false, error: "Twilio credentials not configured" });
        try {
          const twilio = (await import("twilio")).default;
          const client = twilio(sid, token);
          const account = await client.api.accounts(sid).fetch();
          res.json({ success: true, status: "healthy", accountName: account.friendlyName });
        } catch (e: any) {
          res.json({ success: false, status: "unhealthy", error: e.message });
        }
        break;
      }
      case "openai": {
        const key = await getVal("openai_api_key");
        if (!key) return res.json({ success: false, error: "OpenAI API key not configured" });
        try {
          const response = await fetch("https://api.openai.com/v1/models", {
            headers: { Authorization: `Bearer ${key}` },
          });
          res.json({ success: response.ok, status: response.ok ? "healthy" : "unhealthy" });
        } catch (e: any) {
          res.json({ success: false, status: "unhealthy", error: e.message });
        }
        break;
      }
      case "elevenlabs": {
        const key = await getVal("elevenlabs_api_key");
        if (!key) return res.json({ success: false, error: "ElevenLabs API key not configured" });
        try {
          const response = await fetch("https://api.elevenlabs.io/v1/user", {
            headers: { "xi-api-key": key },
          });
          res.json({ success: response.ok, status: response.ok ? "healthy" : "unhealthy" });
        } catch (e: any) {
          res.json({ success: false, status: "unhealthy", error: e.message });
        }
        break;
      }
      case "stripe": {
        const key = await getVal("stripe_secret_key");
        if (!key) return res.json({ success: false, error: "Stripe credentials not configured" });
        try {
          const response = await fetch("https://api.stripe.com/v1/balance", {
            headers: { Authorization: `Bearer ${key}` },
          });
          res.json({ success: response.ok, status: response.ok ? "healthy" : "unhealthy" });
        } catch (e: any) {
          res.json({ success: false, status: "unhealthy", error: e.message });
        }
        break;
      }
      default:
        res.json({ success: true, message: `No automated test available for ${config.label}. Credentials saved.` });
    }
  } catch (error: any) {
    res.status(500).json({ error: "Failed to test credentials" });
  }
});

router.get("/system/status", async (_req: Request, res: Response) => {
  try {
    const getConfigured = async (key: string) => {
      try {
        const setting = await storage.getGlobalSetting(key);
        return !!(setting?.value) || !!process.env[key.toUpperCase()];
      } catch {
        return !!process.env[key.toUpperCase()];
      }
    };

    let totalUsers = 0;
    let dbHealthy = true;
    const degradedChecks: string[] = [];
    try {
      const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
      totalUsers = Number(userCount?.count || 0);
    } catch (e: any) {
      dbHealthy = false;
      degradedChecks.push("users");
      console.warn('[SystemStatus] User count query failed:', e.message);
    }

    let elPoolKeys = 0, oaiPoolKeys = 0, awsPoolKeys = 0;
    try {
      const [elCount] = await db.select({ count: sql<number>`count(*)` }).from(elevenLabsCredentials).where(eq(elevenLabsCredentials.isActive, true));
      elPoolKeys = Number(elCount?.count || 0);
    } catch (e: any) {
      degradedChecks.push("elevenlabs_pool");
      console.warn('[SystemStatus] ElevenLabs pool query failed:', e.message);
    }
    try {
      const [oaiCount] = await db.select({ count: sql<number>`count(*)` }).from(openaiCredentials).where(eq(openaiCredentials.isActive, true));
      oaiPoolKeys = Number(oaiCount?.count || 0);
    } catch (e: any) {
      degradedChecks.push("openai_pool");
      console.warn('[SystemStatus] OpenAI pool query failed:', e.message);
    }
    try {
      const [awsCount] = await db.select({ count: sql<number>`count(*)` }).from(awsCredentials).where(eq(awsCredentials.isActive, true));
      awsPoolKeys = Number(awsCount?.count || 0);
    } catch (e: any) {
      degradedChecks.push("aws_pool");
      console.warn('[SystemStatus] AWS pool query failed:', e.message);
    }
    const dbStatus = !dbHealthy ? "degraded" : degradedChecks.length > 0 ? "partial" : "connected";

    res.json({
      platform: {
        status: "running",
        uptime: process.uptime(),
        nodeVersion: process.version,
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        },
      },
      database: { status: dbStatus, totalUsers, ...(degradedChecks.length > 0 && { degradedChecks }) },
      services: {
        twilio: { configured: await getConfigured("twilio_account_sid") },
        elevenlabs: { configured: await getConfigured("elevenlabs_api_key"), poolKeys: elPoolKeys },
        openai: { configured: await getConfigured("openai_api_key"), poolKeys: oaiPoolKeys },
        aws: { poolKeys: awsPoolKeys },
        stripe: { configured: await getConfigured("stripe_secret_key") },
        razorpay: { configured: await getConfigured("razorpay_key_id") },
        paystack: { configured: await getConfigured("paystack_secret_key") },
        paypal: { configured: await getConfigured("paypal_client_secret") },
        mercadopago: { configured: await getConfigured("mercadopago_access_token") },
        smtp: { configured: await getConfigured("smtp_host") },
        n8n: { configured: await getConfigured("n8n_base_url") },
      },
    });
  } catch (error: any) {
    console.error('[SystemStatus] Fatal error:', error);
    res.status(500).json({ error: "Failed to fetch system status" });
  }
});

router.get("/fonoster/credentials", async (_req: Request, res: Response) => {
  try {
    const creds = await db.select().from(fonosterCredentials).orderBy(desc(fonosterCredentials.createdAt));
    const sanitized = creds.map(c => ({
      ...c,
      apiKeyEncrypted: "********",
      apiSecretEncrypted: "********",
    }));
    res.json(sanitized);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch Fonoster credentials" });
  }
});

router.get("/tcxc/credentials", async (_req: Request, res: Response) => {
  try {
    const creds = await db.select().from(tcxcCredentials).orderBy(desc(tcxcCredentials.createdAt));
    const sanitized = creds.map(c => ({ ...c, apiKey: c.apiKey ? c.apiKey.substring(0, 4) + "..." : null }));
    res.json(sanitized);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch TCXC credentials" });
  }
});

export default router;
