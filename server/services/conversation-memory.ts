'use strict';
import { db } from '../db';
import { callerMemory, calls } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { awsBedrockService, estimateTokenCount } from './aws-bedrock';

export interface CallerFact {
  factKey: string;
  factValue: string;
  category: string;
  confidence: number;
}

export interface CallerContext {
  phoneNumber: string;
  facts: CallerFact[];
  summary: string;
}

const FACT_CATEGORIES = [
  'identity',
  'preference',
  'issue',
  'history',
  'sentiment',
  'general',
] as const;

export class ConversationMemoryService {
  static async extractFactsFromTranscript(
    transcript: string,
    existingFacts: CallerFact[] = []
  ): Promise<CallerFact[]> {
    if (!transcript || transcript.length < 50) {
      return [];
    }

    if (!awsBedrockService.isConfigured()) {
      return this.extractFactsSimple(transcript);
    }

    try {
      const existingContext = existingFacts.length > 0
        ? `\nAlready known facts about this caller:\n${existingFacts.map(f => `- ${f.factKey}: ${f.factValue}`).join('\n')}\n`
        : '';

      const response = await awsBedrockService.invoke({
        model: 'claude-3-5-haiku',
        messages: [{
          role: 'user',
          content: `Extract key facts about the caller from this phone call transcript. Focus on information that would be useful in future calls.
${existingContext}
Return a JSON array of objects with these fields:
- factKey: short identifier (e.g., "caller_name", "preferred_language", "account_number")
- factValue: the actual value
- category: one of "identity", "preference", "issue", "history", "sentiment", "general"
- confidence: 0.0 to 1.0 how confident you are this fact is accurate

Only extract facts that are clearly stated or strongly implied. Do not guess. If the caller corrects a previously known fact, include the updated value with high confidence.

Transcript:
${transcript.substring(0, 15000)}

Return ONLY the JSON array, no other text.`,
        }],
        maxTokens: 2048,
        temperature: 0.1,
      });

      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]) as CallerFact[];
      return parsed.filter(f =>
        f.factKey && f.factValue &&
        FACT_CATEGORIES.includes(f.category as any) &&
        typeof f.confidence === 'number' &&
        f.confidence >= 0.5
      );
    } catch (error: any) {
      console.error(`[ConversationMemory] Fact extraction error:`, error.message);
      return this.extractFactsSimple(transcript);
    }
  }

  private static extractFactsSimple(transcript: string): CallerFact[] {
    const facts: CallerFact[] = [];
    const lower = transcript.toLowerCase();

    const namePatterns = [
      /my name is (\w+(?:\s+\w+)?)/i,
      /this is (\w+(?:\s+\w+)?)/i,
      /i'm (\w+)/i,
      /call me (\w+)/i,
    ];
    for (const pattern of namePatterns) {
      const match = transcript.match(pattern);
      if (match) {
        facts.push({
          factKey: 'caller_name',
          factValue: match[1].trim(),
          category: 'identity',
          confidence: 0.7,
        });
        break;
      }
    }

    if (lower.includes('frustrated') || lower.includes('angry') || lower.includes('upset')) {
      facts.push({
        factKey: 'last_sentiment',
        factValue: 'frustrated',
        category: 'sentiment',
        confidence: 0.6,
      });
    } else if (lower.includes('happy') || lower.includes('pleased') || lower.includes('great')) {
      facts.push({
        factKey: 'last_sentiment',
        factValue: 'positive',
        category: 'sentiment',
        confidence: 0.6,
      });
    }

    return facts;
  }

  static async storeCallerFacts(
    userId: string,
    phoneNumber: string,
    facts: CallerFact[],
    callId?: string
  ): Promise<void> {
    if (!facts.length) return;

    const normalizedPhone = this.normalizePhone(phoneNumber);

    for (const fact of facts) {
      const existing = await db
        .select()
        .from(callerMemory)
        .where(
          and(
            eq(callerMemory.userId, userId),
            eq(callerMemory.phoneNumber, normalizedPhone),
            eq(callerMemory.factKey, fact.factKey)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        if (fact.confidence >= existing[0].confidence) {
          await db
            .update(callerMemory)
            .set({
              factValue: fact.factValue,
              category: fact.category,
              confidence: fact.confidence,
              callId: callId || existing[0].callId,
              updatedAt: new Date(),
            })
            .where(eq(callerMemory.id, existing[0].id));
        }
      } else {
        await db.insert(callerMemory).values({
          userId,
          phoneNumber: normalizedPhone,
          factKey: fact.factKey,
          factValue: fact.factValue,
          category: fact.category,
          confidence: fact.confidence,
          source: 'call_transcript',
          callId: callId || null,
        });
      }
    }

    console.log(`[ConversationMemory] Stored ${facts.length} facts for ${normalizedPhone}`);
  }

  static async getCallerContext(
    userId: string,
    phoneNumber: string
  ): Promise<CallerContext | null> {
    const normalizedPhone = this.normalizePhone(phoneNumber);

    const facts = await db
      .select()
      .from(callerMemory)
      .where(
        and(
          eq(callerMemory.userId, userId),
          eq(callerMemory.phoneNumber, normalizedPhone)
        )
      )
      .orderBy(desc(callerMemory.updatedAt))
      .limit(50);

    if (facts.length === 0) return null;

    const callerFacts: CallerFact[] = facts.map(f => ({
      factKey: f.factKey,
      factValue: f.factValue,
      category: f.category,
      confidence: f.confidence,
    }));

    const summary = this.buildCallerSummary(callerFacts);

    return {
      phoneNumber: normalizedPhone,
      facts: callerFacts,
      summary,
    };
  }

  private static buildCallerSummary(facts: CallerFact[]): string {
    const grouped: Record<string, CallerFact[]> = {};
    for (const fact of facts) {
      if (!grouped[fact.category]) grouped[fact.category] = [];
      grouped[fact.category].push(fact);
    }

    const parts: string[] = [];

    if (grouped.identity?.length) {
      parts.push(
        'Caller identity: ' +
        grouped.identity.map(f => `${f.factKey}: ${f.factValue}`).join(', ')
      );
    }

    if (grouped.preference?.length) {
      parts.push(
        'Preferences: ' +
        grouped.preference.map(f => `${f.factKey}: ${f.factValue}`).join(', ')
      );
    }

    if (grouped.issue?.length) {
      parts.push(
        'Previous issues: ' +
        grouped.issue.map(f => `${f.factKey}: ${f.factValue}`).join(', ')
      );
    }

    if (grouped.history?.length) {
      parts.push(
        'Call history notes: ' +
        grouped.history.map(f => `${f.factKey}: ${f.factValue}`).join(', ')
      );
    }

    if (grouped.sentiment?.length) {
      parts.push(
        'Sentiment: ' +
        grouped.sentiment.map(f => `${f.factValue}`).join(', ')
      );
    }

    if (grouped.general?.length) {
      parts.push(
        'Other info: ' +
        grouped.general.map(f => `${f.factKey}: ${f.factValue}`).join(', ')
      );
    }

    return parts.join('. ');
  }

  static buildCallerContextPrompt(context: CallerContext): string {
    if (!context || context.facts.length === 0) return '';

    return `
# Caller Context (from previous interactions)
This caller has contacted us before. Here is what we know about them:
${context.summary}

Use this information naturally in the conversation:
- Address them by name if known
- Reference their previous interactions when relevant
- Be aware of their preferences and past issues
- Do NOT explicitly tell the caller you have their information on file unless they ask
- Weave this context naturally into your responses`;
  }

  static async processCallTranscript(
    userId: string,
    callId: string,
    phoneNumber: string,
    transcript: string
  ): Promise<number> {
    if (!transcript || !phoneNumber) return 0;

    try {
      const existing = await this.getCallerContext(userId, phoneNumber);
      const existingFacts = existing?.facts || [];

      const newFacts = await this.extractFactsFromTranscript(transcript, existingFacts);
      if (newFacts.length === 0) return 0;

      await this.storeCallerFacts(userId, phoneNumber, newFacts, callId);

      console.log(`[ConversationMemory] Processed call ${callId}: extracted ${newFacts.length} facts`);
      return newFacts.length;
    } catch (error: any) {
      console.error(`[ConversationMemory] Error processing call ${callId}:`, error.message);
      return 0;
    }
  }

  static async deleteCallerMemory(
    userId: string,
    phoneNumber: string
  ): Promise<number> {
    const normalizedPhone = this.normalizePhone(phoneNumber);
    const result = await db
      .delete(callerMemory)
      .where(
        and(
          eq(callerMemory.userId, userId),
          eq(callerMemory.phoneNumber, normalizedPhone)
        )
      )
      .returning();
    return result.length;
  }

  private static normalizePhone(phone: string): string {
    const digits = phone.replace(/[^\d+]/g, '');
    if (digits.startsWith('+')) return digits;
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return digits.startsWith('+') ? digits : `+${digits}`;
  }
}
