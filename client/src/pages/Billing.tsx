import { BillingKpiCard } from "@/components/billing/BillingKpiCard";
import { InvoiceStatusBadge } from "@/components/billing/InvoiceStatusBadge";
import { KeyValueRow } from "@/components/billing/KeyValueRow";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { AlertTriangle, Building2, CreditCard, Download, Receipt, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AuthStorage } from "@/lib/auth-storage";

interface UserMe {
  id: string;
  name: string;
  email: string;
  planType?: string;
  credits?: number;
}

interface Plan {
  id: string;
  name: string;
  displayName: string;
  monthlyPrice: string;
  yearlyPrice: string | null;
}

interface UserSubscription {
  id: string;
  status: string;
  billingPeriod: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  plan: Plan;
}

interface Transaction {
  id: string;
  type: string;
  gateway: string;
  amount: string;
  currency: string;
  description: string;
  status: string;
  planName: string | null;
  packageName: string | null;
  hasInvoice: boolean;
  invoiceId: string | null;
  invoiceNumber: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface TransactionHistoryResponse {
  transactions: Transaction[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface CreditTransactionRow {
  id: string;
  type: string;
  amount: number;
  description: string;
  reference?: string | null;
  createdAt: string;
}

interface MonthlyCallsReportCall {
  id: string;
  createdAt: string;
  callDirection: string | null;
  fromNumber: string | null;
  toNumber: string | null;
  duration: number | null;
  cost: string | null; // credits (derived from credit transactions)
  status: string;
}

interface MonthlyCallsReportResponse {
  month: string;
  totals: {
    calls: number;
    totalDurationSeconds: number;
    totalCost: number;
  };
  calls: MonthlyCallsReportCall[];
}

interface CallRow {
  id: string;
  createdAt?: string | null;
  startedAt?: string | null;
  callDirection?: string | null;
  fromNumber?: string | null;
  toNumber?: string | null;
  duration?: number | null;
  cost?: string | number | null;
  status?: string | null;
}

function formatMoney(amount: number, currency: string) {
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return formatter.format(amount);
}

export default function Billing() {
  const { data: me, isLoading: meLoading, isError: meError } = useQuery<UserMe>({
    queryKey: ["/api/auth/me"],
  });

  const { data: subscription, isLoading: subscriptionLoading, isError: subscriptionError } = useQuery<UserSubscription | null>({
    queryKey: ["/api/user-subscription"],
  });

  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [downloadingCallsPdf, setDownloadingCallsPdf] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });

  const limit = 50;
  const txUrl = `/api/transactions/history?limit=${limit}&offset=0`;
  const { data: txHistory, isLoading: txLoading, isError: txError } = useQuery<TransactionHistoryResponse>({
    // Use the shared query client fetch logic (adds Authorization + handles refresh on 401).
    queryKey: [txUrl],
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const { data: creditTx = [], isLoading: creditTxLoading, isError: creditTxError } = useQuery<CreditTransactionRow[]>({
    queryKey: ["/api/credit-transactions"],
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  // Important: do NOT provide a custom queryFn here.
  // Using the shared query client fetch logic ensures Authorization + refresh handling matches the rest of the app (e.g. Calls page).
  const { data: allCalls = [], isLoading: callsLoading, isError: callsError } = useQuery<CallRow[]>({
    queryKey: ["/api/calls"],
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const creditsByCallId = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of creditTx) {
      // Call usage debits are written by credit-service as:
      // reference = "{engine}:{callId}" and amount is negative.
      if (!tx.reference) continue;
      if (!tx.type || tx.type !== "usage") continue;
      if (typeof tx.amount !== "number") continue;
      if (tx.amount >= 0) continue;

      const parts = tx.reference.split(":");
      const callId = parts.length >= 2 ? parts.slice(1).join(":") : null;
      if (!callId) continue;

      // Keep as negative (debit) so UI shows -1, -2, etc.
      map.set(callId, (map.get(callId) ?? 0) + tx.amount);
    }
    return map;
  }, [creditTx]);

  const monthlyCalls = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map((n) => parseInt(n, 10));
    // Use local time bounds to match how timestamps are displayed/filtered elsewhere in the app.
    // (Some environments serialize timestamps without explicit timezone; local bounds are safer here.)
    const start = new Date(y, m - 1, 1, 0, 0, 0, 0).getTime();
    const end = new Date(y, m, 0, 23, 59, 59, 999).getTime();

    const rows = allCalls
      .map((c) => {
        const ts = c.startedAt || c.createdAt;
        const t = ts ? new Date(ts).getTime() : NaN;
        return { ...c, __t: t };
      })
      .filter((c) => Number.isFinite(c.__t) && c.__t >= start && c.__t <= end)
      .sort((a, b) => (b.__t as number) - (a.__t as number));

    const totalCost = rows.reduce((sum, r) => sum + (creditsByCallId.get(r.id) ?? 0), 0);
    const totalDurationSeconds = rows.reduce((sum, r) => sum + (r.duration ?? 0), 0);

    const normalizedCalls: MonthlyCallsReportCall[] = rows.map((r) => ({
      id: r.id,
      createdAt: (r.startedAt || r.createdAt || new Date().toISOString()) as string,
      callDirection: r.callDirection ?? null,
      fromNumber: r.fromNumber ?? null,
      toNumber: r.toNumber ?? null,
      duration: r.duration ?? null,
      cost: String(creditsByCallId.get(r.id) ?? 0),
      status: r.status ?? "unknown",
    }));

    return {
      month: selectedMonth,
      totals: {
        calls: normalizedCalls.length,
        totalDurationSeconds,
        totalCost,
      },
      calls: normalizedCalls,
    } satisfies MonthlyCallsReportResponse;
  }, [allCalls, creditsByCallId, selectedMonth]);

  const handleDownloadCallsPdf = async () => {
    setDownloadingCallsPdf(true);
    try {
      const headers: Record<string, string> = {};
      const authHeader = AuthStorage.getAuthHeader();
      if (authHeader) headers["Authorization"] = authHeader;

      const response = await fetch(`/api/billing/calls/monthly/${selectedMonth}/pdf`, {
        headers,
        credentials: "include",
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || "Authentication required");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ByanAI-Calls-${selectedMonth}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } finally {
      setDownloadingCallsPdf(false);
    }
  };

  const computed = useMemo(() => {
    const currency =
      (subscription?.plan?.monthlyPrice && "USD") ||
      (txHistory?.transactions?.[0]?.currency ? txHistory.transactions[0].currency : "USD");

    const nextRenewal =
      subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null;

    const planLabel =
      subscription?.plan?.displayName ||
      (me?.planType ? me.planType.charAt(0).toUpperCase() + me.planType.slice(1) : "—");

    const balance = typeof me?.credits === "number" ? me.credits : null;

    // Best-effort "estimated next invoice" from plan price only (usage breakdown not currently available).
    const planAmount =
      subscription?.billingPeriod === "yearly"
        ? subscription?.plan?.yearlyPrice
        : subscription?.plan?.monthlyPrice;

    const estimatedNextInvoice =
      planAmount && !Number.isNaN(Number(planAmount)) ? Number(planAmount) : null;

    const alerts: Array<{ kind: "warning" | "danger"; title: string; description: string }> = [];

    // If subscription is past_due / unpaid etc, surface a notice
    if (subscription?.status && ["past_due", "unpaid", "incomplete", "incomplete_expired"].includes(subscription.status)) {
      alerts.push({
        kind: "danger",
        title: "Payment issue detected",
        description: "Your subscription has a payment issue. Update your payment method to avoid service disruption.",
      });
    }

    // Optional: card-expiring soon is not available from current APIs, so we do not guess.

    return {
      currency,
      nextRenewal,
      planLabel,
      balance,
      estimatedNextInvoice,
      planAmount,
      alerts: alerts.slice(0, 2),
    };
  }, [me, subscription, txHistory]);

  // Only hard-fail if we have no cached data at all.
  if (meError && !me) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Billing unavailable</AlertTitle>
        <AlertDescription>We couldn’t load your billing data. Please refresh or contact support.</AlertDescription>
      </Alert>
    );
  }

  const initialLoading =
    (meLoading && !me) ||
    (subscriptionLoading && typeof subscription === "undefined") ||
    (txLoading && !txHistory) ||
    (callsLoading && allCalls.length === 0) ||
    (creditTxLoading && creditTx.length === 0);

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const billingEntity = me?.name || "Workspace";
  const cycleLabel = subscription?.currentPeriodStart && subscription?.currentPeriodEnd
    ? `${format(new Date(subscription.currentPeriodStart), "MMM d")} – ${format(new Date(subscription.currentPeriodEnd), "MMM d, yyyy")}`
    : "Current billing cycle";

  const transactions = txHistory?.transactions || [];

  return (
    <div className="space-y-6">
      {(subscriptionError || txError || creditTxError || callsError) && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Some billing data may be out of date</AlertTitle>
          <AlertDescription>
            We’re having trouble refreshing some billing details right now. The page is still showing your last loaded data.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">Billing</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.04] dark:bg-foreground/[0.06] px-2 py-0.5 text-[11px] text-muted-foreground">
              <Building2 className="h-3 w-3" />
              {me?.email || "Account"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {cycleLabel} · {billingEntity}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild>
            <Link href="/app/settings/billing" data-testid="button-billing-manage-plan">
              Manage plan
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => setPaymentSheetOpen(true)}
            data-testid="button-billing-payment-method"
          >
            Payment method
          </Button>
          <Button variant="outline" asChild>
            <Link href="/app/settings/billing?tab=credits" data-testid="button-billing-add-credits">
              Add credits
            </Link>
          </Button>
          <Button
            variant="ghost"
            onClick={() => window.open("/api/credit-transactions/export", "_blank")}
            data-testid="button-billing-download-statement"
          >
            <Download className="h-4 w-4 mr-2" />
            Download statement
          </Button>
        </div>
      </div>

      {computed.alerts.length > 0 ? (
        <div className="grid grid-cols-1 gap-3">
          {computed.alerts.map((a) => (
            <Alert key={a.title} variant={a.kind === "danger" ? "destructive" : "default"}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{a.title}</AlertTitle>
              <AlertDescription>{a.description}</AlertDescription>
            </Alert>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <BillingKpiCard
          title="Current plan"
          value={computed.planLabel}
          meta={computed.nextRenewal ? `Renews on ${format(computed.nextRenewal, "MMM d, yyyy")}` : "Renewal date unavailable"}
          icon={Sparkles}
          testId="kpi-current-plan"
        />
        <BillingKpiCard
          title="Estimated next invoice"
          value={
            typeof computed.estimatedNextInvoice === "number"
              ? formatMoney(computed.estimatedNextInvoice, computed.currency)
              : "—"
          }
          meta="Plan charge"
          icon={Receipt}
          testId="kpi-estimated-invoice"
        />
        <BillingKpiCard
          title="Current cycle spend"
          value={typeof computed.estimatedNextInvoice === "number" ? formatMoney(computed.estimatedNextInvoice, computed.currency) : "—"}
          meta="Subscription (excludes usage)"
          icon={Receipt}
          testId="kpi-current-usage"
        />
        <BillingKpiCard
          title="Wallet / credits"
          value={typeof computed.balance === "number" ? computed.balance.toLocaleString() : "—"}
          meta="Credits balance"
          icon={CreditCard}
          testId="kpi-wallet"
          action={
            <Button variant="outline" size="sm" className="w-full justify-center" asChild data-testid="button-manage-credits">
              <Link href="/app/settings/billing?tab=credits">Manage credits</Link>
            </Button>
          }
        />
      </div>

      <Card data-testid="card-calls-costs">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base">Calls & costs</CardTitle>
              <div className="text-sm text-muted-foreground">Per-call costs grouped by month. Export as a PDF with letterhead.</div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[140px]" data-testid="select-calls-month">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }).map((_, i) => {
                    const d = new Date();
                    d.setUTCMonth(d.getUTCMonth() - i);
                    const m = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
                    return (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={handleDownloadCallsPdf}
                disabled={downloadingCallsPdf}
                data-testid="button-download-calls-pdf"
              >
                <Download className="h-4 w-4 mr-2" />
                {downloadingCallsPdf ? "Preparing…" : "Download PDF"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {monthlyCalls.calls.length ? (
            <>
              <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <Card className="p-4">
                  <div className="text-xs text-muted-foreground">Total calls</div>
                  <div className="mt-1 text-xl font-semibold tabular-nums">{monthlyCalls.totals.calls}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-xs text-muted-foreground">Total duration</div>
                  <div className="mt-1 text-xl font-semibold tabular-nums">
                    {Math.floor(monthlyCalls.totals.totalDurationSeconds / 60)}m
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-xs text-muted-foreground">Total credits</div>
                  <div className="mt-1 text-xl font-semibold tabular-nums">
                    {monthlyCalls.totals.totalCost.toLocaleString()}
                  </div>
                </Card>
              </div>

              <div className="rounded-xl border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Date</TableHead>
                      <TableHead className="whitespace-nowrap">Direction</TableHead>
                      <TableHead className="whitespace-nowrap">From</TableHead>
                      <TableHead className="whitespace-nowrap">To</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Duration</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Credits</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyCalls.calls.map((c) => {
                      const credits = c.cost ? Number(c.cost) : 0;
                      const dur = c.duration ?? 0;
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="whitespace-nowrap">{format(new Date(c.createdAt), "MMM d, yyyy")}</TableCell>
                          <TableCell className="whitespace-nowrap">{c.callDirection || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">{c.fromNumber || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">{c.toNumber || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap text-right tabular-nums">
                            {Math.floor(dur / 60)}:{String(dur % 60).padStart(2, "0")}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right tabular-nums font-semibold">
                            {Number.isFinite(credits) ? credits.toLocaleString() : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">No calls found for {selectedMonth}.</div>
          )}
        </CardContent>
      </Card>

      <Sheet open={paymentSheetOpen} onOpenChange={setPaymentSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Payment method</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="space-y-2">
                <KeyValueRow label="Billing contact" value={me?.email || "—"} valueClassName="font-normal text-muted-foreground" />
                <KeyValueRow label="Subscription status" value={subscription?.status ? subscription.status : "—"} />
                <KeyValueRow
                  label="Next charge date"
                  value={subscription?.currentPeriodEnd ? format(new Date(subscription.currentPeriodEnd), "MMM d, yyyy") : "—"}
                />
              </div>
            </Card>
            <Card className="p-4">
              <div className="space-y-3">
                <div className="text-sm font-medium">Manage</div>
                <div className="text-sm text-muted-foreground">
                  Update your payment method from Plan & Billing settings.
                </div>
                <Button className="w-full" asChild>
                  <Link href="/app/settings/billing" data-testid="button-update-payment-method">
                    Update payment method
                  </Link>
                </Button>
              </div>
            </Card>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
