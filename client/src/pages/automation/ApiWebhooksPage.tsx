import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Shield, Webhook } from "lucide-react";
import { ApiKeysTab } from "@/components/api-keys/ApiKeysTab";

interface EventCatalog {
  events: string[];
  payloadDocumentation: string;
  hmac: { header: string; format: string; algorithm: string };
}

export default function ApiWebhooksPage() {
  const { t } = useTranslation();
  const { data: eventCatalog } = useQuery<EventCatalog>({
    queryKey: ["/api/webhooks/event-catalog"],
  });

  return (
    <div className="px-6 py-6 max-w-[1200px] mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-semibold">
          {t("automation.api.title", "API & webhook reference")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(
            "automation.api.subtitle",
            "Manage API keys for the REST API and review payload schemas + signature verification for outgoing webhooks.",
          )}
        </p>
      </div>

      <Card className="rounded-xl border-border/40 bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            {t("automation.api.hmac.title", "Signed payloads")}
          </CardTitle>
          <CardDescription>
            {t(
              "automation.api.hmac.subtitle",
              "Every outgoing webhook is signed so you can verify it's from us.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {eventCatalog?.hmac ? (
            <div className="rounded-lg bg-muted/40 p-3 font-mono text-xs space-y-1">
              <div>
                <span className="text-foreground">
                  {eventCatalog.hmac.header}
                </span>
                : {eventCatalog.hmac.format}
              </div>
              <div>{eventCatalog.hmac.algorithm}</div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("automation.api.hmac.loading", "Loading signature info…")}
            </p>
          )}

          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1 text-sm text-primary hover:underline">
              <ChevronDown className="h-4 w-4" />
              {t("automation.api.payloadRef", "Payload field reference")}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 max-h-72 overflow-y-auto rounded-md border border-border/40 p-3 text-xs whitespace-pre-wrap font-mono bg-muted/20">
              {eventCatalog?.payloadDocumentation ||
                t("automation.api.loadingCatalog", "Loading reference…")}
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      <div data-testid="section-api-keys">
        <ApiKeysTab />
      </div>

      <Card className="rounded-xl border-border/40 bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Webhook className="h-4 w-4 text-muted-foreground" />
            {t("automation.api.events.title", "Event catalog")}
          </CardTitle>
          <CardDescription>
            {t(
              "automation.api.events.subtitle",
              "All events your endpoints can subscribe to.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {eventCatalog?.events && eventCatalog.events.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {eventCatalog.events.map((ev) => (
                <code
                  key={ev}
                  className="text-[11px] font-mono rounded bg-muted/50 px-2 py-1"
                >
                  {ev}
                </code>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("automation.api.events.loading", "Loading events…")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
