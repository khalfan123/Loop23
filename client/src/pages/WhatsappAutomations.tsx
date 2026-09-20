import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

type Sender = { id: string; phoneNumberE164: string; profileName: string | null };
type Tag = { id: string; name: string };
type Settings = {
  id?: string;
  senderId?: string | null;
  welcomeEnabled: boolean;
  welcomeBody: string | null;
  defaultReplyEnabled: boolean;
  defaultReplyBody: string | null;
  awayHoursEnabled: boolean;
  awayMessage: string | null;
};
type QuickReply = { id: string; shortcut: string; body: string };
type KeywordTrigger = {
  id: string;
  name: string;
  matchMode: "contains" | "exact" | "startsWith" | "regex";
  keywords: string[];
  caseSensitive: boolean;
  replyBody: string | null;
  assignTagId: string | null;
  senderId: string | null;
  enabled: boolean;
  priority: number;
  fireCount: number;
  lastFiredAt: string | null;
};

export default function WhatsappAutomations() {
  const [, setLocation] = useLocation();

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/app/inbox")} className="-ml-2 gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back to Inbox
        </Button>
      </div>
      <div>
        <h1 className="text-xl font-semibold">Automations</h1>
        <p className="text-sm text-muted-foreground">
          Welcome messages, default replies, keyword auto-responses and saved quick replies.
        </p>
      </div>
      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">Channel settings</TabsTrigger>
          <TabsTrigger value="keywords">Keyword triggers</TabsTrigger>
          <TabsTrigger value="quick">Quick replies</TabsTrigger>
        </TabsList>
        <TabsContent value="settings" className="pt-4">
          <ChannelSettingsPanel />
        </TabsContent>
        <TabsContent value="keywords" className="pt-4">
          <KeywordsPanel />
        </TabsContent>
        <TabsContent value="quick" className="pt-4">
          <QuickRepliesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ChannelSettingsPanel() {
  const { toast } = useToast();
  const { data: senders = [] } = useQuery<Sender[]>({ queryKey: ["/api/whatsapp/senders"] });
  const [senderId, setSenderId] = useState<string>("ALL");
  const queryKey = ["/api/whatsapp/channel-settings", senderId] as const;
  const { data: settings } = useQuery<Settings | null>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (senderId !== "ALL") params.set("senderId", senderId);
      const res = await apiRequest("GET", `/api/whatsapp/channel-settings?${params.toString()}`);
      return (await res.json()) as Settings | null;
    },
  });

  const [form, setForm] = useState<Settings>({
    welcomeEnabled: false,
    welcomeBody: "",
    defaultReplyEnabled: false,
    defaultReplyBody: "",
    awayHoursEnabled: false,
    awayMessage: "",
  });
  useEffect(() => {
    if (settings) setForm(settings);
    else setForm((f) => ({ ...f, welcomeBody: "", defaultReplyBody: "", awayMessage: "" }));
  }, [settings]);

  const save = useMutation({
    mutationFn: async () =>
      apiRequest("PUT", "/api/whatsapp/channel-settings", {
        senderId: senderId === "ALL" ? null : senderId,
        ...form,
      }),
    onSuccess: async () => {
      toast({ title: "Saved" });
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Channel-level automations</CardTitle>
        <CardDescription>
          These fire automatically based on inbound messages. Per-sender settings override workspace defaults.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Apply to</Label>
          <Select value={senderId} onValueChange={setSenderId}>
            <SelectTrigger className="w-[280px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All senders (workspace default)</SelectItem>
              {senders.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.phoneNumberE164}
                  {s.profileName ? ` · ${s.profileName}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ToggleBlock
          title="Welcome message"
          description="Sent the first time a new contact messages you."
          enabled={form.welcomeEnabled}
          onToggle={(v) => setForm({ ...form, welcomeEnabled: v })}
          value={form.welcomeBody || ""}
          onChange={(v) => setForm({ ...form, welcomeBody: v })}
        />
        <ToggleBlock
          title="Default reply"
          description="Catch-all reply when no keyword trigger matches and no agent has replied yet."
          enabled={form.defaultReplyEnabled}
          onToggle={(v) => setForm({ ...form, defaultReplyEnabled: v })}
          value={form.defaultReplyBody || ""}
          onChange={(v) => setForm({ ...form, defaultReplyBody: v })}
        />
        <ToggleBlock
          title="Away message"
          description="Send a message during configured away hours. (Hours configuration coming soon.)"
          enabled={form.awayHoursEnabled}
          onToggle={(v) => setForm({ ...form, awayHoursEnabled: v })}
          value={form.awayMessage || ""}
          onChange={(v) => setForm({ ...form, awayMessage: v })}
        />

        <div className="flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ToggleBlock({
  title,
  description,
  enabled,
  onToggle,
  value,
  onChange,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="font-medium">{title}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!enabled}
        placeholder="Message text"
        className="w-full min-h-[80px] rounded-md border bg-background p-2 text-sm disabled:opacity-50"
      />
    </div>
  );
}

function QuickRepliesPanel() {
  const { toast } = useToast();
  const { data: items = [] } = useQuery<QuickReply[]>({ queryKey: ["/api/whatsapp/quick-replies"] });
  const [shortcut, setShortcut] = useState("");
  const [body, setBody] = useState("");

  const create = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/whatsapp/quick-replies", { shortcut, body }),
    onSuccess: async () => {
      setShortcut("");
      setBody("");
      await queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/quick-replies"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });
  const del = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/whatsapp/quick-replies/${encodeURIComponent(id)}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/quick-replies"] }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quick replies</CardTitle>
        <CardDescription>
          Saved canned responses. Type <span className="font-mono">/</span> in the inbox composer to insert one.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <Label>Shortcut</Label>
            <Input value={shortcut} onChange={(e) => setShortcut(e.target.value)} placeholder="/hello" className="w-[160px]" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <Label>Body</Label>
            <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Hi, how can I help?" />
          </div>
          <Button onClick={() => create.mutate()} disabled={!shortcut || !body || create.isPending}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground">No quick replies yet.</div>
        ) : (
          <div className="rounded-lg border divide-y">
            {items.map((q) => (
              <div key={q.id} className="px-3 py-2 flex items-center gap-2 text-sm">
                <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted">{q.shortcut}</span>
                <span className="flex-1 truncate">{q.body}</span>
                <Button variant="ghost" size="sm" onClick={() => del.mutate(q.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KeywordsPanel() {
  const { toast } = useToast();
  const { data: items = [] } = useQuery<KeywordTrigger[]>({ queryKey: ["/api/whatsapp/keyword-triggers"] });
  const { data: senders = [] } = useQuery<Sender[]>({ queryKey: ["/api/whatsapp/senders"] });
  const { data: tags = [] } = useQuery<Tag[]>({ queryKey: ["/api/whatsapp/tags"] });

  const [form, setForm] = useState({
    name: "",
    matchMode: "contains" as "contains" | "exact" | "startsWith" | "regex",
    keywords: "",
    caseSensitive: false,
    replyBody: "",
    assignTagId: "NONE",
    senderId: "ALL",
    enabled: true,
    priority: 100,
  });

  const create = useMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/whatsapp/keyword-triggers", {
        name: form.name,
        matchMode: form.matchMode,
        keywords: form.keywords.split(",").map((s) => s.trim()).filter(Boolean),
        caseSensitive: form.caseSensitive,
        replyBody: form.replyBody || null,
        assignTagId: form.assignTagId === "NONE" ? null : form.assignTagId,
        senderId: form.senderId === "ALL" ? null : form.senderId,
        enabled: form.enabled,
        priority: form.priority,
      }),
    onSuccess: async () => {
      setForm({ ...form, name: "", keywords: "", replyBody: "" });
      await queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/keyword-triggers"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const toggle = useMutation({
    mutationFn: async (t: KeywordTrigger) =>
      apiRequest("PUT", `/api/whatsapp/keyword-triggers/${encodeURIComponent(t.id)}`, { enabled: !t.enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/keyword-triggers"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/whatsapp/keyword-triggers/${encodeURIComponent(id)}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/keyword-triggers"] }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a keyword trigger</CardTitle>
          <CardDescription>Auto-reply when an inbound message matches keywords. First match wins (by priority).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Pricing question" />
            </div>
            <div>
              <Label>Match mode</Label>
              <Select value={form.matchMode} onValueChange={(v: any) => setForm({ ...form, matchMode: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">contains</SelectItem>
                  <SelectItem value="exact">exact</SelectItem>
                  <SelectItem value="startsWith">starts with</SelectItem>
                  <SelectItem value="regex">regex</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Keywords (comma-separated)</Label>
              <Input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="price, pricing, cost" />
            </div>
            <div className="md:col-span-2">
              <Label>Reply body</Label>
              <textarea
                value={form.replyBody}
                onChange={(e) => setForm({ ...form, replyBody: e.target.value })}
                className="w-full min-h-[80px] rounded-md border bg-background p-2 text-sm"
                placeholder="Our pricing starts at …"
              />
            </div>
            <div>
              <Label>Assign tag (optional)</Label>
              <Select value={form.assignTagId} onValueChange={(v) => setForm({ ...form, assignTagId: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">— none —</SelectItem>
                  {tags.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sender</Label>
              <Select value={form.senderId} onValueChange={(v) => setForm({ ...form, senderId: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Any sender</SelectItem>
                  {senders.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.phoneNumberE164}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.caseSensitive} onCheckedChange={(v) => setForm({ ...form, caseSensitive: v })} />
              <Label>Case sensitive</Label>
            </div>
            <div>
              <Label>Priority (lower = checked first)</Label>
              <Input
                type="number"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: Number(e.target.value || 0) })}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button disabled={!form.name || !form.keywords || create.isPending} onClick={() => create.mutate()}>
              <Plus className="h-4 w-4 mr-1" />
              Create trigger
            </Button>
          </div>
        </CardContent>
      </Card>

      {items.length === 0 ? (
        <Alert>
          <AlertTitle>No keyword triggers yet</AlertTitle>
          <AlertDescription>Add one above; it will run on every inbound message immediately.</AlertDescription>
        </Alert>
      ) : (
        <div className="rounded-lg border divide-y">
          {items.map((t) => (
            <div key={t.id} className="px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
              <div className="min-w-[160px]">
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-muted-foreground">
                  {t.matchMode} · {(t.keywords || []).join(", ")}
                </div>
              </div>
              <Badge variant="outline">priority {t.priority}</Badge>
              <Badge variant="outline">fires: {t.fireCount}</Badge>
              <Switch checked={t.enabled} onCheckedChange={() => toggle.mutate(t)} className="ml-auto" />
              <Button variant="ghost" size="sm" onClick={() => del.mutate(t.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
