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

export interface LargeContextOptions {
  model?: string;
  content: string;
  systemPrompt: string;
  maxOutputTokens?: number;
  temperature?: number;
  chunkSize?: number;
  synthesisPrompt?: string;
}

export interface LargeContextResponse {
  content: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  chunksProcessed: number;
  processingMode: 'single' | 'chunked';
}

export const BEDROCK_MODELS = {
  "claude-sonnet-4-6": "us.anthropic.claude-sonnet-4-6",
  "claude-opus-4-5": "us.anthropic.claude-opus-4-5-20251101-v1:0",
  "claude-opus-4": "us.anthropic.claude-opus-4-20250514-v1:0",
  "claude-sonnet-4": "us.anthropic.claude-sonnet-4-20250514-v1:0",
  "claude-3-7-sonnet": "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
  "claude-3-5-sonnet": "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
  "claude-3-5-sonnet-v2": "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
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

const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  "claude-sonnet-4-6": 200000,
  "claude-opus-4-5": 200000,
  "claude-opus-4": 200000,
  "claude-sonnet-4": 200000,
  "claude-3-7-sonnet": 200000,
  "claude-3-5-sonnet-v2": 200000,
  "claude-3-5-sonnet": 200000,
  "claude-3-5-haiku": 200000,
  "claude-3-haiku": 200000,
  "claude-3-opus": 200000,
};

const CHARS_PER_TOKEN = 4;
const DEFAULT_CHUNK_TOKEN_SIZE = 150000;

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function getModelContextLimit(model: string): number {
  return MODEL_CONTEXT_LIMITS[model] || 200000;
}

export class AWSBedrockService {
  private client: BedrockRuntimeClient | null = null;

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

  listModels(): { id: string; alias: string; provider: string; tier: string; contextWindow: number }[] {
    return [
      { id: BEDROCK_MODELS["claude-sonnet-4-6"], alias: "claude-sonnet-4-6", provider: "Anthropic", tier: "premium", contextWindow: 200000 },
      { id: BEDROCK_MODELS["claude-opus-4-5"], alias: "claude-opus-4-5", provider: "Anthropic", tier: "premium", contextWindow: 200000 },
      { id: BEDROCK_MODELS["claude-opus-4"], alias: "claude-opus-4", provider: "Anthropic", tier: "premium", contextWindow: 200000 },
      { id: BEDROCK_MODELS["claude-sonnet-4"], alias: "claude-sonnet-4", provider: "Anthropic", tier: "premium", contextWindow: 200000 },
      { id: BEDROCK_MODELS["claude-3-7-sonnet"], alias: "claude-3-7-sonnet", provider: "Anthropic", tier: "premium", contextWindow: 200000 },
      { id: BEDROCK_MODELS["claude-3-5-sonnet-v2"], alias: "claude-3-5-sonnet-v2", provider: "Anthropic", tier: "premium", contextWindow: 200000 },
      { id: BEDROCK_MODELS["claude-3-5-sonnet"], alias: "claude-3-5-sonnet", provider: "Anthropic", tier: "premium", contextWindow: 200000 },
      { id: BEDROCK_MODELS["claude-3-5-haiku"], alias: "claude-3-5-haiku", provider: "Anthropic", tier: "standard", contextWindow: 200000 },
      { id: BEDROCK_MODELS["claude-3-haiku"], alias: "claude-3-haiku", provider: "Anthropic", tier: "standard", contextWindow: 200000 },
      { id: BEDROCK_MODELS["titan-text-express"], alias: "titan-text-express", provider: "Amazon", tier: "budget", contextWindow: 8000 },
      { id: BEDROCK_MODELS["titan-text-lite"], alias: "titan-text-lite", provider: "Amazon", tier: "budget", contextWindow: 4000 },
      { id: BEDROCK_MODELS["llama-3-8b"], alias: "llama-3-8b", provider: "Meta", tier: "budget", contextWindow: 8000 },
      { id: BEDROCK_MODELS["llama-3-70b"], alias: "llama-3-70b", provider: "Meta", tier: "standard", contextWindow: 8000 },
      { id: BEDROCK_MODELS["mistral-7b"], alias: "mistral-7b", provider: "Mistral AI", tier: "budget", contextWindow: 8000 },
      { id: BEDROCK_MODELS["mixtral-8x7b"], alias: "mixtral-8x7b", provider: "Mistral AI", tier: "standard", contextWindow: 32000 },
    ];
  }

  private resolveModelId(modelInput: string): string {
    if (modelInput in BEDROCK_MODELS) {
      return BEDROCK_MODELS[modelInput as BedrockModelAlias];
    }
    return modelInput;
  }

  selectModelForTask(task: 'synthesis' | 'reasoning' | 'quick' | 'rerank'): string {
    switch (task) {
      case 'synthesis':
        return 'claude-opus-4-5';
      case 'reasoning':
        return 'claude-sonnet-4-6';
      case 'rerank':
        return 'claude-sonnet-4-6';
      case 'quick':
      default:
        return 'claude-3-5-haiku';
    }
  }

  async invoke(options: BedrockInvokeOptions): Promise<BedrockResponse> {
    const client = this.getClient();
    const modelId = this.resolveModelId(options.model || "claude-sonnet-4-6");

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

  async invokeWithLargeContext(options: LargeContextOptions): Promise<LargeContextResponse> {
    const model = options.model || 'claude-opus-4';
    const contextLimit = getModelContextLimit(model);
    const contentTokens = estimateTokenCount(options.content);
    const systemTokens = estimateTokenCount(options.systemPrompt);
    const totalInputTokens = contentTokens + systemTokens;

    const safeContextLimit = Math.floor(contextLimit * 0.85);

    console.log(`[Bedrock LargeContext] Content: ~${contentTokens} tokens, System: ~${systemTokens} tokens, Model limit: ${contextLimit}`);

    if (totalInputTokens <= safeContextLimit) {
      console.log(`[Bedrock LargeContext] Single-pass mode (within context limit)`);
      const response = await this.invoke({
        model,
        messages: [{ role: "user", content: options.content }],
        systemPrompt: options.systemPrompt,
        maxTokens: options.maxOutputTokens || 8192,
        temperature: options.temperature ?? 0.3,
      });

      return {
        content: response.content,
        totalInputTokens: response.inputTokens,
        totalOutputTokens: response.outputTokens,
        chunksProcessed: 1,
        processingMode: 'single',
      };
    }

    console.log(`[Bedrock LargeContext] Chunked mode — content exceeds single-pass limit`);
    const chunkTokenSize = options.chunkSize || DEFAULT_CHUNK_TOKEN_SIZE;
    const chunkCharSize = chunkTokenSize * CHARS_PER_TOKEN;
    const chunks = this.splitContentIntoChunks(options.content, chunkCharSize);

    console.log(`[Bedrock LargeContext] Split into ${chunks.length} chunks (~${chunkTokenSize} tokens each)`);

    const chunkResults: string[] = [];
    let totalIn = 0;
    let totalOut = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunkPrompt = `You are processing chunk ${i + 1} of ${chunks.length} from a larger document.

${options.systemPrompt}

IMPORTANT: Extract and analyze ALL relevant information from this chunk. Be thorough and comprehensive. Do not summarize — preserve specific details, numbers, names, and facts.

--- CHUNK ${i + 1} of ${chunks.length} ---
${chunks[i]}
--- END CHUNK ---`;

      const response = await this.invoke({
        model,
        messages: [{ role: "user", content: chunkPrompt }],
        maxTokens: options.maxOutputTokens || 8192,
        temperature: options.temperature ?? 0.3,
      });

      chunkResults.push(response.content);
      totalIn += response.inputTokens;
      totalOut += response.outputTokens;

      console.log(`[Bedrock LargeContext] Chunk ${i + 1}/${chunks.length} processed (${response.inputTokens} in, ${response.outputTokens} out)`);
    }

    const synthesisPrompt = options.synthesisPrompt || `You are synthesizing analysis from ${chunks.length} chunks of a larger document.

Combine ALL the extracted information below into a single, comprehensive, well-organized result. Do NOT lose any details — merge, deduplicate, and structure the information coherently.

${options.systemPrompt}`;

    const combinedResults = chunkResults.map((r, i) => `=== Analysis from Chunk ${i + 1} ===\n${r}`).join('\n\n');

    const combinedTokens = estimateTokenCount(combinedResults + synthesisPrompt);

    if (combinedTokens > safeContextLimit) {
      const summaryChunks = this.splitContentIntoChunks(combinedResults, chunkCharSize);
      const summaries: string[] = [];

      for (let i = 0; i < summaryChunks.length; i++) {
        const response = await this.invoke({
          model,
          messages: [{ role: "user", content: summaryChunks[i] }],
          systemPrompt: `Condense and summarize this analysis while preserving ALL key facts, data points, and insights. Be comprehensive but concise.`,
          maxTokens: options.maxOutputTokens || 8192,
          temperature: 0.2,
        });
        summaries.push(response.content);
        totalIn += response.inputTokens;
        totalOut += response.outputTokens;
      }

      const condensedResults = summaries.join('\n\n');
      const synthesisResponse = await this.invoke({
        model,
        messages: [{ role: "user", content: condensedResults }],
        systemPrompt: synthesisPrompt,
        maxTokens: options.maxOutputTokens || 8192,
        temperature: options.temperature ?? 0.3,
      });

      totalIn += synthesisResponse.inputTokens;
      totalOut += synthesisResponse.outputTokens;

      return {
        content: synthesisResponse.content,
        totalInputTokens: totalIn,
        totalOutputTokens: totalOut,
        chunksProcessed: chunks.length,
        processingMode: 'chunked',
      };
    }

    const synthesisResponse = await this.invoke({
      model,
      messages: [{ role: "user", content: combinedResults }],
      systemPrompt: synthesisPrompt,
      maxTokens: options.maxOutputTokens || 8192,
      temperature: options.temperature ?? 0.3,
    });

    totalIn += synthesisResponse.inputTokens;
    totalOut += synthesisResponse.outputTokens;

    return {
      content: synthesisResponse.content,
      totalInputTokens: totalIn,
      totalOutputTokens: totalOut,
      chunksProcessed: chunks.length,
      processingMode: 'chunked',
    };
  }

  private splitContentIntoChunks(content: string, maxCharsPerChunk: number): string[] {
    const chunks: string[] = [];
    const lines = content.split('\n');
    let currentChunk = '';

    for (const line of lines) {
      if ((currentChunk.length + line.length + 1) > maxCharsPerChunk && currentChunk.length > 0) {
        chunks.push(currentChunk);
        const overlapSize = Math.min(currentChunk.length, Math.floor(maxCharsPerChunk * 0.05));
        currentChunk = currentChunk.slice(-overlapSize) + '\n' + line;
      } else {
        currentChunk += (currentChunk.length > 0 ? '\n' : '') + line;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  private async invokeAnthropicModel(
    client: BedrockRuntimeClient,
    modelId: string,
    options: BedrockInvokeOptions
  ): Promise<BedrockResponse> {
    const payload: Record<string, any> = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: options.maxTokens || 8192,
      messages: options.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      ...(options.systemPrompt && { system: options.systemPrompt }),
      ...(options.stopSequences && { stop_sequences: options.stopSequences }),
    };

    if (options.topP !== undefined) {
      payload.top_p = options.topP;
    } else {
      payload.temperature = options.temperature ?? 0.7;
    }

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
        maxTokenCount: options.maxTokens || 8192,
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
      max_gen_len: options.maxTokens || 8192,
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
      max_tokens: options.maxTokens || 8192,
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
    const modelId = this.resolveModelId(options.model || "claude-sonnet-4-6");

    console.log(`[Bedrock] invokeStream: model=${options.model}, resolved=${modelId}`);

    const payload: Record<string, any> = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: options.maxTokens || 8192,
      messages: options.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      ...(options.systemPrompt && { system: options.systemPrompt }),
      ...(options.stopSequences && { stop_sequences: options.stopSequences }),
    };

    if (options.topP !== undefined) {
      payload.top_p = options.topP;
    } else {
      payload.temperature = options.temperature ?? 0.7;
    }

    const command = new InvokeModelWithResponseStreamCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });

    const STREAM_CONNECT_TIMEOUT_MS = 10000;
    let response: any;
    try {
      response = await Promise.race([
        client.send(command),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Bedrock stream timeout: model "${modelId}" did not respond within ${STREAM_CONNECT_TIMEOUT_MS}ms`)), STREAM_CONNECT_TIMEOUT_MS)
        ),
      ]);
    } catch (err: any) {
      console.error(`[Bedrock] invokeStream failed for model "${modelId}": ${err.message}`);
      throw err;
    }

    if (!response.body) {
      throw new Error("No response body from Bedrock");
    }

    const streamIterator = response.body[Symbol.asyncIterator]();
    const FIRST_TEXT_TIMEOUT_MS = 15000;
    const INTER_CHUNK_TIMEOUT_MS = 30000;
    const TEXT_STALL_TIMEOUT_MS = 20000;
    let gotFirstText = false;
    let lastTextMs = Date.now();
    const startMs = Date.now();
    let nonTextEventCount = 0;

    const timeoutRace = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
      Promise.race([
        promise,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(`${label} for model "${modelId}" (${ms}ms)`)), ms)
        ),
      ]);

    let done = false;
    while (!done) {
      const timeout = gotFirstText ? INTER_CHUNK_TIMEOUT_MS : FIRST_TEXT_TIMEOUT_MS;
      const label = gotFirstText ? 'Bedrock inter-chunk timeout' : 'Bedrock first-text timeout';
      const result = await timeoutRace(streamIterator.next(), timeout, label);

      if (result.done) {
        done = true;
        break;
      }

      const event = result.value;
      if (event.chunk?.bytes) {
        const chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes));
        if (chunk.type === "content_block_delta" && chunk.delta?.text) {
          if (!gotFirstText) {
            gotFirstText = true;
            const textPreview = chunk.delta.text.replace(/\n/g, '\\n').slice(0, 30);
            console.log(`[Bedrock] First text from "${modelId}" in ${Date.now() - startMs}ms: "${textPreview}" (nonTextEvents=${nonTextEventCount})`);
          }
          lastTextMs = Date.now();
          yield chunk.delta.text;
        } else {
          nonTextEventCount++;
          if (gotFirstText && (Date.now() - lastTextMs) > TEXT_STALL_TIMEOUT_MS) {
            console.warn(`[Bedrock] Text stall detected for "${modelId}": ${Date.now() - lastTextMs}ms since last text, ${nonTextEventCount} non-text events`);
            break;
          }
        }
      }
    }

    if (!gotFirstText) {
      throw new Error(`Bedrock stream completed with no content from model "${modelId}"`);
    }
  }

  async warmConnection(): Promise<void> {
    const modelsToTest = ['claude-sonnet-4-6'] as const;
    const client = this.getClient();
    let firstWorking: string | null = null;

    for (const alias of modelsToTest) {
      try {
        const modelId = this.resolveModelId(alias);
        const payload = {
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 1,
          temperature: 0,
          messages: [{ role: "user", content: "." }],
        };
        const command = new InvokeModelCommand({
          modelId,
          contentType: "application/json",
          accept: "application/json",
          body: JSON.stringify(payload),
        });
        await Promise.race([
          client.send(command),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), process.env.NODE_ENV === 'production' ? 20000 : 8000)),
        ]);
        console.log(`[Bedrock] ✅ Model "${alias}" (${modelId}) is accessible`);
        if (!firstWorking) firstWorking = alias;
      } catch (err: any) {
        const modelId = this.resolveModelId(alias);
        console.warn(`[Bedrock] ❌ Model "${alias}" (${modelId}) is NOT accessible: ${err.message}`);
      }
    }

    if (firstWorking) {
      console.log(`[Bedrock] Warm connection established with "${firstWorking}"`);
    } else {
      console.error(`[Bedrock] ⚠️ No Bedrock models are accessible! Check AWS credentials and model access.`);
    }
  }

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
