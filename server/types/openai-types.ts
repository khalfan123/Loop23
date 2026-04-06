'use strict';

export type OpenAIVoice = 'alloy' | 'echo' | 'shimmer' | 'ash' | 'ballad' | 'coral' | 'sage' | 'verse' | 'cedar' | 'marin';

export type OpenAIRealtimeModel = 
  | 'gpt-realtime' 
  | 'gpt-realtime-mini' 
  | 'gpt-4o-realtime-preview' 
  | 'gpt-4o-mini-realtime-preview';

export type ModelTier = 'free' | 'pro';

export type TelephonyProvider = 'twilio';

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (params: Record<string, unknown>) => Promise<unknown>;
}

export interface CallRecordingSummary {
  transcript: string;
  summary: string;
  leadQualityScore: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  keyPoints: string[];
  nextActions: string[];
}

export interface VADSettings {
  type?: 'server_vad' | 'semantic_vad';
  threshold?: number;
  prefixPaddingMs?: number;
  silenceDurationMs?: number;
  eagerness?: 'low' | 'medium' | 'high' | 'auto';
}

export interface AgentConfig {
  voice: OpenAIVoice;
  model: OpenAIRealtimeModel;
  systemPrompt: string;
  firstMessage?: string;
  temperature?: number;
  tools?: AgentTool[];
  knowledgeBaseIds?: string[];
  flowConfig?: CompiledFlowConfig;
  vadSettings?: VADSettings;
  transferPhoneNumber?: string;
  language?: string;
}

export interface CompiledFlowConfig {
  nodes: FlowNode[];
  edges: FlowEdge[];
  variables: Record<string, unknown>;
}

export interface FlowNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

export interface FlowEdge {
  source: string;
  target: string;
  condition?: string;
}

export const OPENAI_VOICES: { id: OpenAIVoice; name: string; description: string }[] = [
  { id: 'alloy', name: 'Alloy', description: 'Neutral, versatile voice' },
  { id: 'echo', name: 'Echo', description: 'Warm, engaging voice' },
  { id: 'shimmer', name: 'Shimmer', description: 'Expressive, dynamic voice' },
  { id: 'ash', name: 'Ash', description: 'Calm, measured voice' },
  { id: 'ballad', name: 'Ballad', description: 'Warm, melodic voice' },
  { id: 'coral', name: 'Coral', description: 'Clear, friendly voice' },
  { id: 'sage', name: 'Sage', description: 'Thoughtful, wise voice' },
  { id: 'verse', name: 'Verse', description: 'Poetic, expressive voice' },
  { id: 'cedar', name: 'Cedar', description: 'Deep, grounded voice' },
  { id: 'marin', name: 'Marin', description: 'Bright, cheerful voice' },
];

export const MODEL_TIER_CONFIG: Record<ModelTier, { models: OpenAIRealtimeModel[]; description: string }> = {
  free: {
    models: ['gpt-realtime-mini', 'gpt-4o-mini-realtime-preview'],
    description: 'GPT Realtime Mini - Cost-effective, production-ready',
  },
  pro: {
    models: ['gpt-realtime', 'gpt-realtime-mini', 'gpt-4o-realtime-preview', 'gpt-4o-mini-realtime-preview'],
    description: 'Full model access including GPT Realtime (GA)',
  },
};

export interface AudioStreamConfig {
  callUuid: string;
  openaiApiKey: string;
  agentConfig: {
    voice: OpenAIVoice;
    model: OpenAIRealtimeModel;
    systemPrompt: string;
    tools?: AgentTool[];
  };
}

import type WebSocket from 'ws';
export type BridgeWebSocket = WebSocket;
