import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";

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
  "claude-3-5-sonnet": "us.anthropic.claude-3-5-haiku-20241022-v1:0",
  "claude-3-5-haiku": "us.anthropic.claude-3-5-haiku-20241022-v1:0",
  "claude-3-haiku": "anthropic.claude-3-haiku-20240307-v1:0",
  "claude-3-opus": "us.anthropic.claude-3-opus-20240229-v1:0",
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

  /**
   * Check if AWS credentials are configured via environment variables
   */
  isConfigured(): boolean {
    return !!(
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY
    );
  }

  private getClient(): BedrockRuntimeClient {
    if (this.client) {
      return this.client;
    }

    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || "us-east-1";

    if (!accessKeyId || !secretAccessKey) {
      throw new Error("AWS credentials not configured. Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION secrets.");
    }

    this.client = new BedrockRuntimeClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    return this.client;
  }

  /**
   * Get a client for a specific region (uses same credentials)
   */
  getClientForRegion(region: string): BedrockRuntimeClient {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
      throw new Error("AWS credentials not configured");
    }

    return new BedrockRuntimeClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  /**
   * List available Bedrock models
   */
  listModels(): { id: string; alias: string; provider: string; tier: string }[] {
    return [
      { id: BEDROCK_MODELS["claude-3-5-sonnet"], alias: "claude-3-5-sonnet", provider: "Anthropic", tier: "premium" },
      { id: BEDROCK_MODELS["claude-3-haiku"], alias: "claude-3-haiku", provider: "Anthropic", tier: "standard" },
      { id: BEDROCK_MODELS["claude-3-opus"], alias: "claude-3-opus", provider: "Anthropic", tier: "premium" },
      { id: BEDROCK_MODELS["titan-text-express"], alias: "titan-text-express", provider: "Amazon", tier: "budget" },
      { id: BEDROCK_MODELS["titan-text-lite"], alias: "titan-text-lite", provider: "Amazon", tier: "budget" },
      { id: BEDROCK_MODELS["llama-3-8b"], alias: "llama-3-8b", provider: "Meta", tier: "budget" },
      { id: BEDROCK_MODELS["llama-3-70b"], alias: "llama-3-70b", provider: "Meta", tier: "standard" },
      { id: BEDROCK_MODELS["mistral-7b"], alias: "mistral-7b", provider: "Mistral AI", tier: "budget" },
      { id: BEDROCK_MODELS["mixtral-8x7b"], alias: "mixtral-8x7b", provider: "Mistral AI", tier: "standard" },
    ];
  }

  private resolveModelId(modelInput: string): string {
    if (modelInput in BEDROCK_MODELS) {
      return BEDROCK_MODELS[modelInput as BedrockModelAlias];
    }
    return modelInput;
  }

  async invoke(options: BedrockInvokeOptions): Promise<BedrockResponse> {
    const client = this.getClient();
    const modelId = this.resolveModelId(options.model || "claude-3-5-sonnet");

    if (modelId.includes("anthropic.")) {
      return this.invokeAnthropicModel(client, modelId, options);
    } else if (modelId.includes("amazon.titan")) {
      return this.invokeTitanModel(client, modelId, options);
    } else if (modelId.includes("meta.llama")) {
      return this.invokeLlamaModel(client, modelId, options);
    } else if (modelId.includes("mistral.")) {
      return this.invokeMistralModel(client, modelId, options);
    } else {
      return this.invokeAnthropicModel(client, modelId, options);
    }
  }

  private async invokeAnthropicModel(
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
      stopReason: responseBody.stop_reason || "stop",
    };
  }

  private async invokeTitanModel(
    client: BedrockRuntimeClient,
    modelId: string,
    options: BedrockInvokeOptions
  ): Promise<BedrockResponse> {
    const inputText = options.messages.map((m) => `${m.role}: ${m.content}`).join("\n");

    const payload = {
      inputText:
        (options.systemPrompt ? `System: ${options.systemPrompt}\n\n` : "") + inputText,
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
      stopReason: responseBody.results?.[0]?.completionReason || "stop",
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
      max_gen_len: options.maxTokens || 4096,
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

  async *invokeStream(options: BedrockInvokeOptions): AsyncGenerator<string> {
    const client = this.getClient();
    const modelId = this.resolveModelId(options.model || "claude-3-5-sonnet");

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
      throw new Error("No response body from Bedrock");
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

  /**
   * Test AWS Bedrock credentials
   */
  async testCredentials(): Promise<{ success: boolean; message: string }> {
    try {
      const client = this.getClient();
      const result = await this.invoke({
        model: "claude-3-haiku",
        messages: [{ role: "user", content: "Say 'Hello'" }],
        maxTokens: 10,
      });
      return { success: true, message: `Bedrock is working. Response: ${result.content}` };
    } catch (error: any) {
      return { success: false, message: error.message || "Failed to connect to Bedrock" };
    }
  }
}

export const awsBedrockService = new AWSBedrockService();
