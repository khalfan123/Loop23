import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShieldCheck,
  ListChecks,
  Plus,
  X,
  GripVertical,
  AlertTriangle,
  Ban,
  FileCheck,
} from "lucide-react";

interface AgentAssistConfig {
  enabled?: boolean;
  sensitivity?: "low" | "medium" | "high";
  complianceRules?: {
    requiredPhrases?: string[];
    bannedPhrases?: string[];
    disclosures?: string[];
  };
  requiredSteps?: Array<{
    id: string;
    name: string;
    description: string;
    order: number;
  }>;
}

interface AgentAssistSettingsProps {
  config: AgentAssistConfig;
  onChange: (config: AgentAssistConfig) => void;
}

export default function AgentAssistSettings({ config, onChange }: AgentAssistSettingsProps) {
  const [newRequiredPhrase, setNewRequiredPhrase] = useState("");
  const [newBannedPhrase, setNewBannedPhrase] = useState("");
  const [newDisclosure, setNewDisclosure] = useState("");
  const [newStepName, setNewStepName] = useState("");
  const [newStepDesc, setNewStepDesc] = useState("");

  const enabled = config.enabled ?? false;
  const sensitivity = config.sensitivity ?? "medium";
  const complianceRules = config.complianceRules ?? {};
  const requiredPhrases = complianceRules.requiredPhrases ?? [];
  const bannedPhrases = complianceRules.bannedPhrases ?? [];
  const disclosures = complianceRules.disclosures ?? [];
  const requiredSteps = config.requiredSteps ?? [];

  const updateConfig = (updates: Partial<AgentAssistConfig>) => {
    onChange({ ...config, ...updates });
  };

  const updateComplianceRules = (updates: Partial<typeof complianceRules>) => {
    updateConfig({
      complianceRules: { ...complianceRules, ...updates },
    });
  };

  const addPhrase = (
    type: "requiredPhrases" | "bannedPhrases" | "disclosures",
    value: string,
    setter: (v: string) => void
  ) => {
    if (!value.trim()) return;
    const current = complianceRules[type] ?? [];
    if (current.includes(value.trim())) return;
    updateComplianceRules({ [type]: [...current, value.trim()] });
    setter("");
  };

  const removePhrase = (
    type: "requiredPhrases" | "bannedPhrases" | "disclosures",
    index: number
  ) => {
    const current = complianceRules[type] ?? [];
    updateComplianceRules({ [type]: current.filter((_, i) => i !== index) });
  };

  const addStep = () => {
    if (!newStepName.trim()) return;
    const newStep = {
      id: crypto.randomUUID(),
      name: newStepName.trim(),
      description: newStepDesc.trim(),
      order: requiredSteps.length + 1,
    };
    updateConfig({ requiredSteps: [...requiredSteps, newStep] });
    setNewStepName("");
    setNewStepDesc("");
  };

  const removeStep = (id: string) => {
    const updated = requiredSteps
      .filter((s) => s.id !== id)
      .map((s, i) => ({ ...s, order: i + 1 }));
    updateConfig({ requiredSteps: updated });
  };

  return (
    <Card className="glass-card" data-testid="card-agent-assist-settings">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Agent Assist</CardTitle>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(v) => updateConfig({ enabled: v })}
            data-testid="switch-agent-assist-enabled"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Real-time compliance monitoring, step tracking, and smart suggestions during calls
        </p>
      </CardHeader>

      {enabled && (
        <CardContent className="space-y-5 pt-0">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Intervention Sensitivity</Label>
            <Select
              value={sensitivity}
              onValueChange={(v) =>
                updateConfig({ sensitivity: v as "low" | "medium" | "high" })
              }
            >
              <SelectTrigger data-testid="select-sensitivity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low — Only critical compliance issues</SelectItem>
                <SelectItem value="medium">Medium — Compliance + missed steps</SelectItem>
                <SelectItem value="high">High — All issues including sentiment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-green-500" />
              <Label className="text-sm font-medium">Required Phrases</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Phrases the agent must say during each call
            </p>
            <div className="flex flex-wrap gap-1.5">
              {requiredPhrases.map((phrase, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="gap-1 pr-1"
                  data-testid={`badge-required-phrase-${i}`}
                >
                  {phrase}
                  <button
                    onClick={() => removePhrase("requiredPhrases", i)}
                    className="ml-1 hover:text-destructive"
                    data-testid={`button-remove-required-phrase-${i}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newRequiredPhrase}
                onChange={(e) => setNewRequiredPhrase(e.target.value)}
                placeholder="e.g. This call may be recorded"
                className="text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addPhrase("requiredPhrases", newRequiredPhrase, setNewRequiredPhrase);
                  }
                }}
                data-testid="input-required-phrase"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  addPhrase("requiredPhrases", newRequiredPhrase, setNewRequiredPhrase)
                }
                data-testid="button-add-required-phrase"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Ban className="h-4 w-4 text-red-500" />
              <Label className="text-sm font-medium">Banned Phrases</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Phrases the agent must never say
            </p>
            <div className="flex flex-wrap gap-1.5">
              {bannedPhrases.map((phrase, i) => (
                <Badge
                  key={i}
                  variant="destructive"
                  className="gap-1 pr-1"
                  data-testid={`badge-banned-phrase-${i}`}
                >
                  {phrase}
                  <button
                    onClick={() => removePhrase("bannedPhrases", i)}
                    className="ml-1 hover:text-red-300"
                    data-testid={`button-remove-banned-phrase-${i}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newBannedPhrase}
                onChange={(e) => setNewBannedPhrase(e.target.value)}
                placeholder="e.g. I guarantee"
                className="text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addPhrase("bannedPhrases", newBannedPhrase, setNewBannedPhrase);
                  }
                }}
                data-testid="input-banned-phrase"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  addPhrase("bannedPhrases", newBannedPhrase, setNewBannedPhrase)
                }
                data-testid="button-add-banned-phrase"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <Label className="text-sm font-medium">Required Disclosures</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Mandatory disclosures that must appear in the conversation
            </p>
            <div className="flex flex-wrap gap-1.5">
              {disclosures.map((d, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="gap-1 pr-1"
                  data-testid={`badge-disclosure-${i}`}
                >
                  {d}
                  <button
                    onClick={() => removePhrase("disclosures", i)}
                    className="ml-1 hover:text-destructive"
                    data-testid={`button-remove-disclosure-${i}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newDisclosure}
                onChange={(e) => setNewDisclosure(e.target.value)}
                placeholder="e.g. terms and conditions apply"
                className="text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addPhrase("disclosures", newDisclosure, setNewDisclosure);
                  }
                }}
                data-testid="input-disclosure"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  addPhrase("disclosures", newDisclosure, setNewDisclosure)
                }
                data-testid="button-add-disclosure"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-blue-500" />
              <Label className="text-sm font-medium">Required Call Steps</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Ordered checklist of steps the agent should complete during each call
            </p>
            {requiredSteps.length > 0 && (
              <div className="space-y-2">
                {requiredSteps.map((step, i) => (
                  <div
                    key={step.id}
                    className="flex items-center gap-2 p-2 rounded-md bg-muted/50"
                    data-testid={`step-item-${i}`}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium text-muted-foreground w-5">
                      {step.order}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{step.name}</p>
                      {step.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {step.description}
                        </p>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0"
                      onClick={() => removeStep(step.id)}
                      data-testid={`button-remove-step-${i}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <Input
                value={newStepName}
                onChange={(e) => setNewStepName(e.target.value)}
                placeholder="Step name (e.g. Verify Identity)"
                className="text-sm"
                data-testid="input-step-name"
              />
              <Input
                value={newStepDesc}
                onChange={(e) => setNewStepDesc(e.target.value)}
                placeholder="Description (optional)"
                className="text-sm"
                data-testid="input-step-description"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={addStep}
                disabled={!newStepName.trim()}
                className="w-full"
                data-testid="button-add-step"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Step
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
