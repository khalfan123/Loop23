import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatDuration,
  formatWait,
  moodFromScore,
  type FloorCall,
  type QueueItem,
} from "@/lib/dashboard-live";

export function Waveform({
  tone,
  bars = 5,
  className,
}: {
  tone: FloorCall["waveTone"];
  bars?: number;
  className?: string;
}) {
  const palette =
    tone === "emerald"
      ? ["#A7F3D0", "#22C55E", "#16A34A", "#22C55E", "#A7F3D0"]
      : tone === "amber"
        ? ["#FFE0B2", "#F59E0B", "#B45309", "#F59E0B", "#FFE0B2"]
        : ["#B3D7FF", "#2563EB", "#6366F1", "#2563EB", "#B3D7FF"];

  return (
    <div className={cn("flex items-end gap-[2px]", className)} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="flex-1 rounded-[1.5px] origin-bottom animate-[live-wave_1s_ease-in-out_infinite]"
          style={{
            height: "100%",
            animationDelay: `${-i * 0.15}s`,
            background: palette[i % palette.length],
          }}
        />
      ))}
    </div>
  );
}

export function LiveDot({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-[7px] w-[7px] rounded-full bg-[#22C55E] shadow-[0_0_0_3px_rgba(34,197,94,.18)] animate-[live-pulse_1.3s_ease-in-out_infinite]",
        className,
      )}
    />
  );
}

function SentimentChip({ score }: { score: number }) {
  const m = moodFromScore(score);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-tight"
      style={{ background: m.chipBg, color: m.deep }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.moodColor }} />
      {score}
    </span>
  );
}

export function FeaturedCallCard({
  call,
  moodScore,
  moodColor,
  onListen,
  onAssist,
}: {
  call: FloorCall;
  moodScore: number;
  moodColor: string;
  onListen: () => void;
  onAssist: () => void;
}) {
  const atRisk = moodScore < 76;
  const transcript =
    call.transcript.length > 0
      ? call.transcript
      : [{ role: "agent" as const, text: "Waiting for live transcript…", speaker: call.agentName }];

  return (
    <div
      className={cn(
        "ios-card overflow-hidden animate-[live-rise_.45s_ease-out_both]",
        atRisk && "ring-1 ring-[#EF4444]/25 bg-[#FFF5F5]",
      )}
      data-testid="featured-live-call"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--l9-border)] px-4 py-3.5">
        <div className="relative h-11 w-11 shrink-0">
          <div className="absolute -inset-1 rounded-full border border-[#2563EB]/35 animate-[live-ripple_2.4s_ease-out_infinite]" />
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center rounded-full bg-gradient-to-br text-[13px] font-semibold text-white",
              call.avatarGradient,
            )}
          >
            {call.initials}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold tracking-tight text-[#0F172A]">
              {call.agentName}
            </span>
            <span className="rounded-full bg-[rgba(37,99,235,0.12)] px-2 py-0.5 text-[10px] font-semibold tracking-tight text-[#2563EB]">
              {call.agentRole}
            </span>
          </div>
          <div className="mt-0.5 truncate text-[13px] text-[rgba(60,60,67,0.6)]">
            with {call.callerName}
            {call.phoneMasked ? ` · ${call.phoneMasked}` : ""} · {call.language}
          </div>
        </div>
        <Waveform tone="violet" className="hidden h-7 w-16 sm:flex" />
        <div className="text-center">
          <div className="text-[22px] font-semibold tabular-nums tracking-tight leading-none" style={{ color: moodColor }}>
            {moodScore}
          </div>
          <div className="mt-0.5 text-[10px] font-medium text-[rgba(60,60,67,0.45)]">mood</div>
        </div>
        <div className="w-12 text-right text-[15px] font-medium tabular-nums tracking-tight text-[rgba(60,60,67,0.6)]">
          {formatDuration(call.durationSec)}
        </div>
      </div>

      <div className="grid gap-4 px-4 py-4 lg:grid-cols-[1fr_170px]">
        <div className="flex flex-col gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[rgba(60,60,67,0.45)]">
            Live transcript
          </div>
          {transcript.map((line, i) => (
            <div key={i} className="flex gap-2.5">
              <span
                className={cn(
                  "w-12 shrink-0 text-[11px] font-semibold",
                  line.role === "agent" ? "text-[#2563EB]" : "text-[rgba(60,60,67,0.45)]",
                )}
              >
                {line.role === "agent" ? line.speaker || call.agentName.slice(0, 4) : "Caller"}
              </span>
              <span
                className={cn(
                  "text-[13px] leading-[1.35] tracking-tight",
                  line.role === "agent" ? "text-[#0F172A]" : "text-[rgba(60,60,67,0.72)]",
                )}
              >
                {line.text}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2.5">
          <div className="rounded-[12px] bg-[rgba(37,99,235,0.08)] px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold tracking-[0.08em] text-[#2563EB]">LOOP9 AI</span>
              <LiveDot className="h-[5px] w-[5px] shadow-none" />
            </div>
            <div className="mt-1 text-[12px] leading-[1.35] tracking-tight text-[#0F172A]">{call.tip}</div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-[10px] bg-[#2563EB] py-2.5 text-center text-[13px] font-semibold text-white tracking-tight"
              onClick={onListen}
              data-testid="button-live-listen"
            >
              Listen
            </button>
            <button
              type="button"
              className="flex-1 rounded-[10px] bg-[rgba(120,120,128,0.16)] py-2.5 text-center text-[13px] font-semibold text-[#0F172A] tracking-tight"
              onClick={onAssist}
              data-testid="button-live-assist"
            >
              Assist
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** iOS inset grouped list for active / other calls */
export function OtherCallsList({
  calls,
  onSelect,
  selectedId,
  title = "Active Calls",
}: {
  calls: FloorCall[];
  onSelect: (id: string) => void;
  selectedId?: string | null;
  title?: string;
}) {
  if (!calls.length) return null;

  return (
    <div className="animate-[live-rise_.45s_ease-out_both] [animation-delay:40ms]">
      <div className="mb-1.5 px-1 text-[13px] font-normal text-[rgba(60,60,67,0.6)] tracking-tight">
        {title}
      </div>
      <div className="ios-inset">
        {calls.map((call, idx) => {
          const atRisk = call.moodScore < 76;
          const selected = call.id === selectedId;
          return (
            <div key={call.id}>
              {idx > 0 && <div className="ml-[68px] h-px bg-[var(--l9-border)]" />}
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors active:bg-[rgba(120,120,128,0.12)]",
                  selected && "bg-[rgba(37,99,235,0.06)]",
                  atRisk && !selected && "bg-[rgba(239,68,68,0.06)]",
                  atRisk && selected && "bg-[rgba(239,68,68,0.1)]",
                )}
                onClick={() => onSelect(call.id)}
                data-testid={`row-live-call-${call.id}`}
              >
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[13px] font-semibold text-white",
                    call.avatarGradient,
                  )}
                >
                  {call.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium tracking-tight text-[#0F172A]">
                    {call.agentName}
                    <span className="font-normal text-[rgba(60,60,67,0.45)]"> · {call.agentRole}</span>
                  </div>
                  <div className="mt-0.5 truncate text-[13px] tracking-tight text-[rgba(60,60,67,0.55)]">
                    with {call.callerName} · {call.language}
                  </div>
                </div>
                <Waveform tone={call.waveTone} bars={4} className="hidden h-5 w-10 sm:flex" />
                <SentimentChip score={call.moodScore} />
                <div className="w-11 text-right text-[15px] font-normal tabular-nums tracking-tight text-[rgba(60,60,67,0.55)]">
                  {formatDuration(call.durationSec)}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-[rgba(60,60,67,0.3)]" strokeWidth={2.25} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FloorGaugeCard({
  score,
  mood,
  moodColor,
  chipBg,
  split,
}: {
  score: number;
  mood: string;
  moodColor: string;
  chipBg: string;
  split: { positive: number; neutral: number; negative: number };
}) {
  return (
    <div className="ios-card relative flex flex-col items-center overflow-hidden p-5 animate-[live-rise_.45s_ease-out_both]">
      <div className="self-start text-[11px] font-semibold uppercase tracking-[0.06em] text-[rgba(60,60,67,0.45)]">
        Floor sentiment
      </div>
      <div className="pointer-events-none absolute left-1/2 top-14 h-52 w-52 -translate-x-1/2">
        <div className="absolute inset-0 rounded-full border border-[rgba(37,99,235,.28)] animate-[live-ripple_4s_ease-out_infinite]" />
        <div className="absolute inset-0 rounded-full border border-[rgba(34,197,94,.25)] animate-[live-ripple_4s_ease-out_infinite] [animation-delay:1.3s]" />
        <div className="absolute inset-0 rounded-full border border-[rgba(245,158,11,.2)] animate-[live-ripple_4s_ease-out_infinite] [animation-delay:2.6s]" />
      </div>
      <div className="relative my-4 flex h-40 w-40 items-center justify-center">
        <div
          className="absolute inset-0 rounded-full opacity-25 blur-[20px] animate-[live-spin_14s_linear_infinite]"
          style={{ background: "conic-gradient(from 0deg,#2563EB,#22C55E,#F59E0B,#2563EB)" }}
        />
        <div className="absolute inset-3 rounded-full bg-white shadow-[inset_0_0_0_1px_var(--l9-border)] animate-[live-breathe_5s_ease-in-out_infinite]" />
        <div className="relative text-center">
          <div
            className="text-[56px] font-semibold leading-[0.9] tracking-tight tabular-nums"
            data-testid="text-floor-score"
          >
            {score}
          </div>
          <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: chipBg }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: moodColor }} />
            <span className="text-[12px] font-semibold tracking-tight" style={{ color: moodColor }}>
              {mood}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-1 flex w-full justify-between border-t border-[var(--l9-border)] pt-3.5">
        <div className="flex-1 text-center">
          <div className="text-[17px] font-semibold tabular-nums tracking-tight text-[#22C55E]">{split.positive}%</div>
          <div className="mt-0.5 text-[11px] text-[rgba(60,60,67,0.45)]">positive</div>
        </div>
        <div className="flex-1 border-x border-[var(--l9-border)] text-center">
          <div className="text-[17px] font-semibold tabular-nums tracking-tight text-[#2563EB]">{split.neutral}%</div>
          <div className="mt-0.5 text-[11px] text-[rgba(60,60,67,0.45)]">neutral</div>
        </div>
        <div className="flex-1 text-center">
          <div className="text-[17px] font-semibold tabular-nums tracking-tight text-[#F59E0B]">{split.negative}%</div>
          <div className="mt-0.5 text-[11px] text-[rgba(60,60,67,0.45)]">negative</div>
        </div>
      </div>
    </div>
  );
}

export function QueueCard({ queue }: { queue: QueueItem[] }) {
  return (
    <div className="animate-[live-rise_.45s_ease-out_both] [animation-delay:60ms]">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <div className="text-[13px] font-normal text-[rgba(60,60,67,0.6)] tracking-tight">In queue</div>
        <span className="rounded-full bg-[rgba(245,158,11,0.14)] px-2 py-0.5 text-[11px] font-semibold text-[#B45309]">
          {queue.length} waiting
        </span>
      </div>
      <div className="ios-inset">
        {queue.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px] text-[rgba(60,60,67,0.45)]">No callers waiting</div>
        ) : (
          queue.map((item, idx) => (
            <div key={item.id}>
              {idx > 0 && <div className="ml-14 h-px bg-[var(--l9-border)]" />}
              <div
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5",
                  item.urgent && "bg-[rgba(239,68,68,0.05)]",
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(120,120,128,0.16)] text-[12px] font-semibold text-[rgba(60,60,67,0.6)]">
                  {item.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium tracking-tight text-[#0F172A]">{item.display}</div>
                  <div className="mt-0.5 truncate text-[13px] text-[rgba(60,60,67,0.55)]">{item.intent}</div>
                </div>
                <div
                  className={cn(
                    "text-[15px] tabular-nums tracking-tight",
                    item.urgent ? "font-semibold text-[#EF4444]" : "text-[rgba(60,60,67,0.55)]",
                  )}
                >
                  {formatWait(item.waitSec)}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-[rgba(60,60,67,0.3)]" strokeWidth={2.25} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
