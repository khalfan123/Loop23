import { describe, it, expect, vi } from 'vitest';
import { WhisperBatchSTTProvider } from '../../server/voice-core/stt/whisper-batch.provider';

function whisperResponse(body: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as Response;
}

function makeProvider(fetchImpl: typeof fetch, apiKey: string | null = 'sk-test') {
  return new WhisperBatchSTTProvider({
    resolveApiKey: async () => apiKey,
    fetchImpl,
  });
}

const audio = Buffer.alloc(1600, 0x7f); // 200ms of mulaw

describe('WhisperBatchSTTProvider', () => {
  it('returns the transcript with quality metadata on success', async () => {
    const fetchMock = vi.fn(async () =>
      whisperResponse({
        text: ' I need help with my bill ',
        segments: [
          { no_speech_prob: 0.1, avg_logprob: -0.3 },
          { no_speech_prob: 0.2, avg_logprob: -0.5 },
        ],
      })
    );
    const result = await makeProvider(fetchMock as any).transcribe({ audio, language: 'en' });
    expect(result.text).toBe('I need help with my bill');
    expect(result.rejected).toBeUndefined();
    expect(result.segmentCount).toBe(2);
    expect(result.noSpeechProb).toBeCloseTo(0.15);
    expect(result.avgLogprob).toBeCloseTo(-0.4);
  });

  it('sends a WAV file, model, language, and Arabic priming prompt', async () => {
    let captured: FormData | undefined;
    const fetchMock = vi.fn(async (_url: any, init: any) => {
      captured = init.body as FormData;
      return whisperResponse({ text: 'مرحبا' });
    });
    await makeProvider(fetchMock as any).transcribe({
      audio,
      language: 'ar',
      promptContext: ['previous user turn'],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/audio/transcriptions',
      expect.objectContaining({ headers: { Authorization: 'Bearer sk-test' } })
    );
    expect(captured!.get('model')).toBe('whisper-1');
    expect(captured!.get('language')).toBe('ar');
    const prompt = captured!.get('prompt') as string;
    expect(prompt).toContain('فاتورة');
    expect(prompt).toContain('previous user turn');
    const file = captured!.get('file') as File;
    expect(file.size).toBe(audio.length + 46); // WAV header + payload
  });

  it('rejects on high no_speech_prob but preserves the text for logging', async () => {
    const fetchMock = vi.fn(async () =>
      whisperResponse({ text: 'hallucinated', segments: [{ no_speech_prob: 0.9, avg_logprob: -0.2 }] })
    );
    const result = await makeProvider(fetchMock as any).transcribe({ audio });
    expect(result.rejected).toBe('confidence');
    expect(result.text).toBe('hallucinated');
  });

  it('rejects on low avg_logprob', async () => {
    const fetchMock = vi.fn(async () =>
      whisperResponse({ text: 'garbled', segments: [{ no_speech_prob: 0.1, avg_logprob: -1.5 }] })
    );
    const result = await makeProvider(fetchMock as any).transcribe({ audio });
    expect(result.rejected).toBe('confidence');
  });

  it('returns an error result with detail on API failure', async () => {
    const fetchMock = vi.fn(async () => whisperResponse('rate limited', 429));
    const result = await makeProvider(fetchMock as any).transcribe({ audio });
    expect(result.text).toBe('');
    expect(result.rejected).toBe('error');
    expect(result.errorStatus).toBe(429);
    expect(result.errorMessage).toContain('429');
  });

  it('returns an error result when no API key resolves', async () => {
    const fetchMock = vi.fn();
    const result = await makeProvider(fetchMock as any, null).transcribe({ audio });
    expect(result.rejected).toBe('error');
    expect(result.errorMessage).toContain('API key');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports aborted requests distinctly', async () => {
    const fetchMock = vi.fn(async () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    });
    const result = await makeProvider(fetchMock as any).transcribe({ audio });
    expect(result.rejected).toBe('aborted');
    expect(result.text).toBe('');
  });

  it('falls back to raw text when the response is not JSON', async () => {
    const fetchMock = vi.fn(async () => whisperResponse('plain text transcript'));
    const result = await makeProvider(fetchMock as any).transcribe({ audio });
    expect(result.text).toBe('plain text transcript');
    expect(result.segmentCount).toBe(0);
  });
});
