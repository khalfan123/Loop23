import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

interface UsageMetricRowProps {
  label: string;
  used: string;
  included?: string;
  overage?: string;
  deltaPct?: number;
  testId?: string;
}

function Delta({ deltaPct }: { deltaPct: number }) {
  const direction: "up" | "down" = deltaPct >= 0 ? "up" : "down";
  const abs = Math.abs(deltaPct);
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 text-xs tabular-nums",
        direction === "up" ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
      )}
      aria-label={`Usage ${direction === "up" ? "increased" : "decreased"} by ${abs}% vs previous cycle`}
    >
      {direction === "up" ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      <span>{abs.toFixed(0)}%</span>
      <span className="text-muted-foreground/80">vs last cycle</span>
    </div>
  );
}

export function UsageMetricRow({ label, used, included, overage, deltaPct, testId }: UsageMetricRowProps) {
  return (
    <div className="grid grid-cols-12 gap-3 py-3" data-testid={testId}>
      <div className="col-span-12 md:col-span-4">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {typeof deltaPct === "number" ? <div className="mt-1"><Delta deltaPct={deltaPct} /></div> : null}
      </div>

      <div className="col-span-12 md:col-span-8">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground/80">Used</div>
            <div className="mt-1 text-sm font-semibold tabular-nums">{used}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground/80">Included</div>
            <div className="mt-1 text-sm font-semibold tabular-nums">{included ?? "—"}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground/80">Overage</div>
            <div className="mt-1 text-sm font-semibold tabular-nums">{overage ?? "—"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

