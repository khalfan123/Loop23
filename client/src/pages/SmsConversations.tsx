import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Plus, Settings as SettingsIcon, AlertCircle, Info } from "lucide-react";

const ALPHA_UNSUPPORTED_COUNTRIES = new Set(["US", "CA", "CN", "VN"]);

type Conversation = {
  id: string;
  channel: string;
  status: string;
  peerPhoneE164: string | null;
  lastMessageAt: string;
};

type Message = {
  id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  twilioMessageSid: string | null;
  status: string;
  numSegments: number | null;
  creditsCharged: number;
  createdAt: string;
};

type Settings = {
  settings: {
    senderType: "phone_number" | "messaging_service" | "alphanumeric";
    phoneNumberId: string | null;
    messagingServiceSid: string | null;
    alphanumericSender: string | null;
  } | null;
  defaultCreditsPerSegment: number;
};

function MessageBubble({ msg }: { msg: Message }) {
  const isOutbound = msg.direction === "outbound";
  return (
    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
          isOutbound ? "bg-primary text-primary-foreground" : "bg-muted"
        }`}
      >
        <div className="whitespace-pre-wrap break-words">{msg.body || ""}</div>
        <div
          className={`mt-1 flex items-center gap-2 text-[10px] ${
            isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"
          }`}
        >
          <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          {isOutbound && (
            <>
              <span>·</span>
              <span className="uppercase tracking-wide">{msg.status}</span>
              {msg.creditsCharged > 0 && (
                <>
                  <span>·</span>
                  <span>{msg.creditsCharged} cr</span>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SmsConversations() {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newConvoOpen, setNewConvoOpen] = useState(false);
  const [newConvoPhone, setNewConvoPhone] = useState("");
  const [newConvoBody, setNewConvoBody] = useState("");

  const { data: settings } = useQuery<Settings>({ queryKey: ["/api/sms/settings"] });
  const senderConfigured = !!settings?.settings;
  const isAlphaSender = settings?.settings?.senderType === "alphanumeric";

  // Look up the destination country for the typed-in E.164 so we can warn
  // before submit when the alpha sender can't deliver to that country.
  const trimmedPhone = newConvoPhone.trim();
  const { data: ratePreview } = useQuery<{ destinationCountry: string | null; creditsPerSegment: number }>({
    queryKey: [`/api/sms/rate-preview?to=${encodeURIComponent(trimmedPhone)}`],
    enabled: newConvoOpen && trimmedPhone.length >= 4,
  });
  const newConvoCountryBlocked =
    isAlphaSender &&
    !!ratePreview?.destinationCountry &&
    ALPHA_UNSUPPORTED_COUNTRIES.has(ratePreview.destinationCountry);

  const { data: conversations = [], isLoading: loadingConvos } = useQuery<Conversation[]>({
    queryKey: ["/api/sms/conversations"],
    refetchInterval: 15_000,
  });

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const { data: thread = [], isLoading: loadingThread } = useQuery<Message[]>({
    queryKey: selectedId ? [`/api/sms/conversations/${selectedId}/messages`] : ["sms-thread-empty"],
    enabled: !!selectedId,
    refetchInterval: selectedId ? 5_000 : false,
  });

  // Last send failure surfaced inline so users see *why* a send was rejected
  // (insufficient credits, unsupported country for alpha sender, Twilio
  // rejection, etc.) without needing to open DevTools.
  const [lastSendError, setLastSendError] = useState<{
    status?: number;
    error?: string;
    raw?: string;
  } | null>(null);

  const captureSendError = (err: any) => {
    setLastSendError({
      status: err?.status,
      error: err?.data?.error || err?.message,
      raw: (() => {
        try {
          return JSON.stringify(err?.data ?? { message: err?.message }, null, 2);
        } catch {
          return String(err?.message || err);
        }
      })(),
    });
    // eslint-disable-next-line no-console
    console.error("[sms-send] failed", {
      status: err?.status,
      message: err?.message,
      serverError: err?.data?.error,
      code: err?.data?.code,
      rawData: err?.data,
    });
  };

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("No conversation selected");
      if (!draft.trim()) throw new Error("Message is empty");
      const res = await apiRequest("POST", "/api/sms/messages", {
        conversationId: selectedId,
        body: draft.trim(),
      });
      return res.json();
    },
    onSuccess: async () => {
      setDraft("");
      setLastSendError(null);
      if (selectedId) {
        await queryClient.invalidateQueries({ queryKey: [`/api/sms/conversations/${selectedId}/messages`] });
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/sms/conversations"] });
    },
    onError: (err: any) => {
      captureSendError(err);
      toast({ title: "Couldn't send", description: err?.data?.error || err?.message || "Send failed", variant: "destructive" });
    },
  });

  const quickSendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/sms/quick-send", {
        peerPhoneE164: newConvoPhone.trim(),
        body: newConvoBody.trim(),
      });
      return res.json() as Promise<{ conversationId: string }>;
    },
    onSuccess: async (result) => {
      setNewConvoOpen(false);
      setNewConvoPhone("");
      setNewConvoBody("");
      setLastSendError(null);
      await queryClient.invalidateQueries({ queryKey: ["/api/sms/conversations"] });
      setSelectedId(result.conversationId);
      toast({ title: "SMS sent", description: "Message queued with Twilio." });
    },
    onError: (err: any) => {
      captureSendError(err);
      toast({ title: "Couldn't send", description: err?.data?.error || err?.message || "Send failed", variant: "destructive" });
    },
  });

  return (
    <div className="flex h-[calc(100vh-220px)] gap-4">
      {/* Conversation list */}
      <Card className="w-[320px] overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div>
            <div className="font-semibold">Conversations</div>
            <div className="text-xs text-muted-foreground">SMS threads</div>
          </div>

          <Dialog open={newConvoOpen} onOpenChange={setNewConvoOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5" disabled={!senderConfigured} data-testid="button-new-sms">
                <Plus className="h-3.5 w-3.5" /> New
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New SMS conversation</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {isAlphaSender && (
                  <Alert className="border-blue-500/50 bg-blue-500/10">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertTitle className="text-sm">One-way send</AlertTitle>
                    <AlertDescription className="text-xs">
                      You're sending from an alphanumeric ID. Recipients won't be able to reply.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="space-y-1">
                  <label className="text-sm font-medium">Recipient (E.164)</label>
                  <Input
                    placeholder="+15551234567"
                    value={newConvoPhone}
                    onChange={(e) => setNewConvoPhone(e.target.value)}
                    data-testid="input-new-sms-to"
                  />
                  {newConvoCountryBlocked && (
                    <p className="text-xs text-destructive" data-testid="text-alpha-country-blocked">
                      Alphanumeric senders aren't supported in {ratePreview?.destinationCountry}.
                      Switch to a phone-number sender in Setup to message this destination.
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Message</label>
                  <Textarea
                    rows={4}
                    placeholder="Type your message…"
                    value={newConvoBody}
                    onChange={(e) => setNewConvoBody(e.target.value)}
                    data-testid="textarea-new-sms-body"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => quickSendMutation.mutate()}
                  disabled={
                    !newConvoPhone.trim() ||
                    !newConvoBody.trim() ||
                    quickSendMutation.isPending ||
                    newConvoCountryBlocked
                  }
                  data-testid="button-send-new-sms"
                >
                  {quickSendMutation.isPending ? "Sending…" : "Send SMS"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isAlphaSender && senderConfigured && (
          <Alert className="m-3 border-blue-500/50 bg-blue-500/10">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-sm">One-way sender active</AlertTitle>
            <AlertDescription className="text-xs">
              Sending from <strong>{settings?.settings?.alphanumericSender}</strong>.
              Recipients cannot reply to alphanumeric senders.
            </AlertDescription>
          </Alert>
        )}

        <ScrollArea className="flex-1">
          {!senderConfigured ? (
            <div className="p-4 space-y-3">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Set up SMS first</AlertTitle>
                <AlertDescription>Set your alphanumeric sender ID in the Setup tab to start sending.</AlertDescription>
              </Alert>
              <Link href="/app/sms/setup">
                <Button size="sm" className="w-full gap-1.5">
                  <SettingsIcon className="h-3.5 w-3.5" /> Open Setup
                </Button>
              </Link>
            </div>
          ) : loadingConvos ? (
            <div className="p-4 text-sm text-muted-foreground">Loading…</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No conversations yet. Click <strong>New</strong> to start one.</div>
          ) : (
            <div className="p-2 space-y-1">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg border transition ${
                    c.id === selectedId ? "bg-muted" : "hover:bg-muted/50"
                  }`}
                  data-testid={`row-sms-convo-${c.id}`}
                >
                  <div className="text-sm font-medium truncate">{c.peerPhoneE164 || "Unknown peer"}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {new Date(c.lastMessageAt).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </Card>

      {/* Thread + compose */}
      <Card className="flex-1 overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div>
            <div className="font-semibold">
              {selected ? selected.peerPhoneE164 || "Conversation" : "Select a conversation"}
            </div>
            <div className="text-xs text-muted-foreground">
              {selected ? "SMS" : "Pick a thread on the left or start a new one"}
            </div>
          </div>
          {selected && (
            <Badge variant="outline" className="text-xs">
              {selected.status}
            </Badge>
          )}
        </div>

        <ScrollArea className="flex-1 px-4 py-4">
          {!selected ? (
            <div className="text-sm text-muted-foreground py-12 text-center">
              No conversation selected.
            </div>
          ) : loadingThread ? (
            <div className="text-sm text-muted-foreground">Loading messages…</div>
          ) : thread.length === 0 ? (
            <div className="text-sm text-muted-foreground py-12 text-center">No messages yet.</div>
          ) : (
            <div className="space-y-3">
              {thread.map((m) => (
                <MessageBubble key={m.id} msg={m} />
              ))}
            </div>
          )}
        </ScrollArea>

        {selected && (
          <div className="border-t px-4 py-3">
            {lastSendError && (
              <Alert
                className="mb-2 border-destructive/50 bg-destructive/10"
                data-testid="alert-send-error"
              >
                <AlertCircle className="h-4 w-4 text-destructive" />
                <AlertTitle className="text-sm">
                  Send failed — HTTP {lastSendError.status ?? "?"}
                </AlertTitle>
                <AlertDescription className="text-xs">
                  <p className="mb-1">{lastSendError.error || "Unknown error"}</p>
                  <pre
                    className="mt-1 max-h-32 overflow-auto rounded bg-background/60 p-2 text-[10px] leading-snug"
                    data-testid="text-send-error-raw"
                  >
                    {lastSendError.raw}
                  </pre>
                  <button
                    type="button"
                    className="mt-1 text-[10px] underline"
                    onClick={() => setLastSendError(null)}
                  >
                    Dismiss
                  </button>
                </AlertDescription>
              </Alert>
            )}
            <div className="flex gap-2">
              <Textarea
                rows={2}
                placeholder="Type a message…"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  if (lastSendError) setLastSendError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    if (draft.trim()) sendMutation.mutate();
                  }
                }}
                className="flex-1 resize-none"
                data-testid="textarea-sms-compose"
              />
              <Button
                onClick={() => sendMutation.mutate()}
                disabled={!draft.trim() || sendMutation.isPending}
                data-testid="button-sms-send"
              >
                {sendMutation.isPending ? "Sending…" : "Send"}
              </Button>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              ⌘/Ctrl + Enter to send. Long messages are billed per 160-char segment (or 70 for Unicode).
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
