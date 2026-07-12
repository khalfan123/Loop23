export type SentimentLevel = "positive" | "neutral" | "cautious" | "negative" | "critical";

export interface LiveCall {
  callId: string;
  direction: "inbound" | "outbound";
  status: string;
  fromNumber?: string;
  toNumber?: string;
  agentId?: string;
  agentName?: string;
  campaignId?: string;
  campaignName?: string;
  contactName?: string;
  startedAt: string;
  duration: number;
  transcript?: string[];
  sentimentLevel?: SentimentLevel;
  sentimentScore?: number;
  metadata?: Record<string, unknown>;
}

export interface TranscriptLine {
  role: "caller" | "agent";
  text: string;
  speaker?: string;
}

export interface FloorCall {
  id: string;
  agentName: string;
  agentRole: string;
  initials: string;
  avatarGradient: string;
  callerName: string;
  phoneMasked: string;
  language: string;
  moodScore: number;
  durationSec: number;
  transcript: TranscriptLine[];
  tip: string;
  waveTone: "violet" | "emerald" | "amber";
}

export interface QueueItem {
  id: string;
  display: string;
  avatar: string;
  intent: string;
  waitSec: number;
  urgent?: boolean;
}

export interface WsMessage {
  type: string;
  activeCalls?: LiveCall[];
  call?: LiveCall;
  callId?: string;
  message?: string;
  role?: string;
}

export function moodFromScore(score: number) {
  // Loop9 AURA Command status colors
  if (score >= 85) {
    return { mood: "Positive", moodColor: "#22C55E", chipBg: "rgba(22,163,74,.12)", deep: "#16A34A" };
  }
  if (score >= 76) {
    return { mood: "Steady", moodColor: "#2563EB", chipBg: "rgba(37,99,235,.12)", deep: "#2563EB" };
  }
  if (score >= 60) {
    return { mood: "At risk", moodColor: "#F59E0B", chipBg: "rgba(245,158,11,.14)", deep: "#B45309" };
  }
  return { mood: "Critical", moodColor: "#EF4444", chipBg: "rgba(239,68,68,.12)", deep: "#DC2626" };
}

export function scoreFromLiveCall(call: LiveCall): number {
  if (typeof call.sentimentScore === "number") {
    const raw = call.sentimentScore <= 1 ? call.sentimentScore * 100 : call.sentimentScore;
    return Math.round(Math.max(40, Math.min(99, raw)));
  }
  switch (call.sentimentLevel) {
    case "positive":
      return 88;
    case "neutral":
      return 80;
    case "cautious":
      return 74;
    case "negative":
      return 62;
    case "critical":
      return 48;
    default:
      return 82;
  }
}

export function maskPhone(num?: string): string {
  if (!num) return "";
  const digits = num.replace(/\D/g, "");
  if (digits.length < 6) return num;
  return `${num.slice(0, Math.min(8, num.length - 4))} ••• ${digits.slice(-4)}`;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatWait(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function initialsFromName(name?: string): string {
  if (!name) return "AI";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function parseTranscript(call: LiveCall, agentLabel: string): TranscriptLine[] {
  if (!call.transcript?.length) return [];
  return call.transcript.slice(-6).map((line) => {
    const match = line.match(/^\[(agent|caller)\]\s(.*)$/i);
    if (match) {
      const role = match[1].toLowerCase() === "agent" ? "agent" : "caller";
      return { role, text: `"${match[2]}"`, speaker: role === "agent" ? agentLabel : undefined };
    }
    return { role: "caller" as const, text: line };
  });
}

export function mapLiveCall(call: LiveCall, index: number): FloorCall {
  const agentName = call.agentName || "AI Agent";
  const short = agentName.split(/[·•\-]/)[0]?.trim() || agentName;
  const gradients = [
    "from-[#2563EB] to-[#3B82F6]",
    "from-[#16A34A] to-[#22C55E]",
    "from-[#7C3AED] to-[#6366F1]",
    "from-[#3B82F6] to-[#2563EB]",
  ];
  const score = scoreFromLiveCall(call);
  const tones: FloorCall["waveTone"][] = ["violet", "emerald", "amber", "emerald"];
  return {
    id: call.callId,
    agentName: short,
    agentRole: call.direction === "inbound" ? "Inbound AI" : "Outbound AI",
    initials: initialsFromName(short),
    avatarGradient: gradients[index % gradients.length],
    callerName: call.contactName || (call.direction === "inbound" ? "Caller" : "Contact"),
    phoneMasked: maskPhone(call.direction === "inbound" ? call.fromNumber : call.toNumber),
    language: typeof call.metadata?.language === "string" ? call.metadata.language : "—",
    moodScore: score,
    durationSec: call.duration || 0,
    tip:
      score >= 85
        ? "Mood strong — confirm resolution and close cleanly."
        : score >= 76
          ? "Steady tone — keep acknowledging and guiding next steps."
          : "At risk — slow down and validate before solving.",
    waveTone: tones[index % tones.length],
    transcript: parseTranscript(call, short),
  };
}
