import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Phone,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Download,
  Send,
  Copy,
  XCircle,
  ArrowRightLeft,
} from "lucide-react";

interface GccCountry {
  code: string;
  name: string;
  prefix: string;
  carriers: string[];
  regulator: { body: string; note: string };
}

interface PortabilityResult {
  portable: boolean;
  message: string;
  estimatedDays?: number;
  requirements: string[];
}

interface PortRequest {
  id: string;
  phoneNumber: string;
  countryCode: string;
  currentCarrier: string;
  authorizedName: string;
  companyName?: string;
  status: string;
  loaText?: string;
  createdAt: string;
  requestedPortDate?: string;
}

interface NumberPortingViewProps {
  onBack: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", icon: FileText },
  submitted: { label: "Submitted", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: Send },
  under_review: { label: "Under Review", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: Clock },
  approved: { label: "Approved", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle2 },
  in_progress: { label: "Porting In Progress", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", icon: ArrowRightLeft },
  completed: { label: "Completed", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", icon: XCircle },
};

export default function NumberPortingView({ onBack }: NumberPortingViewProps) {
  const { toast } = useToast();
  const [currentView, setCurrentView] = useState<"list" | "new">("list");
  const [step, setStep] = useState(1);
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedCarrier, setSelectedCarrier] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [portabilityResult, setPortabilityResult] = useState<PortabilityResult | null>(null);
  const [isCheckingPortability, setIsCheckingPortability] = useState(false);
  const [authorizedName, setAuthorizedName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<PortRequest | null>(null);

  const { data: countries = [] } = useQuery<GccCountry[]>({
    queryKey: ["/api/porting/countries"],
  });

  const { data: portRequests = [], isLoading: requestsLoading } = useQuery<PortRequest[]>({
    queryKey: ["/api/porting/requests"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/porting/requests", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/porting/requests"] });
      setSelectedRequest(data);
      setCurrentView("list");
      resetForm();
      toast({ title: "Port request submitted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to submit port request",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/porting/requests/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/porting/requests"] });
      setSelectedRequest(null);
      toast({ title: "Port request cancelled" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to cancel request",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setStep(1);
    setSelectedCountry("");
    setSelectedCarrier("");
    setPhoneNumber("");
    setPortabilityResult(null);
    setAuthorizedName("");
    setCompanyName("");
    setAccountNumber("");
    setAddressLine1("");
    setCity("");
    setRegion("");
    setPostalCode("");
  };

  const country = countries.find((c) => c.code === selectedCountry);

  const checkPortability = async () => {
    setIsCheckingPortability(true);
    try {
      const res = await apiRequest("POST", "/api/porting/check", {
        phoneNumber,
        countryCode: selectedCountry,
      });
      const result = await res.json();
      setPortabilityResult(result);
    } catch (error: any) {
      toast({
        title: "Portability check failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCheckingPortability(false);
    }
  };

  const handleSubmit = () => {
    createMutation.mutate({
      phoneNumber,
      countryCode: selectedCountry,
      currentCarrier: selectedCarrier,
      accountNumber: accountNumber || undefined,
      authorizedName,
      companyName: companyName || undefined,
      addressLine1,
      city,
      region: region || undefined,
      postalCode: postalCode || undefined,
      country: country?.name || selectedCountry,
    });
  };

  const copyLoaToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "LOA copied to clipboard" });
  };

  if (selectedRequest) {
    const statusConf = STATUS_CONFIG[selectedRequest.status] || STATUS_CONFIG.draft;
    const StatusIcon = statusConf.icon;
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" className="h-8 w-8 -ml-1" onClick={() => setSelectedRequest(null)} data-testid="button-back-port-detail">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">Port Request Details</h2>
            <p className="text-sm text-muted-foreground font-mono">{selectedRequest.phoneNumber}</p>
          </div>
        </div>

        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge className={statusConf.color}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConf.label}
            </Badge>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-muted-foreground">Phone Number</span>
              <p className="text-sm font-medium font-mono">{selectedRequest.phoneNumber}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Current Carrier</span>
              <p className="text-sm font-medium">{selectedRequest.currentCarrier}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Authorized Person</span>
              <p className="text-sm font-medium">{selectedRequest.authorizedName}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Submitted</span>
              <p className="text-sm font-medium">{new Date(selectedRequest.createdAt).toLocaleDateString()}</p>
            </div>
          </div>

          {selectedRequest.loaText && (
            <>
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Letter of Authorization
                  </h3>
                  <Button variant="outline" size="sm" onClick={() => copyLoaToClipboard(selectedRequest.loaText!)} data-testid="button-copy-loa">
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Copy
                  </Button>
                </div>
                <ScrollArea className="h-64 rounded-lg border bg-muted/30 p-4">
                  <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">{selectedRequest.loaText}</pre>
                </ScrollArea>
              </div>
            </>
          )}

          {!['completed', 'cancelled', 'rejected'].includes(selectedRequest.status) && (
            <>
              <Separator />
              <Button
                variant="destructive"
                size="sm"
                onClick={() => cancelMutation.mutate(selectedRequest.id)}
                disabled={cancelMutation.isPending}
                data-testid="button-cancel-port"
              >
                {cancelMutation.isPending ? "Cancelling..." : "Cancel Port Request"}
              </Button>
            </>
          )}
        </Card>
      </div>
    );
  }

  if (currentView === "new") {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" className="h-8 w-8 -ml-1" onClick={() => { setCurrentView("list"); resetForm(); }} data-testid="button-back-port-form">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">Port Your Number</h2>
            <p className="text-sm text-muted-foreground">Transfer your existing number to our platform</p>
          </div>
        </div>

        <div className="flex gap-1 mb-6">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        {step === 1 && (
          <Card className="p-6 space-y-5">
            <h3 className="font-semibold">Number Details</h3>
            <div className="space-y-4">
              <div>
                <Label>Country</Label>
                <Select value={selectedCountry} onValueChange={(v) => { setSelectedCountry(v); setSelectedCarrier(""); setPortabilityResult(null); }}>
                  <SelectTrigger data-testid="select-port-country">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name} ({c.prefix})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCountry && (
                <div>
                  <Label>Current Carrier</Label>
                  <Select value={selectedCarrier} onValueChange={setSelectedCarrier}>
                    <SelectTrigger data-testid="select-port-carrier">
                      <SelectValue placeholder="Select your current carrier" />
                    </SelectTrigger>
                    <SelectContent>
                      {(country?.carriers || []).map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>Phone Number</Label>
                <Input
                  placeholder={country ? `${country.prefix}XXXXXXXXX` : "+XXXXXXXXXXXX"}
                  value={phoneNumber}
                  onChange={(e) => { setPhoneNumber(e.target.value); setPortabilityResult(null); }}
                  data-testid="input-port-phone"
                />
                <p className="text-xs text-muted-foreground mt-1">Enter the full number with country code</p>
              </div>

              {selectedCountry && phoneNumber && (
                <Button
                  variant="outline"
                  onClick={checkPortability}
                  disabled={isCheckingPortability}
                  data-testid="button-check-portability"
                >
                  {isCheckingPortability ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Checking...</>
                  ) : (
                    "Check Portability"
                  )}
                </Button>
              )}

              {portabilityResult && (
                <div className={`rounded-lg p-4 border ${portabilityResult.portable ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800" : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"}`}>
                  <div className="flex items-start gap-3">
                    {portabilityResult.portable ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{portabilityResult.portable ? "Number is eligible for porting" : "Porting not available"}</p>
                      <p className="text-xs text-muted-foreground mt-1">{portabilityResult.message}</p>
                      {portabilityResult.requirements.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-medium mb-1.5">Requirements:</p>
                          <ul className="space-y-1">
                            {portabilityResult.requirements.map((r, i) => (
                              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <span className="mt-1 w-1 h-1 rounded-full bg-muted-foreground flex-shrink-0" />
                                {r}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {country?.regulator && (
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3">
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-400">{country.regulator.body}</p>
                  <p className="text-xs text-muted-foreground mt-1">{country.regulator.note}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={() => setStep(2)}
                disabled={!selectedCountry || !selectedCarrier || !phoneNumber}
                data-testid="button-port-next-1"
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card className="p-6 space-y-5">
            <h3 className="font-semibold">Account Holder Details</h3>
            <div className="space-y-4">
              <div>
                <Label>Full Name (as on carrier account) *</Label>
                <Input value={authorizedName} onChange={(e) => setAuthorizedName(e.target.value)} placeholder="Enter your full legal name" data-testid="input-port-name" />
              </div>
              <div>
                <Label>Company Name (optional)</Label>
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Enter company name if business account" data-testid="input-port-company" />
              </div>
              <div>
                <Label>Carrier Account Number</Label>
                <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Your account number with current carrier" data-testid="input-port-account" />
              </div>
              <Separator />
              <h4 className="text-sm font-medium">Address (must match carrier records)</h4>
              <div>
                <Label>Address *</Label>
                <Input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} placeholder="Street address" data-testid="input-port-address" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>City *</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" data-testid="input-port-city" />
                </div>
                <div>
                  <Label>Region / Emirate</Label>
                  <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Region" data-testid="input-port-region" />
                </div>
              </div>
              <div className="w-1/2">
                <Label>Postal Code</Label>
                <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="Postal code" data-testid="input-port-postal" />
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)} data-testid="button-port-back-2">
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!authorizedName || !addressLine1 || !city}
                data-testid="button-port-next-2"
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card className="p-6 space-y-5">
            <h3 className="font-semibold">Review & Submit</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50">
                <div>
                  <span className="text-xs text-muted-foreground">Phone Number</span>
                  <p className="text-sm font-medium font-mono">{phoneNumber}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Country</span>
                  <p className="text-sm font-medium">{country?.name}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Current Carrier</span>
                  <p className="text-sm font-medium">{selectedCarrier}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Account Holder</span>
                  <p className="text-sm font-medium">{authorizedName}</p>
                </div>
              </div>

              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-2">What happens next?</p>
                <ol className="space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-amber-700 dark:text-amber-400 flex-shrink-0">1.</span>
                    We generate a Letter of Authorization (LOA) for your number.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-amber-700 dark:text-amber-400 flex-shrink-0">2.</span>
                    Our team reviews your request and submits it to Twilio for porting.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-amber-700 dark:text-amber-400 flex-shrink-0">3.</span>
                    Your current carrier will release the number (typically {country?.regulator?.note?.match(/\d+-\d+ business days/)?.[0] || "5-14 business days"}).
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-amber-700 dark:text-amber-400 flex-shrink-0">4.</span>
                    Once ported, the number appears in your account ready to connect to an AI agent.
                  </li>
                </ol>
              </div>

              <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-4">
                <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">Required Documents</p>
                <p className="text-xs text-muted-foreground">After submitting, you will need to provide:</p>
                <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                  <li>• Copy of government-issued ID</li>
                  <li>• Recent bill from {selectedCarrier}</li>
                  <li>• Signed copy of the LOA (generated after submission)</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)} data-testid="button-port-back-3">
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending}
                data-testid="button-submit-port"
              >
                {createMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" /> Submit Port Request</>
                )}
              </Button>
            </div>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" className="h-8 w-8 -ml-1" onClick={onBack} data-testid="button-back-porting">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Number Porting
          </h2>
          <p className="text-sm text-muted-foreground">Transfer your existing phone numbers to our platform</p>
        </div>
      </div>

      <Button
        className="w-full mb-6"
        onClick={() => setCurrentView("new")}
        data-testid="button-new-port-request"
      >
        <Phone className="h-4 w-4 mr-2" />
        Port a New Number
      </Button>

      {requestsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : portRequests.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <ArrowRightLeft className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-semibold mb-1">No porting requests yet</h3>
          <p className="text-sm text-muted-foreground">
            Port your existing mobile or landline number to use it with your AI agents.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Your Port Requests</h3>
          {portRequests.map((req) => {
            const statusConf = STATUS_CONFIG[req.status] || STATUS_CONFIG.draft;
            const StatusIcon = statusConf.icon;
            return (
              <Card
                key={req.id}
                className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedRequest(req)}
                data-testid={`port-request-${req.id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Phone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-mono text-sm font-medium">{req.phoneNumber}</p>
                      <p className="text-xs text-muted-foreground">{req.currentCarrier}</p>
                    </div>
                  </div>
                  <Badge className={statusConf.color}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {statusConf.label}
                  </Badge>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
