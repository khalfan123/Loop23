/**
 * ============================================================
 * Voice Metrics Panel — Operations Center view
 *
 * Live view of the voice-core telemetry: per-turn latency
 * percentiles (STT / first LLM token / TTS start / total),
 * TTS/STT provider health with circuit-breaker state, and the
 * most recent conversation turns with provider routing.
 * Backed by GET /api/voice-metrics (+ /turns).
 * ============================================================
 */
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/MetricCard";
import { Mic, Cpu, Volume2, Timer, Loader2, Activity } from "lucide-react";

interface LatencyPercentiles {
  p50: number;
  p95: number;
  avg: number;
}

interface ProviderHealth {
  providerId: string;
  breaker: "closed" | "open" | "half_open";
  attempts: number;
  failures: number;
  ewmaLatencyMs: number | null;
  errorRate: number;
  lastError?: string;
}

interface VoiceMetricsSummary {
  turnCount: number;
  latency: Record<"sttMs" | "llmFirstMs" | "ttsStartMs" | "streamTotalMs", LatencyPercentiles>;
  tts: Record<string, { attempts: number; failures: number; avgLatencyMs: number }>;
  stt: Record<string, { attempts: number; failures: number; confidenceRejects: number; avgLatencyMs: number }>;
  providers: ProviderHealth[];
}

interface TurnMetric {
  callSid: string;
  at: number;
  sttMs: number;
  llmFirstMs: number;
  ttsStartMs: number;
  streamTotalMs: number;
  ttsProvider?: string;
  ttsFellBack?: boolean;
}

const BREAKER_STYLES: Record<ProviderHealth["breaker"], string> = {
  closed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  half_open: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  open: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const BREAKER_LABELS: Record<ProviderHealth["breaker"], string> = {
  closed: "Healthy",
  half_open: "Probing",
  open: "Tripped",
};

function ms(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value)}ms`;
}

export function VoiceMetricsPanel() {
  // No queryFn: the QueryClient default (getQueryFn) handles auth headers,
  // proactive token refresh, and 401 retry — a hand-rolled fetch here would
  // blank the panel the moment the access token expires.
  const { data: summary, isLoading } = useQuery<VoiceMetricsSummary>({
    queryKey: ["/api/voice-metrics"],
    refetchInterval: 5000,
  });

  const { data: turnsData } = useQuery<{ turns: TurnMetric[] }>({
    queryKey: ["/api/voice-metrics/turns?limit=25"],
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const latency = summary?.latency;
  const turns = turnsData?.turns ?? [];

  return (
    <div className="space-y-6" data-testid="voice-metrics-panel">
      <div>
        <h2 className="text-lg font-semibold">Voice Pipeline Metrics</h2>
        <p className="text-sm text-muted-foreground">
          Per-turn latency and provider routing health, live from the voice engine ({summary?.turnCount ?? 0} turns since restart)
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          title="Speech-to-Text"
          value={ms(latency?.sttMs.p50)}
          icon={Mic}
          subtitle={`p95 ${ms(latency?.sttMs.p95)} · avg ${ms(latency?.sttMs.avg)}`}
          testId="metric-stt-latency"
        />
        <MetricCard
          title="First LLM Token"
          value={ms(latency?.llmFirstMs.p50)}
          icon={Cpu}
          subtitle={`p95 ${ms(latency?.llmFirstMs.p95)} · avg ${ms(latency?.llmFirstMs.avg)}`}
          testId="metric-llm-latency"
        />
        <MetricCard
          title="First Speech Out"
          value={ms(latency?.ttsStartMs.p50)}
          icon={Volume2}
          subtitle={`p95 ${ms(latency?.ttsStartMs.p95)} · avg ${ms(latency?.ttsStartMs.avg)}`}
          testId="metric-tts-latency"
        />
        <MetricCard
          title="Full Turn"
          value={ms(latency?.streamTotalMs.p50)}
          icon={Timer}
          subtitle={`p95 ${ms(latency?.streamTotalMs.p95)} · avg ${ms(latency?.streamTotalMs.avg)} · target <700ms p50`}
          testId="metric-turn-latency"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-muted-foreground" />
              TTS Provider Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary?.providers?.length ? (
              <div className="space-y-2">
                {summary.providers.map((p) => (
                  <div key={p.providerId} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={BREAKER_STYLES[p.breaker]}>
                        {BREAKER_LABELS[p.breaker]}
                      </Badge>
                      <span className="font-medium">{p.providerId}</span>
                    </div>
                    <div className="text-muted-foreground text-xs text-right">
                      <span>{p.attempts} calls · {p.failures} failed · {ms(p.ewmaLatencyMs)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No provider activity yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mic className="w-4 h-4 text-muted-foreground" />
              STT Provider Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary && Object.keys(summary.stt || {}).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(summary.stt).map(([providerId, s]) => (
                  <div key={providerId} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
                    <span className="font-medium">{providerId}</span>
                    <div className="text-muted-foreground text-xs text-right">
                      <span>{s.attempts} calls · {s.failures} failed · {s.confidenceRejects} low-conf · {ms(s.avgLatencyMs)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No transcriptions yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            Recent Turns
          </CardTitle>
        </CardHeader>
        <CardContent>
          {turns.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-2 pr-4 font-medium">Time</th>
                    <th className="py-2 pr-4 font-medium">Call</th>
                    <th className="py-2 pr-4 font-medium text-right">STT</th>
                    <th className="py-2 pr-4 font-medium text-right">LLM</th>
                    <th className="py-2 pr-4 font-medium text-right">TTS</th>
                    <th className="py-2 pr-4 font-medium text-right">Total</th>
                    <th className="py-2 font-medium">Voice</th>
                  </tr>
                </thead>
                <tbody>
                  {turns.map((turn, i) => (
                    <tr key={`${turn.callSid}-${turn.at}-${i}`} className="border-b last:border-0">
                      <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">
                        {new Date(turn.at).toLocaleTimeString()}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs">{turn.callSid.slice(-8)}</td>
                      <td className="py-2 pr-4 text-right">{ms(turn.sttMs)}</td>
                      <td className="py-2 pr-4 text-right">{ms(turn.llmFirstMs)}</td>
                      <td className="py-2 pr-4 text-right">{ms(turn.ttsStartMs)}</td>
                      <td className="py-2 pr-4 text-right font-medium">{ms(turn.streamTotalMs)}</td>
                      <td className="py-2">
                        {turn.ttsProvider ? (
                          <span className="inline-flex items-center gap-1.5">
                            {turn.ttsProvider}
                            {turn.ttsFellBack && (
                              <Badge variant="outline" className={BREAKER_STYLES.half_open}>fallback</Badge>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No voice turns recorded since the last restart. Place a call on a Bedrock-Polly agent and this table fills in live.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
