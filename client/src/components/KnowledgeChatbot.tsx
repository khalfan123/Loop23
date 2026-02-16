import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, X, Send, Loader2, MessageCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ title?: string; resourceTitle?: string; score?: number }>;
}

interface KnowledgeChatbotProps {
  knowledgeBaseIds: string[];
}

export default function KnowledgeChatbot({ knowledgeBaseIds }: KnowledgeChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      const res = await apiRequest("POST", "/api/rag-knowledge/search", {
        query,
        knowledgeBaseIds,
      });
      return res.json();
    },
    onSuccess: (data) => {
      const answer =
        data.aiAnswer ||
        data.formattedResponse ||
        "No relevant knowledge sources found for this question.";
      const noInfoPhrases = ["don't have", "no relevant", "no specific", "rephrase"];
      const isNoInfo = noInfoPhrases.some((p) => answer.toLowerCase().includes(p));
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: answer,
          sources: isNoInfo ? undefined : data.results,
        },
      ]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Something went wrong. Please try again.",
        },
      ]);
    },
  });

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || searchMutation.isPending || knowledgeBaseIds.length === 0) return;
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    searchMutation.mutate(trimmed);
  };

  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.closest("[data-radix-scroll-area-viewport]");
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages, searchMutation.isPending]);

  return (
    <>
      <div
        className={`fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 transition-all duration-300 ${isOpen ? "pointer-events-auto" : ""}`}
      >
        {isOpen && (
          <div
            className="w-[380px] h-[500px] rounded-md border bg-background shadow-lg flex flex-col"
            data-testid="chatbot-panel"
          >
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                  <Brain className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-sm font-medium">Knowledge Assistant</span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setIsOpen(false)}
                data-testid="button-close-chatbot"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <ScrollArea className="flex-1">
              <div ref={scrollRef} className="px-4 py-3 space-y-4">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center mb-3">
                      <MessageCircle className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-sm font-medium">Ask a question</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Query your knowledge base using natural language
                    </p>
                  </div>
                )}

                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-md px-3 py-2 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                      data-testid={`chat-message-${msg.role}-${idx}`}
                    >
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-2 space-y-1.5 border-t border-border/40 pt-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            Sources ({msg.sources.length})
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {msg.sources.map((src, sIdx) => (
                              <Badge
                                key={sIdx}
                                variant="secondary"
                                className="text-xs"
                              >
                                {src.title || src.resourceTitle || `Source ${sIdx + 1}`}
                                {src.score !== undefined && (
                                  <span className="ml-1 opacity-60">
                                    {Math.round(src.score * 100)}%
                                  </span>
                                )}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {searchMutation.isPending && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-md px-3 py-2 flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Thinking...</span>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="border-t px-4 py-3">
              <div className="flex gap-2">
                <Input
                  placeholder={
                    knowledgeBaseIds.length === 0
                      ? "Add knowledge sources first..."
                      : "Ask a question..."
                  }
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSend();
                  }}
                  disabled={knowledgeBaseIds.length === 0}
                  data-testid="input-chatbot-query"
                />
                <Button
                  size="icon"
                  disabled={
                    !input.trim() ||
                    searchMutation.isPending ||
                    knowledgeBaseIds.length === 0
                  }
                  onClick={handleSend}
                  data-testid="button-chatbot-send"
                >
                  {searchMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        <button
          className="h-12 w-12 rounded-full shadow-lg bg-primary text-primary-foreground hover-elevate active-elevate-2 flex items-center justify-center transition-transform duration-200"
          onClick={() => setIsOpen(!isOpen)}
          data-testid="button-open-chatbot"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Brain className="h-5 w-5" />}
        </button>
      </div>
    </>
  );
}
