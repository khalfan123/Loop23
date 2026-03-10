import {
  BedrockAgentClient,
  CreateKnowledgeBaseCommand,
  CreateDataSourceCommand,
  StartIngestionJobCommand,
  GetIngestionJobCommand,
  DeleteKnowledgeBaseCommand,
  DeleteDataSourceCommand,
} from "@aws-sdk/client-bedrock-agent";
import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
} from "@aws-sdk/client-bedrock-agent-runtime";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { storage } from "../storage";

export interface BedrockKBRetrievalResult {
  text: string;
  score: number;
  sourceUri?: string;
  metadata?: Record<string, any>;
}

class BedrockKnowledgeBaseService {
  private agentClient: BedrockAgentClient | null = null;
  private runtimeClient: BedrockAgentRuntimeClient | null = null;
  private s3Client: S3Client | null = null;

  private get s3Bucket(): string {
    return process.env.BEDROCK_KB_S3_BUCKET || "";
  }

  private get roleArn(): string {
    return process.env.BEDROCK_KB_ROLE_ARN || "";
  }

  private get region(): string {
    return process.env.AWS_REGION || "us-east-1";
  }

  isConfigured(): boolean {
    return !!(
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      this.s3Bucket &&
      this.roleArn &&
      process.env.BEDROCK_KB_OPENSEARCH_ARN
    );
  }

  private getAgentClient(): BedrockAgentClient {
    if (!this.agentClient) {
      this.agentClient = new BedrockAgentClient({
        region: this.region,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });
    }
    return this.agentClient;
  }

  private getRuntimeClient(): BedrockAgentRuntimeClient {
    if (!this.runtimeClient) {
      this.runtimeClient = new BedrockAgentRuntimeClient({
        region: this.region,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });
    }
    return this.runtimeClient;
  }

  private getS3Client(): S3Client {
    if (!this.s3Client) {
      this.s3Client = new S3Client({
        region: this.region,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });
    }
    return this.s3Client;
  }

  async provisionUserKB(userId: string, userName: string): Promise<{
    bedrockKbId: string;
    dataSourceId: string;
    s3Prefix: string;
  }> {
    const user = await storage.getUser(userId);
    if (!user) throw new Error("User not found");

    if (user.bedrockKbId && user.bedrockKbStatus === "active") {
      return {
        bedrockKbId: user.bedrockKbId,
        dataSourceId: user.bedrockDataSourceId || "",
        s3Prefix: user.bedrockS3Prefix || "",
      };
    }

    if (!this.isConfigured()) {
      throw new Error("Bedrock KB not configured. Required: BEDROCK_KB_S3_BUCKET, BEDROCK_KB_ROLE_ARN, AWS credentials.");
    }

    const s3Prefix = `kb-data/users/${userId}/`;

    await storage.updateUser(userId, {
      bedrockKbStatus: "creating",
      bedrockS3Prefix: s3Prefix,
    } as any);

    try {
      const client = this.getAgentClient();

      const kbResponse = await client.send(
        new CreateKnowledgeBaseCommand({
          name: `kb-${userName.replace(/[^a-zA-Z0-9-_]/g, "-").substring(0, 40)}-${userId.substring(0, 8)}`,
          description: `Knowledge Base for user ${userName}`,
          roleArn: this.roleArn,
          knowledgeBaseConfiguration: {
            type: "VECTOR",
            vectorKnowledgeBaseConfiguration: {
              embeddingModelArn: `arn:aws:bedrock:${this.region}::foundation-model/amazon.titan-embed-text-v2:0`,
            },
          },
          storageConfiguration: {
            type: "OPENSEARCH_SERVERLESS",
            opensearchServerlessConfiguration: {
              collectionArn: process.env.BEDROCK_KB_OPENSEARCH_ARN || "",
              vectorIndexName: `kb-${userId.substring(0, 8)}`,
              fieldMapping: {
                vectorField: "vector",
                textField: "text",
                metadataField: "metadata",
              },
            },
          },
        })
      );

      const bedrockKbId = kbResponse.knowledgeBase?.knowledgeBaseId;
      if (!bedrockKbId) throw new Error("Failed to create Knowledge Base — no ID returned");

      const dsResponse = await client.send(
        new CreateDataSourceCommand({
          knowledgeBaseId: bedrockKbId,
          name: `s3-source-${userId.substring(0, 8)}`,
          dataSourceConfiguration: {
            type: "S3",
            s3Configuration: {
              bucketArn: `arn:aws:s3:::${this.s3Bucket}`,
              inclusionPrefixes: [s3Prefix],
            },
          },
        })
      );

      const dataSourceId = dsResponse.dataSource?.dataSourceId || "";

      await storage.updateUser(userId, {
        bedrockKbId,
        bedrockKbStatus: "active",
        bedrockS3Prefix: s3Prefix,
        bedrockDataSourceId: dataSourceId,
      } as any);

      console.log(`[BedrockKB] Provisioned KB "${bedrockKbId}" for user ${userId}`);

      return { bedrockKbId, dataSourceId, s3Prefix };
    } catch (error: any) {
      await storage.updateUser(userId, {
        bedrockKbStatus: "error",
      } as any);
      console.error(`[BedrockKB] Failed to provision KB for user ${userId}:`, error.message);
      throw error;
    }
  }

  async uploadFile(
    userId: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    localKbId?: string
  ): Promise<{ s3Key: string; fileId: string }> {
    const user = await storage.getUser(userId);
    if (!user?.bedrockS3Prefix) {
      throw new Error("User does not have a Bedrock KB provisioned");
    }

    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const s3Key = `${user.bedrockS3Prefix}${Date.now()}-${sanitizedName}`;

    await this.getS3Client().send(
      new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: mimeType,
      })
    );

    const fileType = this.categorizeFileType(mimeType);

    const file = await storage.createBedrockKBFile({
      userId,
      knowledgeBaseId: localKbId || null,
      fileName,
      fileType,
      mimeType,
      s3Key,
      sizeBytes: fileBuffer.length,
      status: "uploaded",
      metadata: { originalName: fileName },
    });

    console.log(`[BedrockKB] Uploaded file "${fileName}" (${fileType}) for user ${userId} -> ${s3Key}`);
    return { s3Key, fileId: file.id };
  }

  async deleteFile(userId: string, fileId: string): Promise<void> {
    const file = await storage.getBedrockKBFile(fileId);
    if (!file || file.userId !== userId) {
      throw new Error("File not found or access denied");
    }

    try {
      await this.getS3Client().send(
        new DeleteObjectCommand({
          Bucket: this.s3Bucket,
          Key: file.s3Key,
        })
      );
    } catch (err: any) {
      console.warn(`[BedrockKB] Failed to delete S3 object ${file.s3Key}:`, err.message);
    }

    await storage.deleteBedrockKBFile(fileId);
  }

  async syncKnowledgeBase(userId: string): Promise<{ ingestionJobId: string }> {
    const user = await storage.getUser(userId);
    if (!user?.bedrockKbId || !user?.bedrockDataSourceId) {
      throw new Error("User does not have a Bedrock KB provisioned");
    }

    const response = await this.getAgentClient().send(
      new StartIngestionJobCommand({
        knowledgeBaseId: user.bedrockKbId,
        dataSourceId: user.bedrockDataSourceId,
      })
    );

    const jobId = response.ingestionJob?.ingestionJobId || "";
    console.log(`[BedrockKB] Started sync job "${jobId}" for user ${userId}`);
    return { ingestionJobId: jobId };
  }

  async getSyncStatus(userId: string, ingestionJobId: string): Promise<{
    status: string;
    failureReasons?: string[];
    statistics?: any;
  }> {
    const user = await storage.getUser(userId);
    if (!user?.bedrockKbId || !user?.bedrockDataSourceId) {
      throw new Error("User does not have a Bedrock KB provisioned");
    }

    const response = await this.getAgentClient().send(
      new GetIngestionJobCommand({
        knowledgeBaseId: user.bedrockKbId,
        dataSourceId: user.bedrockDataSourceId,
        ingestionJobId,
      })
    );

    return {
      status: response.ingestionJob?.status || "UNKNOWN",
      failureReasons: response.ingestionJob?.failureReasons,
      statistics: response.ingestionJob?.statistics,
    };
  }

  async retrieve(
    bedrockKbId: string,
    query: string,
    numberOfResults: number = 5
  ): Promise<BedrockKBRetrievalResult[]> {
    const response = await this.getRuntimeClient().send(
      new RetrieveCommand({
        knowledgeBaseId: bedrockKbId,
        retrievalQuery: { text: query },
        retrievalConfiguration: {
          vectorSearchConfiguration: {
            numberOfResults,
          },
        },
      })
    );

    return (response.retrievalResults || []).map((r) => ({
      text: r.content?.text || "",
      score: r.score || 0,
      sourceUri: r.location?.s3Location?.uri,
      metadata: r.metadata as Record<string, any> | undefined,
    }));
  }

  async getKBStatus(userId: string): Promise<{
    provisioned: boolean;
    bedrockKbId: string | null;
    status: string;
    fileCount: number;
  }> {
    const user = await storage.getUser(userId);
    if (!user) throw new Error("User not found");

    const files = user.bedrockKbId
      ? await storage.getBedrockKBFiles(userId)
      : [];

    return {
      provisioned: !!user.bedrockKbId,
      bedrockKbId: user.bedrockKbId || null,
      status: user.bedrockKbStatus || "none",
      fileCount: files.length,
    };
  }

  async deleteKnowledgeBase(userId: string): Promise<void> {
    const user = await storage.getUser(userId);
    if (!user?.bedrockKbId) return;

    try {
      const client = this.getAgentClient();

      if (user.bedrockDataSourceId) {
        await client.send(
          new DeleteDataSourceCommand({
            knowledgeBaseId: user.bedrockKbId,
            dataSourceId: user.bedrockDataSourceId,
          })
        );
      }

      await client.send(
        new DeleteKnowledgeBaseCommand({
          knowledgeBaseId: user.bedrockKbId,
        })
      );
    } catch (err: any) {
      console.warn(`[BedrockKB] Error deleting AWS KB for user ${userId}:`, err.message);
    }

    await storage.updateUser(userId, {
      bedrockKbId: null,
      bedrockKbStatus: "none",
      bedrockS3Prefix: null,
      bedrockDataSourceId: null,
    } as any);

    console.log(`[BedrockKB] Deleted KB for user ${userId}`);
  }

  private categorizeFileType(mimeType: string): string {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("audio/")) return "audio";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType === "application/pdf") return "pdf";
    if (
      mimeType.includes("word") ||
      mimeType.includes("document") ||
      mimeType.includes("spreadsheet") ||
      mimeType.includes("presentation")
    )
      return "document";
    return "text";
  }
}

export const bedrockKBService = new BedrockKnowledgeBaseService();
