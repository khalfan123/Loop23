'use strict';

import OpenAI from 'openai';
import { db } from '../../../db';
import { openaiCredentials } from '@shared/schema';

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
  if (isValidKey(process.env.OPENAI_API_KEY)) return process.env.OPENAI_API_KEY;
  if (isValidKey(process.env.AI_INTEGRATIONS_OPENAI_API_KEY)) return process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const now = Date.now();
  if (cachedKey && (now - cachedKeyTs) < KEY_TTL) return cachedKey;
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
  throw new Error('No valid OpenAI API key found for LLM calls');
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

export interface OpenAILLMStreamOptions {
  model: string;
  messages: Array<{ role: string; content: string }>;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface OpenAILLMInvokeResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
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

  console.log(`[OpenAI LLM] invokeStream: model=${model}, messages=${msgs.length}`);

  const stream = await client.chat.completions.create({
    model,
    messages: msgs,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 1024,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta;
    if (delta?.content) {
      if (!gotFirstText) {
        gotFirstText = true;
        const preview = delta.content.replace(/\n/g, '\\n').slice(0, 30);
        console.log(`[OpenAI LLM] First text from "${model}" in ${Date.now() - startMs}ms: "${preview}"`);
      }
      yield delta.content;
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

  console.log(`[OpenAI LLM] invoke: model=${model}, messages=${msgs.length}`);

  const response = await client.chat.completions.create({
    model,
    messages: msgs,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 1024,
  });

  const choice = response.choices?.[0];
  return {
    content: choice?.message?.content || '',
    inputTokens: response.usage?.prompt_tokens || 0,
    outputTokens: response.usage?.completion_tokens || 0,
    stopReason: choice?.finish_reason || 'unknown',
  };
}
