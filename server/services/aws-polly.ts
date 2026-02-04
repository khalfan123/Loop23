import {
  PollyClient,
  SynthesizeSpeechCommand,
  DescribeVoicesCommand,
  Engine,
  OutputFormat,
  VoiceId,
  LanguageCode,
  TextType,
} from "@aws-sdk/client-polly";
import { Readable } from "stream";

export interface PollyVoice {
  id: string;
  name: string;
  gender: string;
  languageCode: string;
  languageName: string;
  supportedEngines: string[];
}

export interface SynthesizeSpeechOptions {
  text: string;
  voiceId: string;
  engine?: "standard" | "neural" | "long-form" | "generative";
  outputFormat?: "mp3" | "ogg_vorbis" | "pcm";
  sampleRate?: string;
  textType?: "text" | "ssml";
  languageCode?: string;
}

export interface SynthesizeSpeechResult {
  audioStream: Buffer;
  contentType: string;
  requestCharacters: number;
}

export class AWSPollyService {
  private client: PollyClient | null = null;

  /**
   * Check if AWS credentials are configured via environment variables
   */
  isConfigured(): boolean {
    return !!(
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY
    );
  }

  private getClient(): PollyClient {
    if (this.client) {
      return this.client;
    }

    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || "us-east-1";

    if (!accessKeyId || !secretAccessKey) {
      throw new Error("AWS credentials not configured. Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION secrets.");
    }

    this.client = new PollyClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    return this.client;
  }

  /**
   * Get a client for a specific region (uses same credentials)
   */
  getClientForRegion(region: string): PollyClient {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
      throw new Error("AWS credentials not configured");
    }

    return new PollyClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async listVoices(
    languageCode?: string,
    engine?: string
  ): Promise<PollyVoice[]> {
    const client = this.getClient();

    const command = new DescribeVoicesCommand({
      LanguageCode: languageCode as LanguageCode | undefined,
      Engine: engine as Engine | undefined,
    });

    const response = await client.send(command);

    return (response.Voices || []).map((voice) => ({
      id: voice.Id || "",
      name: voice.Name || "",
      gender: voice.Gender || "",
      languageCode: voice.LanguageCode || "",
      languageName: voice.LanguageName || "",
      supportedEngines: voice.SupportedEngines || [],
    }));
  }

  async synthesizeSpeech(
    options: SynthesizeSpeechOptions
  ): Promise<SynthesizeSpeechResult> {
    const client = this.getClient();

    const outputFormatMap: Record<string, OutputFormat> = {
      mp3: "mp3",
      ogg_vorbis: "ogg_vorbis",
      pcm: "pcm",
    };

    const command = new SynthesizeSpeechCommand({
      Text: options.text,
      VoiceId: options.voiceId as VoiceId,
      Engine: (options.engine || "neural") as Engine,
      OutputFormat: outputFormatMap[options.outputFormat || "mp3"],
      SampleRate: options.sampleRate || "22050",
      TextType: (options.textType || "text") as TextType,
      LanguageCode: options.languageCode as LanguageCode | undefined,
    });

    const response = await client.send(command);

    if (!response.AudioStream) {
      throw new Error("No audio stream returned from Polly");
    }

    const audioBuffer = await this.streamToBuffer(response.AudioStream as Readable);

    return {
      audioStream: audioBuffer,
      contentType: response.ContentType || "audio/mpeg",
      requestCharacters: response.RequestCharacters || options.text.length,
    };
  }

  async synthesizeSpeechStream(
    options: SynthesizeSpeechOptions
  ): Promise<{ stream: Readable; contentType: string }> {
    const client = this.getClient();

    const outputFormatMap: Record<string, OutputFormat> = {
      mp3: "mp3",
      ogg_vorbis: "ogg_vorbis",
      pcm: "pcm",
    };

    const command = new SynthesizeSpeechCommand({
      Text: options.text,
      VoiceId: options.voiceId as VoiceId,
      Engine: (options.engine || "neural") as Engine,
      OutputFormat: outputFormatMap[options.outputFormat || "mp3"],
      SampleRate: options.sampleRate || "22050",
      TextType: (options.textType || "text") as TextType,
      LanguageCode: options.languageCode as LanguageCode | undefined,
    });

    const response = await client.send(command);

    if (!response.AudioStream) {
      throw new Error("No audio stream returned from Polly");
    }

    return {
      stream: response.AudioStream as Readable,
      contentType: response.ContentType || "audio/mpeg",
    };
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  /**
   * Test AWS credentials by attempting to list voices
   */
  async testCredentials(): Promise<{ success: boolean; message: string }> {
    try {
      const client = this.getClient();
      const command = new DescribeVoicesCommand({ MaxResults: 1 });
      await client.send(command);
      return { success: true, message: "AWS credentials are valid" };
    } catch (error: any) {
      return { success: false, message: error.message || "Invalid AWS credentials" };
    }
  }

  /**
   * Get supported languages with their codes
   */
  getSupportedLanguages(): { code: string; name: string }[] {
    return [
      { code: "arb", name: "Arabic" },
      { code: "ca-ES", name: "Catalan" },
      { code: "cs-CZ", name: "Czech" },
      { code: "cy-GB", name: "Welsh" },
      { code: "da-DK", name: "Danish" },
      { code: "de-AT", name: "German (Austrian)" },
      { code: "de-DE", name: "German" },
      { code: "en-AU", name: "English (Australian)" },
      { code: "en-GB", name: "English (British)" },
      { code: "en-GB-WLS", name: "English (Welsh)" },
      { code: "en-IN", name: "English (Indian)" },
      { code: "en-NZ", name: "English (New Zealand)" },
      { code: "en-US", name: "English (US)" },
      { code: "en-ZA", name: "English (South African)" },
      { code: "es-ES", name: "Spanish (European)" },
      { code: "es-MX", name: "Spanish (Mexican)" },
      { code: "es-US", name: "Spanish (US)" },
      { code: "fi-FI", name: "Finnish" },
      { code: "fr-BE", name: "French (Belgian)" },
      { code: "fr-CA", name: "French (Canadian)" },
      { code: "fr-FR", name: "French" },
      { code: "hi-IN", name: "Hindi" },
      { code: "is-IS", name: "Icelandic" },
      { code: "it-IT", name: "Italian" },
      { code: "ja-JP", name: "Japanese" },
      { code: "ko-KR", name: "Korean" },
      { code: "nb-NO", name: "Norwegian" },
      { code: "nl-BE", name: "Dutch (Belgian)" },
      { code: "nl-NL", name: "Dutch" },
      { code: "pl-PL", name: "Polish" },
      { code: "pt-BR", name: "Portuguese (Brazilian)" },
      { code: "pt-PT", name: "Portuguese (European)" },
      { code: "ro-RO", name: "Romanian" },
      { code: "ru-RU", name: "Russian" },
      { code: "sv-SE", name: "Swedish" },
      { code: "tr-TR", name: "Turkish" },
      { code: "yue-CN", name: "Chinese (Cantonese)" },
      { code: "cmn-CN", name: "Chinese (Mandarin)" },
    ];
  }
}

export const awsPollyService = new AWSPollyService();
