import { describe, it, expect } from 'vitest';
import { ProviderRegistry } from '../../server/voice-core/registry';
import type { TTSProvider } from '../../server/voice-core/types';

function makeProvider(id: TTSProvider['id']): TTSProvider {
  return {
    id,
    isConfigured: () => true,
    supportsLanguage: () => true,
    synthesize: async () => { throw new Error('unused'); },
  };
}

describe('ProviderRegistry', () => {
  it('registers and looks up providers', () => {
    const r = new ProviderRegistry();
    const polly = makeProvider('aws_polly');
    r.registerTTS(polly);
    expect(r.getTTS('aws_polly')).toBe(polly);
    expect(r.getTTS('cartesia')).toBeUndefined();
  });

  it('lists providers in registration order', () => {
    const r = new ProviderRegistry();
    r.registerTTS(makeProvider('elevenlabs'));
    r.registerTTS(makeProvider('aws_polly'));
    expect(r.listTTS().map(p => p.id)).toEqual(['elevenlabs', 'aws_polly']);
  });

  it('throws on duplicate registration', () => {
    const r = new ProviderRegistry();
    r.registerTTS(makeProvider('cartesia'));
    expect(() => r.registerTTS(makeProvider('cartesia'))).toThrow(/already registered/);
  });
});
