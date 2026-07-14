import { describe, it, expect } from 'vitest';
import { WizardFlow, type WizardStepDef } from '@/lib/wizard-flow';

interface Form {
  name?: string;
  useCase?: string;
  voice?: string;
}

const steps: WizardStepDef<Form>[] = [
  { id: 'basics', title: 'Basics', validate: (f) => (f.name ? true : 'Name is required') },
  { id: 'useCase', title: 'Use case', validate: (f) => (f.useCase ? true : 'Pick a use case') },
  { id: 'voice', title: 'Voice', optional: true },
  { id: 'review', title: 'Review' },
];

describe('WizardFlow', () => {
  it('starts on the first step, in progress, with the first step visited', () => {
    const w = new WizardFlow(steps);
    const s = w.state;
    expect(s.currentIndex).toBe(0);
    expect(s.status).toBe('in_progress');
    expect(s.visited).toEqual(['basics']);
  });

  it('blocks advancing past an invalid required step and surfaces the reason', () => {
    const w = new WizardFlow(steps);
    const before = w.state.currentIndex;
    w.next({}); // no name
    expect(w.state.currentIndex).toBe(before); // did not advance
    expect(w.view({}).error).toBe('Name is required');
    expect(w.view({}).canGoNext).toBe(false);
  });

  it('advances once the current step validates and marks it completed', () => {
    const w = new WizardFlow(steps);
    w.next({ name: 'Aria' });
    expect(w.state.currentIndex).toBe(1);
    expect(w.state.completed).toContain('basics');
    expect(w.state.visited).toContain('useCase');
  });

  it('lets an optional step be skipped without validation', () => {
    const w = new WizardFlow(steps, { currentIndex: 2 }); // on the optional "voice" step
    const view = w.view({});
    expect(view.canGoNext).toBe(true); // optional → no gate
    w.next({});
    expect(w.state.currentIndex).toBe(3);
  });

  it('completes on the last step', () => {
    const w = new WizardFlow(steps, { currentIndex: 3 });
    expect(w.view({}).isLast).toBe(true);
    w.next({});
    expect(w.state.status).toBe('complete');
  });

  it('navigates backward freely and returns to in_progress', () => {
    const w = new WizardFlow(steps, { currentIndex: 3, status: 'complete' });
    w.back();
    expect(w.state.currentIndex).toBe(2);
    expect(w.state.status).toBe('in_progress');
    w.back();
    w.back();
    w.back(); // clamps at 0
    expect(w.state.currentIndex).toBe(0);
  });

  it('allows a backward jump to any step but gates forward jumps on validation', () => {
    const w = new WizardFlow(steps);
    // Forward jump to review is blocked because basics/useCase are invalid.
    w.goTo(3, {});
    expect(w.state.currentIndex).toBe(0);
    // With valid data the forward jump succeeds and marks intermediate steps done.
    w.goTo(3, { name: 'Aria', useCase: 'sales' });
    expect(w.state.currentIndex).toBe(3);
    expect(w.state.completed).toEqual(expect.arrayContaining(['basics', 'useCase', 'voice']));
    // Backward jump is always allowed.
    w.goTo(0, {});
    expect(w.state.currentIndex).toBe(0);
  });

  it('reports honest position progress', () => {
    const w = new WizardFlow(steps);
    expect(w.view({}).progress).toBe(0);
    w.next({ name: 'Aria' });
    expect(w.view({}).progress).toBeCloseTo(1 / 3, 3);
    const last = new WizardFlow(steps, { currentIndex: 3 });
    expect(last.view({}).progress).toBe(1);
  });

  it('resets back to the beginning', () => {
    const w = new WizardFlow(steps, { currentIndex: 2, completed: ['basics', 'useCase'] });
    w.reset();
    expect(w.state).toMatchObject({ currentIndex: 0, completed: [], status: 'in_progress' });
  });

  it('throws when constructed with no steps', () => {
    expect(() => new WizardFlow([])).toThrow(/at least one step/);
  });

  it('returns copies of state arrays (no external mutation of internals)', () => {
    const w = new WizardFlow(steps);
    w.state.visited.push('tampered');
    expect(w.state.visited).toEqual(['basics']); // internal state untouched
  });
});
