/**
 * Multi-step wizard to name an automation flow and pick a platform trigger event.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Set when user completes or skips the first-run wizard */
export const WIZARD_DONE_STORAGE_KEY = "loop23_webhook_wizard_done";

/** Persisted flow title for automation canvas header */
export const STORED_FLOW_TITLE_KEY = "loop23_webhook_flow_title";
/** Persisted trigger event key from wizard */
export const STORED_TRIGGER_KEY = "loop23_webhook_trigger_event";

export function readStoredFlowTitle(): string {
  try {
    return localStorage.getItem(STORED_FLOW_TITLE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function readStoredTrigger(): string {
  try {
    return localStorage.getItem(STORED_TRIGGER_KEY) ?? "ivr.option_selected";
  } catch {
    return "ivr.option_selected";
  }
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (payload: { name: string; trigger: string }) => void;
};

export function WebhookFlowWizard({ open, onOpenChange, onComplete }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("ivr.option_selected");

  const triggers = [
    { value: "ivr.option_selected", label: t("webhooks.flowWizard.triggers.ivrOption") },
    { value: "inbound_call.received", label: t("webhooks.flowWizard.triggers.inboundReceived") },
    { value: "call.completed", label: t("webhooks.flowWizard.triggers.callCompleted") },
    { value: "lead.captured", label: t("webhooks.flowWizard.triggers.leadCaptured") },
    { value: "form.submitted", label: t("webhooks.flowWizard.triggers.formSubmitted") },
  ];

  const resetAndClose = () => {
    setStep(1);
    onOpenChange(false);
  };

  const skipWizard = () => {
    try {
      localStorage.setItem(WIZARD_DONE_STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    resetAndClose();
  };

  const finish = () => {
    const trimmed = name.trim() || t("webhooks.flowBuilder.untitled");
    try {
      localStorage.setItem(WIZARD_DONE_STORAGE_KEY, "1");
      localStorage.setItem(STORED_FLOW_TITLE_KEY, trimmed);
      localStorage.setItem(STORED_TRIGGER_KEY, trigger);
    } catch {
      /* ignore */
    }
    onComplete({ name: trimmed, trigger });
    setStep(1);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 1 && t("webhooks.flowWizard.step1Title")}
            {step === 2 && t("webhooks.flowWizard.step2Title")}
            {step === 3 && t("webhooks.flowWizard.step3Title")}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && t("webhooks.flowWizard.step1Desc")}
            {step === 2 && t("webhooks.flowWizard.step2Desc")}
            {step === 3 && t("webhooks.flowWizard.step3Desc")}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-2 py-2">
            <Label htmlFor="wiz-name">{t("webhooks.flowWizard.flowName")}</Label>
            <Input
              id="wiz-name"
              placeholder={t("webhooks.flowWizard.flowNamePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2 py-2">
            <Label>{t("webhooks.flowWizard.pickTrigger")}</Label>
            <Select value={trigger} onValueChange={setTrigger}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {triggers.map((tr) => (
                  <SelectItem key={tr.value} value={tr.value}>
                    {tr.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {step === 3 && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
            <div>
              <span className="text-muted-foreground">{t("webhooks.flowWizard.summaryName")}</span>{" "}
              <span className="font-medium">{name.trim() || t("webhooks.flowBuilder.untitled")}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t("webhooks.flowWizard.summaryTrigger")}</span>{" "}
              <span className="font-mono text-xs">{trigger}</span>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step > 1 ? (
            <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
              {t("common.back")}
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={skipWizard}>
              {t("webhooks.flowWizard.skip")}
            </Button>
          )}
          {step < 3 ? (
            <Button type="button" onClick={() => setStep((s) => s + 1)}>
              {t("common.next")}
            </Button>
          ) : (
            <Button type="button" onClick={finish}>
              {t("webhooks.flowWizard.openCanvas")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
