import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Info, Trash2 } from "lucide-react";

/**
 * SMS sender configuration. Locked to the alphanumeric sender type — the
 * platform only exposes branded sender IDs (e.g. "B24 Payment") to customers.
 * The server still accepts phone-number and messaging-service sender types
 * (see workspaceSmsSettings.senderType) for API compatibility, but those
 * paths are intentionally hidden from the UI.
 */
type Settings = {
  id: string;
  workspaceId: string;
  senderType: "phone_number" | "messaging_service" | "alphanumeric";
  phoneNumberId: string | null;
  messagingServiceSid: string | null;
  alphanumericSender: string | null;
  inboundWebhookConfigured: boolean;
  complianceStatus: string;
  lastComplianceCheckAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type SettingsResponse = {
  settings: Settings | null;
  defaultCreditsPerSegment: number;
};

const ALPHA_SENDER_REGEX = /^[A-Za-z][A-Za-z0-9 ]{0,10}$/;

export default function SmsSetup() {
  const { toast } = useToast();

  const { data: settingsResponse, isLoading: loadingSettings } = useQuery<SettingsResponse>({
    queryKey: ["/api/sms/settings"],
  });

  const [alphanumericSender, setAlphanumericSender] = useState<string>("");

  useEffect(() => {
    if (settingsResponse?.settings) {
      setAlphanumericSender(settingsResponse.settings.alphanumericSender ?? "");
    }
  }, [settingsResponse?.settings]);

  // Holds the last save failure so we can render it inline (visible without
  // opening DevTools). Cleared when the user starts typing again.
  const [lastSaveError, setLastSaveError] = useState<{
    status?: number;
    error?: string;
    details?: unknown;
    raw?: string;
  } | null>(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        senderType: "alphanumeric",
        alphanumericSender: alphanumericSender.trim() || null,
      };
      const res = await apiRequest("PUT", "/api/sms/settings", payload);
      return res.json();
    },
    onSuccess: () => {
      setLastSaveError(null);
      queryClient.invalidateQueries({ queryKey: ["/api/sms/settings"] });
      toast({
        title: "SMS sender saved",
        description: "Your workspace is ready to send branded SMS.",
      });
    },
    onError: (err: any) => {
      setLastSaveError({
        status: err?.status,
        error: err?.data?.error || err?.message,
        details: err?.data?.details,
        raw: (() => {
          try {
            return JSON.stringify(err?.data ?? { message: err?.message }, null, 2);
          } catch {
            return String(err?.message || err);
          }
        })(),
      });
      // The server's ApiError carries `data.error` (a human-readable summary)
      // and `data.details.fieldErrors` (per-field zod messages). Surface the
      // most specific message so the user knows what to fix.
      const fieldErr = err?.data?.details?.fieldErrors?.alphanumericSender?.[0];
      const status = err?.status ? ` (HTTP ${err.status})` : "";
      const description = `${fieldErr || err?.message || "Unknown error"}${status}`;
      // Log every interesting field separately so they all show up in the
      // browser console without needing to expand a collapsed object.
      // eslint-disable-next-line no-console
      console.error("[sms-setup] save failed", {
        status: err?.status,
        message: err?.message,
        serverError: err?.data?.error,
        fieldErrors: err?.data?.details?.fieldErrors,
        formErrors: err?.data?.details?.formErrors,
        rawData: err?.data,
      });
      // Also log the raw JSON so it's copy-pasteable in one line.
      try {
        // eslint-disable-next-line no-console
        console.error("[sms-setup] raw response JSON:", JSON.stringify(err?.data));
      } catch {
        /* ignore */
      }
      toast({
        title: "Couldn't save settings",
        description,
        variant: "destructive",
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/sms/settings");
      return res.json();
    },
    onSuccess: () => {
      setAlphanumericSender("");
      queryClient.invalidateQueries({ queryKey: ["/api/sms/settings"] });
      toast({
        title: "SMS sender removed",
        description: "Configure a new sender ID to start sending again.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't remove sender",
        description: err?.message || "Unknown error",
        variant: "destructive",
      });
    },
  });

  const trimmed = alphanumericSender.trim();
  const isValid = ALPHA_SENDER_REGEX.test(trimmed);
  const canSave = isValid && !saveMutation.isPending && !loadingSettings;

  // Existing saved sender (if any) — used to switch the Save button between
  // "Save" and "Update" labels and to enable/disable the Remove button.
  const existingSender =
    settingsResponse?.settings?.senderType === "alphanumeric"
      ? settingsResponse?.settings?.alphanumericSender ?? ""
      : "";
  // Disable Update when the typed value matches what's already saved so the
  // user gets a clear hint they need to change the text to rename.
  const hasUnchangedValue = !!existingSender && trimmed === existingSender;

  const defaultRate = settingsResponse?.defaultCreditsPerSegment ?? 0;

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-2 space-y-4">
        <Card className="p-6">
          <div className="space-y-1 mb-4">
            <h2 className="text-lg font-semibold">SMS sender</h2>
            <p className="text-sm text-muted-foreground">
              Send outbound SMS from a branded alphanumeric sender ID (e.g.{" "}
              <code>B24 Payment</code>). One-way only — recipients cannot reply.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="alpha-sender">Sender ID</Label>
              <Input
                id="alpha-sender"
                placeholder="B24 Payment"
                maxLength={11}
                value={alphanumericSender}
                onChange={(e) => {
                  // Strip disallowed characters live so the user can never
                  // build an invalid sender ID. We allow A-Z, a-z, 0-9, and
                  // space; everything else (punctuation, emoji, accented
                  // letters) is filtered out. The first char must also be a
                  // letter — drop a leading non-letter so the regex check
                  // matches at all times.
                  let cleaned = e.target.value.replace(/[^A-Za-z0-9 ]/g, "");
                  cleaned = cleaned.replace(/^[^A-Za-z]+/, "");
                  cleaned = cleaned.slice(0, 11);
                  setAlphanumericSender(cleaned);
                  if (lastSaveError) setLastSaveError(null);
                }}
                data-testid="input-alphanumeric-sender"
              />
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {alphanumericSender.length}/11 chars. Must start with a letter. Latin alphanumeric
                  + spaces only.
                </span>
                {alphanumericSender.length > 0 && !isValid && (
                  <span className="text-destructive" data-testid="text-alpha-invalid">
                    Invalid format
                  </span>
                )}
              </div>
            </div>

            <Alert className="border-yellow-500/50 bg-yellow-500/10">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertTitle>Pre-registration required in many countries</AlertTitle>
              <AlertDescription className="text-sm">
                UAE, UK, France, Germany, India, and others require pre-registration of the sender
                ID with carriers (often via Twilio's regulatory compliance bundles). Unregistered
                alpha senders are filtered or rejected.{" "}
                <a
                  href="https://www.twilio.com/docs/messaging/services/alpha-sender-ids-countries"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium underline underline-offset-2"
                >
                  See country support list
                </a>
                .
              </AlertDescription>
            </Alert>

            <Alert className="border-blue-500/50 bg-blue-500/10">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertTitle>One-way send only</AlertTitle>
              <AlertDescription className="text-sm">
                Recipients cannot reply to alphanumeric senders. The Conversations inbox will only
                show outbound messages. Not supported in US, Canada, China, Vietnam.
              </AlertDescription>
            </Alert>
          </div>

          {lastSaveError && (
            <Alert className="mt-4 border-destructive/50 bg-destructive/10" data-testid="alert-save-error">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <AlertTitle>Save failed — HTTP {lastSaveError.status ?? "?"}</AlertTitle>
              <AlertDescription className="text-sm">
                <p className="mb-2">{lastSaveError.error || "Unknown error"}</p>
                <pre
                  className="mt-2 max-h-40 overflow-auto rounded bg-background/60 p-2 text-[11px] leading-snug"
                  data-testid="text-save-error-raw"
                >
                  {lastSaveError.raw}
                </pre>
              </AlertDescription>
            </Alert>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {existingSender ? (
                <span>
                  Current sender:{" "}
                  <strong className="text-foreground" data-testid="text-current-sender">
                    {existingSender}
                  </strong>{" "}
                  — edit and click Update to rename.
                </span>
              ) : (
                <span>Alphanumeric senders are one-way only — no inbound webhook.</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {existingSender && (
                <Button
                  variant="outline"
                  onClick={() => removeMutation.mutate()}
                  disabled={removeMutation.isPending}
                  data-testid="button-remove-sms-settings"
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  {removeMutation.isPending ? "Removing…" : "Remove"}
                </Button>
              )}
              <Button
                disabled={!canSave || hasUnchangedValue}
                onClick={() => saveMutation.mutate()}
                data-testid="button-save-sms-settings"
              >
                {saveMutation.isPending
                  ? existingSender
                    ? "Updating…"
                    : "Saving…"
                  : existingSender
                  ? "Update sender"
                  : "Save sender"}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="p-6">
          <div className="space-y-1 mb-3">
            <h3 className="text-base font-semibold">Pricing</h3>
            <p className="text-sm text-muted-foreground">
              Charged per SMS segment. International destinations may cost more.
            </p>
          </div>
          <div className="text-3xl font-bold">{defaultRate}</div>
          <div className="text-sm text-muted-foreground">credits per segment (default)</div>
          <div className="mt-3 text-xs text-muted-foreground">
            <p>
              Standard segments are ≤ 160 chars for GSM-7 or ≤ 70 chars for Unicode (emoji, RTL).
            </p>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-base font-semibold">How it works</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Outbound SMS is sent from your saved sender ID via Twilio. The recipient sees your brand
            name instead of a phone number.
          </p>
          <p className="text-xs text-muted-foreground mt-3">
            Replies are not supported with alphanumeric senders — use a phone number sender if your
            workflow needs inbound replies.
          </p>
        </Card>
      </div>
    </div>
  );
}
