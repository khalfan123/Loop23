import { Trash2, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type BuilderStepForProps = {
  id: string;
  order: number;
  type: "trigger" | "action";
  appId: string | null;
  actionId: string | null;
  label: string;
  config: Record<string, unknown>;
};

type Props = {
  step: BuilderStepForProps;
  stepIndex: number;
  triggers?: Array<{ id: string; name: string }>;
  apps?: Array<{ id: string; name: string }>;
  icon?: LucideIcon | null;
  nodeTypeLabel?: string | null;
  onClose: () => void;
  onDelete?: () => void;
  onChangeLabel: (label: string) => void;
  onChangeTrigger?: (triggerId: string) => void;
  onChangeApp?: (appId: string, appName: string) => void;
  onChangeConfig: (patch: Record<string, unknown>) => void;
  onOpenPicker?: () => void;
  canDelete?: boolean;
  /** When an app is selected, whether the user's account is connected to it. */
  appConnectionStatus?: "connected" | "disconnected" | null;
  onConnectApp?: () => void;
};

function str(config: Record<string, unknown>, key: string, fallback = "") {
  const v = config[key];
  return typeof v === "string" ? v : fallback;
}

function num(config: Record<string, unknown>, key: string, fallback: number) {
  const v = config[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function bool(config: Record<string, unknown>, key: string, fallback: boolean) {
  const v = config[key];
  return typeof v === "boolean" ? v : fallback;
}

export function BuilderNodeProperties({
  step,
  stepIndex,
  triggers = [],
  apps = [],
  icon: Icon,
  nodeTypeLabel,
  onClose,
  onDelete,
  onChangeLabel,
  onChangeTrigger,
  onChangeApp,
  onChangeConfig,
  onOpenPicker,
  canDelete = true,
  appConnectionStatus = null,
  onConnectApp,
}: Props) {
  const nodeType =
    typeof step.config.nodeType === "string" ? step.config.nodeType : null;

  return (
    <aside
      className="w-[300px] shrink-0 border-l border-border/60 bg-white dark:bg-zinc-900 flex flex-col"
      data-testid="builder-node-properties"
    >
      <div className="h-12 px-3 flex items-center justify-between border-b border-border/50 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {Icon ? <Icon className="h-4 w-4 shrink-0 text-foreground" /> : null}
          <h3 className="text-sm font-semibold truncate">Node Properties</h3>
        </div>
        <div className="flex items-center gap-0.5">
          {canDelete && onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onDelete}
              data-testid="button-delete-node"
              title="Delete step"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
            data-testid="button-close-properties"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="secondary"
              className={cn(
                "text-[10px] uppercase tracking-wide",
                step.type === "trigger"
                  ? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
                  : "bg-violet-500/10 text-violet-700 dark:text-violet-300",
              )}
            >
              {step.type === "trigger" ? "Trigger" : "Action"}
            </Badge>
            {nodeTypeLabel && (
              <Badge variant="outline" className="text-[10px]">
                {nodeTypeLabel}
              </Badge>
            )}
            <span className="text-[11px] text-muted-foreground">Step {stepIndex + 1}</span>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Node ID</Label>
            <div className="text-[12px] font-mono bg-muted/50 px-2 py-1.5 rounded mt-1 break-all">
              {step.id}
            </div>
          </div>

          <div>
            <Label htmlFor="node-label" className="text-xs">
              Label
            </Label>
            <Input
              id="node-label"
              value={step.label}
              onChange={(e) => onChangeLabel(e.target.value)}
              className="mt-1 h-9"
              data-testid="input-node-label"
            />
          </div>

          {step.type === "trigger" && (
            <div>
              <Label className="text-xs">Trigger event</Label>
              <Select
                value={step.actionId || ""}
                onValueChange={(v) => onChangeTrigger?.(v)}
              >
                <SelectTrigger className="mt-1 h-9" data-testid="select-node-trigger">
                  <SelectValue placeholder="Select event…" />
                </SelectTrigger>
                <SelectContent>
                  {triggers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {onOpenPicker && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1.5 h-7 px-2 text-xs"
                  onClick={onOpenPicker}
                  data-testid="button-browse-triggers"
                >
                  Browse triggers…
                </Button>
              )}
            </div>
          )}

          {step.type === "action" && !nodeType && (
            <div>
              <Label className="text-xs">App</Label>
              <Select
                value={step.appId || ""}
                onValueChange={(v) => {
                  const app = apps.find((a) => a.id === v);
                  onChangeApp?.(v, app?.name || v);
                }}
              >
                <SelectTrigger className="mt-1 h-9" data-testid="select-node-app">
                  <SelectValue placeholder="Select app…" />
                </SelectTrigger>
                <SelectContent>
                  {apps.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {step.appId && appConnectionStatus && (
                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                  <Badge
                    variant={appConnectionStatus === "connected" ? "secondary" : "outline"}
                    className={cn(
                      "text-[10px]",
                      appConnectionStatus === "connected"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                        : "text-amber-700 dark:text-amber-300 border-amber-500/30",
                    )}
                    data-testid="badge-app-connection"
                  >
                    {appConnectionStatus === "connected" ? "Connected" : "Not connected"}
                  </Badge>
                  {appConnectionStatus === "disconnected" && onConnectApp && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[10px]"
                      onClick={onConnectApp}
                      data-testid="button-connect-app"
                    >
                      Connect
                    </Button>
                  )}
                </div>
              )}
              {onOpenPicker && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1.5 h-7 px-2 text-xs"
                  onClick={onOpenPicker}
                  data-testid="button-browse-apps"
                >
                  Browse apps…
                </Button>
              )}
            </div>
          )}

          {nodeType === "message" && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="cfg-message" className="text-xs">
                  Message
                </Label>
                <Textarea
                  id="cfg-message"
                  value={str(step.config, "message")}
                  onChange={(e) => onChangeConfig({ message: e.target.value })}
                  placeholder="What should be said or sent…"
                  className="mt-1"
                  data-testid="input-node-message"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="cfg-wait"
                  checked={bool(step.config, "waitForResponse", false)}
                  onCheckedChange={(c) => onChangeConfig({ waitForResponse: !!c })}
                  data-testid="checkbox-node-wait"
                />
                <Label htmlFor="cfg-wait" className="text-sm font-normal cursor-pointer">
                  Wait for response
                </Label>
              </div>
            </div>
          )}

          {nodeType === "question" && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="cfg-question" className="text-xs">
                  Question
                </Label>
                <Textarea
                  id="cfg-question"
                  value={str(step.config, "question")}
                  onChange={(e) => onChangeConfig({ question: e.target.value })}
                  placeholder="Ask the caller…"
                  className="mt-1"
                  data-testid="input-node-question"
                />
              </div>
              <div>
                <Label htmlFor="cfg-var" className="text-xs">
                  Save answer as
                </Label>
                <Input
                  id="cfg-var"
                  value={str(step.config, "variableName")}
                  onChange={(e) => onChangeConfig({ variableName: e.target.value })}
                  placeholder="e.g. caller_name"
                  className="mt-1 h-9"
                  data-testid="input-node-variable"
                />
              </div>
            </div>
          )}

          {nodeType === "condition" && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="cfg-condition" className="text-xs">
                  Condition
                </Label>
                <Textarea
                  id="cfg-condition"
                  value={str(step.config, "condition")}
                  onChange={(e) => onChangeConfig({ condition: e.target.value })}
                  placeholder='e.g. status == "qualified"'
                  className="mt-1"
                  data-testid="input-node-condition"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Continue only when this expression is true.
                </p>
              </div>
            </div>
          )}

          {nodeType === "delay" && (
            <div>
              <Label htmlFor="cfg-duration" className="text-xs">
                Delay (seconds)
              </Label>
              <Input
                id="cfg-duration"
                type="number"
                min={0}
                step={1}
                value={num(step.config, "duration", 5)}
                onChange={(e) =>
                  onChangeConfig({ duration: Math.max(0, Number(e.target.value) || 0) })
                }
                className="mt-1 h-9"
                data-testid="input-node-duration"
              />
            </div>
          )}

          {nodeType === "webhook" && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="cfg-url" className="text-xs">
                  Webhook URL
                </Label>
                <Input
                  id="cfg-url"
                  value={str(step.config, "webhookUrl")}
                  onChange={(e) => onChangeConfig({ webhookUrl: e.target.value })}
                  placeholder="https://…"
                  className="mt-1 h-9"
                  data-testid="input-node-webhook-url"
                />
              </div>
              <div>
                <Label className="text-xs">Method</Label>
                <Select
                  value={str(step.config, "method", "POST")}
                  onValueChange={(v) => onChangeConfig({ method: v })}
                >
                  <SelectTrigger className="mt-1 h-9" data-testid="select-node-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["POST", "GET", "PUT", "PATCH"].map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {nodeType === "transfer" && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Transfer type</Label>
                <Select
                  value={str(step.config, "transferType", "phone")}
                  onValueChange={(v) => onChangeConfig({ transferType: v })}
                >
                  <SelectTrigger className="mt-1 h-9" data-testid="select-node-transfer-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">Phone number</SelectItem>
                    <SelectItem value="agent">Agent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {str(step.config, "transferType", "phone") !== "agent" ? (
                <div>
                  <Label htmlFor="cfg-phone" className="text-xs">
                    Phone number
                  </Label>
                  <Input
                    id="cfg-phone"
                    value={str(step.config, "phoneNumber")}
                    onChange={(e) => onChangeConfig({ phoneNumber: e.target.value })}
                    placeholder="+1…"
                    className="mt-1 h-9"
                    data-testid="input-node-phone"
                  />
                </div>
              ) : (
                <div>
                  <Label htmlFor="cfg-agent" className="text-xs">
                    Agent ID
                  </Label>
                  <Input
                    id="cfg-agent"
                    value={str(step.config, "transferAgentId")}
                    onChange={(e) => onChangeConfig({ transferAgentId: e.target.value })}
                    placeholder="Agent id"
                    className="mt-1 h-9"
                    data-testid="input-node-agent"
                  />
                </div>
              )}
            </div>
          )}

          {nodeType === "play_audio" && (
            <div>
              <Label htmlFor="cfg-audio" className="text-xs">
                Audio URL
              </Label>
              <Input
                id="cfg-audio"
                value={str(step.config, "audioUrl")}
                onChange={(e) => onChangeConfig({ audioUrl: e.target.value })}
                placeholder="https://…/clip.mp3"
                className="mt-1 h-9"
                data-testid="input-node-audio-url"
              />
            </div>
          )}

          {nodeType === "form" && (
            <div>
              <Label htmlFor="cfg-form" className="text-xs">
                Form ID
              </Label>
              <Input
                id="cfg-form"
                value={str(step.config, "formId")}
                onChange={(e) => onChangeConfig({ formId: e.target.value })}
                placeholder="Form id"
                className="mt-1 h-9"
                data-testid="input-node-form-id"
              />
            </div>
          )}

          {nodeType === "appointment" && (
            <div>
              <Label htmlFor="cfg-appt" className="text-xs">
                Appointment type
              </Label>
              <Input
                id="cfg-appt"
                value={str(step.config, "appointmentType")}
                onChange={(e) => onChangeConfig({ appointmentType: e.target.value })}
                placeholder="e.g. consult"
                className="mt-1 h-9"
                data-testid="input-node-appointment-type"
              />
            </div>
          )}

          {nodeType === "end" && (
            <div>
              <Label htmlFor="cfg-end" className="text-xs">
                End message
              </Label>
              <Textarea
                id="cfg-end"
                value={str(step.config, "endMessage")}
                onChange={(e) => onChangeConfig({ endMessage: e.target.value })}
                placeholder="Thanks for calling…"
                className="mt-1"
                data-testid="input-node-end-message"
              />
            </div>
          )}

          {step.type === "action" && !nodeType && step.appId && (
            <div>
              <Label htmlFor="cfg-notes" className="text-xs">
                Notes
              </Label>
              <Textarea
                id="cfg-notes"
                value={str(step.config, "notes")}
                onChange={(e) => onChangeConfig({ notes: e.target.value })}
                placeholder="Optional mapping notes for this app action…"
                className="mt-1"
                data-testid="input-node-notes"
              />
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
