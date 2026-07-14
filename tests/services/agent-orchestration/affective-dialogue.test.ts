import { describe, it, expect } from 'vitest';
import {
  AdaptiveDialoguePolicy,
  renderStyleDirective,
  type DialogueDirective,
} from '../../../server/services/agent-orchestration/affective-dialogue';

const policy = new AdaptiveDialoguePolicy();

describe('AdaptiveDialoguePolicy.decide — affect', () => {
  it('handles a frustrated caller with apology, high empathy, slow + concise delivery', () => {
    const d = policy.decide({ sentiment: 'negative', frustration: 0.8 });
    expect(d.tone).toBe('apologetic');
    expect(d.empathyLevel).toBe(3);
    expect(d.acknowledgeEmotion).toBe(true);
    expect(d.pace).toBe('slow');
    expect(d.verbosity).toBe('concise');
  });

  it('treats a raised voice / profanity cue as high frustration even without a score', () => {
    const d = policy.decide({ sentiment: 'neutral', cues: ['raised_voice'] });
    expect(d.tone).toBe('apologetic');
    expect(d.empathyLevel).toBe(3);
  });

  it('responds to mild negative sentiment with empathy (not apology)', () => {
    const d = policy.decide({ sentiment: 'negative', frustration: 0.2 });
    expect(d.tone).toBe('empathetic');
    expect(d.empathyLevel).toBe(2);
    expect(d.acknowledgeEmotion).toBe(true);
  });

  it('matches positive energy, and celebrates on gratitude', () => {
    expect(policy.decide({ sentiment: 'positive' }).tone).toBe('warm');
    expect(policy.decide({ sentiment: 'neutral', cues: ['gratitude'] }).tone).toBe('celebratory');
  });

  it('defaults neutral turns to a warm tone', () => {
    const d = policy.decide({ sentiment: 'neutral' });
    expect(d.tone).toBe('warm');
    expect(d.empathyLevel).toBe(1);
  });
});

describe('AdaptiveDialoguePolicy.decide — cross-call memory', () => {
  it('proactively reassures a returning caller with prior negative history', () => {
    const d = policy.decide({ sentiment: 'neutral' }, { callCount: 3, priorSentiment: 'negative' });
    expect(d.tone).toBe('reassuring');
    expect(d.empathyLevel).toBeGreaterThanOrEqual(2);
  });

  it('gives VIP callers white-glove (detailed) handling', () => {
    const d = policy.decide({ sentiment: 'neutral' }, { tier: 'vip' });
    expect(d.verbosity).toBe('detailed');
    expect(d.reasons.some(r => /white-glove/.test(r))).toBe(true);
  });

  it('personalizes with name, language, returning status, and known summary', () => {
    const d = policy.decide(
      { sentiment: 'neutral' },
      { name: 'Sara', preferredLanguage: 'ar-AE', callCount: 2, summary: 'Wants to upgrade to Pro.' }
    );
    expect(d.personalizations.some(p => p.includes('Sara'))).toBe(true);
    expect(d.personalizations.some(p => p.includes('ar-AE'))).toBe(true);
    expect(d.personalizations.some(p => /returning caller/i.test(p))).toBe(true);
    expect(d.personalizations.some(p => /upgrade to Pro/.test(p))).toBe(true);
  });
});

describe('AdaptiveDialoguePolicy.decide — dynamics & escalation', () => {
  it('tightens replies when responses are slow', () => {
    const d = policy.decide({ sentiment: 'neutral' }, {}, { avgResponseLatencyMs: 2000 });
    expect(d.verbosity).toBe('concise');
  });

  it('tightens replies on long conversations', () => {
    const d = policy.decide({ sentiment: 'positive' }, {}, { turn: 8 });
    expect(d.verbosity).toBe('concise');
  });

  it('escalates and offers a human after repeated unresolved negative turns', () => {
    const d = policy.decide({ sentiment: 'negative', frustration: 0.7 }, {}, { unresolvedTurns: 3 });
    expect(d.escalate).toBe(true);
    expect(d.offerHuman).toBe(true);
  });

  it('offers a human to a frustrated caller repeating themselves, without full escalation', () => {
    const d = policy.decide({ sentiment: 'negative', frustration: 0.8, cues: ['repeated_question'] }, {}, { unresolvedTurns: 1 });
    expect(d.offerHuman).toBe(true);
    expect(d.escalate).toBe(false);
  });

  it('does not escalate a calm, resolved-track conversation', () => {
    const d = policy.decide({ sentiment: 'neutral' }, {}, { unresolvedTurns: 0 });
    expect(d.escalate).toBe(false);
    expect(d.offerHuman).toBe(false);
  });
});

describe('renderStyleDirective', () => {
  it('reflects the directive as promptable instructions', () => {
    const base: DialogueDirective = {
      tone: 'apologetic',
      pace: 'slow',
      verbosity: 'concise',
      empathyLevel: 3,
      acknowledgeEmotion: true,
      escalate: false,
      offerHuman: true,
      personalizations: ['Address the caller by name ("Sara") once, naturally.'],
      reasons: [],
      styleDirective: '',
    };
    const text = renderStyleDirective(base);
    expect(text).toMatch(/apologize/i);
    expect(text).toMatch(/acknowledge how the caller is feeling/i);
    expect(text).toMatch(/short and concrete/i);
    expect(text).toMatch(/offer to connect the caller with a human/i);
    expect(text).toMatch(/Sara/);
  });

  it('is populated on every decision for direct prompt injection', () => {
    const d = policy.decide({ sentiment: 'negative', frustration: 0.9 }, { name: 'Omar' });
    expect(d.styleDirective.length).toBeGreaterThan(0);
    expect(d.styleDirective).toMatch(/Omar/);
  });
});
