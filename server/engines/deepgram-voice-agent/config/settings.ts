/**
 * ============================================================
 * Deepgram Voice Agent — Settings builder
 *
 * Produces the `Settings` message sent as the first frame on the
 * Deepgram Agent websocket. Telephony bridging uses mulaw/8000 in
 * BOTH directions so Twilio Media Streams audio passes through
 * without transcoding. Listening runs Flux (model-integrated
 * end-of-turn detection); speaking runs Aura-2.
 * ============================================================
 */

export const DEEPGRAM_AGENT_URL = 'wss://agent.deepgram.com/v1/agent/converse';

export const DEEPGRAM_AGENT_DEFAULTS = {
  listenModel: 'flux-general-en',
  speakModel: 'aura-2-thalia-en',
  thinkProvider: 'open_ai',
  thinkModel: 'gpt-4o-mini',
} as const;

export interface AgentSettingsParams {
  systemPrompt: string;
  greeting?: string | null;
  /** Aura-2 voice model, e.g. 'aura-2-odysseus-en'. */
  speakModel?: string | null;
  /** Think provider/model pair, e.g. { provider: 'google', model: 'gemini-3.1-flash-lite' }. */
  think?: { provider: string; model: string } | null;
}

export interface DeepgramAgentSettings {
  type: 'Settings';
  audio: {
    input: { encoding: string; sample_rate: number };
    output: { encoding: string; sample_rate: number; container: string };
  };
  agent: {
    listen: { provider: { type: 'deepgram'; version: 'v2'; model: string } };
    think: { provider: { type: string; model: string }; prompt: string };
    speak: { provider: { type: 'deepgram'; model: string } };
    greeting?: string;
  };
}

export function buildAgentSettings(params: AgentSettingsParams): DeepgramAgentSettings {
  const settings: DeepgramAgentSettings = {
    type: 'Settings',
    audio: {
      // Twilio Media Streams speak G.711 mu-law at 8kHz; matching both
      // directions means the bridge relays raw payloads untouched.
      input: { encoding: 'mulaw', sample_rate: 8000 },
      output: { encoding: 'mulaw', sample_rate: 8000, container: 'none' },
    },
    agent: {
      listen: {
        provider: { type: 'deepgram', version: 'v2', model: DEEPGRAM_AGENT_DEFAULTS.listenModel },
      },
      think: {
        provider: {
          type: params.think?.provider || DEEPGRAM_AGENT_DEFAULTS.thinkProvider,
          model: params.think?.model || DEEPGRAM_AGENT_DEFAULTS.thinkModel,
        },
        prompt: params.systemPrompt,
      },
      speak: {
        provider: { type: 'deepgram', model: params.speakModel || DEEPGRAM_AGENT_DEFAULTS.speakModel },
      },
    },
  };
  if (params.greeting && params.greeting.trim().length > 0) {
    settings.agent.greeting = params.greeting.trim();
  }
  return settings;
}
