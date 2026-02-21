import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, PhoneOff, Volume2, Loader2, ArrowLeft, Hash, Mic, MicOff, Bot, User, Wifi, WifiOff } from "lucide-react";
import { Link } from "wouter";

interface TwimlStep {
  voice: string;
  engine: string;
  text: string;
}

interface ParsedTwiml {
  saySteps: TwimlStep[];
  gatherAction: string | null;
  gatherHints: string[];
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
  const sayElements = doc.querySelectorAll("Say");
  sayElements.forEach((el) => {
    const voice = el.getAttribute("voice") || "Polly.Joanna";
    const engine = el.getAttribute("engine") || "neural";
    const prosody = el.querySelector("prosody");
    const text = prosody ? prosody.textContent || "" : el.textContent || "";
    if (text.trim()) {
      saySteps.push({ voice: voice.replace("Polly.", ""), engine, text: text.trim() });
    }
  });

  const gather = doc.querySelector("Gather");
  const gatherAction = gather?.getAttribute("action") || null;
  const hintsStr = gather?.getAttribute("hints") || "";
  const gatherHints = hintsStr ? hintsStr.split(" ").filter(Boolean) : [];

  const redirect = doc.querySelector("Redirect");
  const redirectUrl = redirect?.textContent || null;

  const stream = doc.querySelector("Stream");
  const streamUrl = stream?.getAttribute("url") || null;

  const hangup = !!doc.querySelector("Hangup");

  const agentParam = stream?.querySelector('Parameter[name="agentId"]');
  const agentId = agentParam?.getAttribute("value") || null;

  const callIdParam = stream?.querySelector('Parameter[name="callId"]');
  const callId = callIdParam?.getAttribute("value") || null;

  return { saySteps, gatherAction, gatherHints, redirectUrl, streamUrl, hangup, agentId, callId };
}

type CallState = "idle" | "ivr" | "connecting" | "agent-ready" | "recording" | "processing" | "agent-speaking" | "ended";

interface TranscriptMessage {
  role: "user" | "agent" | "system";
  text: string;
  timestamp: Date;
}

export default function DeprockCallSimulator() {
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

  const { data: deptIvrConfigs } = useQuery({
    queryKey: ["/api/departments/ivr/all"],
  });
  const { data: deprockIvrConfigs } = useQuery({
    queryKey: ["/api/deprock/ivr-configs-all"],
  });

  const filteredIvrConfigs = [
    ...((deptIvrConfigs as any[]) || []),
    ...((deprockIvrConfigs as any[]) || []),
  ];

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, processingStage]);

  useEffect(() => {
    return () => {
      cleanupAll();
    };
  }, []);

  const cleanupAll = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    mediaRecorderRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (agentAudioRef.current) {
      agentAudioRef.current.pause();
      agentAudioRef.current = null;
    }
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    audioQueueRef.current = [];
    playingRef.current = false;
  }, []);

  const addTranscript = useCallback((role: "user" | "agent" | "system", text: string) => {
    setTranscript(prev => [...prev, { role, text, timestamp: new Date() }]);
  }, []);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    audioQueueRef.current = [];
    playingRef.current = false;
    setPlayingAudio(false);
    setCurrentAudioIndex(-1);
  }, []);

  const playAudioForStep = useCallback(
    async (step: TwimlStep, index: number): Promise<void> => {
      return new Promise((resolve, reject) => {
        setCurrentAudioIndex(index);
        setPlayingAudio(true);
        playingRef.current = true;

        const fetchAudio = async () => {
          try {
            const res = await apiRequest("POST", "/api/deprock/tts-preview", {
              voiceId: step.voice,
              text: step.text,
              engine: step.engine,
            });

            if (!playingRef.current) {
              resolve();
              return;
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);

            if (audioRef.current) {
              audioRef.current.src = url;
              audioRef.current.onended = () => {
                URL.revokeObjectURL(url);
                resolve();
              };
              audioRef.current.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error("Audio playback failed"));
              };
              audioRef.current.play().catch(reject);
            } else {
              resolve();
            }
          } catch (err) {
            reject(err);
          }
        };

        fetchAudio();
      });
    },
    []
  );

  const playAllSteps = useCallback(
    async (steps: TwimlStep[]) => {
      audioQueueRef.current = [...steps];
      for (let i = 0; i < steps.length; i++) {
        if (!playingRef.current && i > 0) break;
        try {
          await playAudioForStep(steps[i], i);
        } catch {
          break;
        }
      }
      setPlayingAudio(false);
      setCurrentAudioIndex(-1);
      playingRef.current = false;
    },
    [playAudioForStep]
  );

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
              if (msg.firstMessage) {
                addTranscript("agent", msg.firstMessage);
              }
              addTranscript("system", `Connected to ${msg.agentName || "AI Agent"}`);
              break;
            case "transcript":
              addTranscript(msg.role, msg.text);
              break;
            case "audio":
              setCallState("agent-speaking");
              setProcessingStage("");
              playAgentAudio(msg.data);
              break;
            case "processing":
              setProcessingStage(msg.stage);
              if (msg.stage === "transcribing") {
                setCallState("processing");
              }
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

      ws.onerror = () => {
        addTranscript("system", "Connection error occurred.");
        setCallState("agent-ready");
      };

      ws.onclose = () => {};

    } catch {
      addTranscript("system", "Failed to connect to agent.");
      setCallState("ivr");
    }
  }, [addTranscript]);

  const playAgentAudio = useCallback((base64Data: string) => {
    try {
      console.log(`[CallSim] Playing agent audio: ${base64Data.length} base64 chars`);
      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      console.log(`[CallSim] Audio decoded: ${bytes.length} bytes`);
      const audioBlob = new Blob([bytes], { type: "audio/mpeg" });
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      agentAudioRef.current = audio;
      audio.onended = () => {
        console.log(`[CallSim] Audio playback ended`);
        URL.revokeObjectURL(url);
        setCallState(prev => prev === "agent-speaking" ? "agent-ready" : prev);
      };
      audio.onerror = (e) => {
        console.error(`[CallSim] Audio playback error:`, e);
        URL.revokeObjectURL(url);
        setCallState(prev => prev === "agent-speaking" ? "agent-ready" : prev);
      };
      audio.play().then(() => {
        console.log(`[CallSim] Audio play started successfully`);
      }).catch((err) => {
        console.error(`[CallSim] Audio play failed:`, err);
        setCallState(prev => prev === "agent-speaking" ? "agent-ready" : prev);
      });
    } catch (err) {
      console.error(`[CallSim] Audio decode error:`, err);
      setCallState(prev => prev === "agent-speaking" ? "agent-ready" : prev);
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (callState !== "agent-ready") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        if (chunks.length === 0) {
          setCallState("agent-ready");
          stream.getTracks().forEach(t => t.stop());
          mediaStreamRef.current = null;
          return;
        }
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

      if (agentAudioRef.current) {
        agentAudioRef.current.pause();
        agentAudioRef.current = null;
      }
    } catch {
      addTranscript("system", "Microphone access denied. Please allow microphone access.");
    }
  }, [callState, addTranscript]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const simulateStep = useCallback(
    async (step: string, digits?: string, lang?: string) => {
      setLoading(true);
      try {
        const body: any = { step, ivrId: selectedIvrId };
        if (digits) body.digits = digits;
        if (lang) body.lang = lang;

        addTranscript("system", digits ? `Pressed ${digits}` : `Processing ${step}...`);

        const res = await apiRequest("POST", "/api/deprock/ivr-simulate", body);
        const twiml = await res.text();

        const parsed = parseTwiml(twiml);
        setParsedTwiml(parsed);
        setCurrentStep(step);

        if (parsed.streamUrl && parsed.agentId) {
          if (parsed.saySteps.length > 0) {
            await playAllSteps(parsed.saySteps);
          }
          connectToAgent(parsed.agentId, parsed.callId);
          return parsed;
        }

        if (parsed.hangup) {
          addTranscript("system", "Call ended by system.");
          setCallState("ended");
        }

        if (parsed.saySteps.length > 0) {
          await playAllSteps(parsed.saySteps);
        }

        return parsed;
      } catch (err: any) {
        addTranscript("system", `Error: ${err.message || "Failed to process"}`);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [selectedIvrId, addTranscript, playAllSteps, connectToAgent]
  );

  const startCall = useCallback(async () => {
    setCallState("ivr");
    setTranscript([]);
    setAgentName("");
    setCallDuration(0);
    setProcessingStage("");
    addTranscript("system", "Incoming call started...");
    await simulateStep("answer");
  }, [addTranscript, simulateStep]);

  const endCall = useCallback(() => {
    stopAudio();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try { wsRef.current.send(JSON.stringify({ type: "end" })); } catch {}
    }
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
  }, []);

  const handleDigitPress = useCallback(
    async (digit: string) => {
      stopAudio();

      if (digit === "0") {
        if (currentStep === "answer" || currentStep === "handle-language") {
          await simulateStep("answer");
        } else if (currentStep === "handle-selection") {
          await simulateStep("handle-language", "0");
        }
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
    },
    [currentStep, stopAudio, simulateStep, selectedIvrId, filteredIvrConfigs, selectedLang]
  );

  const activeConfigs = (filteredIvrConfigs || []).filter((c: any) => c.isActive);
  const currentHints = parsedTwiml?.gatherHints || [];
  const isInAgent = ["connecting", "agent-ready", "recording", "processing", "agent-speaking"].includes(callState);
  const isCallActive = callState !== "idle" && callState !== "ended";

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      <audio ref={audioRef} />

      <div className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/app">
              <Button variant="ghost" size="sm" data-testid="link-back">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </Link>
            <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />
            <Phone className="h-5 w-5 text-indigo-600" />
            <h1 className="text-lg font-semibold">IVR Call Simulator</h1>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {isInAgent && (
              <span className="text-sm text-muted-foreground font-mono" data-testid="text-call-timer">
                {formatDuration(callDuration)}
              </span>
            )}
            <Badge variant={getStatusVariant()} data-testid="badge-call-status">
              {callState === "recording" && <Mic className="h-3 w-3 mr-1" />}
              {callState === "connecting" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              {isInAgent && callState !== "connecting" && callState !== "recording" && <Wifi className="h-3 w-3 mr-1" />}
              {getStatusLabel()}
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">IVR Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  value={selectedIvrId}
                  onValueChange={setSelectedIvrId}
                  disabled={isCallActive}
                >
                  <SelectTrigger data-testid="select-ivr-config">
                    <SelectValue placeholder="Select IVR config..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeConfigs.map((config: any) => (
                      <SelectItem key={config.id} value={config.id}>
                        {config.name || "Unnamed IVR"} ({config.engineType === "bedrock-polly" ? "Deprock" : "Department"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {callState === "idle" && (
                  <Button
                    variant="default"
                    className="w-full bg-green-600 text-white border-green-700"
                    disabled={!selectedIvrId || loading}
                    onClick={startCall}
                    data-testid="button-start-call"
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Start Call
                  </Button>
                )}

                {callState === "ended" && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={resetCall}
                    data-testid="button-new-call"
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    New Call
                  </Button>
                )}

                {isCallActive && (
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={endCall}
                    data-testid="button-end-call"
                  >
                    <PhoneOff className="h-4 w-4 mr-2" />
                    End Call
                  </Button>
                )}
              </CardContent>
            </Card>

            {callState === "ivr" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Dial Pad</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map(
                      (digit) => {
                        const isHint = currentHints.includes(digit);
                        return (
                          <Button
                            key={digit}
                            variant={isHint ? "default" : "outline"}
                            className={`h-14 text-lg font-bold ${
                              isHint
                                ? "bg-indigo-600 text-white border-indigo-700"
                                : "opacity-40"
                            }`}
                            disabled={loading || !isHint}
                            onClick={() => handleDigitPress(digit)}
                            data-testid={`button-digit-${digit}`}
                          >
                            {digit}
                          </Button>
                        );
                      }
                    )}
                  </div>
                  {currentHints.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-3 text-center">
                      Available options: {currentHints.join(", ")}
                    </p>
                  )}
                  {playingAudio && (
                    <div className="flex items-center justify-center gap-2 mt-3 text-sm text-indigo-600">
                      <Volume2 className="h-4 w-4 animate-pulse" />
                      Playing IVR audio...
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {isInAgent && (
              <Card>
                <CardContent className="pt-6 space-y-5">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Bot className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">Agent</span>
                    </div>
                    <p className="text-lg font-semibold" data-testid="text-agent-name">
                      {agentName || "Connecting..."}
                    </p>
                    {isInAgent && (
                      <p className="text-xs text-muted-foreground mt-1 font-mono" data-testid="text-call-timer-panel">
                        {formatDuration(callDuration)}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-center gap-4">
                    <button
                      className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-200 select-none ${
                        callState === "recording"
                          ? "bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse scale-105"
                          : callState === "agent-ready"
                          ? "bg-indigo-600 text-white shadow-md cursor-pointer"
                          : "bg-muted text-muted-foreground cursor-not-allowed"
                      }`}
                      onMouseDown={() => {
                        if (callState === "agent-ready") startRecording();
                      }}
                      onMouseUp={() => {
                        if (callState === "recording") stopRecording();
                      }}
                      onMouseLeave={() => {
                        if (callState === "recording") stopRecording();
                      }}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        if (callState === "agent-ready") startRecording();
                      }}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        if (callState === "recording") stopRecording();
                      }}
                      disabled={callState !== "agent-ready" && callState !== "recording"}
                      data-testid="button-push-to-talk"
                    >
                      {callState === "recording" ? (
                        <MicOff className="h-10 w-10" />
                      ) : (
                        <Mic className="h-10 w-10" />
                      )}
                    </button>

                    <p className="text-xs text-muted-foreground text-center">
                      {callState === "recording"
                        ? "Release to send"
                        : callState === "agent-ready"
                        ? "Hold to talk"
                        : callState === "connecting"
                        ? "Connecting..."
                        : callState === "agent-speaking"
                        ? "Agent is speaking..."
                        : "Processing..."}
                    </p>
                  </div>

                  {processingStage && (
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground" data-testid="text-processing-stage">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {processingStage === "transcribing" && "Transcribing..."}
                      {processingStage === "thinking" && "Thinking..."}
                      {processingStage === "speaking" && "Generating speech..."}
                    </div>
                  )}

                  {callState === "agent-speaking" && (
                    <div className="flex items-center justify-center gap-2 text-sm text-indigo-600 dark:text-indigo-400">
                      <Volume2 className="h-4 w-4 animate-pulse" />
                      Agent speaking...
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="lg:col-span-2">
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3 flex-wrap">
                <CardTitle className="text-sm font-medium">
                  {isInAgent ? "Conversation" : "Call Flow"}
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  {loading && (
                    <Badge variant="outline" className="gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading...
                    </Badge>
                  )}
                  {isInAgent && (
                    <Badge variant="outline" className="gap-1">
                      <Wifi className="h-3 w-3" />
                      Live
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                  {transcript.length === 0 && (
                    <div className="text-center py-16 text-muted-foreground">
                      <Phone className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p>Select an IVR configuration and press Start Call</p>
                      <p className="text-xs mt-1">
                        Navigate the IVR menu, then talk to the AI agent
                      </p>
                    </div>
                  )}
                  {transcript.map((msg, idx) => {
                    if (msg.role === "system") {
                      return (
                        <div
                          key={idx}
                          className="flex justify-center"
                          data-testid={`transcript-message-${idx}`}
                        >
                          <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                            {msg.text}
                          </span>
                        </div>
                      );
                    }

                    const isUser = msg.role === "user";
                    return (
                      <div
                        key={idx}
                        className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                        data-testid={`transcript-message-${idx}`}
                      >
                        <div className={`flex items-start gap-2 max-w-[80%] ${isUser ? "flex-row-reverse" : ""}`}>
                          <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                            isUser
                              ? "bg-indigo-100 dark:bg-indigo-900/50"
                              : "bg-gray-100 dark:bg-gray-800"
                          }`}>
                            {isUser ? (
                              <User className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                            ) : (
                              <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </div>
                          <div className={`rounded-lg px-3 py-2 text-sm ${
                            isUser
                              ? "bg-indigo-600 text-white"
                              : "bg-muted text-foreground"
                          }`}>
                            {msg.text}
                            <div className={`text-[10px] mt-1 ${
                              isUser ? "text-indigo-200" : "text-muted-foreground"
                            }`}>
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
                        {processingStage === "transcribing" && "Transcribing your message..."}
                        {processingStage === "thinking" && "Agent is thinking..."}
                        {processingStage === "speaking" && "Generating response..."}
                      </div>
                    </div>
                  )}

                  <div ref={transcriptEndRef} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
