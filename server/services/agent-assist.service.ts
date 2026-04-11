'use strict';

import { RealtimeSentimentService, type SentimentLevel } from './realtime-sentiment.service';

export interface AgentAssistConfig {
  enabled?: boolean;
  sensitivity?: 'low' | 'medium' | 'high';
  complianceRules?: {
    requiredPhrases?: string[];
    bannedPhrases?: string[];
    disclosures?: string[];
  };
  requiredSteps?: Array<{
    id: string;
    name: string;
    description: string;
    order: number;
  }>;
}

export interface AgentAssistState {
  completedSteps: Set<string>;
  previousInterventions: string[];
  recentComplianceAlerts: Set<string>;
  lastSentimentLevel: string;
  pendingSuggestion?: string;
  turnsSinceLastIntervention: number;
  assistEvents: Array<{
    type: 'compliance_alert' | 'step_completed' | 'step_missed' | 'sentiment_shift' | 'intervention';
    detail: string;
    timestamp: Date;
  }>;
}

export interface AssistDecision {
  shouldIntervene: boolean;
  suggestion?: string;
  events: Array<{
    type: 'compliance_alert' | 'step_completed' | 'step_missed' | 'sentiment_shift' | 'intervention';
    detail: string;
  }>;
  stepsCompleted: string[];
  stepsPending: string[];
  priority: 'compliance' | 'resolution' | 'experience' | 'none';
}

interface ConversationMessage {
  role: string;
  content: string;
}

const SENSITIVITY_THRESHOLDS: Record<string, { minTurnsBetween: number; sentimentDropThreshold: number }> = {
  low: { minTurnsBetween: 4, sentimentDropThreshold: -6 },
  medium: { minTurnsBetween: 2, sentimentDropThreshold: -4 },
  high: { minTurnsBetween: 1, sentimentDropThreshold: -2 },
};

export class AgentAssistService {
  static createState(): AgentAssistState {
    return {
      completedSteps: new Set(),
      previousInterventions: [],
      recentComplianceAlerts: new Set(),
      lastSentimentLevel: 'neutral',
      turnsSinceLastIntervention: 0,
      assistEvents: [],
    };
  }

  static analyze(
    config: AgentAssistConfig,
    state: AgentAssistState,
    messages: ConversationMessage[],
    latestTranscription: string,
    callId: string,
    language: string = 'en',
  ): AssistDecision {
    if (!config.enabled) {
      return { shouldIntervene: false, events: [], stepsCompleted: [], stepsPending: [], priority: 'none' };
    }

    const sensitivity = config.sensitivity || 'medium';
    const thresholds = SENSITIVITY_THRESHOLDS[sensitivity] || SENSITIVITY_THRESHOLDS.medium;
    const events: AssistDecision['events'] = [];
    let highestPriority: AssistDecision['priority'] = 'none';
    let suggestion: string | undefined;

    const complianceResult = this.checkCompliance(config, messages, latestTranscription);
    if (complianceResult.violations.length > 0) {
      for (const v of complianceResult.violations) {
        if (!state.recentComplianceAlerts.has(v)) {
          events.push({ type: 'compliance_alert', detail: v });
          state.assistEvents.push({ type: 'compliance_alert', detail: v, timestamp: new Date() });
          state.recentComplianceAlerts.add(v);
        }
      }
      if (events.some(e => e.type === 'compliance_alert') && !suggestion) {
        suggestion = complianceResult.suggestion;
        highestPriority = 'compliance';
      }
    }
    if (complianceResult.violations.length === 0) {
      state.recentComplianceAlerts.clear();
    }

    const stepResult = this.trackSteps(config, state, messages, latestTranscription);
    for (const completed of stepResult.newlyCompleted) {
      events.push({ type: 'step_completed', detail: `Step completed: ${completed}` });
      state.assistEvents.push({ type: 'step_completed', detail: `Step completed: ${completed}`, timestamp: new Date() });
    }

    const sentimentResult = this.detectSentimentShift(state, callId, language);
    if (sentimentResult.shifted) {
      events.push({ type: 'sentiment_shift', detail: sentimentResult.detail });
      state.assistEvents.push({ type: 'sentiment_shift', detail: sentimentResult.detail, timestamp: new Date() });
      if (highestPriority === 'none' && !suggestion) {
        suggestion = sentimentResult.suggestion;
        highestPriority = 'experience';
      }
    }

    const turnCount = messages.filter(m => m.role === 'user').length;
    if (highestPriority === 'none' && !suggestion && stepResult.missedSteps.length > 0 && turnCount > 3) {
      const nextStep = stepResult.missedSteps[0];
      suggestion = `Address: ${nextStep.name}`;
      highestPriority = 'resolution';
      events.push({ type: 'step_missed', detail: `Pending step: ${nextStep.name}` });
    }

    state.turnsSinceLastIntervention++;

    let shouldIntervene = false;
    if (suggestion && highestPriority !== 'none') {
      if (highestPriority === 'compliance') {
        shouldIntervene = true;
      } else if (state.turnsSinceLastIntervention >= thresholds.minTurnsBetween) {
        if (!state.previousInterventions.includes(suggestion)) {
          shouldIntervene = true;
        }
      }
    }

    if (shouldIntervene && suggestion) {
      state.pendingSuggestion = suggestion;
      state.previousInterventions.push(suggestion);
      if (state.previousInterventions.length > 20) {
        state.previousInterventions = state.previousInterventions.slice(-10);
      }
      state.turnsSinceLastIntervention = 0;
      events.push({ type: 'intervention', detail: suggestion });
      state.assistEvents.push({ type: 'intervention', detail: suggestion, timestamp: new Date() });
    }

    return {
      shouldIntervene,
      suggestion: shouldIntervene ? suggestion : undefined,
      events,
      stepsCompleted: Array.from(state.completedSteps),
      stepsPending: stepResult.missedSteps.map(s => s.name),
      priority: highestPriority,
    };
  }

  private static checkCompliance(
    config: AgentAssistConfig,
    messages: ConversationMessage[],
    latestTranscription: string,
  ): { violations: string[]; suggestion?: string } {
    const violations: string[] = [];
    let suggestion: string | undefined;
    const rules = config.complianceRules;
    if (!rules) return { violations };

    const agentMessages = messages.filter(m => m.role === 'assistant').map(m => m.content.toLowerCase());
    const allAgentText = agentMessages.join(' ');
    const userText = messages.filter(m => m.role === 'user').map(m => m.content.toLowerCase()).join(' ') + ' ' + latestTranscription.toLowerCase();

    if (rules.bannedPhrases && rules.bannedPhrases.length > 0) {
      const lastAgentMsg = agentMessages[agentMessages.length - 1] || '';
      for (const phrase of rules.bannedPhrases) {
        if (phrase && lastAgentMsg.includes(phrase.toLowerCase())) {
          violations.push(`Banned phrase used: "${phrase}"`);
          if (!suggestion) {
            suggestion = `Avoid saying "${phrase.substring(0, 20)}"`;
          }
        }
      }
    }

    if (rules.requiredPhrases && rules.requiredPhrases.length > 0) {
      const turnCount = messages.filter(m => m.role === 'user').length;
      if (turnCount >= 1) {
        for (const phrase of rules.requiredPhrases) {
          if (phrase && !allAgentText.includes(phrase.toLowerCase())) {
            violations.push(`Required phrase not yet said: "${phrase}"`);
            if (!suggestion) {
              suggestion = `Remember to say: ${phrase.substring(0, 30)}`;
            }
          }
        }
      }
    }

    if (rules.disclosures && rules.disclosures.length > 0) {
      const turnCount = messages.filter(m => m.role === 'user').length;
      if (turnCount >= 2) {
        for (const disclosure of rules.disclosures) {
          if (disclosure && !allAgentText.includes(disclosure.toLowerCase())) {
            violations.push(`Missing disclosure: "${disclosure}"`);
            if (!suggestion) {
              suggestion = `Must disclose: ${disclosure.substring(0, 30)}`;
            }
          }
        }
      }
    }

    return { violations, suggestion };
  }

  private static trackSteps(
    config: AgentAssistConfig,
    state: AgentAssistState,
    messages: ConversationMessage[],
    latestTranscription: string,
  ): { newlyCompleted: string[]; missedSteps: Array<{ id: string; name: string; description: string; order: number }> } {
    const steps = config.requiredSteps;
    if (!steps || steps.length === 0) {
      return { newlyCompleted: [], missedSteps: [] };
    }

    const allText = messages.map(m => m.content.toLowerCase()).join(' ') + ' ' + latestTranscription.toLowerCase();
    const newlyCompleted: string[] = [];

    const sortedSteps = [...steps].sort((a, b) => a.order - b.order);

    for (const step of sortedSteps) {
      if (state.completedSteps.has(step.id)) continue;

      const stepKeywords = step.name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const descKeywords = step.description.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const allKeywords = [...stepKeywords, ...descKeywords];

      if (allKeywords.length === 0) continue;

      const matchCount = allKeywords.filter(kw => allText.includes(kw)).length;
      const matchRatio = matchCount / allKeywords.length;

      if (matchRatio >= 0.4) {
        state.completedSteps.add(step.id);
        newlyCompleted.push(step.name);
      }
    }

    const missedSteps = sortedSteps.filter(s => !state.completedSteps.has(s.id));

    return { newlyCompleted, missedSteps };
  }

  private static detectSentimentShift(
    state: AgentAssistState,
    callId: string,
    language: string,
  ): { shifted: boolean; detail: string; suggestion?: string } {
    const currentLevel = RealtimeSentimentService.getCurrentLevel(callId);
    const prevLevel = state.lastSentimentLevel;
    state.lastSentimentLevel = currentLevel;

    const levelValues: Record<string, number> = {
      positive: 2,
      neutral: 1,
      cautious: 0,
      negative: -1,
      critical: -2,
    };

    const prevValue = levelValues[prevLevel] ?? 1;
    const currentValue = levelValues[currentLevel] ?? 1;
    const delta = currentValue - prevValue;

    if (delta <= -2) {
      const suggestions: Record<string, string> = {
        en: 'Acknowledge concern and offer resolution',
        ar: 'اعترف بالقلق واعرض حلاً',
        es: 'Reconoce la preocupación y ofrece solución',
        fr: 'Reconnaître le problème et proposer une solution',
        hi: 'चिंता स्वीकार करें और समाधान दें',
      };
      const lang = language.substring(0, 2);
      return {
        shifted: true,
        detail: `Sentiment dropped: ${prevLevel} → ${currentLevel}`,
        suggestion: suggestions[lang] || suggestions.en,
      };
    }

    return { shifted: false, detail: '' };
  }

  static buildAssistDirective(suggestion: string): string {
    return `\n\nAGENT ASSIST DIRECTIVE (internal — do not repeat verbatim to caller):
${suggestion}`;
  }

  static getPostCallSummary(state: AgentAssistState | undefined): {
    totalInterventions: number;
    complianceAlerts: number;
    stepsCompleted: string[];
    events: Array<{ type: string; detail: string; timestamp: Date }>;
  } | null {
    if (!state) return null;
    return {
      totalInterventions: state.assistEvents.filter(e => e.type === 'intervention').length,
      complianceAlerts: state.assistEvents.filter(e => e.type === 'compliance_alert').length,
      stepsCompleted: Array.from(state.completedSteps),
      events: state.assistEvents,
    };
  }
}
