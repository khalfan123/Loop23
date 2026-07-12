import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type InvoiceStatus = "Paid" | "Pending" | "Failed" | "Refunded";

function statusToVariant(status: InvoiceStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "Paid":
      return "default";
    case "Pending":
      return "secondary";
    case "Failed":
      return "destructive";
    case "Refunded":
      return "outline";
  }
}

export function InvoiceStatusBadge({ status, className }: { status: InvoiceStatus; className?: string }) {
  return (
    <Badge
      variant={statusToVariant(status)}
      className={cn("px-2 py-0.5 rounded-md font-semibold", className)}
    >
      {status}
    </Badge>
  );
}

