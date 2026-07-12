/**
 * ============================================================
 * Voice Core — Cartesia Sonic TTS adapter
 *
 * Wraps the existing cartesiaTTSService (raw pcm_s16le at the
 * requested sample rate). Speech rate arrives via
 * TTSRequest.options.speed (the Deprock engine passes 1.25).
 * ============================================================
 */

import { cartesiaTTSService } from '../../services/cartesia-tts';
import type { TTSProvider, TTSRequest, TTSResult } from '../types';

export class CartesiaTTSProvider implements TTSProvider {
  readonly id = 'cartesia' as const;

  isConfigured(): boolean {
    return cartesiaTTSService.isConfigured();
  }

  supportsLanguage(language: string | undefined): boolean {
    if (!language) return true;
    const prefix = language.split('-')[0].toLowerCase();
    return cartesiaTTSService.getSupportedLanguages().some(l => l.code === prefix);
  }

  async synthesize(request: TTSRequest): Promise<TTSResult> {
    const startedAt = Date.now();
    const result = await cartesiaTTSService.synthesizeSpeech({
      text: request.text,
      voiceId: request.voiceId,
      language: request.language || 'en',
      sampleRate: request.sampleRateHz,
      speed: request.options?.speed,
    });
    return {
      pcm: result.audioStream,
      providerId: this.id,
      latencyMs: Date.now() - startedAt,
      characters: request.text.length,
    };
  }
}
