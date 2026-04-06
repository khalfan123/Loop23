import Cartesia from "@cartesia/cartesia-js";
import type { TTSGenerateParams, GenerationConfig, RawEncoding } from "@cartesia/cartesia-js/resources/tts/tts";

export interface CartesiaVoice {
  id: string;
  name: string;
  description: string;
  language: string;
  gender?: string;
  isPublic: boolean;
}

export interface CartesiaSynthesisOptions {
  text: string;
  voiceId: string;
  modelId?: string;
  language?: string;
  sampleRate?: 8000 | 16000 | 22050 | 24000 | 44100 | 48000;
  speed?: number;
  emotion?: GenerationConfig['emotion'];
  outputContainer?: 'raw' | 'wav';
}

export interface CartesiaSynthesisResult {
  audioStream: Buffer;
  contentType: string;
}

export class CartesiaTTSService {
  private client: Cartesia | null = null;

  isConfigured(): boolean {
    return !!process.env.CARTESIA_API_KEY;
  }

  private getClient(): Cartesia {
    if (this.client) return this.client;
    const apiKey = process.env.CARTESIA_API_KEY;
    if (!apiKey) {
      throw new Error("CARTESIA_API_KEY not configured. Please set it in environment secrets.");
    }
    this.client = new Cartesia({ apiKey });
    return this.client;
  }

  async listVoices(): Promise<CartesiaVoice[]> {
    const client = this.getClient();
    const voices: CartesiaVoice[] = [];
    for await (const voice of client.voices.list()) {
      voices.push({
        id: voice.id,
        name: voice.name || "Unknown",
        description: voice.description || "",
        language: voice.language || "en",
        gender: voice.gender || undefined,
        isPublic: voice.is_public ?? true,
      });
    }
    return voices;
  }

  async synthesizeSpeech(
    options: CartesiaSynthesisOptions
  ): Promise<CartesiaSynthesisResult> {
    const client = this.getClient();

    const container = options.outputContainer || 'raw';
    const sampleRate = options.sampleRate || 8000;

    const generationConfig: GenerationConfig = {};
    if (options.speed && options.speed !== 1.0) {
      generationConfig.speed = options.speed;
    }
    if (options.emotion) {
      generationConfig.emotion = options.emotion;
    }

    const lang = options.language || "en";
    const modelId = options.modelId || "sonic-3";

    const params: TTSGenerateParams = {
      model_id: modelId,
      transcript: options.text,
      voice: { mode: "id" as const, id: options.voiceId },
      output_format: {
        container: container as 'raw',
        encoding: "pcm_s16le" as RawEncoding,
        sample_rate: sampleRate,
      },
      language: lang as TTSGenerateParams['language'],
      ...(Object.keys(generationConfig).length > 0 ? { generation_config: generationConfig } : {}),
    };

    const response = await client.tts.generate(params);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    return {
      audioStream: audioBuffer,
      contentType: container === 'wav' ? "audio/wav" : "audio/pcm",
    };
  }

  async testCredentials(): Promise<{ success: boolean; message: string }> {
    try {
      const client = this.getClient();
      const voices = client.voices.list();
      await voices[Symbol.asyncIterator]().next();
      return { success: true, message: "Cartesia API key is valid" };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Invalid Cartesia API key";
      return { success: false, message };
    }
  }

  getSupportedLanguages(): { code: string; name: string }[] {
    return [
      { code: "en", name: "English" },
      { code: "es", name: "Spanish" },
      { code: "fr", name: "French" },
      { code: "de", name: "German" },
      { code: "pt", name: "Portuguese" },
      { code: "zh", name: "Chinese" },
      { code: "ja", name: "Japanese" },
      { code: "ko", name: "Korean" },
      { code: "hi", name: "Hindi" },
      { code: "it", name: "Italian" },
      { code: "pl", name: "Polish" },
      { code: "tr", name: "Turkish" },
      { code: "ru", name: "Russian" },
      { code: "nl", name: "Dutch" },
      { code: "sv", name: "Swedish" },
      { code: "ar", name: "Arabic" },
    ];
  }
}

export const cartesiaTTSService = new CartesiaTTSService();
