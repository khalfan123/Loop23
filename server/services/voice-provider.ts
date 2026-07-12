import { awsPollyService, SynthesizeSpeechOptions } from './aws-polly';
import { Readable } from 'stream';

export type VoiceProvider = 'elevenlabs' | 'aws_polly' | 'openai';

export interface VoiceProviderConfig {
  provider: VoiceProvider;
  credentialId?: string;
  voiceId: string;
  language?: string;
  options?: Record<string, any>;
}

export interface VoiceSynthesisResult {
  audioStream: Buffer;
  contentType: string;
  provider: VoiceProvider;
  charactersUsed?: number;
}

export interface VoiceInfo {
  id: string;
  name: string;
  gender?: string;
  language?: string;
  languageCode?: string;
  provider: VoiceProvider;
  previewUrl?: string;
  supportedEngines?: string[];
}

export class VoiceProviderService {
  async synthesizeSpeech(
    text: string,
    config: VoiceProviderConfig
  ): Promise<VoiceSynthesisResult> {
    switch (config.provider) {
      case 'aws_polly':
        return this.synthesizeWithPolly(text, config);
      case 'elevenlabs':
        return this.synthesizeWithElevenLabs(text, config);
      case 'openai':
        return this.synthesizeWithOpenAI(text, config);
      default:
        throw new Error(`Unsupported voice provider: ${config.provider}`);
    }
  }

  private async synthesizeWithPolly(
    text: string,
    config: VoiceProviderConfig
  ): Promise<VoiceSynthesisResult> {
    const options: SynthesizeSpeechOptions = {
      text,
      voiceId: config.voiceId,
      engine: (config.options?.engine as 'standard' | 'neural' | 'long-form' | 'generative') || 'neural',
      outputFormat: (config.options?.outputFormat as 'mp3' | 'ogg_vorbis' | 'pcm') || 'mp3',
      languageCode: config.language,
    };

    const result = await awsPollyService.synthesizeSpeech(options, config.credentialId);

    return {
      audioStream: result.audioStream,
      contentType: result.contentType,
      provider: 'aws_polly',
      charactersUsed: result.requestCharacters,
    };
  }

  private async synthesizeWithElevenLabs(
    text: string,
    config: VoiceProviderConfig
  ): Promise<VoiceSynthesisResult> {
    const { ElevenLabsService } = await import('./elevenlabs');
    
    const elevenLabsService = new ElevenLabsService();
    const apiKey = config.options?.apiKey;
    
    if (!apiKey) {
      throw new Error('ElevenLabs API key is required');
    }

    const audioBuffer = await elevenLabsService.generateSpeech(text, config.voiceId, apiKey);

    return {
      audioStream: audioBuffer,
      contentType: 'audio/mpeg',
      provider: 'elevenlabs',
    };
  }

  private async synthesizeWithOpenAI(
    text: string,
    config: VoiceProviderConfig
  ): Promise<VoiceSynthesisResult> {
    const openAIApiKey = config.options?.apiKey || process.env.OPENAI_API_KEY;
    
    if (!openAIApiKey) {
      throw new Error('OpenAI API key is required for TTS');
    }

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.options?.model || 'tts-1',
        input: text,
        voice: config.voiceId || 'alloy',
        response_format: config.options?.format || 'mp3',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI TTS failed: ${error}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    return {
      audioStream: audioBuffer,
      contentType: 'audio/mpeg',
      provider: 'openai',
    };
  }

  async listVoices(
    provider: VoiceProvider,
    credentialId?: string,
    options?: Record<string, any>
  ): Promise<VoiceInfo[]> {
    switch (provider) {
      case 'aws_polly':
        return this.listPollyVoices(credentialId, options);
      case 'elevenlabs':
        return this.listElevenLabsVoices(options?.apiKey);
      case 'openai':
        return this.listOpenAIVoices();
      default:
        throw new Error(`Unsupported voice provider: ${provider}`);
    }
  }

  private async listPollyVoices(
    credentialId?: string,
    options?: Record<string, any>
  ): Promise<VoiceInfo[]> {
    const voices = await awsPollyService.listVoices(
      options?.languageCode,
      options?.engine,
      credentialId
    );

    return voices.map((voice) => ({
      id: voice.id,
      name: voice.name,
      gender: voice.gender,
      language: voice.languageName,
      languageCode: voice.languageCode,
      provider: 'aws_polly' as VoiceProvider,
      supportedEngines: voice.supportedEngines,
    }));
  }

  private async listElevenLabsVoices(apiKey?: string): Promise<VoiceInfo[]> {
    if (!apiKey) {
      return [];
    }

    try {
      const response = await fetch('https://api.elevenlabs.io/v2/voices?page_size=100', {
        headers: {
          'xi-api-key': apiKey,
        },
      });

      if (!response.ok) {
        console.error('Failed to fetch ElevenLabs voices');
        return [];
      }

      const data = await response.json();
      return (data.voices || []).map((voice: any) => ({
        id: voice.voice_id,
        name: voice.name,
        gender: voice.labels?.gender,
        language: voice.labels?.language,
        provider: 'elevenlabs' as VoiceProvider,
        previewUrl: voice.preview_url,
      }));
    } catch (error) {
      console.error('Error fetching ElevenLabs voices:', error);
      return [];
    }
  }

  private listOpenAIVoices(): VoiceInfo[] {
    const openAIVoices = [
      { id: 'alloy', name: 'Alloy', gender: 'neutral' },
      { id: 'echo', name: 'Echo', gender: 'male' },
      { id: 'fable', name: 'Fable', gender: 'neutral' },
      { id: 'onyx', name: 'Onyx', gender: 'male' },
      { id: 'nova', name: 'Nova', gender: 'female' },
      { id: 'shimmer', name: 'Shimmer', gender: 'female' },
      { id: 'ash', name: 'Ash', gender: 'neutral' },
      { id: 'ballad', name: 'Ballad', gender: 'neutral' },
      { id: 'coral', name: 'Coral', gender: 'female' },
      { id: 'sage', name: 'Sage', gender: 'neutral' },
      { id: 'verse', name: 'Verse', gender: 'neutral' },
    ];

    return openAIVoices.map((voice) => ({
      ...voice,
      provider: 'openai' as VoiceProvider,
      language: 'English',
      languageCode: 'en',
    }));
  }

  async getProviderLanguages(
    provider: VoiceProvider,
    credentialId?: string
  ): Promise<Array<{ code: string; name: string; voiceCount: number }>> {
    switch (provider) {
      case 'aws_polly':
        return awsPollyService.getAvailableLanguages(credentialId);
      case 'elevenlabs':
        return [
          { code: 'en', name: 'English', voiceCount: 50 },
          { code: 'es', name: 'Spanish', voiceCount: 20 },
          { code: 'fr', name: 'French', voiceCount: 15 },
          { code: 'de', name: 'German', voiceCount: 15 },
          { code: 'it', name: 'Italian', voiceCount: 10 },
          { code: 'pt', name: 'Portuguese', voiceCount: 10 },
          { code: 'pl', name: 'Polish', voiceCount: 8 },
          { code: 'hi', name: 'Hindi', voiceCount: 8 },
          { code: 'ja', name: 'Japanese', voiceCount: 5 },
          { code: 'ko', name: 'Korean', voiceCount: 5 },
          { code: 'zh', name: 'Chinese', voiceCount: 5 },
          { code: 'ar', name: 'Arabic', voiceCount: 5 },
        ];
      case 'openai':
        return [
          { code: 'en', name: 'English', voiceCount: 11 },
        ];
      default:
        return [];
    }
  }

  getProviderInfo(): Array<{
    id: VoiceProvider;
    name: string;
    description: string;
    features: string[];
    tier: 'budget' | 'standard' | 'premium';
  }> {
    return [
      {
        id: 'aws_polly',
        name: 'AWS Polly',
        description: 'Cost-effective, high-quality neural and generative voices from Amazon',
        features: [
          '100+ voices in 40+ languages',
          'Neural and generative engines',
          'SSML support',
          'Low latency streaming',
          'Pay-per-character pricing',
        ],
        tier: 'budget',
      },
      {
        id: 'elevenlabs',
        name: 'ElevenLabs',
        description: 'Premium AI voices with voice cloning and ultra-realistic synthesis',
        features: [
          'Voice cloning capability',
          'Ultra-realistic voices',
          '29+ languages',
          'Voice stability controls',
          'Professional studio quality',
        ],
        tier: 'premium',
      },
      {
        id: 'openai',
        name: 'OpenAI TTS',
        description: 'Fast and natural text-to-speech from OpenAI',
        features: [
          '11 distinct voices',
          'HD quality option',
          'Fast inference',
          'Simple integration',
          'Works with OpenAI ecosystem',
        ],
        tier: 'standard',
      },
    ];
  }
}

export const voiceProviderService = new VoiceProviderService();
