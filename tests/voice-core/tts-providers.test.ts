import { describe, it, expect, vi, afterEach } from 'vitest';
import { PollyTTSProvider } from '../../server/voice-core/providers/polly-tts.provider';
import { ElevenLabsTTSProvider } from '../../server/voice-core/providers/elevenlabs-tts.provider';
import { awsPollyService } from '../../server/services/aws-polly';
import { buildTTSRouteContext } from '../../server/engines/twilio-bedrock-polly/services/tts-router';
import type { AgentConfig } from '../../server/engines/twilio-bedrock-polly/types';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('PollyTTSProvider', () => {
  it('degrades SSML+neural -> neural -> standard for telephony PCM', async () => {
    const synth = vi
      .spyOn(awsPollyService, 'synthesizeSpeech')
      .mockRejectedValueOnce(new Error('ssml bad'))
      .mockRejectedValueOnce(new Error('neural bad'))
      .mockResolvedValueOnce({ audioStream: Buffer.from('ok'), contentType: 'audio/pcm', requestCharacters: 2 });
    const provider = new PollyTTSProvider({ ssmlify: (t) => `<speak>${t}</speak>` });

    const result = await provider.synthesize({ text: 'hi there', voiceId: 'Joanna', sampleRateHz: 8000 });
    expect(result.audio.toString()).toBe('ok');
    expect(synth).toHaveBeenCalledTimes(3);
    expect(synth.mock.calls[0][0]).toMatchObject({ engine: 'neural', textType: 'ssml', outputFormat: 'pcm', sampleRate: '8000' });
    expect(synth.mock.calls[1][0]).toMatchObject({ engine: 'neural', outputFormat: 'pcm' });
    expect(synth.mock.calls[2][0]).toMatchObject({ engine: 'standard', outputFormat: 'pcm' });
  });

  it('passes mp3/22050 through for browser output', async () => {
    const synth = vi
      .spyOn(awsPollyService, 'synthesizeSpeech')
      .mockResolvedValueOnce({ audioStream: Buffer.from('mp3'), contentType: 'audio/mpeg', requestCharacters: 2 });
    const provider = new PollyTTSProvider({ ssmlify: (t) => `<speak>${t}</speak>` });

    await provider.synthesize({ text: 'hi', voiceId: 'Joanna', sampleRateHz: 22050, format: 'mp3' });
    expect(synth.mock.calls[0][0]).toMatchObject({ outputFormat: 'mp3', sampleRate: '22050' });
  });

  it('never falls to the standard tier when pollyNeuralOnly is set (browser contract)', async () => {
    const synth = vi
      .spyOn(awsPollyService, 'synthesizeSpeech')
      .mockRejectedValueOnce(new Error('ssml bad'))
      .mockRejectedValueOnce(new Error('neural bad'));
    const provider = new PollyTTSProvider({ ssmlify: (t) => `<speak>${t}</speak>` });

    await expect(
      provider.synthesize({
        text: 'hi',
        voiceId: 'Joanna',
        sampleRateHz: 22050,
        format: 'mp3',
        options: { pollyNeuralOnly: true },
      })
    ).rejects.toThrow('neural bad');
    expect(synth).toHaveBeenCalledTimes(2);
    expect(synth.mock.calls.every(([opts]) => opts.engine === 'neural')).toBe(true);
  });
});

describe('ElevenLabsTTSProvider', () => {
  function stubFetch(payload: Buffer, opts?: { ok?: boolean; status?: number }) {
    const fetchMock = vi.fn(async () => ({
      ok: opts?.ok ?? true,
      status: opts?.status ?? 200,
      arrayBuffer: async () => payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength),
      text: async () => (opts?.ok === false ? 'error' : ''),
    }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('requests ulaw_8000 for telephony and returns mulaw encoding', async () => {
    const ulaw = Buffer.from([0x7f, 0x80, 0x81]);
    const fetchMock = stubFetch(ulaw);

    const provider = new ElevenLabsTTSProvider();
    const result = await provider.synthesize({
      text: 'hi',
      voiceId: 'v1',
      sampleRateHz: 8000,
      options: {
        apiKey: 'k',
        stability: 0.4,
        similarityBoost: 0.9,
        speed: 1.1,
        style: 0.2,
        useSpeakerBoost: true,
        modelId: 'eleven_flash_v2_5',
        optimizeStreamingLatency: 2,
      },
    });

    expect(String(fetchMock.mock.calls[0][0])).toContain('output_format=ulaw_8000');
    expect(String(fetchMock.mock.calls[0][0])).toContain('optimize_streaming_latency=2');
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.model_id).toBe('eleven_flash_v2_5');
    expect(body.voice_settings).toEqual({
      stability: 0.4,
      similarity_boost: 0.9,
      speed: 1.1,
      style: 0.2,
      use_speaker_boost: true,
    });
    expect(result.encoding).toBe('mulaw');
    expect(result.audio.equals(ulaw)).toBe(true);
  });

  it('falls back to pcm_16000 and decimates when ulaw_8000 fails', async () => {
    const pcm16k = Buffer.alloc(8);
    [100, 200, 300, 400].forEach((v, i) => pcm16k.writeInt16LE(v, i * 2));

    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('ulaw_8000')) {
        return {
          ok: false,
          status: 400,
          arrayBuffer: async () => new ArrayBuffer(0),
          text: async () => 'ulaw unsupported',
        };
      }
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => pcm16k.buffer.slice(pcm16k.byteOffset, pcm16k.byteOffset + pcm16k.byteLength),
        text: async () => '',
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new ElevenLabsTTSProvider();
    const result = await provider.synthesize({
      text: 'hi',
      voiceId: 'v1',
      sampleRateHz: 8000,
      options: { apiKey: 'k' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('output_format=pcm_16000');
    expect(result.encoding).toBe('pcm16le');
    expect(result.audio.length).toBe(4);
    expect(result.audio.readInt16LE(0)).toBe(100);
    expect(result.audio.readInt16LE(2)).toBe(300);
  });

  it('requests mp3_22050_32 with Accept audio/mpeg for the browser and returns the payload untouched', async () => {
    const mp3 = Buffer.from('mp3-bytes');
    const fetchMock = stubFetch(mp3);

    const provider = new ElevenLabsTTSProvider();
    const result = await provider.synthesize({
      text: 'hi',
      voiceId: 'v1',
      sampleRateHz: 22050,
      format: 'mp3',
      options: { apiKey: 'k', useSpeakerBoost: false, style: 0 },
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).not.toContain('output_format=');
    expect((init.headers as Record<string, string>).Accept).toBe('audio/mpeg');
    const body = JSON.parse(String(init.body));
    expect(body.output_format).toBe('mp3_22050_32');
    expect(body.model_id).toBe('eleven_multilingual_v2');
    expect(body.voice_settings.use_speaker_boost).toBe(false);
    expect(result.audio.equals(mp3)).toBe(true);
    expect(result.encoding).toBe('mp3');
  });

  it('throws without an API key', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const saved = process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_API_KEY;
    try {
      const provider = new ElevenLabsTTSProvider();
      await expect(provider.synthesize({ text: 'hi', voiceId: 'v1', sampleRateHz: 8000 })).rejects.toThrow(/API key/);
    } finally {
      if (saved !== undefined) process.env.ELEVENLABS_API_KEY = saved;
    }
  });
});

describe('buildTTSRouteContext ElevenLabs options', () => {
  it('forwards agent voice settings into TTSRequest.options', () => {
    const agentConfig: AgentConfig = {
      voice: 'Joanna',
      model: 'claude-sonnet-4-6',
      systemPrompt: 'hi',
      ttsProvider: 'elevenlabs',
      elevenLabsVoiceId: 'el-voice-1',
      elevenLabsApiKey: 'key-1',
      elevenLabsModelId: 'eleven_multilingual_v2',
      voiceStability: 0.61,
      voiceSimilarityBoost: 0.72,
      voiceSpeed: 1.05,
      voiceStyle: 0.15,
      voiceSpeakerBoost: false,
      language: 'en',
    };

    const ctx = buildTTSRouteContext(agentConfig, 'elevenlabs', 'Hello there');
    const req = ctx.buildRequest('elevenlabs');
    expect(req).not.toBeNull();
    expect(req!.options).toMatchObject({
      apiKey: 'key-1',
      modelId: 'eleven_multilingual_v2',
      stability: 0.61,
      similarityBoost: 0.72,
      speed: 1.05,
      style: 0.15,
      useSpeakerBoost: false,
      optimizeStreamingLatency: 2,
    });
  });
});
