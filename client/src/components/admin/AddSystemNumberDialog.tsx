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
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, Loader2, Download, CheckCircle2, Search, Trash2, MapPin, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import { AuthStorage } from "@/lib/auth-storage";

interface TwilioNumber {
  phoneNumber: string;
  friendlyName: string;
  sid: string;
  capabilities?: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
  pricing?: {
    purchasePrice: string;
    monthlyPrice: string;
    priceUnit: string;
  };
}

interface AvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  locality?: string;
  region?: string;
  isoCountry?: string;
  numberType?: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
}

interface AddSystemNumberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const COUNTRIES = [
  { code: 'US', name: 'United States', prefix: '+1' },
  { code: 'AE', name: 'UAE', prefix: '+971' },
  { code: 'GB', name: 'United Kingdom', prefix: '+44' },
  { code: 'AU', name: 'Australia', prefix: '+61' },
  { code: 'CA', name: 'Canada', prefix: '+1' },
  { code: 'DE', name: 'Germany', prefix: '+49' },
  { code: 'FR', name: 'France', prefix: '+33' },
  { code: 'IT', name: 'Italy', prefix: '+39' },
  { code: 'ES', name: 'Spain', prefix: '+34' },
  { code: 'NL', name: 'Netherlands', prefix: '+31' },
  { code: 'BE', name: 'Belgium', prefix: '+32' },
  { code: 'AT', name: 'Austria', prefix: '+43' },
  { code: 'CH', name: 'Switzerland', prefix: '+41' },
  { code: 'SE', name: 'Sweden', prefix: '+46' },
  { code: 'NO', name: 'Norway', prefix: '+47' },
  { code: 'DK', name: 'Denmark', prefix: '+45' },
  { code: 'IE', name: 'Ireland', prefix: '+353' },
  { code: 'PT', name: 'Portugal', prefix: '+351' },
  { code: 'FI', name: 'Finland', prefix: '+358' },
  { code: 'PL', name: 'Poland', prefix: '+48' },
  { code: 'NZ', name: 'New Zealand', prefix: '+64' },
  { code: 'SG', name: 'Singapore', prefix: '+65' },
  { code: 'JP', name: 'Japan', prefix: '+81' },
  { code: 'KR', name: 'South Korea', prefix: '+82' },
  { code: 'IN', name: 'India', prefix: '+91' },
  { code: 'BR', name: 'Brazil', prefix: '+55' },
  { code: 'MX', name: 'Mexico', prefix: '+52' },
  { code: 'ZA', name: 'South Africa', prefix: '+27' },
  { code: 'SA', name: 'Saudi Arabia', prefix: '+966' },
  { code: 'QA', name: 'Qatar', prefix: '+974' },
  { code: 'BH', name: 'Bahrain', prefix: '+973' },
  { code: 'OM', name: 'Oman', prefix: '+968' },
  { code: 'KW', name: 'Kuwait', prefix: '+965' },
];

const NUMBER_TYPES = [
  { value: 'local', label: 'Local' },
  { value: 'toll_free', label: 'Toll-Free' },
  { value: 'mobile', label: 'Mobile' },
];

export function AddSystemNumberDialog({ open, onOpenChange }: AddSystemNumberDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("import");
  
  const [selectedImportNumber, setSelectedImportNumber] = useState<TwilioNumber | null>(null);
  const [importFriendlyName, setImportFriendlyName] = useState("");

  const [searchCountry, setSearchCountry] = useState("US");
  const [searchNumberType, setSearchNumberType] = useState("local");
  const [searchContains, setSearchContains] = useState("");
  const [selectedPurchaseNumber, setSelectedPurchaseNumber] = useState<AvailableNumber | null>(null);
  const [purchaseFriendlyName, setPurchaseFriendlyName] = useState("");
  const [searchTriggered, setSearchTriggered] = useState(false);

  const { data: twilioNumbers = [], isLoading: loadingNumbers, refetch: refetchTwilio } = useQuery<TwilioNumber[]>({
    queryKey: ["/api/admin/phone-numbers/twilio-active"],
    enabled: open,
  });

  const { data: availableNumbers = [], isLoading: searchLoading, refetch: refetchSearch } = useQuery<AvailableNumber[]>({
    queryKey: ["/api/admin/phone-numbers/search-available", searchCountry, searchNumberType, searchContains],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('country', searchCountry);
      params.set('numberType', searchNumberType);
      if (searchContains) params.set('contains', searchContains);
      const headers: Record<string, string> = {};
      const authHeader = AuthStorage.getAuthHeader();
      if (authHeader) {
        headers["Authorization"] = authHeader;
      }
      const res = await fetch(`/api/admin/phone-numbers/search-available?${params.toString()}`, {
        headers,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to search numbers");
      }
      return res.json();
    },
    enabled: false,
  });

  const importMutation = useMutation({
    mutationFn: async ({ phoneNumber, friendlyName, sid, capabilities, numberType }: { phoneNumber: string; friendlyName?: string; sid: string; capabilities?: any; numberType?: string }) => {
      const res = await apiRequest("POST", "/api/admin/phone-numbers/import", { phoneNumber, friendlyName, twilioSid: sid, capabilities, numberType });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phone-numbers"] });
      resetAndClose();
      toast({ 
        title: t("admin.systemNumbers.importSuccess"), 
        description: t("admin.systemNumbers.importSuccessDesc") 
      });
    },
    onError: (error: any) => {
      toast({
        title: t("admin.systemNumbers.importFailed"),
        description: error.message || t("common.tryAgain"),
        variant: "destructive",
      });
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: async ({ phoneNumber, friendlyName }: { phoneNumber: string; friendlyName?: string }) => {
      const res = await apiRequest("POST", "/api/admin/phone-numbers/buy-system", { phoneNumber, friendlyName });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phone-numbers"] });
      resetAndClose();
      toast({ 
        title: t("admin.systemNumbers.purchaseSuccess"), 
        description: t("admin.systemNumbers.purchaseSuccessDesc") 
      });
    },
    onError: (error: any) => {
      toast({
        title: t("admin.systemNumbers.purchaseFailed"),
        description: error.message || t("common.tryAgain"),
        variant: "destructive",
      });
    },
  });

  const releaseMutation = useMutation({
    mutationFn: async (sid: string) => {
      const res = await apiRequest("DELETE", `/api/admin/phone-numbers/release/${sid}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phone-numbers"] });
      refetchTwilio();
      toast({ 
        title: t("admin.systemNumbers.releaseSuccess"), 
        description: t("admin.systemNumbers.releaseSuccessDesc") 
      });
    },
    onError: (error: any) => {
      toast({
        title: t("admin.systemNumbers.releaseFailed"),
        description: error.message || t("common.tryAgain"),
        variant: "destructive",
      });
    },
  });

  const handleImport = () => {
    if (!selectedImportNumber) return;
    importMutation.mutate({
      phoneNumber: selectedImportNumber.phoneNumber,
      friendlyName: importFriendlyName || selectedImportNumber.friendlyName,
      sid: selectedImportNumber.sid,
      capabilities: selectedImportNumber.capabilities,
    });
  };

  const handlePurchase = () => {
    if (!selectedPurchaseNumber) return;
    purchaseMutation.mutate({
      phoneNumber: selectedPurchaseNumber.phoneNumber,
      friendlyName: purchaseFriendlyName || undefined,
    });
  };

  const handleRelease = (number: TwilioNumber) => {
    if (confirm(t("admin.systemNumbers.releaseConfirm", { number: formatPhoneNumber(number.phoneNumber) }))) {
      releaseMutation.mutate(number.sid);
    }
  };

  const handleSearch = () => {
    setSearchTriggered(true);
    setSelectedPurchaseNumber(null);
    refetchSearch();
  };

  const resetAndClose = () => {
    onOpenChange(false);
    setSelectedImportNumber(null);
    setImportFriendlyName("");
    setSelectedPurchaseNumber(null);
    setPurchaseFriendlyName("");
    setSearchContains("");
    setSearchTriggered(false);
    setActiveTab("import");
  };

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `+1 (${cleaned.substring(1, 4)}) ${cleaned.substring(4, 7)}-${cleaned.substring(7)}`;
    }
    return phone;
  };

  const detectNumberType = (phoneNumber: string): string => {
    if (/^\+1(800|888|877|866|855|844|833)/.test(phoneNumber)) return 'Toll-Free';
    if (/^\+971800/.test(phoneNumber)) return 'Toll-Free';
    if (/^\+44(800|808)/.test(phoneNumber)) return 'Toll-Free';
    if (/^\+61(1800|1300)/.test(phoneNumber)) return 'Toll-Free';
    if (/^\+49(800)/.test(phoneNumber)) return 'Toll-Free';
    if (/^\+33(800|805)/.test(phoneNumber)) return 'Toll-Free';
    return 'Local';
  };

  const getCountryFlag = (phoneNumber: string): string | null => {
    if (phoneNumber.startsWith('+971')) return 'AE';
    if (phoneNumber.startsWith('+966')) return 'SA';
    if (phoneNumber.startsWith('+974')) return 'QA';
    if (phoneNumber.startsWith('+44')) return 'GB';
    if (phoneNumber.startsWith('+61')) return 'AU';
    if (phoneNumber.startsWith('+49')) return 'DE';
    if (phoneNumber.startsWith('+33')) return 'FR';
    if (phoneNumber.startsWith('+1')) return 'US';
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{t("admin.systemNumbers.title")}</DialogTitle>
          <DialogDescription>
            {t("admin.systemNumbers.description")}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="import" data-testid="tab-import-existing">{t("admin.systemNumbers.importExisting")}</TabsTrigger>
            <TabsTrigger value="purchase" data-testid="tab-purchase-new">{t("admin.systemNumbers.purchaseNew")}</TabsTrigger>
          </TabsList>

          <TabsContent value="import" className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <Label>{t("admin.systemNumbers.activeTwilioNumbers")}</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("admin.systemNumbers.activeTwilioDesc")}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => refetchTwilio()}
                  disabled={loadingNumbers}
                  data-testid="button-load-twilio-numbers"
                >
                  {loadingNumbers ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      {t("admin.systemNumbers.loadFromTwilio")}
                    </>
                  )}
                </Button>
              </div>
            </div>

            {twilioNumbers.length > 0 && (
              <div className="space-y-3">
                <Label>{t("admin.systemNumbers.availableCount", { count: twilioNumbers.length })}</Label>
                <ScrollArea className="h-[300px] border rounded-lg">
                  <div className="p-4 space-y-2">
                    {twilioNumbers.map((number) => (
                      <div
                        key={number.sid}
                        className={`p-4 rounded-lg border transition-all hover-elevate ${
                          selectedImportNumber?.sid === number.sid
                            ? "border-primary bg-primary/5"
                            : "border-border"
                        }`}
                        data-testid={`number-import-${number.phoneNumber}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div 
                            className="flex-1 space-y-2 cursor-pointer"
                            onClick={() => setSelectedImportNumber(number)}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <span className="font-mono font-semibold text-lg">
                                {formatPhoneNumber(number.phoneNumber)}
                              </span>
                              {getCountryFlag(number.phoneNumber) && (
                                <Badge variant="outline" className="text-xs">
                                  <Globe className="h-3 w-3 mr-1" />
                                  {getCountryFlag(number.phoneNumber)}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                              <span>{number.friendlyName}</span>
                              {detectNumberType(number.phoneNumber) === 'Toll-Free' && (
                                <Badge variant="outline" className="text-xs">Toll-Free</Badge>
                              )}
                            </div>
                            {number.pricing && (
                              <div className="text-sm space-y-1">
                                <div>
                                  <span className="font-semibold text-foreground">${number.pricing.purchasePrice}</span>
                                  <span className="text-muted-foreground"> {t("admin.systemNumbers.purchase")}</span>
                                </div>
                                <div>
                                  <span className="font-semibold text-foreground">${number.pricing.monthlyPrice}</span>
                                  <span className="text-muted-foreground">{t("admin.systemNumbers.perMonth")}</span>
                                </div>
                              </div>
                            )}
                            {number.capabilities && (
                              <div className="flex gap-2 flex-wrap">
                                {number.capabilities.voice && (
                                  <Badge variant="secondary" className="text-xs">{t("admin.systemNumbers.voice")}</Badge>
                                )}
                                {number.capabilities.sms && (
                                  <Badge variant="secondary" className="text-xs">{t("admin.systemNumbers.sms")}</Badge>
                                )}
                                {number.capabilities.mms && (
                                  <Badge variant="secondary" className="text-xs">{t("admin.systemNumbers.mms")}</Badge>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 items-end">
                            {selectedImportNumber?.sid === number.sid && (
                              <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRelease(number)}
                              disabled={releaseMutation.isPending}
                              data-testid={`button-release-${number.phoneNumber}`}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              {t("admin.systemNumbers.release")}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {twilioNumbers.length === 0 && !loadingNumbers && (
              <div className="text-center py-8 text-muted-foreground">
                <Phone className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>{t("admin.systemNumbers.clickToFetch")}</p>
              </div>
            )}

            {selectedImportNumber && (
              <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                <h4 className="font-semibold">{t("admin.systemNumbers.configureSystemNumber")}</h4>
                <div className="space-y-2">
                  <Label htmlFor="import-friendly-name">{t("admin.systemNumbers.friendlyNameOptional")}</Label>
                  <Input
                    id="import-friendly-name"
                    placeholder={selectedImportNumber.friendlyName}
                    value={importFriendlyName}
                    onChange={(e) => setImportFriendlyName(e.target.value)}
                    data-testid="input-import-friendly-name"
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>{t("admin.systemNumbers.selected")} <span className="font-mono font-semibold text-foreground">{formatPhoneNumber(selectedImportNumber.phoneNumber)}</span></p>
                  <p className="mt-1">{t("admin.systemNumbers.importNote")}</p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t flex-wrap">
              <Button
                variant="outline"
                onClick={resetAndClose}
                disabled={importMutation.isPending}
                data-testid="button-cancel-import"
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleImport}
                disabled={!selectedImportNumber || importMutation.isPending}
                data-testid="button-import-to-system-pool"
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("admin.systemNumbers.importing")}
                  </>
                ) : (
                  t("admin.systemNumbers.importToSystemPool")
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="purchase" className="space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Select value={searchCountry} onValueChange={setSearchCountry}>
                    <SelectTrigger data-testid="select-country">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.name} ({c.prefix})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Number Type</Label>
                  <Select value={searchNumberType} onValueChange={setSearchNumberType}>
                    <SelectTrigger data-testid="select-number-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {NUMBER_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Contains (optional)</Label>
                  <Input
                    placeholder="e.g. 800"
                    value={searchContains}
                    onChange={(e) => setSearchContains(e.target.value)}
                    data-testid="input-search-contains"
                  />
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleSearch}
                disabled={searchLoading}
                className="w-full sm:w-auto"
                data-testid="button-search-numbers"
              >
                {searchLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Search Available Numbers
              </Button>
            </div>

            {availableNumbers.length > 0 && (
              <div className="space-y-3">
                <Label>{t("admin.systemNumbers.availableNumbers")} ({availableNumbers.length})</Label>
                <ScrollArea className="h-[300px] border rounded-lg">
                  <div className="p-4 space-y-2">
                    {availableNumbers.map((number) => (
                      <div
                        key={number.phoneNumber}
                        className={`p-4 rounded-lg border cursor-pointer transition-all hover-elevate ${
                          selectedPurchaseNumber?.phoneNumber === number.phoneNumber
                            ? "border-primary bg-primary/5"
                            : "border-border"
                        }`}
                        onClick={() => setSelectedPurchaseNumber(number)}
                        data-testid={`number-purchase-${number.phoneNumber}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <span className="font-mono font-semibold text-lg">
                                {number.phoneNumber}
                              </span>
                              {number.numberType === 'toll_free' && (
                                <Badge variant="outline" className="text-xs">Toll-Free</Badge>
                              )}
                              {number.isoCountry && (
                                <Badge variant="secondary" className="text-xs">
                                  <Globe className="h-3 w-3 mr-1" />
                                  {number.isoCountry}
                                </Badge>
                              )}
                            </div>
                            {(number.locality || number.region) && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                <span>
                                  {[number.locality, number.region].filter(Boolean).join(", ")}
                                </span>
                              </div>
                            )}
                            <div className="flex gap-2 flex-wrap">
                              {number.capabilities.voice && (
                                <Badge variant="secondary" className="text-xs">{t("admin.systemNumbers.voice")}</Badge>
                              )}
                              {number.capabilities.sms && (
                                <Badge variant="secondary" className="text-xs">{t("admin.systemNumbers.sms")}</Badge>
                              )}
                              {number.capabilities.mms && (
                                <Badge variant="secondary" className="text-xs">{t("admin.systemNumbers.mms")}</Badge>
                              )}
                            </div>
                          </div>
                          {selectedPurchaseNumber?.phoneNumber === number.phoneNumber && (
                            <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {searchTriggered && availableNumbers.length === 0 && !searchLoading && (
              <div className="text-center py-6 text-muted-foreground space-y-3">
                <Phone className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No numbers available for purchase in this country/type.</p>
                <p className="text-sm">If you already have a number provisioned in your Twilio account, switch to the <strong>Import Existing</strong> tab and click <strong>Load from Twilio</strong> to import it.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("import")}
                  data-testid="button-switch-to-import"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Go to Import Existing
                </Button>
              </div>
            )}

            {selectedPurchaseNumber && (
              <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                <h4 className="font-semibold">{t("admin.systemNumbers.configureSystemNumber")}</h4>
                <div className="space-y-2">
                  <Label htmlFor="purchase-friendly-name">{t("admin.systemNumbers.friendlyNameOptional")}</Label>
                  <Input
                    id="purchase-friendly-name"
                    placeholder="e.g., System Pool - UAE Toll-Free"
                    value={purchaseFriendlyName}
                    onChange={(e) => setPurchaseFriendlyName(e.target.value)}
                    data-testid="input-purchase-friendly-name"
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>{t("admin.systemNumbers.selected")} <span className="font-mono font-semibold text-foreground">{selectedPurchaseNumber.phoneNumber}</span></p>
                  <p className="mt-1">{t("admin.systemNumbers.purchaseNote")}</p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t flex-wrap">
              <Button
                variant="outline"
                onClick={resetAndClose}
                disabled={purchaseMutation.isPending}
                data-testid="button-cancel-purchase"
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handlePurchase}
                disabled={!selectedPurchaseNumber || purchaseMutation.isPending}
                data-testid="button-purchase-to-system-pool"
              >
                {purchaseMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("admin.systemNumbers.purchasing")}
                  </>
                ) : (
                  t("admin.systemNumbers.purchaseAndAdd")
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
