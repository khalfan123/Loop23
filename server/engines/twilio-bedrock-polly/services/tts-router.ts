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
let pollyProvider: PollyTTSProvider | null = null;

export function getDeprockPollyProvider(): PollyTTSProvider {
  if (!pollyProvider) {
    pollyProvider = new PollyTTSProvider({ ssmlify: humanizeToSSML });
  }
  return pollyProvider;
}

export function getDeprockTTSRouter(): ProviderRouter {
  if (!router) {
    const registry = new ProviderRegistry();
    registry.registerTTS(getDeprockPollyProvider());
    registry.registerTTS(new ElevenLabsTTSProvider());
    registry.registerTTS(new CartesiaTTSProvider());
    router = new ProviderRouter(registry, {
      onAttempt: (attempt) => {
        voiceMetrics.recordTTSAttempt(attempt);
        recordTTSAttemptSpan(attempt);
        if (!attempt.ok && !attempt.skipped) {
          console.warn(
            `[BedrockPolly Bridge] TTS attempt failed on ${attempt.providerId} (${attempt.latencyMs}ms): ${attempt.error}`
          );
        }
      },
    });
  }
  return router;
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
      if (id === 'cartesia') {
        if (!agentConfig.cartesiaVoiceId) return null;
        return {
          text,
          voiceId: agentConfig.cartesiaVoiceId,
          language: agentConfig.language,
          sampleRateHz: 8000,
          options: { speed: 1.25 },
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
          sampleRateHz: 8000,
          options: { apiKey },
        };
      }
      // aws_polly — preserve the legacy fallback-voice asymmetry:
      // only the Cartesia path UUID-guards agentConfig.voice.
      const pollyVoice =
        preferred === 'cartesia'
          ? (agentConfig.voice && !agentConfig.voice.match(VENDOR_VOICE_UUID)
              ? agentConfig.voice
              : defaultPollyVoiceForLanguage(agentConfig.language))
          : agentConfig.voice;
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
 * Shares the same router singleton, so browser test calls exercise the
 * same breakers and feed the same health stats as production calls.
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
 * Per-call record of the most recent turn's TTS routing outcome, consumed
 * by the per-turn metrics recorder. Bounded to avoid leaking entries for
 * calls that never reach a [LATENCY] log (e.g. dropped mid-stream).
 */
const lastTTSOutcome: Map<string, { provider: TTSProviderId; fellBack: boolean }> = new Map();
const MAX_OUTCOME_ENTRIES = 1000;

export function noteTTSAttempts(callSid: string, preferred: TTSProviderId, attempts: TTSAttempt[]): void {
  const success = attempts.find(a => a.ok);
  if (!success) return;
  const previous = lastTTSOutcome.get(callSid);
  const fellBack = success.providerId !== preferred || previous?.fellBack === true;
  if (!previous && lastTTSOutcome.size >= MAX_OUTCOME_ENTRIES) {
    const oldest = lastTTSOutcome.keys().next().value;
    if (oldest !== undefined) lastTTSOutcome.delete(oldest);
  }
  lastTTSOutcome.set(callSid, { provider: success.providerId, fellBack });
}

export function consumeTTSOutcome(callSid: string): { provider: TTSProviderId; fellBack: boolean } | undefined {
  const outcome = lastTTSOutcome.get(callSid);
  lastTTSOutcome.delete(callSid);
  return outcome;
}
