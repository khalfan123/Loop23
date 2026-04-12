'use strict';

import OpenAI from 'openai';
import { db } from '../../../db';
import { openaiCredentials } from '@shared/schema';
import type { LLMStreamEvent, StructuredToolCall } from '../../../services/agent-orchestration/tool-registry';

let cachedKey: string | null = null;
let cachedKeyTs = 0;
const KEY_TTL = 300_000;

function isValidKey(k: string | undefined): k is string {
  if (!k || k.trim().length === 0) return false;
  const bad = ['_DUMMY_', 'YOUR_KEY', 'placeholder', 'xxx', 'REPLACE', 'changeme', 'test_key'];
  const u = k.toUpperCase();
  return !bad.some(p => u.includes(p.toUpperCase()));
}

async function resolveKey(): Promise<string> {
  const now = Date.now();
  if (cachedKey && (now - cachedKeyTs) < KEY_TTL) return cachedKey;

  try {
    const { resolveOpenAIApiKey } = await import('../../../services/openai-modelfarm');
    const key = await resolveOpenAIApiKey();
    if (isValidKey(key)) {
      cachedKey = key;
      cachedKeyTs = now;
      return key;
    }
  } catch {}

  try {
    const [cred] = await db.select({ apiKey: openaiCredentials.apiKey }).from(openaiCredentials).limit(1);
    if (cred?.apiKey && isValidKey(cred.apiKey)) {
      cachedKey = cred.apiKey;
      cachedKeyTs = now;
      return cred.apiKey;
    }
  } catch (err: any) {
    console.error('[OpenAI LLM] Failed to resolve key from DB:', err.message);
  }
  throw new Error('No valid OpenAI API key found for LLM calls. Configure it in Admin Settings or set the OPENAI_API_KEY environment variable.');
}

let clientInstance: OpenAI | null = null;
let clientKeyHash = '';

async function getClient(): Promise<OpenAI> {
  const key = await resolveKey();
  const hash = key.substring(0, 20);
  if (clientInstance && clientKeyHash === hash) return clientInstance;
  clientInstance = new OpenAI({ apiKey: key });
  clientKeyHash = hash;
  return clientInstance;
}

export interface OpenAIToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface OpenAILLMStreamOptions {
  model: string;
  messages: Array<{ role: string; content: string }>;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: OpenAIToolDef[];
}

export interface OpenAILLMInvokeResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
}

function buildOpenAITools(tools: OpenAIToolDef[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return tools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

function toolCallToMarker(name: string, args: string): string {
  try {
    const parsed = JSON.parse(args);
    return `[TOOL_CALL] ${JSON.stringify({ name, params: parsed })}`;
  } catch {
    return `[TOOL_CALL] ${JSON.stringify({ name, params: {} })}`;
  }
}

export async function* openaiInvokeStream(options: OpenAILLMStreamOptions): AsyncGenerator<string> {
  const client = await getClient();
  const model = options.model;

  const msgs: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  if (options.systemPrompt) {
    msgs.push({ role: 'system', content: options.systemPrompt });
  }
  for (const m of options.messages) {
    msgs.push({ role: m.role as 'user' | 'assistant', content: m.content });
  }

  const startMs = Date.now();
  let gotFirstText = false;

  const hasTools = options.tools && options.tools.length > 0;
  console.log(`[OpenAI LLM] invokeStream: model=${model}, messages=${msgs.length}, tools=${hasTools ? options.tools!.length : 0}`);

  const createParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
    model,
    messages: msgs,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
    stream: true,
  };
  if (hasTools) {
    createParams.tools = buildOpenAITools(options.tools!);
    createParams.tool_choice = 'auto';
  }

  const stream = await client.chat.completions.create(createParams);

  const pendingToolCalls = new Map<number, { name: string; args: string }>();

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta;
    const finishReason = chunk.choices?.[0]?.finish_reason;

    if (delta?.content) {
      if (!gotFirstText) {
        gotFirstText = true;
        const preview = delta.content.replace(/\n/g, '\\n').slice(0, 30);
        console.log(`[OpenAI LLM] First text from "${model}" in ${Date.now() - startMs}ms: "${preview}"`);
      }
      yield delta.content;
    }

    if (delta?.tool_calls) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index;
        if (!pendingToolCalls.has(idx)) {
          pendingToolCalls.set(idx, { name: '', args: '' });
        }
        const entry = pendingToolCalls.get(idx)!;
        if (tc.function?.name) entry.name += tc.function.name;
        if (tc.function?.arguments) entry.args += tc.function.arguments;
      }
    }

    if (finishReason === 'tool_calls' || (finishReason === 'stop' && pendingToolCalls.size > 0)) {
      for (const [, entry] of pendingToolCalls) {
        if (entry.name) {
          const marker = toolCallToMarker(entry.name, entry.args);
          console.log(`[OpenAI LLM] Native tool call detected: ${entry.name}`);
          yield marker;
          gotFirstText = true;
        }
      }
      pendingToolCalls.clear();
    }
  }

  if (pendingToolCalls.size > 0) {
    for (const [, entry] of pendingToolCalls) {
      if (entry.name) {
        const marker = toolCallToMarker(entry.name, entry.args);
        console.log(`[OpenAI LLM] Native tool call (end of stream): ${entry.name}`);
        yield marker;
        gotFirstText = true;
      }
    }
  }

  if (!gotFirstText) {
    throw new Error(`OpenAI stream completed with no content from model "${model}"`);
  }
}

export async function openaiInvoke(options: OpenAILLMStreamOptions): Promise<OpenAILLMInvokeResult> {
  const client = await getClient();
  const model = options.model;

  const msgs: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  if (options.systemPrompt) {
    msgs.push({ role: 'system', content: options.systemPrompt });
  }
  for (const m of options.messages) {
    msgs.push({ role: m.role as 'user' | 'assistant', content: m.content });
  }

  const hasTools = options.tools && options.tools.length > 0;
  console.log(`[OpenAI LLM] invoke: model=${model}, messages=${msgs.length}, tools=${hasTools ? options.tools!.length : 0}`);

  const createParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model,
    messages: msgs,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
  };
  if (hasTools) {
    createParams.tools = buildOpenAITools(options.tools!);
    createParams.tool_choice = 'auto';
  }

  const response = await client.chat.completions.create(createParams);
  const choice = response.choices?.[0];

  let content = choice?.message?.content || '';

  if (choice?.message?.tool_calls && choice.message.tool_calls.length > 0) {
    const toolMarkers = choice.message.tool_calls
      .filter(tc => tc.type === 'function')
      .map(tc => {
        console.log(`[OpenAI LLM] Native tool call (non-stream): ${tc.function.name}`);
        return toolCallToMarker(tc.function.name, tc.function.arguments);
      });
    if (toolMarkers.length > 0) {
      content = content ? content + '\n' + toolMarkers.join('\n') : toolMarkers.join('\n');
    }
  }

  return {
    content,
    inputTokens: response.usage?.prompt_tokens || 0,
    outputTokens: response.usage?.completion_tokens || 0,
    stopReason: choice?.finish_reason || 'unknown',
  };
}

export async function* openaiInvokeStreamStructured(options: OpenAILLMStreamOptions): AsyncGenerator<LLMStreamEvent> {
  const client = await getClient();
  const model = options.model;

  const msgs: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  if (options.systemPrompt) {
    msgs.push({ role: 'system', content: options.systemPrompt });
  }
  for (const m of options.messages) {
    msgs.push({ role: m.role as 'user' | 'assistant', content: m.content });
  }

  const startMs = Date.now();
  let gotFirstText = false;

  const hasTools = options.tools && options.tools.length > 0;
  console.log(`[OpenAI LLM] structuredStream: model=${model}, messages=${msgs.length}, tools=${hasTools ? options.tools!.length : 0}`);

  const createParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
    model,
    messages: msgs,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
    stream: true,
    stream_options: { include_usage: true },
  };
  if (hasTools) {
    createParams.tools = buildOpenAITools(options.tools!);
    createParams.tool_choice = 'auto';
  }

  const stream = await client.chat.completions.create(createParams);

  const pendingToolCalls = new Map<number, { id: string; name: string; args: string }>();
  let inputTokens = 0;
  let outputTokens = 0;
  let stopReason = 'stop';

  for await (const chunk of stream) {
    const choice = chunk.choices?.[0];
    const delta = choice?.delta;
    const finishReason = choice?.finish_reason;

    if (chunk.usage) {
      inputTokens = chunk.usage.prompt_tokens || 0;
      outputTokens = chunk.usage.completion_tokens || 0;
    }

    if (delta?.content) {
      if (!gotFirstText) {
        gotFirstText = true;
        const preview = delta.content.replace(/\n/g, '\\n').slice(0, 30);
        console.log(`[OpenAI LLM] Structured first text from "${model}" in ${Date.now() - startMs}ms: "${preview}"`);
      }
      yield { type: 'text', text: delta.content };
    }

    if (delta?.tool_calls) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index;
        if (!pendingToolCalls.has(idx)) {
          pendingToolCalls.set(idx, { id: tc.id || `tc_${Date.now()}_${idx}`, name: '', args: '' });
        }
        const entry = pendingToolCalls.get(idx)!;
        if (tc.id) entry.id = tc.id;
        if (tc.function?.name) entry.name += tc.function.name;
        if (tc.function?.arguments) entry.args += tc.function.arguments;
      }
    }

    if (finishReason === 'tool_calls' || (finishReason === 'stop' && pendingToolCalls.size > 0)) {
      stopReason = finishReason;
      for (const [, entry] of pendingToolCalls) {
        if (entry.name) {
          let params: Record<string, unknown> = {};
          try {
            params = JSON.parse(entry.args);
          } catch {
            console.warn(`[OpenAI LLM] Failed to parse tool args for "${entry.name}", using empty params. Raw: ${entry.args.slice(0, 200)}`);
          }
          console.log(`[OpenAI LLM] Structured tool call: ${entry.name} (params=${Object.keys(params).length} keys)`);
          yield {
            type: 'tool_call',
            toolCall: { id: entry.id, name: entry.name, params },
          };
        }
      }
      pendingToolCalls.clear();
    }

    if (finishReason && finishReason !== 'tool_calls') {
      stopReason = finishReason;
    }
  }

  if (pendingToolCalls.size > 0) {
    for (const [, entry] of pendingToolCalls) {
      if (entry.name) {
        let params: Record<string, unknown> = {};
        try {
          params = JSON.parse(entry.args);
        } catch {
          console.warn(`[OpenAI LLM] Failed to parse tool args for "${entry.name}" (end), using empty params. Raw: ${entry.args.slice(0, 200)}`);
        }
        console.log(`[OpenAI LLM] Structured tool call (end): ${entry.name} (params=${Object.keys(params).length} keys)`);
        yield {
          type: 'tool_call',
          toolCall: { id: entry.id, name: entry.name, params },
        };
      }
    }
  }

  yield { type: 'done', stopReason, inputTokens, outputTokens };
}
