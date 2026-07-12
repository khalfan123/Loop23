import { describe, it, expect } from 'vitest';
import {
  buildAgentSettings,
  DEEPGRAM_AGENT_DEFAULTS,
} from '../../../server/engines/deepgram-voice-agent/config/settings';

describe('buildAgentSettings', () => {
  it('emits telephony audio settings: mulaw/8000 in both directions, no container', () => {
    const s = buildAgentSettings({ systemPrompt: 'Be helpful.' });
    expect(s.type).toBe('Settings');
    expect(s.audio.input).toEqual({ encoding: 'mulaw', sample_rate: 8000 });
    expect(s.audio.output).toEqual({ encoding: 'mulaw', sample_rate: 8000, container: 'none' });
  });

  it('listens with Flux v2 and speaks with the default Aura-2 voice', () => {
    const s = buildAgentSettings({ systemPrompt: 'Be helpful.' });
    expect(s.agent.listen.provider).toEqual({
      type: 'deepgram',
      version: 'v2',
      model: DEEPGRAM_AGENT_DEFAULTS.listenModel,
    });
    expect(s.agent.speak.provider).toEqual({
      type: 'deepgram',
      model: DEEPGRAM_AGENT_DEFAULTS.speakModel,
    });
  });

  it('threads the system prompt and greeting through', () => {
    const s = buildAgentSettings({
      systemPrompt: 'You are the billing agent.',
      greeting: '  Hello! How may I help you?  ',
    });
    expect(s.agent.think.prompt).toBe('You are the billing agent.');
    expect(s.agent.greeting).toBe('Hello! How may I help you?');
  });

  it('omits an empty greeting entirely', () => {
    const s = buildAgentSettings({ systemPrompt: 'x', greeting: '   ' });
    expect(s.agent.greeting).toBeUndefined();
  });

  it('honors speak/think overrides (e.g. the Gemini think config)', () => {
    const s = buildAgentSettings({
      systemPrompt: 'x',
      speakModel: 'aura-2-odysseus-en',
      think: { provider: 'google', model: 'gemini-3.1-flash-lite' },
    });
    expect(s.agent.speak.provider.model).toBe('aura-2-odysseus-en');
    expect(s.agent.think.provider).toEqual({ type: 'google', model: 'gemini-3.1-flash-lite' });
  });

  it('defaults the think provider when none is configured', () => {
    const s = buildAgentSettings({ systemPrompt: 'x' });
    expect(s.agent.think.provider).toEqual({
      type: DEEPGRAM_AGENT_DEFAULTS.thinkProvider,
      model: DEEPGRAM_AGENT_DEFAULTS.thinkModel,
    });
  });
});
