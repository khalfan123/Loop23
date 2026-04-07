export interface RetellBaseline {
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  avgTurnsToCompletion: number;
  successRate: number;
  interruptionHandlingScore: number;
  voiceNaturalnessScore: number;
  toolExecutionReliability: number;
  errorRecoveryRate: number;
  coherenceScore: number;
  wordErrorRate: number;
}

export interface RetellCategoryBaseline extends RetellBaseline {
  category: string;
}

const BASE_RETELL_METRICS: RetellBaseline = {
  avgLatencyMs: 800,
  p50LatencyMs: 650,
  p95LatencyMs: 1400,
  p99LatencyMs: 2200,
  avgTurnsToCompletion: 4.2,
  successRate: 92.5,
  interruptionHandlingScore: 8.5,
  voiceNaturalnessScore: 8.8,
  toolExecutionReliability: 94.0,
  errorRecoveryRate: 88.0,
  coherenceScore: 8.7,
  wordErrorRate: 4.2,
};

export const RETELL_CATEGORY_BASELINES: Record<string, RetellCategoryBaseline> = {
  customer_support: {
    ...BASE_RETELL_METRICS,
    category: 'customer_support',
    avgLatencyMs: 750,
    p50LatencyMs: 600,
    successRate: 94.0,
    avgTurnsToCompletion: 4.5,
    coherenceScore: 8.9,
    toolExecutionReliability: 95.0,
  },
  appointment_booking: {
    ...BASE_RETELL_METRICS,
    category: 'appointment_booking',
    avgLatencyMs: 700,
    p50LatencyMs: 580,
    successRate: 96.0,
    avgTurnsToCompletion: 3.8,
    coherenceScore: 9.0,
    toolExecutionReliability: 96.0,
  },
  lead_qualification: {
    ...BASE_RETELL_METRICS,
    category: 'lead_qualification',
    avgLatencyMs: 850,
    p50LatencyMs: 700,
    successRate: 88.0,
    avgTurnsToCompletion: 4.8,
    coherenceScore: 8.5,
    toolExecutionReliability: 92.0,
  },
};

export const RETELL_OVERALL_BASELINE = BASE_RETELL_METRICS;

export const RETELL_DOCUMENTED_FEATURES = {
  llmProviders: ['OpenAI', 'Anthropic', 'Azure', 'Custom LLM'],
  voiceProviders: ['ElevenLabs', 'OpenAI', 'Deepgram', 'PlayHT', 'Azure'],
  telephonyProviders: ['Twilio', 'Vonage', 'Custom SIP'],
  keyCapabilities: [
    'Sub-second latency with streaming',
    'Native interruption handling',
    'Multi-turn conversation state',
    'Function/tool calling',
    'Call transfer to human',
    'Real-time transcription',
    'Custom pronunciation',
    'Webhook notifications',
    'Batch calling',
    'Concurrent call handling',
  ],
  pricingModel: 'Per-minute billing',
  maxConcurrentCalls: 1000,
  supportedLanguages: 30,
  apiType: 'REST + WebSocket',
};

export const RETELL_KNOWN_WEAKNESSES = [
  'Limited custom model fine-tuning',
  'No built-in RAG/knowledge base (requires external setup)',
  'Higher per-minute cost at scale',
  'Less control over conversation flow logic',
  'No built-in campaign management',
  'Limited CRM integration out of the box',
  'No native IVR system',
  'Single-tenant architecture for most plans',
];

export const RETELL_KNOWN_STRENGTHS = [
  'Very low latency voice responses (~800ms avg)',
  'Excellent voice quality via ElevenLabs integration',
  'Simple API with quick setup',
  'Good documentation and SDKs',
  'Native interruption handling',
  'Robust WebSocket audio streaming',
  'Built-in call analytics',
  'Easy function calling integration',
];

export function getRetellBaselineForCategory(category: string): RetellCategoryBaseline {
  return RETELL_CATEGORY_BASELINES[category] || {
    ...BASE_RETELL_METRICS,
    category,
  };
}

function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    return h / 0x7fffffff;
  };
}

export function generateSimulatedRetellResult(scenarioId: string, difficulty: string) {
  const rng = seededRandom(scenarioId + difficulty);
  const jitter = () => (rng() - 0.5) * 0.2;
  const difficultyMultiplier = difficulty === 'easy' ? 0.85 : difficulty === 'medium' ? 1.0 : 1.2;

  return {
    scenarioId,
    provider: 'retell' as const,
    latencyMs: Math.round(BASE_RETELL_METRICS.avgLatencyMs * difficultyMultiplier * (1 + jitter())),
    turnsToCompletion: Math.round(BASE_RETELL_METRICS.avgTurnsToCompletion * difficultyMultiplier * (1 + jitter() * 0.5)),
    taskCompleted: rng() < (BASE_RETELL_METRICS.successRate / 100) * (difficulty === 'hard' ? 0.9 : 1),
    toolCallsSucceeded: rng() < (BASE_RETELL_METRICS.toolExecutionReliability / 100),
    coherenceScore: Math.min(10, Math.max(1, BASE_RETELL_METRICS.coherenceScore * (1 + jitter() * 0.1))),
    responseQuality: Math.min(10, Math.max(1, 8.5 * (1 + jitter() * 0.1))),
    naturalness: Math.min(10, Math.max(1, BASE_RETELL_METRICS.voiceNaturalnessScore * (1 + jitter() * 0.1))),
    interruptionHandling: Math.min(10, Math.max(1, BASE_RETELL_METRICS.interruptionHandlingScore * (1 + jitter() * 0.1))),
    errorRecovery: rng() < (BASE_RETELL_METRICS.errorRecoveryRate / 100),
    wordErrorRate: Math.max(0, BASE_RETELL_METRICS.wordErrorRate * (1 + jitter())),
  };
}
