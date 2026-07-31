/**
 * ============================================================
 * Deprock engine — TTS router composition root
 *
 * Builds the voice-core provider registry/router for this engine
 * and encodes the engine's legacy per-agent provider rules in
 * buildTTSRouteContext, so existing agents keep exactly the
 * historical [preferred, aws_polly] behavior:
 *
 * - cartesia: usable only with agentConfig.cartesiaVoiceId; speed 1.25;
 *   Polly fallback voice is UUID-guarded (agentConfig.voice unless it
 *   looks like a vendor UUID, else the per-language default).
 * - elevenlabs: usable only with agentConfig.elevenLabsVoiceId AND a
 *   resolvable API key (agent key or ELEVENLABS_API_KEY); Polly fallback
 *   uses the raw agentConfig.voice (legacy asymmetry, preserved).
 * - aws_polly: always usable (final fallback).
 * ============================================================
 */

import {
  ProviderRegistry,
  ProviderRouter,
  voiceMetrics,
  ttsCostPer1kChars,
  type SelectionWeights,
  type TTSAttempt,
  type TTSProviderId,
  type TTSRequest,
  type TTSRouteContext,
} from '../../../voice-core';
import { PollyTTSProvider, defaultPollyVoiceForLanguage } from '../../../voice-core/providers/polly-tts.provider';
import { ElevenLabsTTSProvider } from '../../../voice-core/providers/elevenlabs-tts.provider';
import { LocalCloneTTSProvider } from '../../../voice-core/providers/local-clone-tts.provider';
import { humanizeToSSML } from './ssml-humanizer';
import { recordTTSAttemptSpan } from '../../../observability/tracing';
import type { AgentConfig, TtsProvider } from '../types';

let router: ProviderRouter | null = null;
let browserRouter: ProviderRouter | null = null;
let pollyProvider: PollyTTSProvider | null = null;

/**
 * ------------------------------------------------------------
 * Live provider-orchestration policy
 *
 * The voice-core router ships a multi-signal `health_aware` selection
 * strategy (rank usable providers by weighted latency/error/cost) that was
 * previously dormant — every live router was built with the legacy
 * `preferred` strategy and no cost signal, so it always degraded to
 * "preferred, then Polly." This resolver activates that strategy on the
 * live path and sources cost from the same rate table the ops metrics use.
 *
 * Defaults are behavior-preserving for today's agents: `health_aware`
 * only reorders providers a route context actually materializes, and the
 * route context still gates to `[preferred, aws_polly]` unless
 * cross-provider is explicitly enabled. Env overrides:
 *
 *   VOICE_ROUTER_STRATEGY       'health_aware' (default) | 'preferred'
 *   VOICE_ROUTER_CROSS_PROVIDER  1/true/on/yes -> offer any fully-
 *                                credentialed premium provider as a real
 *                                alternate (health/cost may swap the voice
 *                                before falling all the way to Polly).
 *                                Default off (voice-identity preserving).
 *   VOICE_ROUTER_W_LATENCY|_ERROR|_COST  optional selection weights.
 * ------------------------------------------------------------
 */
export interface VoiceRouterConfig {
  strategy: 'preferred' | 'health_aware';
  crossProvider: boolean;
  weights?: Partial<SelectionWeights>;
}

const TRUTHY = /^(1|true|on|yes)$/i;

function parseWeight(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function resolveRouterConfig(env: NodeJS.ProcessEnv = process.env): VoiceRouterConfig {
  const strategy = env.VOICE_ROUTER_STRATEGY === 'preferred' ? 'preferred' : 'health_aware';
  const crossProvider = TRUTHY.test(env.VOICE_ROUTER_CROSS_PROVIDER ?? '');
  const latency = parseWeight(env.VOICE_ROUTER_W_LATENCY);
  const errorRate = parseWeight(env.VOICE_ROUTER_W_ERROR);
  const cost = parseWeight(env.VOICE_ROUTER_W_COST);
  const weights: Partial<SelectionWeights> = {};
  if (latency !== undefined) weights.latency = latency;
  if (errorRate !== undefined) weights.errorRate = errorRate;
  if (cost !== undefined) weights.cost = cost;
  return {
    strategy,
    crossProvider,
    weights: Object.keys(weights).length > 0 ? weights : undefined,
  };
}

export function getDeprockPollyProvider(): PollyTTSProvider {
  if (!pollyProvider) {
    pollyProvider = new PollyTTSProvider({ ssmlify: humanizeToSSML });
  }
  return pollyProvider;
}

// Cartesia was deprecated in production (service removed); agents still
// configured with it are routed to Polly by buildTTSRouteContext.
function buildRouter(pollyInstance: PollyTTSProvider, label: string): ProviderRouter {
  const registry = new ProviderRegistry();
  registry.registerTTS(pollyInstance);
  registry.registerTTS(new ElevenLabsTTSProvider());
  registry.registerTTS(new LocalCloneTTSProvider());
  const config = resolveRouterConfig();
  return new ProviderRouter(registry, {
    // Multi-signal selection runs live: rank usable providers by weighted
    // latency/error/cost, sourcing cost from the shared voice-core rate
    // table so ordering and the ops cost report never diverge.
    selectionStrategy: config.strategy,
    selectionWeights: config.weights,
    costOf: ttsCostPer1kChars,
    onAttempt: (attempt) => {
      voiceMetrics.recordTTSAttempt(attempt);
      recordTTSAttemptSpan(attempt);
      if (!attempt.ok && !attempt.skipped) {
        console.warn(
          `[BedrockPolly ${label}] TTS attempt failed on ${attempt.providerId} (${attempt.latencyMs}ms): ${attempt.error}`
        );
      }
    },
  });
}

export function getDeprockTTSRouter(): ProviderRouter {
  if (!router) {
    router = buildRouter(getDeprockPollyProvider(), 'Bridge');
  }
  return router;
}

/**
 * Separate router for in-browser test calls: its own circuit breakers,
 * health stats, and Polly SSML/neural blocklists, so repeated failing test
 * calls (e.g. a bad ElevenLabs key being tried out) can never trip a breaker
 * or poison a blocklist that live telephony depends on — and vice versa.
 * Attempts still feed the shared voiceMetrics/tracing for visibility.
 */
export function getBrowserTTSRouter(): ProviderRouter {
  if (!browserRouter) {
    browserRouter = buildRouter(new PollyTTSProvider({ ssmlify: humanizeToSSML }), 'BrowserTest');
  }
  return browserRouter;
}

const VENDOR_VOICE_UUID = /^[0-9a-f-]{36}$/i;

/**
 * Materialize the legacy per-agent provider rules as a route context for
 * one synthesis fragment.
 */
export function buildTTSRouteContext(
  agentConfig: AgentConfig,
  ttsProvider: TtsProvider | undefined,
  text: string,
  config: VoiceRouterConfig = resolveRouterConfig()
): TTSRouteContext {
  if (ttsProvider === 'cartesia') {
    // Cartesia is deprecated in production; route these agents to Polly.
    console.warn('[BedrockPolly Bridge] Cartesia TTS is deprecated — using Polly for this agent');
  }
  const preferred: TTSProviderId =
    ttsProvider === 'local_clone' &&
    agentConfig.localCloneVoiceId &&
    !!process.env.LOCAL_CLONE_TTS_BASE_URL?.trim()
      ? 'local_clone'
      : ttsProvider === 'elevenlabs' && agentConfig.elevenLabsVoiceId
        ? 'elevenlabs'
        : 'aws_polly';

  // With cross-provider routing on, any premium provider the agent is FULLY
  // credentialed for is offered as a real candidate, so health/cost scoring
  // can swap to a healthier/cheaper voice before dropping all the way to
  // Polly. Off (default), the chain stays exactly [preferred, aws_polly] so
  // the agent's voice identity never changes short of the Polly safety net.
  const offer = (id: TTSProviderId): boolean =>
    config.crossProvider ? true : preferred === id;

  return {
    preferred,
    finalFallback: 'aws_polly',
    language: agentConfig.language,
    buildRequest: (id: TTSProviderId): TTSRequest | null => {
      // Cartesia is deprecated in production (provider removed); agents still
      // configured with it fall through to Polly regardless of policy.
      if (id === 'cartesia') return null;
      if (id === 'local_clone') {
        if (!offer('local_clone') || !agentConfig.localCloneVoiceId) return null;
        if (!process.env.LOCAL_CLONE_TTS_BASE_URL?.trim()) return null;
        return {
          text,
          voiceId: agentConfig.localCloneVoiceId,
          language: agentConfig.language,
          sampleRateHz: 8000,
          options: {
            apiKey: agentConfig.localCloneApiKey || process.env.LOCAL_CLONE_TTS_API_KEY,
            modelId: agentConfig.localCloneModelId || process.env.LOCAL_CLONE_TTS_MODEL,
            speed: agentConfig.voiceSpeed ?? 1.0,
          },
        };
      }
      if (id === 'elevenlabs') {
        if (!offer('elevenlabs') || !agentConfig.elevenLabsVoiceId) return null;
        const apiKey = agentConfig.elevenLabsApiKey || process.env.ELEVENLABS_API_KEY;
        if (!apiKey) return null;
        return {
          text,
          voiceId: agentConfig.elevenLabsVoiceId,
          language: agentConfig.language,
          sampleRateHz: 8000,
          options: {
            apiKey,
            modelId: agentConfig.elevenLabsModelId || 'eleven_flash_v2_5',
            stability: agentConfig.voiceStability ?? 0.55,
            similarityBoost: agentConfig.voiceSimilarityBoost ?? 0.85,
            speed: agentConfig.voiceSpeed ?? 1.0,
            style: agentConfig.voiceStyle ?? 0,
            useSpeakerBoost: agentConfig.voiceSpeakerBoost ?? true,
            optimizeStreamingLatency: 2,
          },
        };
      }
      // aws_polly — the final fallback must always be synthesizable: when the
      // agent's stored voice is a vendor UUID (ElevenLabs/Cartesia id), swap
      // in the per-language Polly default. (The legacy code only guarded the
      // cartesia path, which let an ElevenLabs outage hand Polly a UUID and
      // fail every tier — fixed here, uniformly.)
      const pollyVoice =
        agentConfig.voice && !agentConfig.voice.match(VENDOR_VOICE_UUID)
          ? agentConfig.voice
          : defaultPollyVoiceForLanguage(agentConfig.language);
      return {
        text,
        voiceId: pollyVoice,
        language: agentConfig.language,
        sampleRateHz: 8000,
      };
    },
  };
}

/**
 * Route context for the in-browser test call, which plays mp3 at 22.05kHz
 * instead of telephony PCM. Legacy rules preserved: ElevenLabs (agent key
 * or env key) when the agent prefers it, otherwise Polly with SSML-neural
 * then plain-neural (never the standard tier); Cartesia is not offered.
 * Use with getBrowserTTSRouter(), which keeps test-call breaker/blocklist
 * state isolated from live telephony.
 */
export function buildBrowserTTSRouteContext(
  agentConfig: AgentConfig,
  voiceId: string,
  text: string
): TTSRouteContext {
  const preferred: TTSProviderId =
    agentConfig.ttsProvider === 'local_clone' &&
    agentConfig.localCloneVoiceId &&
    !!process.env.LOCAL_CLONE_TTS_BASE_URL?.trim()
      ? 'local_clone'
      : agentConfig.ttsProvider === 'elevenlabs' && agentConfig.elevenLabsVoiceId
        ? 'elevenlabs'
        : 'aws_polly';

  return {
    preferred,
    finalFallback: 'aws_polly',
    language: agentConfig.language,
    buildRequest: (id: TTSProviderId): TTSRequest | null => {
      if (id === 'cartesia') return null;
      if (id === 'local_clone') {
        if (!agentConfig.localCloneVoiceId || !process.env.LOCAL_CLONE_TTS_BASE_URL?.trim()) return null;
        return {
          text,
          voiceId: agentConfig.localCloneVoiceId,
          language: agentConfig.language,
          sampleRateHz: 22050,
          format: 'mp3',
          options: {
            apiKey: agentConfig.localCloneApiKey || process.env.LOCAL_CLONE_TTS_API_KEY,
            modelId: agentConfig.localCloneModelId || process.env.LOCAL_CLONE_TTS_MODEL,
            speed: agentConfig.voiceSpeed ?? 1.0,
          },
        };
      }
      if (id === 'elevenlabs') {
        if (!agentConfig.elevenLabsVoiceId) return null;
        const apiKey = agentConfig.elevenLabsApiKey || process.env.ELEVENLABS_API_KEY;
        if (!apiKey) return null;
        return {
          text,
          voiceId: agentConfig.elevenLabsVoiceId,
          language: agentConfig.language,
          sampleRateHz: 22050,
          format: 'mp3',
          options: {
            apiKey,
            // Browser preview prefers quality over latency unless agent overrides.
            modelId: agentConfig.elevenLabsModelId || 'eleven_multilingual_v2',
            stability: agentConfig.voiceStability ?? 0.55,
            similarityBoost: agentConfig.voiceSimilarityBoost ?? 0.85,
            speed: agentConfig.voiceSpeed ?? 1.0,
            style: agentConfig.voiceStyle ?? 0,
            useSpeakerBoost: agentConfig.voiceSpeakerBoost ?? true,
          },
        };
      }
      return {
        text,
        voiceId,
        language: agentConfig.language,
        sampleRateHz: 22050,
        format: 'mp3',
        options: { pollyNeuralOnly: true },
      };
    },
  };
}

/**
 * Outcome of one routed synthesis: which provider actually spoke and whether
 * that differed from the agent's preferred provider. Returned up the call
 * graph (synthesizeAndSend -> streaming loop) so per-turn attribution is
 * correct by construction.
 */
export interface TTSSynthesisOutcome {
  provider: TTSProviderId;
  fellBack: boolean;
}

export function outcomeFromAttempts(
  preferred: TTSProviderId,
  attempts: TTSAttempt[]
): TTSSynthesisOutcome | undefined {
  const success = attempts.find(a => a.ok);
  if (!success) return undefined;
  return { provider: success.providerId, fellBack: success.providerId !== preferred };
}
