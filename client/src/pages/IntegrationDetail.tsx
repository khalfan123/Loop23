import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowLeft, CheckCircle2, AlertCircle, Loader2, Plug, Unplug,
  RefreshCw, Clock, Zap, Settings, FileText, ExternalLink,
  Play, XCircle, Star, Plug2, User, Mail, Shield
} from "lucide-react";
import {
  SiSalesforce, SiHubspot, SiGooglesheets, SiSlack,
  SiMailchimp, SiAirtable
} from "react-icons/si";
import type { IntegrationApp, UserIntegration, IntegrationSyncLog } from "@shared/schema";

interface IntegrationAppWithOAuth extends IntegrationApp {
  requiresOAuth?: boolean;
  authType?: string;
}

interface ProviderCredentialConfig {
  field1Label: string;
  field1Placeholder: string;
  field2Label: string;
  field2Placeholder: string;
  helpText: string;
  setupUrl: string;
  setupLinkText: string;
  requiresRedirectUri: boolean;
  scopes?: string[];
}

const PROVIDER_CREDENTIAL_CONFIG: Record<string, ProviderCredentialConfig> = {
  salesforce: {
    field1Label: "Consumer Key",
    field1Placeholder: "Enter your Salesforce Consumer Key",
    field2Label: "Consumer Secret",
    field2Placeholder: "Enter your Salesforce Consumer Secret",
    helpText: "Create a Connected App in Salesforce: go to Setup > App Manager > New Connected App. Enable OAuth settings and add the callback URL below. Copy the Consumer Key and Consumer Secret from the app details.",
    setupUrl: "https://login.salesforce.com/",
    setupLinkText: "Open Salesforce Setup",
    requiresRedirectUri: true,
    scopes: ["api", "refresh_token", "full"],
  },
  hubspot: {
    field1Label: "Client ID",
    field1Placeholder: "Enter your HubSpot Client ID",
    field2Label: "Client Secret",
    field2Placeholder: "Enter your HubSpot Client Secret",
    helpText: "Create an app in the HubSpot Developer Portal. Go to your app's Auth settings, add the redirect URL below, and select the required scopes. Copy the Client ID and Client Secret.",
    setupUrl: "https://developers.hubspot.com/",
    setupLinkText: "Open HubSpot Developer Portal",
    requiresRedirectUri: true,
    scopes: ["crm.objects.contacts.read", "crm.objects.contacts.write", "crm.objects.deals.read", "crm.objects.deals.write"],
  },
  zoho: {
    field1Label: "Client ID",
    field1Placeholder: "Enter your Zoho Client ID",
    field2Label: "Client Secret",
    field2Placeholder: "Enter your Zoho Client Secret",
    helpText: "Register a Server-based Application in the Zoho API Console. Add the redirect URL below as an authorized redirect URI. Copy the Client ID and Client Secret.",
    setupUrl: "https://api-console.zoho.com/",
    setupLinkText: "Open Zoho API Console",
    requiresRedirectUri: true,
    scopes: ["ZohoCRM.modules.ALL", "ZohoCRM.settings.ALL"],
  },
  "google-sheets": {
    field1Label: "Client ID",
    field1Placeholder: "Enter your Google Client ID",
    field2Label: "Client Secret",
    field2Placeholder: "Enter your Google Client Secret",
    helpText: "In Google Cloud Console, create an OAuth 2.0 Client ID (Web application type). Add the redirect URL below as an authorized redirect URI. Enable the Google Sheets API and Google People API for your project.",
    setupUrl: "https://console.cloud.google.com/apis/credentials",
    setupLinkText: "Open Google Cloud Console",
    requiresRedirectUri: true,
    scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
  },
  pipedrive: {
    field1Label: "Client ID",
    field1Placeholder: "Enter your Pipedrive Client ID",
    field2Label: "Client Secret",
    field2Placeholder: "Enter your Pipedrive Client Secret",
    helpText: "Create an app in the Pipedrive Developer Hub (Marketplace Manager). Set the callback URL to the redirect URL below. Copy the Client ID and Client Secret from your app settings.",
    setupUrl: "https://developers.pipedrive.com/",
    setupLinkText: "Open Pipedrive Developer Hub",
    requiresRedirectUri: true,
    scopes: ["deals:full", "contacts:full", "activities:full"],
  },
  dynamics365: {
    field1Label: "Application (Client) ID",
    field1Placeholder: "Enter your Azure Application (Client) ID",
    field2Label: "Client Secret",
    field2Placeholder: "Enter your Azure Client Secret value",
    helpText: "Register an application in Azure Portal > App Registrations. Under Authentication, add the redirect URL below as a Web redirect URI. Under Certificates & secrets, create a new Client Secret and copy the value. Grant Dynamics CRM API permissions.",
    setupUrl: "https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade",
    setupLinkText: "Open Azure Portal",
    requiresRedirectUri: true,
    scopes: ["https://org.crm.dynamics.com/.default", "offline_access"],
  },
  freshsales: {
    field1Label: "API Key",
    field1Placeholder: "Enter your Freshsales API Key",
    field2Label: "Domain",
    field2Placeholder: "e.g. yourcompany.freshsales.io",
    helpText: "Find your API Key in Freshsales: go to Settings > API Settings > Your API Key. Your domain is the URL you use to access Freshsales (e.g., yourcompany.freshsales.io).",
    setupUrl: "https://www.freshworks.com/crm/sales/",
    setupLinkText: "Open Freshsales",
    requiresRedirectUri: false,
  },
  "monday-com": {
    field1Label: "Client ID",
    field1Placeholder: "Enter your Monday.com Client ID",
    field2Label: "Client Secret",
    field2Placeholder: "Enter your Monday.com Client Secret",
    helpText: "Create an app at monday.com Developers. Under OAuth settings, add the redirect URL below. Copy the Client ID and Client Secret from the app's Basic Information section.",
    setupUrl: "https://monday.com/developers/apps",
    setupLinkText: "Open Monday.com Developers",
    requiresRedirectUri: true,
    scopes: ["boards:read", "boards:write"],
  },
  airtable: {
    field1Label: "Client ID",
    field1Placeholder: "Enter your Airtable Client ID",
    field2Label: "Client Secret",
    field2Placeholder: "Enter your Airtable Client Secret",
    helpText: "Register an OAuth integration at the Airtable Developer Hub. Add the redirect URL below. Select the required scopes (data.records:read, data.records:write, schema.bases:read). Copy the Client ID and Client Secret.",
    setupUrl: "https://airtable.com/create/oauth",
    setupLinkText: "Open Airtable Developer Hub",
    requiresRedirectUri: true,
    scopes: ["data.records:read", "data.records:write", "schema.bases:read"],
  },
  slack: {
    field1Label: "Client ID",
    field1Placeholder: "Enter your Slack Client ID",
    field2Label: "Client Secret",
    field2Placeholder: "Enter your Slack Client Secret",
    helpText: "Create a Slack App at api.slack.com/apps. Under OAuth & Permissions, add the redirect URL below. Add the required Bot Token Scopes (chat:write, channels:read, users:read). Copy the Client ID and Client Secret from Basic Information.",
    setupUrl: "https://api.slack.com/apps",
    setupLinkText: "Open Slack API",
    requiresRedirectUri: true,
    scopes: ["chat:write", "channels:read", "users:read"],
  },
  mailchimp: {
    field1Label: "Client ID",
    field1Placeholder: "Enter your Mailchimp Client ID",
    field2Label: "Client Secret",
    field2Placeholder: "Enter your Mailchimp Client Secret",
    helpText: "Register an app in the Mailchimp Developer Portal. Add the redirect URL below as a redirect URI. Copy the Client ID and Client Secret from your app settings.",
    setupUrl: "https://login.mailchimp.com/",
    setupLinkText: "Open Mailchimp Developer Portal",
    requiresRedirectUri: true,
  },
  intercom: {
    field1Label: "Client ID",
    field1Placeholder: "Enter your Intercom Client ID",
    field2Label: "Client Secret",
    field2Placeholder: "Enter your Intercom Client Secret",
    helpText: "Create an app in the Intercom Developer Hub. Under Authentication, add the redirect URL below. Copy the Client ID and Client Secret from your app settings.",
    setupUrl: "https://developers.intercom.com/",
    setupLinkText: "Open Intercom Developer Hub",
    requiresRedirectUri: true,
  },
};

function getProviderConfig(slug: string): ProviderCredentialConfig {
  return PROVIDER_CREDENTIAL_CONFIG[slug] || {
    field1Label: "Client ID",
    field1Placeholder: "Enter your Client ID",
    field2Label: "Client Secret",
    field2Placeholder: "Enter your Client Secret",
    helpText: "Enter your OAuth app credentials. You can find these in the provider's developer console or admin settings.",
    setupUrl: "",
    setupLinkText: "Open Developer Console",
    requiresRedirectUri: true,
  };
}

function getOAuthRedirectUri(): string {
  const base = window.location.origin;
  return `${base}/api/integrations/oauth/callback`;
}

const LOGO_MAP: Record<string, React.ReactNode> = {
  salesforce: <SiSalesforce className="w-8 h-8 text-[#00A1E0]" />,
  hubspot: <SiHubspot className="w-8 h-8 text-[#FF7A59]" />,
  "google-sheets": <SiGooglesheets className="w-8 h-8 text-[#0F9D58]" />,
  slack: <SiSlack className="w-8 h-8 text-[#4A154B]" />,
  mailchimp: <SiMailchimp className="w-8 h-8 text-[#FFE01B]" />,
  airtable: <SiAirtable className="w-8 h-8 text-[#18BFFF]" />,
};

interface IntegrationConfig {
  fieldMapping?: Record<string, string>;
  accountName?: string | null;
  accountEmail?: string | null;
  accountId?: string | null;
  connectedAt?: string | null;
}

interface ConnectedInfo {
  integration: UserIntegration & { config: IntegrationConfig };
  app: IntegrationApp;
}

function getAppIcon(slug: string) {
  return LOGO_MAP[slug] || <Plug2 className="w-8 h-8 text-muted-foreground" />;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleString();
}

function getStatusInfo(status: string) {
  switch (status) {
    case "active":
      return { icon: <CheckCircle2 className="w-4 h-4" />, label: "Connected", variant: "default" as const, color: "text-green-600" };
    case "pending_auth":
      return { icon: <Loader2 className="w-4 h-4 animate-spin" />, label: "Pending Authentication", variant: "secondary" as const, color: "text-amber-600" };
    case "error":
      return { icon: <AlertCircle className="w-4 h-4" />, label: "Error", variant: "destructive" as const, color: "text-red-600" };
    case "inactive":
      return { icon: <XCircle className="w-4 h-4" />, label: "Inactive", variant: "outline" as const, color: "text-muted-foreground" };
    default:
      return { icon: <Clock className="w-4 h-4" />, label: status, variant: "outline" as const, color: "text-muted-foreground" };
  }
}

export default function IntegrationDetail() {
  const [, params] = useRoute("/app/integrations/:slug");
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const slug = params?.slug || "";

  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [oauthPending, setOauthPending] = useState(false);

  const searchParams = new URLSearchParams(searchString);
  const oauthSuccess = searchParams.get("oauth_success");
  const oauthError = searchParams.get("oauth_error");

  useEffect(() => {
    if (oauthSuccess === "true") {
      toast({
        title: "Account connected",
        description: "Your account has been authenticated and is now syncing data.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connected"] });
      window.history.replaceState({}, "", `/app/integrations/${slug}`);
    } else if (oauthError) {
      const errorMessages: Record<string, string> = {
        access_denied: "You denied access to your account. Please try again to connect.",
        missing_params: "The authentication response was incomplete. Please try again.",
        invalid_state: "The authentication session expired or was invalid. Please try again.",
        integration_not_found: "The integration record was not found. Please reconnect.",
        token_exchange_failed: "Failed to complete authentication with the service. Check your credentials and try again.",
        missing_credentials: "Your stored credentials could not be found. Please reconnect with your Client ID and Client Secret.",
        credential_error: "There was a problem with your stored credentials. Please reconnect.",
        server_error: "An unexpected error occurred during authentication. Please try again.",
      };
      toast({
        title: "Authentication failed",
        description: errorMessages[oauthError] || "An error occurred during authentication.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", `/app/integrations/${slug}`);
    }
  }, [oauthSuccess, oauthError, slug, toast]);

  const { data: apps, isLoading: appsLoading } = useQuery<IntegrationAppWithOAuth[]>({
    queryKey: ["/api/integrations/apps"],
  });

  const { data: connected, isLoading: connectedLoading } = useQuery<ConnectedInfo[]>({
    queryKey: ["/api/integrations/connected"],
  });

  const app = apps?.find((a) => a.slug === slug);
  const requiresOAuth = !!(app as IntegrationAppWithOAuth)?.requiresOAuth;
  const connectionInfo = connected?.find((c) => c.app.slug === slug);
  const integration = connectionInfo?.integration;
  const config = integration?.config as IntegrationConfig | undefined;

  const { data: syncLogs, isLoading: logsLoading } = useQuery<IntegrationSyncLog[]>({
    queryKey: ["/api/integrations", integration?.id, "logs"],
    enabled: !!integration?.id,
    queryFn: async () => {
      const res = await fetch(`/api/integrations/${integration!.id}/logs`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
  });

  const connectMutation = useMutation({
    mutationFn: async (creds: { clientId: string; clientSecret: string }) => {
      const res = await apiRequest("POST", `/api/integrations/${slug}/connect`, {
        clientId: creds.clientId,
        clientSecret: creds.clientSecret,
      });
      return await res.json();
    },
    onSuccess: (data) => {
      setCredentialsDialogOpen(false);
      setClientId("");
      setClientSecret("");
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connected"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations", data?.integration?.id, "logs"] });

      if (data.oauthUrl) {
        setOauthPending(true);
        const popup = window.open(data.oauthUrl, "oauth_popup", "width=600,height=700,scrollbars=yes");

        const checkClosed = setInterval(() => {
          if (popup && popup.closed) {
            clearInterval(checkClosed);
            setOauthPending(false);
            queryClient.invalidateQueries({ queryKey: ["/api/integrations/connected"] });
          }
        }, 1000);

        toast({
          title: "Sign in to your account",
          description: `A new window has opened for you to authorize access to your ${app?.name || "service"} account.`,
        });
      } else {
        toast({
          title: "Integration connected",
          description: `${app?.name || "Integration"} is now connected and active.`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Connection failed",
        description: error.message || "Failed to connect integration",
        variant: "destructive",
      });
    },
  });

  const providerConfig = app ? getProviderConfig(app.slug) : getProviderConfig("");
  const authType = (app as IntegrationAppWithOAuth)?.authType;
  const isApiKeyProvider = authType === "api_key";

  const handleConnectClick = () => {
    if (requiresOAuth || isApiKeyProvider) {
      setCredentialsDialogOpen(true);
    } else {
      connectMutation.mutate({ clientId: "", clientSecret: "" });
    }
  };

  const handleCredentialsSubmit = () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast({
        title: "Missing credentials",
        description: `Please enter both ${providerConfig.field1Label} and ${providerConfig.field2Label}.`,
        variant: "destructive",
      });
      return;
    }
    connectMutation.mutate({ clientId: clientId.trim(), clientSecret: clientSecret.trim() });
  };

  const activateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/integrations/${integration!.id}/activate`, {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connected"] });
      toast({ title: "Integration activated", description: "The integration is now active and syncing data." });
    },
    onError: (error: any) => {
      toast({
        title: "Activation failed",
        description: error.message || "Failed to activate integration",
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/integrations/${integration!.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connected"] });
      setDisconnectDialogOpen(false);
      toast({ title: "Integration disconnected", description: "The integration has been removed." });
    },
    onError: (error: any) => {
      toast({
        title: "Disconnect failed",
        description: error.message || "Failed to disconnect",
        variant: "destructive",
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/integrations/${integration!.id}/sync`, {});
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations", integration?.id, "logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connected"] });
      toast({
        title: data.success ? "Sync completed" : "Sync failed",
        description: data.success ? "Data has been synced successfully." : "The sync encountered an error.",
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync failed",
        description: error.message || "Failed to trigger sync",
        variant: "destructive",
      });
    },
  });

  const isLoading = appsLoading || connectedLoading;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16">
        <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-medium mb-2">Integration not found</h2>
        <Button variant="outline" onClick={() => navigate("/app/integrations")} data-testid="button-back-marketplace">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Marketplace
        </Button>
      </div>
    );
  }

  const statusInfo = integration ? getStatusInfo(integration.status) : null;

  return (
    <div className="flex flex-col h-full" data-testid="page-integration-detail">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="p-4 md:p-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/app/integrations")}
            className="mb-4"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Integrations
          </Button>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center shrink-0">
                {getAppIcon(app.slug)}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold tracking-tight" data-testid="text-detail-title">{app.name}</h1>
                  {app.isPopular && (
                    <Badge variant="secondary" className="no-default-active-elevate">
                      <Star className="w-3 h-3 mr-0.5" /> Popular
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{app.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {integration ? (
                <>
                  <Badge variant={statusInfo!.variant} className="gap-1" data-testid="badge-connection-status">
                    {statusInfo!.icon} {statusInfo!.label}
                  </Badge>
                  {integration.status === "pending_auth" && (
                    <Button
                      size="sm"
                      onClick={() => activateMutation.mutate()}
                      disabled={activateMutation.isPending}
                      data-testid="button-activate"
                    >
                      {activateMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Play className="w-4 h-4 mr-1.5" />}
                      Activate
                    </Button>
                  )}
                  {integration.status === "active" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => syncMutation.mutate()}
                      disabled={syncMutation.isPending}
                      data-testid="button-sync"
                    >
                      {syncMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
                      Sync Now
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDisconnectDialogOpen(true)}
                    data-testid="button-disconnect"
                  >
                    <Unplug className="w-4 h-4 mr-1.5" /> Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleConnectClick}
                  disabled={connectMutation.isPending || oauthPending}
                  data-testid="button-connect"
                >
                  {(connectMutation.isPending || oauthPending) ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-1.5" />}
                  {oauthPending ? "Waiting for authorization..." : `Connect ${app.name}`}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {integration && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center ${statusInfo!.color}`}>
                      {statusInfo!.icon}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p className="font-semibold text-sm" data-testid="text-status">{statusInfo!.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Last Synced</p>
                      <p className="font-semibold text-sm" data-testid="text-last-sync">{formatDate(integration.lastSyncAt as string | null)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Connected Since</p>
                      <p className="font-semibold text-sm" data-testid="text-connected-since">{formatDate(integration.createdAt as unknown as string)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {(config?.accountName || config?.accountEmail) && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="w-4 h-4" /> Connected Account
                  </CardTitle>
                  <Badge variant="outline" className="no-default-active-elevate gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Authenticated
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {config.accountName && (
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">Account</p>
                          <p className="text-sm font-medium truncate" data-testid="text-account-name">{config.accountName}</p>
                        </div>
                      </div>
                    )}
                    {config.accountEmail && (
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                          <Mail className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">Email</p>
                          <p className="text-sm font-medium truncate" data-testid="text-account-email">{config.accountEmail}</p>
                        </div>
                      </div>
                    )}
                    {config.connectedAt && (
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">Authorized On</p>
                          <p className="text-sm font-medium truncate" data-testid="text-auth-date">{formatDate(config.connectedAt)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="w-4 h-4" /> Field Mapping
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Configure how data fields map from Loop9 to {app.name}.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Contact Name</Label>
                    <Input
                      placeholder="e.g. contact_name"
                      defaultValue={config?.fieldMapping?.contactName || "contact_name"}
                      readOnly
                      data-testid="input-field-contact-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Phone Number</Label>
                    <Input
                      placeholder="e.g. phone_number"
                      defaultValue={config?.fieldMapping?.phoneNumber || "phone_number"}
                      readOnly
                      data-testid="input-field-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Company</Label>
                    <Input
                      placeholder="e.g. company"
                      defaultValue={config?.fieldMapping?.company || "company"}
                      readOnly
                      data-testid="input-field-company"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Call Summary</Label>
                    <Input
                      placeholder="e.g. call_summary"
                      defaultValue={config?.fieldMapping?.callSummary || "call_summary"}
                      readOnly
                      data-testid="input-field-summary"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Sync History
                </CardTitle>
                <Badge variant="outline" className="no-default-active-elevate">{syncLogs?.length || 0} entries</Badge>
              </CardHeader>
              <CardContent>
                {logsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : syncLogs && syncLogs.length > 0 ? (
                  <ScrollArea className="max-h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Event</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Records</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {syncLogs.map((log) => (
                          <TableRow key={log.id} data-testid={`row-sync-log-${log.id}`}>
                            <TableCell className="font-medium text-sm">{log.eventType || "unknown"}</TableCell>
                            <TableCell>
                              <Badge
                                variant={log.status === "success" ? "default" : log.status === "failed" ? "destructive" : "secondary"}
                                className={log.status === "success" ? "bg-green-600" : ""}
                              >
                                {log.status === "success" ? <CheckCircle2 className="w-3 h-3 mr-1" /> : log.status === "failed" ? <XCircle className="w-3 h-3 mr-1" /> : null}
                                {log.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{log.recordsSynced}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {log.executionDurationMs ? `${log.executionDurationMs}ms` : "-"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{formatDate(log.createdAt as unknown as string)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <FileText className="w-8 h-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No sync history yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {!integration && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                {getAppIcon(app.slug)}
              </div>
              <h3 className="text-lg font-semibold mb-2">Connect {app.name}</h3>
              <p className="text-sm text-muted-foreground max-w-md mb-2">
                {app.description}
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mb-6">
                {(requiresOAuth || isApiKeyProvider)
                  ? `You'll need your ${app.name} credentials (${providerConfig.field1Label} and ${providerConfig.field2Label}) to connect securely.`
                  : `Connect your ${app.name} account to start syncing data with Loop9.`}
              </p>
              <Button
                onClick={handleConnectClick}
                disabled={connectMutation.isPending || oauthPending}
                data-testid="button-connect-cta"
              >
                {(connectMutation.isPending || oauthPending) ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-1.5" />}
                {oauthPending ? "Waiting for authorization..." : `Connect ${app.name}`}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect {app.name}?</DialogTitle>
            <DialogDescription>
              This will remove the integration, revoke access to your {app.name} account, stop all automated syncing, and delete the workflow. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectDialogOpen(false)} data-testid="button-cancel-disconnect">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              data-testid="button-confirm-disconnect"
            >
              {disconnectMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Unplug className="w-4 h-4 mr-1.5" />}
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={credentialsDialogOpen} onOpenChange={(open) => {
        setCredentialsDialogOpen(open);
        if (!open) { setClientId(""); setClientSecret(""); }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {app && getAppIcon(app.slug)} Connect {app?.name}
            </DialogTitle>
            <DialogDescription>
              {providerConfig.helpText}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {providerConfig.setupUrl && (
              <div className="flex items-center gap-2">
                <a
                  href={providerConfig.setupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1.5"
                  data-testid="link-setup-url"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {providerConfig.setupLinkText}
                </a>
              </div>
            )}

            {providerConfig.requiresRedirectUri && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Redirect / Callback URL (add this to your {app?.name} app)</Label>
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
                    onClick={() => {
                      navigator.clipboard.writeText(getOAuthRedirectUri());
                      toast({ title: "Copied", description: "Redirect URL copied to clipboard." });
                    }}
                    data-testid="button-copy-redirect-uri"
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {providerConfig.scopes && providerConfig.scopes.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Required Scopes / Permissions</Label>
                <div className="flex flex-wrap gap-1.5">
                  {providerConfig.scopes.map((scope) => (
                    <Badge key={scope} variant="secondary" className="text-xs font-mono no-default-active-elevate">
                      {scope}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="clientId">{providerConfig.field1Label}</Label>
              <Input
                id="clientId"
                type="text"
                placeholder={providerConfig.field1Placeholder}
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                data-testid="input-client-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientSecret">{providerConfig.field2Label}</Label>
              <Input
                id="clientSecret"
                type={isApiKeyProvider ? "text" : "password"}
                placeholder={providerConfig.field2Placeholder}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                data-testid="input-client-secret"
              />
            </div>
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs text-muted-foreground">
                {isApiKeyProvider
                  ? `Your ${providerConfig.field1Label} and ${providerConfig.field2Label} are encrypted and stored securely. They are used only to authenticate with ${app?.name} on your behalf.`
                  : `Your credentials are encrypted and stored securely. After entering them, you'll be redirected to ${app?.name} to authorize access to your account.`}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCredentialsDialogOpen(false)} data-testid="button-cancel-credentials">
              Cancel
            </Button>
            <Button
              onClick={handleCredentialsSubmit}
              disabled={connectMutation.isPending || !clientId.trim() || !clientSecret.trim()}
              data-testid="button-submit-credentials"
            >
              {connectMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-1.5" />}
              {connectMutation.isPending ? "Connecting..." : isApiKeyProvider ? "Connect" : "Connect & Authorize"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
