/**
 * ============================================================
 * Ops Center — conversation-signals bridge
 *
 * Normalizes the various per-call analysis outputs (CallInsights,
 * RealtimeSentiment levels, QA analysis) into the voice-core
 * ConversationSignal the MetricsRecorder aggregates, so the Operations
 * Center's sentiment / intent / confidence / CSAT / compliance view is fed
 * from the real call pipeline instead of staying empty.
 *
 * Pure mappers — dependency-free and testable. The call site records the
 * returned signal via voiceMetrics.recordConversationSignal().
 * ============================================================
 */

import type { ConversationSignal, Sentiment } from '../voice-core';
import type { EmotionSignal } from './agent-orchestration/affective-dialogue';

/** RealtimeSentimentService uses a 5-level scale; collapse to the 3-level ops scale. */
export type SentimentLevel = 'positive' | 'neutral' | 'cautious' | 'negative' | 'critical' | string;

export function normalizeSentiment(level: SentimentLevel | undefined | null): Sentiment | undefined {
  switch (level) {
    case 'positive':
      return 'positive';
    case 'neutral':
    case 'cautious': // conservative: don't inflate the negative rate on merely-cautious calls
      return 'neutral';
    case 'negative':
    case 'critical':
      return 'negative';
    default:
      return undefined;
  }
}

/**
 * Map a live 5-level sentiment reading to the affective policy's EmotionSignal
 * (3-level sentiment + a frustration estimate), so RealtimeSentimentService can
 * drive AdaptiveDialoguePolicy for live adaptive delivery.
 */
export function sentimentLevelToEmotion(level: SentimentLevel | undefined | null): EmotionSignal {
  switch (level) {
    case 'positive':
      return { sentiment: 'positive', frustration: 0 };
    case 'cautious':
      return { sentiment: 'negative', frustration: 0.3 };
    case 'negative':
      return { sentiment: 'negative', frustration: 0.55 };
    case 'critical':
      return { sentiment: 'negative', frustration: 0.85 };
    case 'neutral':
    default:
      return { sentiment: 'neutral', frustration: 0 };
  }
}

/** Shape of the finalized CallInsights we consume (structural — avoids a hard import). */
export interface CallInsightsLike {
  sentiment?: SentimentLevel;
  /** Lead temperature / outcome; the closest categorical intent signal we have. */
  classification?: string;
}

/**
 * Map a finalized call's insights (+ any optionally-available confidence /
 * CSAT / compliance signals) into a ConversationSignal. Fields with no source
 * are left undefined so the recorder only averages over what actually exists.
 */
export function insightsToSignal(
  callSid: string,
  insights: CallInsightsLike | null | undefined,
  extra: { confidence?: number; csat?: number; complianceIssue?: boolean; at?: number } = {}
): ConversationSignal {
  const signal: ConversationSignal = { callSid };
  const sentiment = normalizeSentiment(insights?.sentiment);
  if (sentiment) signal.sentiment = sentiment;
  const intent = insights?.classification?.trim();
  if (intent) signal.intent = intent;
  if (typeof extra.confidence === 'number') signal.confidence = extra.confidence;
  if (typeof extra.csat === 'number') signal.csat = extra.csat;
  if (extra.complianceIssue) signal.complianceIssue = true;
  if (typeof extra.at === 'number') signal.at = extra.at;
  return signal;
}
