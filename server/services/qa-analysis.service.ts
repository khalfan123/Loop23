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

interface DeterministicQaMetrics {
  phoneStyleScore: number;
  groundingScore: number;
  interruptionControlScore: number;
  latencyProxyScore: number;
  retellReadinessScore: number;
  retellGapScore: number;
  benchmarkFlags: string[];
  deterministicEvidence: Array<{ issue: string; severity: 'low' | 'medium' | 'high' }>;
}

export interface RetellBenchmarkScorecard {
  weightedScore: number;
  dimensions: {
    callFlowSmoothness: number;
    phonePhrasingConciseness: number;
    groundingAndHallucinationSafety: number;
    interruptionHandling: number;
    emotionalAdaptation: number;
    resolutionAndEscalation: number;
    multilingualConsistency: number;
  };
  strengths: string[];
  risks: string[];
  recommendedActions: string[];
}

interface TranscriptTurn {
  speaker: 'user' | 'agent';
  text: string;
  index: number;
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

    const userMessage = `Analyze this call transcript:

Call ID: ${callId}
Duration: ${call.duration || 'Unknown'} seconds
Direction: ${call.callDirection}
Status: ${call.status}

Transcript:
${call.transcript}

${call.aiSummary ? `AI Summary: ${call.aiSummary}` : ''}
${call.sentiment ? `Current Sentiment: ${call.sentiment}` : ''}`;

    let analysis: QaAnalysisResult | null = null;
    let analysisModel = 'gpt-4o-mini';

    try {
      const openai = this.getOpenAIClient(apiKey);
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

      analysis = JSON.parse(content) as QaAnalysisResult;
      analysis = this.normalizeAnalysisResult(analysis, call.transcript);
    } catch (error: any) {
      logger.warn(`LLM QA analysis failed for call ${callId}, using deterministic fallback`, {
        error: error.message
      }, source);
      analysis = this.buildHeuristicAnalysis(call.transcript, call.duration || undefined);
      analysisModel = 'heuristic-local-v1';
    }

    try {
      if (!analysis) {
        return null;
      }
      const benchmark = this.computeRetellBenchmark(analysis, call.transcript);
      analysis.diagnostics = {
        ...(analysis.diagnostics || {}),
        retellBenchmark: benchmark,
      } as any;

      const qaData: InsertCallQaAnalysis = {
        callId,
        userId,
        overallScore: analysis.overallScore ?? null,
        audioQualityScore: analysis.audioQualityScore ?? null,
        languageScore: analysis.languageScore ?? null,
        complianceScore: analysis.complianceScore ?? null,
        performanceScore: analysis.performanceScore ?? null,
        resolutionStatus: analysis.resolutionStatus ?? null,
        resolutionNotes: analysis.resolutionNotes ?? null,
        avgResponseLatency: analysis.avgResponseLatency ?? null,
        maxResponseLatency: analysis.maxResponseLatency ?? null,
        hasHallucinations: analysis.hasHallucinations ?? false,
        hasInterruptions: analysis.hasInterruptions ?? false,
        hasNegativeSentiment: analysis.hasNegativeSentiment ?? false,
        hasComplianceIssues: analysis.hasComplianceIssues ?? false,
        hasKbInaccuracies: analysis.hasKbInaccuracies ?? false,
        diagnostics: analysis.diagnostics,
        keyMoments: analysis.keyMoments,
        evidence: analysis.evidence,
        analysisModel,
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

  static async getRetellBenchmark(callId: string): Promise<RetellBenchmarkScorecard | null> {
    const [analysis] = await db
      .select({
        diagnostics: callQaAnalyses.diagnostics,
      })
      .from(callQaAnalyses)
      .where(eq(callQaAnalyses.callId, callId))
      .limit(1);
    const benchmark = (analysis?.diagnostics as any)?.retellBenchmark;
    if (!benchmark || typeof benchmark !== 'object') return null;
    return benchmark as RetellBenchmarkScorecard;
  }

  static async analyzeTwilioOpenAIBenchmarkCall(
    callId: string,
    userId: string,
    apiKey?: string
  ): Promise<CallQaAnalysis | null> {
    const [call] = await db
      .select({
        id: calls.id,
        userId: calls.userId,
        transcript: calls.transcript,
      })
      .from(calls)
      .where(eq(calls.id, callId))
      .limit(1);

    if (!call || call.userId !== userId || !call.transcript || call.transcript.trim().length === 0) {
      return null;
    }

    const existing = await this.getAnalysis(callId);
    if (existing) {
      const diagnostics = (existing.diagnostics as any) || {};
      if (diagnostics.retellBenchmark) {
        return existing;
      }
    }

    return this.analyzeCall(callId, userId, apiKey);
  }

  static async runBenchmarkForRecentTwilioOpenAICalls(
    userId: string,
    limit = 20
  ): Promise<{ processed: number; successful: number; failed: number }> {
    const cappedLimit = Math.max(1, Math.min(100, limit));
    const recentCalls = await db
      .select({
        id: calls.id,
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
      .limit(cappedLimit);

    let successful = 0;
    let failed = 0;

    for (const call of recentCalls) {
      try {
        const analysis = await this.analyzeTwilioOpenAIBenchmarkCall(call.id, userId);
        if (analysis) {
          successful += 1;
        } else {
          failed += 1;
        }
      } catch {
        failed += 1;
      }
    }

    return {
      processed: recentCalls.length,
      successful,
      failed,
    };
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
    const retellReadiness = Math.round(
      analyses.reduce((sum, a) => {
        const score = Number(((a.diagnostics as any)?.retellBenchmark?.weightedScore) || 0);
        return sum + score;
      }, 0) / totalAnalyzed
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
      retellReadiness,
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

  private static normalizeAnalysisResult(
    raw: QaAnalysisResult,
    transcript: string
  ): QaAnalysisResult {
    const fallback = this.buildHeuristicAnalysis(transcript);
    return {
      overallScore: this.clampScore(raw.overallScore, fallback.overallScore),
      audioQualityScore: this.clampScore(raw.audioQualityScore, fallback.audioQualityScore),
      languageScore: this.clampScore(raw.languageScore, fallback.languageScore),
      complianceScore: this.clampScore(raw.complianceScore, fallback.complianceScore),
      performanceScore: this.clampScore(raw.performanceScore, fallback.performanceScore),
      resolutionStatus: raw.resolutionStatus || fallback.resolutionStatus,
      resolutionNotes: raw.resolutionNotes || fallback.resolutionNotes,
      avgResponseLatency: Math.max(0, Number(raw.avgResponseLatency || 0)),
      maxResponseLatency: Math.max(0, Number(raw.maxResponseLatency || 0)),
      hasHallucinations: !!raw.hasHallucinations,
      hasInterruptions: !!raw.hasInterruptions,
      hasNegativeSentiment: !!raw.hasNegativeSentiment,
      hasComplianceIssues: !!raw.hasComplianceIssues,
      hasKbInaccuracies: !!raw.hasKbInaccuracies,
      diagnostics: raw.diagnostics || fallback.diagnostics,
      keyMoments: Array.isArray(raw.keyMoments) ? raw.keyMoments : fallback.keyMoments,
      evidence: Array.isArray(raw.evidence) ? raw.evidence : fallback.evidence,
    };
  }

  private static clampScore(value: unknown, fallback: number): number {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(0, Math.min(100, Math.round(num)));
  }

  private static parseTranscript(transcript: string): TranscriptTurn[] {
    const lines = transcript
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const turns: TranscriptTurn[] = [];
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.startsWith('user:')) {
        turns.push({
          speaker: 'user',
          text: line.slice(line.indexOf(':') + 1).trim(),
          index: turns.length,
        });
      } else if (lower.startsWith('agent:') || lower.startsWith('assistant:')) {
        turns.push({
          speaker: 'agent',
          text: line.slice(line.indexOf(':') + 1).trim(),
          index: turns.length,
        });
      }
    }
    return turns;
  }

  private static buildHeuristicAnalysis(transcript: string, duration?: number): QaAnalysisResult {
    const turns = this.parseTranscript(transcript);
    const agentTurns = turns.filter((t) => t.speaker === 'agent');
    const userTurns = turns.filter((t) => t.speaker === 'user');
    const agentWordCounts = agentTurns.map((t) => t.text.split(/\s+/).filter(Boolean).length);
    const avgAgentWords = agentWordCounts.length
      ? agentWordCounts.reduce((sum, n) => sum + n, 0) / agentWordCounts.length
      : 0;
    const longAgentTurns = agentWordCounts.filter((n) => n > 45).length;
    const interruptionSignals = transcript.match(/\b(sorry to interrupt|wait wait|hold on|let me stop you)\b/gi)?.length || 0;
    const negativeSignals = transcript.match(/\b(angry|frustrated|upset|not happy|bad service|complaint)\b/gi)?.length || 0;
    const uncertainSignals = transcript.match(/\b(i think|maybe|not sure|cannot confirm|can't confirm)\b/gi)?.length || 0;
    const greetingDetected = /\b(hello|hi|good (morning|afternoon|evening))\b/i.test(transcript);
    const closingDetected = /\b(thank you for calling|goodbye|have a great day|bye)\b/i.test(transcript);
    const transferDetected = /\b(transfer|human agent|representative)\b/i.test(transcript);
    const resolvedDetected = /\b(resolved|fixed|done|completed|all set)\b/i.test(transcript);

    const languageScore = Math.max(45, 88 - Math.round(longAgentTurns * 6) - (avgAgentWords > 30 ? 8 : 0));
    const complianceScore = Math.max(35, 92 - (greetingDetected ? 0 : 15) - (closingDetected ? 0 : 10));
    const performanceScore = Math.max(40, 82 - Math.round(interruptionSignals * 8) - (transferDetected ? 5 : 0));
    const audioQualityScore = 75;
    const overallScore = Math.round(
      (audioQualityScore * 0.15) +
      (languageScore * 0.25) +
      (complianceScore * 0.25) +
      (performanceScore * 0.35)
    );

    const resolutionStatus: QaAnalysisResult['resolutionStatus'] =
      transferDetected ? 'transferred' : (resolvedDetected ? 'resolved' : 'partial');
    const resolutionNotes =
      resolutionStatus === 'resolved'
        ? 'Detected completion cues in transcript.'
        : resolutionStatus === 'transferred'
          ? 'Call appears escalated/transferred.'
          : 'No explicit complete resolution cues detected.';

    const estimatedAvgLatency = duration && agentTurns.length > 0
      ? Math.max(500, Math.round((duration * 1000) / Math.max(agentTurns.length, 1)))
      : 0;

    return {
      overallScore: this.clampScore(overallScore, 65),
      audioQualityScore: this.clampScore(audioQualityScore, 70),
      languageScore: this.clampScore(languageScore, 65),
      complianceScore: this.clampScore(complianceScore, 65),
      performanceScore: this.clampScore(performanceScore, 65),
      resolutionStatus,
      resolutionNotes,
      avgResponseLatency: estimatedAvgLatency,
      maxResponseLatency: estimatedAvgLatency ? Math.round(estimatedAvgLatency * 1.6) : 0,
      hasHallucinations: uncertainSignals > 3,
      hasInterruptions: interruptionSignals > 0,
      hasNegativeSentiment: negativeSignals > 0,
      hasComplianceIssues: !greetingDetected || !closingDetected,
      hasKbInaccuracies: false,
      diagnostics: {
        hallucinations: uncertainSignals > 0 ? [{ text: 'High uncertainty language detected', context: 'heuristic-fallback' }] : [],
        interruptions: interruptionSignals > 0 ? [{ timestamp: 0, description: 'Interruption-like phrases detected' }] : [],
        sentimentBreakdown: {
          positive: Math.max(0, 65 - negativeSignals * 10),
          neutral: 25,
          negative: Math.min(100, negativeSignals * 15),
        },
        complianceIssues: [
          ...(!greetingDetected ? [{ issue: 'Missing clear greeting', severity: 'medium' }] : []),
          ...(!closingDetected ? [{ issue: 'Missing clear closing', severity: 'medium' }] : []),
        ],
      },
      keyMoments: [],
      evidence: [],
    };
  }

  private static computeRetellBenchmark(
    analysis: QaAnalysisResult,
    transcript: string
  ): RetellBenchmarkScorecard {
    const turns = this.parseTranscript(transcript);
    const agentTurns = turns.filter((t) => t.speaker === 'agent');
    const agentWords = agentTurns.map((t) => t.text.split(/\s+/).filter(Boolean).length);
    const avgAgentWords = agentWords.length
      ? agentWords.reduce((sum, n) => sum + n, 0) / agentWords.length
      : 0;
    const overlongTurns = agentWords.filter((n) => n > 45).length;
    const longTurnPenalty = Math.min(30, overlongTurns * 6 + (avgAgentWords > 30 ? 8 : 0));

    const phonePhrasingConciseness = this.clampScore(95 - longTurnPenalty, 65);
    const callFlowSmoothness = this.clampScore(
      (analysis.performanceScore || 65) - ((analysis.hasInterruptions ? 10 : 0)),
      65
    );
    const groundingAndHallucinationSafety = this.clampScore(
      90 - (analysis.hasHallucinations ? 20 : 0) - (analysis.hasKbInaccuracies ? 15 : 0),
      70
    );
    const interruptionHandling = this.clampScore(
      88 - (analysis.hasInterruptions ? 20 : 0),
      68
    );
    const emotionalAdaptation = this.clampScore(
      86 - (analysis.hasNegativeSentiment ? 8 : 0),
      70
    );
    const resolutionAndEscalation = this.clampScore(
      (analysis.resolutionStatus === 'resolved' ? 90 : analysis.resolutionStatus === 'transferred' ? 80 : 68) -
      (analysis.hasComplianceIssues ? 8 : 0),
      68
    );
    const multilingualConsistency = this.clampScore(analysis.languageScore || 70, 70);

    const weightedScore = this.clampScore(
      (callFlowSmoothness * 0.2) +
      (phonePhrasingConciseness * 0.17) +
      (groundingAndHallucinationSafety * 0.2) +
      (interruptionHandling * 0.13) +
      (emotionalAdaptation * 0.1) +
      (resolutionAndEscalation * 0.12) +
      (multilingualConsistency * 0.08),
      70
    );

    const strengths: string[] = [];
    const risks: string[] = [];
    const recommendedActions: string[] = [];

    if (groundingAndHallucinationSafety >= 85) strengths.push('Strong grounding safety signals');
    if (phonePhrasingConciseness >= 80) strengths.push('Concise phone-ready phrasing');
    if (interruptionHandling >= 80) strengths.push('Good interruption resilience');

    if (phonePhrasingConciseness < 75) {
      risks.push('Agent turns are often too long for call-center pacing');
      recommendedActions.push('Enforce 1-3 sentence default responses and split details into chunks.');
    }
    if (groundingAndHallucinationSafety < 80) {
      risks.push('Potential grounding/hallucination risk remains');
      recommendedActions.push('Increase low-confidence escalation behavior and tighten KB confidence thresholds.');
    }
    if (resolutionAndEscalation < 75) {
      risks.push('Resolution and escalation handling needs improvement');
      recommendedActions.push('Add explicit resolution checkpoints and earlier escalation logic for blocked intents.');
    }
    if (multilingualConsistency < 75) {
      risks.push('Language consistency not yet stable');
      recommendedActions.push('Strengthen language lock and dialect-preservation prompts/tooling.');
    }
    if (recommendedActions.length === 0) {
      recommendedActions.push('Keep running benchmark batches and track score drift by agent/flow.');
    }

    return {
      weightedScore,
      dimensions: {
        callFlowSmoothness,
        phonePhrasingConciseness,
        groundingAndHallucinationSafety,
        interruptionHandling,
        emotionalAdaptation,
        resolutionAndEscalation,
        multilingualConsistency,
      },
      strengths,
      risks,
      recommendedActions,
    };
  }
}
