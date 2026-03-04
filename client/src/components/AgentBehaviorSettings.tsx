import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Settings2, MessageSquare } from "lucide-react";

interface BehaviorConfig {
  softTimeoutSec?: number;
  hardTimeoutSec?: number;
  silenceTimeoutSec?: number;
  maxQuestionsPerTurn?: number;
  useDiscourseMarkers?: boolean;
  recognitionRetryMax?: number;
  vadSilenceTimeoutMs?: number;
  vadThreshold?: number;
  callbackTimeoutHour?: number;
}

interface AgentBehaviorSettingsProps {
  behaviorConfig: BehaviorConfig;
  waitingMessages: string[];
  onBehaviorConfigChange: (config: BehaviorConfig) => void;
  onWaitingMessagesChange: (messages: string[]) => void;
}

const DEFAULT_WAITING_MESSAGES = [
  "Just a moment, I'm looking into that for you.",
  "Please hold on while I check that information.",
  "One moment please, I'm processing your request.",
];

export default function AgentBehaviorSettings({
  behaviorConfig,
  waitingMessages,
  onBehaviorConfigChange,
  onWaitingMessagesChange,
}: AgentBehaviorSettingsProps) {
  const config = {
    softTimeoutSec: behaviorConfig.softTimeoutSec ?? 4,
    hardTimeoutSec: behaviorConfig.hardTimeoutSec ?? 15,
    silenceTimeoutSec: behaviorConfig.silenceTimeoutSec ?? 20,
    maxQuestionsPerTurn: behaviorConfig.maxQuestionsPerTurn ?? 2,
    useDiscourseMarkers: behaviorConfig.useDiscourseMarkers ?? true,
    recognitionRetryMax: behaviorConfig.recognitionRetryMax ?? 3,
    vadSilenceTimeoutMs: behaviorConfig.vadSilenceTimeoutMs ?? 500,
    vadThreshold: behaviorConfig.vadThreshold ?? 0.5,
    callbackTimeoutHour: behaviorConfig.callbackTimeoutHour ?? 3,
  };

  const updateConfig = (key: keyof BehaviorConfig, value: number | boolean) => {
    onBehaviorConfigChange({ ...behaviorConfig, [key]: value });
  };

  const displayMessages = waitingMessages.length > 0 ? waitingMessages : DEFAULT_WAITING_MESSAGES;

  const handleMessageChange = (index: number, value: string) => {
    const msgs = [...(waitingMessages.length > 0 ? waitingMessages : DEFAULT_WAITING_MESSAGES)];
    msgs[index] = value;
    onWaitingMessagesChange(msgs);
  };

  const handleAddMessage = () => {
    const msgs = [...(waitingMessages.length > 0 ? waitingMessages : DEFAULT_WAITING_MESSAGES)];
    msgs.push("");
    onWaitingMessagesChange(msgs);
  };

  const handleRemoveMessage = (index: number) => {
    const msgs = [...(waitingMessages.length > 0 ? waitingMessages : DEFAULT_WAITING_MESSAGES)];
    msgs.splice(index, 1);
    onWaitingMessagesChange(msgs);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings2 className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-base font-semibold">Behavior Settings</h3>
      </div>
      <p className="text-sm text-muted-foreground -mt-4">
        Fine-tune how your agent handles timing, speech recognition, and conversation flow.
      </p>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-medium">Timeout Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <Label className="text-sm">Soft Timeout (seconds)</Label>
                <p className="text-xs text-muted-foreground">Time before sending a "please wait" message</p>
              </div>
              <span className="text-sm font-medium tabular-nums w-8 text-right" data-testid="text-soft-timeout-value">{config.softTimeoutSec}s</span>
            </div>
            <Slider
              min={2}
              max={10}
              step={1}
              value={[config.softTimeoutSec]}
              onValueChange={([v]) => updateConfig("softTimeoutSec", v)}
              data-testid="slider-soft-timeout"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <Label className="text-sm">Hard Timeout (seconds)</Label>
                <p className="text-xs text-muted-foreground">Time before aborting LLM response</p>
              </div>
              <span className="text-sm font-medium tabular-nums w-8 text-right" data-testid="text-hard-timeout-value">{config.hardTimeoutSec}s</span>
            </div>
            <Slider
              min={10}
              max={30}
              step={1}
              value={[config.hardTimeoutSec]}
              onValueChange={([v]) => updateConfig("hardTimeoutSec", v)}
              data-testid="slider-hard-timeout"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <Label className="text-sm">Silence Timeout (seconds)</Label>
                <p className="text-xs text-muted-foreground">Warn caller after this much silence</p>
              </div>
              <span className="text-sm font-medium tabular-nums w-8 text-right" data-testid="text-silence-timeout-value">{config.silenceTimeoutSec}s</span>
            </div>
            <Slider
              min={10}
              max={60}
              step={1}
              value={[config.silenceTimeoutSec]}
              onValueChange={([v]) => updateConfig("silenceTimeoutSec", v)}
              data-testid="slider-silence-timeout"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <Label className="text-sm">Callback Timeout (hours)</Label>
                <p className="text-xs text-muted-foreground">Hours before conversation cannot be resumed</p>
              </div>
              <span className="text-sm font-medium tabular-nums w-8 text-right" data-testid="text-callback-timeout-value">{config.callbackTimeoutHour}h</span>
            </div>
            <Slider
              min={0}
              max={24}
              step={1}
              value={[config.callbackTimeoutHour]}
              onValueChange={([v]) => updateConfig("callbackTimeoutHour", v)}
              data-testid="slider-callback-timeout"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-medium">Conversation Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <Label className="text-sm">Max Questions Per Turn</Label>
                <p className="text-xs text-muted-foreground">Maximum questions to ask at once</p>
              </div>
              <span className="text-sm font-medium tabular-nums w-8 text-right" data-testid="text-max-questions-value">{config.maxQuestionsPerTurn}</span>
            </div>
            <Slider
              min={1}
              max={5}
              step={1}
              value={[config.maxQuestionsPerTurn]}
              onValueChange={([v]) => updateConfig("maxQuestionsPerTurn", v)}
              data-testid="slider-max-questions"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <Label className="text-sm">Use Natural Speech Fillers</Label>
              <p className="text-xs text-muted-foreground">Add discourse markers for natural conversation</p>
            </div>
            <Switch
              checked={config.useDiscourseMarkers}
              onCheckedChange={(checked) => updateConfig("useDiscourseMarkers", checked)}
              data-testid="switch-discourse-markers"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-medium">Voice Activity Detection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <Label className="text-sm">Recognition Retries</Label>
                <p className="text-xs text-muted-foreground">Voice recognition retry attempts</p>
              </div>
              <span className="text-sm font-medium tabular-nums w-8 text-right" data-testid="text-recognition-retries-value">{config.recognitionRetryMax}</span>
            </div>
            <Slider
              min={1}
              max={5}
              step={1}
              value={[config.recognitionRetryMax]}
              onValueChange={([v]) => updateConfig("recognitionRetryMax", v)}
              data-testid="slider-recognition-retries"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <Label className="text-sm">VAD Silence Timeout (ms)</Label>
                <p className="text-xs text-muted-foreground">Milliseconds of silence before end-of-speech detection</p>
              </div>
              <span className="text-sm font-medium tabular-nums w-16 text-right" data-testid="text-vad-silence-value">{config.vadSilenceTimeoutMs}ms</span>
            </div>
            <Slider
              min={200}
              max={2000}
              step={50}
              value={[config.vadSilenceTimeoutMs]}
              onValueChange={([v]) => updateConfig("vadSilenceTimeoutMs", v)}
              data-testid="slider-vad-silence"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <Label className="text-sm">VAD Threshold</Label>
                <p className="text-xs text-muted-foreground">Voice activity detection sensitivity (lower = more sensitive)</p>
              </div>
              <span className="text-sm font-medium tabular-nums w-10 text-right" data-testid="text-vad-threshold-value">{config.vadThreshold.toFixed(1)}</span>
            </div>
            <Slider
              min={0.1}
              max={1.0}
              step={0.1}
              value={[config.vadThreshold]}
              onValueChange={([v]) => updateConfig("vadThreshold", Math.round(v * 10) / 10)}
              data-testid="slider-vad-threshold"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Waiting Messages</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddMessage}
              data-testid="button-add-waiting-message"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Message
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Messages sent to the caller when the AI is taking longer than the soft timeout to respond.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {displayMessages.map((msg, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={msg}
                onChange={(e) => handleMessageChange(index, e.target.value)}
                placeholder="Enter a waiting message..."
                data-testid={`input-waiting-message-${index}`}
              />
              {displayMessages.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveMessage(index)}
                  data-testid={`button-remove-waiting-message-${index}`}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
