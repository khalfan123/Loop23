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
import { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from "@/components/ui/card";
import { ThreeColumnLayout, SubPanelSection, SubPanelItem } from "@/components/ThreeColumnLayout";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Search, Download, Loader2, Phone, Calendar as CalendarIcon, Clock, MessageSquare, Eye, Play, Pause, Volume2, PhoneIncoming, PhoneOutgoing, CheckCircle2, XCircle, Mic, FileText, Sparkles, Globe, Filter, X, Columns3, ChevronDown, LayoutGrid, LayoutList, ArrowUpDown, ArrowUp, ArrowDown, DollarSign, AlertTriangle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format, formatDistanceToNow, startOfDay, endOfDay, subDays, startOfMonth, isWithinInterval } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { AuthStorage } from "@/lib/auth-storage";
import { formatSipEndpoint } from "@/lib/formatters";
import { DateRange } from "react-day-picker";
import CallDetailPanel from "@/pages/CallDetailPanel";

interface Call {
  id: string;
  contactId: string | null;
  campaignId: string | null;
  phoneNumber?: string | null;
  fromNumber?: string | null;
  toNumber?: string | null;
  status: string;
  duration: number | null;
  classification: string | null;
  sentiment: string | null;
  recordingUrl: string | null;
  transcript: string | null;
  aiSummary: string | null;
  metadata: Record<string, any> | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  callDirection: string | null;
  elevenLabsConversationId?: string | null;
  campaign?: { id: string; name: string } | null;
  contact?: { id: string; firstName: string; lastName?: string; phone: string } | null;
  incomingConnection?: { id: string; agentId: string } | null;
  engine?: 'elevenlabs' | 'twilio-openai' | 'plivo-openai' | 'openai';
  agent?: { id: string; name: string } | null;
  widgetId?: string | null;
  widget?: { id: string; name: string } | null;
  cost?: number | null;
  endReason?: string | null;
  concernedQuestionsCount?: number;
  channelType?: string;
}

type DatePreset = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'custom' | 'all';

const COLUMN_STORAGE_KEY = 'calls-column-visibility';

const DEFAULT_COLUMNS = {
  time: true,
  duration: true,
  channelType: true,
  cost: false,
  sessionId: false,
  endReason: false,
  concernedQuestions: true,
  status: true,
  sentiment: true,
  from: true,
  to: true,
  direction: true,
  agent: true,
  engine: false,
};

type ColumnVisibility = typeof DEFAULT_COLUMNS;

type ViewMode = 'card' | 'table';
type SortField = 'time' | 'duration' | 'status' | 'sentiment' | 'direction' | 'agent' | 'cost';
type SortDirection = 'asc' | 'desc';
const VIEW_MODE_STORAGE_KEY = 'calls-view-mode';

export default function Calls({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sentimentFilter, setSentimentFilter] = useState("all");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [leadFilter, setLeadFilter] = useState("all");
  const [playingCallId, setPlayingCallId] = useState<string | null>(null);
  const [loadingRecording, setLoadingRecording] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<'base' | 'analysis'>('base');
  const [callIdFilter, setCallIdFilter] = useState("");
  const [fromNumberFilter, setFromNumberFilter] = useState("");
  const [toNumberFilter, setToNumberFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("all");
  const [durationRange, setDurationRange] = useState<[number, number]>([0, 3600]);

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (saved === 'card' || saved === 'table') return saved;
    } catch (e) {}
    return 'card';
  });
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const openCallPanel = (callId: string) => {
    setSelectedCallId(callId);
    setPanelOpen(true);
  };

  const closeCallPanel = () => {
    setPanelOpen(false);
    setSelectedCallId(null);
  };

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(() => {
    try {
      const saved = localStorage.getItem(COLUMN_STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_COLUMNS, ...JSON.parse(saved) };
      }
    } catch (e) {}
    return DEFAULT_COLUMNS;
  });

  useEffect(() => {
    localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(columnVisibility));
  }, [columnVisibility]);

  const { data: calls, isLoading } = useQuery<Call[]>({
    queryKey: ["/api/calls"],
  });

  const uniqueAgents = useMemo(() => {
    if (!calls) return [];
    const agents = new Map<string, string>();
    calls.forEach(call => {
      if (call.agent) {
        agents.set(call.agent.id, call.agent.name);
      }
    });
    return Array.from(agents, ([id, name]) => ({ id, name }));
  }, [calls]);

  const handleDatePreset = (preset: DatePreset) => {
    const today = new Date();
    setDatePreset(preset);
    
    switch (preset) {
      case 'today':
        setDateRange({ from: startOfDay(today), to: endOfDay(today) });
        break;
      case 'yesterday':
        const yesterday = subDays(today, 1);
        setDateRange({ from: startOfDay(yesterday), to: endOfDay(yesterday) });
        break;
      case 'last7days':
        setDateRange({ from: startOfDay(subDays(today, 6)), to: endOfDay(today) });
        break;
      case 'last30days':
        setDateRange({ from: startOfDay(subDays(today, 29)), to: endOfDay(today) });
        break;
      case 'thisMonth':
        setDateRange({ from: startOfMonth(today), to: endOfDay(today) });
        break;
      case 'all':
        setDateRange(undefined);
        break;
      case 'custom':
        break;
    }
    
    if (preset !== 'custom') {
      setIsDatePickerOpen(false);
    }
  };

  const getDateRangeLabel = () => {
    if (datePreset === 'all' || !dateRange?.from) {
      return 'All Time';
    }
    if (datePreset !== 'custom') {
      const labels: Record<DatePreset, string> = {
        today: 'Today',
        yesterday: 'Yesterday',
        last7days: 'Last 7 Days',
        last30days: 'Last 30 Days',
        thisMonth: 'This Month',
        custom: 'Custom Range',
        all: 'All Time',
      };
      return labels[datePreset];
    }
    if (dateRange.from && dateRange.to) {
      return `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d')}`;
    }
    if (dateRange.from) {
      return `From ${format(dateRange.from, 'MMM d')}`;
    }
    return 'Select dates';
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'all') count++;
    if (sentimentFilter !== 'all') count++;
    if (directionFilter !== 'all') count++;
    if (leadFilter !== 'all') count++;
    if (callIdFilter) count++;
    if (fromNumberFilter) count++;
    if (toNumberFilter) count++;
    if (agentFilter !== 'all') count++;
    if (durationRange[0] > 0 || durationRange[1] < 3600) count++;
    return count;
  }, [statusFilter, sentimentFilter, directionFilter, leadFilter, callIdFilter, fromNumberFilter, toNumberFilter, agentFilter, durationRange]);

  const clearAllFilters = () => {
    setStatusFilter('all');
    setSentimentFilter('all');
    setDirectionFilter('all');
    setLeadFilter('all');
    setCallIdFilter('');
    setFromNumberFilter('');
    setToNumberFilter('');
    setAgentFilter('all');
    setDurationRange([0, 3600]);
    setSearchQuery('');
  };

  const handleExportCsv = () => {
    if (!calls || calls.length === 0) {
      toast({
        title: t('common.noData'),
        description: t('calls.noCallsToExport'),
        variant: "destructive",
      });
      return;
    }

    const headers = [
      'ID',
      'Phone Number',
      'Contact Name',
      'Status',
      'Direction',
      'Duration (seconds)',
      'Classification',
      'Sentiment',
      'Campaign',
      'Agent',
      'Engine',
      'Created At'
    ];

    const rows = calls.map(call => {
      const contactName = call.contact 
        ? `${call.contact.firstName} ${call.contact.lastName || ''}`.trim()
        : '';
      const phoneNumber = call.phoneNumber || call.fromNumber || call.toNumber || '';
      
      return [
        call.id,
        phoneNumber,
        contactName,
        call.status,
        call.callDirection || 'outgoing',
        call.duration?.toString() || '0',
        call.classification || '',
        call.sentiment || '',
        call.campaign?.name || '',
        call.agent?.name || '',
        call.engine || 'elevenlabs',
        call.createdAt
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `calls_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: t('common.exportSuccess'),
      description: t('calls.exportedCalls', { count: calls.length }),
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="rounded-xl bg-emerald-500/[0.08] dark:bg-emerald-500/[0.15] text-emerald-700 dark:text-emerald-400 border-emerald-500/20">{t('calls.status.completed')}</Badge>;
      case "failed":
        return <Badge className="rounded-xl bg-rose-500/[0.08] dark:bg-rose-500/[0.15] text-rose-700 dark:text-rose-400 border-rose-500/20">{t('calls.status.failed')}</Badge>;
      case "in_progress":
      case "in-progress":
        return <Badge className="rounded-xl bg-amber-500/[0.08] dark:bg-amber-500/[0.15] text-amber-700 dark:text-amber-400 border-amber-500/20">{t('calls.status.inProgress')}</Badge>;
      case "ended":
        return <Badge className="rounded-xl bg-slate-500/[0.08] dark:bg-slate-500/[0.15] text-slate-700 dark:text-slate-400 border-slate-500/20">{t('calls.status.ended')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSentimentBadge = (sentiment: string | null) => {
    if (!sentiment) return null;
    switch (sentiment) {
      case "positive":
        return <Badge className="rounded-xl bg-emerald-500/[0.08] dark:bg-emerald-500/[0.15] text-emerald-700 dark:text-emerald-400 border-emerald-500/20">{t('calls.sentiment.positive')}</Badge>;
      case "negative":
        return <Badge className="rounded-xl bg-rose-500/[0.08] dark:bg-rose-500/[0.15] text-rose-700 dark:text-rose-400 border-rose-500/20">{t('calls.sentiment.negative')}</Badge>;
      case "neutral":
        return <Badge className="rounded-xl bg-slate-500/[0.08] dark:bg-slate-500/[0.15] text-slate-700 dark:text-slate-400 border-slate-500/20">{t('calls.sentiment.neutral')}</Badge>;
      default:
        return <Badge variant="outline">{sentiment}</Badge>;
    }
  };

  const getClassificationBadge = (classification: string | null) => {
    if (!classification) return null;
    switch (classification) {
      case "hot":
        return <Badge className="rounded-xl bg-emerald-500/[0.08] dark:bg-emerald-500/[0.15] text-emerald-700 dark:text-emerald-400 border-emerald-500/20">{t('calls.classification.hot')}</Badge>;
      case "warm":
        return <Badge className="rounded-xl bg-amber-500/[0.08] dark:bg-amber-500/[0.15] text-amber-700 dark:text-amber-400 border-amber-500/20">{t('calls.classification.warm')}</Badge>;
      case "cold":
        return <Badge className="rounded-xl bg-slate-500/[0.08] dark:bg-slate-500/[0.15] text-slate-700 dark:text-slate-400 border-slate-500/20">{t('calls.classification.cold')}</Badge>;
      case "lost":
        return <Badge className="rounded-xl bg-rose-500/[0.08] dark:bg-rose-500/[0.15] text-rose-700 dark:text-rose-400 border-rose-500/20">{t('calls.classification.lost')}</Badge>;
      case "completed_successful":
        return <Badge className="rounded-xl bg-emerald-500/[0.08] dark:bg-emerald-500/[0.15] text-emerald-700 dark:text-emerald-400 border-emerald-500/20">{t('calls.classification.successful')}</Badge>;
      case "completed_failed":
        return <Badge className="rounded-xl bg-rose-500/[0.08] dark:bg-rose-500/[0.15] text-rose-700 dark:text-rose-400 border-rose-500/20">{t('calls.status.failed')}</Badge>;
      case "completed":
        return <Badge className="rounded-xl bg-slate-500/[0.08] dark:bg-slate-500/[0.15] text-slate-700 dark:text-slate-400 border-slate-500/20">{t('calls.status.completed')}</Badge>;
      default:
        return <Badge variant="outline">{classification}</Badge>;
    }
  };

  const getEngineBadge = (engine?: string) => {
    if (engine === 'twilio-openai') {
      return <Badge className="rounded-xl bg-violet-500/[0.08] dark:bg-violet-500/[0.15] text-violet-700 dark:text-violet-400 border-violet-500/20">Twilio+OpenAI</Badge>;
    }
    if (engine === 'plivo-openai') {
      return <Badge className="rounded-xl bg-orange-500/[0.08] dark:bg-orange-500/[0.15] text-orange-700 dark:text-orange-400 border-orange-500/20">Plivo+OpenAI</Badge>;
    }
    if (engine === 'openai') {
      return <Badge className="rounded-xl bg-emerald-500/[0.08] dark:bg-emerald-500/[0.15] text-emerald-700 dark:text-emerald-400 border-emerald-500/20">OpenAI</Badge>;
    }
    return <Badge className="rounded-xl bg-sky-500/[0.08] dark:bg-sky-500/[0.15] text-sky-700 dark:text-sky-400 border-sky-500/20">ElevenLabs</Badge>;
  };

  const getWidgetBadge = (call: Call) => {
    if (!call.widgetId) return null;
    return (
      <Badge className="rounded-xl bg-teal-500/[0.08] dark:bg-teal-500/[0.15] text-teal-700 dark:text-teal-400 border-teal-500/20 gap-1">
        <Globe className="h-3 w-3" />
        {call.widget?.name || 'Widget'}
      </Badge>
    );
  };

  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return null;
    }
  };

  const hasRecording = (call: Call) => {
    return call.recordingUrl || call.elevenLabsConversationId;
  };

  const handlePlayRecording = async (e: React.MouseEvent, call: Call) => {
    e.stopPropagation();
    
    if (playingCallId === call.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingCallId(null);
      return;
    }
    
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    setLoadingRecording(call.id);
    
    try {
      const headers: Record<string, string> = {};
      const authHeader = AuthStorage.getAuthHeader();
      if (authHeader) {
        headers["Authorization"] = authHeader;
      }
      
      const response = await fetch(`/api/calls/${call.id}/recording`, {
        headers,
        credentials: "include",
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch recording");
      }
      
      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      setPlayingCallId(call.id);
      setLoadingRecording(null);
      
      audio.onended = () => {
        setPlayingCallId(null);
        audioRef.current = null;
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.onerror = () => {
        toast({
          title: "Playback Error",
          description: "Unable to play this recording.",
          variant: "destructive",
        });
        setPlayingCallId(null);
        audioRef.current = null;
      };
      
      await audio.play();
    } catch (error: any) {
      setLoadingRecording(null);
      toast({
        title: "Recording Unavailable",
        description: error.message || "Could not load recording. Try syncing recordings first.",
        variant: "destructive",
      });
      setPlayingCallId(null);
    }
  };

  const getDirectionIcon = (direction: string | null) => {
    if (direction === 'incoming') {
      return <PhoneIncoming className="h-4 w-4 text-emerald-500" />;
    }
    return <PhoneOutgoing className="h-4 w-4 text-blue-500" />;
  };

  const filteredCalls = useMemo(() => {
    return (calls || []).filter((call) => {
      const contactFullName = call.contact ? `${call.contact.firstName} ${call.contact.lastName || ""}`.toLowerCase() : "";
      const matchesSearch = 
        searchQuery === "" || 
        contactFullName.includes(searchQuery.toLowerCase()) ||
        call.contact?.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        call.phoneNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        call.transcript?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        call.aiSummary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        call.id.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || call.status === statusFilter;
      const matchesSentiment = sentimentFilter === "all" || call.sentiment === sentimentFilter;
      const matchesDirection = directionFilter === "all" || call.callDirection === directionFilter;
      const matchesLead = leadFilter === "all" || call.classification === leadFilter;
      
      const matchesCallId = !callIdFilter || call.id.toLowerCase().includes(callIdFilter.toLowerCase());
      const matchesFromNumber = !fromNumberFilter || call.fromNumber?.toLowerCase().includes(fromNumberFilter.toLowerCase());
      const matchesToNumber = !toNumberFilter || call.toNumber?.toLowerCase().includes(toNumberFilter.toLowerCase());
      const matchesAgent = agentFilter === "all" || call.agent?.id === agentFilter;
      
      const callDuration = call.duration || 0;
      const matchesDuration = callDuration >= durationRange[0] && callDuration <= durationRange[1];
      
      let matchesDateRange = true;
      if (dateRange?.from) {
        const callDate = new Date(call.createdAt);
        const from = startOfDay(dateRange.from);
        const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
        matchesDateRange = isWithinInterval(callDate, { start: from, end: to });
      }
      
      return matchesSearch && matchesStatus && matchesSentiment && matchesDirection && matchesLead && 
             matchesCallId && matchesFromNumber && matchesToNumber && matchesAgent && matchesDuration && matchesDateRange;
    });
  }, [calls, searchQuery, statusFilter, sentimentFilter, directionFilter, leadFilter, callIdFilter, fromNumberFilter, toNumberFilter, agentFilter, durationRange, dateRange]);

  const sortedCalls = useMemo(() => {
    const sorted = [...filteredCalls];
    sorted.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'time':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'duration':
          comparison = (a.duration || 0) - (b.duration || 0);
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        case 'sentiment':
          comparison = (a.sentiment || '').localeCompare(b.sentiment || '');
          break;
        case 'direction':
          comparison = (a.callDirection || '').localeCompare(b.callDirection || '');
          break;
        case 'agent':
          comparison = (a.agent?.name || '').localeCompare(b.agent?.name || '');
          break;
        case 'cost':
          comparison = (a.cost || 0) - (b.cost || 0);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [filteredCalls, sortField, sortDirection]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" /> 
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const callsWithTranscripts = sortedCalls.filter(call => call.transcript);
  const callsWithRecordings = sortedCalls.filter(call => hasRecording(call));

  const allPagination = usePagination(sortedCalls, 10);
  const transcribedPagination = usePagination(callsWithTranscripts, 10);
  const recordingsPagination = usePagination(callsWithRecordings, 10);

  const totalCalls = calls?.length || 0;
  const completedCalls = calls?.filter(c => c.status === 'completed').length || 0;
  const incomingCalls = calls?.filter(c => c.callDirection === 'incoming').length || 0;
  const outgoingCalls = calls?.filter(c => c.callDirection === 'outgoing').length || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderCallCard = (call: Call, testIdPrefix: string = "") => (
    <Card 
      key={call.id}
      className="group rounded-2xl border-border/30 bg-card/50 hover-elevate transition-all cursor-pointer overflow-visible"
      onClick={() => openCallPanel(call.id)}
      data-testid={`card-call-${testIdPrefix}${call.id}`}
    >
      <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className={`flex-shrink-0 h-10 w-10 rounded-2xl flex items-center justify-center ${
                call.callDirection === 'incoming' 
                  ? 'bg-emerald-500/[0.08] dark:bg-emerald-500/[0.15] text-emerald-600 dark:text-emerald-400' 
                  : 'bg-blue-500/[0.08] dark:bg-blue-500/[0.15] text-blue-600 dark:text-blue-400'
              }`}>
                {getDirectionIcon(call.callDirection)}
              </div>
              
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold tracking-tight text-foreground truncate">
                    {(() => {
                      if (call.widgetId) {
                        return call.widget?.name || (call.metadata as any)?.widgetName || 'Website Widget';
                      }
                      const hasContactName = call.contact?.firstName && call.contact.firstName.toLowerCase() !== 'unknown';
                      if (hasContactName) {
                        return `${call.contact!.firstName} ${call.contact!.lastName || ""}`.trim();
                      }
                      if (call.callDirection === 'incoming') {
                        return formatSipEndpoint(call.fromNumber, call.engine) || call.contact?.phone || call.phoneNumber || `Call ${call.id.slice(0, 8)}`;
                      }
                      return formatSipEndpoint(call.toNumber, call.engine) || call.contact?.phone || call.phoneNumber || `Call ${call.id.slice(0, 8)}`;
                    })()}
                  </h3>
                  {columnVisibility.engine && getEngineBadge(call.engine)}
                  {getWidgetBadge(call)}
                  {columnVisibility.status && getStatusBadge(call.status)}
                  {columnVisibility.sentiment && getSentimentBadge(call.sentiment)}
                  {getClassificationBadge(call.classification)}
                </div>
                
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                  {columnVisibility.sessionId && (
                    <span className="font-mono text-xs">ID: {call.id.slice(0, 8)}</span>
                  )}
                  {call.callDirection === 'incoming' ? (
                    <>
                      {columnVisibility.from && call.fromNumber && (
                        <span className="font-mono text-xs flex items-center gap-1">
                          <span className="text-muted-foreground/70">From:</span> {formatSipEndpoint(call.fromNumber, call.engine)}
                        </span>
                      )}
                      {columnVisibility.to && call.toNumber && (
                        <span className="font-mono text-xs flex items-center gap-1">
                          <span className="text-muted-foreground/70">To:</span> {formatSipEndpoint(call.toNumber, call.engine)}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      {columnVisibility.to && call.toNumber && (
                        <span className="font-mono text-xs flex items-center gap-1">
                          <span className="text-muted-foreground/70">To:</span> {formatSipEndpoint(call.toNumber, call.engine)}
                        </span>
                      )}
                      {columnVisibility.from && call.fromNumber && (
                        <span className="font-mono text-xs flex items-center gap-1">
                          <span className="text-muted-foreground/70">From:</span> {formatSipEndpoint(call.fromNumber, call.engine)}
                        </span>
                      )}
                    </>
                  )}
                  {columnVisibility.agent && call.agent && (
                    <span className="text-xs">Agent: {call.agent.name}</span>
                  )}
                  {call.campaign && (
                    <span className="truncate max-w-[150px]">{call.campaign.name}</span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              {hasRecording(call) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  onClick={(e) => handlePlayRecording(e, call)}
                  disabled={loadingRecording === call.id}
                  data-testid={`button-play-${testIdPrefix}${call.id}`}
                >
                  {loadingRecording === call.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : playingCallId === call.id ? (
                    <Pause className="h-4 w-4 text-primary" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            {columnVisibility.duration && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span className="font-medium">{formatDuration(call.duration)}</span>
              </div>
            )}
            {columnVisibility.time && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarIcon className="h-3.5 w-3.5" />
                <span>{formatRelativeTime(call.createdAt) || format(new Date(call.createdAt), "MMM d, h:mm a")}</span>
              </div>
            )}
            {columnVisibility.cost && call.cost !== undefined && call.cost !== null && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span className="font-medium">${Number(call.cost).toFixed(4)}</span>
              </div>
            )}
            {columnVisibility.endReason && call.endReason && (
              <Badge variant="outline" className="text-xs">{call.endReason}</Badge>
            )}
          </div>
          
          {(call.aiSummary || call.transcript) && (
            <div className="mt-3 pt-3 border-t border-border/50">
              {call.aiSummary && (
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {call.aiSummary}
                  </p>
                </div>
              )}
              {!call.aiSummary && call.transcript && (
                <div className="flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {call.transcript}
                  </p>
                </div>
              )}
            </div>
          )}
          
          <div className="flex items-center justify-between gap-2 mt-3">
            <div className="flex items-center gap-2">
              {hasRecording(call) && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Mic className="h-3 w-3" />
                  <span>{t('calls.details.recording')}</span>
                </div>
              )}
              {call.transcript && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <FileText className="h-3 w-3" />
                  <span>{t('calls.details.transcript')}</span>
                </div>
              )}
              {call.aiSummary && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Sparkles className="h-3 w-3" />
                  <span>{t('calls.details.aiAnalysis')}</span>
                </div>
              )}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                openCallPanel(call.id);
              }}
              data-testid={`button-view-details-${testIdPrefix}${call.id}`}
            >
              <Eye className="h-4 w-4 mr-1" />
              {t('calls.viewDetails')}
            </Button>
          </div>
      </CardContent>
    </Card>
  );

  const renderPagination = (pagination: ReturnType<typeof usePagination>, testId: string) => (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
      <div className="text-sm text-muted-foreground">
        Page {pagination.currentPage} of {pagination.totalPages} - Total Sessions: {pagination.totalItems}
      </div>
      <DataPagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        totalItems={pagination.totalItems}
        itemsPerPage={pagination.itemsPerPage}
        onPageChange={pagination.handlePageChange}
        onItemsPerPageChange={pagination.handleItemsPerPageChange}
        itemsPerPageOptions={[10, 25, 50, 100]}
        showItemsPerPage={true}
        data-testid={testId}
      />
    </div>
  );

  const renderCallsTable = (callList: Call[], pagination: ReturnType<typeof usePagination<Call>>, testIdPrefix: string = "") => (
    <div className="border rounded-2xl overflow-hidden glass-surface">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="glass-surface">
              {columnVisibility.time && (
                <TableHead 
                  className="cursor-pointer select-none whitespace-nowrap"
                  onClick={() => toggleSort('time')}
                  data-testid="th-time"
                >
                  <div className="flex items-center">
                    Time
                    {getSortIcon('time')}
                  </div>
                </TableHead>
              )}
              {columnVisibility.from && <TableHead className="whitespace-nowrap">From</TableHead>}
              {columnVisibility.to && <TableHead className="whitespace-nowrap">To</TableHead>}
              {columnVisibility.duration && (
                <TableHead 
                  className="cursor-pointer select-none whitespace-nowrap"
                  onClick={() => toggleSort('duration')}
                  data-testid="th-duration"
                >
                  <div className="flex items-center">
                    Duration
                    {getSortIcon('duration')}
                  </div>
                </TableHead>
              )}
              {columnVisibility.direction && (
                <TableHead 
                  className="cursor-pointer select-none whitespace-nowrap"
                  onClick={() => toggleSort('direction')}
                  data-testid="th-direction"
                >
                  <div className="flex items-center">
                    Direction
                    {getSortIcon('direction')}
                  </div>
                </TableHead>
              )}
              {columnVisibility.status && (
                <TableHead 
                  className="cursor-pointer select-none whitespace-nowrap"
                  onClick={() => toggleSort('status')}
                  data-testid="th-status"
                >
                  <div className="flex items-center">
                    Status
                    {getSortIcon('status')}
                  </div>
                </TableHead>
              )}
              {columnVisibility.sentiment && (
                <TableHead 
                  className="cursor-pointer select-none whitespace-nowrap"
                  onClick={() => toggleSort('sentiment')}
                  data-testid="th-sentiment"
                >
                  <div className="flex items-center">
                    Sentiment
                    {getSortIcon('sentiment')}
                  </div>
                </TableHead>
              )}
              {columnVisibility.agent && (
                <TableHead 
                  className="cursor-pointer select-none whitespace-nowrap"
                  onClick={() => toggleSort('agent')}
                  data-testid="th-agent"
                >
                  <div className="flex items-center">
                    Agent
                    {getSortIcon('agent')}
                  </div>
                </TableHead>
              )}
              {columnVisibility.engine && <TableHead className="whitespace-nowrap">Engine</TableHead>}
              {columnVisibility.channelType && <TableHead className="whitespace-nowrap">Channel</TableHead>}
              {columnVisibility.cost && (
                <TableHead 
                  className="cursor-pointer select-none whitespace-nowrap"
                  onClick={() => toggleSort('cost')}
                  data-testid="th-cost"
                >
                  <div className="flex items-center">
                    Cost
                    {getSortIcon('cost')}
                  </div>
                </TableHead>
              )}
              {columnVisibility.sessionId && <TableHead className="whitespace-nowrap">Session ID</TableHead>}
              {columnVisibility.endReason && <TableHead className="whitespace-nowrap">End Reason</TableHead>}
              {columnVisibility.concernedQuestions && (
                <TableHead className="whitespace-nowrap">Concerns</TableHead>
              )}
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.paginatedItems.map((call) => (
              <TableRow 
                key={call.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => openCallPanel(call.id)}
                data-testid={`row-call-${testIdPrefix}${call.id}`}
              >
                {columnVisibility.time && (
                  <TableCell className="whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{format(new Date(call.createdAt), "MMM d, yyyy")}</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(call.createdAt), "h:mm a")}</span>
                    </div>
                  </TableCell>
                )}
                {columnVisibility.from && (
                  <TableCell className="font-mono text-xs whitespace-nowrap">
                    {formatSipEndpoint(call.fromNumber, call.engine) || '-'}
                  </TableCell>
                )}
                {columnVisibility.to && (
                  <TableCell className="font-mono text-xs whitespace-nowrap">
                    {formatSipEndpoint(call.toNumber, call.engine) || '-'}
                  </TableCell>
                )}
                {columnVisibility.duration && (
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">{formatDuration(call.duration)}</span>
                    </div>
                  </TableCell>
                )}
                {columnVisibility.direction && (
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {getDirectionIcon(call.callDirection)}
                      <span className="text-xs capitalize">{call.callDirection || '-'}</span>
                    </div>
                  </TableCell>
                )}
                {columnVisibility.status && (
                  <TableCell>{getStatusBadge(call.status)}</TableCell>
                )}
                {columnVisibility.sentiment && (
                  <TableCell>{getSentimentBadge(call.sentiment)}</TableCell>
                )}
                {columnVisibility.agent && (
                  <TableCell className="whitespace-nowrap">
                    <span className="text-sm">{call.agent?.name || '-'}</span>
                  </TableCell>
                )}
                {columnVisibility.engine && (
                  <TableCell>{getEngineBadge(call.engine)}</TableCell>
                )}
                {columnVisibility.channelType && (
                  <TableCell>
                    {(call as any).channelType === 'CHAT' ? (
                      <Badge variant="outline" className="text-xs gap-1">
                        <MessageSquare className="h-3 w-3" />
                        CHAT
                      </Badge>
                    ) : (call as any).channelType === 'SMS' ? (
                      <Badge variant="outline" className="text-xs gap-1">
                        <FileText className="h-3 w-3" />
                        SMS
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs gap-1">
                        <Phone className="h-3 w-3" />
                        VOICE
                      </Badge>
                    )}
                  </TableCell>
                )}
                {columnVisibility.cost && (
                  <TableCell className="whitespace-nowrap">
                    {call.cost != null ? (
                      <span className="text-sm font-medium">${Number(call.cost).toFixed(4)}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                )}
                {columnVisibility.sessionId && (
                  <TableCell className="font-mono text-xs">
                    {call.id.slice(0, 8)}...
                  </TableCell>
                )}
                {columnVisibility.endReason && (
                  <TableCell className="text-xs whitespace-nowrap">
                    {call.endReason || '-'}
                  </TableCell>
                )}
                {columnVisibility.concernedQuestions && (
                  <TableCell>
                    {(call as any).concernedQuestionsCount > 0 ? (
                      <Badge className="rounded-xl bg-rose-500/[0.08] dark:bg-rose-500/[0.15] text-rose-700 dark:text-rose-400 border-rose-500/20">
                        {(call as any).concernedQuestionsCount}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">0</span>
                    )}
                  </TableCell>
                )}
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      openCallPanel(call.id);
                    }}
                    data-testid={`button-view-${testIdPrefix}${call.id}`}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  const subPanelContent = (
    <div className="space-y-1">
      <SubPanelSection title={t('calls.filters.direction', 'DIRECTION')}>
        <SubPanelItem
          icon={<Phone className="w-4 h-4" />}
          label={t('calls.filters.all', 'All Calls')}
          isActive={directionFilter === 'all'}
          onClick={() => setDirectionFilter('all')}
          badge={totalCalls}
        />
        <SubPanelItem
          icon={<PhoneIncoming className="w-4 h-4" />}
          label={t('calls.filters.incoming', 'Incoming')}
          isActive={directionFilter === 'incoming'}
          onClick={() => setDirectionFilter('incoming')}
          badge={incomingCalls}
        />
        <SubPanelItem
          icon={<PhoneOutgoing className="w-4 h-4" />}
          label={t('calls.filters.outgoing', 'Outgoing')}
          isActive={directionFilter === 'outgoing'}
          onClick={() => setDirectionFilter('outgoing')}
          badge={outgoingCalls}
        />
      </SubPanelSection>
      
      <SubPanelSection title={t('calls.stats.summary', 'SUMMARY')}>
        <div className="px-2.5 py-2 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('calls.status.completed', 'Completed')}</span>
            <span className="font-medium text-emerald-600">{completedCalls}</span>
          </div>
        </div>
      </SubPanelSection>
    </div>
  );

  const mainContent = (
    <>
      <div className="space-y-6">
        {/* iOS 18 Style Clean Header */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('calls.title')}</h1>
              <p className="text-muted-foreground text-sm mt-0.5">{t('calls.description')}</p>
            </div>
          <Button 
            variant="default"
            className="rounded-2xl"
            onClick={handleExportCsv}
            data-testid="button-export-calls"
          >
            <Download className="h-4 w-4 mr-2" />
            {t('common.export')}
          </Button>
        </div>
        
        {/* iOS 18 Style Stats Pills */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-foreground/[0.03] border border-border/30">
            <div className="w-8 h-8 rounded-2xl bg-blue-500/[0.08] dark:bg-blue-500/[0.15] flex items-center justify-center">
              <Phone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <span className="text-lg font-semibold text-foreground" data-testid="text-total-calls">{totalCalls}</span>
              <p className="text-xs text-muted-foreground">{t('calls.stats.totalCalls')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-foreground/[0.03] border border-border/30">
            <div className="w-8 h-8 rounded-2xl bg-emerald-500/[0.08] dark:bg-emerald-500/[0.15] flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <span className="text-lg font-semibold text-foreground">{completedCalls}</span>
              <p className="text-xs text-muted-foreground">{t('calls.status.completed')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-foreground/[0.03] border border-border/30">
            <div className="w-8 h-8 rounded-2xl bg-emerald-500/[0.08] dark:bg-emerald-500/[0.15] flex items-center justify-center">
              <PhoneIncoming className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <span className="text-lg font-semibold text-foreground">{incomingCalls}</span>
              <p className="text-xs text-muted-foreground">{t('calls.filters.incoming')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-foreground/[0.03] border border-border/30">
            <div className="w-8 h-8 rounded-2xl bg-blue-500/[0.08] dark:bg-blue-500/[0.15] flex items-center justify-center">
              <PhoneOutgoing className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <span className="text-lg font-semibold text-foreground">{outgoingCalls}</span>
              <p className="text-xs text-muted-foreground">{t('calls.filters.outgoing')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* iOS 26 Style Search and Filters Bar */}
      <div className="flex items-center gap-3 flex-wrap glass-surface rounded-2xl p-3">
        <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 rounded-2xl" data-testid="button-date-range">
              <CalendarIcon className="h-4 w-4" />
              <span>{getDateRangeLabel()}</span>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="flex">
              <div className="border-r p-2 space-y-1 min-w-[140px]">
                <Button
                  variant={datePreset === 'all' ? 'secondary' : 'ghost'}
                  className="w-full justify-start"
                  size="sm"
                  onClick={() => handleDatePreset('all')}
                  data-testid="button-preset-all"
                >
                  All Time
                </Button>
                <Button
                  variant={datePreset === 'today' ? 'secondary' : 'ghost'}
                  className="w-full justify-start"
                  size="sm"
                  onClick={() => handleDatePreset('today')}
                  data-testid="button-preset-today"
                >
                  Today
                </Button>
                <Button
                  variant={datePreset === 'yesterday' ? 'secondary' : 'ghost'}
                  className="w-full justify-start"
                  size="sm"
                  onClick={() => handleDatePreset('yesterday')}
                  data-testid="button-preset-yesterday"
                >
                  Yesterday
                </Button>
                <Button
                  variant={datePreset === 'last7days' ? 'secondary' : 'ghost'}
                  className="w-full justify-start"
                  size="sm"
                  onClick={() => handleDatePreset('last7days')}
                  data-testid="button-preset-last7days"
                >
                  Last 7 Days
                </Button>
                <Button
                  variant={datePreset === 'last30days' ? 'secondary' : 'ghost'}
                  className="w-full justify-start"
                  size="sm"
                  onClick={() => handleDatePreset('last30days')}
                  data-testid="button-preset-last30days"
                >
                  Last 30 Days
                </Button>
                <Button
                  variant={datePreset === 'thisMonth' ? 'secondary' : 'ghost'}
                  className="w-full justify-start"
                  size="sm"
                  onClick={() => handleDatePreset('thisMonth')}
                  data-testid="button-preset-thismonth"
                >
                  This Month
                </Button>
                <Button
                  variant={datePreset === 'custom' ? 'secondary' : 'ghost'}
                  className="w-full justify-start"
                  size="sm"
                  onClick={() => setDatePreset('custom')}
                  data-testid="button-preset-custom"
                >
                  Custom Range
                </Button>
              </div>
              <div className="p-2">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={(range) => {
                    setDateRange(range);
                    setDatePreset('custom');
                  }}
                  numberOfMonths={2}
                  disabled={{ after: new Date() }}
                />
                <div className="flex justify-end gap-2 pt-2 border-t mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDateRange(undefined);
                      setDatePreset('all');
                    }}
                    data-testid="button-clear-dates"
                  >
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setIsDatePickerOpen(false)}
                    data-testid="button-apply-dates"
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="relative flex-1 min-w-[200px] w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('calls.searchPlaceholder')}
            className="pl-9 rounded-2xl"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-calls"
          />
        </div>

        <Popover open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 rounded-2xl" data-testid="button-filters">
              <Filter className="h-4 w-4" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="rounded-full ml-1">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="start">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold tracking-tight">Filters</h4>
                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="h-8 text-xs"
                    data-testid="button-clear-filters"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear All
                  </Button>
                )}
              </div>
            </div>
            <Tabs value={filterTab} onValueChange={(v) => setFilterTab(v as 'base' | 'analysis')} className="w-full">
              <TabsList className="w-full justify-start rounded-none border-b glass-surface p-0">
                <TabsTrigger 
                  value="base" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none"
                  data-testid="tab-filter-base"
                >
                  Base
                </TabsTrigger>
                <TabsTrigger 
                  value="analysis" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none"
                  data-testid="tab-filter-analysis"
                >
                  Analysis
                </TabsTrigger>
              </TabsList>
              <TabsContent value="base" className="p-4 space-y-4 mt-0">
                <div className="space-y-2">
                  <Label htmlFor="agent-filter">Agent</Label>
                  <Select value={agentFilter} onValueChange={setAgentFilter}>
                    <SelectTrigger id="agent-filter" data-testid="select-filter-agent">
                      <SelectValue placeholder="All Agents" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Agents</SelectItem>
                      {uniqueAgents.map(agent => (
                        <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="callid-filter">Call ID</Label>
                  <Input
                    id="callid-filter"
                    placeholder="Search by Call ID..."
                    value={callIdFilter}
                    onChange={(e) => setCallIdFilter(e.target.value)}
                    data-testid="input-filter-callid"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="from-filter">From Number</Label>
                    <Input
                      id="from-filter"
                      placeholder="From..."
                      value={fromNumberFilter}
                      onChange={(e) => setFromNumberFilter(e.target.value)}
                      data-testid="input-filter-from"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="to-filter">To Number</Label>
                    <Input
                      id="to-filter"
                      placeholder="To..."
                      value={toNumberFilter}
                      onChange={(e) => setToNumberFilter(e.target.value)}
                      data-testid="input-filter-to"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Duration Range (seconds): {durationRange[0]}s - {durationRange[1]}s</Label>
                  <Slider
                    value={durationRange}
                    onValueChange={(v) => setDurationRange(v as [number, number])}
                    min={0}
                    max={3600}
                    step={10}
                    data-testid="slider-duration"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger data-testid="select-filter-status">
                        <SelectValue placeholder={t('calls.details.status')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('calls.filters.allStatus')}</SelectItem>
                        <SelectItem value="completed">{t('calls.status.completed')}</SelectItem>
                        <SelectItem value="failed">{t('calls.status.failed')}</SelectItem>
                        <SelectItem value="in_progress">{t('calls.status.inProgress')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Direction</Label>
                    <Select value={directionFilter} onValueChange={setDirectionFilter}>
                      <SelectTrigger data-testid="select-filter-direction">
                        <SelectValue placeholder={t('calls.details.direction')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('calls.filters.allDirections')}</SelectItem>
                        <SelectItem value="incoming">{t('calls.filters.incoming')}</SelectItem>
                        <SelectItem value="outgoing">{t('calls.filters.outgoing')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Sentiment</Label>
                  <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
                    <SelectTrigger data-testid="select-filter-sentiment">
                      <SelectValue placeholder={t('calls.details.sentiment')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('calls.filters.allSentiment')}</SelectItem>
                      <SelectItem value="positive">{t('calls.sentiment.positive')}</SelectItem>
                      <SelectItem value="neutral">{t('calls.sentiment.neutral')}</SelectItem>
                      <SelectItem value="negative">{t('calls.sentiment.negative')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
              <TabsContent value="analysis" className="p-4 space-y-4 mt-0">
                <div className="space-y-2">
                  <Label>Classification / Lead Quality</Label>
                  <Select value={leadFilter} onValueChange={setLeadFilter}>
                    <SelectTrigger data-testid="select-filter-lead">
                      <SelectValue placeholder={t('calls.filters.leadQuality')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('calls.filters.allLeads')}</SelectItem>
                      <SelectItem value="hot">{t('calls.classification.hot')}</SelectItem>
                      <SelectItem value="warm">{t('calls.classification.warm')}</SelectItem>
                      <SelectItem value="cold">{t('calls.classification.cold')}</SelectItem>
                      <SelectItem value="lost">{t('calls.classification.lost')}</SelectItem>
                      <SelectItem value="completed_successful">Successful</SelectItem>
                      <SelectItem value="completed_failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
            </Tabs>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2 rounded-2xl" data-testid="button-columns">
              <Columns3 className="h-4 w-4" />
              <span>Columns</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px]">
            <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={columnVisibility.time}
              onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, time: checked }))}
              data-testid="checkbox-col-time"
            >
              Time
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columnVisibility.duration}
              onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, duration: checked }))}
              data-testid="checkbox-col-duration"
            >
              Duration
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columnVisibility.channelType}
              onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, channelType: checked }))}
              data-testid="checkbox-col-channeltype"
            >
              Channel Type
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columnVisibility.cost}
              onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, cost: checked }))}
              data-testid="checkbox-col-cost"
            >
              Cost
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columnVisibility.sessionId}
              onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, sessionId: checked }))}
              data-testid="checkbox-col-sessionid"
            >
              Session ID
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columnVisibility.endReason}
              onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, endReason: checked }))}
              data-testid="checkbox-col-endreason"
            >
              End Reason
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columnVisibility.concernedQuestions}
              onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, concernedQuestions: checked }))}
              data-testid="checkbox-col-concerns"
            >
              Concerned Questions
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columnVisibility.status}
              onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, status: checked }))}
              data-testid="checkbox-col-status"
            >
              Status
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columnVisibility.sentiment}
              onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, sentiment: checked }))}
              data-testid="checkbox-col-sentiment"
            >
              Sentiment
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columnVisibility.from}
              onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, from: checked }))}
              data-testid="checkbox-col-from"
            >
              From
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columnVisibility.to}
              onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, to: checked }))}
              data-testid="checkbox-col-to"
            >
              To
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columnVisibility.direction}
              onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, direction: checked }))}
              data-testid="checkbox-col-direction"
            >
              Direction
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columnVisibility.agent}
              onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, agent: checked }))}
              data-testid="checkbox-col-agent"
            >
              Agent
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* iOS 26 Style View Toggle */}
        <div className="flex items-center gap-1 rounded-2xl glass-surface border border-border/30 p-1">
          <Button
            variant={viewMode === 'card' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setViewMode('card')}
            data-testid="button-view-card"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setViewMode('table')}
            data-testid="button-view-table"
          >
            <LayoutList className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* iOS 18 Style Pill Tabs */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="glass-surface rounded-2xl p-1 border border-border/30">
          <TabsTrigger value="all" data-testid="tab-all">
            {t('calls.allCalls')} ({filteredCalls.length})
          </TabsTrigger>
          <TabsTrigger value="transcribed" data-testid="tab-transcribed">
            {t('calls.transcribed')} ({callsWithTranscripts.length})
          </TabsTrigger>
          <TabsTrigger value="recordings" data-testid="tab-recordings">
            {t('calls.recordings')} ({callsWithRecordings.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-3">
          {sortedCalls.length === 0 ? (
            <Card className="p-12 text-center">
              <Phone className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-lg tracking-tight mb-1">{t('calls.noCalls')}</h3>
              <p className="text-muted-foreground text-sm">
                {calls?.length === 0 
                  ? t('calls.createCampaignToStart') 
                  : t('calls.noMatchingFilters')}
              </p>
            </Card>
          ) : (
            <>
              {viewMode === 'table' ? (
                renderCallsTable(sortedCalls, allPagination)
              ) : (
                <div className="grid gap-3">
                  {allPagination.paginatedItems.map((call) => renderCallCard(call))}
                </div>
              )}
              {renderPagination(allPagination, "pagination-all-calls")}
            </>
          )}
        </TabsContent>

        <TabsContent value="transcribed" className="space-y-3">
          {callsWithTranscripts.length === 0 ? (
            <Card className="p-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-lg tracking-tight mb-1">{t('calls.noTranscribed')}</h3>
              <p className="text-muted-foreground text-sm">
                {t('calls.transcriptsWillAppear')}
              </p>
            </Card>
          ) : (
            <>
              {viewMode === 'table' ? (
                renderCallsTable(callsWithTranscripts, transcribedPagination, "transcribed-")
              ) : (
                <div className="grid gap-3">
                  {transcribedPagination.paginatedItems.map((call) => renderCallCard(call, "transcribed-"))}
                </div>
              )}
              {renderPagination(transcribedPagination, "pagination-transcribed-calls")}
            </>
          )}
        </TabsContent>

        <TabsContent value="recordings" className="space-y-3">
          {callsWithRecordings.length === 0 ? (
            <Card className="p-12 text-center">
              <Mic className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-lg tracking-tight mb-1">{t('calls.noRecordings')}</h3>
              <p className="text-muted-foreground text-sm">
                {t('calls.trySyncRecordings')}
              </p>
            </Card>
          ) : (
            <>
              {viewMode === 'table' ? (
                renderCallsTable(callsWithRecordings, recordingsPagination, "recording-")
              ) : (
                <div className="grid gap-3">
                  {recordingsPagination.paginatedItems.map((call) => renderCallCard(call, "recording-"))}
                </div>
              )}
              {renderPagination(recordingsPagination, "pagination-recordings-calls")}
            </>
          )}
        </TabsContent>
      </Tabs>
      </div>

      {selectedCallId && (
        <CallDetailPanel
          callId={selectedCallId}
          open={panelOpen}
          onClose={closeCallPanel}
          onNavigatePrev={() => {
            const idx = sortedCalls.findIndex((c) => c.id === selectedCallId);
            if (idx > 0) setSelectedCallId(sortedCalls[idx - 1].id);
          }}
          onNavigateNext={() => {
            const idx = sortedCalls.findIndex((c) => c.id === selectedCallId);
            if (idx >= 0 && idx < sortedCalls.length - 1)
              setSelectedCallId(sortedCalls[idx + 1].id);
          }}
          hasPrev={sortedCalls.findIndex((c) => c.id === selectedCallId) > 0}
          hasNext={
            sortedCalls.findIndex((c) => c.id === selectedCallId) >= 0 &&
            sortedCalls.findIndex((c) => c.id === selectedCallId) <
            sortedCalls.length - 1
          }
        />
      )}
    </>
  );

  if (embedded) {
    return <>{mainContent}</>;
  }

  return (
    <ThreeColumnLayout 
      subPanel={subPanelContent} 
      subPanelWidth="sm"
      subPanelHeader={<span className="font-medium text-sm">{t('calls.title', 'Calls')}</span>}
    >
      {mainContent}
    </ThreeColumnLayout>
  );
}
