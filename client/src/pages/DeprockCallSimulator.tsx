import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Phone,
  PhoneOff,
  Volume2,
  Loader2,
  RotateCcw,
  ArrowLeft,
  Hash,
  Play,
  Square,
  ChevronRight,
} from "lucide-react";
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

  return { saySteps, gatherAction, gatherHints, redirectUrl, streamUrl, hangup, agentId };
}

interface CallLog {
  id: number;
  step: string;
  action: string;
  details: string;
  timestamp: Date;
}

export default function DeprockCallSimulator() {
  const [selectedIvrId, setSelectedIvrId] = useState<string>("");
  const [callActive, setCallActive] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>("idle");
  const [parsedTwiml, setParsedTwiml] = useState<ParsedTwiml | null>(null);
  const [loading, setLoading] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(false);
  const [currentAudioIndex, setCurrentAudioIndex] = useState(-1);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [selectedLang, setSelectedLang] = useState<string>("en");
  const [connectedAgent, setConnectedAgent] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const logIdRef = useRef(0);
  const audioQueueRef = useRef<TwimlStep[]>([]);
  const playingRef = useRef(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const { data: ivrConfigs } = useQuery({
    queryKey: ["/api/deprock/ivr-configs"],
  });

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [callLogs]);

  const addLog = useCallback((step: string, action: string, details: string) => {
    logIdRef.current += 1;
    setCallLogs((prev) => [
      ...prev,
      { id: logIdRef.current, step, action, details, timestamp: new Date() },
    ]);
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
          addLog("Audio", "Playing", `${steps[i].voice}: "${steps[i].text.substring(0, 60)}..."`);
          await playAudioForStep(steps[i], i);
        } catch {
          break;
        }
      }
      setPlayingAudio(false);
      setCurrentAudioIndex(-1);
      playingRef.current = false;
    },
    [playAudioForStep, addLog]
  );

  const simulateStep = useCallback(
    async (step: string, digits?: string, lang?: string) => {
      setLoading(true);
      try {
        const body: any = { step, ivrId: selectedIvrId };
        if (digits) body.digits = digits;
        if (lang) body.lang = lang;

        addLog(step, digits ? `Pressed ${digits}` : "Request", `Calling ${step}...`);

        const res = await apiRequest("POST", "/api/deprock/ivr-simulate", body);
        const twiml = await res.text();

        const parsed = parseTwiml(twiml);
        setParsedTwiml(parsed);
        setCurrentStep(step);

        if (parsed.streamUrl && parsed.agentId) {
          setConnectedAgent(parsed.agentId);
          addLog(step, "Connected", `Agent connected: ${parsed.agentId}`);
        }

        if (parsed.hangup) {
          addLog(step, "Hangup", "Call ended by system");
        }

        if (parsed.saySteps.length > 0) {
          const gatherSays = parsed.saySteps;
          await playAllSteps(gatherSays);
        }

        return parsed;
      } catch (err: any) {
        addLog(step, "Error", err.message || "Failed to simulate step");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [selectedIvrId, addLog, playAllSteps]
  );

  const startCall = useCallback(async () => {
    setCallActive(true);
    setCallLogs([]);
    setConnectedAgent(null);
    logIdRef.current = 0;
    addLog("System", "Call Started", "Simulating incoming call...");
    await simulateStep("answer");
  }, [addLog, simulateStep]);

  const endCall = useCallback(() => {
    stopAudio();
    setCallActive(false);
    setCurrentStep("idle");
    setParsedTwiml(null);
    setConnectedAgent(null);
    addLog("System", "Call Ended", "Call terminated by user");
  }, [stopAudio, addLog]);

  const handleDigitPress = useCallback(
    async (digit: string) => {
      stopAudio();

      if (digit === "0") {
        if (currentStep === "answer" || currentStep === "handle-language") {
          addLog("Input", `Pressed 0`, "Repeating options...");
          await simulateStep("answer");
        } else if (currentStep === "handle-selection") {
          addLog("Input", `Pressed 0`, "Going back to language menu...");
          await simulateStep("handle-language", "0");
        }
        return;
      }

      if (currentStep === "answer") {
        const ivrConfig = (ivrConfigs as any[])?.find((c: any) => c.id === selectedIvrId);
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
    [currentStep, stopAudio, simulateStep, selectedIvrId, ivrConfigs, selectedLang, addLog]
  );

  const activeConfigs = ((ivrConfigs as any[]) || []).filter(
    (c: any) => c.isActive && c.engineType === "bedrock-polly"
  );

  const currentHints = parsedTwiml?.gatherHints || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      <audio ref={audioRef} />

      <div className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/app/deprock">
              <Button variant="ghost" size="sm" data-testid="link-back-deprock">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </Link>
            <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />
            <Phone className="h-5 w-5 text-indigo-600" />
            <h1 className="text-lg font-semibold">IVR Call Simulator</h1>
          </div>
          <Badge variant={callActive ? "default" : "secondary"} data-testid="badge-call-status">
            {callActive ? (connectedAgent ? "Connected to Agent" : "Call Active") : "Idle"}
          </Badge>
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
                  disabled={callActive}
                >
                  <SelectTrigger data-testid="select-ivr-config">
                    <SelectValue placeholder="Select IVR config..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeConfigs.map((config: any) => (
                      <SelectItem key={config.id} value={config.id}>
                        {config.name || "Unnamed IVR"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {!callActive ? (
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700"
                    disabled={!selectedIvrId || loading}
                    onClick={startCall}
                    data-testid="button-start-call"
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Start Call
                  </Button>
                ) : (
                  <Button
                    className="w-full bg-red-600 hover:bg-red-700"
                    onClick={endCall}
                    data-testid="button-end-call"
                  >
                    <PhoneOff className="h-4 w-4 mr-2" />
                    End Call
                  </Button>
                )}
              </CardContent>
            </Card>

            {callActive && !connectedAgent && (
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
                                ? "bg-indigo-600 hover:bg-indigo-700 text-white ring-2 ring-indigo-300"
                                : "opacity-40"
                            }`}
                            disabled={loading || playingAudio || !isHint}
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
                </CardContent>
              </Card>
            )}

            {connectedAgent && (
              <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
                <CardContent className="pt-6 text-center space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                    <Volume2 className="h-8 w-8 text-green-600 animate-pulse" />
                  </div>
                  <p className="font-semibold text-green-700 dark:text-green-400">
                    Connected to AI Agent
                  </p>
                  <p className="text-xs text-muted-foreground">
                    In a real call, you would now be speaking with the AI agent.
                  </p>
                  <Button variant="outline" size="sm" onClick={endCall} data-testid="button-end-agent-call">
                    <PhoneOff className="h-3 w-3 mr-1" />
                    End Call
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Call Flow Log</CardTitle>
                <div className="flex items-center gap-2">
                  {playingAudio && (
                    <Badge variant="outline" className="gap-1 text-indigo-600 border-indigo-200">
                      <Volume2 className="h-3 w-3 animate-pulse" />
                      Playing audio...
                    </Badge>
                  )}
                  {loading && (
                    <Badge variant="outline" className="gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Processing...
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                  {callLogs.length === 0 && (
                    <div className="text-center py-16 text-muted-foreground">
                      <Phone className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p>Select an IVR configuration and press Start Call</p>
                      <p className="text-xs mt-1">
                        You'll hear the exact Polly voices and step through the IVR flow
                      </p>
                    </div>
                  )}
                  {callLogs.map((log, idx) => (
                    <div
                      key={log.id}
                      className={`flex items-start gap-3 p-3 rounded-lg text-sm ${
                        log.action === "Error"
                          ? "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800"
                          : log.action === "Connected"
                          ? "bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800"
                          : log.action === "Playing"
                          ? "bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900"
                          : log.step === "System"
                          ? "bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
                          : "bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
                      }`}
                      data-testid={`log-entry-${log.id}`}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {log.action === "Playing" ? (
                          <Volume2
                            className={`h-4 w-4 text-indigo-500 ${
                              playingAudio && idx === callLogs.length - 1 ? "animate-pulse" : ""
                            }`}
                          />
                        ) : log.action.startsWith("Pressed") ? (
                          <Hash className="h-4 w-4 text-amber-500" />
                        ) : log.action === "Connected" ? (
                          <Play className="h-4 w-4 text-green-500" />
                        ) : log.action === "Error" ? (
                          <Square className="h-4 w-4 text-red-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0"
                          >
                            {log.step}
                          </Badge>
                          <span className="font-medium text-xs">{log.action}</span>
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {log.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 break-all">
                          {log.details}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
