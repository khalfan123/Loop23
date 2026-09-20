import { Loader2, MessageSquare, Plus, Trash2, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export type CopilotLibraryTab = "chats" | "automations";

type SavedChat = {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
};

type SavedAutomation = {
  id: string;
  chatId: string;
  name: string;
  status: "draft" | "published";
  stepCount: number;
  updatedAt: string;
  source: "saved_chat";
};

type CopilotLibraryTabsProps = {
  activeTab: CopilotLibraryTab | null;
  onTabChange: (tab: CopilotLibraryTab | null) => void;
  savedChats: SavedChat[];
  savedAutomations: SavedAutomation[];
  activeChatId: string | null;
  loadingChats?: boolean;
  loadingAutomations?: boolean;
  onLoadChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onNewChat: () => void;
  onLoadAutomation: (id: string) => void;
  onDeleteAutomation: (id: string) => void;
};

function formatUpdatedAt(value: string) {
  try {
    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export function CopilotLibraryTabBar({
  activeTab,
  onTabChange,
}: Pick<CopilotLibraryTabsProps, "activeTab" | "onTabChange">) {
  const tabs: Array<{ id: CopilotLibraryTab; label: string; icon: typeof MessageSquare }> = [
    { id: "chats", label: "Chats", icon: MessageSquare },
    { id: "automations", label: "Automations", icon: Workflow },
  ];

  return (
    <div
      className="shrink-0 px-3 py-2 border-b border-border/50 bg-muted/20"
      data-testid="copilot-library-tabs"
    >
      <div className="flex rounded-lg border border-border/60 bg-muted/40 p-0.5">
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(active ? null : id)}
              data-testid={`tab-copilot-${id}`}
              className={cn(
                "flex-1 inline-flex items-center justify-center gap-1.5 h-7 rounded-md text-[12px] font-medium transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CopilotLibraryPanel({
  activeTab,
  savedChats,
  savedAutomations,
  activeChatId,
  loadingChats,
  loadingAutomations,
  onLoadChat,
  onDeleteChat,
  onNewChat,
  onLoadAutomation,
  onDeleteAutomation,
}: Omit<CopilotLibraryTabsProps, "onTabChange">) {
  if (!activeTab) return null;

  if (activeTab === "chats") {
    return (
      <div className="flex flex-col flex-1 min-h-0" data-testid="copilot-library-chats">
        <div className="shrink-0 px-3 py-2 flex items-center justify-between gap-2 border-b border-border/40">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            Recent chats
          </p>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
            onClick={onNewChat}
            data-testid="button-new-copilot-chat"
          >
            <Plus className="h-3 w-3" />
            New chat
          </button>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          {loadingChats ? (
            <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading chats…
            </div>
          ) : savedChats.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                No saved chats yet. Press the save icon to keep this conversation — only you can see
                it.
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-0.5">
              {savedChats.map((chat) => {
                const isActive = activeChatId === chat.id;
                return (
                  <div
                    key={chat.id}
                    className={cn(
                      "group flex items-start gap-1 rounded-md border border-transparent",
                      isActive ? "bg-primary/5 border-primary/20" : "hover:bg-muted/70",
                    )}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left px-2.5 py-2"
                      onClick={() => onLoadChat(chat.id)}
                      data-testid={`saved-chat-${chat.id}`}
                    >
                      <span className="block text-[13px] font-medium truncate">{chat.title}</span>
                      <span className="block text-[10px] text-muted-foreground mt-0.5">
                        {formatUpdatedAt(chat.updatedAt)}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-2 text-muted-foreground hover:text-destructive transition-opacity"
                      title="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteChat(chat.id);
                      }}
                      data-testid={`delete-chat-${chat.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0" data-testid="copilot-library-automations">
      <div className="shrink-0 px-3 py-2 border-b border-border/40">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          Your automations
        </p>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        {loadingAutomations ? (
          <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading automations…
          </div>
        ) : savedAutomations.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Workflow className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              No saved automations yet. Build a flow on the canvas, then save the chat to keep it
              here.
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-0.5">
            {savedAutomations.map((item) => {
              const isActive = activeChatId === item.id;
              return (
                <div
                  key={item.id}
                  className={cn(
                    "group flex items-start gap-1 rounded-md border border-transparent",
                    isActive ? "bg-primary/5 border-primary/20" : "hover:bg-muted/70",
                  )}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left px-2.5 py-2"
                    onClick={() => onLoadAutomation(item.id)}
                    data-testid={`saved-automation-${item.id}`}
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="block text-[13px] font-medium truncate flex-1">
                        {item.name}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[9px] uppercase tracking-wide shrink-0 px-1 py-0"
                      >
                        {item.status}
                      </Badge>
                    </span>
                    <span className="block text-[10px] text-muted-foreground mt-0.5">
                      {item.stepCount} step{item.stepCount === 1 ? "" : "s"} ·{" "}
                      {formatUpdatedAt(item.updatedAt)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-2 text-muted-foreground hover:text-destructive transition-opacity"
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteAutomation(item.id);
                    }}
                    data-testid={`delete-automation-${item.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
