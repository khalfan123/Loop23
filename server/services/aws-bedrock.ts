import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { db } from "../db";
import { awsCredentials } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import type { AwsCredential } from "@shared/schema";

export interface BedrockMessage {
  role: "user" | "assistant";
  content: string;
}

export interface BedrockInvokeOptions {
  model?: string;
  messages: BedrockMessage[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
}

export interface BedrockResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
}

export const BEDROCK_MODELS = {
  "claude-3-5-sonnet": "anthropic.claude-3-5-sonnet-20241022-v2:0",
  "claude-3-haiku": "anthropic.claude-3-haiku-20240307-v1:0",
  "claude-3-opus": "anthropic.claude-3-opus-20240229-v1:0",
  "titan-text-express": "amazon.titan-text-express-v1",
  "titan-text-lite": "amazon.titan-text-lite-v1",
  "llama-3-8b": "meta.llama3-8b-instruct-v1:0",
  "llama-3-70b": "meta.llama3-70b-instruct-v1:0",
  "mistral-7b": "mistral.mistral-7b-instruct-v0:2",
  "mixtral-8x7b": "mistral.mixtral-8x7b-instruct-v0:1",
} as const;

export type BedrockModelAlias = keyof typeof BEDROCK_MODELS;

export class AWSBedrockService {
  private client: BedrockRuntimeClient | null = null;
  private credential: AwsCredential | null = null;

  private async getClient(): Promise<BedrockRuntimeClient> {
    if (this.client && this.credential) {
      return this.client;
    }

    const [credential] = await db
      .select()
      .from(awsCredentials)
      .where(
        and(
          eq(awsCredentials.isActive, true),
          eq(awsCredentials.isPrimary, true)
        )
      )
      .limit(1);

    if (!credential) {
      const [anyCredential] = await db
        .select()
        .from(awsCredentials)
        .where(eq(awsCredentials.isActive, true))
        .limit(1);

      if (!anyCredential) {
        throw new Error("No active AWS credentials found");
      }
      this.credential = anyCredential;
    } else {
      this.credential = credential;
    }

    this.client = new BedrockRuntimeClient({
      region: this.credential.region,
      credentials: {
        accessKeyId: this.credential.accessKeyId,
        secretAccessKey: this.credential.secretAccessKey,
      },
    });

    return this.client;
  }

  async getCredentialById(credentialId: string): Promise<AwsCredential | null> {
    const [credential] = await db
      .select()
      .from(awsCredentials)
      .where(eq(awsCredentials.id, credentialId))
      .limit(1);

    return credential || null;
  }

  async getClientForCredential(
    credentialId: string
  ): Promise<BedrockRuntimeClient> {
    const credential = await this.getCredentialById(credentialId);
    if (!credential) {
      throw new Error(`AWS credential not found: ${credentialId}`);
    }

    return new BedrockRuntimeClient({
      region: credential.region,
      credentials: {
        accessKeyId: credential.accessKeyId,
        secretAccessKey: credential.secretAccessKey,
      },
    });
  }

  private resolveModelId(modelOrAlias: string): string {
    if (modelOrAlias in BEDROCK_MODELS) {
      return BEDROCK_MODELS[modelOrAlias as BedrockModelAlias];
    }
    return modelOrAlias;
  }

  async invoke(
    options: BedrockInvokeOptions,
    credentialId?: string
  ): Promise<BedrockResponse> {
    const client = credentialId
      ? await this.getClientForCredential(credentialId)
      : await this.getClient();

    const modelId = this.resolveModelId(
      options.model || "anthropic.claude-3-5-sonnet-20241022-v2:0"
    );

    if (modelId.startsWith("anthropic.claude")) {
      return this.invokeClaudeModel(client, modelId, options);
    } else if (modelId.startsWith("amazon.titan")) {
      return this.invokeTitanModel(client, modelId, options);
    } else if (modelId.startsWith("meta.llama")) {
      return this.invokeLlamaModel(client, modelId, options);
    } else if (modelId.startsWith("mistral.")) {
      return this.invokeMistralModel(client, modelId, options);
    } else {
      return this.invokeClaudeModel(client, modelId, options);
    }
  }

  private async invokeClaudeModel(
    client: BedrockRuntimeClient,
    modelId: string,
    options: BedrockInvokeOptions
  ): Promise<BedrockResponse> {
    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
      top_p: options.topP ?? 0.9,
      messages: options.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      ...(options.systemPrompt && { system: options.systemPrompt }),
      ...(options.stopSequences && { stop_sequences: options.stopSequences }),
    };

    const command = new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    return {
      content: responseBody.content?.[0]?.text || "",
      inputTokens: responseBody.usage?.input_tokens || 0,
      outputTokens: responseBody.usage?.output_tokens || 0,
      stopReason: responseBody.stop_reason || "end_turn",
    };
  }

  private async invokeTitanModel(
    client: BedrockRuntimeClient,
    modelId: string,
    options: BedrockInvokeOptions
  ): Promise<BedrockResponse> {
    const inputText = options.messages
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const payload = {
      inputText:
        (options.systemPrompt ? `System: ${options.systemPrompt}\n` : "") +
        inputText,
      textGenerationConfig: {
        maxTokenCount: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.7,
        topP: options.topP ?? 0.9,
        stopSequences: options.stopSequences || [],
      },
    };

    const command = new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    return {
      content: responseBody.results?.[0]?.outputText || "",
      inputTokens: responseBody.inputTextTokenCount || 0,
      outputTokens: responseBody.results?.[0]?.tokenCount || 0,
      stopReason: responseBody.results?.[0]?.completionReason || "FINISH",
    };
  }

  private async invokeLlamaModel(
    client: BedrockRuntimeClient,
    modelId: string,
    options: BedrockInvokeOptions
  ): Promise<BedrockResponse> {
    const prompt = this.formatLlamaPrompt(options);

    const payload = {
      prompt,
      max_gen_len: options.maxTokens || 2048,
      temperature: options.temperature ?? 0.7,
      top_p: options.topP ?? 0.9,
    };

    const command = new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    return {
      content: responseBody.generation || "",
      inputTokens: responseBody.prompt_token_count || 0,
      outputTokens: responseBody.generation_token_count || 0,
      stopReason: responseBody.stop_reason || "stop",
    };
  }

  private async invokeMistralModel(
    client: BedrockRuntimeClient,
    modelId: string,
    options: BedrockInvokeOptions
  ): Promise<BedrockResponse> {
    const prompt = options.messages
      .map((m) => `<s>[${m.role.toUpperCase()}] ${m.content}</s>`)
      .join("\n");

    const payload = {
      prompt:
        (options.systemPrompt ? `<s>[SYSTEM] ${options.systemPrompt}</s>\n` : "") +
        prompt,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
      top_p: options.topP ?? 0.9,
      stop: options.stopSequences,
    };

    const command = new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    return {
      content: responseBody.outputs?.[0]?.text || "",
      inputTokens: 0,
      outputTokens: 0,
      stopReason: responseBody.outputs?.[0]?.stop_reason || "stop",
    };
  }

  private formatLlamaPrompt(options: BedrockInvokeOptions): string {
    let prompt = "<|begin_of_text|>";

    if (options.systemPrompt) {
      prompt += `<|start_header_id|>system<|end_header_id|>\n\n${options.systemPrompt}<|eot_id|>`;
    }

    for (const message of options.messages) {
      prompt += `<|start_header_id|>${message.role}<|end_header_id|>\n\n${message.content}<|eot_id|>`;
    }

    prompt += "<|start_header_id|>assistant<|end_header_id|>\n\n";

    return prompt;
  }

  async *invokeStream(
    options: BedrockInvokeOptions,
    credentialId?: string
  ): AsyncGenerator<string> {
    const client = credentialId
      ? await this.getClientForCredential(credentialId)
      : await this.getClient();

    const modelId = this.resolveModelId(
      options.model || "anthropic.claude-3-5-sonnet-20241022-v2:0"
    );

    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
      top_p: options.topP ?? 0.9,
      messages: options.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      ...(options.systemPrompt && { system: options.systemPrompt }),
      ...(options.stopSequences && { stop_sequences: options.stopSequences }),
    };

    const command = new InvokeModelWithResponseStreamCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });

    const response = await client.send(command);

    if (!response.body) {
      throw new Error("No response body from Bedrock stream");
    }

    for await (const event of response.body) {
      if (event.chunk?.bytes) {
        const chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes));
        if (chunk.type === "content_block_delta" && chunk.delta?.text) {
          yield chunk.delta.text;
        }
      }
    }
  }

  async testCredentials(
    accessKeyId: string,
    secretAccessKey: string,
    region: string
  ): Promise<boolean> {
    try {
      const testClient = new BedrockRuntimeClient({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });

      const payload = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 10,
        messages: [{ role: "user", content: "Hi" }],
      };

      const command = new InvokeModelCommand({
        modelId: "anthropic.claude-3-haiku-20240307-v1:0",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(payload),
      });

      await testClient.send(command);
      console.log("✅ AWS Bedrock credentials validated successfully");
      return true;
    } catch (error: any) {
      if (
        error.name === "AccessDeniedException" &&
        error.message?.includes("not authorized")
      ) {
        console.log(
          "⚠️ AWS Bedrock credentials valid but model access may need to be enabled"
        );
        return true;
      }
      console.error("❌ AWS Bedrock credentials validation failed:", error);
      return false;
    }
  }

  getAvailableModels(): Array<{
    id: string;
    alias: string;
    provider: string;
    tier: string;
  }> {
    return [
      {
        id: BEDROCK_MODELS["claude-3-5-sonnet"],
        alias: "claude-3-5-sonnet",
        provider: "Anthropic",
        tier: "pro",
      },
      {
        id: BEDROCK_MODELS["claude-3-haiku"],
        alias: "claude-3-haiku",
        provider: "Anthropic",
        tier: "free",
      },
      {
        id: BEDROCK_MODELS["claude-3-opus"],
        alias: "claude-3-opus",
        provider: "Anthropic",
        tier: "pro",
      },
      {
        id: BEDROCK_MODELS["titan-text-express"],
        alias: "titan-text-express",
        provider: "Amazon",
        tier: "free",
      },
      {
        id: BEDROCK_MODELS["titan-text-lite"],
        alias: "titan-text-lite",
        provider: "Amazon",
        tier: "free",
      },
      {
        id: BEDROCK_MODELS["llama-3-8b"],
        alias: "llama-3-8b",
        provider: "Meta",
        tier: "free",
      },
      {
        id: BEDROCK_MODELS["llama-3-70b"],
        alias: "llama-3-70b",
        provider: "Meta",
        tier: "pro",
      },
      {
        id: BEDROCK_MODELS["mistral-7b"],
        alias: "mistral-7b",
        provider: "Mistral",
        tier: "free",
      },
      {
        id: BEDROCK_MODELS["mixtral-8x7b"],
        alias: "mixtral-8x7b",
        provider: "Mistral",
        tier: "pro",
      },
    ];
  }
}

export const awsBedrockService = new AWSBedrockService();
