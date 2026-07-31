/**
 * ============================================================
 * Voice Core — OpenAI-compatible local clone TTS adapter
 *
 * Talks to POST {base}/v1/audio/speech (OmniVoice Studio unmodified,
 * or any Apache self-hosted / commercial clone stack). Does NOT vendor
 * AGPL Studio source into Loop9.
 *
 * Telephony: request pcm, resample to 8 kHz PCM16LE.
 * Browser: request mp3 when format=mp3.
 * ============================================================
 */

import { downsamplePcm16ByFactor } from '../audio/g711';
import type { TTSProvider, TTSRequest, TTSResult } from '../types';

function stripWavPcm16(payload: Buffer): { pcm: Buffer; sampleRateHz: number } {
  if (payload.length < 44 || payload.toString('ascii', 0, 4) !== 'RIFF') {
    return { pcm: payload, sampleRateHz: 0 };
  }
  const sampleRateHz = payload.readUInt32LE(24);
  const audioFormat = payload.readUInt16LE(20);
  const bitsPerSample = payload.readUInt16LE(34);
  // Find data chunk (standard 44-byte header or extended).
  let offset = 12;
  while (offset + 8 <= payload.length) {
    const id = payload.toString('ascii', offset, offset + 4);
    const size = payload.readUInt32LE(offset + 4);
    if (id === 'data') {
      const pcm = payload.subarray(offset + 8, offset + 8 + size);
      if (audioFormat !== 1 || bitsPerSample !== 16) {
        throw new Error(
          `Local clone TTS WAV must be PCM16 (got format=${audioFormat}, bits=${bitsPerSample})`
        );
      }
      return { pcm, sampleRateHz };
    }
    offset += 8 + size;
  }
  throw new Error('Local clone TTS WAV missing data chunk');
}

function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.replace(/\/+$/, '');
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
}

export class LocalCloneTTSProvider implements TTSProvider {
  readonly id = 'local_clone' as const;

  isConfigured(): boolean {
    return !!process.env.LOCAL_CLONE_TTS_BASE_URL?.trim();
  }

  supportsLanguage(_language: string | undefined): boolean {
    return true;
  }

  async synthesize(request: TTSRequest): Promise<TTSResult> {
    const baseRaw = process.env.LOCAL_CLONE_TTS_BASE_URL?.trim();
    if (!baseRaw) {
      throw new Error('LOCAL_CLONE_TTS_BASE_URL is not configured');
    }

    const base = normalizeBaseUrl(baseRaw);
    const apiKey =
      request.options?.apiKey || process.env.LOCAL_CLONE_TTS_API_KEY || 'none';
    const model =
      request.options?.modelId || process.env.LOCAL_CLONE_TTS_MODEL || 'tts-1';
    const isMp3 = request.format === 'mp3';
    const startedAt = Date.now();

    const responseFormat = isMp3 ? 'mp3' : 'pcm';
    const response = await fetch(`${base}/audio/speech`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: isMp3 ? 'audio/mpeg' : 'application/octet-stream',
      },
      body: JSON.stringify({
        model,
        voice: request.voiceId,
        input: request.text,
        response_format: responseFormat,
        speed: request.options?.speed ?? 1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Local clone TTS error ${response.status}: ${errorText.slice(0, 400)}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const payload = Buffer.from(arrayBuffer);

    if (isMp3) {
      return {
        audio: payload,
        providerId: this.id,
        latencyMs: Date.now() - startedAt,
        characters: request.text.length,
        encoding: 'mp3',
      };
    }

    const parsed = stripWavPcm16(payload);
    let pcm = parsed.pcm;
    const sourceRate =
      parsed.sampleRateHz ||
      Number(process.env.LOCAL_CLONE_TTS_SAMPLE_RATE || 24000) ||
      24000;

    if (request.sampleRateHz === 8000 && sourceRate > 8000) {
      const factor = Math.round(sourceRate / 8000);
      if (factor >= 2 && Math.abs(sourceRate / factor - 8000) < 1) {
        pcm = downsamplePcm16ByFactor(pcm, factor);
      } else {
        throw new Error(
          `Local clone TTS cannot resample ${sourceRate} Hz → 8000 Hz (need integer factor)`
        );
      }
    }

    return {
      audio: pcm,
      providerId: this.id,
      latencyMs: Date.now() - startedAt,
      characters: request.text.length,
      encoding: 'pcm16le',
    };
  }
}
