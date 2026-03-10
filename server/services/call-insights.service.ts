'use strict';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { AWSBedrockService } from './aws-bedrock';
import { logger } from '../utils/logger';

export interface CallInsights {
  aiSummary: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  classification: 'hot' | 'warm' | 'cold' | 'lost';
  keyPoints?: string[];
  nextActions?: string[];
}

export interface CallMetadata {
  callId: string;
  fromNumber?: string;
  toNumber?: string;
  agentName?: string;
  duration?: number;
}

const SYSTEM_PROMPT = `You are an AI call analyst. Analyze the following call transcript and provide structured insights.

Respond ONLY with valid JSON in this exact format:
{
  "aiSummary": "2-3 sentence summary of the call conversation and outcome",
  "sentiment": "positive" | "neutral" | "negative",
  "classification": "hot" | "warm" | "cold" | "lost",
  "keyPoints": ["key point 1", "key point 2"],
  "nextActions": ["recommended action 1", "recommended action 2"]
}

Classification guide:
- "hot": Caller showed strong interest, ready to buy/proceed
- "warm": Caller showed moderate interest, needs follow-up
- "cold": Caller showed little interest, unlikely to convert
- "lost": Caller explicitly declined or hung up early

Sentiment guide:
- "positive": Friendly tone, expressed satisfaction
- "neutral": Professional/matter-of-fact tone
- "negative": Frustrated, complained, or was hostile`;

export class CallInsightsService {
  private static openai: OpenAI | null = null;
  private static bedrockService = new AWSBedrockService();

  private static getOpenAIClient(apiKey?: string): OpenAI | null {
    if (apiKey) {
      return new OpenAI({ apiKey });
    }
    
    if (!this.openai) {
      const envApiKey = process.env.OPENAI_API_KEY;
      if (!envApiKey) {
        return null;
      }
      this.openai = new OpenAI({ apiKey: envApiKey });
    }
    return this.openai;
  }

  static async analyzeTranscript(
    transcript: string,
    metadata: CallMetadata,
    apiKey?: string
  ): Promise<CallInsights | null> {
    const source = 'CallInsightsService';
    
    if (!transcript || transcript.trim().length === 0) {
      logger.warn('Empty transcript provided for analysis', { callId: metadata.callId }, source);
      return null;
    }

    const userMessage = this.buildUserMessage(transcript, metadata);
    
    logger.info(`Analyzing transcript for call ${metadata.callId}`, {
      transcriptLength: transcript.length,
      duration: metadata.duration
    }, source);

    const openai = this.getOpenAIClient(apiKey);
    if (openai) {
      try {
        const result = await this.analyzeWithOpenAI(openai, userMessage, metadata.callId);
        if (result) return result;
      } catch (error: any) {
        logger.warn(`OpenAI analysis failed for call ${metadata.callId}, trying fallbacks`, {
          error: error.message
        }, source);
      }
    }

    try {
      const anthropic = new Anthropic();
      const result = await this.analyzeWithAnthropic(anthropic, userMessage, metadata.callId);
      if (result) return result;
    } catch (error: any) {
      logger.warn(`Anthropic analysis failed for call ${metadata.callId}, trying Bedrock`, {
        error: error.message
      }, source);
    }

    if (this.bedrockService.isConfigured()) {
      try {
        const result = await this.analyzeWithBedrock(userMessage, metadata.callId);
        if (result) return result;
      } catch (error: any) {
        logger.error(`Bedrock analysis failed for call ${metadata.callId}`, {
          error: error.message
        }, source);
      }
    }

    logger.error(`All AI providers failed for call ${metadata.callId}`, undefined, source);
    return null;
  }

  private static async analyzeWithOpenAI(
    openai: OpenAI,
    userMessage: string,
    callId: string
  ): Promise<CallInsights | null> {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 500,
      temperature: 0.3
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const insights = JSON.parse(content) as CallInsights;
    if (!this.validateInsights(insights)) return null;

    logger.info(`OpenAI analyzed call ${callId}`, {
      sentiment: insights.sentiment,
      classification: insights.classification
    }, 'CallInsightsService');

    return insights;
  }

  private static async analyzeWithAnthropic(
    anthropic: Anthropic,
    userMessage: string,
    callId: string
  ): Promise<CallInsights | null> {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: userMessage }
      ],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    const content = textBlock?.type === 'text' ? textBlock.text : null;
    if (!content) return null;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const insights = JSON.parse(jsonMatch[0]) as CallInsights;
    if (!this.validateInsights(insights)) return null;

    logger.info(`Anthropic analyzed call ${callId}`, {
      sentiment: insights.sentiment,
      classification: insights.classification
    }, 'CallInsightsService');

    return insights;
  }

  private static async analyzeWithBedrock(
    userMessage: string,
    callId: string
  ): Promise<CallInsights | null> {
    const response = await this.bedrockService.invoke({
      model: 'claude-sonnet-4-6',
      systemPrompt: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 500,
      temperature: 0.3,
    });

    const content = response.content;
    if (!content) return null;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const insights = JSON.parse(jsonMatch[0]) as CallInsights;
    if (!this.validateInsights(insights)) return null;

    logger.info(`Bedrock analyzed call ${callId}`, {
      sentiment: insights.sentiment,
      classification: insights.classification
    }, 'CallInsightsService');

    return insights;
  }

  private static buildUserMessage(transcript: string, metadata: CallMetadata): string {
    let message = '';
    
    if (metadata.agentName) {
      message += `Agent: ${metadata.agentName}\n`;
    }
    if (metadata.fromNumber) {
      message += `Caller: ${metadata.fromNumber}\n`;
    }
    if (metadata.duration) {
      message += `Duration: ${Math.floor(metadata.duration / 60)}m ${metadata.duration % 60}s\n`;
    }
    if (message) {
      message += '\n';
    }
    
    message += `Transcript:\n${transcript}`;
    
    return message;
  }

  private static validateInsights(insights: any): insights is CallInsights {
    if (!insights || typeof insights !== 'object') {
      return false;
    }
    
    if (typeof insights.aiSummary !== 'string' || insights.aiSummary.length === 0) {
      return false;
    }
    
    const validSentiments = ['positive', 'neutral', 'negative'];
    if (!validSentiments.includes(insights.sentiment)) {
      return false;
    }
    
    const validClassifications = ['hot', 'warm', 'cold', 'lost'];
    if (!validClassifications.includes(insights.classification)) {
      return false;
    }
    
    if (insights.keyPoints !== undefined && !Array.isArray(insights.keyPoints)) {
      return false;
    }
    
    if (insights.nextActions !== undefined && !Array.isArray(insights.nextActions)) {
      return false;
    }
    
    return true;
  }
}
