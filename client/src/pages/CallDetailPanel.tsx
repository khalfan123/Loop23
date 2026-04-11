import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Play,
  Pause,
  Download,
  Loader2,
  Phone,
  Clock,
  Calendar,
  MessageSquare,
  PhoneIncoming,
  PhoneOutgoing,
  CheckCircle2,
  XCircle,
  Volume2,
  Heart,
  Target,
  Bot,
  ChevronUp,
  ChevronDown,
  Globe,
  AlertTriangle,
  ClipboardCheck,
  ShieldAlert,
  Copy,
  Activity,
  Zap,
  DollarSign,
} from "lucide-react";
import { format } from "date-fns";
import { formatSipEndpoint } from "@/lib/formatters";
import { useLocation } from "wouter";
import { AuthStorage } from "@/lib/auth-storage";

interface Contact {
  id: string;
  firstName: string;
  lastName?: string | null;
  phone: string;
  email?: string | null;
}

interface Campaign {
  id: string;
  name: string;
}

interface CallResponse {
  id: string;
  callId: string;
  questionId: string;
  questionText: string;
  answerType: string;
  answerValue: string;
  isConcern: boolean;
  createdAt: string;
}

interface Call {
  id: string;
  campaignId: string | null;
  contactId: string | null;
  phoneNumber?: string | null;
  fromNumber?: string | null;
  toNumber?: string | null;
  status: string;
  duration: number | null;
  recordingUrl: string | null;
  elevenLabsConversationId?: string | null;
  transcript: string | null;
  aiSummary: string | null;
  classification: string | null;
  sentiment: string | null;
  metadata: Record<string, any> | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  callDirection: string | null;
  contact?: Contact | null;
  campaign?: Campaign | null;
  engine?: "elevenlabs" | "twilio-openai" | "openai";
  agent?: { id: string; name: string } | null;
  widgetId?: string | null;
  widget?: { id: string; name: string } | null;
  channelType?: string;
  cost?: number | null;
  endReason?: string | null;
  sessionOutcome?: string | null;
  endToEndLatencyMs?: number | null;
  responses?: CallResponse[];
  concernedQuestionsCount?: number;
}

interface CallDetailPanelProps {
  callId: string | null;
  open: boolean;
  onClose: () => void;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export default function CallDetailPanel({
  callId,
  open,
  onClose,
  onNavigatePrev,
  onNavigateNext,
  hasPrev = false,
  hasNext = false,
}: CallDetailPanelProps) {
  const [, setLocation] = useLocation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [recordingBlobUrl, setRecordingBlobUrl] = useState<string | null>(null);

  const { data: call, isLoading } = useQuery<Call>({
    queryKey: [`/api/calls/${callId}`],
    enabled: !!callId && open,
  });

  useEffect(() => {
    if (!open) {
      setIsPlaying(false);
      setCurrentTime(0);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  }, [open, callId]);

  useEffect(() => {
    const abortController = new AbortController();
    let fetchedBlobUrl: string | null = null;

    if (
      open &&
      call?.engine !== "openai" &&
      (call?.recordingUrl || call?.elevenLabsConversationId) &&
      callId
    ) {
      const fetchRecording = async () => {
        try {
          if (!AuthStorage.isAuthenticated()) return;
          const headers: Record<string, string> = {};
          const authHeader = AuthStorage.getAuthHeader();
          if (authHeader) headers["Authorization"] = authHeader;

          const response = await fetch(`/api/calls/${callId}/recording`, {
            headers,
            credentials: "include",
            signal: abortController.signal,
          });

          if (response.ok && !abortController.signal.aborted) {
            const blob = await response.blob();
            fetchedBlobUrl = URL.createObjectURL(blob);
            setRecordingBlobUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return fetchedBlobUrl;
            });
          }
        } catch (error: any) {
          if (error.name !== "AbortError")
            console.error("Failed to fetch recording:", error);
        }
      };
      fetchRecording();
    }

    return () => {
      abortController.abort();
      if (fetchedBlobUrl) URL.revokeObjectURL(fetchedBlobUrl);
      setRecordingBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [
    open,
    call?.engine,
    call?.recordingUrl,
    call?.elevenLabsConversationId,
    callId,
  ]);

  const hasRecording =
    call?.engine !== "openai" &&
    (call?.recordingUrl || call?.elevenLabsConversationId);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
            Successful
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
            Failed
          </Badge>
        );
      case "no-answer":
        return (
          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
            No answer
          </Badge>
        );
      case "busy":
        return (
          <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">
            Busy
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSentimentBadge = (sentiment: string | null) => {
    if (!sentiment) return null;
    switch (sentiment) {
      case "positive":
        return (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
            Positive
          </Badge>
        );
      case "negative":
        return (
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
            Negative
          </Badge>
        );
      case "neutral":
        return (
          <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/20">
            Neutral
          </Badge>
        );
      default:
        return <Badge variant="outline">{sentiment}</Badge>;
    }
  };

  const getEngineBadge = (engine?: string) => {
    if (engine === "twilio-openai") {
      return (
        <Badge className="bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20">
          Twilio+OpenAI
        </Badge>
      );
    }
    if (engine === "openai") {
      return (
        <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
          OpenAI
        </Badge>
      );
    }
    return (
      <Badge className="bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20">
        ElevenLabs
      </Badge>
    );
  };

  const getWidgetBadge = () => {
    if (!call?.widgetId) return null;
    return (
      <Badge className="bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20 gap-1">
        <Globe className="h-3 w-3" />
        Widget
      </Badge>
    );
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const isIncoming = call?.callDirection === "incoming";
  const primaryNumber = call
    ? isIncoming
      ? formatSipEndpoint(call.fromNumber, call.engine) ||
        call.contact?.phone ||
        call.phoneNumber ||
        "Unknown"
      : formatSipEndpoint(call.toNumber, call.engine) ||
        call.contact?.phone ||
        call.phoneNumber ||
        "Unknown"
    : "";
  const secondaryNumber = call
    ? isIncoming
      ? formatSipEndpoint(call.toNumber, call.engine) || "Your number"
      : formatSipEndpoint(call.fromNumber, call.engine) || "Your number"
    : "";

  const contactName = call
    ? call.widgetId
      ? call.widget?.name ||
        (call.metadata as any)?.widgetName ||
        "Website Widget"
      : call.contact?.firstName &&
          call.contact.firstName.toLowerCase() !== "unknown"
        ? `${call.contact.firstName} ${call.contact.lastName || ""}`.trim()
        : primaryNumber
    : "";

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[680px] p-0 flex flex-col overflow-hidden"
        data-testid="panel-call-detail"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Call Details</SheetTitle>
          <SheetDescription>Details for the selected call</SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !call ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Call not found</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 px-4 py-2 border-b glass-surface">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                Use{" "}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onNavigatePrev}
                  disabled={!hasPrev}
                  data-testid="button-nav-prev"
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onNavigateNext}
                  disabled={!hasNext}
                  data-testid="button-nav-next"
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>{" "}
                to navigate
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="p-5 space-y-4">
                <div className="glass-card rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-11 w-11 rounded-2xl bg-blue-500/[0.08] dark:bg-blue-500/[0.15] flex items-center justify-center shrink-0">
                      {isIncoming ? (
                        <PhoneIncoming className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <PhoneOutgoing className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-bold tracking-tight text-foreground truncate" data-testid="text-contact-name">
                          {contactName}
                        </h2>
                        {getStatusBadge(call.status)}
                        {getSentimentBadge(call.sentiment)}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {getWidgetBadge()}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground flex-wrap">
                        <span>{isIncoming ? "Incoming" : "Outgoing"}</span>
                        <span>·</span>
                        <span className="font-mono text-xs">
                          {isIncoming ? "From" : "To"}: {primaryNumber}
                        </span>
                        {secondaryNumber !== "Your number" && (
                          <>
                            <span>·</span>
                            <span className="font-mono text-xs">
                              {isIncoming ? "To" : "From"}: {secondaryNumber}
                            </span>
                          </>
                        )}
                      </div>
                      {call.agent && (
                        <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                          <Bot className="h-3 w-3" />
                          <span>
                            {call.agent.name}
                          </span>
                          <span className="font-mono text-xs">
                            ({call.agent.id.slice(0, 8)}...)
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyToClipboard(call.agent!.id)}
                            data-testid="button-copy-agent-id"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      {call.campaign && (
                        <div className="flex items-center gap-1 mt-0.5 text-sm text-muted-foreground">
                          <Target className="h-3 w-3" />
                          <span
                            className="text-sm cursor-pointer text-muted-foreground"
                            onClick={() =>
                              setLocation(`/app/campaigns/${call.campaign!.id}`)
                            }
                            data-testid="panel-link-campaign"
                          >
                            {call.campaign.name}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground font-mono" data-testid="text-call-id">
                        ID: {call.id.slice(0, 12)}...{call.id.slice(-4)}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(call.id)}
                          data-testid="button-copy-call-id"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="glass-surface rounded-2xl p-3">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      <span className="text-lg font-bold tracking-tight text-blue-700 dark:text-blue-300" data-testid="text-duration">
                        {formatDuration(call.duration)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">Duration</div>
                  </div>
                  <div className="glass-surface rounded-2xl p-3">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span className="text-sm font-bold tracking-tight text-indigo-700 dark:text-indigo-300" data-testid="text-date">
                        {format(new Date(call.startedAt || call.createdAt), "MMM d, h:mm a")}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">Date & Time</div>
                  </div>
                  <div className="glass-surface rounded-2xl p-3">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                      <span className="text-lg font-bold tracking-tight text-rose-700 dark:text-rose-300" data-testid="text-concerns">
                        {call.concernedQuestionsCount || 0}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">Concerns</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {call.cost != null && (
                    <div className="glass-surface rounded-2xl p-3">
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-sm font-bold tracking-tight text-emerald-700 dark:text-emerald-300" data-testid="text-cost">
                          ${Number(call.cost).toFixed(4)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">Cost</div>
                    </div>
                  )}
                  {call.endToEndLatencyMs != null && (
                    <div className="glass-surface rounded-2xl p-3">
                      <div className="flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        <span className="text-sm font-bold tracking-tight text-amber-700 dark:text-amber-300" data-testid="text-latency">
                          {call.endToEndLatencyMs}ms
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">Latency</div>
                    </div>
                  )}
                  <div className="glass-surface rounded-2xl p-3">
                    <div className="flex items-center gap-1.5">
                      {hasRecording ? (
                        <Volume2 className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-slate-400" />
                      )}
                      <span className="text-sm font-bold tracking-tight text-sky-700 dark:text-sky-300">
                        {hasRecording ? "Available" : "None"}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">Recording</div>
                  </div>
                  <div className="glass-surface rounded-2xl p-3">
                    <div className="flex items-center gap-1.5">
                      {call.transcript ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-slate-400" />
                      )}
                      <span className="text-sm font-bold tracking-tight text-emerald-700 dark:text-emerald-300">
                        {call.transcript ? "Available" : "None"}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">Transcript</div>
                  </div>
                </div>

                {hasRecording && (
                  <div className="glass-card rounded-2xl p-4 bg-slate-900/90 dark:bg-slate-950/90">
                    <div className="flex items-center gap-2 mb-3">
                      <Volume2 className="h-4 w-4 text-blue-400" />
                      <h3 className="text-sm font-medium tracking-tight text-slate-300">Audio Recording</h3>
                    </div>

                    {recordingBlobUrl ? (
                      <div className="flex items-center gap-3">
                        <Button
                          size="icon"
                          className="rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                          onClick={() => {
                            if (audioRef.current) {
                              if (isPlaying) {
                                audioRef.current.pause();
                              } else {
                                audioRef.current.play().catch(() => {});
                              }
                            }
                          }}
                          data-testid="button-play-pause"
                        >
                          {isPlaying ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4 ml-0.5" />
                          )}
                        </Button>

                        <div className="flex-1">
                          <div className="h-12 bg-slate-800/50 rounded-2xl flex items-center justify-center px-3 border border-slate-700/30">
                            <div className="flex items-end gap-[2px] h-9 w-full">
                              {Array.from({ length: 50 }).map((_, i) => {
                                const height =
                                  25 +
                                  Math.abs(
                                    Math.sin(i * 0.35) * 45 +
                                      Math.cos(i * 0.2) * 25
                                  );
                                const isActive =
                                  call.duration && currentTime > 0
                                    ? i < (currentTime / call.duration) * 50
                                    : false;
                                return (
                                  <div
                                    key={i}
                                    className={`flex-1 rounded-full transition-all duration-150 ${
                                      isActive
                                        ? "bg-blue-500"
                                        : "bg-slate-600/60"
                                    }`}
                                    style={{ height: `${height}%` }}
                                  />
                                );
                              })}
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-1 px-1">
                            <span className="text-xs font-mono text-blue-400">
                              {formatDuration(Math.floor(currentTime))}
                            </span>
                            <span className="text-xs font-mono text-slate-500">
                              {formatDuration(call.duration)}
                            </span>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-slate-400"
                          onClick={() => {
                            if (recordingBlobUrl) {
                              const link = document.createElement("a");
                              link.href = recordingBlobUrl;
                              link.download = `call-recording-${call.id}.mp3`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }
                          }}
                          data-testid="button-download-recording"
                        >
                          <Download className="h-4 w-4" />
                        </Button>

                        <audio
                          ref={audioRef}
                          src={recordingBlobUrl}
                          onPlay={() => setIsPlaying(true)}
                          onPause={() => setIsPlaying(false)}
                          onEnded={() => setIsPlaying(false)}
                          onTimeUpdate={(e) =>
                            setCurrentTime(e.currentTarget.currentTime)
                          }
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 py-3">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                        <span className="text-sm text-slate-400">
                          Loading recording...
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold tracking-tight text-foreground" data-testid="text-conversation-analysis-heading">
                    Conversation Analysis
                  </h4>
                  <div className="grid grid-cols-[1fr_1fr] gap-x-4 gap-y-2.5">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">Call Successful</span>
                    </div>
                    <div className="text-sm">
                      {call.status === "completed" ? (
                        <span className="text-green-600 dark:text-green-400">
                          Successful
                        </span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400">
                          Unsuccessful
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">Call Status</span>
                    </div>
                    <div className="text-sm">
                      {getStatusBadge(call.status)}
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Heart className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">User Sentiment</span>
                    </div>
                    <div className="text-sm">
                      {getSentimentBadge(call.sentiment) || (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </div>

                    {call.classification && (
                      <>
                        <div className="flex items-center gap-2 text-sm">
                          <Target className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Classification</span>
                        </div>
                        <div className="text-sm">
                          <Badge variant="outline" className="text-xs">
                            {call.classification.charAt(0).toUpperCase() +
                              call.classification.slice(1)}
                          </Badge>
                        </div>
                      </>
                    )}

                    {call.sessionOutcome && (
                      <>
                        <div className="flex items-center gap-2 text-sm">
                          <Activity className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Session Outcome</span>
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">
                            {call.sessionOutcome.charAt(0).toUpperCase() +
                              call.sessionOutcome.slice(1)}
                          </span>
                        </div>
                      </>
                    )}

                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">Disconnection Reason</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">
                        {call.endReason || "Unknown"}
                      </span>
                    </div>

                    {(call.concernedQuestionsCount ?? 0) > 0 && (
                      <>
                        <div className="flex items-center gap-2 text-sm">
                          <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Concerned Questions</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-rose-600 dark:text-rose-400 font-medium">
                            {call.concernedQuestionsCount}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {call.aiSummary && (
                  <div className="glass-card rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      <h4 className="text-sm font-semibold tracking-tight">
                        AI Summary
                      </h4>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-ai-summary">
                      {call.aiSummary}
                    </p>
                  </div>
                )}

                <Tabs defaultValue="transcription" className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <TabsList className="glass-surface rounded-2xl">
                      <TabsTrigger
                        value="transcription"
                        data-testid="panel-tab-transcription"
                      >
                        Transcription
                      </TabsTrigger>
                      <TabsTrigger
                        value="data"
                        data-testid="panel-tab-data"
                      >
                        Data
                      </TabsTrigger>
                      <TabsTrigger
                        value="screening"
                        data-testid="panel-tab-screening"
                      >
                        Screening
                      </TabsTrigger>
                    </TabsList>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        call.transcript &&
                        copyToClipboard(call.transcript)
                      }
                      data-testid="button-copy-transcript"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>

                  <TabsContent
                    value="transcription"
                    className="space-y-3 mt-0"
                  >
                    {call.transcript ? (
                      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                        {call.transcript
                          .split("\n")
                          .filter((line) => line.trim())
                          .map((line, index) => {
                            const timestampMatch = line.match(
                              /^\[(\d{2}:\d{2})\]\s*(.+)/
                            );
                            const speakerMatch = timestampMatch
                              ? timestampMatch[2].match(
                                  /^(Agent|User|AI|Customer):\s*(.+)/
                                )
                              : null;

                            if (timestampMatch && speakerMatch) {
                              const timestamp = timestampMatch[1];
                              const speaker = speakerMatch[1];
                              const message = speakerMatch[2];
                              const isAgent =
                                speaker === "Agent" || speaker === "AI";

                              return (
                                <div
                                  key={index}
                                  className="space-y-1"
                                  data-testid={`panel-transcript-${index}`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span
                                      className={`text-sm font-medium ${
                                        isAgent
                                          ? "text-blue-600 dark:text-blue-400"
                                          : "text-foreground"
                                      }`}
                                    >
                                      {speaker}
                                    </span>
                                    <span className="text-xs text-muted-foreground font-mono">
                                      {timestamp}
                                    </span>
                                  </div>
                                  <div
                                    className={`text-sm leading-relaxed pl-0 ${
                                      isAgent
                                        ? "border-l-2 border-blue-300 dark:border-blue-700 pl-3"
                                        : ""
                                    }`}
                                  >
                                    {message}
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={index}
                                className="text-sm text-muted-foreground"
                              >
                                {line}
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">
                          No transcript available for this call.
                        </p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="data" className="mt-0">
                    <div className="space-y-2 text-sm">
                      <div className="grid grid-cols-[140px_1fr] gap-y-2 gap-x-3">
                        <span className="text-muted-foreground">Call ID</span>
                        <span className="font-mono text-xs break-all">
                          {call.id}
                        </span>

                        <span className="text-muted-foreground">Direction</span>
                        <span>{isIncoming ? "Incoming" : "Outgoing"}</span>

                        <span className="text-muted-foreground">Channel</span>
                        <span>{call.channelType || (isIncoming ? "incoming" : "outgoing")}</span>

                        {call.contact && (
                          <>
                            <span className="text-muted-foreground">
                              Contact
                            </span>
                            <span>
                              {call.contact.firstName}{" "}
                              {call.contact.lastName || ""}
                            </span>
                          </>
                        )}

                        {call.contact?.email && (
                          <>
                            <span className="text-muted-foreground">Email</span>
                            <span>{call.contact.email}</span>
                          </>
                        )}

                        {call.contact?.phone && (
                          <>
                            <span className="text-muted-foreground">Phone</span>
                            <span className="font-mono text-xs">{call.contact.phone}</span>
                          </>
                        )}

                        {call.campaign && (
                          <>
                            <span className="text-muted-foreground">
                              Campaign
                            </span>
                            <span
                              className="cursor-pointer text-muted-foreground"
                              onClick={() =>
                                setLocation(
                                  `/app/campaigns/${call.campaign!.id}`
                                )
                              }
                              data-testid="panel-link-campaign-data"
                            >
                              {call.campaign.name}
                            </span>
                          </>
                        )}

                        <span className="text-muted-foreground">
                          Created At
                        </span>
                        <span>
                          {format(
                            new Date(call.createdAt),
                            "MMM d, yyyy 'at' h:mm:ss a"
                          )}
                        </span>

                        {call.startedAt && (
                          <>
                            <span className="text-muted-foreground">
                              Started At
                            </span>
                            <span>
                              {format(
                                new Date(call.startedAt),
                                "MMM d, yyyy 'at' h:mm:ss a"
                              )}
                            </span>
                          </>
                        )}

                        {call.endedAt && (
                          <>
                            <span className="text-muted-foreground">
                              Ended At
                            </span>
                            <span>
                              {format(
                                new Date(call.endedAt),
                                "MMM d, yyyy 'at' h:mm:ss a"
                              )}
                            </span>
                          </>
                        )}

                        {call.duration != null && (
                          <>
                            <span className="text-muted-foreground">Duration</span>
                            <span>{formatDuration(call.duration)}</span>
                          </>
                        )}

                        {call.cost != null && (
                          <>
                            <span className="text-muted-foreground">Cost</span>
                            <span>${Number(call.cost).toFixed(4)}</span>
                          </>
                        )}

                        {call.endToEndLatencyMs != null && (
                          <>
                            <span className="text-muted-foreground">Latency</span>
                            <span>{call.endToEndLatencyMs}ms</span>
                          </>
                        )}

                        {call.endReason && (
                          <>
                            <span className="text-muted-foreground">End Reason</span>
                            <span>{call.endReason}</span>
                          </>
                        )}

                        {call.sessionOutcome && (
                          <>
                            <span className="text-muted-foreground">Session Outcome</span>
                            <span>{call.sessionOutcome}</span>
                          </>
                        )}

                        {call.elevenLabsConversationId && (
                          <>
                            <span className="text-muted-foreground">Conversation ID</span>
                            <span className="font-mono text-xs break-all">
                              {call.elevenLabsConversationId}
                            </span>
                          </>
                        )}

                        {call.metadata &&
                          (call.metadata as any)?.agentAssistSummary && (
                            <>
                              <span className="text-muted-foreground col-span-2 mt-3 font-medium flex items-center gap-1">
                                <Zap className="h-3.5 w-3.5" />
                                Agent Assist Summary
                              </span>
                              <div className="col-span-2 glass-surface rounded-2xl p-3 space-y-2" data-testid="agent-assist-summary">
                                <div className="flex gap-3 text-xs">
                                  <div className="flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3 text-red-500" />
                                    <span>{(call.metadata as any).agentAssistSummary.complianceAlerts || 0} compliance alerts</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Activity className="h-3 w-3 text-blue-500" />
                                    <span>{(call.metadata as any).agentAssistSummary.totalInterventions || 0} interventions</span>
                                  </div>
                                </div>
                                {((call.metadata as any).agentAssistSummary.stepsCompleted?.length || 0) > 0 && (
                                  <div className="text-xs">
                                    <span className="font-medium flex items-center gap-1 mb-1">
                                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                                      Steps Completed
                                    </span>
                                    <div className="flex flex-wrap gap-1">
                                      {(call.metadata as any).agentAssistSummary.stepsCompleted.map((step: string, i: number) => (
                                        <Badge key={i} variant="outline" className="text-xs bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">
                                          {step}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {((call.metadata as any).agentAssistSummary.events?.length || 0) > 0 && (
                                  <div className="text-xs space-y-1">
                                    <span className="font-medium">Event Timeline</span>
                                    {(call.metadata as any).agentAssistSummary.events.slice(0, 10).map((evt: any, i: number) => (
                                      <div key={i} className={`text-xs p-1.5 rounded ${
                                        evt.type === 'compliance_alert' ? 'bg-red-500/10 text-red-700 dark:text-red-400'
                                        : evt.type === 'step_completed' ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                                        : evt.type === 'intervention' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
                                        : 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
                                      }`}>
                                        <span className="font-medium capitalize">{evt.type.replace(/_/g, ' ')}</span>: {evt.detail}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </>
                          )}

                        {call.metadata &&
                          Object.keys(call.metadata).filter(k => k !== 'agentAssistSummary').length > 0 && (
                            <>
                              <span className="text-muted-foreground col-span-2 mt-3 font-medium">
                                Additional Metadata
                              </span>
                              <pre className="col-span-2 text-xs glass-surface rounded-2xl p-3 overflow-x-auto">
                                {JSON.stringify(
                                  Object.fromEntries(Object.entries(call.metadata).filter(([k]) => k !== 'agentAssistSummary')),
                                  null, 2
                                )}
                              </pre>
                            </>
                          )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="screening" className="mt-0">
                    {call.responses && call.responses.length > 0 ? (
                      <div className="space-y-2">
                        {(call.concernedQuestionsCount ?? 0) > 0 && (
                          <div className="flex justify-end mb-2">
                            <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20 gap-1">
                              <ShieldAlert className="h-3 w-3" />
                              {call.concernedQuestionsCount} Concern
                              {(call.concernedQuestionsCount ?? 0) !== 1
                                ? "s"
                                : ""}
                            </Badge>
                          </div>
                        )}
                        {call.responses.map((response, index) => (
                          <div
                            key={response.id}
                            className={`p-3 rounded-2xl border ${
                              response.isConcern
                                ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40"
                                : "bg-card border-border"
                            }`}
                            data-testid={`panel-screening-${index}`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium">
                                {response.questionText}
                              </span>
                              {response.isConcern && (
                                <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20 text-xs">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Concern
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge
                                variant="outline"
                                className="text-xs font-mono"
                              >
                                {response.answerType}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {response.answerType === "MULTISELECT"
                                  ? (() => {
                                      try {
                                        const items = JSON.parse(
                                          response.answerValue
                                        );
                                        return Array.isArray(items) &&
                                          items.length > 0
                                          ? items.join(", ")
                                          : "None";
                                      } catch {
                                        return response.answerValue;
                                      }
                                    })()
                                  : (
                                    <span
                                      className={`font-medium ${
                                        response.isConcern
                                          ? "text-rose-600 dark:text-rose-400"
                                          : "text-emerald-600 dark:text-emerald-400"
                                      }`}
                                    >
                                      {response.answerValue}
                                    </span>
                                  )}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <ClipboardCheck className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">
                          No screening responses recorded for this call.
                        </p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
