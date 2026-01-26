'use strict';
/**
 * Language Replication Service
 * Creates multilingual versions of agents with translated content and matching voices
 */

import OpenAI from 'openai';

// Target languages for replication
export const TARGET_LANGUAGES = [
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
] as const;

// Voice mapping for OpenAI voices by language
// OpenAI voices are language-agnostic but we can suggest appropriate ones
export const OPENAI_VOICE_MAP: Record<string, string> = {
  'zh': 'alloy',    // Neutral for Chinese
  'hi': 'shimmer',  // Friendly for Hindi
  'es': 'coral',    // Warm for Spanish
  'fr': 'sage',     // Calm for French
  'ar': 'ash',      // Authoritative for Arabic
};

// ElevenLabs multilingual voices by language preference
export const ELEVENLABS_VOICE_MAP: Record<string, string[]> = {
  'zh': ['Chinese', 'Mandarin', 'multilingual'],
  'hi': ['Hindi', 'Indian', 'multilingual'],
  'es': ['Spanish', 'Latin', 'Jorge', 'multilingual'],
  'fr': ['French', 'multilingual'],
  'ar': ['Arabic', 'Sahl', 'multilingual'],
};

interface AgentData {
  id: string;
  name: string;
  systemPrompt: string;
  firstMessage: string;
  language: string;
  type: string;
  voiceTone?: string;
  personality?: string;
  elevenLabsVoiceId?: string;
  openaiVoice?: string;
  telephonyProvider?: string;
  llmModel?: string;
  temperature?: number;
  knowledgeBaseIds?: string[];
  transferEnabled?: boolean;
  transferPhoneNumber?: string;
  detectLanguageEnabled?: boolean;
  endConversationEnabled?: boolean;
  appointmentBookingEnabled?: boolean;
  voiceStability?: number;
  voiceSimilarityBoost?: number;
  voiceSpeed?: number;
  specialist?: string;
  tags?: string[];
}

interface TranslatedContent {
  name: string;
  systemPrompt: string;
  firstMessage: string;
}

interface LanguageVariant extends TranslatedContent {
  languageCode: string;
  languageName: string;
  openaiVoice: string;
  elevenLabsVoiceId?: string;
}

export class LanguageReplicationService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI();
  }

  /**
   * Translate content to a target language using OpenAI
   */
  async translateContent(
    content: { name: string; systemPrompt: string; firstMessage: string },
    targetLanguage: { code: string; name: string; nativeName: string }
  ): Promise<TranslatedContent> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the following content to ${targetLanguage.name} (${targetLanguage.nativeName}). 
            
Maintain the same tone, intent, and professional quality. For the agent name, create a culturally appropriate name in ${targetLanguage.name}.

Respond with a JSON object containing:
- name: The translated/localized agent name (use a common ${targetLanguage.name} name that fits the role)
- systemPrompt: The fully translated system prompt
- firstMessage: The fully translated first message greeting

Only respond with the JSON object, no additional text.`
          },
          {
            role: 'user',
            content: JSON.stringify({
              name: content.name,
              systemPrompt: content.systemPrompt,
              firstMessage: content.firstMessage
            })
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        name: result.name || `${content.name} (${targetLanguage.nativeName})`,
        systemPrompt: result.systemPrompt || content.systemPrompt,
        firstMessage: result.firstMessage || content.firstMessage
      };
    } catch (error) {
      console.error(`Translation error for ${targetLanguage.name}:`, error);
      // Fallback: append language indicator to original content
      return {
        name: `${content.name} (${targetLanguage.nativeName})`,
        systemPrompt: content.systemPrompt,
        firstMessage: content.firstMessage
      };
    }
  }

  /**
   * Find the best matching ElevenLabs voice for a language
   */
  findMatchingElevenLabsVoice(
    voices: Array<{ voice_id: string; name: string; labels?: Record<string, string> }>,
    languageCode: string
  ): string | undefined {
    const preferences = ELEVENLABS_VOICE_MAP[languageCode] || ['multilingual'];
    
    // Try to find a voice matching the language preferences
    for (const pref of preferences) {
      const match = voices.find(v => 
        v.name.toLowerCase().includes(pref.toLowerCase()) ||
        (v.labels?.language && v.labels.language.toLowerCase().includes(pref.toLowerCase()))
      );
      if (match) return match.voice_id;
    }

    // Fallback to first available voice
    return voices[0]?.voice_id;
  }

  /**
   * Generate all language variants for an agent
   */
  async generateLanguageVariants(
    agent: AgentData,
    availableVoices?: Array<{ voice_id: string; name: string; labels?: Record<string, string> }>
  ): Promise<LanguageVariant[]> {
    const variants: LanguageVariant[] = [];

    for (const lang of TARGET_LANGUAGES) {
      console.log(`Translating agent "${agent.name}" to ${lang.name}...`);
      
      const translated = await this.translateContent(
        {
          name: agent.name,
          systemPrompt: agent.systemPrompt || '',
          firstMessage: agent.firstMessage || 'Hello! How can I help you today?'
        },
        lang
      );

      const variant: LanguageVariant = {
        ...translated,
        languageCode: lang.code,
        languageName: lang.name,
        openaiVoice: OPENAI_VOICE_MAP[lang.code] || 'alloy',
        elevenLabsVoiceId: availableVoices 
          ? this.findMatchingElevenLabsVoice(availableVoices, lang.code)
          : undefined
      };

      variants.push(variant);
    }

    return variants;
  }

  /**
   * Create agent data for a language variant
   */
  createVariantAgentData(
    originalAgent: AgentData,
    variant: LanguageVariant
  ): Omit<AgentData, 'id'> {
    return {
      name: variant.name,
      type: originalAgent.type,
      systemPrompt: variant.systemPrompt,
      firstMessage: variant.firstMessage,
      language: variant.languageCode,
      voiceTone: originalAgent.voiceTone,
      personality: originalAgent.personality,
      elevenLabsVoiceId: variant.elevenLabsVoiceId || originalAgent.elevenLabsVoiceId,
      openaiVoice: variant.openaiVoice,
      telephonyProvider: originalAgent.telephonyProvider,
      llmModel: originalAgent.llmModel,
      temperature: originalAgent.temperature,
      knowledgeBaseIds: originalAgent.knowledgeBaseIds,
      transferEnabled: originalAgent.transferEnabled,
      transferPhoneNumber: originalAgent.transferPhoneNumber,
      detectLanguageEnabled: originalAgent.detectLanguageEnabled,
      endConversationEnabled: originalAgent.endConversationEnabled,
      appointmentBookingEnabled: originalAgent.appointmentBookingEnabled,
      voiceStability: originalAgent.voiceStability,
      voiceSimilarityBoost: originalAgent.voiceSimilarityBoost,
      voiceSpeed: originalAgent.voiceSpeed,
      specialist: originalAgent.specialist,
      tags: [...(originalAgent.tags || []), variant.languageName.toLowerCase()],
    };
  }
}

export const languageReplicationService = new LanguageReplicationService();
