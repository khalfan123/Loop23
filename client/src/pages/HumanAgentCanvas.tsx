import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
  transferNumber: string;
  transferTargetType: string;
  ivrEnabled: boolean;
  ivrGreeting: string | null;
  label: string | null;
  createdAt: string;
  phoneNumber?: { id: string; phoneNumber: string; friendlyName: string | null; country: string | null; status: string } | null;
}

const STEPS = [
  { id: 1, label: "Phone Numbers", icon: Phone },
  { id: 2, label: "Transfer Settings", icon: PhoneForwarded },
  { id: 3, label: "IVR Config", icon: MessageSquare },
  { id: 4, label: "Review & Save", icon: Check },
];

function HumanAgentWizard({ embedded = false }: { embedded?: boolean }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [wizardMode, setWizardMode] = useState<"list" | "create">(embedded ? "list" : "create");
  const [deleteConnectionId, setDeleteConnectionId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPhoneIds, setSelectedPhoneIds] = useState<string[]>([]);
  const [transferNumber, setTransferNumber] = useState("");
  const [transferLabel, setTransferLabel] = useState("");
  const [ivrEnabled, setIvrEnabled] = useState(true);
  const [ivrGreeting, setIvrGreeting] = useState("");

  const { data: humanData, isLoading } = useQuery<{
    connections: HumanConnection[];
    availablePhoneNumbers: (PhoneNumber & { isUnavailable?: boolean; unavailableReason?: string | null })[];
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
      case 2: return transferNumber.trim().length > 0;
      case 3: return true;
      case 4: return true;
      default: return false;
    }
  };

  const goNext = () => {
    if (canProceed(currentStep) && currentStep < 4) {
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

      await apiRequest("POST", "/api/incoming-connections/human", {
        phoneNumberIds: selectedPhoneIds,
        transferNumber: transferNumber.trim(),
        transferTargetType: "phone",
        ivrEnabled,
        ivrGreeting: ivrGreeting.trim() || null,
        label: transferLabel.trim() || null,
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
      setTransferLabel("");
      setIvrEnabled(true);
      setIvrGreeting("");
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
    setTransferLabel("");
    setIvrEnabled(true);
    setIvrGreeting("");
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
          <p className="text-sm text-muted-foreground">No phone numbers available. Purchase phone numbers first.</p>
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
              <Card key={phone.id} className="opacity-50 cursor-not-allowed" data-testid={`card-phone-human-unavailable-${phone.id}`}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex items-center justify-center h-8 w-8 rounded-md bg-muted">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate text-muted-foreground">{phone.phoneNumber}</div>
                    <div className="text-xs text-muted-foreground truncate">
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

  const renderStep2 = () => (
    <div className="space-y-4" data-testid="human-wizard-step-2">
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

  const renderStep3 = () => (
    <div className="space-y-4" data-testid="human-wizard-step-3">
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
                  onChange={(e) => setIvrGreeting(e.target.value)}
                  placeholder="e.g., Thank you for calling. Please hold while we connect you to an agent."
                  className="min-h-[100px] text-sm"
                  data-testid="textarea-ivr-greeting"
                />
                <p className="text-xs text-muted-foreground">This message will be played to callers before they are transferred to the human agent.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6" data-testid="human-wizard-step-4">
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
          {currentStep < 4 ? (
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
              disabled={saveMutation.isPending || selectedPhoneIds.length === 0 || !transferNumber.trim()}
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