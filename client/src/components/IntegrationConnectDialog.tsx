import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ExternalLink, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { IntegrationApp } from "@shared/schema";

type IntegrationAppWithOAuth = IntegrationApp & {
  requiresOAuth?: boolean;
  authType?: string;
};

type Props = {
  app: IntegrationAppWithOAuth | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected?: () => void;
};

function getOAuthRedirectUri(): string {
  return `${window.location.origin}/api/integrations/oauth/callback`;
}

/** Apps that do not require a marketplace user integration connection. */
export const BUILDER_SKIP_CONNECT_SLUGS = new Set([
  "loop9",
  "webhooks",
  "schedule",
  "email",
  "code",
  "api",
]);

export function appRequiresUserConnection(
  slug: string | null | undefined,
  appsBySlug: Map<string, IntegrationAppWithOAuth>,
): boolean {
  if (!slug) return false;
  const normalized = slug.trim().toLowerCase();
  if (BUILDER_SKIP_CONNECT_SLUGS.has(normalized)) return false;
  return appsBySlug.has(normalized);
}

export function IntegrationConnectDialog({ app, open, onOpenChange, onConnected }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [oauthPending, setOauthPending] = useState(false);

  useEffect(() => {
    if (!open) {
      setClientId("");
      setClientSecret("");
      setOauthPending(false);
    }
  }, [open]);

  const isApiKeyProvider = app?.authType === "api_key";
  const requiresOAuth = !!app?.requiresOAuth && !isApiKeyProvider;

  const connectMutation = useMutation({
    mutationFn: async (creds: { clientId: string; clientSecret: string }) => {
      if (!app) throw new Error("No app selected");
      const res = await apiRequest("POST", `/api/integrations/${app.slug}/connect`, {
        clientId: creds.clientId,
        clientSecret: creds.clientSecret,
      });
      return await res.json();
    },
    onSuccess: (data) => {
      setClientId("");
      setClientSecret("");
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connected"] });

      if (data.oauthUrl) {
        setOauthPending(true);
        const popup = window.open(
          data.oauthUrl,
          "oauth_popup",
          "width=600,height=700,scrollbars=yes",
        );

        const checkClosed = window.setInterval(() => {
          if (popup && popup.closed) {
            window.clearInterval(checkClosed);
            setOauthPending(false);
            queryClient.invalidateQueries({ queryKey: ["/api/integrations/connected"] });
            onConnected?.();
            onOpenChange(false);
          }
        }, 1000);

        toast({
          title: t("integrations.detail.toast.signIn", "Sign in required"),
          description: t("integrations.detail.toast.signInDesc", {
            name: app?.name || "service",
            defaultValue: `Complete sign-in for ${app?.name || "this app"} in the popup window.`,
          }),
        });
        return;
      }

      toast({
        title: t("integrations.detail.toast.connected", "Connected"),
        description: t("integrations.detail.toast.connectedDesc", {
          name: app?.name || "Integration",
          defaultValue: `${app?.name || "Integration"} is connected.`,
        }),
      });
      onConnected?.();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: t("integrations.detail.toast.connectionFailed", "Connection failed"),
        description:
          error.message ||
          t(
            "integrations.detail.toast.connectionFailedDefault",
            "Could not connect. Check your credentials and try again.",
          ),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast({
        title: t("integrations.detail.toast.missingCredentials", "Missing credentials"),
        description: t("integrations.detail.toast.missingCredentialsDesc", {
          field1: isApiKeyProvider
            ? t("integrations.detail.providers.default.field1Label", "API Key")
            : t("integrations.detail.providers.default.field1Label", "Client ID"),
          field2: isApiKeyProvider
            ? t("integrations.detail.providers.default.field2Label", "Domain")
            : t("integrations.detail.providers.default.field2Label", "Client Secret"),
          defaultValue: "Enter both credential fields to continue.",
        }),
        variant: "destructive",
      });
      return;
    }
    connectMutation.mutate({ clientId: clientId.trim(), clientSecret: clientSecret.trim() });
  };

  if (!app) return null;

  const field1Label = isApiKeyProvider
    ? t("integrations.detail.providers.default.field1Label", "API Key")
    : t("integrations.detail.providers.default.field1Label", "Client ID");
  const field2Label = isApiKeyProvider
    ? t("integrations.detail.providers.default.field2Label", "Domain")
    : t("integrations.detail.providers.default.field2Label", "Client Secret");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="dialog-integration-connect">
        <DialogHeader>
          <DialogTitle>
            {t("integrations.detail.connect.title", {
              name: app.name,
              defaultValue: `Connect ${app.name}`,
            })}
          </DialogTitle>
          <DialogDescription>
            {t("integrations.detail.providers.default.helpText", {
              defaultValue: `Enter credentials from your ${app.name} developer settings to connect this account.`,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="flex items-center gap-2">
            <a
              href={`/app/integrations/${app.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline inline-flex items-center gap-1.5"
              data-testid="link-integration-setup"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t("integrations.detail.providers.default.setupLinkText", "Open setup guide")}
            </a>
          </div>

          {requiresOAuth && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {t("integrations.detail.connect.redirectUri", {
                  name: app.name,
                  defaultValue: "Redirect URI",
                })}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={getOAuthRedirectUri()}
                  className="text-xs font-mono bg-muted"
                  data-testid="input-redirect-uri"
                />
                <Button
                  variant="outline"
                  size="icon"
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(getOAuthRedirectUri());
                    toast({
                      title: t("integrations.detail.copied", "Copied"),
                      description: t("integrations.detail.copiedDesc", {
                        label: t("integrations.detail.setupGuide.redirectUri", "Redirect URI"),
                        defaultValue: "Redirect URI copied.",
                      }),
                    });
                  }}
                  data-testid="button-copy-redirect-uri"
                >
                  <FileText className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="builder-connect-field1">{field1Label}</Label>
            <Input
              id="builder-connect-field1"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder={field1Label}
              data-testid="input-connect-client-id"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="builder-connect-field2">{field2Label}</Label>
            <Input
              id="builder-connect-field2"
              type={isApiKeyProvider ? "text" : "password"}
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder={field2Label}
              data-testid="input-connect-client-secret"
            />
          </div>

          <div className="rounded-md bg-muted p-3">
            <p className="text-xs text-muted-foreground">
              {isApiKeyProvider
                ? t("integrations.detail.connect.securityNoteApiKey", {
                    field1: field1Label,
                    field2: field2Label,
                    name: app.name,
                    defaultValue: "Credentials are encrypted and stored for your account only.",
                  })
                : t("integrations.detail.connect.securityNoteOAuth", {
                    name: app.name,
                    defaultValue: "You may be redirected to authorize access after submitting.",
                  })}
            </p>
          </div>

          {oauthPending && (
            <Badge variant="secondary" className="text-xs">
              {t("integrations.detail.connect.connecting", "Waiting for authorization…")}
            </Badge>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-connect"
          >
            {t("integrations.detail.connect.cancel", "Cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={connectMutation.isPending || oauthPending || !clientId.trim() || !clientSecret.trim()}
            data-testid="button-submit-connect"
          >
            {connectMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4 mr-1.5" />
            )}
            {connectMutation.isPending
              ? t("integrations.detail.connect.connecting", "Connecting…")
              : isApiKeyProvider
                ? t("integrations.detail.connect.connectButton", "Connect")
                : t("integrations.detail.connect.connectAuthorize", "Connect & authorize")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
