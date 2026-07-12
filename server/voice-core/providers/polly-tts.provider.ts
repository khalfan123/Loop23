/**
 * ============================================================
 * Voice Core — AWS Polly TTS adapter
 *
 * Wraps the existing awsPollyService with the engine's legacy
 * three-tier degradation: SSML+neural -> neural -> standard,
 * caching voices that reject SSML or neural for the process
 * lifetime (the adapter is a process-wide singleton).
 * ============================================================
 */

import { awsPollyService } from '../../services/aws-polly';
import type { TTSProvider, TTSRequest, TTSResult } from '../types';

/**
 * Language -> default Polly voice map (moved verbatim from the engine's
 * getPollyFallbackVoice). Used when an agent's configured voice is not a
 * Polly voice id (e.g. an ElevenLabs/Cartesia UUID).
 */
export function defaultPollyVoiceForLanguage(language?: string): string {
  const langVoiceMap: Record<string, string> = {
    ar: 'Hala',
    en: 'Joanna',
    es: 'Lupe',
    fr: 'Lea',
    de: 'Vicki',
    it: 'Bianca',
    pt: 'Camila',
    hi: 'Kajal',
    ja: 'Kazuha',
    ko: 'Seoyeon',
    zh: 'Zhiyu',
    tr: 'Burcu',
    nl: 'Laura',
    pl: 'Ola',
    sv: 'Elin',
    da: 'Sofie',
    nb: 'Ida',
    fi: 'Suvi',
  };
  if (!language) return 'Joanna';
  const langPrefix = language.split('-')[0].toLowerCase();
  return langVoiceMap[langPrefix] || 'Joanna';
}

export class PollyTTSProvider implements TTSProvider {
  readonly id = 'aws_polly' as const;

  private ssmlBlockedVoices: Set<string> = new Set();
  private neuralBlockedVoices: Set<string> = new Set();
  private ssmlify?: (text: string) => string;

  constructor(options: { ssmlify?: (text: string) => string } = {}) {
    this.ssmlify = options.ssmlify;
  }

  isConfigured(): boolean {
    return awsPollyService.isConfigured();
  }

  supportsLanguage(_language: string | undefined): boolean {
    // Polly is the universal final fallback; voice selection per language
    // is handled by defaultPollyVoiceForLanguage in the route context.
    return true;
  }

  async synthesize(request: TTSRequest): Promise<TTSResult> {
    const { text, voiceId } = request;
    const outputFormat = request.format === 'mp3' ? 'mp3' : 'pcm';
    const sampleRate = String(request.sampleRateHz);
    const neuralOnly = request.options?.pollyNeuralOnly === true;
    const startedAt = Date.now();
    const useSSML = !!this.ssmlify && !this.ssmlBlockedVoices.has(voiceId);
    const useNeural = !this.neuralBlockedVoices.has(voiceId);

    let result;

    if (useSSML && useNeural) {
      try {
        const ssmlText = this.ssmlify!(text);
        result = await awsPollyService.synthesizeSpeech({
          text: ssmlText,
          voiceId,
          engine: 'neural',
          outputFormat,
          sampleRate,
          textType: 'ssml',
        });
        return this.toResult(result.audioStream, text, startedAt);
      } catch (e: any) {
        console.warn(`[VoiceCore Polly] SSML+Neural failed for ${voiceId}, caching: ${e.message}`);
        this.ssmlBlockedVoices.add(voiceId);
      }
    }

    if (useNeural || neuralOnly) {
      try {
        result = await awsPollyService.synthesizeSpeech({
          text,
          voiceId,
          engine: 'neural',
          outputFormat,
          sampleRate,
        });
        return this.toResult(result.audioStream, text, startedAt);
      } catch (e: any) {
        if (neuralOnly) throw e;
        console.warn(`[VoiceCore Polly] Neural failed for ${voiceId}, caching: ${e.message}`);
        this.neuralBlockedVoices.add(voiceId);
      }
    }

    result = await awsPollyService.synthesizeSpeech({
      text,
      voiceId,
      engine: 'standard',
      outputFormat,
      sampleRate,
    });
    return this.toResult(result.audioStream, text, startedAt);
  }

  private toResult(audio: Buffer, text: string, startedAt: number): TTSResult {
    return {
      audio,
      providerId: this.id,
      latencyMs: Date.now() - startedAt,
      characters: text.length,
    };
  }
}
