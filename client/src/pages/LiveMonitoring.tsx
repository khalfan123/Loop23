import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneOff,
  Search,
  Radio,
  Activity,
  Clock,
  User,
  Bot,
  Target,
  Headphones,
  X,
  MessageSquare,
  AlertCircle,
  RefreshCw,
  Wifi,
  WifiOff,
  Loader2,
  Volume2,
  VolumeX,
  UserCheck,
  ShieldAlert,
  TrendingDown,
  CheckCircle2,
  Lightbulb,
} from "lucide-react";

type SentimentLevel = 'positive' | 'neutral' | 'cautious' | 'negative' | 'critical';

interface LiveCall {
  callId: string;
  userId: string;
  twilioCallSid?: string;
  direction: 'inbound' | 'outbound';
  status: string;
  fromNumber?: string;
  toNumber?: string;
  agentId?: string;
  agentName?: string;
  campaignId?: string;
  campaignName?: string;
  contactId?: string;
  contactName?: string;
  engine: string;
  startedAt: string;
  answeredAt?: string;
  duration: number;
  transcript?: string[];
  metadata?: Record<string, unknown>;
  sentimentLevel?: SentimentLevel;
  sentimentScore?: number;
  sentimentAlert?: boolean;
  sentimentReason?: string | null;
}

interface LiveCallStats {
  totalActive: number;
  inbound: number;
  outbound: number;
  byEngine: Record<string, number>;
  byStatus: Record<string, number>;
}

interface AgentAssistEvent {
  callId: string;
  eventKind: string;
  detail: string;
  suggestion?: string;
  stepsCompleted?: string[];
  stepsPending?: string[];
  timestamp: number;
}

interface WsMessage {
  type: string;
  activeCalls?: LiveCall[];
  call?: LiveCall;
  callId?: string;
  userId?: string;
  message?: string;
  role?: string;
  timestamp?: number;
  sentimentLevel?: string;
  sentimentScore?: number;
  sentimentReason?: string | null;
  eventKind?: string;
  detail?: string;
  suggestion?: string;
  stepsCompleted?: string[];
  stepsPending?: string[];
}

const ENGINE_LABELS: Record<string, string> = {
  'twilio-elevenlabs': 'Twilio + ElevenLabs',
  'twilio-openai': 'Twilio + OpenAI',
  'twilio-bedrock-polly': 'Twilio + Bedrock',
  'sip': 'SIP',
};

const ENGINE_COLORS: Record<string, string> = {
  'twilio-elevenlabs': 'bg-purple-500/10 text-purple-700 border-purple-500/30',
  'twilio-openai': 'bg-blue-500/10 text-blue-700 border-blue-500/30',
  'twilio-bedrock-polly': 'bg-orange-500/10 text-orange-700 border-orange-500/30',
  'sip': 'bg-gray-500/10 text-gray-700 border-gray-500/30',
};

const SENTIMENT_CONFIG: Record<SentimentLevel, { label: string; color: string }> = {
  positive: { label: 'Positive', color: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30' },
  neutral: { label: 'Neutral', color: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/30' },
  cautious: { label: 'Cautious', color: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30' },
  negative: { label: 'Negative', color: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30' },
  critical: { label: 'Critical', color: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30' },
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatPhoneNumber(num?: string): string {
  if (!num) return 'Unknown';
  return num;
}

export default function LiveMonitoring() {
  const { toast } = useToast();
  const [activeCalls, setActiveCalls] = useState<LiveCall[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [directionFilter, setDirectionFilter] = useState<string>("all");
  const [engineFilter, setEngineFilter] = useState<string>("all");
  const [sentimentFilter, setSentimentFilter] = useState<string>("all");
  const [selectedCall, setSelectedCall] = useState<LiveCall | null>(null);
  const [transcriptMessages, setTranscriptMessages] = useState<{ role: string; message: string }[]>([]);
  const [agentAssistEvents, setAgentAssistEvents] = useState<AgentAssistEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const { data: user } = useQuery<{ id: string; role?: string }>({
    queryKey: ["/api/auth/me"],
  });

  const connectWebSocket = useCallback(() => {
    if (!user?.id) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const isAdmin = user.role === 'admin' || user.role === 'superadmin';
    const url = `${protocol}//${window.location.host}/ws/live-monitoring?userId=${user.id}&isAdmin=${isAdmin}`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        console.log('📡 Live Monitoring WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const data: WsMessage = JSON.parse(event.data);

          switch (data.type) {
            case 'initial_state':
              if (data.activeCalls) {
                setActiveCalls(data.activeCalls);
              }
              break;

            case 'call_started':
              if (data.call) {
                setActiveCalls(prev => {
                  const filtered = prev.filter(c => c.callId !== data.call!.callId);
                  return [data.call!, ...filtered];
                });
              }
              break;

            case 'call_updated':
              if (data.call) {
                setActiveCalls(prev =>
                  prev.map(c => c.callId === data.call!.callId ? data.call! : c)
                );
                if (selectedCall?.callId === data.call.callId) {
                  setSelectedCall(data.call);
                }
              }
              break;

            case 'call_ended':
              if (data.callId) {
                setActiveCalls(prev => prev.filter(c => c.callId !== data.callId));
                if (selectedCall?.callId === data.callId) {
                  setSelectedCall(null);
                  setTranscriptMessages([]);
                }
              }
              break;

            case 'transcript_update':
              if (data.callId && data.message && data.role) {
                if (selectedCall?.callId === data.callId) {
                  setTranscriptMessages(prev => [...prev, { role: data.role!, message: data.message! }]);
                }
              }
              break;

            case 'sentiment_alert':
              if (data.call) {
                setActiveCalls(prev =>
                  prev.map(c => c.callId === data.call!.callId ? {
                    ...c,
                    sentimentLevel: data.call!.sentimentLevel,
                    sentimentScore: data.call!.sentimentScore,
                    sentimentAlert: data.call!.sentimentAlert,
                    sentimentReason: data.call!.sentimentReason,
                  } : c)
                );
                if (selectedCall?.callId === data.call.callId) {
                  setSelectedCall(prev => prev ? {
                    ...prev,
                    sentimentLevel: data.call!.sentimentLevel,
                    sentimentScore: data.call!.sentimentScore,
                    sentimentAlert: data.call!.sentimentAlert,
                    sentimentReason: data.call!.sentimentReason,
                  } : prev);
                }
                toast({
                  title: "Sentiment Alert",
                  description: `${data.call.contactName || data.call.toNumber || 'A call'} flagged: ${data.call.sentimentReason || 'negative sentiment'}`,
                  variant: "destructive",
                });
              }
              break;

            case 'agent_assist':
              if (data.callId && data.eventKind && data.detail) {
                const assistEvt: AgentAssistEvent = {
                  callId: data.callId,
                  eventKind: data.eventKind,
                  detail: data.detail,
                  suggestion: data.suggestion,
                  stepsCompleted: data.stepsCompleted,
                  stepsPending: data.stepsPending,
                  timestamp: Date.now(),
                };
                setAgentAssistEvents(prev => [...prev.slice(-49), assistEvt]);

                if (data.eventKind === 'compliance_alert') {
                  toast({
                    title: "Compliance Alert",
                    description: data.detail,
                    variant: "destructive",
                  });
                } else if (data.eventKind === 'intervention') {
                  toast({
                    title: "Agent Assist",
                    description: data.suggestion || data.detail,
                  });
                }
              }
              break;

            case 'heartbeat':
              break;
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        console.log('📡 Live Monitoring WebSocket disconnected, reconnecting...');
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      console.error('WebSocket connection failed:', e);
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
    }
  }, [user?.id, user?.role, selectedCall?.callId]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      wsRef.current?.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connectWebSocket]);

  useEffect(() => {
    durationIntervalRef.current = setInterval(() => {
      setActiveCalls(prev =>
        prev.map(call => ({
          ...call,
          duration: Math.floor((Date.now() - new Date(call.startedAt).getTime()) / 1000),
        }))
      );
    }, 1000);

    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcriptMessages]);

  const handleEndCall = async (callId: string) => {
    try {
      await apiRequest('POST', `/api/live-calls/${callId}/end`);
      toast({ title: "Call ended successfully" });
    } catch (error: any) {
      toast({ title: "Failed to end call", description: error.message, variant: "destructive" });
    }
  };

  const handleSelectCall = (call: LiveCall) => {
    setSelectedCall(call);
    setTranscriptMessages([]);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe_call', callId: call.callId }));
    }
    if (call.transcript && call.transcript.length > 0) {
      const parsed = call.transcript.map(t => {
        const match = t.match(/^\[(agent|caller)\]\s(.*)$/i);
        return match ? { role: match[1], message: match[2] } : { role: 'system', message: t };
      });
      setTranscriptMessages(parsed);
    }
  };

  const handleClosePanel = () => {
    if (selectedCall && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'unsubscribe_call', callId: selectedCall.callId }));
    }
    setSelectedCall(null);
    setTranscriptMessages([]);
  };

  const filteredCalls = activeCalls.filter(call => {
    if (directionFilter !== 'all' && call.direction !== directionFilter) return false;
    if (engineFilter !== 'all' && call.engine !== engineFilter) return false;
    if (sentimentFilter === 'flagged' && !call.sentimentAlert) return false;
    if (sentimentFilter !== 'all' && sentimentFilter !== 'flagged' && call.sentimentLevel !== sentimentFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        (call.fromNumber?.toLowerCase().includes(term)) ||
        (call.toNumber?.toLowerCase().includes(term)) ||
        (call.agentName?.toLowerCase().includes(term)) ||
        (call.contactName?.toLowerCase().includes(term)) ||
        (call.campaignName?.toLowerCase().includes(term)) ||
        (call.callId.toLowerCase().includes(term))
      );
    }
    return true;
  });

  const flaggedCount = activeCalls.filter(c => c.sentimentAlert).length;

  const stats: LiveCallStats = {
    totalActive: activeCalls.length,
    inbound: activeCalls.filter(c => c.direction === 'inbound').length,
    outbound: activeCalls.filter(c => c.direction === 'outbound').length,
    byEngine: {},
    byStatus: {},
  };
  activeCalls.forEach(call => {
    stats.byEngine[call.engine] = (stats.byEngine[call.engine] || 0) + 1;
    stats.byStatus[call.status] = (stats.byStatus[call.status] || 0) + 1;
  });

  return (
    <div className="space-y-6" data-testid="page-live-monitoring">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Live Monitoring</h1>
          <p className="text-muted-foreground text-sm mt-1">Monitor all active calls in real-time</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {wsConnected ? (
              <Badge variant="outline" className="bg-green-500/[0.08] dark:bg-green-500/[0.15] text-green-600 dark:text-green-400 border-green-500/20 gap-1" data-testid="badge-ws-connected">
                <Wifi className="h-3 w-3" />
                Live
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-red-500/[0.08] dark:bg-red-500/[0.15] text-red-600 dark:text-red-400 border-red-500/20 gap-1" data-testid="badge-ws-disconnected">
                <WifiOff className="h-3 w-3" />
                Disconnected
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/live-calls'] })}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card data-testid="card-stat-total">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-2xl bg-blue-500/[0.08] dark:bg-blue-500/[0.15]">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-active">{stats.totalActive}</p>
                <p className="text-xs text-muted-foreground">Active Calls</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-inbound">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-2xl bg-green-500/[0.08] dark:bg-green-500/[0.15]">
                <PhoneIncoming className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-inbound">{stats.inbound}</p>
                <p className="text-xs text-muted-foreground">Inbound</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-outbound">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-2xl bg-blue-500/[0.08] dark:bg-blue-500/[0.15]">
                <PhoneOutgoing className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-outbound">{stats.outbound}</p>
                <p className="text-xs text-muted-foreground">Outbound</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          data-testid="card-stat-flagged"
          className={`cursor-pointer transition-all ${sentimentFilter === 'flagged' ? 'ring-2 ring-red-500' : ''} ${flaggedCount > 0 ? 'border-red-500/30' : ''}`}
          onClick={() => setSentimentFilter(sentimentFilter === 'flagged' ? 'all' : 'flagged')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-2xl ${flaggedCount > 0 ? 'bg-red-500/[0.12] dark:bg-red-500/[0.2]' : 'bg-orange-500/[0.08] dark:bg-orange-500/[0.15]'}`}>
                <ShieldAlert className={`h-5 w-5 ${flaggedCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-orange-600'}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${flaggedCount > 0 ? 'text-red-600 dark:text-red-400' : ''}`} data-testid="text-total-flagged">{flaggedCount}</p>
                <p className="text-xs text-muted-foreground">Flagged Calls</p>
              </div>
              {flaggedCount > 0 && (
                <div className="ml-auto relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-3 glass-surface rounded-2xl p-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by phone number, agent, campaign..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
        <Select value={directionFilter} onValueChange={setDirectionFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-direction">
            <SelectValue placeholder="Direction" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Directions</SelectItem>
            <SelectItem value="inbound">Inbound</SelectItem>
            <SelectItem value="outbound">Outbound</SelectItem>
          </SelectContent>
        </Select>
        <Select value={engineFilter} onValueChange={setEngineFilter}>
          <SelectTrigger className="w-[200px]" data-testid="select-engine">
            <SelectValue placeholder="Engine" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Engines</SelectItem>
            {Object.entries(ENGINE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
          <SelectTrigger className="w-[170px]" data-testid="select-sentiment">
            <SelectValue placeholder="Sentiment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sentiment</SelectItem>
            <SelectItem value="flagged">Flagged Only</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="negative">Negative</SelectItem>
            <SelectItem value="cautious">Cautious</SelectItem>
            <SelectItem value="neutral">Neutral</SelectItem>
            <SelectItem value="positive">Positive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className={`grid gap-4 ${selectedCall ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'}`}>
        <div className={selectedCall ? 'lg:col-span-2' : ''}>
          {filteredCalls.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                {activeCalls.length === 0 ? (
                  <>
                    <Phone className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium tracking-tight text-muted-foreground">No Active Calls</h3>
                    <p className="text-sm text-muted-foreground/70 mt-1">
                      Active calls will appear here in real-time
                    </p>
                  </>
                ) : (
                  <>
                    <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium tracking-tight text-muted-foreground">No Matching Calls</h3>
                    <p className="text-sm text-muted-foreground/70 mt-1">
                      Try adjusting your search or filters
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3" data-testid="grid-active-calls">
              {filteredCalls.map((call) => (
                <Card
                  key={call.callId}
                  className={`cursor-pointer transition-all glass-card rounded-2xl ${
                    selectedCall?.callId === call.callId ? 'ring-2 ring-primary' : ''
                  } ${call.sentimentAlert ? 'border-red-500/40 shadow-red-500/10 shadow-sm' : ''}`}
                  onClick={() => handleSelectCall(call)}
                  data-testid={`card-call-${call.callId}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={`p-2 rounded-2xl ${
                          call.direction === 'inbound' ? 'bg-green-500/[0.08] dark:bg-green-500/[0.15]' : 'bg-blue-500/[0.08] dark:bg-blue-500/[0.15]'
                        }`}>
                          {call.direction === 'inbound' ? (
                            <PhoneIncoming className="h-4 w-4 text-green-600" />
                          ) : (
                            <PhoneOutgoing className="h-4 w-4 text-blue-600" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">
                              {call.direction === 'inbound'
                                ? formatPhoneNumber(call.fromNumber)
                                : formatPhoneNumber(call.toNumber)}
                            </span>
                            {call.contactName && (
                              <span className="text-xs text-muted-foreground truncate">
                                ({call.contactName})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {call.agentName && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Bot className="h-3 w-3" />
                                {call.agentName}
                              </span>
                            )}
                            {call.campaignName && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Target className="h-3 w-3" />
                                {call.campaignName}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={ENGINE_COLORS[call.engine] || 'bg-gray-500/10 text-gray-700'}>
                            {ENGINE_LABELS[call.engine] || call.engine}
                          </Badge>
                          <Badge variant="outline" className={
                            call.direction === 'inbound'
                              ? 'bg-green-500/10 text-green-700 border-green-500/30'
                              : 'bg-blue-500/10 text-blue-700 border-blue-500/30'
                          }>
                            {call.direction}
                          </Badge>
                          {call.sentimentLevel && call.sentimentLevel !== 'neutral' && (
                            <Badge
                              variant="outline"
                              className={SENTIMENT_CONFIG[call.sentimentLevel]?.color || ''}
                              data-testid={`badge-sentiment-${call.callId}`}
                            >
                              {call.sentimentAlert && (
                                <ShieldAlert className="h-3 w-3 mr-0.5" />
                              )}
                              {SENTIMENT_CONFIG[call.sentimentLevel]?.label || call.sentimentLevel}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-sm font-mono tabular-nums">
                          <div className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                          </div>
                          <Clock className="h-3.5 w-3.5 text-muted-foreground ml-1" />
                          <span data-testid={`text-duration-${call.callId}`}>
                            {formatDuration(call.duration)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectCall(call);
                              }}
                              data-testid={`button-listen-${call.callId}`}
                            >
                              <Headphones className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Monitor Call</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 dark:text-red-400"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEndCall(call.callId);
                              }}
                              data-testid={`button-end-${call.callId}`}
                            >
                              <PhoneOff className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>End Call</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {selectedCall && (
          <div className="lg:col-span-1" data-testid="panel-call-detail">
            <Card className="sticky top-4">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg tracking-tight flex items-center gap-2">
                    <Headphones className="h-5 w-5 text-primary" />
                    Call Monitor
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={handleClosePanel} data-testid="button-close-panel">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <div className="flex items-center gap-2">
                      <div className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </div>
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">Live</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Direction</span>
                    <Badge variant="outline" className={
                      selectedCall.direction === 'inbound'
                        ? 'bg-green-500/10 text-green-700 border-green-500/30'
                        : 'bg-blue-500/10 text-blue-700 border-blue-500/30'
                    }>
                      {selectedCall.direction === 'inbound' ? (
                        <><PhoneIncoming className="h-3 w-3 mr-1" /> Inbound</>
                      ) : (
                        <><PhoneOutgoing className="h-3 w-3 mr-1" /> Outbound</>
                      )}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Duration</span>
                    <span className="text-sm font-mono tabular-nums font-medium">
                      {formatDuration(selectedCall.duration)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">From</span>
                    <span className="text-sm font-medium">{formatPhoneNumber(selectedCall.fromNumber)}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">To</span>
                    <span className="text-sm font-medium">{formatPhoneNumber(selectedCall.toNumber)}</span>
                  </div>

                  {selectedCall.agentName && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Agent</span>
                      <span className="text-sm font-medium flex items-center gap-1">
                        <Bot className="h-3 w-3" />
                        {selectedCall.agentName}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Engine</span>
                    <Badge variant="outline" className={ENGINE_COLORS[selectedCall.engine] || ''}>
                      {ENGINE_LABELS[selectedCall.engine] || selectedCall.engine}
                    </Badge>
                  </div>

                  {selectedCall.sentimentLevel && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Sentiment</span>
                      <Badge
                        variant="outline"
                        className={SENTIMENT_CONFIG[selectedCall.sentimentLevel]?.color || ''}
                        data-testid="badge-selected-sentiment"
                      >
                        {selectedCall.sentimentAlert && <ShieldAlert className="h-3 w-3 mr-1" />}
                        {SENTIMENT_CONFIG[selectedCall.sentimentLevel]?.label}
                      </Badge>
                    </div>
                  )}
                </div>

                {selectedCall.sentimentAlert && selectedCall.sentimentReason && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/[0.06] dark:bg-red-500/[0.1] p-3" data-testid="panel-sentiment-alert">
                    <div className="flex items-start gap-2">
                      <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-red-700 dark:text-red-400">Needs Attention</p>
                        <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-0.5">
                          {selectedCall.sentimentReason}
                          {selectedCall.sentimentScore !== undefined && (
                            <span className="ml-1">(score: {selectedCall.sentimentScore})</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <Separator />

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium tracking-tight flex items-center gap-1">
                      <MessageSquare className="h-4 w-4" />
                      Live Transcript
                    </h4>
                    <Badge variant="outline" className="text-xs">
                      {transcriptMessages.length} messages
                    </Badge>
                  </div>
                  <ScrollArea className="h-[300px] rounded-2xl border p-3 glass-surface" data-testid="panel-transcript">
                    {transcriptMessages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
                        <p className="text-xs text-muted-foreground">
                          Transcript updates will appear here as the conversation progresses
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {transcriptMessages.map((msg, idx) => (
                          <div
                            key={idx}
                            className={`text-sm p-2 rounded-lg ${
                              msg.role === 'agent'
                                ? 'bg-primary/10 text-primary-foreground/90 ml-4'
                                : msg.role === 'caller'
                                ? 'bg-muted mr-4'
                                : 'bg-yellow-500/10 text-yellow-700 text-xs text-center'
                            }`}
                          >
                            <span className="text-xs font-medium text-muted-foreground block mb-0.5">
                              {msg.role === 'agent' ? 'AI Agent' : msg.role === 'caller' ? 'Caller' : 'System'}
                            </span>
                            {msg.message}
                          </div>
                        ))}
                        <div ref={transcriptEndRef} />
                      </div>
                    )}
                  </ScrollArea>
                </div>

                <Separator />

                {agentAssistEvents.filter(e => e.callId === selectedCall.callId).length > 0 && (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium tracking-tight flex items-center gap-1">
                          <Lightbulb className="h-4 w-4" />
                          Agent Assist
                        </h4>
                        <Badge variant="outline" className="text-xs">
                          {agentAssistEvents.filter(e => e.callId === selectedCall.callId).length} events
                        </Badge>
                      </div>
                      <ScrollArea className="h-[200px] rounded-2xl border p-3 glass-surface" data-testid="panel-agent-assist">
                        <div className="space-y-2">
                          {agentAssistEvents
                            .filter(e => e.callId === selectedCall.callId)
                            .map((evt, idx) => (
                              <div
                                key={idx}
                                className={`text-sm p-2 rounded-lg ${
                                  evt.eventKind === 'compliance_alert'
                                    ? 'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/30'
                                    : evt.eventKind === 'step_completed'
                                    ? 'bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/30'
                                    : evt.eventKind === 'intervention'
                                    ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/30'
                                    : 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/30'
                                }`}
                                data-testid={`agent-assist-event-${idx}`}
                              >
                                <div className="flex items-center gap-1 mb-0.5">
                                  {evt.eventKind === 'compliance_alert' && <ShieldAlert className="h-3 w-3" />}
                                  {evt.eventKind === 'step_completed' && <CheckCircle2 className="h-3 w-3" />}
                                  {evt.eventKind === 'intervention' && <Lightbulb className="h-3 w-3" />}
                                  {evt.eventKind === 'step_missed' && <AlertCircle className="h-3 w-3" />}
                                  <span className="text-xs font-medium capitalize">
                                    {evt.eventKind.replace(/_/g, ' ')}
                                  </span>
                                </div>
                                <p className="text-xs">{evt.detail}</p>
                                {evt.suggestion && (
                                  <p className="text-xs mt-1 font-medium opacity-80">Suggestion: {evt.suggestion}</p>
                                )}
                              </div>
                            ))}
                        </div>
                      </ScrollArea>
                    </div>
                    <Separator />
                  </>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEndCall(selectedCall.callId)}
                    data-testid="button-end-selected-call"
                  >
                    <PhoneOff className="h-4 w-4 mr-1" />
                    End Call
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
