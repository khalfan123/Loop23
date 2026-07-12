import { describe, it, expect, vi, afterEach } from 'vitest';
import { PollyTTSProvider } from '../../server/voice-core/providers/polly-tts.provider';
import { ElevenLabsTTSProvider } from '../../server/voice-core/providers/elevenlabs-tts.provider';
import { awsPollyService } from '../../server/services/aws-polly';

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
  function stubFetch(payload: Buffer) {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength),
      text: async () => '',
    }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('requests pcm_16000 and decimates to 8kHz for telephony', async () => {
    // 4 samples at 16kHz -> 2 samples at 8kHz
    const pcm16k = Buffer.alloc(8);
    [100, 200, 300, 400].forEach((v, i) => pcm16k.writeInt16LE(v, i * 2));
    const fetchMock = stubFetch(pcm16k);

    const provider = new ElevenLabsTTSProvider();
    const result = await provider.synthesize({
      text: 'hi',
      voiceId: 'v1',
      sampleRateHz: 8000,
      options: { apiKey: 'k' },
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain('output_format=pcm_16000');
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
      options: { apiKey: 'k' },
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).not.toContain('output_format=');
    expect((init.headers as Record<string, string>).Accept).toBe('audio/mpeg');
    expect(JSON.parse(String(init.body)).output_format).toBe('mp3_22050_32');
    expect(result.audio.equals(mp3)).toBe(true);
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
