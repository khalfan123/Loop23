import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import EmbeddedSignupButton from "@/components/whatsapp/EmbeddedSignupButton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ShieldCheck, Sparkles, Info } from "lucide-react";

type WhatsappWizardConfig = {
  appId: string;
  configId: string;
  graphVersion?: string;
  requiredWabaId?: string;
};

export default function WhatsappSetup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { data: waWizardConfig } = useQuery({
    queryKey: ["/api/whatsapp/config", "whatsapp-setup-page"],
    queryFn: async (): Promise<WhatsappWizardConfig | null> => {
      try {
        const res = await apiRequest("GET", "/api/whatsapp/config");
        return (await res.json()) as WhatsappWizardConfig;
      } catch {
        return null;
      }
    },
  });

  const onSetupFinished = async (res: any) => {
    await queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/senders"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/channels"] });
    if (res?.wabaRowId) {
      setLocation(
        `/app/inbox/whatsapp-setup/complete?wabaRowId=${encodeURIComponent(res.wabaRowId)}&senderId=${encodeURIComponent(res.senderId || "")}`,
      );
    } else {
      setLocation("/app/channels/whatsapp");
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={() => setLocation("/app/inbox")} className="-ml-2 gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back to Inbox
        </Button>
      </div>

      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Connect your WhatsApp Business account</CardTitle>
          <CardDescription>
            Log in with Facebook once. We'll pull your WhatsApp Business accounts, phone numbers, templates and
            business profile automatically — same flow you'd use in ManyChat.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center gap-4 py-6">
            <EmbeddedSignupButton buttonLabel="Continue with Facebook" onCompleted={onSetupFinished as any} />
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              We never see your Facebook password. We only request WhatsApp Business permissions.
            </div>
          </div>

          {waWizardConfig?.requiredWabaId ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>One thing to choose in the Meta window</AlertTitle>
              <AlertDescription>
                When asked, pick the WhatsApp Business Account id{" "}
                <span className="font-mono font-medium">{waWizardConfig.requiredWabaId}</span>.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-3 md:grid-cols-3 text-sm">
            <FeatureRow
              title="Everything imports"
              body="Templates, business profile, phone numbers, quality status and messaging tier — all pulled in via Meta Graph as soon as you finish."
            />
            <FeatureRow
              title="Pick the number after login"
              body="You don't have to choose a phone number up front. Meta lists every WhatsApp number on your account; we link them automatically to your Twilio inventory when they match."
            />
            <FeatureRow
              title="Coexistence (Beta)"
              body="Keep the WhatsApp Business app on your phone for the same number — Meta's coexistence flow opens inside the same Facebook window."
            />
          </div>

          <div className="border-t pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced((v) => !v)}
              className="px-0 text-xs text-muted-foreground"
            >
              {showAdvanced ? "Hide advanced options" : "Advanced: pre-link a specific Twilio number, or use a pool number"}
            </Button>
            {showAdvanced ? <AdvancedOptions onCompleted={onSetupFinished} toast={toast} /> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FeatureRow({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="font-medium flex items-center gap-1.5">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        {title}
      </div>
      <div className="text-muted-foreground text-xs mt-1">{body}</div>
    </div>
  );
}

function AdvancedOptions({
  onCompleted,
  toast,
}: {
  onCompleted: (res: any) => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [, setLocation] = useLocation();

  return (
    <div className="space-y-4 pt-3">
      <p className="text-xs text-muted-foreground">
        Most users don't need these. They exist for clients with multiple Twilio numbers or coexistence requirements.
      </p>

      <div className="rounded-lg border p-3 space-y-2">
        <div className="font-medium">Buy a Twilio number first</div>
        <p className="text-xs text-muted-foreground">
          Need a new phone number to use on WhatsApp? Buy it in Phone Numbers, then return here and continue with
          Facebook.
        </p>
        <Button size="sm" variant="outline" onClick={() => setLocation("/app/phone-numbers")}>
          Open Phone Numbers
        </Button>
      </div>

      <div className="rounded-lg border p-3 space-y-2">
        <div className="font-medium">Coexistence flow (Beta)</div>
        <p className="text-xs text-muted-foreground">
          Keep using the WhatsApp Business app on your phone while connecting the same number here. Requires Meta's
          coexistence to be enabled on your config.
        </p>
        <EmbeddedSignupButton
          buttonLabel="Continue with Facebook (Coexistence)"
          extraCallbackPayload={{ flow: "coexistence" }}
          onCompleted={onCompleted as any}
        />
      </div>

      <div className="rounded-lg border p-3 space-y-2">
        <div className="font-medium">Just used Facebook but Twilio number didn't auto-link?</div>
        <p className="text-xs text-muted-foreground">
          Open Channels → pick the phone number Meta returned → "Link Twilio number". Use this if Meta's E.164 isn't
          present in your Twilio inventory yet.
        </p>
        <Button size="sm" variant="outline" onClick={() => setLocation("/app/channels/whatsapp")}>
          Open Channels
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Toll-free notice: numbers like UAE +971 800 often cannot receive Meta's verification call/SMS. Prefer
        non-toll-free for WhatsApp registration. (Twilio support: open ticket reference shown in Channels.)
      </p>
      {/* Surface advanced toast for accessibility */}
      {false ? (
        <Button onClick={() => toast({ title: "" })} className="hidden">
          noop
        </Button>
      ) : null}
    </div>
  );
}
