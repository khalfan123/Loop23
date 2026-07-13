/**
 * React binding for the pure WizardFlow engine. Keeps the validation-gated
 * flow logic in one tested place (see client/src/lib/wizard-flow.ts) and gives
 * components a small imperative API + a derived view for rendering.
 */
import { useCallback, useReducer, useRef } from 'react';
import {
  WizardFlow,
  type WizardStepDef,
  type WizardState,
  type WizardView,
} from '@/lib/wizard-flow';

export interface UseWizardFlow<Ctx> {
  view: WizardView<Ctx>;
  state: WizardState;
  next: () => void;
  back: () => void;
  goTo: (index: number) => void;
  reset: () => void;
}

export function useWizardFlow<Ctx>(
  steps: WizardStepDef<Ctx>[],
  ctx: Ctx,
  initial?: Partial<WizardState>
): UseWizardFlow<Ctx> {
  // The engine is stable across renders; `ctx` (e.g. form data) is read fresh
  // each render so validation/gating always reflects the latest input.
  const flowRef = useRef<WizardFlow<Ctx> | null>(null);
  if (flowRef.current === null) flowRef.current = new WizardFlow<Ctx>(steps, initial);
  const flow = flowRef.current;

  const [, force] = useReducer((n: number) => n + 1, 0);

  const next = useCallback(() => { flow.next(ctx); force(); }, [flow, ctx]);
  const back = useCallback(() => { flow.back(); force(); }, [flow]);
  const goTo = useCallback((index: number) => { flow.goTo(index, ctx); force(); }, [flow, ctx]);
  const reset = useCallback(() => { flow.reset(); force(); }, [flow]);

  return { view: flow.view(ctx), state: flow.state, next, back, goTo, reset };
}
