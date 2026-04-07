import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Phone, PhoneOff, Volume2, Loader2, Mic, MicOff, Bot, User, Wifi, Hash } from "lucide-react";

interface TwimlStep {
  type: "say" | "play";
  voice: string;
  engine: string;
  text: string;
  playUrl?: string;
}

interface ParsedTwiml {
  saySteps: TwimlStep[];
  gatherAction: string | null;
  gatherHints: string[];
  menuOptions: Record<string, string>;
  redirectUrl: string | null;
  streamUrl: string | null;
  hangup: boolean;
  agentId: string | null;
  callId: string | null;
}

function parseTwiml(xml: string): ParsedTwiml {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");

  const saySteps: TwimlStep[] = [];

  const allElements = doc.querySelectorAll("Say, Play");
  allElements.forEach((el) => {
    if (el.tagName === "Say") {
      const voice = el.getAttribute("voice") || "Polly.Joanna";
      const engine = el.getAttribute("engine") || "neural";
      const prosody = el.querySelector("prosody");
      const text = prosody ? prosody.textContent || "" : el.textContent || "";
      if (text.trim()) {
        saySteps.push({ type: "say", voice: voice.replace("Polly.", "").replace(/-Neural$/, ""), engine, text: text.trim() });
      }
    } else if (el.tagName === "Play") {
      const playUrl = el.textContent?.trim() || "";
      if (playUrl) {
        const urlParams = new URLSearchParams(playUrl.split("?")[1] || "");
        const text = urlParams.get("text") || "";
        saySteps.push({ type: "play", voice: "", engine: "", text: text || "(audio)", playUrl });
      }
    }
  });

  const gather = doc.querySelector("Gather");
  const gatherAction = gather?.getAttribute("action") || null;
  const hintsStr = gather?.getAttribute("hints") || "";
  const gatherHints = hintsStr ? hintsStr.split(" ").filter(Boolean) : [];

  // Parse menu options from say text (e.g. "Press 1 for English, Press 2 for Spanish")
  const menuOptions: Record<string, string> = {};
  const allSayText = saySteps.map(s => s.text).join(" ");
  const pressPatterns = [
    /[Pp]ress\s+(\w+)\s+(?:for|to)\s+([^.,\n;]+)/g,
    /(\d+)\s*[-–]\s*([^.,\n;0-9]+)/g,
    /[Ff]or\s+([^,\n;]+),?\s+(?:press|dial|enter)\s+(\d+)/gi,
  ];
  for (const regex of pressPatterns) {
    let match;
    while ((match = regex.exec(allSayText)) !== null) {
      const digit = match[1].trim();
      const label = match[2].trim().replace(/\s+/g, " ");
      if (/^\d$/.test(digit) && label.length > 0 && label.length < 40) {
        menuOptions[digit] = label.charAt(0).toUpperCase() + label.slice(1);
      } else if (/^\d$/.test(match[2]?.trim()) && match[1]) {
        const d = match[2].trim();
        const l = match[1].trim().replace(/\s+/g, " ");
        if (l.length > 0 && l.length < 40) menuOptions[d] = l.charAt(0).toUpperCase() + l.slice(1);
      }
    }
  }

  const redirect = doc.querySelector("Redirect");
  const redirectUrl = redirect?.textContent || null;

  const stream = doc.querySelector("Stream");
  const streamUrl = stream?.getAttribute("url") || null;

  const hangup = !!doc.querySelector("Hangup");

  const agentParam = stream?.querySelector('Parameter[name="agentId"]');
  const agentId = agentParam?.getAttribute("value") || null;

  const callIdParam = stream?.querySelector('Parameter[name="callId"]');
  const callId = callIdParam?.getAttribute("value") || null;

  return { saySteps, gatherAction, gatherHints, menuOptions, redirectUrl, streamUrl, hangup, agentId, callId };
}

type CallState = "idle" | "ivr" | "connecting" | "agent-ready" | "recording" | "processing" | "agent-speaking" | "ended";

interface TranscriptMessage {
  role: "user" | "agent" | "system";
  text: string;
  timestamp: Date;
}

interface Props {
  onClose?: () => void;
}

// Tiny silent WAV to unlock browser autoplay policy on user gesture
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAVFYAAFRWAAABAAgAZGF0YQAAAAA=";

const DIGIT_LABELS: Record<string, string> = {
  "1": "", "2": "ABC", "3": "DEF",
  "4": "GHI", "5": "JKL", "6": "MNO",
  "7": "PQRS", "8": "TUV", "9": "WXYZ",
  "*": "", "0": "+", "#": "",
};

export default function DeprockCallSimulator({ onClose }: Props = {}) {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(true);

  const [selectedIvrId, setSelectedIvrId] = useState<string>("");
  const [callState, setCallState] = useState<CallState>("idle");
  const [parsedTwiml, setParsedTwiml] = useState<ParsedTwiml | null>(null);
  const [loading, setLoading] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(false);
  const [currentAudioIndex, setCurrentAudioIndex] = useState(-1);
  const [selectedLang, setSelectedLang] = useState<string>("en");
  const [currentStep, setCurrentStep] = useState<string>("idle");
  const [agentName, setAgentName] = useState<string>("");
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [processingStage, setProcessingStage] = useState<string>("");
  const [callDuration, setCallDuration] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<TwimlStep[]>([]);
  const playingRef = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const agentAudioRef = useRef<HTMLAudioElement | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStartTimeRef = useRef<number>(0);
  const sessionIdRef = useRef<string>("");
  const connectedAgentIdRef = useRef<string>("");
  const audioUnlockedRef = useRef(false);

  const { data: deptIvrConfigs } = useQuery({ queryKey: ["/api/departments/ivr/all"] });
  const { data: deprockIvrConfigs } = useQuery({ queryKey: ["/api/deprock/ivr-configs-all"] });

  const filteredIvrConfigs = [
    ...((deptIvrConfigs as any[]) || []),
    ...((deprockIvrConfigs as any[]) || []),
  ];

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, processingStage]);

  useEffect(() => {
    return () => { cleanupAll(); };
  }, []);

  const unlockAudio = useCallback(async () => {
    if (audioUnlockedRef.current) return;
    try {
      if (audioRef.current) {
        audioRef.current.muted = true;
        audioRef.current.src = SILENT_WAV;
        await audioRef.current.play().catch(() => {});
        audioRef.current.pause();
        audioRef.current.muted = false;
        audioRef.current.src = "";
        audioUnlockedRef.current = true;
      }
    } catch {
      audioUnlockedRef.current = true;
    }
  }, []);

  const cleanupAll = useCallback(() => {
    if (wsRef.current) { try { wsRef.current.close(); } catch {} wsRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    mediaRecorderRef.current = null;
    if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach(t => t.stop()); mediaStreamRef.current = null; }
    if (agentAudioRef.current) { agentAudioRef.current.pause(); agentAudioRef.current = null; }
    if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
    audioQueueRef.current = [];
    playingRef.current = false;
  }, []);

  const handleClose = useCallback(() => {
    cleanupAll();
    setOpen(false);
    if (onClose) {
      onClose();
    } else {
      setLocation("/app/deprock");
    }
  }, [cleanupAll, setLocation, onClose]);

  const addTranscript = useCallback((role: "user" | "agent" | "system", text: string) => {
    setTranscript(prev => [...prev, { role, text, timestamp: new Date() }]);
  }, []);

  const stopAudio = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
    audioQueueRef.current = [];
    playingRef.current = false;
    setPlayingAudio(false);
    setCurrentAudioIndex(-1);
  }, []);

  const playAudioForStep = useCallback(async (step: TwimlStep, index: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      setCurrentAudioIndex(index);
      setPlayingAudio(true);
      playingRef.current = true;
      setAudioError(null);

      const fetchAudio = async () => {
        try {
          let blob: Blob;
          if (step.type === "play" && step.playUrl) {
            const audioRes = await fetch(step.playUrl);
            if (!audioRes.ok) throw new Error(`Audio fetch failed: ${audioRes.status}`);
            blob = await audioRes.blob();
          } else {
            const res = await apiRequest("POST", "/api/deprock/tts-preview", {
              voiceId: step.voice,
              text: step.text,
              engine: step.engine,
            });
            if (!res.ok) throw new Error(`TTS failed: ${res.status}`);
            blob = await res.blob();
          }

          if (!playingRef.current) { resolve(); return; }

          const url = URL.createObjectURL(blob);
          if (audioRef.current) {
            audioRef.current.src = url;
            audioRef.current.muted = false;
            audioRef.current.volume = 1.0;
            audioRef.current.onended = () => { URL.revokeObjectURL(url); resolve(); };
            audioRef.current.onerror = (e) => {
              URL.revokeObjectURL(url);
              setAudioError("Audio playback failed. Check browser permissions.");
              reject(new Error("Audio playback failed"));
            };
            const playPromise = audioRef.current.play();
            if (playPromise) {
              playPromise.catch((err) => {
                setAudioError("Audio blocked. Click anywhere on the page and try again.");
                reject(err);
              });
            }
          } else {
            resolve();
          }
        } catch (err: any) {
          setAudioError(err.message || "Audio error");
          reject(err);
        }
      };

      fetchAudio();
    });
  }, []);

  const playAllSteps = useCallback(async (steps: TwimlStep[]) => {
    audioQueueRef.current = [...steps];
    for (let i = 0; i < steps.length; i++) {
      if (!playingRef.current && i > 0) break;
      try { await playAudioForStep(steps[i], i); } catch { break; }
    }
    setPlayingAudio(false);
    setCurrentAudioIndex(-1);
    playingRef.current = false;
  }, [playAudioForStep]);

  const connectToAgent = useCallback(async (agentId: string, callId?: string | null) => {
    setCallState("connecting");
    const sid = `sim-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    sessionIdRef.current = sid;
    connectedAgentIdRef.current = agentId;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/voice-sim/stream?sessionId=${sid}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "init", agentId, sessionId: sid, ...(callId ? { callId } : {}) }));
        addTranscript("system", "Connecting to AI agent...");
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case "ready":
              setAgentName(msg.agentName || "AI Agent");
              setCallState("agent-ready");
              setProcessingStage("");
              callStartTimeRef.current = Date.now();
              callTimerRef.current = setInterval(() => {
                setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
              }, 1000);
              if (msg.firstMessage) addTranscript("agent", msg.firstMessage);
              addTranscript("system", `Connected to ${msg.agentName || "AI Agent"}`);
              break;
            case "transcript": addTranscript(msg.role, msg.text); break;
            case "audio":
              setCallState("agent-speaking");
              setProcessingStage("");
              playAgentAudio(msg.data);
              break;
            case "processing":
              setProcessingStage(msg.stage);
              if (msg.stage === "transcribing") setCallState("processing");
              break;
            case "error":
              addTranscript("system", `Error: ${msg.message}`);
              setProcessingStage("");
              setCallState("agent-ready");
              break;
            case "ended":
              addTranscript("system", "Agent ended the conversation.");
              endCall();
              break;
          }
        } catch {}
      };

      ws.onerror = () => { addTranscript("system", "Connection error occurred."); setCallState("agent-ready"); };
      ws.onclose = () => {};
    } catch {
      addTranscript("system", "Failed to connect to agent.");
      setCallState("ivr");
    }
  }, [addTranscript]);

  const playAgentAudio = useCallback((base64Data: string) => {
    try {
      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      const audioBlob = new Blob([bytes], { type: "audio/mpeg" });
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audio.volume = 1.0;
      agentAudioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); setCallState(prev => prev === "agent-speaking" ? "agent-ready" : prev); };
      audio.onerror = () => { URL.revokeObjectURL(url); setCallState(prev => prev === "agent-speaking" ? "agent-ready" : prev); };
      audio.play().catch(() => setCallState(prev => prev === "agent-speaking" ? "agent-ready" : prev));
    } catch {
      setCallState(prev => prev === "agent-speaking" ? "agent-ready" : prev);
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (callState !== "agent-ready") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mediaRecorder.onstop = () => {
        if (chunks.length === 0) { setCallState("agent-ready"); stream.getTracks().forEach(t => t.stop()); mediaStreamRef.current = null; return; }
        const blob = new Blob(chunks, { type: mimeType });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(",")[1];
          if (base64 && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "audio", data: base64 }));
            setCallState("processing");
            setProcessingStage("transcribing");
          }
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      };

      mediaRecorder.start();
      setCallState("recording");
      if (agentAudioRef.current) { agentAudioRef.current.pause(); agentAudioRef.current = null; }
    } catch {
      addTranscript("system", "Microphone access denied. Please allow microphone access.");
    }
  }, [callState, addTranscript]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") mediaRecorderRef.current.stop();
  }, []);

  const simulateStep = useCallback(async (step: string, digits?: string, lang?: string) => {
    setLoading(true);
    try {
      const body: any = { step, ivrId: selectedIvrId };
      if (digits) body.digits = digits;
      if (lang) body.lang = lang;

      addTranscript("system", digits ? `Pressed ${digits}` : `Starting call...`);

      const res = await apiRequest("POST", "/api/deprock/ivr-simulate", body);
      const twiml = await res.text();
      const parsed = parseTwiml(twiml);
      setParsedTwiml(parsed);
      setCurrentStep(step);

      if (parsed.streamUrl && parsed.agentId) {
        if (parsed.saySteps.length > 0) await playAllSteps(parsed.saySteps);
        connectToAgent(parsed.agentId, parsed.callId);
        return parsed;
      }

      if (parsed.hangup) { addTranscript("system", "Call ended by system."); setCallState("ended"); }
      if (parsed.saySteps.length > 0) await playAllSteps(parsed.saySteps);
      return parsed;
    } catch (err: any) {
      addTranscript("system", `Error: ${err.message || "Failed to process"}`);
      return null;
    } finally {
      setLoading(false);
    }
  }, [selectedIvrId, addTranscript, playAllSteps, connectToAgent]);

  const startCall = useCallback(async () => {
    // Unlock audio on the same user gesture BEFORE any async work
    await unlockAudio();
    setCallState("ivr");
    setTranscript([]);
    setAgentName("");
    setCallDuration(0);
    setProcessingStage("");
    setAudioError(null);
    addTranscript("system", "Call started...");
    await simulateStep("answer");
  }, [unlockAudio, addTranscript, simulateStep]);

  const endCall = useCallback(() => {
    stopAudio();
    if (wsRef.current?.readyState === WebSocket.OPEN) { try { wsRef.current.send(JSON.stringify({ type: "end" })); } catch {} }
    cleanupAll();
    setCallState("ended");
    setParsedTwiml(null);
    setProcessingStage("");
    addTranscript("system", "Call ended.");
  }, [stopAudio, addTranscript, cleanupAll]);

  const resetCall = useCallback(() => {
    setCallState("idle");
    setTranscript([]);
    setParsedTwiml(null);
    setAgentName("");
    setCallDuration(0);
    setProcessingStage("");
    setCurrentStep("idle");
    setAudioError(null);
  }, []);

  const handleDigitPress = useCallback(async (digit: string) => {
    stopAudio();
    if (digit === "0") {
      if (currentStep === "answer" || currentStep === "handle-language") await simulateStep("answer");
      else if (currentStep === "handle-selection") await simulateStep("handle-language", "0");
      return;
    }
    if (currentStep === "answer") {
      const ivrConfig = filteredIvrConfigs.find((c: any) => c.id === selectedIvrId);
      const langOptions = ivrConfig?.languageOptions as any[];
      if (langOptions && langOptions.length > 1) {
        const idx = parseInt(digit) - 1;
        const lang = langOptions[idx]?.language || "en";
        setSelectedLang(lang);
        await simulateStep("handle-language", digit);
      } else {
        await simulateStep("handle-selection", digit, "en");
      }
    } else if (currentStep === "handle-language") {
      await simulateStep("handle-selection", digit, selectedLang);
    }
  }, [currentStep, stopAudio, simulateStep, selectedIvrId, filteredIvrConfigs, selectedLang]);

  const activeConfigs = (filteredIvrConfigs || []).filter((c: any) => c.isActive);
  const currentHints = parsedTwiml?.gatherHints || [];
  const menuOptions = parsedTwiml?.menuOptions || {};
  const isInAgent = ["connecting", "agent-ready", "recording", "processing", "agent-speaking"].includes(callState);
  const isCallActive = callState !== "idle" && callState !== "ended";

  // A digit is actionable if it appears in hints OR if no hints are specified (allow any)
  const isDigitActionable = (digit: string) => {
    if (loading) return false;
    if (currentHints.length > 0) return currentHints.includes(digit);
    // If no hints from TwiML, allow 1-9 when in IVR state (server will handle invalid input)
    return /^\d$/.test(digit) && digit !== "0" ? true : digit === "0";
  };

  const isDigitHighlighted = (digit: string) => currentHints.includes(digit) || Object.keys(menuOptions).includes(digit);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const getStatusLabel = () => {
    switch (callState) {
      case "idle": return "Idle";
      case "ivr": return "IVR Menu";
      case "connecting": return "Connecting...";
      case "agent-ready": return "Agent Connected";
      case "recording": return "Recording";
      case "processing": return "Processing";
      case "agent-speaking": return "Agent Speaking";
      case "ended": return "Call Ended";
      default: return "Idle";
    }
  };

  const getStatusVariant = (): "default" | "secondary" | "destructive" | "outline" => {
    if (callState === "recording") return "destructive";
    if (isCallActive) return "default";
    return "secondary";
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <audio ref={audioRef} />
      <DialogContent className="max-w-4xl w-full p-0 gap-0 overflow-hidden max-h-[90vh]">
        <DialogHeader className="px-5 py-4 border-b flex flex-row items-center justify-between gap-3 space-y-0">
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 text-indigo-600" />
            <DialogTitle className="text-base font-semibold">IVR Call Simulator</DialogTitle>
          </div>
          <div className="flex items-center gap-2">
            {isInAgent && (
              <span className="text-sm text-muted-foreground font-mono" data-testid="text-call-timer">
                {formatDuration(callDuration)}
              </span>
            )}
            <Badge variant={getStatusVariant()} data-testid="badge-call-status">
              {callState === "recording" && <Mic className="h-3 w-3 mr-1" />}
              {callState === "connecting" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              {callState === "ivr" && playingAudio && <Volume2 className="h-3 w-3 mr-1 animate-pulse" />}
              {isInAgent && callState !== "connecting" && callState !== "recording" && <Wifi className="h-3 w-3 mr-1" />}
              {getStatusLabel()}
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex flex-col md:flex-row h-full overflow-hidden" style={{ minHeight: 420, maxHeight: "calc(90vh - 70px)" }}>
          <div className="md:w-72 shrink-0 border-b md:border-b-0 md:border-r flex flex-col gap-4 p-4 overflow-y-auto">
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">IVR Configuration</p>
              <Select value={selectedIvrId} onValueChange={setSelectedIvrId} disabled={isCallActive}>
                <SelectTrigger data-testid="select-ivr-config" className="text-sm">
                  <SelectValue placeholder="Select IVR config..." />
                </SelectTrigger>
                <SelectContent>
                  {activeConfigs.map((config: any) => (
                    <SelectItem key={config.id} value={config.id} className="text-sm">
                      {config.name || "Unnamed IVR"}{" "}
                      <span className="text-muted-foreground">
                        ({config.engineType === "bedrock-polly" ? "Deprock" : "Dept"})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {callState === "idle" && (
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white text-sm"
                  disabled={!selectedIvrId || loading}
                  onClick={startCall}
                  data-testid="button-start-call"
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Start Call
                </Button>
              )}

              {callState === "ended" && (
                <Button variant="outline" className="w-full text-sm" onClick={resetCall} data-testid="button-new-call">
                  <Phone className="h-4 w-4 mr-2" />
                  New Call
                </Button>
              )}

              {isCallActive && (
                <Button variant="destructive" className="w-full text-sm" onClick={endCall} data-testid="button-end-call">
                  <PhoneOff className="h-4 w-4 mr-2" />
                  End Call
                </Button>
              )}
            </div>

            {/* Audio error banner */}
            {audioError && (
              <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2">
                <p className="text-xs text-amber-700 dark:text-amber-400">{audioError}</p>
              </div>
            )}

            {callState === "ivr" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dial Pad</p>
                  {playingAudio && (
                    <div className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400">
                      <Volume2 className="h-3 w-3 animate-pulse" />
                      <span>Playing...</span>
                    </div>
                  )}
                </div>

                {/* Audio playing indicator */}
                {playingAudio && parsedTwiml?.saySteps[currentAudioIndex] && (
                  <div className="rounded-md bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 px-3 py-2">
                    <div className="flex items-start gap-2">
                      <Volume2 className="h-3 w-3 text-indigo-500 mt-0.5 shrink-0 animate-pulse" />
                      <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
                        {parsedTwiml.saySteps[currentAudioIndex].text}
                      </p>
                    </div>
                  </div>
                )}

                {/* Menu options legend */}
                {Object.keys(menuOptions).length > 0 && (
                  <div className="rounded-md border bg-muted/40 px-3 py-2 space-y-1">
                    {Object.entries(menuOptions).map(([digit, label]) => (
                      <div key={digit} className="flex items-center gap-2 text-xs">
                        <span className="w-5 h-5 rounded bg-indigo-600 text-white flex items-center justify-center font-bold text-[11px] shrink-0">{digit}</span>
                        <span className="text-muted-foreground truncate">{label}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((digit) => {
                    const highlighted = isDigitHighlighted(digit);
                    const actionable = callState === "ivr" && isDigitActionable(digit);
                    const optionLabel = menuOptions[digit];
                    return (
                      <button
                        key={digit}
                        disabled={loading || !actionable}
                        onClick={() => handleDigitPress(digit)}
                        data-testid={`button-digit-${digit}`}
                        className={`
                          relative h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 font-bold transition-all duration-150 select-none
                          ${highlighted
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30 hover:bg-indigo-700 active:scale-95"
                            : actionable
                            ? "bg-muted hover:bg-muted/80 text-foreground active:scale-95 border border-border"
                            : "bg-muted/30 text-muted-foreground/40 cursor-not-allowed border border-transparent"
                          }
                        `}
                      >
                        <span className="text-lg leading-none">{digit}</span>
                        {DIGIT_LABELS[digit] && (
                          <span className={`text-[8px] tracking-widest leading-none ${highlighted ? "text-indigo-200" : "text-muted-foreground"}`}>
                            {DIGIT_LABELS[digit]}
                          </span>
                        )}
                        {optionLabel && (
                          <span className="absolute -bottom-5 left-0 right-0 text-center text-[9px] text-indigo-600 dark:text-indigo-400 font-normal truncate px-1 leading-none">
                            {optionLabel.split(" ").slice(0, 2).join(" ")}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {currentHints.length > 0 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    Press: {currentHints.join(", ")}
                  </p>
                )}

                {!loading && !playingAudio && currentHints.length === 0 && Object.keys(menuOptions).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center">
                    Waiting for IVR menu...
                  </p>
                )}
              </div>
            )}

            {isInAgent && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Agent</p>
                <div className="text-center space-y-3">
                  <div>
                    <p className="text-sm font-semibold" data-testid="text-agent-name">{agentName || "Connecting..."}</p>
                    {isInAgent && (
                      <p className="text-xs text-muted-foreground font-mono" data-testid="text-call-timer-panel">
                        {formatDuration(callDuration)}
                      </p>
                    )}
                  </div>

                  <button
                    className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center transition-all duration-200 select-none ${
                      callState === "recording"
                        ? "bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse scale-105"
                        : callState === "agent-ready"
                        ? "bg-indigo-600 text-white shadow-md cursor-pointer hover:bg-indigo-700 active:scale-95"
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                    }`}
                    onMouseDown={() => { if (callState === "agent-ready") startRecording(); }}
                    onMouseUp={() => { if (callState === "recording") stopRecording(); }}
                    onMouseLeave={() => { if (callState === "recording") stopRecording(); }}
                    onTouchStart={(e) => { e.preventDefault(); if (callState === "agent-ready") startRecording(); }}
                    onTouchEnd={(e) => { e.preventDefault(); if (callState === "recording") stopRecording(); }}
                    disabled={callState !== "agent-ready" && callState !== "recording"}
                    data-testid="button-push-to-talk"
                  >
                    {callState === "recording" ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
                  </button>

                  <p className="text-xs text-muted-foreground">
                    {callState === "recording" ? "Release to send"
                      : callState === "agent-ready" ? "Hold to talk"
                      : callState === "connecting" ? "Connecting..."
                      : callState === "agent-speaking" ? "Agent speaking..."
                      : "Processing..."}
                  </p>

                  {processingStage && (
                    <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground" data-testid="text-processing-stage">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {processingStage === "transcribing" && "Transcribing..."}
                      {processingStage === "thinking" && "Thinking..."}
                      {processingStage === "speaking" && "Generating..."}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {isInAgent ? "Conversation" : "Call Flow"}
              </p>
              <div className="flex items-center gap-2">
                {loading && (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading...
                  </Badge>
                )}
                {isInAgent && (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Wifi className="h-3 w-3" />
                    Live
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {transcript.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <Phone className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Select an IVR configuration and press Start Call</p>
                  <p className="text-xs mt-1">Navigate the IVR menu, then talk to the AI agent</p>
                </div>
              )}

              {transcript.map((msg, idx) => {
                if (msg.role === "system") {
                  return (
                    <div key={idx} className="flex justify-center" data-testid={`transcript-message-${idx}`}>
                      <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">{msg.text}</span>
                    </div>
                  );
                }
                const isUser = msg.role === "user";
                return (
                  <div key={idx} className={`flex ${isUser ? "justify-end" : "justify-start"}`} data-testid={`transcript-message-${idx}`}>
                    <div className={`flex items-start gap-2 max-w-[80%] ${isUser ? "flex-row-reverse" : ""}`}>
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${isUser ? "bg-indigo-100 dark:bg-indigo-900/50" : "bg-gray-100 dark:bg-gray-800"}`}>
                        {isUser
                          ? <User className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                          : <Bot className="h-3 w-3 text-muted-foreground" />}
                      </div>
                      <div className={`rounded-lg px-3 py-2 text-sm ${isUser ? "bg-indigo-600 text-white" : "bg-muted text-foreground"}`}>
                        {msg.text}
                        <div className={`text-[10px] mt-0.5 ${isUser ? "text-indigo-200" : "text-muted-foreground"}`}>
                          {msg.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {processingStage && (
                <div className="flex justify-start" data-testid="text-processing-indicator">
                  <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {processingStage === "transcribing" && "Transcribing..."}
                    {processingStage === "thinking" && "Agent is thinking..."}
                    {processingStage === "speaking" && "Generating response..."}
                  </div>
                </div>
              )}

              <div ref={transcriptEndRef} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
