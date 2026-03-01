'use strict';
/**
 * ============================================================
 * Twilio + Bedrock + Polly Engine - Type Definitions
 * 
 * Isolated engine for Twilio telephony with AWS Bedrock (LLM)
 * and AWS Polly (TTS). Uses text-based conversation with
 * Bedrock and synthesizes speech via Polly, rather than a
 * realtime WebSocket approach.
 * ============================================================
 */

import type WebSocket from 'ws';

/**
 * Supported Amazon Polly neural voice IDs
 */
export type PollyVoiceId =
  | 'Joanna'
  | 'Matthew'
  | 'Lupe'
  | 'Pedro'
  | 'Lea'
  | 'Remi'
  | 'Vicki'
  | 'Daniel'
  | 'Aria'
  | 'Ayanda'
  | 'Ivy'
  | 'Ruth'
  | 'Stephen'
  | 'Gregory'
  | 'Danielle'
  | 'Salli'
  | 'Kimberly'
  | 'Kendra'
  | 'Justin'
  | 'Joey'
  | 'Kevin'
  | 'Bianca'
  | 'Adriano'
  | 'Kajal'
  | 'Zhiyu'
  | 'Hala'
  | 'Zayd'
  | 'Takumi'
  | 'Kazuha'
  | 'Tomoko'
  | 'Seoyeon'
  | 'Jihye'
  | 'Camila'
  | 'Thiago'
  | 'Vitoria'
  | 'Ines'
  | 'Lucia'
  | 'Sergio'
  | 'Mia'
  | 'Andres'
  | 'Amy'
  | 'Arthur'
  | 'Brian'
  | 'Emma'
  | 'Olivia'
  | 'Niamh'
  | 'Gabrielle'
  | 'Liam'
  | 'Isabelle'
  | 'Hannah'
  | 'Hiujin'
  | 'Laura'
  | 'Lisa'
  | 'Ola'
  | 'Suvi'
  | 'Sofie'
  | 'Ida'
  | 'Elin'
  | 'Burcu'
  | 'Arlet'
  | 'Jitka'
  | 'Sabrina'
  | 'Jasmine';

/**
 * Supported AWS Bedrock model aliases (Claude family)
 */
export type BedrockModel = 'claude-3-5-sonnet' | 'claude-3-haiku' | 'claude-3-opus';

/**
 * User tier determining model access
 */
export type ModelTier = 'free' | 'pro';

/**
 * Call status values matching Twilio call lifecycle
 */
export type CallStatus =
  | 'pending'
  | 'queued'
  | 'ringing'
  | 'in-progress'
  | 'completed'
  | 'busy'
  | 'failed'
  | 'no-answer'
  | 'canceled';

/**
 * Direction of the call
 */
export type CallDirection = 'inbound' | 'outbound';

/**
 * Sentiment analysis result for a completed call
 */
export type CallSentiment = 'positive' | 'neutral' | 'negative';

/**
 * Record representing a single Bedrock+Polly call
 */
export interface BedrockPollyCall {
  id: string;

  userId: string | null;
  campaignId: string | null;
  contactId: string | null;
  agentId: string | null;

  twilioPhoneNumberId: string | null;
  awsCredentialId: string | null;

  twilioCallSid: string | null;
  fromNumber: string;
  toNumber: string;

  bedrockSessionId: string | null;
  pollyVoiceId: PollyVoiceId;
  bedrockModel: BedrockModel;

  status: CallStatus;
  callDirection: CallDirection;

  duration: number | null;
  recordingUrl: string | null;
  recordingDuration: number | null;

  transcript: string | null;
  aiSummary: string | null;
  leadQualityScore: number | null;
  sentiment: CallSentiment | null;
  keyPoints: string[] | null;
  nextActions: string[] | null;

  wasTransferred: boolean;
  transferredTo: string | null;
  transferredAt: Date | null;

  startedAt: Date | null;
  answeredAt: Date | null;
  endedAt: Date | null;

  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

/**
 * Tool definition that can be invoked by the agent during a call
 */
export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (params: Record<string, unknown>) => Promise<unknown>;
}

export type TtsProvider = 'aws_polly' | 'elevenlabs';

/**
 * Agent configuration for a Bedrock+Polly call session.
 * No vadSettings or audio format — this engine uses text-based
 * Bedrock conversation, not a realtime WebSocket.
 */
export interface AgentConfig {
  voice: string;
  model: BedrockModel;
  systemPrompt: string;
  firstMessage?: string;
  temperature?: number;
  tools?: AgentTool[];
  knowledgeBaseIds?: string[];
  flowConfig?: CompiledFlowConfig;
  ttsProvider?: TtsProvider;
  elevenLabsVoiceId?: string;
  elevenLabsApiKey?: string;
  agentName?: string;
  language?: string;
}

/**
 * Compiled flow automation config attached to an agent
 */
export interface CompiledFlowConfig {
  nodes: FlowNode[];
  edges: FlowEdge[];
  variables: Record<string, unknown>;
}

/**
 * Single node in a flow graph
 */
export interface FlowNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

/**
 * Edge connecting two flow nodes
 */
export interface FlowEdge {
  source: string;
  target: string;
  condition?: string;
}

/**
 * Summary generated after a call recording is processed
 */
export interface CallRecordingSummary {
  transcript: string;
  summary: string;
  leadQualityScore: number;
  sentiment: CallSentiment;
  keyPoints: string[];
  nextActions: string[];
}

/**
 * Twilio Media Stream WebSocket event structure
 */
export interface TwilioMediaStreamEvent {
  event: 'connected' | 'start' | 'media' | 'stop' | 'mark';
  sequenceNumber?: string;
  streamSid?: string;
  start?: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    mediaFormat: {
      encoding: string;
      sampleRate: number;
      channels: number;
    };
    customParameters?: Record<string, string>;
  };
  media?: {
    track: string;
    chunk: string;
    timestamp: string;
    payload: string;
  };
  stop?: {
    accountSid: string;
    callSid: string;
  };
  mark?: {
    name: string;
  };
}

/**
 * Parameters received from Twilio webhook callbacks
 */
export interface TwilioWebhookParams {
  CallSid: string;
  AccountSid: string;
  From: string;
  To: string;
  CallStatus: string;
  Direction: string;
  ApiVersion?: string;
  ForwardedFrom?: string;
  CallerName?: string;
  ParentCallSid?: string;
  CallDuration?: string;
  RecordingUrl?: string;
  RecordingSid?: string;
  RecordingDuration?: string;
  Digits?: string;
  SpeechResult?: string;
  Confidence?: string;
}

/**
 * A single message in the Bedrock conversation history
 */
export interface BedrockConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

/**
 * Pending audio request queued for playback
 */
export interface PendingAudioRequest {
  audioUrl: string;
  callId: string;
  timestamp: Date;
}

/**
 * Active bridge session between Twilio media stream and
 * Bedrock+Polly services. Adapted from AudioBridgeSession
 * for turn-based text processing rather than realtime streaming.
 */
export interface BedrockPollyBridgeSession {
  callSid: string;
  streamSid: string | null;
  bedrockSessionId: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  startedAt: Date;
  endedAt: Date | null;
  twilioWs: WebSocket | null;
  agentConfig: AgentConfig;
  transcriptParts: { role: 'user' | 'assistant'; text: string; timestamp: Date }[];
  toolHandlers: Map<string, (params: Record<string, unknown>) => Promise<unknown>>;
  processedToolCallIds: Set<string>;
  onTranscriptCallback: ((text: string, isFinal: boolean) => void) | null;
  onToolCallback: ((toolName: string, params: Record<string, unknown>) => Promise<unknown>) | null;
  onAudioCallback: ((audioBase64: string) => void) | null;
  onEndCallback: ((sessionData: { transcript: string; duration: number; bedrockSessionId: string }) => void) | null;
  messages: BedrockConversationMessage[];
  fromNumber?: string;
  toNumber?: string;
  callDirection?: CallDirection;
  pendingAudioQueue: PendingAudioRequest[];
  isProcessing: boolean;
  pollyEngine: 'neural' | 'generative';
  ttsProvider: TtsProvider;
  isOutbound: boolean;
  _mediaLogThrottle?: number;
}

/**
 * Parameters for creating a new Bedrock+Polly bridge session
 */
export interface CreateSessionParams {
  callSid: string;
  agentConfig: AgentConfig;
  twilioWs?: WebSocket;
  streamSid?: string;
  fromNumber?: string;
  toNumber?: string;
  callDirection?: CallDirection;
  awsRegion?: string;
}

/**
 * Available Polly voice definitions with metadata
 */
export const POLLY_VOICES: {
  id: PollyVoiceId;
  name: string;
  description: string;
  gender: 'Female' | 'Male';
  language: string;
  engine: 'neural' | 'generative';
}[] = [
  { id: 'Joanna', name: 'Joanna', description: 'Clear, professional US English female voice', gender: 'Female', language: 'en-US', engine: 'neural' },
  { id: 'Matthew', name: 'Matthew', description: 'Warm, conversational US English male voice', gender: 'Male', language: 'en-US', engine: 'neural' },
  { id: 'Ivy', name: 'Ivy', description: 'Youthful US English female voice', gender: 'Female', language: 'en-US', engine: 'neural' },
  { id: 'Ruth', name: 'Ruth', description: 'Mature, authoritative US English female voice', gender: 'Female', language: 'en-US', engine: 'neural' },
  { id: 'Stephen', name: 'Stephen', description: 'Deep, resonant US English male voice', gender: 'Male', language: 'en-US', engine: 'neural' },
  { id: 'Gregory', name: 'Gregory', description: 'Calm, reassuring US English male voice', gender: 'Male', language: 'en-US', engine: 'neural' },
  { id: 'Danielle', name: 'Danielle', description: 'Modern, energetic US English female voice', gender: 'Female', language: 'en-US', engine: 'neural' },
  { id: 'Salli', name: 'Salli', description: 'Soft, pleasant US English female voice', gender: 'Female', language: 'en-US', engine: 'neural' },
  { id: 'Kimberly', name: 'Kimberly', description: 'Bright, articulate US English female voice', gender: 'Female', language: 'en-US', engine: 'neural' },
  { id: 'Kendra', name: 'Kendra', description: 'Polished, professional US English female voice', gender: 'Female', language: 'en-US', engine: 'neural' },
  { id: 'Justin', name: 'Justin', description: 'Youthful US English male voice', gender: 'Male', language: 'en-US', engine: 'neural' },
  { id: 'Joey', name: 'Joey', description: 'Casual, friendly US English male voice', gender: 'Male', language: 'en-US', engine: 'neural' },
  { id: 'Kevin', name: 'Kevin', description: 'Young, energetic US English male voice', gender: 'Male', language: 'en-US', engine: 'neural' },
  { id: 'Amy', name: 'Amy', description: 'Professional British English female voice', gender: 'Female', language: 'en-GB', engine: 'neural' },
  { id: 'Arthur', name: 'Arthur', description: 'Warm British English male voice', gender: 'Male', language: 'en-GB', engine: 'neural' },
  { id: 'Emma', name: 'Emma', description: 'Natural British English female voice', gender: 'Female', language: 'en-GB', engine: 'neural' },
  { id: 'Aria', name: 'Aria', description: 'Expressive New Zealand English female voice', gender: 'Female', language: 'en-NZ', engine: 'neural' },
  { id: 'Ayanda', name: 'Ayanda', description: 'Vibrant South African English female voice', gender: 'Female', language: 'en-ZA', engine: 'neural' },
  { id: 'Brian', name: 'Brian', description: 'Natural British English male voice', gender: 'Male', language: 'en-GB', engine: 'neural' },
  { id: 'Olivia', name: 'Olivia', description: 'Warm Australian English female voice', gender: 'Female', language: 'en-AU', engine: 'neural' },
  { id: 'Niamh', name: 'Niamh', description: 'Natural Irish English female voice', gender: 'Female', language: 'en-IE', engine: 'neural' },
  { id: 'Lea', name: 'Lea', description: 'Elegant French female voice', gender: 'Female', language: 'fr-FR', engine: 'neural' },
  { id: 'Remi', name: 'Remi', description: 'Smooth French male voice', gender: 'Male', language: 'fr-FR', engine: 'neural' },
  { id: 'Gabrielle', name: 'Gabrielle', description: 'Natural Canadian French female voice', gender: 'Female', language: 'fr-CA', engine: 'neural' },
  { id: 'Liam', name: 'Liam', description: 'Clear Canadian French male voice', gender: 'Male', language: 'fr-CA', engine: 'neural' },
  { id: 'Isabelle', name: 'Isabelle', description: 'Warm Belgian French female voice', gender: 'Female', language: 'fr-BE', engine: 'neural' },
  { id: 'Lupe', name: 'Lupe', description: 'Natural US Spanish female voice', gender: 'Female', language: 'es-US', engine: 'neural' },
  { id: 'Pedro', name: 'Pedro', description: 'Natural US Spanish male voice', gender: 'Male', language: 'es-US', engine: 'neural' },
  { id: 'Lucia', name: 'Lucia', description: 'Professional Castilian Spanish female voice', gender: 'Female', language: 'es-ES', engine: 'neural' },
  { id: 'Sergio', name: 'Sergio', description: 'Confident Castilian Spanish male voice', gender: 'Male', language: 'es-ES', engine: 'neural' },
  { id: 'Mia', name: 'Mia', description: 'Warm Mexican Spanish female voice', gender: 'Female', language: 'es-MX', engine: 'neural' },
  { id: 'Andres', name: 'Andres', description: 'Natural Mexican Spanish male voice', gender: 'Male', language: 'es-MX', engine: 'neural' },
  { id: 'Vicki', name: 'Vicki', description: 'Friendly German female voice', gender: 'Female', language: 'de-DE', engine: 'neural' },
  { id: 'Daniel', name: 'Daniel', description: 'Confident German male voice', gender: 'Male', language: 'de-DE', engine: 'neural' },
  { id: 'Hannah', name: 'Hannah', description: 'Natural Austrian German female voice', gender: 'Female', language: 'de-AT', engine: 'neural' },
  { id: 'Bianca', name: 'Bianca', description: 'Elegant Italian female voice', gender: 'Female', language: 'it-IT', engine: 'neural' },
  { id: 'Adriano', name: 'Adriano', description: 'Smooth Italian male voice', gender: 'Male', language: 'it-IT', engine: 'neural' },
  { id: 'Kajal', name: 'Kajal', description: 'Natural Hindi female voice', gender: 'Female', language: 'hi-IN', engine: 'neural' },
  { id: 'Zhiyu', name: 'Zhiyu', description: 'Professional Mandarin Chinese female voice', gender: 'Female', language: 'cmn-CN', engine: 'neural' },
  { id: 'Hiujin', name: 'Hiujin', description: 'Natural Cantonese Chinese female voice', gender: 'Female', language: 'yue-CN', engine: 'neural' },
  { id: 'Hala', name: 'Hala', description: 'Clear Gulf Arabic female voice', gender: 'Female', language: 'ar-AE', engine: 'neural' },
  { id: 'Zayd', name: 'Zayd', description: 'Natural Gulf Arabic male voice', gender: 'Male', language: 'ar-AE', engine: 'neural' },
  { id: 'Takumi', name: 'Takumi', description: 'Natural Japanese male voice', gender: 'Male', language: 'ja-JP', engine: 'neural' },
  { id: 'Kazuha', name: 'Kazuha', description: 'Warm Japanese female voice', gender: 'Female', language: 'ja-JP', engine: 'neural' },
  { id: 'Tomoko', name: 'Tomoko', description: 'Clear Japanese female voice', gender: 'Female', language: 'ja-JP', engine: 'neural' },
  { id: 'Seoyeon', name: 'Seoyeon', description: 'Clear Korean female voice', gender: 'Female', language: 'ko-KR', engine: 'neural' },
  { id: 'Jihye', name: 'Jihye', description: 'Natural Korean female voice', gender: 'Female', language: 'ko-KR', engine: 'neural' },
  { id: 'Camila', name: 'Camila', description: 'Warm Brazilian Portuguese female voice', gender: 'Female', language: 'pt-BR', engine: 'neural' },
  { id: 'Thiago', name: 'Thiago', description: 'Natural Brazilian Portuguese male voice', gender: 'Male', language: 'pt-BR', engine: 'neural' },
  { id: 'Vitoria', name: 'Vitoria', description: 'Professional Brazilian Portuguese female voice', gender: 'Female', language: 'pt-BR', engine: 'neural' },
  { id: 'Ines', name: 'Ines', description: 'Clear Portuguese female voice', gender: 'Female', language: 'pt-PT', engine: 'neural' },
  { id: 'Laura', name: 'Laura', description: 'Natural Dutch female voice', gender: 'Female', language: 'nl-NL', engine: 'neural' },
  { id: 'Lisa', name: 'Lisa', description: 'Warm Belgian Dutch female voice', gender: 'Female', language: 'nl-BE', engine: 'neural' },
  { id: 'Ola', name: 'Ola', description: 'Friendly Polish female voice', gender: 'Female', language: 'pl-PL', engine: 'neural' },
  { id: 'Suvi', name: 'Suvi', description: 'Clear Finnish female voice', gender: 'Female', language: 'fi-FI', engine: 'neural' },
  { id: 'Ida', name: 'Ida', description: 'Natural Norwegian female voice', gender: 'Female', language: 'nb-NO', engine: 'neural' },
  { id: 'Elin', name: 'Elin', description: 'Bright Swedish female voice', gender: 'Female', language: 'sv-SE', engine: 'neural' },
  { id: 'Sofie', name: 'Sofie', description: 'Natural Danish female voice', gender: 'Female', language: 'da-DK', engine: 'neural' },
  { id: 'Burcu', name: 'Burcu', description: 'Natural Turkish female voice', gender: 'Female', language: 'tr-TR', engine: 'neural' },
  { id: 'Arlet', name: 'Arlet', description: 'Natural Catalan female voice', gender: 'Female', language: 'ca-ES', engine: 'neural' },
  { id: 'Jitka', name: 'Jitka', description: 'Clear Czech female voice', gender: 'Female', language: 'cs-CZ', engine: 'neural' },
  { id: 'Sabrina', name: 'Sabrina', description: 'Natural Swiss German female voice', gender: 'Female', language: 'de-CH', engine: 'neural' },
  { id: 'Jasmine', name: 'Jasmine', description: 'Clear Singapore English female voice', gender: 'Female', language: 'en-SG', engine: 'neural' },
];

/**
 * Model access configuration per subscription tier.
 * Free tier gets claude-3-haiku; pro tier gets all three models.
 */
export const MODEL_TIER_CONFIG: Record<ModelTier, { models: BedrockModel[]; description: string }> = {
  free: {
    models: ['claude-3-haiku'],
    description: 'Claude 3 Haiku - Fast, cost-effective model for production use',
  },
  pro: {
    models: ['claude-3-5-sonnet', 'claude-3-haiku', 'claude-3-opus'],
    description: 'Full Bedrock model access including Claude 3.5 Sonnet and Opus',
  },
};
