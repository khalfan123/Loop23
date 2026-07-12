import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';
import type { LLMStreamEvent, StructuredToolCall, StructuredToolResult } from './tool-registry';

const BEDROCK_MODELS: Record<string, string> = {
  'claude-sonnet-4-6': 'global.anthropic.claude-sonnet-4-6',
  'claude-opus-4-5': 'us.anthropic.claude-opus-4-5-20251101-v1:0',
  'claude-opus-4': 'us.anthropic.claude-opus-4-20250514-v1:0',
  'claude-sonnet-4': 'us.anthropic.claude-sonnet-4-20250514-v1:0',
  'claude-3-7-sonnet': 'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
  'claude-3-5-sonnet': 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
  'claude-3-5-sonnet-v2': 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
  'claude-3-5-haiku': 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
  'claude-3-haiku': 'anthropic.claude-3-haiku-20240307-v1:0',
  'claude-3-opus': 'us.anthropic.claude-3-opus-20240229-v1:0',
};

function resolveModelId(model: string): string {
  return BEDROCK_MODELS[model] || model;
}

function getClient(): BedrockRuntimeClient {
  return new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

export interface ConverseStreamOptions {
  model: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: Array<{
    toolSpec: {
      name: string;
      description: string;
      inputSchema: { json: Record<string, unknown> };
    };
  }>;
}

export async function* converseStream(options: ConverseStreamOptions): AsyncGenerator<LLMStreamEvent> {
  const client = getClient();
  const modelId = resolveModelId(options.model);

  const messages = options.messages.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: [{ text: m.content }],
  }));

  const commandInput: Record<string, unknown> = {
    modelId,
    messages,
    inferenceConfig: {
      maxTokens: options.maxTokens || 2048,
      temperature: options.temperature ?? 0.7,
    },
  };

  if (options.systemPrompt) {
    commandInput.system = [{ text: options.systemPrompt }];
  }

  if (options.tools && options.tools.length > 0) {
    commandInput.toolConfig = { tools: options.tools };
  }

  const command = new ConverseStreamCommand(commandInput as any);
  const response = await client.send(command);

  let inputTokens = 0;
  let outputTokens = 0;
  let stopReason = 'end_turn';

  let currentToolCallId = '';
  let currentToolCallName = '';
  let currentToolCallInput = '';

  if (response.stream) {
    for await (const event of response.stream) {
      if (event.contentBlockDelta) {
        const delta = event.contentBlockDelta.delta;
        if (delta && 'text' in delta && delta.text) {
          yield { type: 'text', text: delta.text };
        }
        if (delta && 'toolUse' in delta && (delta as any).toolUse?.input) {
          currentToolCallInput += (delta as any).toolUse.input;
        }
      }
      if (event.contentBlockStart) {
        const start = event.contentBlockStart.start;
        if (start && 'toolUse' in start && (start as any).toolUse) {
          const tu = (start as any).toolUse;
          currentToolCallId = tu.toolUseId || '';
          currentToolCallName = tu.name || '';
          currentToolCallInput = '';
        }
      }
      if (event.contentBlockStop) {
        if (currentToolCallName) {
          let params: Record<string, unknown> = {};
          try {
            params = currentToolCallInput ? JSON.parse(currentToolCallInput) : {};
          } catch {}
          yield {
            type: 'tool_call',
            toolCall: {
              id: currentToolCallId,
              name: currentToolCallName,
              params,
            },
          };
          currentToolCallId = '';
          currentToolCallName = '';
          currentToolCallInput = '';
        }
      }
      if (event.metadata) {
        const usage = event.metadata.usage;
        if (usage) {
          inputTokens = usage.inputTokens || 0;
          outputTokens = usage.outputTokens || 0;
        }
      }
      if (event.messageStop) {
        stopReason = (event.messageStop as any).stopReason || 'end_turn';
      }
    }
  }

  yield { type: 'done', stopReason, inputTokens, outputTokens };
}

export interface ConverseWithToolResultsResponse {
  content: string;
  toolCalls: StructuredToolCall[];
  inputTokens: number;
  outputTokens: number;
}

export async function converseWithToolResults(
  options: ConverseStreamOptions,
  assistantContent: Array<{ text?: string; toolUse?: { toolUseId: string; name: string; input: unknown } }>,
  toolResults: StructuredToolResult[]
): Promise<ConverseWithToolResultsResponse> {
  const client = getClient();
  const modelId = resolveModelId(options.model);

  const messages: any[] = options.messages.map(m => ({
    role: m.role,
    content: [{ text: m.content }],
  }));

  const assistantBlocks: any[] = assistantContent.map(block => {
    if (block.text) return { text: block.text };
    if (block.toolUse) return { toolUse: block.toolUse };
    return { text: '' };
  }).filter(b => b.text !== '' || b.toolUse);

  if (assistantBlocks.length > 0) {
    messages.push({ role: 'assistant', content: assistantBlocks });
  }

  const toolResultBlocks = toolResults.map(tr => ({
    toolResult: {
      toolUseId: tr.toolCallId,
      content: [{ json: typeof tr.result === 'object' ? tr.result : { result: tr.result } }],
      status: tr.isError ? 'error' : 'success',
    },
  }));

  messages.push({ role: 'user', content: toolResultBlocks });

  const commandInput: Record<string, unknown> = {
    modelId,
    messages,
    inferenceConfig: {
      maxTokens: options.maxTokens || 2048,
      temperature: options.temperature ?? 0.7,
    },
  };

  if (options.systemPrompt) {
    commandInput.system = [{ text: options.systemPrompt }];
  }

  if (options.tools && options.tools.length > 0) {
    commandInput.toolConfig = { tools: options.tools };
  }

  const command = new ConverseCommand(commandInput as any);
  const response = await client.send(command);

  let content = '';
  const toolCalls: StructuredToolCall[] = [];

  const outputContent = response.output?.message?.content || [];
  for (const block of outputContent) {
    if ('text' in block && block.text) {
      content += block.text;
    }
    if ('toolUse' in block && (block as any).toolUse) {
      const tu = (block as any).toolUse;
      toolCalls.push({
        id: tu.toolUseId,
        name: tu.name,
        params: tu.input || {},
      });
    }
  }

  const usage = response.usage || {};

  return {
    content,
    toolCalls,
    inputTokens: (usage as any).inputTokens || 0,
    outputTokens: (usage as any).outputTokens || 0,
  };
}
