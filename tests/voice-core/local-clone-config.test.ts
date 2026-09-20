import { describe, it, expect, afterEach } from 'vitest';
import {
  isLocalCloneBaseConfigured,
  isLocalCloneLiveEnabled,
  localCloneMaxLatencyMs,
  normalizeLocalCloneBaseUrl,
} from '../../server/voice-core/providers/local-clone-config';

afterEach(() => {
  delete process.env.LOCAL_CLONE_TTS_BASE_URL;
  delete process.env.LOCAL_CLONE_TTS_LIVE;
  delete process.env.LOCAL_CLONE_TTS_MAX_LATENCY_MS;
});

describe('local-clone-config', () => {
  it('normalizes base URL to include /v1', () => {
    expect(normalizeLocalCloneBaseUrl('http://gpu:3900')).toBe('http://gpu:3900/v1');
    expect(normalizeLocalCloneBaseUrl('http://gpu:3900/v1/')).toBe('http://gpu:3900/v1');
  });

  it('live requires BASE_URL and LOCAL_CLONE_TTS_LIVE', () => {
    expect(isLocalCloneLiveEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(
      isLocalCloneLiveEnabled({ LOCAL_CLONE_TTS_BASE_URL: 'http://x' } as NodeJS.ProcessEnv),
    ).toBe(false);
    expect(
      isLocalCloneLiveEnabled({
        LOCAL_CLONE_TTS_BASE_URL: 'http://x',
        LOCAL_CLONE_TTS_LIVE: '1',
      } as NodeJS.ProcessEnv),
    ).toBe(true);
    expect(isLocalCloneBaseConfigured({ LOCAL_CLONE_TTS_BASE_URL: 'http://x' } as NodeJS.ProcessEnv)).toBe(
      true,
    );
  });

  it('parses max latency with a safe default', () => {
    expect(localCloneMaxLatencyMs({} as NodeJS.ProcessEnv)).toBe(800);
    expect(
      localCloneMaxLatencyMs({ LOCAL_CLONE_TTS_MAX_LATENCY_MS: '400' } as NodeJS.ProcessEnv),
    ).toBe(400);
    expect(
      localCloneMaxLatencyMs({ LOCAL_CLONE_TTS_MAX_LATENCY_MS: '50' } as NodeJS.ProcessEnv),
    ).toBe(800);
  });
});
