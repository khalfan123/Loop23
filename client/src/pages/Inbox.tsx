import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

type QuickReply = { id: string; shortcut: string; body: string };

type Sender = {
  id: string;
  status: string;
  phoneNumberE164: string;
};

type Conversation = {
  id: string;
  channel: string;
  status: string;
  lastMessageAt: string;
  whatsappSenderId?: string | null;
  contactId?: string | null;
};

type Message = {
  id: string;
  direction: "inbound" | "outbound";
  body?: string | null;
  createdAt: string;
};

export default function Inbox() {
  const [, setLocation] = useLocation();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const draftRef = useRef<HTMLInputElement | null>(null);

  const { data: quickReplies = [] } = useQuery<QuickReply[]>({
    queryKey: ["/api/whatsapp/quick-replies"],
  });

  const quickReplyMatches = useMemo(() => {
    if (!showQuickReplies) return [];
    const q = draft.toLowerCase();
    if (!q.startsWith("/")) return [];
    return quickReplies
      .filter((r) => r.shortcut.toLowerCase().startsWith(q) || r.body.toLowerCase().includes(q.slice(1)))
      .slice(0, 8);
  }, [draft, quickReplies, showQuickReplies]);

  const { data: senders = [], isLoading: loadingSenders } = useQuery<Sender[]>({
    queryKey: ["/api/whatsapp/senders"],
  });

  const { data: conversations = [], isLoading: loadingConversations } = useQuery<Conversation[]>({
    queryKey: ["/api/inbox/conversations"],
  });

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedConversationId) || null,
    [conversations, selectedConversationId],
  );

  const { data: thread = [], isLoading: loadingThread } = useQuery<Message[]>({
    queryKey: selectedConversationId ? [`/api/inbox/conversations/${selectedConversationId}/messages`] : ["inbox-empty"],
    enabled: !!selectedConversationId,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedConversationId) throw new Error("No conversation selected");
      if (!draft.trim()) throw new Error("Message is empty");
      await apiRequest("POST", "/api/whatsapp/messages", { conversationId: selectedConversationId, body: draft.trim() });
    },
    onSuccess: async () => {
      setDraft("");
      if (selectedConversationId) {
        await queryClient.invalidateQueries({ queryKey: [`/api/inbox/conversations/${selectedConversationId}/messages`] });
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/inbox/conversations"] });
    },
  });

  const hasLiveOrPendingSender = senders.length > 0;

  return (
    <div className="flex h-[calc(100vh-80px)] gap-4">
      <Card className="w-[320px] overflow-hidden">
        <div className="px-4 py-3 border-b">
          <div className="font-semibold">Inbox</div>
          <div className="text-xs text-muted-foreground">WhatsApp conversations</div>
        </div>
        <ScrollArea className="h-full">
          {(loadingSenders || loadingConversations) ? (
            <div className="p-4 text-sm text-muted-foreground">Loading…</div>
          ) : !hasLiveOrPendingSender ? (
            <div className="p-4 space-y-3">
              <div className="text-sm font-medium">Connect WhatsApp</div>
              <div className="text-sm text-muted-foreground">
                Log in with Facebook and we'll pull in your WhatsApp Business accounts, phone numbers, templates and
                business profile.
              </div>
              <Button onClick={() => setLocation("/app/inbox/whatsapp-setup")} className="w-full">
                Continue with Facebook
              </Button>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-4 space-y-3">
              <div className="text-sm text-muted-foreground">No conversations yet.</div>
              <Button variant="outline" size="sm" className="w-full" onClick={() => setLocation("/app/inbox/whatsapp-setup")}>
                Connect another WhatsApp account
              </Button>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedConversationId(c.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg border ${
                    c.id === selectedConversationId ? "bg-muted" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="text-sm font-medium truncate">{c.id.slice(0, 8)}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {new Date(c.lastMessageAt).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </Card>

      <Card className="flex-1 overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div>
            <div className="font-semibold">{selected ? `Conversation ${selected.id.slice(0, 8)}` : "Select a conversation"}</div>
            <div className="text-xs text-muted-foreground">{selected ? "WhatsApp" : " "}</div>
          </div>
          {hasLiveOrPendingSender ? (
            <Button variant="outline" size="sm" onClick={() => setLocation("/app/inbox/whatsapp-setup")}>
              Connect WhatsApp
            </Button>
          ) : null}
        </div>

        <div className="flex flex-col h-full">
          <ScrollArea className="flex-1">
            {!hasLiveOrPendingSender ? (
              <div className="p-6 text-sm text-muted-foreground">
                Enable WhatsApp on a number to start receiving messages.
              </div>
            ) : !selectedConversationId ? (
              <div className="p-6 text-sm text-muted-foreground">Choose a thread on the left.</div>
            ) : loadingThread ? (
              <div className="p-6 text-sm text-muted-foreground">Loading messages…</div>
            ) : (
              <div className="p-4 space-y-2">
                {thread.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[70%] rounded-xl px-3 py-2 text-sm border ${
                      m.direction === "outbound" ? "ml-auto bg-muted" : "mr-auto"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.body || ""}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {new Date(m.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="p-3 border-t space-y-2">
            {quickReplyMatches.length > 0 ? (
              <div className="rounded-md border bg-background max-h-[160px] overflow-auto">
                {quickReplyMatches.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-muted/50"
                    onClick={() => {
                      setDraft(r.body);
                      setShowQuickReplies(false);
                      requestAnimationFrame(() => draftRef.current?.focus());
                    }}
                  >
                    <span className="font-mono text-xs px-1 py-0.5 rounded bg-muted mr-2">{r.shortcut}</span>
                    <span className="text-muted-foreground">{r.body}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="flex gap-2">
              <Input
                ref={draftRef}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setShowQuickReplies(e.target.value.startsWith("/"));
                }}
                onFocus={() => setShowQuickReplies(draft.startsWith("/"))}
                placeholder="Type a message…   (start with / to use a quick reply)"
                disabled={!hasLiveOrPendingSender || !selectedConversationId || sendMutation.isPending}
              />
              <Button
                onClick={() => sendMutation.mutate()}
                disabled={!hasLiveOrPendingSender || !selectedConversationId || sendMutation.isPending}
              >
                Send
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
