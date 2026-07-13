/**
 * ============================================================
 * Human-grade conversation — affective & adaptive dialogue policy
 *
 * Cross-call memory persistence already exists (ConversationMemoryService /
 * callerMemory). This module supplies the other half of the pillar: given
 * the caller's memory context PLUS live affect signals, it decides HOW the
 * agent should speak this turn — tone, pace, verbosity, empathy, and whether
 * to acknowledge emotion or escalate — and renders a compact style directive
 * to inject into the system prompt.
 *
 * It is a deterministic rule engine over STRUCTURAL inputs (the existing
 * CallerContext satisfies CallerMemoryContext), so it is dependency-free and
 * fully testable, and an ML affect model can later feed EmotionSignal without
 * changing this policy.
 * ============================================================
 */

export type Sentiment = 'positive' | 'neutral' | 'negative';

/** Live, per-turn affect signal (from sentiment analysis / prosody / cues). */
export interface EmotionSignal {
  sentiment: Sentiment;
  /** 0..1 how agitated/frustrated the caller sounds (optional). */
  frustration?: number;
  /** Discrete cues detected this turn. */
  cues?: Array<'repeated_question' | 'raised_voice' | 'long_silence' | 'interruption' | 'profanity' | 'gratitude'>;
}

/** Structural view of the caller's cross-call memory (CallerContext satisfies it). */
export interface CallerMemoryContext {
  name?: string;
  preferredLanguage?: string;
  /** Number of prior calls (0/undefined = brand new). */
  callCount?: number;
  tier?: 'standard' | 'premium' | 'vip' | string;
  /** Dominant sentiment across prior calls, if known. */
  priorSentiment?: Sentiment;
  /** Short recap of what the platform already knows about this caller. */
  summary?: string;
}

/** Conversation dynamics for this call so far. */
export interface DialogueDynamics {
  turn?: number;
  unresolvedTurns?: number;
  avgResponseLatencyMs?: number;
}

export type Tone = 'warm' | 'empathetic' | 'reassuring' | 'efficient' | 'apologetic' | 'celebratory' | 'neutral';

export interface DialogueDirective {
  tone: Tone;
  pace: 'slow' | 'normal';
  verbosity: 'concise' | 'normal' | 'detailed';
  /** 0 none … 3 high. */
  empathyLevel: 0 | 1 | 2 | 3;
  acknowledgeEmotion: boolean;
  escalate: boolean;
  offerHuman: boolean;
  /** Memory-driven personal touches (use name, reference history, language). */
  personalizations: string[];
  /** Ordered, human-readable reasons the policy fired (for observability). */
  reasons: string[];
  /** Compact instruction to prepend to the agent's system prompt this turn. */
  styleDirective: string;
}

export interface AffectivePolicyOptions {
  /** frustration ≥ this ⇒ high-empathy handling. Default 0.6. */
  frustrationHigh?: number;
  /** unresolved turns ≥ this (with negative affect) ⇒ offer a human. Default 3. */
  escalateAfterUnresolved?: number;
  /** avg latency ≥ this ⇒ bias toward concise replies. Default 1500ms. */
  slowLatencyMs?: number;
}

const DEFAULTS: Required<AffectivePolicyOptions> = {
  frustrationHigh: 0.6,
  escalateAfterUnresolved: 3,
  slowLatencyMs: 1500,
};

export class AdaptiveDialoguePolicy {
  private o: Required<AffectivePolicyOptions>;
  constructor(opts: AffectivePolicyOptions = {}) {
    this.o = { ...DEFAULTS, ...opts };
  }

  decide(
    emotion: EmotionSignal,
    memory: CallerMemoryContext = {},
    dynamics: DialogueDynamics = {}
  ): DialogueDirective {
    const reasons: string[] = [];
    const cues = new Set(emotion.cues ?? []);
    const frustration = emotion.frustration ?? (emotion.sentiment === 'negative' ? 0.5 : 0);
    const highFrustration =
      frustration >= this.o.frustrationHigh || cues.has('raised_voice') || cues.has('profanity');
    const returning = (memory.callCount ?? 0) > 0;
    const vip = memory.tier === 'vip' || memory.tier === 'premium';
    const unresolved = dynamics.unresolvedTurns ?? 0;

    let tone: Tone = 'neutral';
    let empathyLevel: DialogueDirective['empathyLevel'] = 0;
    let acknowledgeEmotion = false;
    let escalate = false;
    let offerHuman = false;
    let pace: DialogueDirective['pace'] = 'normal';
    let verbosity: DialogueDirective['verbosity'] = 'normal';

    // --- Affect-driven tone ---
    if (highFrustration) {
      tone = 'apologetic';
      empathyLevel = 3;
      acknowledgeEmotion = true;
      pace = 'slow';
      verbosity = 'concise';
      reasons.push('caller is frustrated — apologize, acknowledge, keep it short');
    } else if (emotion.sentiment === 'negative') {
      tone = 'empathetic';
      empathyLevel = 2;
      acknowledgeEmotion = true;
      reasons.push('negative sentiment — respond with empathy');
    } else if (emotion.sentiment === 'positive' || cues.has('gratitude')) {
      tone = 'warm';
      empathyLevel = 1;
      if (cues.has('gratitude')) {
        tone = 'celebratory';
        reasons.push('caller expressed gratitude — match their positive energy');
      } else {
        reasons.push('positive sentiment — stay warm');
      }
    } else {
      tone = 'warm';
      empathyLevel = 1;
      reasons.push('neutral — default to a warm, helpful tone');
    }

    // --- Cross-call memory adaptation ---
    if (returning && memory.priorSentiment === 'negative' && !highFrustration) {
      tone = 'reassuring';
      empathyLevel = Math.max(empathyLevel, 2) as DialogueDirective['empathyLevel'];
      reasons.push('returning caller with prior negative history — proactively reassure');
    }
    if (vip) {
      verbosity = highFrustration ? 'concise' : 'detailed';
      reasons.push(`${memory.tier} tier — white-glove handling`);
    }

    // --- Dialogue dynamics adaptation ---
    if ((dynamics.avgResponseLatencyMs ?? 0) >= this.o.slowLatencyMs) {
      verbosity = 'concise';
      reasons.push('responses are running slow — keep replies concise');
    }
    if ((dynamics.turn ?? 0) >= 6 && verbosity !== 'concise') {
      verbosity = 'concise';
      reasons.push('long conversation — tighten replies to respect the caller\'s time');
    }

    // --- Escalation ---
    const negativeAffect = highFrustration || emotion.sentiment === 'negative';
    if (negativeAffect && unresolved >= this.o.escalateAfterUnresolved) {
      escalate = true;
      offerHuman = true;
      reasons.push(`${unresolved} unresolved turns with negative affect — offer a human`);
    } else if (highFrustration && (cues.has('repeated_question') || vip)) {
      offerHuman = true;
      reasons.push('frustrated' + (vip ? ' VIP' : ' repeat') + ' caller — proactively offer a human');
    }

    const personalizations = this.personalizations(memory, cues);
    const styleDirective = renderStyleDirective(
      { tone, pace, verbosity, empathyLevel, acknowledgeEmotion, escalate, offerHuman, personalizations, reasons, styleDirective: '' },
      memory
    );

    return { tone, pace, verbosity, empathyLevel, acknowledgeEmotion, escalate, offerHuman, personalizations, reasons, styleDirective };
  }

  private personalizations(memory: CallerMemoryContext, cues: Set<string>): string[] {
    const p: string[] = [];
    if (memory.name) p.push(`Address the caller by name ("${memory.name}") once, naturally.`);
    if (memory.preferredLanguage) p.push(`Respond in the caller's preferred language (${memory.preferredLanguage}).`);
    if ((memory.callCount ?? 0) > 0) {
      p.push('Acknowledge that this is a returning caller; do not ask for details already on file.');
    }
    if (memory.summary) p.push(`Draw on what is already known: ${memory.summary}`);
    return p;
  }
}

const TONE_INSTRUCTION: Record<Tone, string> = {
  warm: 'Be warm, friendly, and helpful.',
  empathetic: 'Lead with empathy; validate the caller\'s concern before solving it.',
  reassuring: 'Be calm and reassuring; project confidence that this will be resolved.',
  efficient: 'Be crisp and efficient; get to the resolution quickly.',
  apologetic: 'Sincerely apologize for the trouble, then focus on making it right.',
  celebratory: 'Match the caller\'s positive energy and celebrate the good outcome.',
  neutral: 'Keep a professional, helpful tone.',
};

/** Compose the promptable style directive from a directive + memory. */
export function renderStyleDirective(d: DialogueDirective, _memory: CallerMemoryContext = {}): string {
  const parts: string[] = [TONE_INSTRUCTION[d.tone]];
  if (d.acknowledgeEmotion) parts.push('Explicitly acknowledge how the caller is feeling.');
  if (d.empathyLevel >= 3) parts.push('Use a high degree of empathy.');
  if (d.pace === 'slow') parts.push('Slow your pacing; do not rush the caller.');
  if (d.verbosity === 'concise') parts.push('Keep responses short and concrete; avoid jargon.');
  else if (d.verbosity === 'detailed') parts.push('Offer thorough, detailed guidance.');
  if (d.offerHuman) parts.push('Proactively offer to connect the caller with a human agent.');
  if (d.escalate) parts.push('Treat this as an escalation.');
  for (const p of d.personalizations) parts.push(p);
  return parts.join(' ');
}
