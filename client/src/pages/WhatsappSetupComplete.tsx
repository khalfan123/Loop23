import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, Loader2, AlertTriangle, ArrowRight } from "lucide-react";

type SyncStatus = {
  wabaRowId: string;
  wabaId: string;
  syncStatus: "pending" | "running" | "completed" | "completed_with_errors" | string;
  syncError: string | null;
  syncStartedAt: string | null;
  syncCompletedAt: string | null;
  lastSyncedAt: string | null;
  counts: { templates: number; phoneNumbers: number };
};

type Channel = {
  id: string;
  wabaId: string;
  name: string | null;
  syncStatus: string;
  phoneNumbers: any[];
};

function useQueryParams() {
  return useMemo(() => new URLSearchParams(window.location.search), []);
}

export default function WhatsappSetupComplete() {
  const [, setLocation] = useLocation();
  const params = useQueryParams();
  const wabaRowId = params.get("wabaRowId") || "";
  const senderId = params.get("senderId") || "";

  const { data, isError } = useQuery<SyncStatus | null>({
    queryKey: ["/api/whatsapp/sync-status", wabaRowId],
    enabled: !!wabaRowId,
    refetchInterval: (q: any) => {
      const status: string | undefined = q?.state?.data?.syncStatus;
      if (!status) return 2000;
      if (status === "pending" || status === "running") return 2500;
      return false;
    },
    queryFn: async () => {
      if (!wabaRowId) return null;
      const res = await apiRequest("GET", `/api/whatsapp/sync-status/${encodeURIComponent(wabaRowId)}`);
      return (await res.json()) as SyncStatus;
    },
  });

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ["/api/whatsapp/channels"],
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (!wabaRowId) setLocation("/app/inbox");
  }, [wabaRowId, setLocation]);

  const done = data?.syncStatus === "completed" || data?.syncStatus === "completed_with_errors";
  const totalWabas = channels.length;
  const totalPhones = channels.reduce((sum, c) => sum + (c.phoneNumbers?.length || 0), 0);
  const wabasInProgress = channels.filter((c) => c.syncStatus === "pending" || c.syncStatus === "running").length;

  return (
    <div className="mx-auto max-w-2xl pb-10 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Importing every WhatsApp account on your Facebook login</CardTitle>
          <CardDescription>
            Pulling templates, business profile, phone numbers and webhooks for every WhatsApp Business Account you can
            access — even ones you didn't pick in the Meta window.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-3 flex flex-wrap gap-4 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">WABAs imported</div>
              <div className="text-2xl font-semibold">{totalWabas}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Phone numbers</div>
              <div className="text-2xl font-semibold">{totalPhones}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">In progress</div>
              <div className="text-2xl font-semibold">{wabasInProgress}</div>
            </div>
          </div>
          {isError ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Could not fetch sync status</AlertTitle>
              <AlertDescription>You can still continue — the import will keep running in the background.</AlertDescription>
            </Alert>
          ) : null}

          <div className="rounded-lg border divide-y">
            <Row
              label="Connecting WABA"
              done={!!data?.wabaId}
              hint={data?.wabaId ? `WABA ${data.wabaId}` : undefined}
              running={!data?.wabaId}
            />
            <Row
              label="Phone numbers"
              done={(data?.counts.phoneNumbers || 0) > 0}
              hint={data?.counts.phoneNumbers ? `${data.counts.phoneNumbers} imported` : undefined}
              running={!done && (data?.counts.phoneNumbers || 0) === 0}
            />
            <Row
              label="Message templates"
              done={done && (data?.counts.templates || 0) >= 0}
              hint={data?.counts.templates !== undefined ? `${data.counts.templates} imported` : undefined}
              running={!done}
            />
            <Row label="Business profile" done={!!done} running={!done} />
            <Row label="Webhook subscriptions" done={!!done} running={!done} />
          </div>

          {data?.syncStatus === "completed_with_errors" && data.syncError ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Some parts had issues</AlertTitle>
              <AlertDescription className="break-all text-xs">{data.syncError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setLocation("/app/inbox")} variant="outline">
              Go to Inbox
            </Button>
            <Button onClick={() => setLocation("/app/channels/whatsapp")}>
              Open Channels <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
            {senderId ? (
              <Button variant="ghost" onClick={() => setLocation(`/app/whatsapp/business-profile/${senderId}`)}>
                Edit business profile
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, done, running, hint }: { label: string; done: boolean; running: boolean; hint?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 text-sm">
      <div className="w-5">
        {done ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        ) : running ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="h-2 w-2 rounded-full bg-muted-foreground/40 ml-1.5" />
        )}
      </div>
      <div className="flex-1">{label}</div>
      {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
