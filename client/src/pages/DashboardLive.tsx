import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BarChart3, PhoneCall, Radio } from "lucide-react";
import { ThreeColumnLayout, SubPanelSection, SubPanelItem } from "@/components/ThreeColumnLayout";
import {
  FeaturedCallCard,
  FloorGaugeCard,
  LiveDot,
  OtherCallsList,
  QueueCard,
} from "@/components/dashboard-live/LiveFloorPanels";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  formatDuration,
  mapLiveCall,
  moodFromScore,
  type FloorCall,
  type LiveCall,
  type QueueItem,
  type WsMessage,
} from "@/lib/dashboard-live";

type LiveCallsResponse = {
  activeCalls?: LiveCall[];
  totalActive?: number;
};

function normalizeLiveCall(raw: LiveCall): LiveCall {
  return {
    ...raw,
    startedAt:
      typeof raw.startedAt === "string"
        ? raw.startedAt
        : new Date(raw.startedAt as unknown as string).toISOString(),
    duration:
      typeof raw.duration === "number"
        ? raw.duration
        : Math.max(0, Math.floor((Date.now() - new Date(raw.startedAt).getTime()) / 1000)),
  };
}

function isInQueue(call: LiveCall) {
  return call.status === "ringing" || call.status === "initiated";
}

function queueFromCalls(calls: LiveCall[]): QueueItem[] {
  return calls.filter(isInQueue).map((call) => {
    const waitSec =
      typeof call.duration === "number"
        ? call.duration
        : Math.max(0, Math.floor((Date.now() - new Date(call.startedAt).getTime()) / 1000));
    const display = call.fromNumber || call.toNumber || "Unknown caller";
    const digits = display.replace(/\D/g, "");
    return {
      id: call.callId,
      display,
      avatar: digits.slice(0, 2) || "•",
      intent:
        call.direction === "inbound"
          ? `${call.agentName || "AI"} · inbound`
          : `${call.campaignName || call.agentName || "Outbound"} · dialing`,
      waitSec,
      urgent: waitSec >= 20,
    };
  });
}

export default function DashboardLive() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeCalls, setActiveCalls] = useState<LiveCall[]>([]);
  const [featuredId, setFeaturedId] = useState<string | null>(null);
  const [clock, setClock] = useState(() =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  );
  const [wsConnected, setWsConnected] = useState(false);
  const [transcriptExtra, setTranscriptExtra] = useState<Record<string, string[]>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: user } = useQuery<{ id: string; role?: string }>({ queryKey: ["/api/auth/me"] });
  const { data: agents = [] } = useQuery<Array<{ id: string }>>({ queryKey: ["/api/agents"] });

  const { data: liveSnapshot, refetch: refetchLive } = useQuery<LiveCallsResponse>({
    queryKey: ["/api/live-calls"],
    refetchInterval: 5000,
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!liveSnapshot?.activeCalls) return;
    setActiveCalls(liveSnapshot.activeCalls.map(normalizeLiveCall));
  }, [liveSnapshot]);

  const connectWebSocket = useCallback(() => {
    if (!user?.id) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const isAdmin = user.role === "admin" || user.role === "superadmin";
    const url = `${protocol}//${window.location.host}/ws/live-monitoring?userId=${user.id}&isAdmin=${isAdmin}`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => {
        setWsConnected(true);
        void refetchLive();
      };
      ws.onmessage = (event) => {
        try {
          const data: WsMessage = JSON.parse(event.data);
          switch (data.type) {
            case "initial_state":
              if (data.activeCalls) setActiveCalls(data.activeCalls.map(normalizeLiveCall));
              break;
            case "call_started":
              if (data.call) {
                const call = normalizeLiveCall(data.call);
                setActiveCalls((prev) => [call, ...prev.filter((c) => c.callId !== call.callId)]);
              }
              break;
            case "call_updated":
              if (data.call) {
                const call = normalizeLiveCall(data.call);
                setActiveCalls((prev) => prev.map((c) => (c.callId === call.callId ? call : c)));
              }
              break;
            case "call_ended":
              if (data.callId) {
                setActiveCalls((prev) => prev.filter((c) => c.callId !== data.callId));
                setTranscriptExtra((prev) => {
                  const next = { ...prev };
                  delete next[data.callId!];
                  return next;
                });
              }
              break;
            case "transcript_update":
              if (data.callId && data.message && data.role) {
                const line = `[${data.role}] ${data.message}`;
                setActiveCalls((prev) =>
                  prev.map((c) =>
                    c.callId === data.callId
                      ? { ...c, transcript: [...(c.transcript || []), line].slice(-40) }
                      : c,
                  ),
                );
                setTranscriptExtra((prev) => ({
                  ...prev,
                  [data.callId!]: [...(prev[data.callId!] || []), line].slice(-40),
                }));
              }
              break;
            case "sentiment_alert":
              if (data.call) {
                const call = normalizeLiveCall(data.call);
                setActiveCalls((prev) => prev.map((c) => (c.callId === call.callId ? { ...c, ...call } : c)));
              }
              break;
            default:
              break;
          }
        } catch {
          /* ignore malformed */
        }
      };
      ws.onclose = () => {
        setWsConnected(false);
        reconnectRef.current = setTimeout(connectWebSocket, 3000);
      };
      ws.onerror = () => ws.close();
    } catch {
      reconnectRef.current = setTimeout(connectWebSocket, 5000);
    }
  }, [user?.id, user?.role, refetchLive]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      wsRef.current?.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [connectWebSocket]);

  useEffect(() => {
    const durationIv = setInterval(() => {
      setActiveCalls((prev) =>
        prev.map((call) => ({
          ...call,
          duration: Math.floor((Date.now() - new Date(call.startedAt).getTime()) / 1000),
        })),
      );
      setClock(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 1000);
    return () => clearInterval(durationIv);
  }, []);

  const onFloorCalls = useMemo(() => {
    const inProgress = activeCalls.filter((c) => c.status === "in-progress");
    if (inProgress.length) return inProgress;
    // Fallback: treat non-ringing active registry entries as on-floor
    return activeCalls.filter((c) => !isInQueue(c));
  }, [activeCalls]);

  const floorCalls = useMemo(() => {
    return onFloorCalls.map((call, index) => {
      const mapped = mapLiveCall(call, index);
      const extra = transcriptExtra[call.callId];
      if (extra?.length) {
        const merged = [...(call.transcript || []), ...extra.filter((l) => !(call.transcript || []).includes(l))];
        return mapLiveCall({ ...call, transcript: merged }, index);
      }
      return mapped;
    });
  }, [onFloorCalls, transcriptExtra]);

  const queue = useMemo(() => queueFromCalls(activeCalls), [activeCalls]);

  const featured = useMemo(() => {
    const preferred = featuredId ? floorCalls.find((c) => c.id === featuredId) : null;
    return preferred || floorCalls[0] || null;
  }, [floorCalls, featuredId]);

  const liveFloorScore = useMemo(() => {
    if (!floorCalls.length) return 0;
    return Math.round(floorCalls.reduce((sum, c) => sum + c.moodScore, 0) / floorCalls.length);
  }, [floorCalls]);

  const mood = moodFromScore(featured?.moodScore ?? (liveFloorScore || 80));
  const gaugeMood = moodFromScore(liveFloorScore || 80);
  const agentCount = agents.length;
  const onCall = floorCalls.length;
  const avgHandle =
    floorCalls.length > 0
      ? formatDuration(Math.round(floorCalls.reduce((s, c) => s + c.durationSec, 0) / floorCalls.length))
      : "—";

  const sentimentSplit = useMemo(() => {
    if (!floorCalls.length) return { positive: 0, neutral: 0, negative: 0 };
    let positive = 0;
    let neutral = 0;
    let negative = 0;
    floorCalls.forEach((c) => {
      if (c.moodScore >= 85) positive += 1;
      else if (c.moodScore >= 76) neutral += 1;
      else negative += 1;
    });
    const total = floorCalls.length;
    return {
      positive: Math.round((positive / total) * 100),
      neutral: Math.round((neutral / total) * 100),
      negative: Math.round((negative / total) * 100),
    };
  }, [floorCalls]);

  const handleListen = (call: FloorCall) => {
    setFeaturedId(call.id);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "subscribe_call", callId: call.id }));
    }
    toast({ title: "Listening", description: `Monitoring ${call.agentName} · ${call.callerName}` });
  };

  return (
    <ThreeColumnLayout
      className="ios-live-layout"
      contentClassName="bg-[var(--l9-bg-page)]"
      mainClassName="bg-[var(--l9-bg-page)] !px-[30px] !pt-[26px] !pb-[34px]"
      subPanel={
        <div className="space-y-1">
          <SubPanelSection title={t("analytics.views", "VIEWS")}>
            <SubPanelItem
              icon={<BarChart3 className="w-4 h-4" />}
              label={t("nav.analytics", "Analytics")}
              isActive={false}
              onClick={() => setLocation("/app/analytics")}
              data-testid="nav-analytics-view"
            />
            <SubPanelItem
              icon={<PhoneCall className="w-4 h-4" />}
              label={t("nav.callHistory", "Call History")}
              isActive={false}
              onClick={() => setLocation("/app/analytics?view=call-history")}
              data-testid="nav-call-history-view"
            />
            <SubPanelItem
              icon={<Radio className="w-4 h-4" />}
              label={t("nav.live", "Live")}
              isActive
              onClick={() => setLocation("/app/live")}
              data-testid="nav-live-view"
            />
          </SubPanelSection>
        </div>
      }
      subPanelWidth="sm"
      subPanelHeader={t("nav.dashboard", "Dashboard")}
    >
      <div className="ios-live mx-auto max-w-[1200px] space-y-[18px] pb-8" data-testid="page-dashboard-live">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="ios-segmented" role="tablist" aria-label="Dashboard views">
            <button
              type="button"
              role="tab"
              aria-selected={false}
              className="ios-segment"
              onClick={() => setLocation("/app/analytics")}
              data-testid="segment-analytics"
            >
              Analytics
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={false}
              className="ios-segment"
              onClick={() => setLocation("/app/analytics?view=call-history")}
              data-testid="segment-history"
            >
              History
            </button>
            <button
              type="button"
              role="tab"
              aria-selected
              className="ios-segment"
              data-testid="segment-live"
            >
              Live
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn("ios-live-pill", !wsConnected && "is-offline")}>
              <LiveDot className="h-1.5 w-1.5 shadow-none" />
              {wsConnected ? "Live" : "Reconnecting"}
            </span>
            <div className="text-right">
              <div className="text-[13px] tabular-nums tracking-tight text-[var(--l9-text-muted)]">{clock}</div>
              <div className="text-[12px] tracking-tight text-[var(--l9-text-faint)]">
                {agentCount} AI · {onCall} on call
              </div>
            </div>
          </div>
        </div>

        <div className="pt-1">
          <h1 className="m-0 text-[27px] font-bold leading-none tracking-[-0.02em] text-[var(--l9-text)]">
            AI agents on the line.
          </h1>
          <p className="mt-1.5 text-[14.5px] tracking-tight text-[var(--l9-text-faint)]">
            Real-time floor monitoring for Deprock
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Active calls", value: String(onCall), live: true, color: undefined as string | undefined },
            { label: "In queue", value: String(queue.length) },
            {
              label: "Floor mood",
              value: onCall ? String(liveFloorScore) : "—",
              color: onCall ? gaugeMood.moodColor : undefined,
            },
            { label: "Avg handle", value: avgHandle },
          ].map((stat) => (
            <div key={stat.label} className="ios-kpi">
              <div className="flex items-center gap-1.5 text-[12px] font-medium tracking-tight text-[var(--l9-text-muted)]">
                {stat.live && <LiveDot className="h-1.5 w-1.5 shadow-none" />}
                {stat.label}
              </div>
              <div
                className="mt-1.5 text-[28px] font-semibold tabular-nums tracking-tight"
                style={{ color: stat.color }}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {!onCall && queue.length === 0 ? (
          <div className="ios-card px-8 py-16 text-center" data-testid="live-empty-state">
            <LiveDot className="mx-auto mb-4" />
            <h2 className="text-[20px] font-semibold tracking-tight text-[var(--l9-text)]">No live calls right now</h2>
            <p className="mx-auto mt-2 max-w-md text-[15px] tracking-tight text-[var(--l9-text-faint)]">
              When an inbound or outbound AI call connects, it appears here with transcript, mood, and queue in real
              time.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.55fr_1fr]">
            <div className="flex flex-col gap-4">
              {featured ? (
                <FeaturedCallCard
                  call={featured}
                  moodScore={featured.moodScore}
                  moodColor={mood.moodColor}
                  onListen={() => handleListen(featured)}
                  onAssist={() => toast({ title: "Assist suggested", description: featured.tip })}
                />
              ) : (
                <div className="ios-card p-6 text-[15px] text-[var(--l9-text-faint)]">
                  Callers are ringing — waiting for an agent to answer.
                </div>
              )}
              <OtherCallsList
                calls={floorCalls}
                selectedId={featured?.id}
                onSelect={setFeaturedId}
                title="Active Calls"
              />
            </div>
            <div className="flex flex-col gap-4">
              <FloorGaugeCard
                score={liveFloorScore || 0}
                mood={onCall ? gaugeMood.mood : "Quiet"}
                moodColor={onCall ? gaugeMood.moodColor : "var(--l9-text-faint)"}
                chipBg={onCall ? gaugeMood.chipBg : "var(--l9-tab-track)"}
                split={sentimentSplit}
              />
              <QueueCard queue={queue} />
            </div>
          </div>
        )}
      </div>
    </ThreeColumnLayout>
  );
}
