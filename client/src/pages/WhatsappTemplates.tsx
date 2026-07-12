import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, RefreshCcw, ArrowLeft } from "lucide-react";

type Channel = {
  id: string;
  wabaId: string;
  name: string | null;
  syncStatus: string;
};

type Template = {
  id: string;
  metaTemplateId: string | null;
  name: string;
  language: string;
  status: string;
  category: string | null;
  components: any;
  rejectionReason: string | null;
  lastSyncedAt: string | null;
};

function useQueryParams() {
  return useMemo(() => new URLSearchParams(window.location.search), []);
}

export default function WhatsappTemplates() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const params = useQueryParams();
  const initialWabaRowId = params.get("wabaRowId") || "";

  const [wabaRowId, setWabaRowId] = useState(initialWabaRowId);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [showCreate, setShowCreate] = useState(false);

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ["/api/whatsapp/channels"],
  });

  const effectiveWabaRowId = wabaRowId || channels[0]?.id || "";

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["/api/whatsapp/templates", effectiveWabaRowId],
    enabled: !!effectiveWabaRowId,
    queryFn: async () => {
      const qs = new URLSearchParams({ wabaRowId: effectiveWabaRowId });
      const res = await apiRequest("GET", `/api/whatsapp/templates?${qs.toString()}`);
      return (await res.json()) as Template[];
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", `/api/whatsapp/sync/${encodeURIComponent(effectiveWabaRowId)}`),
    onSuccess: async () => {
      toast({ title: "Sync started" });
      await queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/templates", effectiveWabaRowId] });
      await queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/channels"] });
    },
    onError: (e: any) =>
      toast({ title: "Sync failed", description: e?.message || "Unknown error", variant: "destructive" }),
  });

  const filtered = useMemo(
    () => (statusFilter === "ALL" ? templates : templates.filter((t) => t.status === statusFilter)),
    [templates, statusFilter],
  );

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/app/channels/whatsapp")} className="-ml-2 gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back to Channels
        </Button>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">WhatsApp Templates</h1>
          <p className="text-sm text-muted-foreground">Synced from your WhatsApp Business Account.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {channels.length > 1 ? (
            <div className="space-y-1">
              <Label className="text-xs">WABA</Label>
              <Select value={effectiveWabaRowId} onValueChange={setWabaRowId}>
                <SelectTrigger className="w-[260px]">
                  <SelectValue placeholder="Choose WABA" />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name || c.wabaId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="PAUSED">Paused</SelectItem>
                <SelectItem value="DISABLED">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={!effectiveWabaRowId || syncMutation.isPending}
          >
            <RefreshCcw className="h-4 w-4 mr-1" />
            Sync now
          </Button>
          <Button onClick={() => setShowCreate((v) => !v)} disabled={!effectiveWabaRowId}>
            <Plus className="h-4 w-4 mr-1" />
            New template
          </Button>
        </div>
      </div>

      {showCreate && effectiveWabaRowId ? (
        <CreateTemplateCard
          wabaRowId={effectiveWabaRowId}
          onCreated={() => {
            setShowCreate(false);
            void queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/templates", effectiveWabaRowId] });
          }}
        />
      ) : null}

      {!effectiveWabaRowId ? (
        <Alert>
          <AlertTitle>No WhatsApp Business Account connected yet</AlertTitle>
          <AlertDescription>
            <Button variant="ghost" className="px-0" onClick={() => setLocation("/app/inbox/whatsapp-setup")}>
              Connect one now
            </Button>
          </AlertDescription>
        </Alert>
      ) : isLoading ? (
        <div className="text-sm text-muted-foreground">Loading templates…</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground">No templates match this filter.</div>
      ) : (
        <div className="rounded-lg border divide-y">
          {filtered.map((t) => (
            <div key={t.id} className="px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
              <div className="font-mono">{t.name}</div>
              <Badge variant="outline">{t.language}</Badge>
              {t.category ? <Badge variant="outline">{t.category}</Badge> : null}
              <Badge variant={t.status === "APPROVED" ? "default" : "secondary"} className="ml-auto">
                {t.status}
              </Badge>
              {t.rejectionReason ? (
                <span className="text-xs text-destructive w-full">{t.rejectionReason}</span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateTemplateCard({ wabaRowId, onCreated }: { wabaRowId: string; onCreated: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("en_US");
  const [category, setCategory] = useState("UTILITY");
  const [bodyText, setBodyText] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const components = [
        {
          type: "BODY",
          text: bodyText,
        },
      ];
      return apiRequest("POST", "/api/whatsapp/templates", {
        wabaRowId,
        name: name.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
        language,
        category,
        components,
      });
    },
    onSuccess: () => {
      toast({ title: "Template submitted to Meta", description: "It will appear once approved." });
      onCreated();
    },
    onError: (e: any) =>
      toast({ title: "Failed to create template", description: e?.message || "Unknown error", variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Create a new template</CardTitle>
        <CardDescription>
          Templates are reviewed by Meta. Names must be lowercase with underscores.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="order_confirmation" />
          </div>
          <div>
            <Label>Language</Label>
            <Input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="en_US" />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UTILITY">Utility</SelectItem>
                <SelectItem value="MARKETING">Marketing</SelectItem>
                <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Body text</Label>
          <textarea
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            placeholder="Hello {{1}}, your order #{{2}} has shipped."
            className="w-full min-h-[100px] rounded-md border bg-background p-2 text-sm"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button
            disabled={!name || !bodyText || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Submit to Meta
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
