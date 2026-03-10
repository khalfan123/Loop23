import { Router, Request, Response } from "express";
import multer from "multer";
import { bedrockKBService } from "../services/bedrock-knowledge-base.service";
import { storage } from "../storage";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const ACCEPTED_MIME_TYPES = [
  "text/plain",
  "text/html",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/xml",
  "text/xml",
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/mp4",
  "audio/webm",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export function registerBedrockKBRoutes(app: Router, authMiddleware?: any) {
  const router = Router();

  if (authMiddleware) {
    router.use(authMiddleware);
  }

  router.post("/provision", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Authentication required" });

      if (!bedrockKBService.isConfigured()) {
        return res.status(503).json({
          error: "Bedrock Knowledge Base is not configured. Contact your administrator.",
          configured: false,
        });
      }

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      if (user.bedrockKbId && user.bedrockKbStatus === "active") {
        return res.json({
          message: "Knowledge Base already provisioned",
          bedrockKbId: user.bedrockKbId,
          status: "active",
        });
      }

      const result = await bedrockKBService.provisionUserKB(userId, user.name);
      res.json({
        message: "Knowledge Base provisioned successfully",
        ...result,
      });
    } catch (error: any) {
      console.error("[BedrockKB Route] Provision error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  router.get("/status", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Authentication required" });

      const status = await bedrockKBService.getKBStatus(userId);
      res.json({
        ...status,
        configured: bedrockKBService.isConfigured(),
        aiModel: "Claude Sonnet 4.6",
        aiModelId: "us.anthropic.claude-sonnet-4-6",
        fallbackModel: "Claude Opus 4.5",
        fallbackModelId: "us.anthropic.claude-opus-4-5-20251101-v1:0",
        embeddingModel: "Amazon Titan Embed Text v2",
        region: process.env.AWS_REGION || "us-east-1",
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post("/upload", upload.single("file"), async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Authentication required" });

      const file = req.file;
      if (!file) return res.status(400).json({ error: "No file provided" });

      if (!ACCEPTED_MIME_TYPES.includes(file.mimetype) && !file.mimetype.startsWith("image/") && !file.mimetype.startsWith("audio/") && !file.mimetype.startsWith("video/")) {
        return res.status(400).json({ error: `Unsupported file type: ${file.mimetype}` });
      }

      const user = await storage.getUser(userId);
      if (!user?.bedrockKbId || user.bedrockKbStatus !== "active") {
        if (bedrockKBService.isConfigured()) {
          await bedrockKBService.provisionUserKB(userId, user?.name || "User");
        } else {
          return res.status(400).json({ error: "Bedrock KB not provisioned and auto-provision unavailable" });
        }
      }

      const localKbId = req.body.knowledgeBaseId || undefined;

      const result = await bedrockKBService.uploadFile(
        userId,
        file.buffer,
        file.originalname,
        file.mimetype,
        localKbId
      );

      res.json({
        message: "File uploaded successfully",
        ...result,
        fileName: file.originalname,
        fileType: file.mimetype,
        size: file.size,
      });
    } catch (error: any) {
      console.error("[BedrockKB Route] Upload error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  router.get("/files", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Authentication required" });

      const files = await storage.getBedrockKBFiles(userId);
      res.json(files);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.delete("/files/:fileId", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Authentication required" });

      await bedrockKBService.deleteFile(userId, req.params.fileId);
      res.json({ message: "File deleted" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post("/sync", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Authentication required" });

      const result = await bedrockKBService.syncKnowledgeBase(userId);
      res.json({
        message: "Sync started",
        ...result,
      });
    } catch (error: any) {
      console.error("[BedrockKB Route] Sync error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  router.get("/sync-status", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Authentication required" });

      const jobId = req.query.jobId as string;
      if (!jobId) return res.status(400).json({ error: "jobId query parameter required" });

      const status = await bedrockKBService.getSyncStatus(userId, jobId);
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post("/query", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Authentication required" });

      const { query, numberOfResults } = req.body;
      if (!query) return res.status(400).json({ error: "Query is required" });

      const user = await storage.getUser(userId);
      if (!user?.bedrockKbId) {
        return res.status(400).json({ error: "No Bedrock KB provisioned" });
      }

      const results = await bedrockKBService.retrieve(
        user.bedrockKbId,
        query,
        numberOfResults || 5
      );
      res.json({ results, total: results.length });
    } catch (error: any) {
      console.error("[BedrockKB Route] Query error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.use("/api/bedrock-kb", router);
}
