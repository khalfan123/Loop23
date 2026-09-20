'use strict';
/**
 * Live call Supervisor wiring for Bedrock Polly turns.
 *
 * Maps awesome-ai-apps “manager / specialist handoff” patterns onto Loop9’s
 * existing Supervisor library without changing the Twilio media plane.
 */

import {
  Supervisor,
  KeywordRouter,
  createSharedState,
  type SharedState,
  type SpecialistAgent,
  type TurnRouting,
} from './supervisor';

export type CallSupervisorBundle = {
  supervisor: Supervisor;
  state: SharedState;
  turn: number;
};

const DEFAULT_SPECIALISTS: SpecialistAgent[] = [
  {
    id: 'general_support',
    role: 'Support',
    description: 'General inbound support and FAQs',
    keywords: ['help', 'support', 'question', 'info', 'مساعدة', 'مساعدة'],
    systemPrompt: 'You are the general support specialist. Be concise and phone-friendly.',
  },
  {
    id: 'billing',
    role: 'Billing',
    description: 'Invoices, payments, refunds',
    keywords: [
      'bill',
      'billing',
      'invoice',
      'payment',
      'refund',
      'charge',
      'فاتورة',
      'دفع',
    ],
    systemPrompt: 'You are the billing specialist. Confirm amounts carefully; offer transfer if payment fails.',
  },
  {
    id: 'scheduling',
    role: 'Scheduling',
    description: 'Appointments and availability',
    keywords: [
      'appoint',
      'schedule',
      'book',
      'booking',
      'reschedule',
      'موعد',
      'حجز',
    ],
    systemPrompt: 'You are the scheduling specialist. Prefer booking tools when available.',
  },
];

export function isCallSupervisorEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const v = (env.LOOP9_CALL_SUPERVISOR || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function createDefaultCallSupervisor(
  callSid: string,
  locale?: string,
  specialists: SpecialistAgent[] = DEFAULT_SPECIALISTS,
): CallSupervisorBundle {
  const supervisor = new Supervisor({
    router: new KeywordRouter(),
    maxHandoffs: 4,
  });
  supervisor.registerAll(specialists);
  const state = createSharedState(callSid, locale);
  // Start on general support so first turn has an active specialist.
  state.activeSpecialist = specialists[0]?.id;
  return { supervisor, state, turn: 0 };
}

/**
 * Route one user utterance. Returns handoff metadata for prompt injection /
 * transfer_to_agent continuity (context-preserving handoff).
 */
export async function routeCallSupervisorTurn(
  bundle: CallSupervisorBundle,
  userText: string,
  opts?: { requestedSpecialist?: string; reason?: string },
): Promise<TurnRouting & { specialistPromptHint: string }> {
  bundle.turn += 1;
  const routing = await bundle.supervisor.routeTurn(userText, bundle.state, {
    turn: bundle.turn,
    requestedSpecialist: opts?.requestedSpecialist,
    reason: opts?.reason,
  });

  const specialistPromptHint = routing.handedOff
    ? `[Supervisor handoff] Now speaking as ${routing.specialist.role} (${routing.specialist.id}). Reason: ${routing.decision.reason}. Preserve prior context; do not re-ask known slots.`
    : `[Supervisor] Active specialist: ${routing.specialist.role} (${routing.specialist.id}).`;

  return { ...routing, specialistPromptHint };
}

export { DEFAULT_SPECIALISTS };
