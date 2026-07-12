import { useMemo } from "react";
import { useLocation, Switch, Route, Redirect, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import AutomationOverview from "./AutomationOverview";
import MarketplacePage from "./MarketplacePage";
import MyAutomationsPage from "./MyAutomationsPage";
import ApiWebhooksPage from "./ApiWebhooksPage";

function useAutomationSection(location: string) {
  const { t } = useTranslation();
  return useMemo(() => {
    if (location.startsWith("/app/settings/automation/starter")) {
      return t("automation.tabs.starterPack", "Starter pack");
    }
    if (location.startsWith("/app/settings/automation/mine")) {
      return t("automation.tabs.mine", "My Automations");
    }
    if (location.startsWith("/app/settings/automation/api")) {
      return t("automation.tabs.api", "API & Webhooks");
    }
    return t("automation.tabs.marketplace", "Marketplace");
  }, [location, t]);
}

export default function AutomationHub() {
  const { t } = useTranslation();
  const [location] = useLocation();
  const section = useAutomationSection(location);

  return (
    <div className="-m-6">
      <div className="px-6 pt-5 pb-4 border-b border-[var(--l9-border,#EEF0F3)] bg-white">
        <h1
          className="text-[11px] font-semibold tracking-tight text-[#0F172A]"
          data-testid="automation-page-title"
        >
          <Link
            href="/app/settings/automation/marketplace"
            className="text-[rgba(60,60,67,0.55)] hover:text-[#2563EB] transition-colors font-semibold"
          >
            {t("automation.hub.title", "Automation")}
          </Link>
          <span className="mx-2 font-normal text-[rgba(60,60,67,0.35)]" aria-hidden>
            &gt;
          </span>
          <span>{section}</span>
        </h1>
      </div>

      <RouteErrorBoundary label={`automation:${location}`} resetKey={location}>
        <Switch>
          <Route
            path="/app/settings/automation/marketplace/apps/:slug"
            component={MarketplacePage}
          />
          <Route
            path="/app/settings/automation/marketplace/:templateId"
            component={MarketplacePage}
          />
          <Route
            path="/app/settings/automation/marketplace"
            component={MarketplacePage}
          />
          <Route path="/app/settings/automation/starter" component={AutomationOverview} />
          <Route path="/app/settings/automation/mine" component={MyAutomationsPage} />
          <Route path="/app/settings/automation/api" component={ApiWebhooksPage} />
          <Route path="/app/settings/automation">
            <Redirect to="/app/settings/automation/marketplace" />
          </Route>
          <Route>
            <Redirect to="/app/settings/automation/marketplace" />
          </Route>
        </Switch>
      </RouteErrorBoundary>
    </div>
  );
}
