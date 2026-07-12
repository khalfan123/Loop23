/**
 * ============================================================
 * Voice Core — ElevenLabs TTS adapter
 *
 * Absorbs the engine's raw REST call: pcm_16000 output from the
 * /v1/text-to-speech endpoint, decimated 2:1 to 8kHz PCM16LE.
 * The per-agent API key arrives via TTSRequest.options.apiKey.
 * ============================================================
 */

import { downsamplePcm16By2 } from '../audio/g711';
import type { TTSProvider, TTSRequest, TTSResult } from '../types';

export class ElevenLabsTTSProvider implements TTSProvider {
  readonly id = 'elevenlabs' as const;

  isConfigured(): boolean {
    return !!process.env.ELEVENLABS_API_KEY;
  }

  supportsLanguage(_language: string | undefined): boolean {
    // eleven_multilingual_v2 is language-agnostic for our supported set.
    return true;
  }

  async synthesize(request: TTSRequest): Promise<TTSResult> {
    const apiKey = request.options?.apiKey || process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }
    const isMp3 = request.format === 'mp3';
    const startedAt = Date.now();

    const url = isMp3
      ? `https://api.elevenlabs.io/v1/text-to-speech/${request.voiceId}`
      : `https://api.elevenlabs.io/v1/text-to-speech/${request.voiceId}?output_format=pcm_16000`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        ...(isMp3 ? { Accept: 'audio/mpeg' } : {}),
      },
      body: JSON.stringify({
        text: request.text,
        model_id: 'eleven_multilingual_v2',
        ...(isMp3 ? { output_format: 'mp3_22050_32' } : {}),
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.85,
          speed: 1.0,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs TTS API error ${response.status}: ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const payload = Buffer.from(arrayBuffer);

    return {
      audio: isMp3 ? payload : downsamplePcm16By2(payload),
      providerId: this.id,
      latencyMs: Date.now() - startedAt,
      characters: request.text.length,
    };
  }
}
