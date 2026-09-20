/**
 * ============================================================
 * Voice Core — ElevenLabs TTS adapter
 *
 * Telephony: ulaw_8000 (native Twilio format) with pcm_16000
 * fallback + 2:1 decimation. Browser: mp3_22050_32.
 * Voice settings and model come from TTSRequest.options.
 * ============================================================
 */

import { downsamplePcm16By2 } from '../audio/g711';
import type { TTSProvider, TTSRequest, TTSResult } from '../types';

const DEFAULT_PHONE_MODEL = 'eleven_flash_v2_5';
const DEFAULT_BROWSER_MODEL = 'eleven_multilingual_v2';

export class ElevenLabsTTSProvider implements TTSProvider {
  readonly id = 'elevenlabs' as const;

  isConfigured(): boolean {
    return !!process.env.ELEVENLABS_API_KEY;
  }

  supportsLanguage(_language: string | undefined): boolean {
    return true;
  }

  async synthesize(request: TTSRequest): Promise<TTSResult> {
    const apiKey = request.options?.apiKey || process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }
    const isMp3 = request.format === 'mp3';
    const startedAt = Date.now();
    const opts = request.options || {};

    const modelId =
      opts.modelId || (isMp3 ? DEFAULT_BROWSER_MODEL : DEFAULT_PHONE_MODEL);

    const voiceSettings = {
      stability: opts.stability ?? 0.55,
      similarity_boost: opts.similarityBoost ?? 0.85,
      speed: opts.speed ?? 1.0,
      style: opts.style ?? 0,
      use_speaker_boost: opts.useSpeakerBoost ?? true,
    };

    const bodyBase = {
      text: request.text,
      model_id: modelId,
      voice_settings: voiceSettings,
    };

    if (isMp3) {
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${request.voiceId}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          ...bodyBase,
          output_format: 'mp3_22050_32',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs TTS API error ${response.status}: ${errorText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return {
        audio: Buffer.from(arrayBuffer),
        providerId: this.id,
        latencyMs: Date.now() - startedAt,
        characters: request.text.length,
        encoding: 'mp3',
      };
    }

    // Telephony: prefer native μ-law 8kHz; fall back to pcm_16000 + downsample.
    const latencyQ =
      opts.optimizeStreamingLatency !== undefined
        ? `&optimize_streaming_latency=${opts.optimizeStreamingLatency}`
        : '';

    try {
      const ulawUrl =
        `https://api.elevenlabs.io/v1/text-to-speech/${request.voiceId}` +
        `?output_format=ulaw_8000${latencyQ}`;
      const ulawResponse = await fetch(ulawUrl, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyBase),
      });

      if (ulawResponse.ok) {
        const arrayBuffer = await ulawResponse.arrayBuffer();
        return {
          audio: Buffer.from(arrayBuffer),
          providerId: this.id,
          latencyMs: Date.now() - startedAt,
          characters: request.text.length,
          encoding: 'mulaw',
        };
      }

      const errText = await ulawResponse.text();
      console.warn(
        `[ElevenLabs TTS] ulaw_8000 failed (${ulawResponse.status}): ${errText.slice(0, 200)} — falling back to pcm_16000`
      );
    } catch (ulawErr: any) {
      console.warn(
        `[ElevenLabs TTS] ulaw_8000 request error: ${ulawErr?.message || ulawErr} — falling back to pcm_16000`
      );
    }

    const pcmUrl =
      `https://api.elevenlabs.io/v1/text-to-speech/${request.voiceId}` +
      `?output_format=pcm_16000${latencyQ}`;
    const pcmResponse = await fetch(pcmUrl, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyBase),
    });

    if (!pcmResponse.ok) {
      const errorText = await pcmResponse.text();
      throw new Error(`ElevenLabs TTS API error ${pcmResponse.status}: ${errorText}`);
    }

    const arrayBuffer = await pcmResponse.arrayBuffer();
    const payload = Buffer.from(arrayBuffer);

    return {
      audio: downsamplePcm16By2(payload),
      providerId: this.id,
      latencyMs: Date.now() - startedAt,
      characters: request.text.length,
      encoding: 'pcm16le',
    };
  }
}
