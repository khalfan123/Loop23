import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface BillingKpiCardProps {
  title: string;
  value: string;
  meta?: string;
  icon: LucideIcon;
  action?: React.ReactNode;
  testId?: string;
  className?: string;
}

export function BillingKpiCard({ title, value, meta, icon: Icon, action, testId, className }: BillingKpiCardProps) {
  return (
    <Card className={cn("p-5 hover:shadow-md transition-shadow duration-200", className)} data-testid={testId}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-muted-foreground tracking-tight">{title}</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</div>
          {meta && <div className="mt-1 text-xs text-muted-foreground">{meta}</div>}
        </div>
        <div className="h-9 w-9 rounded-2xl bg-primary/[0.08] dark:bg-primary/[0.15] flex items-center justify-center flex-shrink-0">
          <Icon className="h-4 w-4 text-primary/70" />
        </div>
      </div>
      {action ? <div className="mt-3">{action}</div> : null}
    </Card>
  );
}

