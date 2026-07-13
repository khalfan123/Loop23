/**
 * WizardStepper — the shared, GitHub/Linear/Stripe-grade progress header for
 * every wizard. Renders numbered steps with completed / current / upcoming
 * states, a progress bar, and (optionally) click-to-jump on already-reached
 * steps. Presentational only — drive it from useWizardFlow so gating and
 * navigation rules stay centralized.
 */
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WizardStepperStep {
  id: string;
  title: string;
}

export interface WizardStepperProps {
  steps: WizardStepperStep[];
  /** Index of the active step. */
  currentIndex: number;
  /** Ids of steps that have been completed (validated). */
  completed?: string[];
  /** 0..1 progress for the bar; defaults to positional progress. */
  progress?: number;
  /** Invoked when a reachable step is clicked (omit to disable jumping). */
  onStepClick?: (index: number) => void;
  className?: string;
}

export function WizardStepper({
  steps,
  currentIndex,
  completed = [],
  progress,
  onStepClick,
  className,
}: WizardStepperProps) {
  const pct = Math.round((progress ?? (steps.length > 1 ? currentIndex / (steps.length - 1) : 1)) * 100);
  const done = new Set(completed);

  return (
    <div className={cn("w-full", className)} data-testid="wizard-stepper">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = done.has(step.id) && index !== currentIndex;
          const isCurrent = index === currentIndex;
          const isReachable = index <= currentIndex || isCompleted;
          const clickable = Boolean(onStepClick) && isReachable;
          return (
            <div key={step.id} className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                disabled={!clickable}
                onClick={clickable ? () => onStepClick!(index) : undefined}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  isCompleted && "bg-emerald-500 text-white",
                  isCurrent && "bg-primary text-primary-foreground ring-2 ring-primary/30",
                  !isCompleted && !isCurrent && "bg-muted text-muted-foreground",
                  clickable && "cursor-pointer hover:opacity-80",
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
              </button>
              <span
                className={cn(
                  "truncate text-sm",
                  isCurrent ? "font-medium text-foreground" : "text-muted-foreground",
                  "hidden sm:inline",
                )}
              >
                {step.title}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
