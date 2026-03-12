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
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, CreditCard, Settings, BarChart, Phone, Package, Bell, ListOrdered, Loader2, CheckCircle2, XCircle, ContactRound, DollarSign, RefreshCw, Server, Receipt, Mail, MessageSquare, Headphones, ShieldAlert, Brain, Power, Mic, Sparkles, Building2, Zap, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import UserManagement from "@/components/admin/UserManagement";
import PlanManagement from "@/components/admin/PlanManagement";
import LLMModelsManagement from "@/components/admin/LLMModelsManagement";
import CreditPackages from "@/components/admin/CreditPackages";
import SettingsPage from "@/components/admin/SettingsPage";
import Analytics from "@/components/admin/Analytics";
import PhoneNumbers from "@/components/admin/PhoneNumbers";
import Notifications from "@/components/admin/Notifications";
import BatchJobsMonitor from "@/components/admin/BatchJobsMonitor";
import AllContactsAdmin from "@/components/admin/AllContactsAdmin";
import PaymentsSettings from "@/components/admin/PaymentsSettings";
import TransactionsManagement from "@/components/admin/TransactionsManagement";
import EmailSettingsManagement from "@/components/admin/EmailSettingsManagement";
import CallMonitoring from "@/components/admin/CallMonitoring";
import BannedWordsManagement from "@/components/admin/BannedWordsManagement";
import CallErrorLogs from "@/components/admin/CallErrorLogs";
import OpenAIPoolManagement from "@/components/admin/OpenAIPoolManagement";
import PlivoSettings from "@/components/admin/PlivoSettings";
import IntegrationTestPanel from "@/components/admin/IntegrationTestPanel";
import { Badge } from "@/components/ui/badge";
import { Suspense } from "react";
import { usePluginRegistry } from "@/contexts/plugin-registry";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AuthStorage } from "@/lib/auth-storage";
import { useToast } from "@/hooks/use-toast";
import { usePluginStatus } from "@/hooks/use-plugin-status";

interface ConnectionStatus {
  connected: boolean;
  error?: string;
  accountName?: string;
  accountStatus?: string;
  voiceCount?: number;
  details?: string;
}

export default function AdminDashboard() {
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState("analytics");
  const [twilioStatus, setTwilioStatus] = useState<ConnectionStatus | null>(null);
  const [elevenLabsStatus, setElevenLabsStatus] = useState<ConnectionStatus | null>(null);
  const [openaiStatus, setOpenaiStatus] = useState<ConnectionStatus | null>(null);
  const [openaiRealtimeStatus, setOpenaiRealtimeStatus] = useState<ConnectionStatus | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const { isTeamManagementPluginEnabled } = usePluginStatus();
  const pluginRegistry = usePluginRegistry();
  const adminMenuItems = pluginRegistry.getAdminMenuItems();
  const adminSettingsTabs = pluginRegistry.getAdminSettingsTabs();

  // Fetch application version
  const { data: versionData } = useQuery<{ version: string }>({
    queryKey: ["/api/system/version"],
    staleTime: Infinity,
  });

  // Get analytics summary
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["/api/admin/analytics"],
  });

  // Get global settings to check configuration
  // Auto-refresh every 60 minutes and on window focus to keep connection status current
  const { data: settings, isLoading: settingsLoading, refetch: refetchSettings, isFetching } = useQuery({
    queryKey: ["/api/admin/settings"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/admin/settings?t=${Date.now()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }
      return response.json();
    },
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 60 * 1000, // 60 minutes
    staleTime: 0,
  });

  // Promise chain for serialized connection checks - ensures every trigger runs in order
  const checkChainRef = useRef<Promise<void>>(Promise.resolve());
  const wasFetchingRef = useRef(false);
  const hasCheckedRef = useRef(false);

  // Perform the actual connection test - internal function
  const performConnectionCheck = async (settingsToUse: any): Promise<void> => {
    setCheckingStatus(true);
    
    try {
      // Test Twilio connection
      if (settingsToUse?.twilio_configured) {
        try {
          const twilioResponse = await apiRequest("POST", "/api/admin/test-connection/twilio");
          const twilioResult = await twilioResponse.json();
          setTwilioStatus(twilioResult as ConnectionStatus);
        } catch (err) {
          setTwilioStatus({ connected: false, error: `Test failed: ${err instanceof Error ? err.message : 'Unknown error'}` });
        }
      } else {
        setTwilioStatus({ connected: false, error: 'Not configured' });
      }

      // Test ElevenLabs connection
      if (settingsToUse?.elevenlabs_configured) {
        try {
          const elevenLabsResponse = await apiRequest("POST", "/api/admin/test-connection/elevenlabs");
          const elevenLabsResult = await elevenLabsResponse.json();
          setElevenLabsStatus(elevenLabsResult as ConnectionStatus);
        } catch (err) {
          setElevenLabsStatus({ connected: false, error: `Test failed: ${err instanceof Error ? err.message : 'Unknown error'}` });
        }
      } else {
        setElevenLabsStatus({ connected: false, error: 'Not configured' });
      }

      // Test OpenAI connection (embeddings/GPT models)
      if (settingsToUse?.openai_configured) {
        try {
          const openaiResponse = await apiRequest("POST", "/api/admin/test-connection/openai");
          const openaiResult = await openaiResponse.json();
          setOpenaiStatus(openaiResult as ConnectionStatus);
        } catch (err) {
          setOpenaiStatus({ connected: false, error: `Test failed: ${err instanceof Error ? err.message : 'Unknown error'}` });
        }
      } else {
        setOpenaiStatus({ connected: false, error: 'Not configured' });
      }

      // Test OpenAI Realtime Voice API connection
      if (settingsToUse?.openai_realtime_configured) {
        try {
          const realtimeResponse = await apiRequest("POST", "/api/admin/test-connection/openai-realtime");
          const realtimeResult = await realtimeResponse.json();
          setOpenaiRealtimeStatus(realtimeResult as ConnectionStatus);
        } catch (err) {
          setOpenaiRealtimeStatus({ connected: false, error: `Test failed: ${err instanceof Error ? err.message : 'Unknown error'}` });
        }
      } else {
        setOpenaiRealtimeStatus({ connected: false, error: 'Not configured' });
      }
    } catch (error) {
      console.error('Error checking API connections:', error);
      setTwilioStatus({ connected: false, error: 'Check failed' });
      setElevenLabsStatus({ connected: false, error: 'Check failed' });
      setOpenaiStatus({ connected: false, error: 'Check failed' });
      setOpenaiRealtimeStatus({ connected: false, error: 'Check failed' });
    } finally {
      setCheckingStatus(false);
    }
  };

  // Queue a connection check - chains onto existing promise to ensure serial execution
  const checkAPIConnections = (currentSettings?: any) => {
    const settingsToUse = currentSettings || settings;
    if (!settingsToUse) return;
    
    // Chain this check onto the existing promise chain
    checkChainRef.current = checkChainRef.current
      .then(() => performConnectionCheck(settingsToUse))
      .catch((err) => {
        console.error('Connection check chain error:', err);
        // Reset error states on chain failure
        setTwilioStatus({ connected: false, error: 'Check failed' });
        setElevenLabsStatus({ connected: false, error: 'Check failed' });
        setOpenaiStatus({ connected: false, error: 'Check failed' });
        setOpenaiRealtimeStatus({ connected: false, error: 'Check failed' });
        setCheckingStatus(false);
      });
  };

  // Manual refresh handler for recovery
  const handleManualRefresh = async () => {
    await refetchSettings();
  };

  // Force refresh connection status when navigating to /admin
  useEffect(() => {
    if (location?.startsWith('/admin')) {
      refetchSettings();
    }
  }, [location]);

  // Check connections when settings fetch completes (for route navigation, 60-min interval, and window focus)
  useEffect(() => {
    if (wasFetchingRef.current && !isFetching && settings) {
      // Fetch just completed, check connections with fresh data
      checkAPIConnections(settings);
    }
    wasFetchingRef.current = isFetching;
  }, [isFetching, settings]);

  // Initial check when settings first loads
  useEffect(() => {
    if (settings && !hasCheckedRef.current) {
      hasCheckedRef.current = true;
      checkAPIConnections(settings);
    }
    // Reset flag if settings becomes unavailable (e.g., after error)
    if (!settings) {
      hasCheckedRef.current = false;
    }
  }, [settings]);

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold">Platform Analytics</h1>
          <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">
            Monitor platform performance and system health
          </p>
        </div>
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
              <div 
                className={`flex items-center gap-2 px-3 py-2 rounded-xl backdrop-blur-sm transition-colors ${
                  twilioStatus?.connected 
                    ? 'bg-emerald-500/10 dark:bg-emerald-500/10' 
                    : 'bg-muted/50 dark:bg-muted/30'
                }`}
                data-testid={twilioStatus?.connected ? "status-twilio-connected" : "status-twilio-disconnected"}
                title={twilioStatus?.error || undefined}
              >
                <div className={`p-1.5 rounded-lg ${
                  twilioStatus?.connected 
                    ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                    : 'bg-muted'
                }`}>
                  <Phone className={`h-3 w-3 ${twilioStatus?.connected ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium">
                    Twilio
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {twilioStatus?.connected ? 'Connected' : 'Not Connected'}
                  </span>
                </div>
              </div>
              
              <div 
                className={`flex items-center gap-2 px-3 py-2 rounded-xl backdrop-blur-sm transition-colors ${
                  elevenLabsStatus?.connected 
                    ? 'bg-emerald-500/10 dark:bg-emerald-500/10' 
                    : 'bg-muted/50 dark:bg-muted/30'
                }`}
                data-testid={elevenLabsStatus?.connected ? "status-elevenlabs-connected" : "status-elevenlabs-disconnected"}
                title={elevenLabsStatus?.error || undefined}
              >
                <div className={`p-1.5 rounded-lg ${
                  elevenLabsStatus?.connected 
                    ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                    : 'bg-muted'
                }`}>
                  <Server className={`h-3 w-3 ${elevenLabsStatus?.connected ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium">
                    ElevenLabs
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {elevenLabsStatus?.connected 
                      ? elevenLabsStatus.voiceCount !== undefined 
                        ? `${elevenLabsStatus.voiceCount} voices` 
                        : 'Connected'
                      : 'Not Connected'}
                  </span>
                </div>
              </div>

              <div 
                className={`flex items-center gap-2 px-3 py-2 rounded-xl backdrop-blur-sm transition-colors ${
                  openaiStatus?.connected 
                    ? 'bg-purple-500/10 dark:bg-purple-500/10' 
                    : 'bg-muted/50 dark:bg-muted/30'
                }`}
                data-testid={openaiStatus?.connected ? "status-openai-connected" : "status-openai-disconnected"}
                title={openaiStatus?.error || undefined}
              >
                <div className={`p-1.5 rounded-lg ${
                  openaiStatus?.connected 
                    ? 'bg-purple-100 dark:bg-purple-900/30' 
                    : 'bg-muted'
                }`}>
                  <Sparkles className={`h-3 w-3 ${openaiStatus?.connected ? 'text-purple-500' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium">
                    OpenAI
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {openaiStatus?.connected 
                      ? (openaiStatus as any).modelCount !== undefined 
                        ? `${(openaiStatus as any).modelCount} models` 
                        : 'Connected'
                      : 'Not Connected'}
                  </span>
                </div>
              </div>

              <div 
                className={`flex items-center gap-2 px-3 py-2 rounded-xl backdrop-blur-sm transition-colors ${
                  openaiRealtimeStatus?.connected 
                    ? 'bg-orange-500/10 dark:bg-orange-500/10' 
                    : 'bg-muted/50 dark:bg-muted/30'
                }`}
                data-testid={openaiRealtimeStatus?.connected ? "status-openai-voice-connected" : "status-openai-voice-disconnected"}
                title={openaiRealtimeStatus?.error || undefined}
              >
                <div className={`p-1.5 rounded-lg ${
                  openaiRealtimeStatus?.connected 
                    ? 'bg-orange-100 dark:bg-orange-900/30' 
                    : 'bg-muted'
                }`}>
                  <Mic className={`h-3 w-3 ${openaiRealtimeStatus?.connected ? 'text-orange-500' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium">
                    OpenAI Voice
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {openaiRealtimeStatus?.connected 
                      ? (openaiRealtimeStatus as any).keyCount !== undefined 
                        ? `${(openaiRealtimeStatus as any).keyCount} keys` 
                        : 'Connected'
                      : 'Not Connected'}
                  </span>
                </div>
              </div>

              <div 
                className="flex items-center gap-2 px-3 py-2 rounded-xl backdrop-blur-sm bg-blue-500/10 dark:bg-blue-500/10"
                data-testid="status-version"
                title="Application Version"
              >
                <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Power className="h-3 w-3 text-blue-500" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium">
                    Version
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    v{versionData?.version || '1.0.0'}
                  </span>
                </div>
              </div>
              
              <Button 
                variant="ghost" 
                size="icon"
                onClick={handleManualRefresh}
                disabled={checkingStatus || isFetching}
                title={checkingStatus ? "Refreshing..." : "Refresh connection status"}
                data-testid="button-refresh-status"
              >
                <RefreshCw className={`h-4 w-4 ${checkingStatus || isFetching ? 'animate-spin' : ''}`} />
              </Button>
        </div>
      </div>

      {/* Main Admin Tabs - Menu first */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="overflow-x-auto -mx-4 md:-mx-8 px-4 md:px-8 pb-2 scrollbar-thin">
          <TabsList className="flex gap-1 h-auto w-max min-w-full">
            <TabsTrigger value="analytics" className="text-xs md:text-sm whitespace-nowrap" data-testid="tab-analytics">
              <BarChart className="h-4 w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Analytics</span>
              <span className="sm:hidden">Stats</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="text-xs md:text-sm whitespace-nowrap" data-testid="tab-users">
              <Users className="h-4 w-4 mr-1 md:mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="contacts" className="text-xs md:text-sm whitespace-nowrap" data-testid="tab-contacts">
              <ContactRound className="h-4 w-4 mr-1 md:mr-2" />
              Contacts
            </TabsTrigger>
            <TabsTrigger value="billing" className="text-xs md:text-sm whitespace-nowrap" data-testid="tab-billing">
              <CreditCard className="h-4 w-4 mr-1 md:mr-2" />
              Billing
            </TabsTrigger>
            <TabsTrigger value="phones" className="text-xs md:text-sm whitespace-nowrap" data-testid="tab-phones">
              <Phone className="h-4 w-4 mr-1 md:mr-2" />
              Phones
            </TabsTrigger>
            <TabsTrigger value="queue" className="text-xs md:text-sm whitespace-nowrap" data-testid="tab-batch-jobs">
              <ListOrdered className="h-4 w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Batch Jobs</span>
              <span className="sm:hidden">Jobs</span>
            </TabsTrigger>
            <TabsTrigger value="calls" className="text-xs md:text-sm whitespace-nowrap" data-testid="tab-calls">
              <Headphones className="h-4 w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Call Monitoring</span>
              <span className="sm:hidden">Calls</span>
            </TabsTrigger>
            <TabsTrigger value="communications" className="text-xs md:text-sm whitespace-nowrap" data-testid="tab-communications">
              <MessageSquare className="h-4 w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Communications</span>
              <span className="sm:hidden">Comms</span>
            </TabsTrigger>
            <TabsTrigger value="voice-ai" className="text-xs md:text-sm whitespace-nowrap" data-testid="tab-voice-ai">
              <Brain className="h-4 w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Voice AI</span>
              <span className="sm:hidden">Voice</span>
            </TabsTrigger>
            {adminMenuItems.map((item) => (
              <TabsTrigger key={item.id} value={item.id} className="text-xs md:text-sm whitespace-nowrap" data-testid={`tab-${item.id}`}>
                {item.icon === 'Users' && <Building2 className="h-4 w-4 mr-1 md:mr-2" />}
                {item.icon === 'Server' && <Server className="h-4 w-4 mr-1 md:mr-2" />}
                {item.label}
              </TabsTrigger>
            ))}
            <TabsTrigger value="integrations" className="text-xs md:text-sm whitespace-nowrap" data-testid="tab-integrations">
              <Zap className="h-4 w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Integrations</span>
              <span className="sm:hidden">Integ</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs md:text-sm whitespace-nowrap" data-testid="tab-settings">
              <Settings className="h-4 w-4 mr-1 md:mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="analytics" className="space-y-4">
          <Analytics />
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <UserManagement />
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4">
          <AllContactsAdmin />
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <BillingPanel />
        </TabsContent>

        <TabsContent value="phones" className="space-y-4">
          <PhoneNumbers />
        </TabsContent>

        <TabsContent value="queue" className="space-y-4">
          <BatchJobsMonitor />
        </TabsContent>

        <TabsContent value="calls" className="space-y-4">
          <CallsPanel />
        </TabsContent>

        <TabsContent value="communications" className="space-y-4">
          <CommunicationsPanel />
        </TabsContent>

        <TabsContent value="voice-ai" className="space-y-4">
          <VoiceAIPanel />
        </TabsContent>

        {adminMenuItems.map((item) => (
          <TabsContent key={item.id} value={item.id} className="space-y-4">
            <Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
              <item.component />
            </Suspense>
          </TabsContent>
        ))}

        <TabsContent value="integrations" className="space-y-4">
          <IntegrationTestPanel />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <SettingsPage onSwitchTab={setActiveTab} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BillingPanel() {
  const [activeSubTab, setActiveSubTab] = useState("plans");
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Billing</h2>
        <p className="text-muted-foreground">
          Manage subscription plans, credits, transactions, and payment gateways
        </p>
      </div>
      
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList>
          <TabsTrigger value="plans" data-testid="subtab-plans">
            <Package className="h-4 w-4 mr-2" />
            Plans
          </TabsTrigger>
          <TabsTrigger value="credits" data-testid="subtab-credits">
            <CreditCard className="h-4 w-4 mr-2" />
            Credits
          </TabsTrigger>
          <TabsTrigger value="transactions" data-testid="subtab-transactions">
            <Receipt className="h-4 w-4 mr-2" />
            Transactions
          </TabsTrigger>
          <TabsTrigger value="payments" data-testid="subtab-payments">
            <DollarSign className="h-4 w-4 mr-2" />
            Payments
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="plans" className="mt-6 space-y-4">
          <PlanManagement />
          <LLMModelsManagement />
        </TabsContent>
        
        <TabsContent value="credits" className="mt-6">
          <CreditPackages />
        </TabsContent>
        
        <TabsContent value="transactions" className="mt-6">
          <TransactionsManagement />
        </TabsContent>
        
        <TabsContent value="payments" className="mt-6">
          <PaymentsSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CallsPanel() {
  const [activeSubTab, setActiveSubTab] = useState("monitoring");
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Call Monitoring</h2>
        <p className="text-muted-foreground">
          Monitor all calls, detect content violations, and manage banned words
        </p>
      </div>
      
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList>
          <TabsTrigger value="monitoring" data-testid="subtab-call-monitoring">
            <Headphones className="h-4 w-4 mr-2" />
            All Calls
          </TabsTrigger>
          <TabsTrigger value="banned-words" data-testid="subtab-banned-words">
            <ShieldAlert className="h-4 w-4 mr-2" />
            Banned Words
          </TabsTrigger>
          <TabsTrigger value="error-logs" data-testid="subtab-error-logs">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Error Logs
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="monitoring" className="mt-6">
          <CallMonitoring />
        </TabsContent>
        
        <TabsContent value="banned-words" className="mt-6">
          <BannedWordsManagement />
        </TabsContent>

        <TabsContent value="error-logs" className="mt-6">
          <CallErrorLogs />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CommunicationsPanel() {
  const [activeSubTab, setActiveSubTab] = useState("email-settings");
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Communications</h2>
        <p className="text-muted-foreground">
          Manage email templates, notifications, and communication settings
        </p>
      </div>
      
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList>
          <TabsTrigger value="email-settings" data-testid="subtab-email-settings">
            <Mail className="h-4 w-4 mr-2" />
            Email Settings
          </TabsTrigger>
          <TabsTrigger value="notifications" data-testid="subtab-notifications">
            <Bell className="h-4 w-4 mr-2" />
            In-App Notifications
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="email-settings" className="mt-6">
          <EmailSettingsManagement />
        </TabsContent>
        
        <TabsContent value="notifications" className="mt-6">
          <Notifications />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface VoiceEngineSettings {
  plivo_openai_engine_enabled: boolean;
  twilio_openai_engine_enabled: boolean;
  twilio_kyc_required: boolean;
  plivo_kyc_required: boolean;
}

interface AiTestCallResult {
  id: string;
  status: string;
  duration: number | null;
  transcript: string | null;
  ai_summary: string | null;
  metadata: Record<string, any> | null;
}

function AiTestCallPanel() {
  const { toast } = useToast();
  const [selectedAgent, setSelectedAgent] = useState('');
  const [turns, setTurns] = useState(10);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [callResult, setCallResult] = useState<AiTestCallResult | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollErrorCount = useRef(0);
  const pollStartTime = useRef(0);

  const { data: agentsList } = useQuery<Array<{ id: string; name: string; language: string }>>({
    queryKey: ["/api/elevenlabs/agents"],
  });

  const stopPolling = (reason?: string) => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    pollErrorCount.current = 0;
    pollStartTime.current = 0;
    if (reason) {
      setActiveCallId(null);
      toast({ title: "Test Call Polling Stopped", description: reason, variant: "destructive" });
    }
  };

  const startTestCall = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/bedrock-polly/ai-test-call", {
        agentId: selectedAgent,
        turns,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to start test call');
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      setActiveCallId(data.callId);
      setCallResult(null);
      pollErrorCount.current = 0;
      pollStartTime.current = Date.now();
      toast({ title: "AI Test Call Started", description: data.message });

      const MAX_POLL_ERRORS = 5;
      const MAX_POLL_DURATION_MS = 15 * 60 * 1000;

      pollRef.current = setInterval(async () => {
        if (Date.now() - pollStartTime.current > MAX_POLL_DURATION_MS) {
          stopPolling("Test call timed out after 15 minutes.");
          return;
        }

        try {
          const res = await apiRequest("GET", `/api/bedrock-polly/ai-test-call/${data.callId}`);
          if (!res.ok) {
            pollErrorCount.current++;
            if (pollErrorCount.current >= MAX_POLL_ERRORS) {
              stopPolling(`Lost connection to server after ${MAX_POLL_ERRORS} failed attempts.`);
            }
            return;
          }
          pollErrorCount.current = 0;
          const result = await res.json();
          if (result.status === 'completed' || result.status === 'failed') {
            setCallResult(result);
            setActiveCallId(null);
            stopPolling();
            if (result.status === 'completed') {
              toast({ title: "AI Test Call Complete", description: result.ai_summary?.substring(0, 100) });
            } else {
              toast({ title: "AI Test Call Failed", description: result.ai_summary || "An error occurred", variant: "destructive" });
            }
          }
        } catch {
          pollErrorCount.current++;
          if (pollErrorCount.current >= MAX_POLL_ERRORS) {
            stopPolling(`Lost connection to server after ${MAX_POLL_ERRORS} failed attempts.`);
          }
        }
      }, 5000);
    },
    onError: (error: any) => {
      toast({ title: "Failed to start test call", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    return () => stopPolling();
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Phone className="h-5 w-5" />
          <div>
            <CardTitle className="text-lg">AI-to-AI Test Call</CardTitle>
            <CardDescription>
              Run a simulated conversation to verify your agent works correctly with Claude Sonnet 4.6
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="test-agent-select">Select Agent</Label>
            <select
              id="test-agent-select"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              disabled={!!activeCallId || startTestCall.isPending}
              data-testid="select-test-agent"
            >
              <option value="">Choose an agent...</option>
              {agentsList?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.language})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="test-turns">Number of Turns</Label>
            <select
              id="test-turns"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={turns}
              onChange={(e) => setTurns(Number(e.target.value))}
              disabled={!!activeCallId || startTestCall.isPending}
              data-testid="select-test-turns"
            >
              <option value={5}>5 turns (~2 min)</option>
              <option value={10}>10 turns (~4 min)</option>
              <option value={15}>15 turns (~6 min)</option>
              <option value={20}>20 turns (~8 min)</option>
            </select>
          </div>
        </div>

        <Button
          onClick={() => startTestCall.mutate()}
          disabled={!selectedAgent || !!activeCallId || startTestCall.isPending}
          className="w-full md:w-auto"
          data-testid="button-start-test-call"
        >
          {startTestCall.isPending ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Starting...</>
          ) : activeCallId ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Test Running...</>
          ) : (
            <><Zap className="h-4 w-4 mr-2" /> Start AI Test Call</>
          )}
        </Button>

        {activeCallId && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span className="text-sm text-blue-700 dark:text-blue-300">
              AI test call in progress... The agent is having a simulated conversation. Results will appear here when complete.
            </span>
          </div>
        )}

        {callResult && (
          <div className={`space-y-3 p-4 rounded-lg border ${callResult.status === 'completed' ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'}`}>
            <div className="flex items-center gap-2">
              {callResult.status === 'completed' ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              <span className={`font-medium ${callResult.status === 'completed' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                {callResult.status === 'completed' ? 'Test Call Complete' : 'Test Call Failed'}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Duration</span>
                <p className="font-medium">{callResult.duration}s</p>
              </div>
              <div>
                <span className="text-muted-foreground">Turns</span>
                <p className="font-medium">{callResult.metadata?.turns || 0}</p>
              </div>
              <div>
                <span className="text-muted-foreground">KB Hits</span>
                <p className="font-medium">{callResult.metadata?.kbHits || 0}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Errors</span>
                <p className="font-medium">{callResult.metadata?.errors || 0}</p>
              </div>
            </div>
            {callResult.ai_summary && (
              <p className="text-sm text-muted-foreground">{callResult.ai_summary}</p>
            )}
            {callResult.transcript && (
              <details className="mt-2">
                <summary className="text-sm font-medium cursor-pointer text-blue-600 hover:text-blue-700">
                  View Full Transcript ({callResult.transcript.length} chars)
                </summary>
                <pre className="mt-2 p-3 rounded bg-muted text-xs whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {callResult.transcript}
                </pre>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VoiceAIPanel() {
  const { toast } = useToast();
  
  const { data: voiceEngineSettings, isLoading: settingsLoading } = useQuery<VoiceEngineSettings>({
    queryKey: ["/api/settings/voice-engine"],
  });

  const updatePlivoEngineSetting = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("PATCH", "/api/admin/settings/plivo_openai_engine_enabled", { value: enabled });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update setting");
      }
      return { enabled, engine: "plivo" };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/voice-engine"] });
      toast({ 
        title: "Voice engine setting updated",
        description: data.enabled 
          ? "Plivo + OpenAI engine has been enabled" 
          : "Plivo + OpenAI engine has been disabled"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update setting",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const updateTwilioOpenaiEngineSetting = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("PATCH", "/api/admin/settings/twilio_openai_engine_enabled", { value: enabled });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update setting");
      }
      return { enabled, engine: "twilio_openai" };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/voice-engine"] });
      toast({ 
        title: "Voice engine setting updated",
        description: data.enabled 
          ? "Twilio + OpenAI engine has been enabled" 
          : "Twilio + OpenAI engine has been disabled"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update setting",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const isPlivoEngineEnabled = voiceEngineSettings?.plivo_openai_engine_enabled ?? false;
  const isTwilioOpenaiEngineEnabled = voiceEngineSettings?.twilio_openai_engine_enabled ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Voice AI Engine</h2>
        <p className="text-muted-foreground">
          Manage OpenAI and Plivo configurations for the Voice AI engine
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Power className="h-5 w-5" />
                <div>
                  <CardTitle className="text-lg">Twilio + OpenAI Realtime</CardTitle>
                  <CardDescription>
                    Use OpenAI Realtime API with Twilio telephony
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {settingsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <Label htmlFor="twilio-openai-toggle" className="text-sm text-muted-foreground">
                      {isTwilioOpenaiEngineEnabled ? "Enabled" : "Disabled"}
                    </Label>
                    <Switch
                      id="twilio-openai-toggle"
                      checked={isTwilioOpenaiEngineEnabled}
                      onCheckedChange={(checked) => updateTwilioOpenaiEngineSetting.mutate(checked)}
                      disabled={updateTwilioOpenaiEngineSetting.isPending}
                      data-testid="switch-twilio-openai-engine"
                    />
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground">
              OpenAI Realtime voices with Twilio for international calling.
            </p>
            {isTwilioOpenaiEngineEnabled && (
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="secondary" className="text-green-600 border-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Power className="h-5 w-5" />
                <div>
                  <CardTitle className="text-lg">Plivo + OpenAI Realtime</CardTitle>
                  <CardDescription>
                    Use OpenAI Realtime API with Plivo telephony
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {settingsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <Label htmlFor="plivo-openai-toggle" className="text-sm text-muted-foreground">
                      {isPlivoEngineEnabled ? "Enabled" : "Disabled"}
                    </Label>
                    <Switch
                      id="plivo-openai-toggle"
                      checked={isPlivoEngineEnabled}
                      onCheckedChange={(checked) => updatePlivoEngineSetting.mutate(checked)}
                      disabled={updatePlivoEngineSetting.isPending}
                      data-testid="switch-plivo-openai-engine"
                    />
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground">
              OpenAI Realtime voices with Plivo for Indian numbers.
            </p>
            {isPlivoEngineEnabled && (
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="secondary" className="text-green-600 border-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <AiTestCallPanel />
      
      <div className="space-y-6">
        <OpenAIPoolManagement />
        <PlivoSettings />
      </div>
    </div>
  );
}