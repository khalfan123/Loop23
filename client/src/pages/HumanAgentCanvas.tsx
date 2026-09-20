import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AuthStorage } from "@/lib/auth-storage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  ArrowRight,
  Phone,
  PhoneForwarded,
  MessageSquare,
  Save,
  Loader2,
  Check,
  CheckCircle2,
  Circle,
  List,
  Plus,
  Trash2,
  Link as LinkIcon,
  User,
  Bot,
} from "lucide-react";

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  friendlyName: string | null;
  provider: string;
  country?: string | null;
  status?: string;
  isUnavailable?: boolean;
  unavailableReason?: string | null;
}

interface HumanConnection {
  id: string;
  phoneNumberId: string;
  agentId: string | null;
  transferNumber: string;
  transferTargetType: string;
  ivrEnabled: boolean;
  ivrGreeting: string | null;
  label: string | null;
  outboundCallerPhoneNumberId: string | null;
  outboundCallerPhoneNumber?: string | null;
  relayPhoneNumberId: string | null;
  relayPhoneNumber?: string | null;
  relayPhoneNumberIds?: string[] | null;
  relayPhoneNumbers?: string[] | null;
  createdAt: string;
  phoneNumber?: { id: string; phoneNumber: string; friendlyName: string | null; country: string | null; status: string } | null;
  agent?: { id: string; name: string } | null;
}

interface IncomingAgent {
  id: string;
  name: string;
  language: string | null;
  type: string;
}

type BuyCountryOption = { code: string; label: string };
const OUTBOUND_CLI_COUNTRIES: BuyCountryOption[] = [
  { code: "US", label: "United States (+1)" },
  { code: "GB", label: "United Kingdom (+44)" },
  { code: "CA", label: "Canada (+1)" },
  { code: "AU", label: "Australia (+61)" },
  { code: "DE", label: "Germany (+49)" },
  { code: "FR", label: "France (+33)" },
  { code: "NL", label: "Netherlands (+31)" },
  { code: "SE", label: "Sweden (+46)" },
  { code: "CH", label: "Switzerland (+41)" },
  { code: "SG", label: "Singapore (+65)" },
  { code: "NZ", label: "New Zealand (+64)" },
];

type AvailableNumber = {
  phoneNumber: string;
  friendlyName?: string | null;
  type?: string | null;
  region?: string | null;
};

type InventoryNumber = {
  phoneNumber: string;
  friendlyName?: string | null;
  sid: string;
  capabilities?: any;
  country?: string | null;
  numberType?: string | null;
  allocated?: boolean;
};

const STEPS = [
  { id: 1, label: "Phone Numbers", icon: Phone },
  { id: 2, label: "Outbound Caller ID", icon: Phone },
  { id: 3, label: "Transfer Settings", icon: PhoneForwarded },
  { id: 4, label: "IVR Config", icon: MessageSquare },
  { id: 5, label: "Review & Save", icon: Check },
];

function HumanAgentWizard({ embedded = false }: { embedded?: boolean }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [wizardMode, setWizardMode] = useState<"list" | "create">(embedded ? "list" : "create");
  const [deleteConnectionId, setDeleteConnectionId] = useState<string | null>(null);
  const [buyCountry, setBuyCountry] = useState<string>("");
  const [buyContains, setBuyContains] = useState<string>("");
  const [selectedAvailableNumber, setSelectedAvailableNumber] = useState<AvailableNumber | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPhoneIds, setSelectedPhoneIds] = useState<string[]>([]);
  const [transferNumber, setTransferNumber] = useState("");
  const [outboundCallerPhoneNumberId, setOutboundCallerPhoneNumberId] = useState("");
  // Ordered list of relay IDs (primary + fallbacks). Empty entries (`""`) are placeholder
  // rows in the UI before the operator picks a number. The server treats empty entries as
  // "not set" and the legacy single-relay path still works when the list is empty.
  const [relayPhoneNumberIds, setRelayPhoneNumberIds] = useState<string[]>([]);
  const [transferLabel, setTransferLabel] = useState("");
  const [ivrEnabled, setIvrEnabled] = useState(true);
  const [ivrGreeting, setIvrGreeting] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const { data: humanData, isLoading } = useQuery<{
    connections: HumanConnection[];
    availablePhoneNumbers: (PhoneNumber & { isUnavailable?: boolean; unavailableReason?: string | null })[];
    eligibleOutboundCallerPhones: { id: string; phoneNumber: string; friendlyName: string | null; country: string | null }[];
    eligibleRelayPhones: { id: string; phoneNumber: string; friendlyName: string | null; country: string | null }[];
    incomingAgents: IncomingAgent[];
    stats: { totalConnections: number; availableNumbers: number };
  }>({
    queryKey: ["/api/incoming-connections/human"],
  });

  const existingConnections = humanData?.connections || [];
  const phoneNumbers = humanData?.availablePhoneNumbers || [];

  const availablePhones = useMemo(() => {
    return phoneNumbers.filter((p) => !p.isUnavailable);
  }, [phoneNumbers]);

  const unavailablePhones = useMemo(() => {
    return phoneNumbers.filter((p) => p.isUnavailable);
  }, [phoneNumbers]);

  const eligibleOutboundCallerPhones = humanData?.eligibleOutboundCallerPhones ?? [];
  const eligibleRelayPhones = humanData?.eligibleRelayPhones ?? eligibleOutboundCallerPhones;

  const { data: currentUser } = useQuery<{ company?: string | null; firstName?: string | null; lastName?: string | null; email?: string }>({
    queryKey: ["/api/auth/me"],
  });

  const companyName = (currentUser?.company || "").trim();
  const defaultIvrGreeting = useMemo(() => {
    const who = companyName || "us";
    return `Thanks for calling ${who}. Please wait while we transfer you to an agent.`;
  }, [companyName]);

  // Auto-populate the IVR greeting on first load (when the field is still empty).
  // Users can freely edit or clear it afterward — we only seed the default once.
  const [ivrGreetingTouched, setIvrGreetingTouched] = useState(false);
  useEffect(() => {
    if (!ivrGreetingTouched && !ivrGreeting && defaultIvrGreeting) {
      setIvrGreeting(defaultIvrGreeting);
    }
  }, [defaultIvrGreeting, ivrGreeting, ivrGreetingTouched]);

  const { data: availableNumbers = [], isLoading: availableNumbersLoading, refetch: refetchAvailableNumbers } = useQuery<AvailableNumber[]>({
    queryKey: ["/api/phone-numbers/search", buyCountry, buyContains],
    queryFn: async () => {
      if (!buyCountry) return [];
      const params = new URLSearchParams();
      params.append("country", buyCountry);
      if (buyContains.trim()) params.append("contains", buyContains.trim());
      const headers: Record<string, string> = {};
      const authHeader = AuthStorage.getAuthHeader();
      if (authHeader) headers["Authorization"] = authHeader;
      const res = await fetch(`/api/phone-numbers/search?${params.toString()}`, { headers });
      if (!res.ok) throw new Error("Failed to search available numbers");
      return res.json();
    },
    enabled: currentStep === 2 && !!buyCountry,
  });

  const buyMutation = useMutation({
    mutationFn: async ({ phoneNumber, country }: { phoneNumber: string; country: string }) => {
      const res = await apiRequest("POST", "/api/phone-numbers/buy", { phoneNumber, country });
      return res.json();
    },
    onSuccess: (dbPhoneNumber: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/incoming-connections/human"] });
      setOutboundCallerPhoneNumberId(dbPhoneNumber?.id ?? "");
      toast({
        title: "Number purchased",
        description: "Selected as outbound caller ID.",
      });
      setSelectedAvailableNumber(null);
    },
    onError: (error: any) => {
      toast({
        title: "Purchase failed",
        description: error.message || "Failed to purchase number",
        variant: "destructive",
      });
    },
  });

  const { data: inventoryNumbers = [], isLoading: inventoryLoading } = useQuery<InventoryNumber[]>({
    queryKey: ["/api/phone-numbers/inventory"],
    enabled: !isLoading && phoneNumbers.length === 0,
  });

  const importMutation = useMutation({
    mutationFn: async (n: InventoryNumber) => {
      const res = await apiRequest("POST", "/api/phone-numbers/import-existing", {
        phoneNumber: n.phoneNumber,
        twilioSid: n.sid,
        friendlyName: n.friendlyName,
        capabilities: n.capabilities,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/incoming-connections/human"] });
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers/inventory"] });
      toast({ title: "Number imported" });
    },
    onError: (error: any) => {
      toast({
        title: "Import failed",
        description: error.message || "Failed to import number",
        variant: "destructive",
      });
    },
  });

  const selectedPhones = useMemo(() => {
    return availablePhones.filter((p) => selectedPhoneIds.includes(p.id));
  }, [availablePhones, selectedPhoneIds]);

  const togglePhone = (phoneId: string) => {
    setSelectedPhoneIds((prev) =>
      prev.includes(phoneId) ? prev.filter((id) => id !== phoneId) : [...prev, phoneId]
    );
  };

  const selectAllPhones = () => {
    setSelectedPhoneIds(availablePhones.map((p) => p.id));
  };

  const clearPhones = () => {
    setSelectedPhoneIds([]);
  };

  const canProceed = (step: number) => {
    switch (step) {
      case 1: return selectedPhoneIds.length > 0;
      case 2:
        return (
          outboundCallerPhoneNumberId.length > 0 &&
          eligibleOutboundCallerPhones.length > 0
        );
      case 3: return transferNumber.trim().length > 0;
      case 4: return true;
      case 5: return true;
      default: return false;
    }
  };

  const goNext = () => {
    if (canProceed(currentStep) && currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (selectedPhoneIds.length === 0) throw new Error("No phone numbers selected");
      if (!transferNumber.trim()) throw new Error("Transfer number is required");
      if (!outboundCallerPhoneNumberId) {
        throw new Error("Select an outbound caller ID for the agent transfer leg");
      }
      if (eligibleOutboundCallerPhones.length === 0) {
        throw new Error("No outbound caller ID numbers available. Add a phone number to your account first.");
      }

      await apiRequest("POST", "/api/incoming-connections/human", {
        phoneNumberIds: selectedPhoneIds,
        outboundCallerPhoneNumberId,
        relayPhoneNumberIds: relayPhoneNumberIds.filter((id) => id.length > 0),
        transferNumber: transferNumber.trim(),
        transferTargetType: "phone",
        ivrEnabled,
        ivrGreeting: ivrGreeting.trim() || null,
        label: transferLabel.trim() || null,
        agentId: selectedAgentId || null,
      });

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incoming-connections/human"] });
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers"] });
      toast({
        title: "Human Agent Connected",
        description: `${selectedPhoneIds.length} phone number(s) configured to transfer to ${transferNumber}.`,
      });
      setCurrentStep(1);
      setSelectedPhoneIds([]);
      setTransferNumber("");
      setOutboundCallerPhoneNumberId("");
      setRelayPhoneNumberIds([]);
      setTransferLabel("");
      setIvrEnabled(true);
      setIvrGreeting("");
      setSelectedAgentId(null);
      setWizardMode("list");
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to create human agent connection",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      await apiRequest("DELETE", `/api/incoming-connections/human/${connectionId}`);
      return connectionId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incoming-connections/human"] });
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers"] });
      setDeleteConnectionId(null);
      toast({
        title: "Connection Deleted",
        description: "The human agent connection has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete connection",
        variant: "destructive",
      });
    },
  });

  const startNewConnection = () => {
    setCurrentStep(1);
    setSelectedPhoneIds([]);
    setTransferNumber("");
    setOutboundCallerPhoneNumberId("");
    setRelayPhoneNumberIds([]);
    setTransferLabel("");
    setIvrEnabled(true);
    setIvrGreeting("");
    setSelectedAgentId(null);
    setWizardMode("create");
  };

  const renderConnectionsList = () => (
    <div className="space-y-4 p-4" data-testid="human-connections-list-view">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-human-connections-title">Human Agent Connections</h2>
          <p className="text-sm text-muted-foreground">
            Manage phone numbers that transfer incoming calls directly to human agents
          </p>
        </div>
        <Button onClick={startNewConnection} data-testid="button-new-human-connection">
          <Plus className="h-4 w-4 mr-2" />
          New Connection
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : existingConnections.length === 0 ? (
        <div className="text-center py-12">
          <LinkIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-medium mb-1">No Human Agent Connections</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Connect phone numbers to transfer incoming calls directly to human agents via IVR.
          </p>
          <Button onClick={startNewConnection} data-testid="button-new-human-connection-empty">
            <Plus className="h-4 w-4 mr-2" />
            Create First Connection
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {existingConnections.map((conn) => (
            <Card key={conn.id} data-testid={`card-human-connection-${conn.id}`}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-md bg-green-100 dark:bg-green-900/30 flex-shrink-0">
                  <Phone className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">
                    {conn.phoneNumber?.phoneNumber || "Unknown Number"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {conn.phoneNumber?.friendlyName || ""}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Agent CLI: {conn.outboundCallerPhoneNumber ?? "—"}
                    {(() => {
                      const list =
                        (conn.relayPhoneNumbers && conn.relayPhoneNumbers.length > 0
                          ? conn.relayPhoneNumbers
                          : conn.relayPhoneNumber
                          ? [conn.relayPhoneNumber]
                          : []);
                      if (list.length === 0) return null;
                      const primary = list[0];
                      const extras = list.length - 1;
                      return (
                        <>
                          {" · "}
                          <span className="text-indigo-600 dark:text-indigo-400">
                            Relay: {primary}
                            {extras > 0 ? ` (+${extras} backup${extras > 1 ? "s" : ""})` : ""}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <PhoneForwarded className="h-4 w-4 text-muted-foreground" />
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="flex items-center justify-center h-10 w-10 rounded-md bg-orange-100 dark:bg-orange-900/30">
                    <User className="h-5 w-5 text-orange-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate" data-testid={`text-transfer-number-${conn.id}`}>
                      {conn.transferNumber}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {conn.label && (
                        <Badge variant="outline" className="text-[10px]">
                          {conn.label}
                        </Badge>
                      )}
                      {conn.ivrEnabled && (
                        <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-600 dark:text-blue-400">
                          IVR
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteConnectionId(conn.id)}
                  data-testid={`button-delete-human-connection-${conn.id}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-1 py-4 px-4" data-testid="human-wizard-step-indicator">
      {STEPS.map((step, index) => {
        const isCompleted = currentStep > step.id;
        const isActive = currentStep === step.id;
        const StepIcon = step.icon;
        return (
          <div key={step.id} className="flex items-center gap-1">
            <button
              onClick={() => {
                if (isCompleted) setCurrentStep(step.id);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground font-medium"
                  : isCompleted
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 cursor-pointer"
                  : "bg-muted text-muted-foreground"
              }`}
              disabled={!isCompleted && !isActive}
              data-testid={`button-human-step-${step.id}`}
            >
              {isCompleted ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : isActive ? (
                <StepIcon className="h-3.5 w-3.5" />
              ) : (
                <Circle className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">{step.label}</span>
              <span className="sm:hidden">{step.id}</span>
            </button>
            {index < STEPS.length - 1 && (
              <div className={`w-6 h-px ${isCompleted ? "bg-green-400" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-4" data-testid="human-wizard-step-1">
      <div className="text-center mb-2">
        <h2 className="text-lg font-semibold">Select Phone Numbers</h2>
        <p className="text-sm text-muted-foreground">Choose which phone numbers will transfer incoming calls to a human agent</p>
      </div>

      {isLoading ? (
        <div className="space-y-3 max-w-2xl mx-auto">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : phoneNumbers.length === 0 ? (
        <div className="text-center py-8">
          <Phone className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No numbers have been added in the app yet.</p>

          <div className="max-w-xl mx-auto mt-4 text-left">
            <div className="text-xs text-muted-foreground mb-2">
              Numbers found in your connected account inventory. Import one to use it in the wizard.
            </div>

            <ScrollArea className="max-h-[320px] pr-2">
              <div className="grid gap-2">
                {inventoryLoading ? (
                  <>
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </>
                ) : inventoryNumbers.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No numbers found in inventory.</div>
                ) : (
                  inventoryNumbers.map((n) => {
                    const allocated = !!n.allocated;
                    return (
                      <Card key={n.phoneNumber}>
                        <CardContent className="p-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">{n.phoneNumber}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {n.friendlyName ? n.friendlyName : "Phone number"}
                              {allocated ? " · Already imported" : ""}
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant={allocated ? "outline" : "default"}
                            disabled={allocated || importMutation.isPending}
                            onClick={() => importMutation.mutate(n)}
                            data-testid={`button-import-inventory-${n.phoneNumber}`}
                          >
                            {importMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            {allocated ? "Imported" : "Import"}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto space-y-4">
          {availablePhones.length > 0 && (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm font-medium">{selectedPhoneIds.length} of {availablePhones.length} available selected</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={selectAllPhones} data-testid="button-select-all-phones-human">
                  Select All
                </Button>
                {selectedPhoneIds.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearPhones} data-testid="button-clear-phones-human">
                    Clear
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            {availablePhones.map((phone) => {
              const isSelected = selectedPhoneIds.includes(phone.id);
              return (
                <Card
                  key={phone.id}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "hover-elevate"
                  }`}
                  onClick={() => togglePhone(phone.id)}
                  data-testid={`card-phone-human-${phone.id}`}
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className={`flex items-center justify-center h-8 w-8 rounded-md ${
                      isSelected ? "bg-primary text-primary-foreground" : "bg-green-100 dark:bg-green-900/30"
                    }`}>
                      {isSelected ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Phone className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{phone.phoneNumber}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                        <span>{phone.provider}</span>
                        {phone.friendlyName && <span>{phone.friendlyName}</span>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {unavailablePhones.map((phone) => (
              <Card 
                key={phone.id} 
                className="opacity-50 cursor-not-allowed" 
                title={phone.unavailableReason || "Unavailable"}
                data-testid={`card-phone-human-unavailable-${phone.id}`}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex items-center justify-center h-8 w-8 rounded-md bg-muted">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate text-muted-foreground">{phone.phoneNumber}</div>
                    <div className="text-xs text-destructive/70 truncate">
                      {phone.unavailableReason || "Unavailable"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderStep2 = () => {
    const hasEligible = eligibleOutboundCallerPhones.length > 0;
    return (
      <div className="space-y-4" data-testid="human-wizard-step-2">
        <div className="text-center mb-2">
          <h2 className="text-lg font-semibold">Outbound Caller ID</h2>
          <p className="text-sm text-muted-foreground">Choose the number shown to the agent on the transfer leg</p>
        </div>

        <div className="max-w-md mx-auto space-y-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center justify-center h-10 w-10 rounded-md bg-amber-100 dark:bg-amber-900/30">
                  <Phone className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">Outbound caller ID (agent leg)</h3>
                  <p className="text-xs text-muted-foreground">
                    Used as caller ID when the UAE inbound number bridges to the transfer destination
                  </p>
                </div>
              </div>

              {hasEligible ? (
                <div className="space-y-2">
                  <Label>Outbound number</Label>
                  <Select
                    value={outboundCallerPhoneNumberId}
                    onValueChange={setOutboundCallerPhoneNumberId}
                  >
                    <SelectTrigger data-testid="select-outbound-cli">
                      <SelectValue placeholder="Select a non-UAE number" />
                    </SelectTrigger>
                    <SelectContent>
                      {eligibleOutboundCallerPhones.map((p) => (
                        <SelectItem key={p.id} value={p.id} data-testid={`option-outbound-cli-${p.id}`}>
                          {p.phoneNumber}
                          {p.friendlyName ? ` (${p.friendlyName})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Only non-UAE numbers are eligible. UAE (+971) numbers can&apos;t dial UAE PSTN reliably.
                  </p>
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertTitle className="text-sm">No eligible numbers on your account</AlertTitle>
                  <AlertDescription className="text-xs">
                    Buy a non-UAE number below to use as the outbound caller ID.
                  </AlertDescription>
                </Alert>
              )}

              <div className="border-t pt-4 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-md bg-indigo-100 dark:bg-indigo-900/30">
                    <PhoneForwarded className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">Two-hop relay number (optional)</h3>
                    <p className="text-xs text-muted-foreground">
                      For UAE-terminated agents: route via a non-UAE Twilio number so the agent's phone shows +1, avoiding UAE→UAE caller ID rejection.
                    </p>
                  </div>
                </div>

                {eligibleRelayPhones.length > 0 ? (
                  <>
                    <div className="space-y-2">
                      {relayPhoneNumberIds.length === 0 ? (
                        <div className="space-y-1">
                          <Label>Relay number</Label>
                          <Select
                            value="__none__"
                            onValueChange={(v) => {
                              if (v !== "__none__") setRelayPhoneNumberIds([v]);
                            }}
                          >
                            <SelectTrigger data-testid="select-relay-number">
                              <SelectValue placeholder="None — single-leg bridge" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__" data-testid="option-relay-none">
                                None — single-leg bridge (default)
                              </SelectItem>
                              {eligibleRelayPhones.map((p) => (
                                <SelectItem
                                  key={p.id}
                                  value={p.id}
                                  data-testid={`option-relay-${p.id}`}
                                >
                                  {p.phoneNumber}
                                  {p.friendlyName ? ` (${p.friendlyName})` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {relayPhoneNumberIds.map((rid, idx) => {
                            const usedElsewhere = relayPhoneNumberIds
                              .filter((_, i) => i !== idx)
                              .filter((v) => !!v);
                            const options = eligibleRelayPhones.filter(
                              (p) => p.id === rid || !usedElsewhere.includes(p.id)
                            );
                            const labelText = idx === 0 ? "Primary relay" : `Backup relay #${idx}`;
                            return (
                              <div key={`relay-row-${idx}`} className="space-y-1">
                                <Label>{labelText}</Label>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1">
                                    <Select
                                      value={rid || "__none__"}
                                      onValueChange={(v) => {
                                        const next = [...relayPhoneNumberIds];
                                        next[idx] = v === "__none__" ? "" : v;
                                        setRelayPhoneNumberIds(next.filter((x) => x.length > 0));
                                      }}
                                    >
                                      <SelectTrigger data-testid={`select-relay-${idx}`}>
                                        <SelectValue placeholder="Pick a non-UAE number" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {idx === 0 && (
                                          <SelectItem value="__none__" data-testid="option-relay-clear">
                                            None — disable relay
                                          </SelectItem>
                                        )}
                                        {options.map((p) => (
                                          <SelectItem
                                            key={p.id}
                                            value={p.id}
                                            data-testid={`option-relay-${idx}-${p.id}`}
                                          >
                                            {p.phoneNumber}
                                            {p.friendlyName ? ` (${p.friendlyName})` : ""}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  {idx > 0 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        setRelayPhoneNumberIds(
                                          relayPhoneNumberIds.filter((_, i) => i !== idx)
                                        )
                                      }
                                      data-testid={`button-remove-relay-${idx}`}
                                      aria-label={`Remove backup relay ${idx}`}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {(() => {
                            const usedIds = new Set(relayPhoneNumberIds.filter(Boolean));
                            const hasMore = eligibleRelayPhones.some((p) => !usedIds.has(p.id));
                            return hasMore ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setRelayPhoneNumberIds([...relayPhoneNumberIds, ""])}
                                data-testid="button-add-backup-relay"
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add backup relay
                              </Button>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                All eligible non-UAE numbers are already in the relay list.
                              </p>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      When set, the inbound UAE call is bridged into a conference and a second outbound call from the relay dials your agent. If the primary relay is rate-limited, suspended, or rejected by the destination carrier, the next relay in the list is tried automatically before the call drops.
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Add a non-UAE number to your account to enable two-hop relay.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-medium text-sm">{hasEligible ? "Buy another number" : "Buy a number"}</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => refetchAvailableNumbers()}
                  disabled={!buyCountry || availableNumbersLoading}
                  data-testid="button-refresh-available-numbers"
                >
                  Refresh
                </Button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Country</Label>
                  <Select value={buyCountry} onValueChange={setBuyCountry}>
                    <SelectTrigger data-testid="select-buy-country">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {OUTBOUND_CLI_COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Contains (optional)</Label>
                  <Input
                    value={buyContains}
                    onChange={(e) => setBuyContains(e.target.value)}
                    placeholder="Digits to match"
                    data-testid="input-buy-contains"
                  />
                </div>
              </div>

              {buyCountry ? (
                <div className="space-y-2">
                  <ScrollArea className="max-h-[200px] pr-2">
                    <div className="grid gap-2">
                      {availableNumbersLoading ? (
                        <Skeleton className="h-10 w-full" />
                      ) : availableNumbers.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No numbers found.</div>
                      ) : (
                        availableNumbers.slice(0, 25).map((n) => {
                          const isSel = selectedAvailableNumber?.phoneNumber === n.phoneNumber;
                          return (
                            <Button
                              key={n.phoneNumber}
                              type="button"
                              variant={isSel ? "default" : "outline"}
                              className="justify-between"
                              onClick={() => setSelectedAvailableNumber(n)}
                              data-testid={`button-select-available-${n.phoneNumber}`}
                            >
                              <span className="truncate">{n.phoneNumber}</span>
                              {isSel ? <Check className="h-4 w-4 ml-2" /> : null}
                            </Button>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>

                  <div className="flex items-center justify-end">
                    <Button
                      type="button"
                      onClick={() => {
                        if (!selectedAvailableNumber?.phoneNumber || !buyCountry) return;
                        buyMutation.mutate({ phoneNumber: selectedAvailableNumber.phoneNumber, country: buyCountry });
                      }}
                      disabled={!selectedAvailableNumber?.phoneNumber || buyMutation.isPending}
                      data-testid="button-buy-selected-number"
                    >
                      {buyMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Buy & use as caller ID
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Pick a country above to see available numbers to purchase.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const renderStep3 = () => (
    <div className="space-y-4" data-testid="human-wizard-step-3">
      <div className="text-center mb-2">
        <h2 className="text-lg font-semibold">Transfer Settings</h2>
        <p className="text-sm text-muted-foreground">Configure the phone number where incoming calls will be transferred to</p>
      </div>

      <div className="max-w-md mx-auto space-y-6">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center h-10 w-10 rounded-md bg-orange-100 dark:bg-orange-900/30">
                <PhoneForwarded className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Human Agent Phone Number</h3>
                <p className="text-xs text-muted-foreground">Calls will be transferred to this number immediately</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transfer-number">Transfer Phone Number</Label>
              <Input
                id="transfer-number"
                value={transferNumber}
                onChange={(e) => setTransferNumber(e.target.value)}
                placeholder="+1234567890"
                data-testid="input-transfer-number"
              />
              <p className="text-xs text-muted-foreground">Enter the phone number in E.164 format (e.g., +1234567890)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transfer-label">Label (Optional)</Label>
              <Input
                id="transfer-label"
                value={transferLabel}
                onChange={(e) => setTransferLabel(e.target.value)}
                placeholder="e.g., Front Desk, Support Team"
                data-testid="input-transfer-label"
              />
              <p className="text-xs text-muted-foreground">A friendly name to identify this transfer destination</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-4" data-testid="human-wizard-step-4">
      <div className="text-center mb-2">
        <h2 className="text-lg font-semibold">IVR Configuration</h2>
        <p className="text-sm text-muted-foreground">Configure what callers hear before being transferred to the human agent</p>
      </div>

      <div className="max-w-md mx-auto space-y-6">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-md bg-blue-100 dark:bg-blue-900/30">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">Enable IVR Greeting</h3>
                  <p className="text-xs text-muted-foreground">Play a message before transferring</p>
                </div>
              </div>
              <Switch
                checked={ivrEnabled}
                onCheckedChange={setIvrEnabled}
                data-testid="switch-ivr-enabled"
              />
            </div>

            {ivrEnabled && (
              <div className="space-y-2 pt-2 border-t">
                <Label htmlFor="ivr-greeting">Greeting Message</Label>
                <Textarea
                  id="ivr-greeting"
                  value={ivrGreeting}
                  onChange={(e) => {
                    setIvrGreetingTouched(true);
                    setIvrGreeting(e.target.value);
                  }}
                  placeholder={defaultIvrGreeting}
                  className="min-h-[100px] text-sm"
                  data-testid="textarea-ivr-greeting"
                />
                <p className="text-xs text-muted-foreground">This message will be played to callers before they are transferred to the human agent.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-md bg-purple-100 dark:bg-purple-900/30">
                <Bot className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Assign AI Agent (Optional)</h3>
                <p className="text-xs text-muted-foreground">Route calls to an AI agent first. The AI agent can transfer to the human number when needed.</p>
              </div>
            </div>

            {(humanData?.incomingAgents || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No incoming AI agents available. Create an incoming agent first to use this feature.</p>
            ) : (
              <div className="space-y-2">
                <ScrollArea className="h-[200px]">
                  <div className="grid gap-2 pr-3">
                    {(humanData?.incomingAgents || []).map((agent) => {
                      const isSelected = selectedAgentId === agent.id;
                      return (
                        <Card
                          key={agent.id}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? "border-purple-500 bg-purple-500/5" : "hover-elevate"
                          }`}
                          onClick={() => setSelectedAgentId(isSelected ? null : agent.id)}
                          data-testid={`card-agent-human-${agent.id}`}
                        >
                          <CardContent className="p-3 flex items-center gap-3">
                            <div className={`flex items-center justify-center h-8 w-8 rounded-md ${
                              isSelected ? "bg-purple-500 text-white" : "bg-purple-100 dark:bg-purple-900/30"
                            }`}>
                              {isSelected ? <Check className="h-4 w-4" /> : <Bot className="h-4 w-4 text-purple-600" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{agent.name}</div>
                              {agent.language && (
                                <div className="text-xs text-muted-foreground">{agent.language}</div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
                {selectedAgentId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedAgentId(null)}
                    data-testid="button-clear-agent"
                  >
                    Clear Selection
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6" data-testid="human-wizard-step-5">
      <div className="text-center mb-2">
        <h2 className="text-lg font-semibold">Review & Save</h2>
        <p className="text-sm text-muted-foreground">Review your configuration before creating the human agent connection</p>
      </div>

      <div className="max-w-2xl mx-auto space-y-4">
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Phone className="h-4 w-4 text-green-600" />
                <span className="font-medium text-sm">Phone Numbers ({selectedPhones.length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedPhones.map((phone) => (
                  <Badge key={phone.id} variant="outline" className="border-green-300 text-green-700 dark:text-green-400">
                    {phone.phoneNumber}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="h-4 w-4 text-amber-600" />
                <span className="font-medium text-sm">Outbound caller ID (agent PSTN leg)</span>
              </div>
              <div className="font-medium text-sm" data-testid="text-review-outbound-cli">
                {eligibleOutboundCallerPhones.find((p) => p.id === outboundCallerPhoneNumberId)?.phoneNumber ?? "—"}
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-2">
                <PhoneForwarded className="h-4 w-4 text-indigo-600" />
                <span className="font-medium text-sm">Two-hop relay number</span>
              </div>
              <div className="font-medium text-sm space-y-1" data-testid="text-review-relay">
                {relayPhoneNumberIds.filter(Boolean).length === 0 ? (
                  "Not used — single-leg bridge"
                ) : (
                  <>
                    {relayPhoneNumberIds.filter(Boolean).map((rid, idx) => {
                      const num = eligibleRelayPhones.find((p) => p.id === rid)?.phoneNumber ?? rid;
                      const tag = idx === 0 ? "Primary" : `Backup #${idx}`;
                      return (
                        <div key={rid} className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            {tag}
                          </Badge>
                          <span>{num}</span>
                        </div>
                      );
                    })}
                    <div className="text-xs text-muted-foreground">
                      Tried in order; if one fails, the next is dialed automatically.
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-2">
                <PhoneForwarded className="h-4 w-4 text-orange-600" />
                <span className="font-medium text-sm">Transfer Destination</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-md">
                  <User className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <div className="font-medium text-sm" data-testid="text-review-transfer-number">{transferNumber}</div>
                  {transferLabel && (
                    <Badge variant="outline" className="text-[10px] mt-0.5">{transferLabel}</Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-sm">IVR Configuration</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={ivrEnabled ? "default" : "secondary"} className="text-[10px]">
                    {ivrEnabled ? "IVR Enabled" : "IVR Disabled"}
                  </Badge>
                </div>
                {ivrEnabled && ivrGreeting && (
                  <div className="bg-muted rounded-md p-3 text-sm max-h-[120px] overflow-y-auto mt-2">
                    {ivrGreeting.slice(0, 300)}{ivrGreeting.length > 300 ? "..." : ""}
                  </div>
                )}
              </div>
            </div>

            {selectedAgentId && (
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Bot className="h-4 w-4 text-purple-600" />
                  <span className="font-medium text-sm">AI Agent</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-md">
                    <Bot className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="font-medium text-sm" data-testid="text-review-agent-name">
                    {(humanData?.incomingAgents || []).find(a => a.id === selectedAgentId)?.name || "Unknown Agent"}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="bg-muted/50 rounded-md p-3 text-sm text-muted-foreground">
          This will create {selectedPhoneIds.length} connection(s) that will immediately transfer incoming calls to <span className="font-medium text-foreground">{transferNumber}</span>.
          {ivrEnabled && ivrGreeting ? " Callers will hear a greeting message before being transferred." : ""}
          {transferLabel ? ` Label: "${transferLabel}".` : ""}
        </div>
      </div>
    </div>
  );

  if (wizardMode === "list" && embedded) {
    return (
      <div className="h-full flex flex-col">
        <ScrollArea className="flex-1">
          {renderConnectionsList()}
        </ScrollArea>

        <AlertDialog open={!!deleteConnectionId} onOpenChange={(open) => { if (!open) setDeleteConnectionId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Connection</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the human agent transfer for this phone number. The phone number will become available for new connections. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete-human">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteConnectionId && deleteMutation.mutate(deleteConnectionId)}
                className="bg-destructive text-destructive-foreground"
                data-testid="button-confirm-delete-human"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className={`${embedded ? "h-full" : "h-screen"} flex flex-col`}>
      {!embedded && (
        <div className="flex items-center justify-between px-4 py-3 border-b bg-background gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/app/departtest")} data-testid="button-back-human">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <div>
              <h1 className="font-semibold">Assign Human Agent</h1>
              <p className="text-xs text-muted-foreground">Set up call transfer to human agent step by step</p>
            </div>
          </div>
        </div>
      )}

      {embedded && (
        <div className="flex items-center px-4 py-2 border-b bg-background gap-2">
          <Button variant="ghost" size="sm" onClick={() => setWizardMode("list")} data-testid="button-back-to-human-list">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Connections
          </Button>
        </div>
      )}

      {renderStepIndicator()}

      <ScrollArea className="flex-1">
        <div className="px-4 pb-6">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
          {currentStep === 5 && renderStep5()}
        </div>
      </ScrollArea>

      <div className="flex items-center justify-between px-4 py-3 border-t bg-background gap-2">
        <Button
          variant="outline"
          onClick={() => {
            if (currentStep === 1) {
              if (embedded) {
                setWizardMode("list");
              } else {
                setLocation("/app/departtest");
              }
            } else {
              goBack();
            }
          }}
          data-testid="button-human-wizard-back"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {currentStep === 1 ? (embedded ? "Back to Connections" : "Back") : "Back"}
        </Button>

        <div className="flex items-center gap-2 flex-wrap">
          {currentStep < 5 ? (
            <Button
              onClick={goNext}
              disabled={!canProceed(currentStep)}
              data-testid="button-human-wizard-next"
            >
              Next
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={
                saveMutation.isPending ||
                selectedPhoneIds.length === 0 ||
                !transferNumber.trim() ||
                !outboundCallerPhoneNumberId ||
                eligibleOutboundCallerPhones.length === 0
              }
              data-testid="button-human-wizard-save"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save & Deploy
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HumanAgentCanvas({ embedded = false }: { embedded?: boolean } = {}) {
  return <HumanAgentWizard embedded={embedded} />;
}