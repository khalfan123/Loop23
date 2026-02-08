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
  User,
  Volume2,
  Heart,
  Target,
  Mail,
  Bot,
  ChevronUp,
  ChevronDown,
  Globe,
  AlertTriangle,
  ClipboardCheck,
  ShieldAlert,
  Copy,
  Trash2,
  X,
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
  engine?: "elevenlabs" | "twilio-openai" | "plivo-openai" | "openai";
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
            <div className="flex items-center justify-between gap-2 px-4 py-2 border-b bg-muted/30">
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
              <div className="p-5 space-y-5">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-semibold">
                          {call.startedAt
                            ? format(
                                new Date(call.startedAt),
                                "MM/dd/yyyy HH:mm"
                              )
                            : format(
                                new Date(call.createdAt),
                                "MM/dd/yyyy HH:mm"
                              )}
                        </span>
                        <span className="text-base text-muted-foreground">
                          {call.channelType || (isIncoming ? "incoming" : "outgoing")}
                        </span>
                      </div>
                      {call.agent && (
                        <div className="text-sm text-muted-foreground mt-0.5">
                          Agent:{call.agent.name} ({call.agent.id.slice(0, 8)}...{call.agent.id.slice(-4)})
                          <Button
                            variant="ghost"
                            size="icon"
                            className="ml-1"
                            onClick={() => copyToClipboard(call.agent!.id)}
                            data-testid="button-copy-agent-id"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        Call ID: {call.id.slice(0, 16)}...{call.id.slice(-4)}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(call.id)}
                          data-testid="button-copy-call-id"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      {call.startedAt && call.endedAt && (
                        <div className="text-sm text-muted-foreground">
                          Duration: {format(new Date(call.startedAt), "MM/dd/yyyy HH:mm")} - {format(new Date(call.endedAt), "MM/dd/yyyy HH:mm")}
                        </div>
                      )}
                      {call.cost != null && (
                        <div className="text-sm text-muted-foreground">
                          Cost: ${Number(call.cost).toFixed(4)}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground"
                      data-testid="button-delete-call"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {hasRecording && (
                  <div className="bg-muted/30 rounded-xl p-4 border">
                    {recordingBlobUrl ? (
                      <div className="flex items-center gap-3">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (audioRef.current) {
                              if (isPlaying) {
                                audioRef.current.pause();
                              } else {
                                audioRef.current.play();
                              }
                            }
                          }}
                          data-testid="button-play-pause"
                        >
                          {isPlaying ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>

                        <span className="text-sm font-mono text-muted-foreground">
                          {formatDuration(Math.floor(currentTime))} /{" "}
                          {formatDuration(call.duration)}
                        </span>

                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{
                              width: `${call.duration ? (currentTime / call.duration) * 100 : 0}%`,
                            }}
                          />
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
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
                      <div className="flex items-center gap-2 py-2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Loading recording...
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-primary">
                    Conversation Analysis
                  </h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                      <span>Call Successful</span>
                    </div>
                    <div className="text-sm">
                      {call.status === "completed" ? (
                        <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                          Successful
                        </span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                          Unsuccessful
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>Call Status</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                        {call.status.charAt(0).toUpperCase() + call.status.slice(1)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Heart className="h-4 w-4 text-muted-foreground" />
                      <span>User Sentiment</span>
                    </div>
                    <div className="text-sm">
                      <span
                        className={`flex items-center gap-1 ${
                          call.sentiment === "positive"
                            ? "text-green-600 dark:text-green-400"
                            : call.sentiment === "negative"
                              ? "text-red-600 dark:text-red-400"
                              : "text-green-600 dark:text-green-400"
                        }`}
                      >
                        {call.sentiment
                          ? call.sentiment.charAt(0).toUpperCase() +
                            call.sentiment.slice(1)
                          : "Neutral"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>Disconnection Reason</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                        {call.endReason || "Unknown"}
                      </span>
                    </div>

                    {(call.concernedQuestionsCount ?? 0) > 0 && (
                      <>
                        <div className="flex items-center gap-2 text-sm">
                          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                          <span>Concerned Questions</span>
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
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Summary</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed border-t pt-3">
                      {call.aiSummary}
                    </p>
                  </div>
                )}

                <Tabs defaultValue="transcription" className="space-y-3">
                  <div className="flex items-center justify-between">
                    <TabsList>
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
                              <div key={index} className="text-sm text-muted-foreground">
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

                        {call.campaign && (
                          <>
                            <span className="text-muted-foreground">
                              Campaign
                            </span>
                            <Button
                              variant="ghost"
                              className="p-0 h-auto justify-start font-normal underline-offset-4 hover:underline"
                              onClick={() =>
                                setLocation(
                                  `/app/campaigns/${call.campaign!.id}`
                                )
                              }
                              data-testid="panel-link-campaign"
                            >
                              {call.campaign.name}
                            </Button>
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

                        {call.metadata &&
                          Object.keys(call.metadata).length > 0 && (
                            <>
                              <span className="text-muted-foreground col-span-2 mt-3 font-medium">
                                Additional Metadata
                              </span>
                              <pre className="col-span-2 text-xs bg-muted p-3 rounded-md overflow-x-auto">
                                {JSON.stringify(call.metadata, null, 2)}
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
                            className={`p-3 rounded-lg border ${
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
