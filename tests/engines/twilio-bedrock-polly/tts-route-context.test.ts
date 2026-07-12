import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildTTSRouteContext, buildBrowserTTSRouteContext } from '../../../server/engines/twilio-bedrock-polly/services/tts-router';
import type { AgentConfig } from '../../../server/engines/twilio-bedrock-polly/types';

/**
 * Behavior-preservation contract for the legacy synthesizeAndSend
 * provider dispatch (audio-bridge.service.ts, pre-router):
 *
 *   cartesia + cartesiaVoiceId  -> cartesia(speed 1.25), Polly fallback
 *                                  with UUID-guarded voice
 *   elevenlabs + voiceId + key  -> elevenlabs(agent key || env key),
 *                                  Polly fallback with RAW agent voice
 *   elevenlabs w/o key          -> straight to Polly (raw agent voice)
 *   anything else               -> Polly (raw agent voice)
 */

function agent(overrides: Partial<AgentConfig>): AgentConfig {
  return {
    voice: 'Joanna',
    ...overrides,
  } as AgentConfig;
}

const savedEnv = process.env.ELEVENLABS_API_KEY;

beforeEach(() => {
  delete process.env.ELEVENLABS_API_KEY;
});

afterEach(() => {
  if (savedEnv === undefined) delete process.env.ELEVENLABS_API_KEY;
  else process.env.ELEVENLABS_API_KEY = savedEnv;
});

describe('buildTTSRouteContext — legacy agent shapes', () => {
  it('polly-only agent: preferred aws_polly, raw voice, others unusable', () => {
    const ctx = buildTTSRouteContext(agent({ voice: 'Matthew' }), 'aws_polly', 'hello');
    expect(ctx.preferred).toBe('aws_polly');
    expect(ctx.finalFallback).toBe('aws_polly');
    expect(ctx.buildRequest('aws_polly')).toMatchObject({ text: 'hello', voiceId: 'Matthew', sampleRateHz: 8000 });
    expect(ctx.buildRequest('elevenlabs')).toBeNull();
    expect(ctx.buildRequest('cartesia')).toBeNull();
  });

  it('elevenlabs agent with per-agent key: preferred elevenlabs, key passed through, raw Polly fallback voice', () => {
    const config = agent({
      voice: 'Joanna',
      elevenLabsVoiceId: 'v-eleven-1',
      elevenLabsApiKey: 'agent-key',
    });
    const ctx = buildTTSRouteContext(config, 'elevenlabs', 'hi there');
    expect(ctx.preferred).toBe('elevenlabs');
    expect(ctx.buildRequest('elevenlabs')).toMatchObject({
      voiceId: 'v-eleven-1',
      options: { apiKey: 'agent-key' },
    });
    // Legacy asymmetry: EL fallback uses the RAW agent voice, no UUID guard
    expect(ctx.buildRequest('aws_polly')).toMatchObject({ voiceId: 'Joanna' });
  });

  it('elevenlabs agent without any key: elevenlabs unusable -> effective order collapses to Polly', () => {
    const config = agent({ voice: 'Joanna', elevenLabsVoiceId: 'v-eleven-1' });
    const ctx = buildTTSRouteContext(config, 'elevenlabs', 'hi');
    expect(ctx.buildRequest('elevenlabs')).toBeNull();
    expect(ctx.buildRequest('aws_polly')).toMatchObject({ voiceId: 'Joanna' });
  });

  it('elevenlabs agent falls back to env key when the agent has none', () => {
    process.env.ELEVENLABS_API_KEY = 'env-key';
    const config = agent({ voice: 'Joanna', elevenLabsVoiceId: 'v-eleven-1' });
    const ctx = buildTTSRouteContext(config, 'elevenlabs', 'hi');
    expect(ctx.buildRequest('elevenlabs')).toMatchObject({ options: { apiKey: 'env-key' } });
  });

  it('cartesia agent with a vendor UUID in voice: speed 1.25 and UUID-guarded Polly fallback voice', () => {
    const config = agent({
      voice: 'a1b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6', // 36-char vendor UUID
      cartesiaVoiceId: 'cart-voice-9',
      language: 'ar',
    });
    const ctx = buildTTSRouteContext(config, 'cartesia', 'مرحبا');
    expect(ctx.preferred).toBe('cartesia');
    expect(ctx.buildRequest('cartesia')).toMatchObject({
      voiceId: 'cart-voice-9',
      language: 'ar',
      options: { speed: 1.25 },
    });
    // UUID guard replaces the vendor UUID with the per-language Polly default
    expect(ctx.buildRequest('aws_polly')).toMatchObject({ voiceId: 'Hala' });
  });

  it('cartesia agent with a real Polly voice name keeps it for the fallback', () => {
    const config = agent({ voice: 'Matthew', cartesiaVoiceId: 'cart-voice-9' });
    const ctx = buildTTSRouteContext(config, 'cartesia', 'hello');
    expect(ctx.buildRequest('aws_polly')).toMatchObject({ voiceId: 'Matthew' });
  });

  it('preferred provider demotes to aws_polly when its voice id is missing (legacy else-branch)', () => {
    const ctx = buildTTSRouteContext(agent({ voice: 'Joanna' }), 'cartesia', 'hello');
    expect(ctx.preferred).toBe('aws_polly');
    const ctx2 = buildTTSRouteContext(agent({ voice: 'Joanna' }), 'elevenlabs', 'hello');
    expect(ctx2.preferred).toBe('aws_polly');
  });
});

describe('buildBrowserTTSRouteContext — browser test-call shapes', () => {
  it('polly agent: mp3 at 22.05kHz with neural-only degradation, cartesia excluded', () => {
    const ctx = buildBrowserTTSRouteContext(agent({ voice: 'Matthew' }), 'Matthew', 'hello');
    expect(ctx.preferred).toBe('aws_polly');
    expect(ctx.buildRequest('aws_polly')).toMatchObject({
      voiceId: 'Matthew',
      sampleRateHz: 22050,
      format: 'mp3',
      options: { pollyNeuralOnly: true },
    });
    expect(ctx.buildRequest('cartesia')).toBeNull();
    expect(ctx.buildRequest('elevenlabs')).toBeNull();
  });

  it('elevenlabs agent with key: mp3 ElevenLabs preferred, Polly mp3 fallback', () => {
    const config = agent({
      voice: 'Joanna',
      ttsProvider: 'elevenlabs',
      elevenLabsVoiceId: 'v-eleven-1',
      elevenLabsApiKey: 'agent-key',
    });
    const ctx = buildBrowserTTSRouteContext(config, 'Joanna', 'hi');
    expect(ctx.preferred).toBe('elevenlabs');
    expect(ctx.buildRequest('elevenlabs')).toMatchObject({
      voiceId: 'v-eleven-1',
      sampleRateHz: 22050,
      format: 'mp3',
      options: { apiKey: 'agent-key' },
    });
    expect(ctx.buildRequest('aws_polly')).toMatchObject({ voiceId: 'Joanna', format: 'mp3' });
  });

  it('elevenlabs agent without key demotes to Polly (legacy skip)', () => {
    const config = agent({ voice: 'Joanna', ttsProvider: 'elevenlabs', elevenLabsVoiceId: 'v-1' });
    const ctx = buildBrowserTTSRouteContext(config, 'Joanna', 'hi');
    expect(ctx.buildRequest('elevenlabs')).toBeNull();
  });
});
