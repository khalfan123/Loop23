/**
 * Provider-orchestration composition: the live Deprock TTS router must run
 * the multi-signal `health_aware` selection strategy by default (not the
 * legacy preferred-then-fallback), and its route context must gate premium
 * alternates by the cross-provider policy.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveRouterConfig,
  buildTTSRouteContext,
  type VoiceRouterConfig,
} from '../../../server/engines/twilio-bedrock-polly/services/tts-router';
import type { AgentConfig } from '../../../server/engines/twilio-bedrock-polly/types';

function agent(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    voice: 'Joanna',
    language: 'en-US',
    ...overrides,
  } as AgentConfig;
}

describe('resolveRouterConfig', () => {
  it('defaults to the health-aware strategy with cross-provider off', () => {
    const cfg = resolveRouterConfig({} as NodeJS.ProcessEnv);
    expect(cfg.strategy).toBe('health_aware');
    expect(cfg.crossProvider).toBe(false);
    expect(cfg.weights).toBeUndefined();
  });

  it('honors an explicit opt-out to the legacy preferred strategy', () => {
    const cfg = resolveRouterConfig({ VOICE_ROUTER_STRATEGY: 'preferred' } as NodeJS.ProcessEnv);
    expect(cfg.strategy).toBe('preferred');
  });

  it('parses the cross-provider flag and selection weights', () => {
    const cfg = resolveRouterConfig({
      VOICE_ROUTER_CROSS_PROVIDER: 'true',
      VOICE_ROUTER_W_LATENCY: '0.6',
      VOICE_ROUTER_W_ERROR: '0.3',
      VOICE_ROUTER_W_COST: '0.1',
    } as NodeJS.ProcessEnv);
    expect(cfg.crossProvider).toBe(true);
    expect(cfg.weights).toEqual({ latency: 0.6, errorRate: 0.3, cost: 0.1 });
  });

  it('ignores malformed weights rather than passing NaN into the router', () => {
    const cfg = resolveRouterConfig({ VOICE_ROUTER_W_LATENCY: 'abc' } as NodeJS.ProcessEnv);
    expect(cfg.weights).toBeUndefined();
  });
});

describe('buildTTSRouteContext cross-provider gating', () => {
  const dualVoiceAgent = agent({
    ttsProvider: 'elevenlabs',
    elevenLabsVoiceId: 'el-voice',
    elevenLabsApiKey: 'agent-key',
    cartesiaVoiceId: 'ct-voice',
  });

  const off: VoiceRouterConfig = { strategy: 'health_aware', crossProvider: false };
  const on: VoiceRouterConfig = { strategy: 'health_aware', crossProvider: true };

  it('preserves voice identity by default: only the preferred premium provider + Polly are materializable', () => {
    const ctx = buildTTSRouteContext(dualVoiceAgent, 'elevenlabs', 'hi there', off);
    expect(ctx.preferred).toBe('elevenlabs');
    expect(ctx.buildRequest('elevenlabs')).not.toBeNull();
    expect(ctx.buildRequest('cartesia')).toBeNull(); // not the preferred one
    expect(ctx.buildRequest('aws_polly')).not.toBeNull();
  });

  it('offers any fully-credentialed alternate when cross-provider is enabled', () => {
    const ctx = buildTTSRouteContext(dualVoiceAgent, 'elevenlabs', 'hi there', on);
    expect(ctx.buildRequest('elevenlabs')).not.toBeNull();
    expect(ctx.buildRequest('cartesia')).not.toBeNull(); // now a real candidate
  });

  it('still requires real credentials for an offered alternate', () => {
    // Cross-provider on, but the agent has no cartesia voice id → not offered.
    const ctx = buildTTSRouteContext(
      agent({ ttsProvider: 'elevenlabs', elevenLabsVoiceId: 'el-voice', elevenLabsApiKey: 'k' }),
      'elevenlabs',
      'hi there',
      on
    );
    expect(ctx.buildRequest('cartesia')).toBeNull();
  });
});
