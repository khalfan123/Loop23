/**
 * ============================================================
 * © 2025 Diploy — a brand of Bisht Technologies Private Limited
 * Original Author: BTPL Engineering Team
 * Website: https://diploy.in
 * Contact: cs@diploy.in
 *
 * Distributed under the Envato / CodeCanyon License Agreement.
 * Licensed to the purchaser for use as defined by the
 * Envato Market (CodeCanyon) Regular or Extended License.
 *
 * You are NOT permitted to redistribute, resell, sublicense,
 * or share this source code, in whole or in part.
 * Respect the author's rights and Envato licensing terms.
 * ============================================================
 */
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ArrowRight, Play, Pause, Download, Loader2, Phone, Clock, Calendar, MessageSquare, PhoneIncoming, PhoneOutgoing, CheckCircle2, XCircle, User, Volume2, Heart, Target, Mail, Bot, ChevronLeft, ChevronRight, Globe, AlertTriangle, ClipboardCheck, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { AuthStorage } from "@/lib/auth-storage";
import { formatSipEndpoint } from "@/lib/formatters";

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
  engine?: 'elevenlabs' | 'twilio-openai' | 'plivo-openai' | 'openai';
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

export default function CallDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [recordingBlobUrl, setRecordingBlobUrl] = useState<string | null>(null);

  const { data: call, isLoading: callLoading } = useQuery<Call>({
    queryKey: [`/api/calls/${id}`],
    enabled: !!id,
  });

  const { data: allCalls } = useQuery<Call[]>({
    queryKey: ["/api/calls"],
  });

  const currentIndex = allCalls?.findIndex(c => c.id === id) ?? -1;
  const prevCall = currentIndex > 0 ? allCalls?.[currentIndex - 1] : null;
  const nextCall = currentIndex >= 0 && currentIndex < (allCalls?.length ?? 0) - 1 ? allCalls?.[currentIndex + 1] : null;

  const contact = call?.contact;
  const campaign = call?.campaign;

  const hasRecording = call?.engine !== 'openai' && (call?.recordingUrl || call?.elevenLabsConversationId);

  useEffect(() => {
    const abortController = new AbortController();
    let fetchedBlobUrl: string | null = null;
    
    if (call?.engine !== 'openai' && (call?.recordingUrl || call?.elevenLabsConversationId) && id) {
      const fetchRecording = async () => {
        try {
          if (!AuthStorage.isAuthenticated()) {
            console.error('No authentication token found');
            return;
          }
          
          const headers: Record<string, string> = {};
          const authHeader = AuthStorage.getAuthHeader();
          if (authHeader) {
            headers['Authorization'] = authHeader;
          }
          
          const response = await fetch(`/api/calls/${id}/recording`, {
            headers,
            credentials: 'include',
            signal: abortController.signal
          });
          
          if (response.ok) {
            const blob = await response.blob();
            
            if (!abortController.signal.aborted) {
              fetchedBlobUrl = URL.createObjectURL(blob);
              
              setRecordingBlobUrl((prevUrl) => {
                if (prevUrl) {
                  URL.revokeObjectURL(prevUrl);
                }
                return fetchedBlobUrl;
              });
            }
          } else {
            console.error('Failed to fetch recording:', response.statusText);
          }
        } catch (error: any) {
          if (error.name !== 'AbortError') {
            console.error('Failed to fetch recording:', error);
          }
        }
      };
      
      fetchRecording();
    }
    
    return () => {
      abortController.abort();
      
      if (fetchedBlobUrl) {
        URL.revokeObjectURL(fetchedBlobUrl);
      }
      
      setRecordingBlobUrl((prevUrl) => {
        if (prevUrl) {
          URL.revokeObjectURL(prevUrl);
        }
        return null;
      });
    };
  }, [call?.engine, call?.recordingUrl, call?.elevenLabsConversationId, id]);

  if (callLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!call) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setLocation("/app/calls")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Calls
        </Button>
        <Card className="p-16 text-center">
          <h3 className="text-lg font-semibold tracking-tight mb-2">Call not found</h3>
          <p className="text-muted-foreground">The call you're looking for doesn't exist</p>
        </Card>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Successful</Badge>;
      case "failed":
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Failed</Badge>;
      case "no-answer":
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">No answer</Badge>;
      case "busy":
        return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">Busy</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSentimentBadge = (sentiment: string | null) => {
    if (!sentiment) return null;
    switch (sentiment) {
      case "positive":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Positive</Badge>;
      case "negative":
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Negative</Badge>;
      case "neutral":
        return <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/20">Neutral</Badge>;
      default:
        return <Badge variant="outline">{sentiment}</Badge>;
    }
  };

  const getEngineBadge = (engine?: string) => {
    if (engine === 'twilio-openai') {
      return <Badge className="bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20">Twilio+OpenAI</Badge>;
    }
    if (engine === 'plivo-openai') {
      return <Badge className="bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20">Plivo+OpenAI</Badge>;
    }
    if (engine === 'openai') {
      return <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">OpenAI</Badge>;
    }
    return <Badge className="bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20">ElevenLabs</Badge>;
  };

  const getWidgetBadge = () => {
    if (!call.widgetId) return null;
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
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isIncoming = call.callDirection === 'incoming';
  const primaryNumber = isIncoming 
    ? formatSipEndpoint(call.fromNumber, call.engine) || contact?.phone || call.phoneNumber || "Unknown"
    : formatSipEndpoint(call.toNumber, call.engine) || contact?.phone || call.phoneNumber || "Unknown";
  const secondaryNumber = isIncoming 
    ? formatSipEndpoint(call.toNumber, call.engine) || "Your number"
    : formatSipEndpoint(call.fromNumber, call.engine) || "Your number";
  
  const contactName = call.widgetId 
    ? (call.widget?.name || (call.metadata as any)?.widgetName || 'Website Widget')
    : (contact && contact.firstName && contact.firstName.toLowerCase() !== 'unknown'
      ? `${contact.firstName} ${contact.lastName || ""}`.trim()
      : primaryNumber);

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl p-6 md:p-8">
        <div className="mb-4 flex items-center justify-between">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/app/calls")} 
            className="-ml-2"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Calls
          </Button>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => prevCall && setLocation(`/app/calls/${prevCall.id}`)}
              disabled={!prevCall}
              data-testid="button-prev-call"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => nextCall && setLocation(`/app/calls/${nextCall.id}`)}
              disabled={!nextCall}
              data-testid="button-next-call"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-blue-500/[0.08] dark:bg-blue-500/[0.15] flex items-center justify-center">
              {isIncoming ? (
                <PhoneIncoming className="h-7 w-7 text-blue-600 dark:text-blue-400" />
              ) : (
                <PhoneOutgoing className="h-7 w-7 text-blue-600 dark:text-blue-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                  {contactName}
                </h1>
                {getWidgetBadge()}
                {getStatusBadge(call.status)}
                {getSentimentBadge(call.sentiment)}
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap text-muted-foreground">
                <span>{isIncoming ? "Incoming Call" : "Outgoing Call"}</span>
                <span>•</span>
                {isIncoming ? (
                  <>
                    <span className="font-mono text-sm">From: {primaryNumber}</span>
                    {secondaryNumber !== "Your number" && <span className="font-mono text-sm">To: {secondaryNumber}</span>}
                  </>
                ) : (
                  <>
                    <span className="font-mono text-sm">To: {primaryNumber}</span>
                    {secondaryNumber !== "Your number" && <span className="font-mono text-sm">From: {secondaryNumber}</span>}
                  </>
                )}
              </div>
            </div>
          </div>
          {hasRecording && recordingBlobUrl && (
            <Button 
              data-testid="button-download"
              onClick={() => {
                if (recordingBlobUrl) {
                  const link = document.createElement('a');
                  link.href = recordingBlobUrl;
                  link.download = `call-recording-${call.id}.mp3`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Recording
            </Button>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <div className="glass-surface rounded-2xl p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <div className="text-2xl font-bold tracking-tight text-blue-700 dark:text-blue-300">{formatDuration(call.duration)}</div>
            </div>
            <div className="text-muted-foreground text-sm">Duration</div>
          </div>
          <div className="glass-surface rounded-2xl p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <div className="text-lg font-bold tracking-tight text-indigo-700 dark:text-indigo-300">{format(new Date(call.createdAt), "MMM d, h:mm a")}</div>
            </div>
            <div className="text-muted-foreground text-sm">Date & Time</div>
          </div>
          <div className="glass-surface rounded-2xl p-4">
            <div className="flex items-center gap-2">
              {call.transcript ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <XCircle className="h-4 w-4 text-slate-400" />
              )}
              <div className="text-lg font-bold tracking-tight text-emerald-700 dark:text-emerald-300">{call.transcript ? "Available" : "None"}</div>
            </div>
            <div className="text-muted-foreground text-sm">Transcript</div>
          </div>
          <div className="glass-surface rounded-2xl p-4">
            <div className="flex items-center gap-2">
              {hasRecording ? (
                <Volume2 className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              ) : (
                <XCircle className="h-4 w-4 text-slate-400" />
              )}
              <div className="text-lg font-bold tracking-tight text-sky-700 dark:text-sky-300">{hasRecording ? "Available" : "None"}</div>
            </div>
            <div className="text-muted-foreground text-sm">Recording</div>
          </div>
          <div className="glass-surface rounded-2xl p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              <div className="text-2xl font-bold tracking-tight text-rose-700 dark:text-rose-300">{call.concernedQuestionsCount || 0}</div>
            </div>
            <div className="text-muted-foreground text-sm">Concerned Questions</div>
          </div>
        </div>
      </div>

      {hasRecording && (
        <div className="glass-card rounded-2xl p-6 bg-slate-900/90 dark:bg-slate-950/90">
          <div className="flex items-center gap-2 mb-4">
            <Volume2 className="h-5 w-5 text-blue-400" />
            <h3 className="text-sm font-medium tracking-tight text-slate-300">Audio Recording</h3>
          </div>
          
          {recordingBlobUrl ? (
            <div className="flex items-center gap-4">
              <Button
                size="icon"
                className="rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30"
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
                  <Play className="h-4 w-4 ml-0.5" />
                )}
              </Button>
              
              <div className="flex-1">
                <div className="h-16 bg-slate-800/50 rounded-2xl flex items-center justify-center px-4 border border-slate-700/30">
                  <div className="flex items-end gap-[3px] h-12 w-full">
                    {Array.from({ length: 60 }).map((_, i) => {
                      const height = 25 + Math.abs(Math.sin(i * 0.35) * 45 + Math.cos(i * 0.2) * 25);
                      const isActive = call.duration && currentTime > 0 
                        ? i < (currentTime / call.duration) * 60 
                        : false;
                      return (
                        <div
                          key={i}
                          className={`flex-1 rounded-full transition-all duration-150 ${
                            isActive ? 'bg-blue-500' : 'bg-slate-600/60'
                          }`}
                          style={{
                            height: `${height}%`,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-2 px-1">
                  <span className="text-sm font-mono text-blue-400">
                    {formatDuration(Math.floor(currentTime))}
                  </span>
                  <span className="text-sm font-mono text-slate-500">
                    {formatDuration(call.duration)}
                  </span>
                </div>
              </div>
              
              <audio
                ref={audioRef}
                src={recordingBlobUrl}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                onTimeUpdate={(e) => {
                  setCurrentTime(e.currentTarget.currentTime);
                }}
                onLoadedMetadata={(e) => {
                  if (!call.duration && e.currentTarget.duration) {
                    setCurrentTime(0);
                  }
                }}
              />
            </div>
          ) : (
            <div className="flex items-center gap-3 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
              <span className="text-sm text-slate-400">Loading recording...</span>
            </div>
          )}
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="glass-surface rounded-2xl">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="transcription" data-testid="tab-transcription">Transcription</TabsTrigger>
          <TabsTrigger value="metadata" data-testid="tab-metadata">Client data</TabsTrigger>
          <TabsTrigger value="screening" data-testid="tab-screening">Screening</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-2xl bg-indigo-500/[0.08] dark:bg-indigo-500/[0.15] flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-lg font-semibold tracking-tight">AI Summary</h3>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              {call.aiSummary || "No AI summary available for this call. The call may still be processing or did not complete successfully."}
            </p>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <Card className="p-4 hover-elevate">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4 text-slate-400" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</p>
              </div>
              <div>{getStatusBadge(call.status)}</div>
            </Card>

            <Card className="p-4 hover-elevate">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-slate-400" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Duration</p>
              </div>
              <p className="text-2xl font-bold tracking-tight text-foreground">{formatDuration(call.duration)}</p>
            </Card>

            {call.sentiment && (
              <Card className="p-4 hover-elevate">
                <div className="flex items-center gap-2 mb-3">
                  <Heart className="h-4 w-4 text-slate-400" />
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sentiment</p>
                </div>
                <div>{getSentimentBadge(call.sentiment)}</div>
              </Card>
            )}

            {call.classification && (
              <Card className="p-4 hover-elevate">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="h-4 w-4 text-slate-400" />
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Classification</p>
                </div>
                <Badge variant="outline" className="text-sm font-medium">
                  {call.classification.charAt(0).toUpperCase() + call.classification.slice(1)}
                </Badge>
              </Card>
            )}

            {call.startedAt && (
              <Card className="p-4 hover-elevate">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Call Time</p>
                </div>
                <p className="text-sm font-medium text-foreground">{format(new Date(call.startedAt), "MMM d, yyyy")}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(call.startedAt), "h:mm a")}</p>
              </Card>
            )}

            {call.callDirection === 'incoming' && (
              <Card className="p-4 hover-elevate">
                <div className="flex items-center gap-2 mb-3">
                  <PhoneIncoming className="h-4 w-4 text-slate-400" />
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Direction</p>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">Incoming</Badge>
              </Card>
            )}
          </div>

          {(contact || campaign || (call.callDirection === 'incoming' && call.metadata?.incomingAgentName)) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contact && (
                <Card className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-2xl bg-blue-500/[0.08] dark:bg-blue-500/[0.15] flex items-center justify-center">
                      <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contact</p>
                      <p className="font-semibold tracking-tight text-foreground">{contact.firstName} {contact.lastName || ""}</p>
                    </div>
                  </div>
                  <div className="space-y-2 pl-[52px]">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{contact.phone}</span>
                    </div>
                    {contact.email && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        <span>{contact.email}</span>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {campaign && (
                <Card className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-2xl bg-purple-500/[0.08] dark:bg-purple-500/[0.15] flex items-center justify-center">
                      <Target className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Campaign</p>
                      <Button
                        variant="ghost"
                        className="p-0 h-auto font-semibold tracking-tight text-foreground underline-offset-4 hover:underline"
                        onClick={() => setLocation(`/app/campaigns/${campaign.id}`)}
                        data-testid="link-campaign"
                      >
                        {campaign.name}
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

              {call.callDirection === 'incoming' && call.metadata?.incomingAgentName && (
                <Card className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-2xl bg-amber-500/[0.08] dark:bg-amber-500/[0.15] flex items-center justify-center">
                      <Bot className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Incoming Agent</p>
                      <p className="font-semibold tracking-tight text-foreground">{call.metadata.incomingAgentName}</p>
                    </div>
                  </div>
                  {call.metadata?.calledNumber && (
                    <div className="pl-[52px]">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        <span>Called: {call.metadata.calledNumber}</span>
                      </div>
                    </div>
                  )}
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="transcription">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="h-8 w-8 rounded-2xl bg-blue-500/[0.08] dark:bg-blue-500/[0.15] flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold tracking-tight">Call Transcript</h3>
            </div>
            
            {call.transcript ? (
              <div className="max-h-[600px] overflow-y-auto space-y-4 pr-2">
                {call.transcript.split('\n').filter(line => line.trim()).map((line, index) => {
                  const timestampMatch = line.match(/^\[(\d{2}:\d{2})\]\s*(.+)/);
                  const speakerMatch = timestampMatch ? timestampMatch[2].match(/^(Agent|User|AI|Customer):\s*(.+)/) : null;
                  
                  if (timestampMatch && speakerMatch) {
                    const timestamp = timestampMatch[1];
                    const speaker = speakerMatch[1];
                    const message = speakerMatch[2];
                    const isAgent = speaker === 'Agent' || speaker === 'AI';
                    
                    return (
                      <div 
                        key={index} 
                        className={`flex gap-3 ${isAgent ? 'flex-row' : 'flex-row-reverse'}`}
                        data-testid={`transcript-entry-${index}`}
                      >
                        <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                          isAgent 
                            ? 'bg-blue-500/[0.08] dark:bg-blue-500/[0.15]' 
                            : 'bg-emerald-500/[0.08] dark:bg-emerald-500/[0.15]'
                        }`}>
                          {isAgent ? (
                            <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          )}
                        </div>
                        <div className={`flex-1 max-w-[80%] ${isAgent ? '' : 'flex flex-col items-end'}`}>
                          <div className={`rounded-2xl px-4 py-3 ${
                            isAgent 
                              ? 'bg-slate-100 dark:bg-slate-800/80 rounded-tl-md' 
                              : 'bg-blue-500/10 dark:bg-blue-600/20 rounded-tr-md'
                          }`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-medium ${
                                isAgent ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'
                              }`} data-testid={`transcript-speaker-${index}`}>
                                {speaker}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono" data-testid={`transcript-timestamp-${index}`}>
                                {timestamp}
                              </span>
                            </div>
                            <p className="text-sm leading-relaxed" data-testid={`transcript-message-${index}`}>{message}</p>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <div key={index} className="px-4 py-2">
                      <p className="text-sm leading-relaxed text-muted-foreground">{line}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">
                  No transcript available for this call. The call may still be processing or did not complete successfully.
                </p>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="metadata">
          <Card className="p-6">
            <h3 className="text-lg font-semibold tracking-tight mb-4">Call Metadata</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Call ID</div>
                <div className="font-mono">{call.id}</div>

                {call.metadata?.twilioCallSid && (
                  <>
                    <div className="text-muted-foreground">Twilio Call SID</div>
                    <div className="font-mono text-xs">{call.metadata.twilioCallSid}</div>
                  </>
                )}

                {contact && (
                  <>
                    <div className="text-muted-foreground">Contact ID</div>
                    <div className="font-mono">{contact.id}</div>
                  </>
                )}

                <div className="text-muted-foreground">Created At</div>
                <div>{format(new Date(call.createdAt), "MMM d, yyyy 'at' h:mm:ss a")}</div>

                {call.endedAt && (
                  <>
                    <div className="text-muted-foreground">Ended At</div>
                    <div>{format(new Date(call.endedAt), "MMM d, yyyy 'at' h:mm:ss a")}</div>
                  </>
                )}

                {call.metadata && Object.keys(call.metadata).length > 0 && (
                  <>
                    <div className="text-muted-foreground col-span-2 mt-4 font-medium">Additional Metadata</div>
                    <div className="col-span-2">
                      <pre className="text-xs glass-surface rounded-2xl p-3 overflow-x-auto">
                        {JSON.stringify(call.metadata, null, 2)}
                      </pre>
                    </div>
                  </>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="screening" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-2xl bg-amber-500/[0.08] dark:bg-amber-500/[0.15] flex items-center justify-center">
                  <ClipboardCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight">Screening Questions</h3>
              </div>
              {(call.concernedQuestionsCount ?? 0) > 0 && (
                <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20 gap-1">
                  <ShieldAlert className="h-3 w-3" />
                  {call.concernedQuestionsCount} Concern{(call.concernedQuestionsCount ?? 0) !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            {call.responses && call.responses.length > 0 ? (
              <div className="space-y-3">
                {call.responses.map((response, index) => (
                  <div
                    key={response.id}
                    className={`flex items-start gap-4 p-4 rounded-2xl border ${
                      response.isConcern
                        ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40'
                        : 'bg-card border-border'
                    }`}
                    data-testid={`screening-response-${index}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground">{response.questionText}</span>
                        {response.isConcern && (
                          <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20 text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Concern
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs font-mono">
                          {response.answerType}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {response.answerType === 'MULTISELECT' ? (
                            (() => {
                              try {
                                const items = JSON.parse(response.answerValue);
                                return Array.isArray(items) && items.length > 0 ? items.join(', ') : 'None';
                              } catch {
                                return response.answerValue;
                              }
                            })()
                          ) : (
                            <span className={`font-medium ${
                              response.isConcern ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                            }`}>
                              {response.answerValue}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <ClipboardCheck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">
                  No screening responses recorded for this call.
                </p>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
