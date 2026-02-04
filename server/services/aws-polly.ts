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
import { db } from "../db";
import { awsCredentials } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import type { AwsCredential } from "@shared/schema";
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
  private credential: AwsCredential | null = null;

  private async getClient(): Promise<PollyClient> {
    if (this.client && this.credential) {
      return this.client;
    }

    const [credential] = await db
      .select()
      .from(awsCredentials)
      .where(
        and(
          eq(awsCredentials.isActive, true),
          eq(awsCredentials.isPrimary, true)
        )
      )
      .limit(1);

    if (!credential) {
      const [anyCredential] = await db
        .select()
        .from(awsCredentials)
        .where(eq(awsCredentials.isActive, true))
        .limit(1);

      if (!anyCredential) {
        throw new Error("No active AWS credentials found");
      }
      this.credential = anyCredential;
    } else {
      this.credential = credential;
    }

    this.client = new PollyClient({
      region: this.credential.region,
      credentials: {
        accessKeyId: this.credential.accessKeyId,
        secretAccessKey: this.credential.secretAccessKey,
      },
    });

    return this.client;
  }

  async getCredentialById(credentialId: string): Promise<AwsCredential | null> {
    const [credential] = await db
      .select()
      .from(awsCredentials)
      .where(eq(awsCredentials.id, credentialId))
      .limit(1);

    return credential || null;
  }

  async getClientForCredential(credentialId: string): Promise<PollyClient> {
    const credential = await this.getCredentialById(credentialId);
    if (!credential) {
      throw new Error(`AWS credential not found: ${credentialId}`);
    }

    return new PollyClient({
      region: credential.region,
      credentials: {
        accessKeyId: credential.accessKeyId,
        secretAccessKey: credential.secretAccessKey,
      },
    });
  }

  async listVoices(
    languageCode?: string,
    engine?: string,
    credentialId?: string
  ): Promise<PollyVoice[]> {
    const client = credentialId
      ? await this.getClientForCredential(credentialId)
      : await this.getClient();

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
    options: SynthesizeSpeechOptions,
    credentialId?: string
  ): Promise<SynthesizeSpeechResult> {
    const client = credentialId
      ? await this.getClientForCredential(credentialId)
      : await this.getClient();

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
    options: SynthesizeSpeechOptions,
    credentialId?: string
  ): Promise<{ stream: Readable; contentType: string }> {
    const client = credentialId
      ? await this.getClientForCredential(credentialId)
      : await this.getClient();

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

  async testCredentials(
    accessKeyId: string,
    secretAccessKey: string,
    region: string
  ): Promise<boolean> {
    try {
      const testClient = new PollyClient({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });

      const command = new DescribeVoicesCommand({
        Engine: "neural",
      });

      await testClient.send(command);
      console.log("✅ AWS Polly credentials validated successfully");
      return true;
    } catch (error) {
      console.error("❌ AWS Polly credentials validation failed:", error);
      return false;
    }
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async getAvailableLanguages(credentialId?: string): Promise<
    Array<{
      code: string;
      name: string;
      voiceCount: number;
    }>
  > {
    const voices = await this.listVoices(undefined, undefined, credentialId);

    const languageMap = new Map<string, { name: string; count: number }>();

    for (const voice of voices) {
      const existing = languageMap.get(voice.languageCode);
      if (existing) {
        existing.count++;
      } else {
        languageMap.set(voice.languageCode, {
          name: voice.languageName,
          count: 1,
        });
      }
    }

    return Array.from(languageMap.entries()).map(([code, data]) => ({
      code,
      name: data.name,
      voiceCount: data.count,
    }));
  }
}

export const awsPollyService = new AWSPollyService();
