import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send, Plus } from "lucide-react";

type Sender = { id: string; phoneNumberE164: string; profileName: string | null; status: string; wabaId: string | null };
type Tag = { id: string; name: string };
type Template = { id: string; name: string; language: string; status: string };
type Channel = { id: string; wabaId: string; name: string | null };
type Broadcast = {
  id: string;
  name: string;
  status: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  templateName: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export default function WhatsappBroadcasts() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);

  const { data: broadcasts = [] } = useQuery<Broadcast[]>({ queryKey: ["/api/whatsapp/broadcasts"] });
  const { data: tags = [] } = useQuery<Tag[]>({ queryKey: ["/api/whatsapp/tags"] });
  const { data: senders = [] } = useQuery<Sender[]>({ queryKey: ["/api/whatsapp/senders"] });
  const { data: channels = [] } = useQuery<Channel[]>({ queryKey: ["/api/whatsapp/channels"] });

  const sendMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/whatsapp/broadcasts/${encodeURIComponent(id)}/send`),
    onSuccess: async () => {
      toast({ title: "Sending started" });
      await queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/broadcasts"] });
    },
    onError: (e: any) => toast({ title: "Failed to send", description: e?.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/app/inbox")} className="-ml-2 gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back to Inbox
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Broadcasts</h1>
          <p className="text-sm text-muted-foreground">Send approved WhatsApp templates to tagged contacts.</p>
        </div>
        <Button onClick={() => setShowCreate((v) => !v)}>
          <Plus className="h-4 w-4 mr-1" />
          New broadcast
        </Button>
      </div>

      {showCreate ? (
        <CreateBroadcast
          tags={tags}
          senders={senders}
          channels={channels}
          onCreated={async () => {
            setShowCreate(false);
            await queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/broadcasts"] });
          }}
        />
      ) : null}

      {broadcasts.length === 0 ? (
        <Alert>
          <AlertTitle>No broadcasts yet</AlertTitle>
          <AlertDescription>Create one using an approved template and at least one tag.</AlertDescription>
        </Alert>
      ) : (
        <div className="rounded-lg border divide-y">
          {broadcasts.map((b) => (
            <div key={b.id} className="px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
              <div className="min-w-[160px] font-medium">{b.name}</div>
              <div className="text-xs text-muted-foreground">
                {b.templateName ? `${b.templateName}` : "—"}
              </div>
              <Badge variant="outline" className="ml-auto">
                {b.status}
              </Badge>
              <div className="text-xs text-muted-foreground">
                {b.sentCount}/{b.totalRecipients} sent
                {b.failedCount ? ` · ${b.failedCount} failed` : ""}
              </div>
              {b.status === "draft" ? (
                <Button size="sm" onClick={() => sendMutation.mutate(b.id)} disabled={sendMutation.isPending}>
                  <Send className="h-4 w-4 mr-1" />
                  Send
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateBroadcast({
  tags,
  senders,
  channels,
  onCreated,
}: {
  tags: Tag[];
  senders: Sender[];
  channels: Channel[];
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [senderId, setSenderId] = useState<string>(senders[0]?.id || "");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [templateLanguage, setTemplateLanguage] = useState("en_US");
  const [variables, setVariables] = useState("");

  const matchingChannel = useMemo(() => {
    const sender = senders.find((s) => s.id === senderId);
    if (!sender?.wabaId) return null;
    return channels.find((c) => c.wabaId === sender.wabaId) || null;
  }, [senderId, senders, channels]);

  const templatesQuery = useQuery<Template[]>({
    queryKey: ["/api/whatsapp/templates", matchingChannel?.id || ""],
    enabled: !!matchingChannel?.id,
    queryFn: async () => {
      const qs = new URLSearchParams({ wabaRowId: matchingChannel!.id });
      const res = await apiRequest("GET", `/api/whatsapp/templates?${qs.toString()}`);
      return (await res.json()) as Template[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const body = {
        name,
        senderId,
        templateName,
        templateLanguage,
        templateVariables: variables ? variables.split(",").map((s) => s.trim()).filter(Boolean) : [],
        audienceTagIds: tagIds,
      };
      return apiRequest("POST", "/api/whatsapp/broadcasts", body);
    },
    onSuccess: () => {
      toast({ title: "Broadcast created" });
      onCreated();
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const approvedTemplates = (templatesQuery.data || []).filter((t) => t.status === "APPROVED");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New broadcast</CardTitle>
        <CardDescription>You can only send templates that are APPROVED by Meta.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Spring promo" />
          </div>
          <div>
            <Label>Sender</Label>
            <Select value={senderId} onValueChange={setSenderId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a sender" />
              </SelectTrigger>
              <SelectContent>
                {senders.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.phoneNumberE164} {s.profileName ? `· ${s.profileName}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Template</Label>
            <Select value={templateName} onValueChange={setTemplateName}>
              <SelectTrigger>
                <SelectValue placeholder={matchingChannel ? "Choose approved template" : "Sender not linked to a WABA"} />
              </SelectTrigger>
              <SelectContent>
                {approvedTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.name}>
                    {t.name} · {t.language}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Language</Label>
            <Input value={templateLanguage} onChange={(e) => setTemplateLanguage(e.target.value)} placeholder="en_US" />
          </div>
        </div>
        <div>
          <Label>Variables (comma-separated, in order)</Label>
          <Input value={variables} onChange={(e) => setVariables(e.target.value)} placeholder="Alice, ORDER-123" />
        </div>
        <div>
          <Label>Audience tags</Label>
          <div className="flex flex-wrap gap-2 pt-1">
            {tags.map((t) => {
              const active = tagIds.includes(t.id);
              return (
                <Badge
                  key={t.id}
                  variant={active ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setTagIds((cur) => (cur.includes(t.id) ? cur.filter((x) => x !== t.id) : [...cur, t.id]))}
                >
                  {t.name}
                </Badge>
              );
            })}
            {tags.length === 0 ? (
              <div className="text-xs text-muted-foreground">No tags yet. Create tags on the Audience page.</div>
            ) : null}
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            disabled={!name || !senderId || !templateName || tagIds.length === 0 || create.isPending}
            onClick={() => create.mutate()}
          >
            Create draft
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
