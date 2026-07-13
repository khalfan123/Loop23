/**
 * ============================================================
 * Premium product UX — wizard flow engine
 *
 * A framework-agnostic state engine for multi-step wizards (agent creation,
 * SIP trunking, outbound campaigns, onboarding). It gives every wizard the
 * same GitHub/Linear/Stripe-grade behavior: validation-gated progression
 * (you cannot advance past an invalid step, and the reason is surfaced),
 * free backward navigation to any visited step, honest progress, and a
 * clear completion state.
 *
 * Pure and deterministic — no React — so the flow logic is unit-tested here
 * and a thin `useWizardFlow` hook can wrap it in the components. Centralizing
 * the rules removes the per-wizard drift that made the flows feel uneven.
 * ============================================================
 */

export interface WizardStepDef<Ctx> {
  id: string;
  title: string;
  /** Optional steps can be skipped without passing validation. */
  optional?: boolean;
  /** Return true when valid, or an error string explaining what's missing. */
  validate?: (ctx: Ctx) => true | string;
}

export interface WizardState {
  currentIndex: number;
  visited: string[];
  completed: string[];
  status: 'in_progress' | 'complete';
}

export interface WizardView<Ctx> {
  step: WizardStepDef<Ctx>;
  index: number;
  total: number;
  /** 0..1 position progress (current step ÷ last step). */
  progress: number;
  completedCount: number;
  isFirst: boolean;
  isLast: boolean;
  canGoNext: boolean;
  canGoBack: boolean;
  /** Validation error for the current step, or null when it passes. */
  error: string | null;
  status: WizardState['status'];
}

export class WizardFlow<Ctx = unknown> {
  private steps: WizardStepDef<Ctx>[];
  private _state: WizardState;

  constructor(steps: WizardStepDef<Ctx>[], initial?: Partial<WizardState>) {
    if (steps.length === 0) throw new Error('WizardFlow requires at least one step');
    this.steps = steps;
    const currentIndex = clamp(initial?.currentIndex ?? 0, 0, steps.length - 1);
    this._state = {
      currentIndex,
      visited: initial?.visited ?? [steps[currentIndex].id],
      completed: initial?.completed ?? [],
      status: initial?.status ?? 'in_progress',
    };
  }

  get state(): WizardState {
    return { ...this._state, visited: [...this._state.visited], completed: [...this._state.completed] };
  }

  get stepDefs(): WizardStepDef<Ctx>[] {
    return this.steps;
  }

  /** Validate an arbitrary step against the current context. */
  validateStep(index: number, ctx: Ctx): true | string {
    const step = this.steps[index];
    if (!step) return 'no such step';
    if (!step.validate || step.optional) return true;
    return step.validate(ctx);
  }

  /** Derived view for rendering. Pure. */
  view(ctx: Ctx): WizardView<Ctx> {
    const index = this._state.currentIndex;
    const step = this.steps[index];
    const validation = this.validateStep(index, ctx);
    const error = validation === true ? null : validation;
    return {
      step,
      index,
      total: this.steps.length,
      progress: this.steps.length > 1 ? round(index / (this.steps.length - 1), 4) : 1,
      completedCount: this._state.completed.length,
      isFirst: index === 0,
      isLast: index === this.steps.length - 1,
      canGoNext: error === null,
      canGoBack: index > 0,
      error,
      status: this._state.status,
    };
  }

  /**
   * Advance one step if the current step validates. On the last valid step,
   * marks the wizard complete. Returns the (possibly unchanged) state; when
   * blocked, inspect view(ctx).error for the reason.
   */
  next(ctx: Ctx): WizardState {
    const index = this._state.currentIndex;
    if (this.validateStep(index, ctx) !== true) return this.state; // gated
    this.markCompleted(this.steps[index].id);
    if (index >= this.steps.length - 1) {
      this._state.status = 'complete';
      return this.state;
    }
    this._state.currentIndex = index + 1;
    this.markVisited(this.steps[this._state.currentIndex].id);
    return this.state;
  }

  back(): WizardState {
    if (this._state.currentIndex > 0) {
      this._state.currentIndex--;
      this._state.status = 'in_progress';
    }
    return this.state;
  }

  /**
   * Jump to a step. Backward jumps (to any step) are always allowed. Forward
   * jumps are allowed only when every step in between validates — so you can
   * never skip ahead past an unfilled required step.
   */
  goTo(index: number, ctx: Ctx): WizardState {
    const target = clamp(index, 0, this.steps.length - 1);
    if (target <= this._state.currentIndex) {
      this._state.currentIndex = target;
      this._state.status = 'in_progress';
      this.markVisited(this.steps[target].id);
      return this.state;
    }
    for (let i = this._state.currentIndex; i < target; i++) {
      if (this.validateStep(i, ctx) !== true) return this.state; // blocked mid-way
      this.markCompleted(this.steps[i].id);
    }
    this._state.currentIndex = target;
    this.markVisited(this.steps[target].id);
    return this.state;
  }

  reset(): WizardState {
    this._state = { currentIndex: 0, visited: [this.steps[0].id], completed: [], status: 'in_progress' };
    return this.state;
  }

  private markVisited(id: string): void {
    if (!this._state.visited.includes(id)) this._state.visited.push(id);
  }
  private markCompleted(id: string): void {
    if (!this._state.completed.includes(id)) this._state.completed.push(id);
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
