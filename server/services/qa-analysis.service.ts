'use strict';

import OpenAI from 'openai';
import { db } from '../db';
import { calls, callQaAnalyses, agents } from '@shared/schema';
import { eq, and, desc, sql, gte, lte, count } from 'drizzle-orm';
import { logger } from '../utils/logger';
import type { InsertCallQaAnalysis, CallQaAnalysis } from '@shared/schema';

export interface QaAnalysisResult {
  overallScore: number;
  audioQualityScore: number;
  languageScore: number;
  complianceScore: number;
  performanceScore: number;
  resolutionStatus: 'resolved' | 'unresolved' | 'partial' | 'transferred';
  resolutionNotes: string;
  avgResponseLatency: number;
  maxResponseLatency: number;
  hasHallucinations: boolean;
  hasInterruptions: boolean;
  hasNegativeSentiment: boolean;
  hasComplianceIssues: boolean;
  hasKbInaccuracies: boolean;
  diagnostics: {
    hallucinations: Array<{ text: string; context: string }>;
    interruptions: Array<{ timestamp: number; description: string }>;
    sentimentBreakdown: { positive: number; neutral: number; negative: number };
    complianceIssues: Array<{ issue: string; severity: string }>;
  };
  keyMoments: Array<{ timestamp: number; type: string; description: string }>;
  evidence: Array<{ transcriptIndex: number; issue: string; severity: string }>;
}

const QA_SYSTEM_PROMPT = `You are an AI Quality Assurance analyst for voice calls. Analyze the call transcript and provide a comprehensive quality assessment.

Respond ONLY with valid JSON in this exact format:
{
  "overallScore": <0-100>,
  "audioQualityScore": <0-100>,
  "languageScore": <0-100>,
  "complianceScore": <0-100>,
  "performanceScore": <0-100>,
  "resolutionStatus": "resolved" | "unresolved" | "partial" | "transferred",
  "resolutionNotes": "<brief explanation of resolution status>",
  "avgResponseLatency": <estimated avg response time in ms, 0 if unknown>,
  "maxResponseLatency": <estimated max response time in ms, 0 if unknown>,
  "hasHallucinations": <boolean - did AI make up false information?>,
  "hasInterruptions": <boolean - were there frequent interruptions?>,
  "hasNegativeSentiment": <boolean - was customer sentiment negative?>,
  "hasComplianceIssues": <boolean - any compliance/script violations?>,
  "hasKbInaccuracies": <boolean - knowledge base accuracy issues?>,
  "diagnostics": {
    "hallucinations": [{"text": "<false statement>", "context": "<surrounding context>"}],
    "interruptions": [{"timestamp": 0, "description": "<description>"}],
    "sentimentBreakdown": {"positive": <0-100>, "neutral": <0-100>, "negative": <0-100>},
    "complianceIssues": [{"issue": "<issue description>", "severity": "low|medium|high"}]
  },
  "keyMoments": [{"timestamp": 0, "type": "positive|negative|neutral", "description": "<key moment>"}],
  "evidence": [{"transcriptIndex": 0, "issue": "<issue found>", "severity": "low|medium|high"}]
}

Scoring Guidelines:
- 90-100: Excellent - exceeds expectations
- 70-89: Good - meets expectations
- 50-69: Needs improvement
- 0-49: Poor - requires immediate attention

Focus on:
1. Audio Quality: Speech clarity, background noise, volume levels
2. Language: Grammar, vocabulary, professionalism, courtesy
3. Compliance: Script adherence, required disclosures, proper greetings/closings
4. Performance: Goal achievement, call efficiency, problem resolution`;

export class QaAnalysisService {
  private static openai: OpenAI | null = null;

  private static getOpenAIClient(apiKey?: string): OpenAI {
    if (apiKey) {
      return new OpenAI({ apiKey });
    }
    if (!this.openai) {
      const envApiKey = process.env.OPENAI_API_KEY;
      if (!envApiKey) {
        throw new Error('OPENAI_API_KEY environment variable is not set');
      }
      this.openai = new OpenAI({ apiKey: envApiKey });
    }
    return this.openai;
  }

  static async analyzeCall(
    callId: string,
    userId: string,
    apiKey?: string
  ): Promise<CallQaAnalysis | null> {
    const source = 'QaAnalysisService';

    const [call] = await db
      .select()
      .from(calls)
      .where(eq(calls.id, callId))
      .limit(1);

    if (!call) {
      logger.warn(`Call not found: ${callId}`, {}, source);
      return null;
    }

    if (!call.transcript || call.transcript.trim().length === 0) {
      logger.warn(`No transcript available for call: ${callId}`, {}, source);
      return null;
    }

    try {
      const openai = this.getOpenAIClient(apiKey);

      const userMessage = `Analyze this call transcript:

Call ID: ${callId}
Duration: ${call.duration || 'Unknown'} seconds
Direction: ${call.callDirection}
Status: ${call.status}

Transcript:
${call.transcript}

${call.aiSummary ? `AI Summary: ${call.aiSummary}` : ''}
${call.sentiment ? `Current Sentiment: ${call.sentiment}` : ''}`;

      logger.info(`Analyzing QA for call ${callId}`, {
        transcriptLength: call.transcript.length,
        duration: call.duration
      }, source);

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: QA_SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2000,
        temperature: 0.3
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        logger.error(`Empty response from OpenAI for call ${callId}`, {}, source);
        return null;
      }

      const analysis: QaAnalysisResult = JSON.parse(content);

      const qaData: InsertCallQaAnalysis = {
        callId,
        userId,
        overallScore: analysis.overallScore,
        audioQualityScore: analysis.audioQualityScore,
        languageScore: analysis.languageScore,
        complianceScore: analysis.complianceScore,
        performanceScore: analysis.performanceScore,
        resolutionStatus: analysis.resolutionStatus,
        resolutionNotes: analysis.resolutionNotes,
        avgResponseLatency: analysis.avgResponseLatency,
        maxResponseLatency: analysis.maxResponseLatency,
        hasHallucinations: analysis.hasHallucinations,
        hasInterruptions: analysis.hasInterruptions,
        hasNegativeSentiment: analysis.hasNegativeSentiment,
        hasComplianceIssues: analysis.hasComplianceIssues,
        hasKbInaccuracies: analysis.hasKbInaccuracies,
        diagnostics: analysis.diagnostics,
        keyMoments: analysis.keyMoments,
        evidence: analysis.evidence,
        analysisModel: 'gpt-4o-mini',
        analysisVersion: '1.0',
        analyzedAt: new Date()
      };

      const [savedAnalysis] = await db
        .insert(callQaAnalyses)
        .values(qaData)
        .returning();

      logger.info(`QA analysis saved for call ${callId}`, {
        overallScore: analysis.overallScore,
        resolutionStatus: analysis.resolutionStatus
      }, source);

      return savedAnalysis;
    } catch (error: any) {
      logger.error(`QA analysis failed for call ${callId}`, {
        error: error.message
      }, source);
      return null;
    }
  }

  static async getAnalysis(callId: string): Promise<CallQaAnalysis | null> {
    const [analysis] = await db
      .select()
      .from(callQaAnalyses)
      .where(eq(callQaAnalyses.callId, callId))
      .limit(1);

    return analysis || null;
  }

  static async getDashboardStats(userId: string, startDate?: Date, endDate?: Date) {
    const conditions = [eq(callQaAnalyses.userId, userId)];
    
    if (startDate) {
      conditions.push(gte(callQaAnalyses.analyzedAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(callQaAnalyses.analyzedAt, endDate));
    }

    const analyses = await db
      .select()
      .from(callQaAnalyses)
      .where(and(...conditions))
      .orderBy(desc(callQaAnalyses.analyzedAt));

    if (analyses.length === 0) {
      return {
        totalAnalyzed: 0,
        averageScore: 0,
        resolutionRate: 0,
        issueBreakdown: {
          hallucinations: 0,
          interruptions: 0,
          negativeSentiment: 0,
          complianceIssues: 0,
          kbInaccuracies: 0
        },
        scoreTrend: [],
        recentAnalyses: []
      };
    }

    const totalAnalyzed = analyses.length;
    const averageScore = Math.round(
      analyses.reduce((sum, a) => sum + (a.overallScore || 0), 0) / totalAnalyzed
    );
    const resolvedCount = analyses.filter(
      a => a.resolutionStatus === 'resolved'
    ).length;
    const resolutionRate = Math.round((resolvedCount / totalAnalyzed) * 100);

    const issueBreakdown = {
      hallucinations: analyses.filter(a => a.hasHallucinations).length,
      interruptions: analyses.filter(a => a.hasInterruptions).length,
      negativeSentiment: analyses.filter(a => a.hasNegativeSentiment).length,
      complianceIssues: analyses.filter(a => a.hasComplianceIssues).length,
      kbInaccuracies: analyses.filter(a => a.hasKbInaccuracies).length
    };

    const scoreTrend = analyses.slice(0, 30).map(a => ({
      date: a.analyzedAt,
      score: a.overallScore
    })).reverse();

    return {
      totalAnalyzed,
      averageScore,
      resolutionRate,
      issueBreakdown,
      scoreTrend,
      recentAnalyses: analyses.slice(0, 10)
    };
  }

  static async getCallsForAnalysis(userId: string, limit = 50) {
    const analyzedCallIds = await db
      .select({ callId: callQaAnalyses.callId })
      .from(callQaAnalyses)
      .where(eq(callQaAnalyses.userId, userId));

    const analyzedIds = new Set(analyzedCallIds.map(a => a.callId));

    const callsToAnalyze = await db
      .select({
        id: calls.id,
        phoneNumber: calls.phoneNumber,
        status: calls.status,
        duration: calls.duration,
        createdAt: calls.createdAt,
        transcript: calls.transcript
      })
      .from(calls)
      .where(
        and(
          eq(calls.userId, userId),
          eq(calls.status, 'completed'),
          sql`${calls.transcript} IS NOT NULL AND ${calls.transcript} != ''`
        )
      )
      .orderBy(desc(calls.createdAt))
      .limit(limit * 2);

    return callsToAnalyze
      .filter(call => !analyzedIds.has(call.id))
      .slice(0, limit);
  }

  static async getUserAnalyses(
    userId: string,
    page = 1,
    pageSize = 20
  ): Promise<{ analyses: CallQaAnalysis[]; total: number }> {
    const offset = (page - 1) * pageSize;

    const [countResult] = await db
      .select({ count: count() })
      .from(callQaAnalyses)
      .where(eq(callQaAnalyses.userId, userId));

    const analyses = await db
      .select()
      .from(callQaAnalyses)
      .where(eq(callQaAnalyses.userId, userId))
      .orderBy(desc(callQaAnalyses.analyzedAt))
      .offset(offset)
      .limit(pageSize);

    return {
      analyses,
      total: countResult?.count || 0
    };
  }
}
