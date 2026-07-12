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
  type TTSAttempt,
  type TTSProviderId,
  type TTSRequest,
  type TTSRouteContext,
} from '../../../voice-core';
import { PollyTTSProvider, defaultPollyVoiceForLanguage } from '../../../voice-core/providers/polly-tts.provider';
import { ElevenLabsTTSProvider } from '../../../voice-core/providers/elevenlabs-tts.provider';
import { CartesiaTTSProvider } from '../../../voice-core/providers/cartesia-tts.provider';
import { humanizeToSSML } from './ssml-humanizer';
import { recordTTSAttemptSpan } from '../../../observability/tracing';
import type { AgentConfig, TtsProvider } from '../types';

let router: ProviderRouter | null = null;
let browserRouter: ProviderRouter | null = null;
let pollyProvider: PollyTTSProvider | null = null;

export function getDeprockPollyProvider(): PollyTTSProvider {
  if (!pollyProvider) {
    pollyProvider = new PollyTTSProvider({ ssmlify: humanizeToSSML });
  }
  return pollyProvider;
}

function buildRouter(pollyInstance: PollyTTSProvider, label: string): ProviderRouter {
  const registry = new ProviderRegistry();
  registry.registerTTS(pollyInstance);
  registry.registerTTS(new ElevenLabsTTSProvider());
  registry.registerTTS(new CartesiaTTSProvider());
  return new ProviderRouter(registry, {
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
  text: string
): TTSRouteContext {
  const preferred: TTSProviderId =
    ttsProvider === 'cartesia' && agentConfig.cartesiaVoiceId ? 'cartesia'
    : ttsProvider === 'elevenlabs' && agentConfig.elevenLabsVoiceId ? 'elevenlabs'
    : 'aws_polly';

  return {
    preferred,
    finalFallback: 'aws_polly',
    language: agentConfig.language,
    buildRequest: (id: TTSProviderId): TTSRequest | null => {
      // Legacy fallback contract: the chain is exactly [preferred, aws_polly].
      // A premium provider is never offered as an alternate for an agent that
      // prefers the other one (agents can carry stale voice ids for both).
      if (id === 'cartesia') {
        if (preferred !== 'cartesia' || !agentConfig.cartesiaVoiceId) return null;
        return {
          text,
          voiceId: agentConfig.cartesiaVoiceId,
          language: agentConfig.language,
          sampleRateHz: 8000,
          options: { speed: 1.25 },
        };
      }
      if (id === 'elevenlabs') {
        if (preferred !== 'elevenlabs' || !agentConfig.elevenLabsVoiceId) return null;
        const apiKey = agentConfig.elevenLabsApiKey || process.env.ELEVENLABS_API_KEY;
        if (!apiKey) return null;
        return {
          text,
          voiceId: agentConfig.elevenLabsVoiceId,
          language: agentConfig.language,
          sampleRateHz: 8000,
          options: { apiKey },
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
    agentConfig.ttsProvider === 'elevenlabs' && agentConfig.elevenLabsVoiceId ? 'elevenlabs' : 'aws_polly';

  return {
    preferred,
    finalFallback: 'aws_polly',
    language: agentConfig.language,
    buildRequest: (id: TTSProviderId): TTSRequest | null => {
      if (id === 'cartesia') return null;
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
          options: { apiKey },
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
