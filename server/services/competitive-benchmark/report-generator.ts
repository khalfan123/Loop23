import type { ScenarioResult } from './benchmark-engine';
import type { LLMJudgeResult } from './llm-evaluator';
import type { CallScenario } from './scenarios';
import {
  RETELL_OVERALL_BASELINE,
  RETELL_DOCUMENTED_FEATURES,
  RETELL_KNOWN_WEAKNESSES,
  RETELL_KNOWN_STRENGTHS,
  getRetellBaselineForCategory,
} from './retell-baseline';

export interface ComparisonReport {
  metadata: ReportMetadata;
  scoringTable: ScoringTable;
  quantitative: QuantitativeComparison;
  qualitative: QualitativeComparison;
  categoryBreakdown: CategoryBreakdown[];
  featureParityChecklist: FeatureParityItem[];
  failureCases: FailureCase[];
  improvements: Improvement[];
  architecturalRecommendations: string[];
  llmJudgeResults?: LLMJudgeSummary;
  rawData: {
    diployResults: ScenarioResult[];
    retellResults: ScenarioResult[];
  };
}

interface ReportMetadata {
  generatedAt: string;
  totalScenarios: number;
  scenarioBreakdown: Record<string, number>;
  model: string;
  benchmarkDurationMs: number;
}

interface ScoringTable {
  overall: ProviderScores;
  byCategory: Record<string, ProviderScores>;
}

interface ProviderScores {
  diploy: MetricSet;
  retell: MetricSet;
  winner: string;
  delta: Record<string, number>;
}

interface MetricSet {
  avgLatencyMs: number;
  successRate: number;
  avgTurnsToCompletion: number;
  toolExecutionRate: number;
  errorRecoveryRate: number;
  coherenceScore: number;
  responseQuality: number;
  naturalness: number;
  compositeScore: number;
}

interface QuantitativeComparison {
  latency: { diploy: number; retell: number; delta: number; winner: string };
  successRate: { diploy: number; retell: number; delta: number; winner: string };
  avgTurns: { diploy: number; retell: number; delta: number; winner: string };
  toolReliability: { diploy: number; retell: number; delta: number; winner: string };
  errorRecovery: { diploy: number; retell: number; delta: number; winner: string };
}

interface QualitativeComparison {
  responseQuality: { diploy: number; retell: number; verdict: string };
  naturalness: { diploy: number; retell: number; verdict: string };
  coherence: { diploy: number; retell: number; verdict: string };
  overallAssessment: string;
}

interface CategoryBreakdown {
  category: string;
  scenarioCount: number;
  diployMetrics: MetricSet;
  retellMetrics: MetricSet;
  winner: string;
  insights: string[];
}

interface FeatureParityItem {
  feature: string;
  diploy: 'yes' | 'partial' | 'no';
  retell: 'yes' | 'partial' | 'no';
  notes: string;
}

interface FailureCase {
  scenarioId: string;
  scenarioName: string;
  category: string;
  failureType: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

interface Improvement {
  area: string;
  currentState: string;
  recommendation: string;
  impact: 'critical' | 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  priorityScore: number;
}

interface LLMJudgeSummary {
  avgCoherence: number;
  avgResponseQuality: number;
  avgNaturalness: number;
  avgInterruptionHandling: number;
  taskCompletionRate: number;
  topStrengths: string[];
  topWeaknesses: string[];
  verdicts: Array<{ scenarioId: string; verdict: string }>;
}

export interface ReportOptions {
  model?: string;
  benchmarkDurationMs?: number;
}

export function generateComparisonReport(
  diployResults: ScenarioResult[],
  retellResults: ScenarioResult[],
  llmJudgeResults: LLMJudgeResult[],
  scenarios: CallScenario[],
  options?: ReportOptions
): ComparisonReport {
  const startTime = Date.now();

  const diployMetrics = computeMetrics(diployResults, llmJudgeResults);
  const retellMetrics = computeMetrics(retellResults, []);

  const categories = [...new Set(scenarios.map(s => s.category))];
  const categoryBreakdown = categories.map(cat => buildCategoryBreakdown(cat, diployResults, retellResults, llmJudgeResults));

  const scoringTable = buildScoringTable(diployMetrics, retellMetrics, categoryBreakdown);
  const quantitative = buildQuantitativeComparison(diployMetrics, retellMetrics);
  const qualitative = buildQualitativeComparison(diployMetrics, retellMetrics, llmJudgeResults);
  const featureChecklist = buildFeatureParityChecklist();
  const failureCases = identifyFailureCases(diployResults, scenarios);
  const improvements = generateImprovements(diployMetrics, retellMetrics, failureCases, llmJudgeResults);
  const architecturalRecs = generateArchitecturalRecommendations(diployMetrics, retellMetrics);

  let llmJudgeSummary: LLMJudgeSummary | undefined;
  if (llmJudgeResults.length > 0) {
    llmJudgeSummary = buildLLMJudgeSummary(llmJudgeResults);
  }

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      totalScenarios: scenarios.length,
      scenarioBreakdown: categories.reduce((acc, cat) => {
        acc[cat] = scenarios.filter(s => s.category === cat).length;
        return acc;
      }, {} as Record<string, number>),
      model: options?.model || 'gpt-4o-mini',
      benchmarkDurationMs: options?.benchmarkDurationMs || (Date.now() - startTime),
    },
    scoringTable,
    quantitative,
    qualitative,
    categoryBreakdown,
    featureParityChecklist: featureChecklist,
    failureCases,
    improvements,
    architecturalRecommendations: architecturalRecs,
    llmJudgeResults: llmJudgeSummary,
    rawData: { diployResults, retellResults },
  };
}

function computeMetrics(results: ScenarioResult[], judgeResults: LLMJudgeResult[]): MetricSet {
  if (results.length === 0) {
    return { avgLatencyMs: 0, successRate: 0, avgTurnsToCompletion: 0, toolExecutionRate: 0, errorRecoveryRate: 0, coherenceScore: 0, responseQuality: 0, naturalness: 0, compositeScore: 0 };
  }

  const avgLatencyMs = avg(results.map(r => r.latencyMs));
  const successRate = (results.filter(r => r.taskCompleted).length / results.length) * 100;
  const avgTurns = avg(results.map(r => r.turnsToCompletion));
  const toolRate = (results.filter(r => r.toolCallsSucceeded).length / results.length) * 100;
  const errorRate = (results.filter(r => r.errorRecovery).length / results.length) * 100;

  let coherence = avg(results.map(r => r.coherenceScore));
  let quality = avg(results.map(r => r.responseQuality));
  let naturalness = avg(results.map(r => r.naturalness));

  if (judgeResults.length > 0) {
    coherence = avg(judgeResults.map(j => j.coherenceScore));
    quality = avg(judgeResults.map(j => j.responseQuality));
    naturalness = avg(judgeResults.map(j => j.naturalness));
  }

  const composite = (
    (successRate / 100) * 30 +
    (toolRate / 100) * 15 +
    (errorRate / 100) * 10 +
    (coherence / 10) * 15 +
    (quality / 10) * 15 +
    (naturalness / 10) * 10 +
    Math.max(0, (1 - avgLatencyMs / 3000)) * 5
  );

  return {
    avgLatencyMs: Math.round(avgLatencyMs),
    successRate: round2(successRate),
    avgTurnsToCompletion: round2(avgTurns),
    toolExecutionRate: round2(toolRate),
    errorRecoveryRate: round2(errorRate),
    coherenceScore: round2(coherence),
    responseQuality: round2(quality),
    naturalness: round2(naturalness),
    compositeScore: round2(composite),
  };
}

function buildCategoryBreakdown(
  category: string,
  diployResults: ScenarioResult[],
  retellResults: ScenarioResult[],
  judgeResults: LLMJudgeResult[]
): CategoryBreakdown {
  const diployFiltered = diployResults.filter(r => r.category === category);
  const retellFiltered = retellResults.filter(r => r.category === category);
  const judgeFiltered = judgeResults.filter(j => diployFiltered.some(d => d.scenarioId === j.scenarioId));

  const diployMetrics = computeMetrics(diployFiltered, judgeFiltered);
  const retellMetrics = computeMetrics(retellFiltered, []);

  const retellBaseline = getRetellBaselineForCategory(category);
  if (retellFiltered.length === 0) {
    retellMetrics.coherenceScore = retellBaseline.coherenceScore;
    retellMetrics.responseQuality = 8.5;
    retellMetrics.naturalness = retellBaseline.voiceNaturalnessScore;
  }

  const winner = diployMetrics.compositeScore >= retellMetrics.compositeScore ? 'Diploy' : 'Retell';

  const insights: string[] = [];
  if (diployMetrics.avgLatencyMs < retellMetrics.avgLatencyMs) {
    insights.push(`Diploy is ${retellMetrics.avgLatencyMs - diployMetrics.avgLatencyMs}ms faster on average`);
  } else {
    insights.push(`Retell is ${diployMetrics.avgLatencyMs - retellMetrics.avgLatencyMs}ms faster on average`);
  }
  if (diployMetrics.successRate > retellMetrics.successRate) {
    insights.push(`Diploy has ${round2(diployMetrics.successRate - retellMetrics.successRate)}% higher success rate`);
  }
  if (diployMetrics.toolExecutionRate < retellMetrics.toolExecutionRate) {
    insights.push(`Tool execution reliability gap: ${round2(retellMetrics.toolExecutionRate - diployMetrics.toolExecutionRate)}% behind Retell`);
  }

  return {
    category,
    scenarioCount: diployFiltered.length,
    diployMetrics,
    retellMetrics,
    winner,
    insights,
  };
}

function buildScoringTable(diploy: MetricSet, retell: MetricSet, breakdown: CategoryBreakdown[]): ScoringTable {
  const winner = diploy.compositeScore >= retell.compositeScore ? 'Diploy' : 'Retell';
  const delta: Record<string, number> = {
    latency: round2(diploy.avgLatencyMs - retell.avgLatencyMs),
    successRate: round2(diploy.successRate - retell.successRate),
    toolReliability: round2(diploy.toolExecutionRate - retell.toolExecutionRate),
    coherence: round2(diploy.coherenceScore - retell.coherenceScore),
    composite: round2(diploy.compositeScore - retell.compositeScore),
  };

  const byCategory: Record<string, ProviderScores> = {};
  for (const cat of breakdown) {
    byCategory[cat.category] = {
      diploy: cat.diployMetrics,
      retell: cat.retellMetrics,
      winner: cat.winner,
      delta: {
        latency: round2(cat.diployMetrics.avgLatencyMs - cat.retellMetrics.avgLatencyMs),
        successRate: round2(cat.diployMetrics.successRate - cat.retellMetrics.successRate),
        composite: round2(cat.diployMetrics.compositeScore - cat.retellMetrics.compositeScore),
      },
    };
  }

  return {
    overall: { diploy, retell, winner, delta },
    byCategory,
  };
}

function buildQuantitativeComparison(diploy: MetricSet, retell: MetricSet): QuantitativeComparison {
  const compare = (d: number, r: number, lowerBetter = false) => ({
    diploy: d,
    retell: r,
    delta: round2(d - r),
    winner: lowerBetter ? (d <= r ? 'Diploy' : 'Retell') : (d >= r ? 'Diploy' : 'Retell'),
  });

  return {
    latency: compare(diploy.avgLatencyMs, retell.avgLatencyMs, true),
    successRate: compare(diploy.successRate, retell.successRate),
    avgTurns: compare(diploy.avgTurnsToCompletion, retell.avgTurnsToCompletion, true),
    toolReliability: compare(diploy.toolExecutionRate, retell.toolExecutionRate),
    errorRecovery: compare(diploy.errorRecoveryRate, retell.errorRecoveryRate),
  };
}

function buildQualitativeComparison(diploy: MetricSet, retell: MetricSet, judgeResults: LLMJudgeResult[]): QualitativeComparison {
  const qualCompare = (d: number, r: number, label: string) => ({
    diploy: d,
    retell: r,
    verdict: d > r ? `Diploy leads in ${label} by ${round2(d - r)} points` :
             d < r ? `Retell leads in ${label} by ${round2(r - d)} points` :
             `Tied in ${label}`,
  });

  let assessment = '';
  if (diploy.compositeScore > retell.compositeScore) {
    assessment = `Diploy outperforms Retell overall with a composite score of ${diploy.compositeScore} vs ${retell.compositeScore}. `;
  } else {
    assessment = `Retell leads overall with a composite score of ${retell.compositeScore} vs ${diploy.compositeScore}. `;
  }

  if (judgeResults.length > 0) {
    const verdicts = judgeResults.map(j => j.overallVerdict).filter(v => v);
    assessment += `LLM Judge evaluated ${judgeResults.length} scenarios. Common themes: `;
    const weaknesses = judgeResults.flatMap(j => j.weaknesses);
    const topIssues = getMostCommon(weaknesses, 3);
    assessment += topIssues.join('; ') + '.';
  }

  return {
    responseQuality: qualCompare(diploy.responseQuality, retell.responseQuality, 'response quality'),
    naturalness: qualCompare(diploy.naturalness, retell.naturalness, 'naturalness'),
    coherence: qualCompare(diploy.coherenceScore, retell.coherenceScore, 'coherence'),
    overallAssessment: assessment,
  };
}

function buildFeatureParityChecklist(): FeatureParityItem[] {
  return [
    { feature: 'AI Voice Agent (Inbound)', diploy: 'yes', retell: 'yes', notes: 'Both support inbound call handling' },
    { feature: 'AI Voice Agent (Outbound)', diploy: 'yes', retell: 'yes', notes: 'Both support outbound calling' },
    { feature: 'Real-time Transcription', diploy: 'yes', retell: 'yes', notes: 'Diploy uses Whisper; Retell uses Deepgram/custom' },
    { feature: 'LLM-driven Responses', diploy: 'yes', retell: 'yes', notes: 'Diploy supports OpenAI + Bedrock + Anthropic; Retell supports OpenAI + Anthropic + Azure' },
    { feature: 'Tool/Function Calling', diploy: 'yes', retell: 'yes', notes: 'Diploy has native structured tool calling + legacy fallback' },
    { feature: 'Call Transfer to Human', diploy: 'yes', retell: 'yes', notes: 'Both support warm/cold transfer' },
    { feature: 'Interruption Handling (Barge-in)', diploy: 'yes', retell: 'yes', notes: 'Diploy uses custom VAD; Retell has native handling' },
    { feature: 'Multi-turn Conversation State', diploy: 'yes', retell: 'yes', notes: 'Both maintain context across turns' },
    { feature: 'Batch/Campaign Calling', diploy: 'yes', retell: 'partial', notes: 'Diploy has full campaign management; Retell requires custom integration' },
    { feature: 'IVR System', diploy: 'yes', retell: 'no', notes: 'Diploy has enterprise-grade IVR with DTMF+speech; Retell has no native IVR' },
    { feature: 'Knowledge Base / RAG', diploy: 'yes', retell: 'no', notes: 'Diploy has built-in RAG with pgvector; Retell requires external setup' },
    { feature: 'Visual Flow Builder', diploy: 'yes', retell: 'no', notes: 'Diploy has drag-and-drop flow builder; not available in Retell' },
    { feature: 'Multi-LLM Support', diploy: 'yes', retell: 'yes', notes: 'Diploy: OpenAI + Bedrock + Anthropic; Retell: OpenAI + Anthropic + Azure + Custom' },
    { feature: 'Multi-Voice Provider', diploy: 'yes', retell: 'yes', notes: 'Diploy: ElevenLabs + Polly + Cartesia + OpenAI TTS; Retell: ElevenLabs + OpenAI + Deepgram + PlayHT' },
    { feature: 'Multi-Telephony Provider', diploy: 'yes', retell: 'partial', notes: 'Diploy: Twilio + Plivo + SIP; Retell: Twilio + Vonage + SIP' },
    { feature: 'CRM Integration', diploy: 'yes', retell: 'partial', notes: 'Diploy has built-in CRM lead capture; Retell via webhooks only' },
    { feature: 'Real-time Sentiment Analysis', diploy: 'yes', retell: 'no', notes: 'Diploy has real-time keyword/pattern-based sentiment scoring' },
    { feature: 'Call Analytics Dashboard', diploy: 'yes', retell: 'yes', notes: 'Both provide analytics; Diploy has BI-grade reporting' },
    { feature: 'Multi-tenant SaaS', diploy: 'yes', retell: 'no', notes: 'Diploy is white-label multi-tenant; Retell is single-tenant API' },
    { feature: 'Caller Memory', diploy: 'yes', retell: 'no', notes: 'Diploy extracts and stores facts per phone number for context' },
    { feature: 'Dynamic Form Collection', diploy: 'yes', retell: 'no', notes: 'Diploy agents can discover and fill forms during calls' },
    { feature: 'Product/Pricing KB', diploy: 'yes', retell: 'no', notes: 'Diploy has built-in product catalog with AI CSV import' },
    { feature: 'Webhook Notifications', diploy: 'yes', retell: 'yes', notes: 'Both support webhook-based event notifications' },
    { feature: 'Live Call Monitoring', diploy: 'yes', retell: 'partial', notes: 'Diploy has WebSocket-based supervisor dashboard; Retell has basic monitoring' },
    { feature: 'Quality Assurance (AI)', diploy: 'yes', retell: 'no', notes: 'Diploy has automated QA analysis of transcripts' },
  ];
}

function identifyFailureCases(results: ScenarioResult[], scenarios: CallScenario[]): FailureCase[] {
  const failures: FailureCase[] = [];

  for (const result of results) {
    if (result.provider !== 'diploy') continue;
    const scenario = scenarios.find(s => s.id === result.scenarioId);
    if (!scenario) continue;

    if (!result.taskCompleted) {
      failures.push({
        scenarioId: result.scenarioId,
        scenarioName: result.scenarioName,
        category: result.category,
        failureType: 'task_incomplete',
        description: `Agent failed to complete the ${scenario.name} scenario. ${result.errors.length > 0 ? 'Errors: ' + result.errors.join('; ') : 'No explicit errors but responses were incomplete.'}`,
        severity: result.difficulty === 'hard' ? 'medium' : 'high',
      });
    }

    if (!result.toolCallsSucceeded && scenario.expectedTools?.length) {
      failures.push({
        scenarioId: result.scenarioId,
        scenarioName: result.scenarioName,
        category: result.category,
        failureType: 'tool_execution_failure',
        description: `Expected tools [${scenario.expectedTools.join(', ')}] but agent used [${result.toolCallsMade.join(', ') || 'none'}]`,
        severity: 'high',
      });
    }

    if (result.latencyMs > 3000) {
      failures.push({
        scenarioId: result.scenarioId,
        scenarioName: result.scenarioName,
        category: result.category,
        failureType: 'high_latency',
        description: `Average turn latency of ${result.latencyMs}ms exceeds 3s threshold (${Math.round(result.latencyMs / RETELL_OVERALL_BASELINE.avgLatencyMs * 100)}% of Retell baseline)`,
        severity: result.latencyMs > 5000 ? 'critical' : 'high',
      });
    }

    if (result.errors.length > 0) {
      failures.push({
        scenarioId: result.scenarioId,
        scenarioName: result.scenarioName,
        category: result.category,
        failureType: 'runtime_error',
        description: `Runtime errors during execution: ${result.errors.join('; ')}`,
        severity: 'critical',
      });
    }
  }

  return failures.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

function generateImprovements(
  diploy: MetricSet,
  retell: MetricSet,
  failures: FailureCase[],
  judgeResults: LLMJudgeResult[]
): Improvement[] {
  const improvements: Improvement[] = [];

  if (diploy.avgLatencyMs > retell.avgLatencyMs) {
    const gap = diploy.avgLatencyMs - retell.avgLatencyMs;
    improvements.push({
      area: 'Response Latency',
      currentState: `${diploy.avgLatencyMs}ms avg (${gap}ms slower than Retell)`,
      recommendation: 'Implement response streaming with sentence-level chunking for TTS. Use LLM response caching for common queries. Consider edge deployment for reduced network hops.',
      impact: gap > 500 ? 'critical' : 'high',
      effort: 'high',
      priorityScore: gap > 500 ? 95 : 80,
    });
  }

  if (diploy.toolExecutionRate < retell.toolExecutionRate) {
    improvements.push({
      area: 'Tool Execution Reliability',
      currentState: `${diploy.toolExecutionRate}% vs Retell's ${retell.toolExecutionRate}%`,
      recommendation: 'Strengthen tool call parsing with fallback patterns. Add retry logic for failed tool executions. Improve tool schema descriptions for better LLM understanding.',
      impact: 'high',
      effort: 'medium',
      priorityScore: 85,
    });
  }

  if (diploy.successRate < retell.successRate) {
    improvements.push({
      area: 'Task Completion Rate',
      currentState: `${diploy.successRate}% vs Retell's ${retell.successRate}%`,
      recommendation: 'Add conversation state validation checkpoints. Implement graceful degradation with fallback prompts. Add retry mechanisms for incomplete conversations.',
      impact: 'critical',
      effort: 'medium',
      priorityScore: 90,
    });
  }

  if (diploy.coherenceScore < retell.coherenceScore) {
    improvements.push({
      area: 'Conversation Coherence',
      currentState: `Score ${diploy.coherenceScore}/10 vs Retell's ${retell.coherenceScore}/10`,
      recommendation: 'Enhance system prompts with explicit conversation flow instructions. Implement conversation memory summarization for long interactions. Add context window management to prevent drift.',
      impact: 'high',
      effort: 'medium',
      priorityScore: 75,
    });
  }

  const criticalFailures = failures.filter(f => f.severity === 'critical');
  if (criticalFailures.length > 0) {
    improvements.push({
      area: 'Critical Failure Resolution',
      currentState: `${criticalFailures.length} critical failures detected`,
      recommendation: `Address critical failures: ${criticalFailures.map(f => f.failureType).join(', ')}. Implement circuit breaker pattern for error-prone scenarios. Add comprehensive error handling and recovery flows.`,
      impact: 'critical',
      effort: 'high',
      priorityScore: 100,
    });
  }

  if (judgeResults.length > 0) {
    const allWeaknesses = judgeResults.flatMap(j => j.weaknesses);
    const commonWeaknesses = getMostCommon(allWeaknesses, 5);
    if (commonWeaknesses.length > 0) {
      improvements.push({
        area: 'LLM Judge-Identified Weaknesses',
        currentState: `Common issues: ${commonWeaknesses.slice(0, 3).join('; ')}`,
        recommendation: `Focus on: ${commonWeaknesses.join('. ')}. These are patterns the LLM judge consistently flagged across scenarios.`,
        impact: 'high',
        effort: 'medium',
        priorityScore: 78,
      });
    }
  }

  improvements.push({
    area: 'Prompt Engineering',
    currentState: 'Current system prompts may not be optimized for voice interactions',
    recommendation: 'Optimize system prompts for conciseness (voice agents should be brief). Add explicit turn-taking instructions. Include filler phrases for natural pacing. Implement dynamic prompt selection based on call type.',
    impact: 'medium',
    effort: 'low',
    priorityScore: 70,
  });

  improvements.push({
    area: 'Caching Strategy',
    currentState: 'Limited LLM response caching',
    recommendation: 'Implement semantic response caching for frequently asked questions. Cache tool call results with appropriate TTL. Use embedding-based cache lookup for similar queries to reduce LLM calls.',
    impact: 'medium',
    effort: 'medium',
    priorityScore: 65,
  });

  return improvements.sort((a, b) => b.priorityScore - a.priorityScore);
}

function generateArchitecturalRecommendations(diploy: MetricSet, retell: MetricSet): string[] {
  const recs: string[] = [];

  recs.push('STREAMING: Implement token-level streaming from LLM → TTS → audio output to reduce perceived latency. Current batch processing adds unnecessary delay between response generation and audio delivery.');

  recs.push('EDGE CACHING: Deploy a semantic cache layer (Redis + embedding similarity) at the edge to serve common queries without LLM round-trips. Target 30-40% cache hit rate for support scenarios.');

  recs.push('CONNECTION POOLING: Maintain persistent WebSocket connections to LLM providers and TTS services. Connection setup adds 100-200ms per cold start that can be eliminated.');

  recs.push('PREFETCH & SPECULATION: Implement speculative response generation during user speech. Start generating likely responses based on partial transcription to reduce post-speech latency.');

  recs.push('TTS OPTIMIZATION: Pre-generate audio for common phrases (greetings, confirmations, hold messages). Use SSML for better pronunciation control. Consider lower-latency TTS models for initial words while higher-quality models process the full response.');

  recs.push('TOOL CALL PARALLELIZATION: When multiple tools are needed, execute independent tool calls in parallel rather than sequentially. This can reduce multi-tool scenarios by 40-60%.');

  recs.push('CONVERSATION STATE MACHINE: Implement an explicit state machine for conversation flow instead of relying purely on LLM context. This improves reliability for structured scenarios like appointment booking.');

  recs.push('ADAPTIVE MODEL SELECTION: Use faster/cheaper models (gpt-4o-mini) for simple queries and route complex queries to full models (gpt-4o). Implement a query complexity classifier for automatic routing.');

  recs.push('FAILOVER CHAIN: Implement automatic failover between LLM providers (OpenAI → Bedrock → Anthropic) with <500ms detection. Current single-provider dependency creates availability risk.');

  recs.push('OBSERVABILITY: Add distributed tracing across the full call pipeline (STT → LLM → Tool → TTS → Audio) with per-component latency tracking. This enables targeted optimization of the slowest components.');

  return recs;
}

function buildLLMJudgeSummary(results: LLMJudgeResult[]): LLMJudgeSummary {
  const allStrengths = results.flatMap(r => r.strengths);
  const allWeaknesses = results.flatMap(r => r.weaknesses);

  return {
    avgCoherence: round2(avg(results.map(r => r.coherenceScore))),
    avgResponseQuality: round2(avg(results.map(r => r.responseQuality))),
    avgNaturalness: round2(avg(results.map(r => r.naturalness))),
    avgInterruptionHandling: round2(avg(results.map(r => r.interruptionHandling))),
    taskCompletionRate: round2((results.filter(r => r.taskCompletionAssessment).length / results.length) * 100),
    topStrengths: getMostCommon(allStrengths, 5),
    topWeaknesses: getMostCommon(allWeaknesses, 5),
    verdicts: results.map(r => ({ scenarioId: r.scenarioId, verdict: r.overallVerdict })),
  };
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getMostCommon(items: string[], n: number): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!item) continue;
    const normalized = item.toLowerCase().trim();
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([item]) => item);
}

export function generateHumanReadableSummary(report: ComparisonReport): string {
  const lines: string[] = [];
  const { scoringTable, quantitative, qualitative, improvements, failureCases } = report;

  lines.push('═══════════════════════════════════════════════════════');
  lines.push('    COMPETITIVE BENCHMARK REPORT: DIPLOY vs RETELL    ');
  lines.push('═══════════════════════════════════════════════════════');
  lines.push(`Generated: ${report.metadata.generatedAt}`);
  lines.push(`Scenarios Tested: ${report.metadata.totalScenarios}`);
  lines.push(`Model Used: ${report.metadata.model}`);
  lines.push('');

  lines.push('─── OVERALL SCORING TABLE ───');
  lines.push(`Winner: ${scoringTable.overall.winner.toUpperCase()}`);
  lines.push('');
  lines.push(padRight('Metric', 30) + padRight('Diploy', 15) + padRight('Retell', 15) + 'Delta');
  lines.push('─'.repeat(75));
  lines.push(padRight('Composite Score', 30) + padRight(String(scoringTable.overall.diploy.compositeScore), 15) + padRight(String(scoringTable.overall.retell.compositeScore), 15) + String(scoringTable.overall.delta.composite));
  lines.push(padRight('Avg Latency (ms)', 30) + padRight(String(scoringTable.overall.diploy.avgLatencyMs), 15) + padRight(String(scoringTable.overall.retell.avgLatencyMs), 15) + String(scoringTable.overall.delta.latency));
  lines.push(padRight('Success Rate (%)', 30) + padRight(String(scoringTable.overall.diploy.successRate), 15) + padRight(String(scoringTable.overall.retell.successRate), 15) + String(scoringTable.overall.delta.successRate));
  lines.push(padRight('Tool Reliability (%)', 30) + padRight(String(scoringTable.overall.diploy.toolExecutionRate), 15) + padRight(String(scoringTable.overall.retell.toolExecutionRate), 15) + String(scoringTable.overall.delta.toolReliability));
  lines.push(padRight('Coherence (/10)', 30) + padRight(String(scoringTable.overall.diploy.coherenceScore), 15) + padRight(String(scoringTable.overall.retell.coherenceScore), 15) + String(scoringTable.overall.delta.coherence));
  lines.push('');

  lines.push('─── QUANTITATIVE COMPARISON ───');
  for (const [key, val] of Object.entries(quantitative)) {
    const v = val as { diploy: number; retell: number; delta: number; winner: string };
    lines.push(`${padRight(key, 25)} Diploy: ${padRight(String(v.diploy), 10)} Retell: ${padRight(String(v.retell), 10)} Winner: ${v.winner}`);
  }
  lines.push('');

  lines.push('─── QUALITATIVE ASSESSMENT ───');
  lines.push(qualitative.overallAssessment);
  lines.push('');

  if (report.llmJudgeResults) {
    lines.push('─── LLM JUDGE EVALUATION ───');
    const j = report.llmJudgeResults;
    lines.push(`Avg Coherence: ${j.avgCoherence}/10 | Avg Quality: ${j.avgResponseQuality}/10 | Avg Naturalness: ${j.avgNaturalness}/10`);
    lines.push(`Task Completion Rate: ${j.taskCompletionRate}%`);
    lines.push(`Top Strengths: ${j.topStrengths.join(', ')}`);
    lines.push(`Top Weaknesses: ${j.topWeaknesses.join(', ')}`);
    lines.push('');
  }

  lines.push('─── FAILURE CASES ───');
  if (failureCases.length === 0) {
    lines.push('No failures detected.');
  } else {
    for (const f of failureCases.slice(0, 10)) {
      lines.push(`[${f.severity.toUpperCase()}] ${f.scenarioName}: ${f.failureType} — ${f.description}`);
    }
    if (failureCases.length > 10) {
      lines.push(`... and ${failureCases.length - 10} more failures`);
    }
  }
  lines.push('');

  lines.push('─── TOP IMPROVEMENTS (by priority) ───');
  for (const imp of improvements.slice(0, 8)) {
    lines.push(`[${imp.impact.toUpperCase()} impact, ${imp.effort} effort] ${imp.area}`);
    lines.push(`  Current: ${imp.currentState}`);
    lines.push(`  Action: ${imp.recommendation}`);
    lines.push('');
  }

  lines.push('─── FEATURE PARITY ───');
  const diployAdvantages = report.featureParityChecklist.filter(f => f.diploy === 'yes' && f.retell !== 'yes');
  const retellAdvantages = report.featureParityChecklist.filter(f => f.retell === 'yes' && f.diploy !== 'yes');
  lines.push(`Diploy-exclusive features: ${diployAdvantages.length}`);
  for (const f of diployAdvantages) {
    lines.push(`  + ${f.feature}: ${f.notes}`);
  }
  lines.push(`Retell-exclusive features: ${retellAdvantages.length}`);
  for (const f of retellAdvantages) {
    lines.push(`  + ${f.feature}: ${f.notes}`);
  }
  lines.push('');

  lines.push('─── ARCHITECTURAL RECOMMENDATIONS ───');
  for (let i = 0; i < Math.min(5, report.architecturalRecommendations.length); i++) {
    lines.push(`${i + 1}. ${report.architecturalRecommendations[i]}`);
    lines.push('');
  }

  lines.push('═══════════════════════════════════════════════════════');
  lines.push('                    END OF REPORT                     ');
  lines.push('═══════════════════════════════════════════════════════');

  return lines.join('\n');
}

function padRight(str: string, len: number): string {
  return str.padEnd(len);
}
