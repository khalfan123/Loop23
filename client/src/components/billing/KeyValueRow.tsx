import { cn } from "@/lib/utils";

interface KeyValueRowProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  valueClassName?: string;
}

export function KeyValueRow({ label, value, hint, valueClassName }: KeyValueRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <div className="text-sm text-muted-foreground">{label}</div>
        {hint ? <div className="mt-0.5 text-xs text-muted-foreground/80">{hint}</div> : null}
      </div>
      <div className={cn("text-sm font-medium tabular-nums text-foreground text-right", valueClassName)}>{value}</div>
    </div>
  );
}

