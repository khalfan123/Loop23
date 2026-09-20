import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  VOICE_CLONE_CONSENT_VERSION,
  assertCloneSample,
} from '../../server/services/voice-clone';

describe('voice-clone service', () => {
  it('exports consent version', () => {
    expect(VOICE_CLONE_CONSENT_VERSION).toBe('loop9-voice-clone-v1');
  });

  it('rejects missing sample', () => {
    expect(() => assertCloneSample(undefined)).toThrow(/required/i);
  });

  it('rejects oversized sample', () => {
    const file = {
      buffer: Buffer.alloc(100),
      size: 20 * 1024 * 1024,
      mimetype: 'audio/wav',
      originalname: 'big.wav',
    } as Express.Multer.File;
    expect(() => assertCloneSample(file)).toThrow(/15MB/i);
  });

  it('accepts wav sample', () => {
    const file = {
      buffer: Buffer.from('RIFF'),
      size: 4,
      mimetype: 'audio/wav',
      originalname: 'ok.wav',
    } as Express.Multer.File;
    expect(assertCloneSample(file)).toBe(file);
  });
});

describe('voice-clone consent route shape', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('consent payload matches Instant Clone UI contract', async () => {
    const { VOICE_CLONE_CONSENT_VERSION: version } = await import('../../server/services/voice-clone');
    expect(version).toMatch(/^loop9-voice-clone-/);
  });
});
