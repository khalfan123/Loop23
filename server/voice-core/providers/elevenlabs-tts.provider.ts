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
    const startedAt = Date.now();

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${request.voiceId}?output_format=pcm_16000`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: request.text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.55,
            similarity_boost: 0.85,
            speed: 1.0,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs TTS API error ${response.status}: ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const pcm16k = Buffer.from(arrayBuffer);

    return {
      pcm: downsamplePcm16By2(pcm16k),
      providerId: this.id,
      latencyMs: Date.now() - startedAt,
      characters: request.text.length,
    };
  }
}
