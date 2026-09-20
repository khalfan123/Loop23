/**
 * ============================================================
 * © 2025 Diploy — a brand of Bisht Technologies Private Limited
 * Original Author: BTPL Engineering Team
 * Website: https://diploy.in
 * Contact: cs@diploy.in
 *
 * Distributed under the Envato / CodeCanyon License Agreement.
 * Licensed to the purchaser for use as defined by the
 * Envato Market (CodeCanyon) Regular or Extended License.
 *
 * You are NOT permitted to redistribute, resell, sublicense,
 * or share this source code, in whole or in part.
 * Respect the author's rights and Envato licensing terms.
 * ============================================================
 */
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { BrandingProvider, useBranding } from "@/components/BrandingProvider";
import { DirectionProvider } from "@/components/DirectionProvider";
import { TopNavigation, TeamTopNavigation } from "@/components/TopNavigation";
import { HybridNavigation, UserHybridNavigation, TeamHybridNavigation } from "@/components/HybridNavigation";
import { useEffect, useState } from "react";
import { AuthStorage } from "./lib/auth-storage";
import { TeamAuth } from "./lib/team-auth";
import { useQuery } from "@tanstack/react-query";
import Dashboard from "@/pages/Dashboard";
import Campaigns from "@/pages/Campaigns";
import CallDetail from "@/pages/CallDetail";
import Analytics from "@/pages/Analytics";
import DashboardLive from "@/pages/DashboardLive";
import QualityAssurance from "@/pages/QualityAssurance";
import PaymentResult from "@/pages/PaymentResult";
import KnowledgeBase from "@/pages/KnowledgeBase";
import DepartmentManagement from "@/pages/DepartmentManagement";
import DepartmentCanvas from "@/pages/DepartmentCanvas";
import DeprockManagement from "@/pages/DeprockManagement";
import DeprockCanvas from "@/pages/DeprockCanvas";
import DeprockCallSimulator from "@/pages/DeprockCallSimulator";
import Agents from "@/pages/Agents";
import AgentEditor from "@/pages/AgentEditor";
import Voices from "@/pages/Voices";
import PhoneNumbers from "@/pages/PhoneNumbers";
import SipTrunkingPage from "@/pages/SipTrunkingPage";
import AllContacts from "@/pages/AllContacts";
import Settings from "@/pages/Settings";
import SettingsHub from "@/pages/SettingsHub";
import BrandingAdmin from "@/pages/BrandingAdmin";
import WhatsappDidPoolPage from "@/pages/admin/WhatsappDidPoolPage";
import Login from "@/pages/Login";
import PrivacyPolicy from "@/pages/policies/PrivacyPolicy";
import TermsOfService from "@/pages/policies/TermsOfService";
import CookiePolicy from "@/pages/policies/CookiePolicy";
import NotFound from "@/pages/not-found";
import FlowsPage from "@/pages/FlowsPage";
import CRMPage from "@/pages/CRMPage";
import WidgetsPage from "@/pages/WidgetsPage";
import RebrandAnnouncement from "@/pages/RebrandAnnouncement";
import FlowBuilderPage from "@/pages/FlowBuilderPage";
import FlowExecutionLogsPage from "@/pages/FlowExecutionLogsPage";
import FormsPage from "@/pages/FormsPage";
import AppointmentsPage from "@/pages/AppointmentsPage";
import CallpilotHub from "@/pages/CallpilotHub";
import FlowTemplatesPage from "@/pages/FlowTemplatesPage";
import IncomingConnections from "@/pages/IncomingConnections";
import IncomingCallCanvas from "@/pages/IncomingCallCanvas";
import OutboundCanvas from "@/pages/OutboundCanvas";
import PromptTemplates from "@/pages/PromptTemplates";
import TransactionHistory from "@/pages/TransactionHistory";
import IntegrationsPanel from "@/pages/IntegrationsPanel";
import IntegrationDetail from "@/pages/IntegrationDetail";
import IntegrationsConcierge from "@/pages/IntegrationsConcierge";
import Inbox from "@/pages/Inbox";
import SmsHub from "@/pages/SmsHub";
import SmsRatesPage from "@/pages/admin/SmsRatesPage";
import WhatsappSetup from "@/pages/WhatsappSetup";
import WhatsappSetupComplete from "@/pages/WhatsappSetupComplete";
import WhatsappChannels from "@/pages/WhatsappChannels";
import WhatsappTemplates from "@/pages/WhatsappTemplates";
import WhatsappBusinessProfile from "@/pages/WhatsappBusinessProfile";
import WhatsappAudience from "@/pages/WhatsappAudience";
import WhatsappAutomations from "@/pages/WhatsappAutomations";
import WhatsappBroadcasts from "@/pages/WhatsappBroadcasts";
import RockCenter from "@/pages/RockCenter";
import LoginPage from "@/pages/LoginPage";
import OnboardingPage from "@/pages/OnboardingPage";
import TeamMemberLogin from "@/pages/TeamMemberLogin";
import Billing from "@/pages/Billing";
import { ScrollToTop } from "@/components/ScrollToTop";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { AnalyticsScripts } from "@/components/AnalyticsScripts";
import { SessionTimeoutDialog } from "@/components/SessionTimeoutDialog";
import { useActivityTimeout } from "@/hooks/useActivityTimeout";
import { useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";
import { PluginRegistryProvider } from "@/contexts/plugin-registry";
import { PluginBootstrapper } from "@/components/plugin-bootstrapper";
import { DynamicLanguagesProvider } from "@/contexts/dynamic-languages";

function SessionTimeoutWrapper({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  
  const handleTimeout = useCallback(() => {
    // Logout request sends HttpOnly cookie automatically via credentials: 'include'
    fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
    AuthStorage.clearAuth();
    queryClient.clear();
    setLocation('/login');
  }, [setLocation]);

  const { isWarningVisible, remainingTime, dismissWarning } = useActivityTimeout({
    enabled: AuthStorage.isAuthenticated(),
    onTimeout: handleTimeout,
    warningThresholdMs: 5 * 60 * 1000,
  });

  return (
    <>
      {children}
      <SessionTimeoutDialog
        open={isWarningVisible}
        remainingTime={remainingTime}
        onContinue={dismissWarning}
        onLogout={handleTimeout}
      />
    </>
  );
}


function PublicRouter() {
  return (
    <>
      <ScrollToTop />
      <Switch>
        <Route path="/">
          <Redirect to="/login" />
        </Route>
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={LoginPage} />
        <Route path="/rebrand" component={RebrandAnnouncement} />
        <Route path="/onboarding" component={OnboardingPage} />
        <Route path="/team/login" component={TeamMemberLogin} />
        <Route path="/privacy" component={PrivacyPolicy} />
        <Route path="/terms" component={TermsOfService} />
        <Route path="/cookies" component={CookiePolicy} />
        <Route>
          <Redirect to="/login" />
        </Route>
      </Switch>
    </>
  );
}


function UserRouter() {
  return (
    <UserHybridNavigation>
      <div className="w-full px-4 md:px-8 lg:px-12 py-4 md:py-6">
        <Switch>
          <Route path="/">
            <Redirect to="/app" />
          </Route>
          <Route path="/app">
            <Redirect to="/app/analytics" />
          </Route>
          <Route path="/app/dashboard" component={Dashboard} />
          <Route path="/app/forms">
            <Redirect to="/app/ops" />
          </Route>
          <Route path="/app/calls/:id" component={CallDetail} />
          <Route path="/app/calls">
            <Redirect to="/app/analytics" />
          </Route>
          <Route path="/app/contacts" component={AllContacts} />
          <Route path="/app/analytics" component={Analytics} />
          <Route path="/app/live" component={DashboardLive} />
          <Route path="/app/quality-assurance" component={QualityAssurance} />
          <Route path="/app/ops" component={CallpilotHub} />
          <Route path="/ops" component={CallpilotHub} />
          <Route path="/app/tools/widgets">
            <Redirect to="/app/settings/widgets" />
          </Route>
          <Route path="/app/billing" component={Billing} />
          <Route path="/app/payment-result" component={PaymentResult} />
          <Route path="/app/transaction-history">
            <Redirect to="/app/settings/billing?tab=credits" />
          </Route>
          <Route path="/app/upgrade">
            <Redirect to="/app/settings/billing" />
          </Route>
          <Route path="/app/knowledge-base" component={KnowledgeBase} />
          <Route path="/app/knowledge-intelligence">
            <Redirect to="/app/knowledge-base" />
          </Route>
          <Route path="/app/appointments">
            <Redirect to="/app/ops" />
          </Route>
          <Route path="/app/departtest" component={DepartmentManagement} />
          <Route path="/app/departtest/canvas" component={DepartmentCanvas} />
          <Route path="/app/deprock" component={DeprockManagement} />
          <Route path="/app/deprock/canvas" component={DeprockCanvas} />
          <Route path="/app/deprock/flows/:id" component={FlowBuilderPage} />
          <Route path="/app/deprock/call-simulator" component={DeprockCallSimulator} />
          <Route path="/app/call-simulator" component={DeprockCallSimulator} />
          <Route path="/app/agents/new" component={AgentEditor} />
          <Route path="/app/agents/:id/edit" component={AgentEditor} />
          <Route path="/app/agents" component={Agents} />
          <Route path="/app/prompt-templates" component={PromptTemplates} />
          <Route path="/app/incoming-connections/canvas" component={IncomingCallCanvas} />
          <Route path="/app/incoming-connections/list" component={IncomingConnections} />
          <Route path="/app/incoming-connections" component={IncomingCallCanvas} />
          <Route path="/app/voices" component={Voices} />
          <Route path="/app/phone-numbers/sip-trunking" component={SipTrunkingPage} />
          <Route path="/app/phone-numbers" component={PhoneNumbers} />
          <Route path="/app/integrations/concierge" component={IntegrationsConcierge} />
          <Route path="/app/integrations/:slug" component={IntegrationDetail} />
          <Route path="/app/integrations" component={IntegrationsPanel} />
          <Route path="/app/inbox/whatsapp-setup/complete" component={WhatsappSetupComplete} />
          <Route path="/app/inbox/whatsapp-setup" component={WhatsappSetup} />
          <Route path="/app/inbox" component={Inbox} />
          <Route path="/app/sms/setup" component={SmsHub} />
          <Route path="/app/sms" component={SmsHub} />
          <Route path="/app/channels/whatsapp" component={WhatsappChannels} />
          <Route path="/app/whatsapp/templates" component={WhatsappTemplates} />
          <Route path="/app/whatsapp/business-profile/:senderId" component={WhatsappBusinessProfile} />
          <Route path="/app/whatsapp/audience" component={WhatsappAudience} />
          <Route path="/app/whatsapp/automations" component={WhatsappAutomations} />
          <Route path="/app/whatsapp/broadcasts" component={WhatsappBroadcasts} />
          <Route path="/app/tools" component={() => <div className="text-center py-16 text-muted-foreground">Tools page coming soon</div>} />
          <Route path="/app/flows/new">
            <Redirect to="/app/settings/flows/new" />
          </Route>
          <Route path="/app/flows/execution">
            <Redirect to="/app/settings/execution" />
          </Route>
          <Route path="/app/flows/webhooks">
            <Redirect to="/app/settings/automation" />
          </Route>
          <Route path="/app/flows/forms">
            <Redirect to="/app/settings/flows/forms" />
          </Route>
          <Route path="/app/flows/appointments">
            <Redirect to="/app/ops" />
          </Route>
          <Route path="/app/flows/templates">
            <Redirect to="/app/settings/flows?tab=templates" />
          </Route>
          <Route path="/app/flows/:id">
            {(params) => <Redirect to={`/app/settings/flows/${params.id}`} />}
          </Route>
          <Route path="/app/flows">
            <Redirect to="/app/settings/flows" />
          </Route>
          <Route path="/app/outbound" component={OutboundCanvas} />
          <Route path="/app/admin/branding" component={BrandingAdmin} />
          <Route path="/app/admin/whatsapp-pool" component={WhatsappDidPoolPage} />
          <Route path="/app/admin/sms-rates" component={SmsRatesPage} />
          <Route path="/app/admin">
            <Redirect to="/app/admin/branding" />
          </Route>
          <Route path="/app/settings/*" component={SettingsHub} />
          <Route path="/app/settings" component={SettingsHub} />
          <Route path="/app/live-monitoring">
            <Redirect to="/app/live" />
          </Route>
          <Route path="/app/developers" component={() => <div className="text-center py-16 text-muted-foreground">Developers page coming soon</div>} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </UserHybridNavigation>
  );
}

function TeamMemberRouter() {
  return (
    <TeamHybridNavigation>
      <div className="w-full px-4 md:px-8 lg:px-12 py-4 md:py-6">
        <Switch>
          <Route path="/">
            <Redirect to="/app" />
          </Route>
          <Route path="/app">
            <Redirect to="/app/analytics" />
          </Route>
          <Route path="/app/dashboard" component={Dashboard} />
          <Route path="/app/forms">
            <Redirect to="/app/ops" />
          </Route>
          <Route path="/app/calls/:id" component={CallDetail} />
          <Route path="/app/calls">
            <Redirect to="/app/analytics" />
          </Route>
          <Route path="/app/contacts" component={AllContacts} />
          <Route path="/app/analytics" component={Analytics} />
          <Route path="/app/live" component={DashboardLive} />
          <Route path="/app/quality-assurance" component={QualityAssurance} />
          <Route path="/app/ops" component={CallpilotHub} />
          <Route path="/ops" component={CallpilotHub} />
          <Route path="/app/tools/widgets">
            <Redirect to="/app/settings/widgets" />
          </Route>
          <Route path="/app/billing" component={Billing} />
          <Route path="/app/transaction-history">
            <Redirect to="/app/settings/billing?tab=credits" />
          </Route>
          <Route path="/app/knowledge-base" component={KnowledgeBase} />
          <Route path="/app/knowledge-intelligence">
            <Redirect to="/app/knowledge-base" />
          </Route>
          <Route path="/app/appointments">
            <Redirect to="/app/ops" />
          </Route>
          <Route path="/app/deprock" component={DeprockManagement} />
          <Route path="/app/deprock/canvas" component={DeprockCanvas} />
          <Route path="/app/deprock/flows/:id" component={FlowBuilderPage} />
          <Route path="/app/deprock/call-simulator" component={DeprockCallSimulator} />
          <Route path="/app/call-simulator" component={DeprockCallSimulator} />
          <Route path="/app/agents/new" component={AgentEditor} />
          <Route path="/app/agents/:id/edit" component={AgentEditor} />
          <Route path="/app/agents" component={Agents} />
          <Route path="/app/prompt-templates" component={PromptTemplates} />
          <Route path="/app/incoming-connections/canvas" component={IncomingCallCanvas} />
          <Route path="/app/incoming-connections/list" component={IncomingConnections} />
          <Route path="/app/incoming-connections" component={IncomingCallCanvas} />
          <Route path="/app/voices" component={Voices} />
          <Route path="/app/phone-numbers/sip-trunking" component={SipTrunkingPage} />
          <Route path="/app/phone-numbers" component={PhoneNumbers} />
          <Route path="/app/integrations/concierge" component={IntegrationsConcierge} />
          <Route path="/app/integrations/:slug" component={IntegrationDetail} />
          <Route path="/app/integrations" component={IntegrationsPanel} />
          <Route path="/app/flows/new">
            <Redirect to="/app/settings/flows/new" />
          </Route>
          <Route path="/app/flows/execution">
            <Redirect to="/app/settings/execution" />
          </Route>
          <Route path="/app/flows/webhooks">
            <Redirect to="/app/settings/automation" />
          </Route>
          <Route path="/app/flows/forms">
            <Redirect to="/app/settings/flows/forms" />
          </Route>
          <Route path="/app/flows/appointments">
            <Redirect to="/app/ops" />
          </Route>
          <Route path="/app/flows/templates">
            <Redirect to="/app/settings/flows?tab=templates" />
          </Route>
          <Route path="/app/flows/:id">
            {(params) => <Redirect to={`/app/settings/flows/${params.id}`} />}
          </Route>
          <Route path="/app/flows">
            <Redirect to="/app/settings/flows" />
          </Route>
          <Route path="/app/settings/*" component={SettingsHub} />
          <Route path="/app/settings" component={SettingsHub} />
          <Route path="/app/live-monitoring">
            <Redirect to="/app/live" />
          </Route>
          <Route component={NotFound} />
        </Switch>
      </div>
    </TeamHybridNavigation>
  );
}

interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
  credits?: number;
}

function UserGuard({ children }: { children: React.ReactNode }) {
  const [isTeamMember, setIsTeamMember] = useState(() => TeamAuth.isAuthenticated());
  const [teamAuthValid, setTeamAuthValid] = useState<boolean | null>(null);
  const [teamAuthLoading, setTeamAuthLoading] = useState(isTeamMember);

  // Fetch user from server (for regular users)
  const { data: user, isLoading, isError } = useQuery<User>({
    queryKey: ["/api/auth/me"],
    retry: false,
    enabled: !isTeamMember, // Only fetch for non-team-members
  });

  // Validate team member session
  useEffect(() => {
    if (isTeamMember) {
      setTeamAuthLoading(true);
      TeamAuth.validateSession().then(result => {
        setTeamAuthValid(result.valid);
        setTeamAuthLoading(false);
        if (!result.valid) {
          TeamAuth.clearAuth();
        }
      });
    }
  }, [isTeamMember]);

  // Handle auth errors for regular users
  useEffect(() => {
    if (!isTeamMember && isError) {
      AuthStorage.clearAuth();
      window.location.href = "/login";
    }
  }, [isError, isTeamMember]);

  // Show loading state
  if (isTeamMember ? teamAuthLoading : isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Team member authentication check
  if (isTeamMember) {
    if (teamAuthValid === false) {
      return <Redirect to="/team/login" />;
    }
    // Team member is valid, render children
    return <>{children}</>;
  }

  // Regular user authentication check
  if (!user) {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}

function Router() {
  const [location] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(() => 
    AuthStorage.isAuthenticated() || TeamAuth.isAuthenticated()
  );
  const [isTeamMember, setIsTeamMember] = useState(() => TeamAuth.isAuthenticated());
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const regularAuth = AuthStorage.isAuthenticated();
    const teamAuth = TeamAuth.isAuthenticated();
    setIsAuthenticated(regularAuth || teamAuth);
    setIsTeamMember(teamAuth);
    setIsChecking(false);
  }, []);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isAuthenticated && (location === '/login' || location === '/register')) {
    if (isTeamMember) {
      return <Redirect to="/app" />;
    }
    return <Redirect to="/app" />;
  }

  if (isTeamMember && location === '/team/login') {
    return <Redirect to="/app" />;
  }

  if (location.startsWith('/app')) {
    if (isTeamMember) {
      return (
        <UserGuard>
          <TeamMemberRouter />
        </UserGuard>
      );
    }
    return (
      <UserGuard>
        <UserRouter />
      </UserGuard>
    );
  }

  return <PublicRouter />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <DirectionProvider>
          <BrandingProvider>
            <PluginRegistryProvider>
              <PluginBootstrapper>
                <DynamicLanguagesProvider>
                  <TooltipProvider>
                    <AnalyticsScripts />
                    <SessionTimeoutWrapper>
                      <Router />
                    </SessionTimeoutWrapper>
                    <Toaster />
                    <CookieConsentBanner />
                  </TooltipProvider>
                </DynamicLanguagesProvider>
              </PluginBootstrapper>
            </PluginRegistryProvider>
          </BrandingProvider>
        </DirectionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
