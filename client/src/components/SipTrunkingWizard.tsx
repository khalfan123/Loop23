import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe,
  Loader2,
  Lock,
  Network,
  Phone,
  PhoneForwarded,
  Plus,
  Search,
  Server,
  Shield,
  Smartphone,
  Zap,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Bot,
  Headphones,
  Info,
} from "lucide-react";

const STEPS = [
  { id: "trunk", label: "SIP Trunk", icon: Server },
  { id: "numbers", label: "Phone Numbers", icon: Phone },
  { id: "review", label: "Review & Connect", icon: CheckCircle2 },
];

function numberKey(n: TwilioNumber): string {
  return n.sid || n.phoneNumber;
}

interface TwilioNumber {
  sid?: string;
  phoneNumber: string;
  friendlyName: string;
  country: string | null;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
}

interface ExistingSipTrunk {
  id: string;
  name: string;
  sipHost: string;
  sipPort: number;
  transport: string;
  mediaEncryption: string;
  provider: string;
}

interface TrunkConfig {
  trunkName: string;
  customSipHost: string;
  sipPort: number;
  transport: "udp" | "tcp" | "tls";
  mediaEncryption: "require" | "prefer" | "none";
}

interface SipTrunkingWizardProps {
  onClose?: () => void;
}

export function SipTrunkingWizard({ onClose }: SipTrunkingWizardProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);

  const [trunkConfig, setTrunkConfig] = useState<TrunkConfig>({
    trunkName: "",
    customSipHost: "",
    sipPort: 5061,
    transport: "tls",
    mediaEncryption: "require",
  });

  const effectiveSipHost = trunkConfig.customSipHost.trim() ||
    (trunkConfig.trunkName.trim() ? `${trunkConfig.trunkName.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-")}.pstn.twilio.com` : "");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [twilioNumbers, setTwilioNumbers] = useState<TwilioNumber[]>([]);
  const [selectedNumbers, setSelectedNumbers] = useState<Set<string>>(new Set());
  const [numberSearch, setNumberSearch] = useState("");
  const [numbersLoaded, setNumbersLoaded] = useState(false);

  const [useExistingTrunk, setUseExistingTrunk] = useState(false);
  const [selectedExistingTrunkId, setSelectedExistingTrunkId] = useState<string>("");

  const [connectComplete, setConnectComplete] = useState(false);
  const [connectResult, setConnectResult] = useState<any>(null);

  const { data: existingTrunks } = useQuery<ExistingSipTrunk[]>({
    queryKey: ["/api/sip/trunks"],
    select: (data: any) => data?.trunks || data || [],
  });

  const listNumbersMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/sip/twilio/list-numbers");
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to load numbers" }));
        throw new Error(err.error || "Failed to load numbers");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setTwilioNumbers(data.phoneNumbers || []);
      setNumbersLoaded(true);
      if (data.phoneNumbers?.length === 0) {
        toast({ title: "No numbers found", description: "Your Twilio account has no phone numbers.", variant: "destructive" });
      }
    },
    onError: (error: any) => {
      toast({ title: "Failed to load numbers", description: error.message, variant: "destructive" });
    },
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const selectedPhones = twilioNumbers
        .filter(n => selectedNumbers.has(numberKey(n)));

      if (useExistingTrunk && selectedExistingTrunkId) {
        const res = await apiRequest("POST", "/api/sip/phone-numbers/bulk-import", {
          sipTrunkId: selectedExistingTrunkId,
          phoneNumbers: selectedPhones.map(p => ({
            phoneNumber: p.phoneNumber,
            label: p.friendlyName || p.phoneNumber,
          })),
        });
        return res.json();
      }

      const res = await apiRequest("POST", "/api/sip/twilio/connect", {
        trunkName: trunkConfig.trunkName,
        sipHost: effectiveSipHost,
        sipPort: trunkConfig.sipPort,
        transport: trunkConfig.transport,
        mediaEncryption: trunkConfig.mediaEncryption,
        phoneNumbers: selectedPhones.map(p => ({
          phoneNumber: p.phoneNumber,
          friendlyName: p.friendlyName || p.phoneNumber,
          manual: p.sid?.startsWith("manual-") || false,
        })),
      });
      return res.json();
    },
    onSuccess: (data) => {
      setConnectComplete(true);
      setConnectResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/sip/trunks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sip/phone-numbers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers"] });
      toast({ title: "SIP Trunk connected!", description: `${data.imported} numbers imported successfully.` });
    },
    onError: (error: any) => {
      toast({ title: "Connection failed", description: error.message, variant: "destructive" });
    },
  });

  const filteredNumbers = useMemo(() => {
    if (!numberSearch) return twilioNumbers;
    const q = numberSearch.toLowerCase();
    return twilioNumbers.filter(
      n => n.phoneNumber.toLowerCase().includes(q) || n.friendlyName?.toLowerCase().includes(q)
    );
  }, [twilioNumbers, numberSearch]);

  const toggleNumber = (sid: string) => {
    setSelectedNumbers(prev => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedNumbers.size === filteredNumbers.length) {
      setSelectedNumbers(new Set());
    } else {
      setSelectedNumbers(new Set(filteredNumbers.map(n => numberKey(n))));
    }
  };

  const addManualNumber = (phoneNumber: string, label: string) => {
    const exists = twilioNumbers.some(n => n.phoneNumber === phoneNumber);
    if (exists) {
      toast({ title: "Number already listed", description: `${phoneNumber} is already in the list.`, variant: "destructive" });
      return;
    }
    const manualEntry: TwilioNumber = {
      sid: `manual-${Date.now()}`,
      phoneNumber,
      friendlyName: label,
      country: null,
      capabilities: { voice: true, sms: false, mms: false },
    };
    setTwilioNumbers(prev => [...prev, manualEntry]);
    setSelectedNumbers(prev => new Set([...prev, manualEntry.sid]));
    toast({ title: "Number added", description: `${phoneNumber} has been added and selected.` });
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: return useExistingTrunk ? selectedExistingTrunkId.length > 0 : (trunkConfig.trunkName.length > 0 && effectiveSipHost.length > 0);
      case 1: return selectedNumbers.size > 0;
      case 2: return !connectMutation.isPending;
      default: return false;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      if (currentStep === 0 && !numbersLoaded) {
        listNumbersMutation.mutate();
      }
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  };

  const handleReset = () => {
    setCurrentStep(0);
    setTrunkConfig({ trunkName: "", customSipHost: "", sipPort: 5061, transport: "tls", mediaEncryption: "require" });
    setTwilioNumbers([]);
    setSelectedNumbers(new Set());
    setNumbersLoaded(false);
    setConnectComplete(false);
    setConnectResult(null);
  };

  if (connectComplete) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <Card className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2" data-testid="text-sip-success-title">SIP Trunk Connected Successfully!</h2>
          <p className="text-muted-foreground mb-6">
            Your Twilio SIP trunk has been configured and {connectResult?.imported || 0} phone number{(connectResult?.imported || 0) !== 1 ? 's have' : ' has'} been imported.
          </p>

          {connectResult?.failed > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6 text-left">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <span className="font-medium text-yellow-700 dark:text-yellow-400">{connectResult.failed} number{connectResult.failed !== 1 ? 's' : ''} failed to import</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                {connectResult.results?.filter((r: any) => !r.success).map((r: any, i: number) => (
                  <li key={i}>{r.phoneNumber}: {r.error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-muted/50 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold mb-3">What's next?</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Assign to an AI Agent</p>
                  <p className="text-xs text-muted-foreground">Connect your imported numbers to an AI agent to handle inbound calls automatically.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Headphones className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Set Up IVR Menu</p>
                  <p className="text-xs text-muted-foreground">Create an interactive voice response menu to route calls to the right department.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Launch a Campaign</p>
                  <p className="text-xs text-muted-foreground">Use your SIP numbers for outbound AI calling campaigns.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={handleReset} data-testid="button-connect-another">
              Connect Another Trunk
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 -ml-1" onClick={() => onClose ? onClose() : navigate("/app/phone-numbers")} data-testid="button-close-sip-wizard">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Network className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold" data-testid="text-sip-wizard-title">Connect via SIP Trunking</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Connect your existing Twilio phone numbers through SIP trunk configuration in just a few steps.
        </p>
      </div>

      <div className="flex items-center gap-2 mb-8" data-testid="sip-wizard-progress">
        {STEPS.map((step, index) => {
          const StepIcon = step.icon;
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;
          return (
            <div key={step.id} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all flex-1 ${
                isActive ? "bg-primary/10 border border-primary/20" :
                isCompleted ? "bg-green-500/10 border border-green-500/20" :
                "bg-muted/50 border border-transparent"
              }`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isCompleted ? "bg-green-500 text-white" :
                  isActive ? "bg-primary text-primary-foreground" :
                  "bg-muted-foreground/20 text-muted-foreground"
                }`}>
                  {isCompleted ? <Check className="h-4 w-4" /> : <StepIcon className="h-3.5 w-3.5" />}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${
                  isActive ? "text-primary" :
                  isCompleted ? "text-green-600 dark:text-green-400" :
                  "text-muted-foreground"
                }`}>{step.label}</span>
              </div>
              {index < STEPS.length - 1 && (
                <ChevronRight className={`h-4 w-4 flex-shrink-0 ${isCompleted ? "text-green-500" : "text-muted-foreground/30"}`} />
              )}
            </div>
          );
        })}
      </div>

      <Card className="p-6">
        {currentStep === 0 && (
          <StepTrunkConfig
            config={trunkConfig}
            setConfig={setTrunkConfig}
            showAdvanced={showAdvanced}
            setShowAdvanced={setShowAdvanced}
            effectiveSipHost={effectiveSipHost}
            existingTrunks={existingTrunks || []}
            useExistingTrunk={useExistingTrunk}
            setUseExistingTrunk={setUseExistingTrunk}
            selectedExistingTrunkId={selectedExistingTrunkId}
            setSelectedExistingTrunkId={setSelectedExistingTrunkId}
          />
        )}

        {currentStep === 1 && (
          <StepSelectNumbers
            numbers={filteredNumbers}
            selectedNumbers={selectedNumbers}
            toggleNumber={toggleNumber}
            toggleAll={toggleAll}
            search={numberSearch}
            setSearch={setNumberSearch}
            isLoading={listNumbersMutation.isPending}
            totalCount={twilioNumbers.length}
            onRetry={() => listNumbersMutation.mutate()}
            onAddManualNumber={addManualNumber}
            effectiveSipHost={effectiveSipHost}
          />
        )}

        {currentStep === 2 && (
          <StepReview
            trunkConfig={trunkConfig}
            effectiveSipHost={effectiveSipHost}
            selectedNumbers={twilioNumbers.filter(n => selectedNumbers.has(numberKey(n)))}
            isConnecting={connectMutation.isPending}
            onConnect={() => connectMutation.mutate()}
            useExistingTrunk={useExistingTrunk}
            existingTrunkName={existingTrunks?.find(t => t.id === selectedExistingTrunkId)?.name}
          />
        )}
      </Card>

      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 0}
          data-testid="button-sip-back"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        {currentStep < STEPS.length - 1 ? (
          <Button
            onClick={handleNext}
            disabled={!canProceed()}
            data-testid="button-sip-next"
          >
            {currentStep === 0 && !numbersLoaded ? (
              listNumbersMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Loading Numbers...</>
              ) : (
                <>Load Numbers & Continue<ArrowRight className="h-4 w-4 ml-1" /></>
              )
            ) : (
              <>Next<ChevronRight className="h-4 w-4 ml-1" /></>
            )}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function StepTrunkConfig({
  config, setConfig, showAdvanced, setShowAdvanced, effectiveSipHost,
  existingTrunks, useExistingTrunk, setUseExistingTrunk, selectedExistingTrunkId, setSelectedExistingTrunkId,
}: {
  config: TrunkConfig;
  setConfig: (v: TrunkConfig) => void;
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
  effectiveSipHost: string;
  existingTrunks: ExistingSipTrunk[];
  useExistingTrunk: boolean;
  setUseExistingTrunk: (v: boolean) => void;
  selectedExistingTrunkId: string;
  setSelectedExistingTrunkId: (v: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Configure SIP Trunk</h2>
        <p className="text-sm text-muted-foreground">
          {existingTrunks.length > 0
            ? "Use an existing SIP trunk or create a new one for your Twilio numbers."
            : "We've pre-filled the optimal settings for Twilio. You can customize them if needed."}
        </p>
      </div>

      <div className="bg-blue-500/5 border border-blue-500/15 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Network className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-blue-700 dark:text-blue-400 mb-1">What is a SIP Trunk?</p>
            <p className="text-muted-foreground">
              A SIP trunk is a virtual connection between your phone system (Twilio) and our AI platform. 
              It allows your existing phone numbers to route calls through our AI agents. Think of it as a 
              bridge between your phone numbers and our AI technology.
            </p>
          </div>
        </div>
      </div>

      {existingTrunks.length > 0 && (
        <div className="space-y-3">
          <div className="flex gap-3">
            <div
              className={`flex-1 border rounded-lg p-3 cursor-pointer transition-colors ${
                !useExistingTrunk ? "border-primary bg-primary/5" : "hover:bg-accent/50"
              }`}
              onClick={() => setUseExistingTrunk(false)}
              data-testid="option-new-trunk"
            >
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full border-2 ${!useExistingTrunk ? "border-primary bg-primary" : "border-muted-foreground"}`} />
                <span className="text-sm font-medium">Create New Trunk</span>
              </div>
            </div>
            <div
              className={`flex-1 border rounded-lg p-3 cursor-pointer transition-colors ${
                useExistingTrunk ? "border-primary bg-primary/5" : "hover:bg-accent/50"
              }`}
              onClick={() => setUseExistingTrunk(true)}
              data-testid="option-existing-trunk"
            >
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full border-2 ${useExistingTrunk ? "border-primary bg-primary" : "border-muted-foreground"}`} />
                <span className="text-sm font-medium">Use Existing Trunk</span>
              </div>
            </div>
          </div>

          {useExistingTrunk && (
            <div>
              <Label>Select Trunk</Label>
              <Select value={selectedExistingTrunkId} onValueChange={setSelectedExistingTrunkId}>
                <SelectTrigger className="mt-1.5" data-testid="select-existing-trunk">
                  <SelectValue placeholder="Choose an existing SIP trunk" />
                </SelectTrigger>
                <SelectContent>
                  {existingTrunks.map((trunk) => (
                    <SelectItem key={trunk.id} value={trunk.id}>
                      <div className="flex items-center gap-2">
                        <Server className="h-3.5 w-3.5" />
                        <span>{trunk.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">{trunk.sipHost}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {!useExistingTrunk && (
        <>
          <div className="space-y-4">
            <div>
              <Label htmlFor="trunk-name">Trunk Name</Label>
              <Input
                id="trunk-name"
                placeholder="e.g., My Business SIP Trunk"
                value={config.trunkName}
                onChange={(e) => setConfig({ ...config, trunkName: e.target.value })}
                className="mt-1.5"
                data-testid="input-trunk-name"
              />
              <p className="text-xs text-muted-foreground mt-1">A friendly name to identify this trunk</p>
            </div>

            {effectiveSipHost && (
              <div className="bg-muted/50 rounded-lg p-3">
                <Label className="text-xs text-muted-foreground">SIP Domain (auto-generated)</Label>
                <p className="font-mono text-sm mt-1" data-testid="text-sip-host">{effectiveSipHost}</p>
                {!config.customSipHost && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Default Twilio domain. Use Advanced Settings to set a custom domain.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="bg-muted/50 rounded-lg p-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground block text-xs mb-1">Transport</span>
                <div className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-green-500" />
                  <span className="font-medium">TLS (Encrypted)</span>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs mb-1">Port</span>
                <span className="font-medium font-mono">5061</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs mb-1">Media</span>
                <div className="flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-green-500" />
                  <span className="font-medium">SRTP Required</span>
                </div>
              </div>
            </div>
          </div>

          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between text-sm text-muted-foreground" data-testid="button-advanced-settings">
                Advanced Settings
                <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div>
                <Label htmlFor="custom-sip-host">Custom SIP Domain</Label>
                <Input
                  id="custom-sip-host"
                  placeholder={config.trunkName ? `${config.trunkName.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-")}.pstn.twilio.com` : "Leave empty to use default Twilio domain"}
                  value={config.customSipHost}
                  onChange={(e) => setConfig({ ...config, customSipHost: e.target.value })}
                  className="font-mono mt-1.5"
                  data-testid="input-custom-sip-host"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Override the default Twilio domain. Leave empty to use <code className="bg-muted px-1 rounded">&lt;trunk-name&gt;.pstn.twilio.com</code>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sip-port">SIP Port</Label>
                  <Input
                    id="sip-port"
                    type="number"
                    value={config.sipPort}
                    onChange={(e) => setConfig({ ...config, sipPort: parseInt(e.target.value) || 5061 })}
                    className="font-mono mt-1.5"
                    data-testid="input-sip-port"
                  />
                </div>
                <div>
                  <Label>Transport Protocol</Label>
                  <Select value={config.transport} onValueChange={(v) => setConfig({ ...config, transport: v as "udp" | "tcp" | "tls" })}>
                    <SelectTrigger className="mt-1.5" data-testid="select-transport">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tls">TLS (Recommended)</SelectItem>
                      <SelectItem value="tcp">TCP</SelectItem>
                      <SelectItem value="udp">UDP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Media Encryption</Label>
                <Select value={config.mediaEncryption} onValueChange={(v) => setConfig({ ...config, mediaEncryption: v as "require" | "prefer" | "none" })}>
                  <SelectTrigger className="mt-1.5" data-testid="select-media-encryption">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="require">Required (SRTP)</SelectItem>
                    <SelectItem value="prefer">Preferred</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Twilio recommends TLS transport on port 5061 with SRTP encryption for maximum security.
              </p>
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </div>
  );
}

function StepSelectNumbers({
  numbers, selectedNumbers, toggleNumber, toggleAll,
  search, setSearch, isLoading, totalCount, onRetry,
  onAddManualNumber, effectiveSipHost,
}: {
  numbers: TwilioNumber[];
  selectedNumbers: Set<string>;
  toggleNumber: (sid: string) => void;
  toggleAll: () => void;
  search: string;
  setSearch: (v: string) => void;
  isLoading: boolean;
  totalCount: number;
  onRetry: () => void;
  onAddManualNumber: (phoneNumber: string, label: string) => void;
  effectiveSipHost: string;
}) {
  const [manualNumber, setManualNumber] = useState("");
  const [manualLabel, setManualLabel] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showForwardingGuide, setShowForwardingGuide] = useState(false);
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="font-medium">Loading your Twilio numbers...</p>
        <p className="text-sm text-muted-foreground mt-1">Fetching phone numbers from your Twilio account</p>
      </div>
    );
  }

  if (totalCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Phone className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="font-semibold mb-1">No Phone Numbers Found</h3>
        <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
          Your Twilio account doesn't have any phone numbers yet. Purchase numbers in your 
          <a href="https://console.twilio.com/us1/develop/phone-numbers/manage/incoming" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline ml-1">
            Twilio Console<ExternalLink className="h-3 w-3 inline ml-0.5" />
          </a>, then come back to connect them.
        </p>
        <Button variant="outline" onClick={onRetry} data-testid="button-retry-numbers">
          <Loader2 className="h-4 w-4 mr-2" />Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-1">Select Phone Numbers</h2>
        <p className="text-sm text-muted-foreground">
          Choose which Twilio numbers to connect. You can select individual numbers or use "Select All."
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search numbers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-search-numbers"
          />
        </div>
        <Button variant="outline" size="sm" onClick={toggleAll} data-testid="button-select-all">
          {selectedNumbers.size === numbers.length && numbers.length > 0 ? "Deselect All" : "Select All"}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="secondary">{totalCount} total</Badge>
        {selectedNumbers.size > 0 && (
          <Badge variant="default">{selectedNumbers.size} selected</Badge>
        )}
      </div>

      <ScrollArea className="h-[280px] border rounded-lg">
        <div className="divide-y">
          {numbers.map((number) => (
            <div
              key={number.sid || number.phoneNumber}
              className={`flex items-center gap-3 p-3 cursor-pointer transition-colors hover:bg-accent/50 ${
                selectedNumbers.has(numberKey(number)) ? "bg-primary/5" : ""
              }`}
              onClick={() => toggleNumber(numberKey(number))}
              data-testid={`number-row-${number.phoneNumber}`}
            >
              <Checkbox
                checked={selectedNumbers.has(numberKey(number))}
                onCheckedChange={() => toggleNumber(numberKey(number))}
                onClick={(e) => e.stopPropagation()}
                data-testid={`checkbox-${number.phoneNumber}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-mono font-medium text-sm">{number.phoneNumber}</p>
                  {number.country && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      <Globe className="h-2.5 w-2.5 mr-0.5" />{number.country}
                    </Badge>
                  )}
                  {number.sid?.startsWith("manual-") && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 border-amber-500/20">
                      Manual
                    </Badge>
                  )}
                </div>
                {number.friendlyName && number.friendlyName !== number.phoneNumber && (
                  <p className="text-xs text-muted-foreground truncate">{number.friendlyName}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {number.capabilities?.voice && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0">
                    <Phone className="h-3 w-3 mr-0.5" />Voice
                  </Badge>
                )}
                {number.capabilities?.sms && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0">
                    <Smartphone className="h-3 w-3 mr-0.5" />SMS
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="border-t pt-4 space-y-3">
        <Collapsible open={showManualEntry} onOpenChange={setShowManualEntry}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-between" data-testid="button-toggle-manual-entry">
              <span className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Number Manually
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showManualEntry ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-3">
            <p className="text-xs text-muted-foreground">
              Add a number that's already ported to Twilio but not appearing in the list above.
            </p>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="+1234567890"
                  value={manualNumber}
                  onChange={(e) => setManualNumber(e.target.value)}
                  className="font-mono"
                  data-testid="input-manual-number"
                />
              </div>
              <div className="flex-1">
                <Input
                  placeholder="Label (optional)"
                  value={manualLabel}
                  onChange={(e) => setManualLabel(e.target.value)}
                  data-testid="input-manual-label"
                />
              </div>
              <Button
                size="sm"
                disabled={!manualNumber.trim().startsWith("+")}
                onClick={() => {
                  onAddManualNumber(manualNumber.trim(), manualLabel.trim() || manualNumber.trim());
                  setManualNumber("");
                  setManualLabel("");
                }}
                data-testid="button-add-manual-number"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible open={showForwardingGuide} onOpenChange={setShowForwardingGuide}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-between" data-testid="button-toggle-forwarding-guide">
              <span className="flex items-center gap-2">
                <PhoneForwarded className="h-4 w-4" />
                Connect via Call Forwarding
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showForwardingGuide ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <div className="bg-blue-500/5 border border-blue-500/15 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm space-y-2">
                  <p className="font-medium text-blue-700 dark:text-blue-400">Forward your personal number to this SIP trunk</p>
                  <p className="text-muted-foreground">
                    If you have a number from another carrier, you can forward incoming calls to your SIP trunk without porting.
                  </p>
                  <div className="bg-muted/70 rounded-md p-3 space-y-2">
                    <p className="text-xs font-medium">Steps to set up call forwarding:</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
                      <li>Contact your phone carrier or open their app settings</li>
                      <li>Enable <strong>call forwarding</strong> (unconditional or on busy/no-answer)</li>
                      <li>Set the forwarding destination to one of your connected Twilio numbers</li>
                      <li>Calls to your personal number will now route through SIP to the platform</li>
                    </ol>
                  </div>
                  {effectiveSipHost && (
                    <div className="bg-muted/70 rounded-md p-3">
                      <p className="text-xs font-medium mb-1">Your SIP domain:</p>
                      <p className="font-mono text-xs text-muted-foreground">{effectiveSipHost}</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    <strong>Note:</strong> Call forwarding charges from your carrier may apply. For full control, consider porting your number to Twilio instead.
                  </p>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}

function StepReview({
  trunkConfig, effectiveSipHost, selectedNumbers, isConnecting, onConnect, useExistingTrunk, existingTrunkName,
}: {
  trunkConfig: TrunkConfig;
  effectiveSipHost: string;
  selectedNumbers: TwilioNumber[];
  isConnecting: boolean;
  onConnect: () => void;
  useExistingTrunk?: boolean;
  existingTrunkName?: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Review & Connect</h2>
        <p className="text-sm text-muted-foreground">
          {useExistingTrunk
            ? "Review your selection before connecting. Numbers will be added to the existing trunk."
            : "Review your configuration before connecting. This will create the SIP trunk and import the selected numbers."}
        </p>
      </div>

      <div className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-4">
          <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" />
            {useExistingTrunk ? "Existing SIP Trunk" : "SIP Trunk Configuration"}
          </h3>
          {useExistingTrunk ? (
            <div className="text-sm">
              <span className="text-muted-foreground text-xs">Trunk</span>
              <p className="font-medium">{existingTrunkName || "Selected trunk"}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">Name</span>
                <p className="font-medium">{trunkConfig.trunkName}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">SIP Host</span>
                <p className="font-mono text-xs">{effectiveSipHost}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Port</span>
                <p className="font-mono">{trunkConfig.sipPort}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Transport</span>
                <p className="font-medium uppercase">{trunkConfig.transport}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Encryption</span>
                <p className="font-medium capitalize">{trunkConfig.mediaEncryption === "require" ? "SRTP Required" : trunkConfig.mediaEncryption}</p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-muted/50 rounded-lg p-4">
          <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            Phone Numbers ({selectedNumbers.length})
          </h3>
          <ScrollArea className="max-h-[180px]">
            <div className="space-y-2">
              {selectedNumbers.map((number) => (
                <div key={number.sid || number.phoneNumber} className="flex items-center gap-2 text-sm">
                  <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                  <span className="font-mono">{number.phoneNumber}</span>
                  {number.friendlyName && number.friendlyName !== number.phoneNumber && (
                    <span className="text-muted-foreground text-xs">({number.friendlyName})</span>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          What happens next?
        </h3>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li>We'll create a SIP trunk record with your configuration above.</li>
          <li>Your selected phone numbers will be imported and linked to this trunk.</li>
          <li>You'll need to <strong className="text-foreground">point your PBX or SIP client</strong> to the SIP host shown above to start receiving calls.</li>
        </ol>
        <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
          <p className="text-xs font-medium text-foreground mb-1.5">After connecting, configure your PBX:</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li className="flex items-start gap-1.5">
              <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0 text-blue-500" />
              Set the <strong className="text-foreground">Outbound Proxy / Trunk URI</strong> to the SIP Host address
            </li>
            <li className="flex items-start gap-1.5">
              <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0 text-blue-500" />
              Use port <strong className="text-foreground">{trunkConfig.sipPort}</strong> with <strong className="text-foreground">{trunkConfig.transport.toUpperCase()}</strong> transport
            </li>
            <li className="flex items-start gap-1.5">
              <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0 text-blue-500" />
              Register your imported numbers as inbound routes / DIDs in your PBX
            </li>
          </ul>
        </div>
      </div>

      <Button
        onClick={onConnect}
        disabled={isConnecting}
        className="w-full"
        size="lg"
        data-testid="button-connect-sip"
      >
        {isConnecting ? (
          <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Connecting...</>
        ) : (
          <><Zap className="h-5 w-5 mr-2" />Connect {selectedNumbers.length} Number{selectedNumbers.length !== 1 ? "s" : ""} via SIP</>
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        This will create a SIP trunk record and import your selected numbers. Your Twilio account settings won't be modified.
      </p>
    </div>
  );
}
