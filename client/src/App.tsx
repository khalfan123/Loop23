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
import { TopNavigation, AdminTopNavigation, TeamTopNavigation, AdminTeamTopNavigation } from "@/components/TopNavigation";
import { HybridNavigation, UserHybridNavigation, AdminHybridNavigation, TeamHybridNavigation, AdminTeamHybridNavigation } from "@/components/HybridNavigation";
import { useEffect, useState } from "react";
import { AuthStorage } from "./lib/auth-storage";
import { TeamAuth } from "./lib/team-auth";
import { useQuery } from "@tanstack/react-query";
import Dashboard from "@/pages/Dashboard";
import Campaigns from "@/pages/Campaigns";
import CreateCampaign from "@/pages/CreateCampaign";
import CampaignDetail from "@/pages/CampaignDetail";
import Calls from "@/pages/Calls";
import CallDetail from "@/pages/CallDetail";
import Analytics from "@/pages/Analytics";
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
import AllContacts from "@/pages/AllContacts";
import Settings from "@/pages/Settings";
import SettingsHub from "@/pages/SettingsHub";
import Login from "@/pages/Login";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminCampaignDetail from "@/pages/AdminCampaignDetail";
import PrivacyPolicy from "@/pages/policies/PrivacyPolicy";
import TermsOfService from "@/pages/policies/TermsOfService";
import CookiePolicy from "@/pages/policies/CookiePolicy";
import InstallWizard from "@/pages/InstallWizard";
import NotFound from "@/pages/not-found";
import FlowsPage from "@/pages/FlowsPage";
import CRMPage from "@/pages/CRMPage";
import WidgetsPage from "@/pages/WidgetsPage";
import FlowBuilderPage from "@/pages/FlowBuilderPage";
import FlowExecutionLogsPage from "@/pages/FlowExecutionLogsPage";
import WebhookConfigPage from "@/pages/WebhookConfigPage";
import FormsPage from "@/pages/FormsPage";
import AppointmentsPage from "@/pages/AppointmentsPage";
import FlowTemplatesPage from "@/pages/FlowTemplatesPage";
import IncomingConnections from "@/pages/IncomingConnections";
import IncomingCallCanvas from "@/pages/IncomingCallCanvas";
import PromptTemplates from "@/pages/PromptTemplates";
import TransactionHistory from "@/pages/TransactionHistory";
import IntegrationMarketplace from "@/pages/IntegrationMarketplace";
import IntegrationDetail from "@/pages/IntegrationDetail";
import RockCenter from "@/pages/RockCenter";
import LiveMonitoring from "@/pages/LiveMonitoring";
import LoginPage from "@/pages/LoginPage";
import TeamMemberLogin from "@/pages/TeamMemberLogin";
import AdminTeamLogin from "@/pages/AdminTeamLogin";
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
        <Route path="/team/login" component={TeamMemberLogin} />
        <Route path="/admin/team/login" component={AdminTeamLogin} />
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

function AdminRouter() {
  return (
    <AdminHybridNavigation>
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        <Switch>
          <Route path="/">
            <Redirect to="/admin" />
          </Route>
          <Route path="/admin" component={AdminDashboard} />
          <Route path="/admin/dashboard" component={AdminDashboard} />
          <Route path="/admin/campaigns/:id" component={AdminCampaignDetail} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </AdminHybridNavigation>
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
          <Route path="/app/campaigns/new" component={CreateCampaign} />
          <Route path="/app/campaigns/:id" component={CampaignDetail} />
          <Route path="/app/campaigns" component={Campaigns} />
          <Route path="/app/forms" component={FormsPage} />
          <Route path="/app/calls/:id" component={CallDetail} />
          <Route path="/app/calls" component={Calls} />
          <Route path="/app/contacts" component={AllContacts} />
          <Route path="/app/analytics" component={Analytics} />
          <Route path="/app/quality-assurance" component={QualityAssurance} />
          <Route path="/app/crm" component={CRMPage} />
          <Route path="/app/tools/widgets">
            <Redirect to="/app/settings/widgets" />
          </Route>
          <Route path="/app/billing">
            <Redirect to="/app/settings/billing" />
          </Route>
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
          <Route path="/app/appointments" component={AppointmentsPage} />
          <Route path="/app/departments" component={DepartmentManagement} />
          <Route path="/app/departments/canvas" component={DepartmentCanvas} />
          <Route path="/app/deprock" component={DeprockManagement} />
          <Route path="/app/deprock/canvas" component={DeprockCanvas} />
          <Route path="/app/deprock/flows/:id" component={FlowBuilderPage} />
          <Route path="/app/call-simulator" component={DeprockCallSimulator} />
          <Route path="/app/agents/new" component={AgentEditor} />
          <Route path="/app/agents/:id/edit" component={AgentEditor} />
          <Route path="/app/agents" component={Agents} />
          <Route path="/app/prompt-templates" component={PromptTemplates} />
          <Route path="/app/incoming-connections/canvas" component={IncomingCallCanvas} />
          <Route path="/app/incoming-connections/list" component={IncomingConnections} />
          <Route path="/app/incoming-connections" component={IncomingCallCanvas} />
          <Route path="/app/voices" component={Voices} />
          <Route path="/app/phone-numbers" component={PhoneNumbers} />
          <Route path="/app/integrations/:slug" component={IntegrationDetail} />
          <Route path="/app/integrations" component={IntegrationMarketplace} />
          <Route path="/app/tools" component={() => <div className="text-center py-16 text-muted-foreground">Tools page coming soon</div>} />
          <Route path="/app/flows/new">
            <Redirect to="/app/settings/flows/new" />
          </Route>
          <Route path="/app/flows/execution">
            <Redirect to="/app/settings/execution" />
          </Route>
          <Route path="/app/flows/webhooks">
            <Redirect to="/app/settings/webhooks" />
          </Route>
          <Route path="/app/flows/forms">
            <Redirect to="/app/settings/flows/forms" />
          </Route>
          <Route path="/app/flows/appointments">
            <Redirect to="/app/appointments" />
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
          <Route path="/app/outbound" component={() => <div className="text-center py-16 text-muted-foreground">Outbound page coming soon</div>} />
          <Route path="/app/settings/*" component={SettingsHub} />
          <Route path="/app/settings" component={SettingsHub} />
          <Route path="/app/rock-center" component={RockCenter} />
          <Route path="/app/live-monitoring" component={LiveMonitoring} />
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
          <Route path="/app/campaigns/new" component={CreateCampaign} />
          <Route path="/app/campaigns/:id" component={CampaignDetail} />
          <Route path="/app/campaigns" component={Campaigns} />
          <Route path="/app/forms" component={FormsPage} />
          <Route path="/app/calls/:id" component={CallDetail} />
          <Route path="/app/calls" component={Calls} />
          <Route path="/app/contacts" component={AllContacts} />
          <Route path="/app/analytics" component={Analytics} />
          <Route path="/app/quality-assurance" component={QualityAssurance} />
          <Route path="/app/crm" component={CRMPage} />
          <Route path="/app/tools/widgets">
            <Redirect to="/app/settings/widgets" />
          </Route>
          <Route path="/app/billing">
            <Redirect to="/app/settings/billing" />
          </Route>
          <Route path="/app/transaction-history">
            <Redirect to="/app/settings/billing?tab=credits" />
          </Route>
          <Route path="/app/knowledge-base" component={KnowledgeBase} />
          <Route path="/app/knowledge-intelligence">
            <Redirect to="/app/knowledge-base" />
          </Route>
          <Route path="/app/appointments" component={AppointmentsPage} />
          <Route path="/app/departments" component={DepartmentManagement} />
          <Route path="/app/departments/canvas" component={DepartmentCanvas} />
          <Route path="/app/deprock" component={DeprockManagement} />
          <Route path="/app/deprock/canvas" component={DeprockCanvas} />
          <Route path="/app/deprock/flows/:id" component={FlowBuilderPage} />
          <Route path="/app/call-simulator" component={DeprockCallSimulator} />
          <Route path="/app/agents/new" component={AgentEditor} />
          <Route path="/app/agents/:id/edit" component={AgentEditor} />
          <Route path="/app/agents" component={Agents} />
          <Route path="/app/prompt-templates" component={PromptTemplates} />
          <Route path="/app/incoming-connections/canvas" component={IncomingCallCanvas} />
          <Route path="/app/incoming-connections/list" component={IncomingConnections} />
          <Route path="/app/incoming-connections" component={IncomingCallCanvas} />
          <Route path="/app/voices" component={Voices} />
          <Route path="/app/phone-numbers" component={PhoneNumbers} />
          <Route path="/app/integrations/:slug" component={IntegrationDetail} />
          <Route path="/app/integrations" component={IntegrationMarketplace} />
          <Route path="/app/flows/new">
            <Redirect to="/app/settings/flows/new" />
          </Route>
          <Route path="/app/flows/execution">
            <Redirect to="/app/settings/execution" />
          </Route>
          <Route path="/app/flows/webhooks">
            <Redirect to="/app/settings/webhooks" />
          </Route>
          <Route path="/app/flows/forms">
            <Redirect to="/app/settings/flows/forms" />
          </Route>
          <Route path="/app/flows/appointments">
            <Redirect to="/app/appointments" />
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
          <Route path="/app/rock-center" component={RockCenter} />
          <Route path="/app/live-monitoring" component={LiveMonitoring} />
          <Route path="/admin" component={AdminDashboard} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </TeamHybridNavigation>
  );
}

function AdminTeamMemberRouter() {
  return (
    <AdminTeamHybridNavigation>
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        <Switch>
          <Route path="/">
            <Redirect to="/admin" />
          </Route>
          <Route path="/admin" component={AdminDashboard} />
          <Route path="/admin/dashboard" component={AdminDashboard} />
          <Route path="/admin/campaigns/:id" component={AdminCampaignDetail} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </AdminTeamHybridNavigation>
  );
}

interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
  credits?: number;
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  // Fetch user from server to validate admin access
  const { data: user, isLoading: userLoading, isError } = useQuery<User>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  // Handle auth errors
  useEffect(() => {
    if (isError) {
      AuthStorage.clearAuth();
      window.location.href = "/login";
    }
  }, [isError]);

  // Show loading while fetching user data
  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // If no user data at all (shouldn't happen after loading), redirect to login
  if (!user) {
    console.log("AdminGuard - No user data, redirecting to /login");
    return <Redirect to="/login" />;
  }

  const hasAdminAccess = user.role === 'admin';
  
  // If user doesn't have admin access, redirect to user panel
  if (!hasAdminAccess) {
    console.log("AdminGuard - User is not authorized for admin panel, redirecting to /app");
    return <Redirect to="/app" />;
  }

  console.log("AdminGuard - User has admin access, rendering admin panel");
  return <>{children}</>;
}

interface AdminTeamMemberInfo {
  id: string;
  email: string;
  status: string;
  role?: {
    id: string;
    name: string;
  };
}

function AdminTeamGuard({ children }: { children: React.ReactNode }) {
  // Validate admin team member JWT token via server
  const { data: authData, isLoading, isError } = useQuery<{ 
    member: AdminTeamMemberInfo; 
    team: { id: string; name: string }; 
    permissions: Record<string, Record<string, any>> 
  }>({
    queryKey: ["/api/admin/team/auth/me"],
    queryFn: async () => {
      const token = TeamAuth.getToken();
      if (!token) throw new Error("No token");
      const response = await fetch("/api/admin/team/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Invalid session");
      return response.json();
    },
    retry: false,
  });

  // Handle auth errors
  useEffect(() => {
    if (isError) {
      TeamAuth.clearAuth();
      window.location.href = "/admin/team/login";
    }
  }, [isError]);

  // Show loading while validating token
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // If no auth data, redirect to admin team login
  if (!authData || !authData.member) {
    console.log("AdminTeamGuard - No valid session, redirecting to /admin/team/login");
    TeamAuth.clearAuth();
    return <Redirect to="/admin/team/login" />;
  }

  // Check member status
  if (authData.member.status !== 'active') {
    console.log("AdminTeamGuard - Member not active, redirecting to /admin/team/login");
    TeamAuth.clearAuth();
    return <Redirect to="/admin/team/login" />;
  }

  console.log("AdminTeamGuard - Admin team member validated, rendering admin panel");
  return <>{children}</>;
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
  // Initialize auth state synchronously from localStorage to prevent flash
  // Check both regular user auth AND team member auth
  const [isAuthenticated, setIsAuthenticated] = useState(() => 
    AuthStorage.isAuthenticated() || TeamAuth.isAuthenticated()
  );
  const [isTeamMember, setIsTeamMember] = useState(() => TeamAuth.isAuthenticated());
  const [isAdminTeamMember, setIsAdminTeamMember] = useState(() => TeamAuth.isAdminTeamMember());
  const [isChecking, setIsChecking] = useState(true);

  // Check installation status
  const { data: installStatus } = useQuery<{ installed: boolean }>({
    queryKey: ["/api/installer/status"],
    retry: false,
  });

  // Verify auth state and mark checking complete
  useEffect(() => {
    // Re-verify from storage in case it changed
    const regularAuth = AuthStorage.isAuthenticated();
    const teamAuth = TeamAuth.isAuthenticated();
    const adminTeamAuth = TeamAuth.isAdminTeamMember();
    setIsAuthenticated(regularAuth || teamAuth);
    setIsTeamMember(teamAuth);
    setIsAdminTeamMember(adminTeamAuth);
    setIsChecking(false);
  }, []);

  // Debug logging
  useEffect(() => {
    console.log("Router - Current location:", location);
    console.log("Router - isAuthenticated:", isAuthenticated);
    console.log("Router - location.startsWith('/admin'):", location.startsWith('/admin'));
    console.log("Router - location.startsWith('/app'):", location.startsWith('/app'));
  }, [location, isAuthenticated]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Installation check - if not installed, redirect to installer unless already on /install
  if (installStatus && !installStatus.installed && location !== '/install') {
    console.log("Router - Not installed, redirecting to /install");
    return <Redirect to="/install" />;
  }

  // Block installer if already installed
  if (location === '/install' && installStatus?.installed) {
    console.log("Router - Already installed, redirecting to /login");
    return <Redirect to="/login" />;
  }

  // Installer route (public, no auth required)
  if (location === '/install') {
    console.log("Router - Rendering InstallWizard");
    return <InstallWizard />;
  }

  // Redirect authenticated users away from login/register immediately
  // This prevents the flash when page reloads after login
  if (isAuthenticated && (location === '/login' || location === '/register')) {
    // Admin team members go to /admin
    if (isAdminTeamMember) {
      console.log("Router - Authenticated admin team member on auth page, redirecting to /admin");
      return <Redirect to="/admin" />;
    }
    // User team members go to /app
    if (isTeamMember) {
      console.log("Router - Authenticated team member on auth page, redirecting to /app");
      return <Redirect to="/app" />;
    }
    const user = AuthStorage.getUser();
    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
    const redirectTo = isAdmin ? '/admin' : '/app';
    console.log("Router - Authenticated user on auth page, redirecting to", redirectTo);
    return <Redirect to={redirectTo} />;
  }

  // Redirect authenticated team members away from team login page
  if (isTeamMember && location === '/team/login') {
    const redirectTo = isAdminTeamMember ? '/admin' : '/app';
    console.log("Router - Authenticated team member on team login page, redirecting to", redirectTo);
    return <Redirect to={redirectTo} />;
  }

  // Redirect authenticated admin team members away from admin team login page
  if (isAdminTeamMember && location === '/admin/team/login') {
    console.log("Router - Authenticated admin team member on admin team login page, redirecting to /admin");
    return <Redirect to="/admin" />;
  }

  // Admin routes - protected by server-side validation
  // Check this BEFORE public routes to prevent flash during login transition
  if (location.startsWith('/admin') && !location.startsWith('/admin/team/login')) {
    // Admin team members get the AdminTeamGuard + AdminTeamMemberRouter with permission-based sidebar
    if (isAdminTeamMember) {
      console.log("Router - Rendering AdminTeamGuard + AdminTeamMemberRouter (admin team member)");
      return (
        <AdminTeamGuard>
          <AdminTeamMemberRouter />
        </AdminTeamGuard>
      );
    }
    console.log("Router - Rendering AdminGuard + AdminRouter");
    return (
      <AdminGuard>
        <AdminRouter />
      </AdminGuard>
    );
  }

  // User routes (/app) - protected by server-side validation
  // Check this BEFORE public routes to prevent flash during login transition
  if (location.startsWith('/app')) {
    // Team members get the TeamMemberRouter with permission-based sidebar
    if (isTeamMember) {
      console.log("Router - Rendering UserGuard + TeamMemberRouter (team member)");
      return (
        <UserGuard>
          <TeamMemberRouter />
        </UserGuard>
      );
    }
    console.log("Router - Rendering UserGuard + UserRouter");
    return (
      <UserGuard>
        <UserRouter />
      </UserGuard>
    );
  }

  // Public routes (landing, login, register)
  console.log("Router - Rendering PublicRouter");
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
