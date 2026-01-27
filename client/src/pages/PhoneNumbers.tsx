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
import { useState, useEffect, useRef, Suspense, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Phone, ShoppingCart, Check, Trash2, CreditCard, Link as LinkIcon, Smartphone, Globe, MapPin, Upload, FileText, AlertCircle, Shield, Server, Loader2, RefreshCw, PhoneOutgoing, PhoneIncoming, Network, Bot } from "lucide-react";
import { usePluginRegistry } from "@/contexts/plugin-registry";
import { AuthStorage } from "@/lib/auth-storage";
import { usePluginStatus } from "@/hooks/use-plugin-status";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Default monthly credits - will be overridden by API value
const DEFAULT_MONTHLY_CREDITS = 50;

interface PublicSettings {
  phone_number_monthly_credits: number;
  low_credits_threshold: number;
  credits_per_minute: number;
}

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  twilioSid: string;
  friendlyName?: string;
  country: string;
  capabilities?: any;
  status: string;
  purchasedAt: string;
  isSystemPool?: boolean;
}

interface AvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  locality?: string;
  region?: string;
  addressRequirements?: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
}

interface IncomingConnection {
  id: string;
  phoneNumberId: string;
  agentId: string;
  agent: {
    name: string;
  };
}

interface TwilioCountry {
  id: string;
  code: string;
  name: string;
  dialCode: string;
  isActive: boolean;
  sortOrder: number;
}

interface VoiceEngineSettings {
  plivo_openai_engine_enabled: boolean;
  twilio_kyc_required: boolean;
  plivo_kyc_required: boolean;
}

interface UserWithKyc {
  id: string;
  kycStatus?: 'pending' | 'submitted' | 'approved' | 'rejected' | null;
}

interface PlivoPhoneNumber {
  id: string;
  phoneNumber: string;
  country: string;
  region?: string;
  status: 'pending' | 'active' | 'suspended' | 'released';
  kycStatus?: 'pending' | 'submitted' | 'approved' | 'rejected' | 'requires_resubmission';
  kycRejectionReason?: string;
  purchaseCredits: number;
  monthlyCredits: number;
  purchasedAt: string;
}

interface PlivoPricing {
  id: string;
  countryCode: string;
  countryName: string;
  purchaseCredits: number;
  monthlyCredits: number;
  kycRequired: boolean;
  isActive: boolean;
}

interface PlivoAvailableNumber {
  phoneNumber: string;
  country: string;
  region?: string;
  type: string;
  monthlyRentalRate: string;
}

interface PlivoIncomingConnection {
  phoneNumberId: string;
  phoneNumber: string;
  friendlyName?: string;
  country: string;
  agent?: { id: string; name: string; type?: string; telephonyProvider?: string; } | null;
}

interface TcxcDid {
  id: string;
  phoneNumber: string;
  countryCode: string;
  countryName: string;
  region: string;
  city: string;
  type: string;
  capabilities: string[];
  monthlyPrice: number;
  setupPrice: number;
  currency: string;
  available: boolean;
}

interface TcxcStatus {
  configured: boolean;
  healthy: boolean;
  credentialCount: number;
}

interface MarketplaceDid {
  i_did: number;
  did: string;
  description: string;
  country: string;
  country_code: string;
  seller: string;
  seller_id: number;
  price_per_minute: number;
  monthly_fee: number;
  setup_fee: number;
  currency: string;
  voice: boolean;
  sms: boolean;
  fax: boolean;
  video: boolean;
  did_type: string;
  capacity: number;
}

interface TcxcInterconnection {
  id: string;
  name: string;
  connectionType: string;
  techPrefixes: string[];
  sipServer: string | null;
  sipPort: number | null;
  healthStatus: string;
  isActive: boolean;
}

interface ProviderCallerId {
  id: string;
  userId: string;
  credentialId: string;
  phoneNumber: string;
  providerName: string;
  techPrefix: string;
  country: string;
  countryCode: string | null;
  numberType: string;
  status: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface GccCountry {
  code: string;
  name: string;
  prefix: string;
}

interface CarrierProvider {
  id: string;
  name: string;
  techPrefix: string;
  sellerId: string;
  interconnectionId: string;
}

const TECH_PREFIX_TO_CARRIER: Record<string, { name: string; sellerId: string }> = {
  "73297#": { name: "AirTel", sellerId: "airtel" },
  "76091#": { name: "Mobily", sellerId: "mobily" },
  "74778#": { name: "Tonerro", sellerId: "tonerro" },
};

export default function PhoneNumbers() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [searchCountry, setSearchCountry] = useState("");
  const [searchContains, setSearchContains] = useState("");
  const [selectedNumber, setSelectedNumber] = useState<AvailableNumber | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [friendlyName, setFriendlyName] = useState("");
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
  const [numberToRelease, setNumberToRelease] = useState<PhoneNumber | null>(null);

  // Provider selection state (unified buy button)
  const [providerSelectDialogOpen, setProviderSelectDialogOpen] = useState(false);

  // Plivo state
  const [plivoBuyDialogOpen, setPlivoBuyDialogOpen] = useState(false);
  const [plivoSearchCountry, setPlivoSearchCountry] = useState("");
  const [plivoSearchRegion, setPlivoSearchRegion] = useState("");
  const [plivoSearchType, setPlivoSearchType] = useState<"local" | "tollfree">("local");
  const [selectedPlivoNumber, setSelectedPlivoNumber] = useState<PlivoAvailableNumber | null>(null);
  const [plivoReleaseDialogOpen, setPlivoReleaseDialogOpen] = useState(false);
  const [plivoNumberToRelease, setPlivoNumberToRelease] = useState<PlivoPhoneNumber | null>(null);
  const [kycRequiredDialogOpen, setKycRequiredDialogOpen] = useState(false);
  const [addressRequiredDialogOpen, setAddressRequiredDialogOpen] = useState(false);
  const [addressRequiredCountry, setAddressRequiredCountry] = useState<string>("");

  // Countries that require address verification for phone number purchases
  const ADDRESS_REQUIRED_COUNTRIES = ['AU', 'GB', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'CH', 'SE', 'NO', 'DK', 'FI', 'IE', 'NZ', 'JP', 'SG', 'HK'];

  // TCXC state
  const [tcxcSearchCountry, setTcxcSearchCountry] = useState("");
  const [tcxcSearchType, setTcxcSearchType] = useState<"local" | "tollfree" | "mobile">("local");
  const [selectedTcxcDid, setSelectedTcxcDid] = useState<TcxcDid | null>(null);
  const [tcxcBuyDialogOpen, setTcxcBuyDialogOpen] = useState(false);

  // Provider Numbers Lookup state
  const [providerLookupDialogOpen, setProviderLookupDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<TcxcInterconnection | null>(null);
  const [selectedCarrier, setSelectedCarrier] = useState<CarrierProvider | null>(null);
  const [providerNumberSearch, setProviderNumberSearch] = useState("");
  const [newCallerIdNumber, setNewCallerIdNumber] = useState("");
  const [newCallerIdCountry, setNewCallerIdCountry] = useState("");
  const [marketplaceSearchPrefix, setMarketplaceSearchPrefix] = useState("");
  const [marketplaceSearchResults, setMarketplaceSearchResults] = useState<MarketplaceDid[]>([]);
  const [isSearchingMarketplace, setIsSearchingMarketplace] = useState(false);
  const [selectedMarketplaceDid, setSelectedMarketplaceDid] = useState<MarketplaceDid | null>(null);
  const [rentDialogOpen, setRentDialogOpen] = useState(false);

  // Fetch user addresses for address requirement check
  interface UserAddress {
    id: string;
    isoCountry: string;
    status: string;
  }
  const { data: userAddresses = [] } = useQuery<UserAddress[]>({
    queryKey: ["/api/user/addresses"],
  });

  // Fetch public settings for dynamic monthly credits value
  const { data: publicSettings } = useQuery<PublicSettings>({
    queryKey: ["/api/settings/public"],
  });
  
  // Use dynamic monthly credits from settings, fallback to default
  const MONTHLY_CREDITS = publicSettings?.phone_number_monthly_credits || DEFAULT_MONTHLY_CREDITS;

  const { data: ownedNumbers = [], isLoading: ownedLoading } = useQuery<PhoneNumber[]>({
    queryKey: ["/api/phone-numbers"],
  });

  const { data: countries = [], isLoading: countriesLoading } = useQuery<TwilioCountry[]>({
    queryKey: ["/api/twilio-countries"],
  });

  // Voice engine settings to check if Plivo is enabled and KYC requirements
  const { data: voiceEngineSettings } = useQuery<VoiceEngineSettings>({
    queryKey: ["/api/settings/voice-engine"],
  });
  const plivoEnabled = voiceEngineSettings?.plivo_openai_engine_enabled || false;
  const twilioKycRequired = voiceEngineSettings?.twilio_kyc_required ?? true;
  const plivoKycRequired = voiceEngineSettings?.plivo_kyc_required ?? true;
  
  // SIP access - requires plugin enabled AND user's plan has SIP access
  const { isSipPluginEnabled } = usePluginStatus();
  const pluginRegistry = usePluginRegistry();
  const phoneNumbersTabs = pluginRegistry.getPhoneNumbersTabs();

  // User KYC status
  const { data: currentUser } = useQuery<UserWithKyc>({
    queryKey: ["/api/auth/me"],
  });
  const isKycApproved = currentUser?.kycStatus === 'approved';

  const canPurchaseTwilio = !twilioKycRequired || isKycApproved;
  const canPurchasePlivo = !plivoKycRequired || isKycApproved;

  // TCXC credentials query - check if TCXC is configured
  const { data: tcxcStatus } = useQuery<TcxcStatus>({
    queryKey: ["/api/tcxc/status"],
  });
  const tcxcConfigured = tcxcStatus?.configured ?? false;

  // TCXC interconnections query (tech prefixes, routing)
  const { data: tcxcInterconnections = [] } = useQuery<TcxcInterconnection[]>({
    queryKey: ["/api/tcxc/interconnections"],
    enabled: tcxcConfigured,
  });

  // TCXC GCC countries
  const { data: gccCountries = [] } = useQuery<GccCountry[]>({
    queryKey: ["/api/tcxc/countries/gcc"],
  });

  // Derive carrier providers from interconnections' tech prefixes
  // If no tech prefixes are configured, provide default known carriers using first available interconnection
  const carrierProviders = useMemo(() => {
    const providers: CarrierProvider[] = [];
    
    // First try to derive from configured tech prefixes
    tcxcInterconnections.forEach(interconnection => {
      interconnection.techPrefixes.forEach(prefix => {
        const carrier = TECH_PREFIX_TO_CARRIER[prefix];
        if (carrier) {
          providers.push({
            id: `${interconnection.id}-${prefix}`,
            name: carrier.name,
            techPrefix: prefix,
            sellerId: carrier.sellerId,
            interconnectionId: interconnection.id,
          });
        }
      });
    });
    
    // If no carriers found from tech prefixes, provide default carriers using first interconnection
    if (providers.length === 0 && tcxcInterconnections.length > 0) {
      const defaultInterconnection = tcxcInterconnections[0];
      Object.entries(TECH_PREFIX_TO_CARRIER).forEach(([prefix, carrier]) => {
        providers.push({
          id: `${defaultInterconnection.id}-${prefix}`,
          name: carrier.name,
          techPrefix: prefix,
          sellerId: carrier.sellerId,
          interconnectionId: defaultInterconnection.id,
        });
      });
    }
    
    return providers;
  }, [tcxcInterconnections]);

  // TCXC my DIDs query
  const { data: tcxcMyDids = [], isLoading: tcxcMyDidsLoading, refetch: refetchTcxcMyDids } = useQuery<TcxcDid[]>({
    queryKey: ["/api/tcxc/dids/my"],
    enabled: tcxcConfigured,
  });

  // Provider caller IDs query
  const { data: providerCallerIds = [], refetch: refetchProviderCallerIds } = useQuery<ProviderCallerId[]>({
    queryKey: ["/api/tcxc/provider-caller-ids"],
    enabled: tcxcConfigured,
  });

  // Add provider caller ID mutation
  const addProviderCallerIdMutation = useMutation({
    mutationFn: async (data: { 
      credentialId: string; 
      phoneNumber: string; 
      providerName: string; 
      techPrefix: string; 
      country: string; 
    }) => {
      const response = await apiRequest("POST", "/api/tcxc/provider-caller-ids", data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tcxc/provider-caller-ids"] });
      toast({
        title: "Caller ID Added",
        description: "Number added to your outbound caller ID pool.",
      });
      setNewCallerIdNumber("");
      setNewCallerIdCountry("");
      setProviderLookupDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add caller ID",
        variant: "destructive",
      });
    },
  });

  // Delete provider caller ID mutation
  const deleteProviderCallerIdMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/tcxc/provider-caller-ids/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tcxc/provider-caller-ids"] });
      toast({
        title: "Caller ID Removed",
        description: "Number removed from your outbound caller ID pool.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove caller ID",
        variant: "destructive",
      });
    },
  });

  // Search marketplace DIDs from providers
  // Note: seller parameter is optional - if empty, searches all sellers on TCXC marketplace
  const searchMarketplaceDids = async (seller?: string, prefix?: string) => {
    setIsSearchingMarketplace(true);
    try {
      const response = await apiRequest("POST", "/api/tcxc/marketplace/search", {
        // Only include seller if it's a valid non-empty string
        ...(seller && seller.trim() ? { seller: seller.trim() } : {}),
        prefix: prefix || undefined,
        voice: true,
        limit: 50,
      });
      const data = response as unknown as MarketplaceDid[];
      setMarketplaceSearchResults(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error("Marketplace search error:", error);
      toast({
        title: "Search Failed",
        description: error.message || "Failed to search marketplace",
        variant: "destructive",
      });
      setMarketplaceSearchResults([]);
    } finally {
      setIsSearchingMarketplace(false);
    }
  };

  // Rent marketplace DID mutation
  const rentMarketplaceDidMutation = useMutation({
    mutationFn: async (data: { 
      iDid: number; 
      did: string;
      seller: string;
      country: string;
      monthlyFee: number;
      credentialId: string;
      techPrefix: string;
    }) => {
      const response = await apiRequest("POST", "/api/tcxc/marketplace/rent", data);
      return { response, did: data.did };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tcxc/dids/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tcxc/provider-caller-ids"] });
      toast({
        title: "Number Rented Successfully",
        description: `${data.did} is now available for outbound calls.`,
      });
      setRentDialogOpen(false);
      setSelectedMarketplaceDid(null);
      setMarketplaceSearchResults([]);
    },
    onError: (error: any) => {
      toast({
        title: "Rental Failed",
        description: error.message || "Failed to rent number",
        variant: "destructive",
      });
    },
  });

  // TCXC available DIDs search
  const { data: tcxcAvailableDids = [], isLoading: tcxcSearchLoading, refetch: searchTcxcDids } = useQuery<TcxcDid[]>({
    queryKey: ["/api/tcxc/dids/available", tcxcSearchCountry, tcxcSearchType],
    queryFn: async () => {
      if (!tcxcSearchCountry) return [];
      const params = new URLSearchParams();
      params.append("countryCode", tcxcSearchCountry);
      params.append("type", tcxcSearchType);
      params.append("limit", "50");
      const headers: Record<string, string> = {};
      const authHeader = AuthStorage.getAuthHeader();
      if (authHeader) headers["Authorization"] = authHeader;
      const res = await fetch(`/api/tcxc/dids/available?${params.toString()}`, { headers });
      if (!res.ok) throw new Error("Failed to search TCXC DIDs");
      return res.json();
    },
    enabled: tcxcConfigured && !!tcxcSearchCountry,
  });

  // Plivo phone numbers query
  const { data: plivoNumbers = [], isLoading: plivoNumbersLoading } = useQuery<PlivoPhoneNumber[]>({
    queryKey: ["/api/plivo/phone-numbers"],
    enabled: plivoEnabled,
  });

  // Plivo countries/pricing query (user-facing endpoint)
  const { data: plivoCountries = [], isLoading: plivoCountriesLoading } = useQuery<PlivoPricing[]>({
    queryKey: ["/api/plivo/phone-numbers/countries"],
    enabled: plivoEnabled,
  });

  const activePlivoCountries = plivoCountries.filter(c => c.isActive);

  // Plivo incoming connections query
  const { data: plivoConnectionsData } = useQuery<{ connections: PlivoIncomingConnection[] }>({
    queryKey: ["/api/plivo/incoming-connections"],
    enabled: plivoEnabled,
  });
  const plivoConnections = plivoConnectionsData?.connections || [];

  // Plivo number search
  const buildPlivoSearchQuery = () => {
    const params = new URLSearchParams();
    if (plivoSearchCountry) params.append("country", plivoSearchCountry);
    if (plivoSearchRegion) params.append("region", plivoSearchRegion);
    params.append("type", plivoSearchType);
    return params.toString();
  };

  const canPlivoSearch = () => {
    return plivoSearchCountry.length === 2;
  };

  const { data: plivoAvailableNumbers = [], isLoading: plivoSearchLoading, refetch: searchPlivoNumbers } = useQuery<PlivoAvailableNumber[]>({
    queryKey: ["/api/plivo/phone-numbers/search", plivoSearchCountry, plivoSearchRegion, plivoSearchType],
    queryFn: async () => {
      if (!canPlivoSearch()) return [];
      const headers: Record<string, string> = {};
      const authHeader = AuthStorage.getAuthHeader();
      if (authHeader) headers["Authorization"] = authHeader;
      const res = await fetch(`/api/plivo/phone-numbers/search?${buildPlivoSearchQuery()}`, { headers });
      if (!res.ok) throw new Error("Failed to search Plivo numbers");
      const data = await res.json();
      // API returns { numbers: [...], pricing: {...} }, extract numbers array
      return Array.isArray(data) ? data : (data.numbers || []);
    },
    enabled: canPlivoSearch() && plivoEnabled,
  });

  useEffect(() => {
    if (countries.length > 0 && !searchCountry) {
      const usCountry = countries.find(c => c.code === "US");
      setSearchCountry(usCountry ? "US" : countries[0].code);
    }
  }, [countries, searchCountry]);

  const { data: incomingData } = useQuery<{ connections: IncomingConnection[]; allConnections: IncomingConnection[]; availablePhoneNumbers: PhoneNumber[] }>({
    queryKey: ["/api/incoming-connections"],
  });

  const allConnections = incomingData?.allConnections || [];

  const getConnection = (phoneNumberId: string) => {
    return allConnections.find(c => c.phoneNumberId === phoneNumberId);
  };

  const getPlivoConnection = (phoneNumberId: string) => {
    return plivoConnections.find(c => c.phoneNumberId === phoneNumberId);
  };

  const isCountryValid = countries.some(c => c.code === searchCountry);

  const buildSearchQuery = () => {
    const params = new URLSearchParams();
    if (searchCountry && isCountryValid) {
      params.append("country", searchCountry);
    }
    if (searchContains) {
      params.append("contains", searchContains);
    }
    return params.toString();
  };

  const canSearch = () => {
    return !!searchCountry && isCountryValid;
  };

  const { data: availableNumbers = [], isLoading: searchLoading, refetch: searchNumbers } = useQuery<AvailableNumber[]>({
    queryKey: ["/api/phone-numbers/search", searchCountry, searchContains],
    queryFn: async () => {
      if (!canSearch()) return [];
      const headers: Record<string, string> = {};
      const authHeader = AuthStorage.getAuthHeader();
      if (authHeader) {
        headers["Authorization"] = authHeader;
      }
      const res = await fetch(`/api/phone-numbers/search?${buildSearchQuery()}`, {
        headers,
      });
      if (!res.ok) throw new Error(t('phoneNumbers.errors.searchFailed'));
      return res.json();
    },
    enabled: canSearch() && !countriesLoading,
  });

  const buyMutation = useMutation({
    mutationFn: async ({ phoneNumber, friendlyName, addressSid, country }: { phoneNumber: string; friendlyName?: string; addressSid?: string; country?: string }) => {
      const res = await apiRequest("POST", "/api/phone-numbers/buy", { phoneNumber, friendlyName, addressSid, country });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/incoming-connections"] });
      setBuyDialogOpen(false);
      setSelectedNumber(null);
      setFriendlyName("");
      setSearchContains("");
      setHasSearched(false);
      toast({ title: t('phoneNumbers.toast.purchaseSuccess'), description: t('phoneNumbers.toast.creditsDeducted', { credits: MONTHLY_CREDITS }) });
    },
    onError: (error: any) => {
      toast({
        title: t('phoneNumbers.toast.purchaseFailed'),
        description: error.message || t('common.tryAgain'),
        variant: "destructive",
      });
    },
  });

  const releaseMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/phone-numbers/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/incoming-connections"] });
      setReleaseDialogOpen(false);
      setNumberToRelease(null);
      toast({ title: t('phoneNumbers.toast.releaseSuccess') });
    },
    onError: (error: any) => {
      toast({
        title: t('phoneNumbers.toast.releaseFailed'),
        description: error.message || t('common.tryAgain'),
        variant: "destructive",
      });
    },
  });

  // Plivo purchase mutation
  const plivoBuyMutation = useMutation({
    mutationFn: async ({ phoneNumber, country }: { phoneNumber: string; country: string }) => {
      const res = await apiRequest("POST", "/api/plivo/phone-numbers/purchase", { phoneNumber, country });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plivo/phone-numbers"] });
      setPlivoBuyDialogOpen(false);
      setSelectedPlivoNumber(null);
      setPlivoSearchCountry("");
      setPlivoSearchRegion("");
      toast({ title: "Plivo Number Purchased", description: "Your new phone number has been added to your account." });
    },
    onError: (error: any) => {
      toast({
        title: "Purchase Failed",
        description: error.message || t('common.tryAgain'),
        variant: "destructive",
      });
    },
  });

  // Plivo release mutation
  const plivoReleaseMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/plivo/phone-numbers/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plivo/phone-numbers"] });
      setPlivoReleaseDialogOpen(false);
      setPlivoNumberToRelease(null);
      toast({ title: "Number Released", description: "The phone number has been released." });
    },
    onError: (error: any) => {
      toast({
        title: "Release Failed",
        description: error.message || t('common.tryAgain'),
        variant: "destructive",
      });
    },
  });

  // TCXC purchase mutation
  const tcxcPurchaseMutation = useMutation({
    mutationFn: async (didId: string) => {
      const res = await apiRequest("POST", "/api/tcxc/dids/purchase", { didId });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tcxc/dids/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sip/phone-numbers"] });
      setTcxcBuyDialogOpen(false);
      setSelectedTcxcDid(null);
      toast({ 
        title: "DID Purchased Successfully", 
        description: data.phoneNumber ? `${data.phoneNumber} has been added to your account.` : "Your new DID has been activated." 
      });
    },
    onError: (error: any) => {
      toast({
        title: "Purchase Failed",
        description: error.message || "Failed to purchase DID. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleTcxcPurchase = () => {
    if (!selectedTcxcDid) return;
    tcxcPurchaseMutation.mutate(selectedTcxcDid.id);
  };

  const handlePlivoBuy = () => {
    if (!selectedPlivoNumber) return;
    plivoBuyMutation.mutate({
      phoneNumber: selectedPlivoNumber.phoneNumber,
      country: plivoSearchCountry,
    });
  };

  const handlePlivoRelease = () => {
    if (!plivoNumberToRelease) return;
    plivoReleaseMutation.mutate(plivoNumberToRelease.id);
  };

  const handleBuyClick = (provider: 'twilio' | 'plivo' | 'select') => {
    if (provider === 'twilio') {
      if (!canPurchaseTwilio) {
        setKycRequiredDialogOpen(true);
        return;
      }
      setBuyDialogOpen(true);
    } else if (provider === 'plivo') {
      if (!canPurchasePlivo) {
        setKycRequiredDialogOpen(true);
        return;
      }
      setPlivoBuyDialogOpen(true);
    } else {
      setProviderSelectDialogOpen(true);
    }
  };

  const getKycStatusBadgeVariant = (status?: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'approved': return 'default';
      case 'submitted': return 'secondary';
      case 'rejected':
      case 'requires_resubmission': return 'destructive';
      default: return 'outline';
    }
  };

  const getKycStatusLabel = (status?: string) => {
    switch (status) {
      case 'approved': return 'KYC Approved';
      case 'submitted': return 'KYC Under Review';
      case 'rejected': return 'KYC Rejected';
      case 'requires_resubmission': return 'Resubmit Required';
      case 'pending': return 'KYC Pending';
      default: return 'KYC Required';
    }
  };

  // Plivo pagination
  const {
    currentPage: plivoCurrentPage,
    totalPages: plivoTotalPages,
    totalItems: plivoTotalItems,
    itemsPerPage: plivoItemsPerPage,
    paginatedItems: paginatedPlivoNumbers,
    handlePageChange: handlePlivoPageChange,
    handleItemsPerPageChange: handlePlivoItemsPerPageChange,
  } = usePagination(plivoNumbers, 9);

  const getPlivoPricing = (countryCode: string) => {
    return plivoCountries.find(c => c.countryCode === countryCode);
  };

  const handleBuyNumber = () => {
    if (!selectedNumber) return;
    
    // Check if country requires address verification
    const countryCode = searchCountry?.toUpperCase();
    if (countryCode && ADDRESS_REQUIRED_COUNTRIES.includes(countryCode)) {
      // Check if user has a verified address for this country
      const hasVerifiedAddress = userAddresses.some(
        addr => addr.isoCountry === countryCode && addr.status === 'verified'
      );
      
      if (!hasVerifiedAddress) {
        // Show address required dialog instead of proceeding
        const countryObj = countries.find(c => c.code === countryCode);
        setAddressRequiredCountry(countryObj?.name || countryCode);
        setAddressRequiredDialogOpen(true);
        return;
      }
    }
    
    // Server handles address auto-selection for regulatory compliance
    buyMutation.mutate({
      phoneNumber: selectedNumber.phoneNumber,
      friendlyName: friendlyName || undefined,
      country: searchCountry || undefined,
    });
  };

  const handleReleaseNumber = () => {
    if (!numberToRelease) return;
    releaseMutation.mutate(numberToRelease.id);
  };

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `+1 (${cleaned.substring(1, 4)}) ${cleaned.substring(4, 7)}-${cleaned.substring(7)}`;
    }
    return phone;
  };

  const totalNumbers = ownedNumbers.length + plivoNumbers.length;
  const activeNumbers = ownedNumbers.filter(n => n.status === 'active').length + plivoNumbers.filter(n => n.status === 'active').length;
  const connectedNumbers = allConnections.length + plivoConnections.length;
  const availableForConnection = totalNumbers - connectedNumbers;

  const {
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    paginatedItems: paginatedNumbers,
    handlePageChange,
    handleItemsPerPageChange,
  } = usePagination(ownedNumbers, 9);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 via-green-100/50 to-teal-50 dark:from-emerald-950/40 dark:via-green-900/30 dark:to-teal-950/40 border border-emerald-100 dark:border-emerald-900/50 p-6 md:p-8">
        <div className="absolute inset-0 bg-grid-slate-200/50 dark:bg-grid-slate-700/20 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.5))]" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <Smartphone className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">{t('phoneNumbers.title')}</h1>
              <p className="text-muted-foreground mt-0.5">{t('phoneNumbers.subtitle')}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setLocation("/app/incoming-connections")}
              className="bg-white/80 dark:bg-white/10 border-emerald-200 dark:border-emerald-800"
              data-testid="button-manage-connections"
            >
              <LinkIcon className="h-4 w-4 mr-2" />
              {t('phoneNumbers.manageConnections')}
            </Button>
            <Button 
              onClick={() => plivoEnabled ? handleBuyClick('select') : handleBuyClick('twilio')} 
              data-testid="button-buy-number"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('phoneNumbers.buyNumber')}
            </Button>
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white/80 dark:bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-emerald-100/50 dark:border-emerald-800/30">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300" data-testid="text-total-numbers">{totalNumbers}</div>
            </div>
            <div className="text-emerald-600/70 dark:text-emerald-400/70 text-sm">{t('phoneNumbers.stats.totalNumbers')}</div>
          </div>
          <div className="bg-white/80 dark:bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-green-100/50 dark:border-green-800/30">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">{activeNumbers}</div>
            </div>
            <div className="text-green-600/70 dark:text-green-400/70 text-sm">{t('common.active')}</div>
          </div>
          <div className="bg-white/80 dark:bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-teal-100/50 dark:border-teal-800/30">
            <div className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              <div className="text-2xl font-bold text-teal-700 dark:text-teal-300">{connectedNumbers}</div>
            </div>
            <div className="text-teal-600/70 dark:text-teal-400/70 text-sm">{t('phoneNumbers.stats.connected')}</div>
          </div>
          <div className="bg-white/80 dark:bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-cyan-100/50 dark:border-cyan-800/30">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <div className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">{MONTHLY_CREDITS}</div>
            </div>
            <div className="text-cyan-600/70 dark:text-cyan-400/70 text-sm">{t('phoneNumbers.stats.creditsPerMonth')}</div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="owned" className="space-y-6">
        <TabsList>
          <TabsTrigger value="owned" data-testid="tab-owned-numbers">
            Twilio Numbers ({ownedNumbers.length})
          </TabsTrigger>
          {plivoEnabled && (
            <TabsTrigger value="plivo" data-testid="tab-plivo-numbers">
              Plivo Numbers ({plivoNumbers.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="tcxc-dids" data-testid="tab-tcxc-dids">
            <PhoneIncoming className="h-4 w-4 mr-1" />
            TCXC DIDs ({tcxcMyDids.length})
          </TabsTrigger>
          <TabsTrigger value="outbound" data-testid="tab-outbound">
            <PhoneOutgoing className="h-4 w-4 mr-1" />
            Outbound
          </TabsTrigger>
          {phoneNumbersTabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} data-testid={`tab-${tab.id}`}>
              {tab.icon === 'Server' && <Server className="h-4 w-4 mr-1" />}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="owned" className="space-y-4">
          {ownedLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-6 animate-pulse">
                  <div className="h-6 bg-muted rounded w-3/4 mb-4" />
                  <div className="h-4 bg-muted rounded w-full mb-2" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                </Card>
              ))}
            </div>
          ) : ownedNumbers.length === 0 ? (
            <Card className="p-8 sm:p-16 text-center">
              <Phone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">{t('phoneNumbers.empty.title')}</h3>
              <p className="text-muted-foreground mb-4">
                {t('phoneNumbers.empty.description')}
              </p>
              <Button onClick={() => handleBuyClick('twilio')}>
                <Plus className="h-4 w-4 mr-2" />
                {t('phoneNumbers.empty.buyFirst')}
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {paginatedNumbers.map((number) => (
                  <Card
                    key={number.id}
                    className="p-4 sm:p-6"
                    data-testid={`card-phone-${number.id}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base sm:text-lg font-semibold font-mono mb-1 break-all" data-testid="text-phone-number">
                          {formatPhoneNumber(number.phoneNumber)}
                        </h3>
                        {number.friendlyName && (
                          <p className="text-sm text-muted-foreground truncate">{number.friendlyName}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        <Badge variant={number.status === "active" ? "default" : "secondary"}>
                          {number.status === "active" ? t('common.active') : number.status}
                        </Badge>
                        {twilioKycRequired && (
                          <Badge 
                            variant="outline"
                            className={`cursor-pointer transition-colors ${
                              currentUser?.kycStatus === 'approved'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/20'
                            }`}
                            onClick={() => setLocation('/app/settings')}
                            data-testid={`badge-kyc-status-twilio-${number.id}`}
                          >
                            <Shield className="h-3 w-3 mr-1" />
                            {getKycStatusLabel(currentUser?.kycStatus ?? undefined)}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>{t('phoneNumbers.labels.country')}:</span>
                        <span className="font-medium text-foreground">{number.country}</span>
                      </div>
                      {!number.isSystemPool && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>{t('phoneNumbers.labels.monthlyCost')}:</span>
                          <span className="font-medium text-foreground">{MONTHLY_CREDITS} {t('phoneNumbers.labels.credits')}</span>
                        </div>
                      )}
                      {(() => {
                        const connection = getConnection(number.id);
                        return connection ? (
                          <div 
                            className="flex flex-wrap items-center gap-1 sm:gap-2 pt-3 text-sm" 
                            data-testid={`connection-status-connected-${number.id}`}
                          >
                            <LinkIcon className="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                            <span className="text-muted-foreground">{t('phoneNumbers.status.connectedTo')}</span>
                            <span className="font-medium text-foreground truncate" data-testid={`connection-agent-name-${number.id}`}>
                              {connection.agent.name}
                            </span>
                          </div>
                        ) : (
                          <div 
                            className="flex items-center gap-2 pt-3 text-sm text-muted-foreground"
                            data-testid={`connection-status-not-connected-${number.id}`}
                          >
                            <span>{t('phoneNumbers.status.notConnected')}</span>
                          </div>
                        );
                      })()}
                    </div>

                    {!number.isSystemPool && (
                      <div className="pt-4 mt-4 border-t space-y-2">
                        {twilioKycRequired && !isKycApproved && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              setKycRequiredDialogOpen(true);
                            }}
                            data-testid={`button-kyc-twilio-${number.id}`}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Complete KYC Verification
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            setNumberToRelease(number);
                            setReleaseDialogOpen(true);
                          }}
                          data-testid={`button-release-${number.id}`}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t('phoneNumbers.actions.release')}
                        </Button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>

              {totalPages > 1 && (
                <DataPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  itemsPerPage={itemsPerPage}
                  onPageChange={handlePageChange}
                  onItemsPerPageChange={handleItemsPerPageChange}
                  itemsPerPageOptions={[9, 18, 27, 54]}
                  data-testid="pagination-phone-numbers"
                />
              )}
            </div>
          )}
        </TabsContent>

        {plivoEnabled && (
          <TabsContent value="plivo" className="space-y-4">
            {plivoNumbersLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="p-6 animate-pulse">
                    <div className="h-6 bg-muted rounded w-3/4 mb-4" />
                    <div className="h-4 bg-muted rounded w-full mb-2" />
                    <div className="h-4 bg-muted rounded w-2/3" />
                  </Card>
                ))}
              </div>
            ) : plivoNumbers.length === 0 ? (
              <Card className="p-8 sm:p-16 text-center">
                <Phone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Plivo Numbers</h3>
                <p className="text-muted-foreground mb-4">
                  You haven't purchased any Plivo phone numbers yet.
                </p>
                <Button onClick={() => handleBuyClick('plivo')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Buy Your First Phone Number
                </Button>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {paginatedPlivoNumbers.map((number) => {
                    const pricing = getPlivoPricing(number.country);
                    // Show KYC button if admin has enabled KYC for Plivo AND user's KYC is not approved
                    const needsKyc = plivoKycRequired && !isKycApproved;
                    
                    return (
                      <Card
                        key={number.id}
                        className="p-4 sm:p-6"
                        data-testid={`card-plivo-phone-${number.id}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base sm:text-lg font-semibold font-mono mb-1 break-all">
                              {formatPhoneNumber(number.phoneNumber)}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {number.country}{number.region ? ` - ${number.region}` : ''}
                            </p>
                          </div>
                          <div className="flex flex-col gap-1 items-end">
                            <Badge variant={number.status === "active" ? "default" : "secondary"}>
                              {number.status === "active" ? t('common.active') : number.status}
                            </Badge>
                            {plivoKycRequired && (
                              <Badge 
                                variant="outline"
                                className={`cursor-pointer transition-colors ${
                                  currentUser?.kycStatus === 'approved'
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                    : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/20'
                                }`}
                                onClick={() => setLocation('/app/settings')}
                                data-testid={`badge-kyc-status-plivo-${number.id}`}
                              >
                                <Shield className="h-3 w-3 mr-1" />
                                {getKycStatusLabel(currentUser?.kycStatus ?? undefined)}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between text-muted-foreground">
                            <span>Monthly Cost:</span>
                            <span className="font-medium text-foreground">{number.monthlyCredits} credits</span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>Purchase Cost:</span>
                            <span className="font-medium text-foreground">{number.purchaseCredits} credits</span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>Purchased:</span>
                            <span className="font-medium text-foreground">
                              {new Date(number.purchasedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {(() => {
                          const plivoConn = getPlivoConnection(number.id);
                          return plivoConn?.agent ? (
                            <div className="flex flex-wrap items-center gap-1 sm:gap-2 pt-3 text-sm" data-testid={`plivo-connection-status-connected-${number.id}`}>
                              <LinkIcon className="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                              <span className="text-muted-foreground">{t('phoneNumbers.status.connectedTo')}</span>
                              <span className="font-medium text-foreground truncate">{plivoConn.agent.name}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 pt-3 text-sm text-muted-foreground" data-testid={`plivo-connection-status-not-connected-${number.id}`}>
                              <span>{t('phoneNumbers.status.notConnected')}</span>
                            </div>
                          );
                        })()}

                        {number.kycRejectionReason && (
                          <div className="mt-3 p-3 bg-destructive/10 rounded-md border border-destructive/20">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm font-medium text-destructive">KYC Rejection Reason:</p>
                                <p className="text-sm text-muted-foreground">{number.kycRejectionReason}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="pt-4 mt-4 border-t space-y-2">
                          {needsKyc && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => {
                                setKycRequiredDialogOpen(true);
                              }}
                              data-testid={`button-upload-kyc-${number.id}`}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              Complete KYC Verification
                            </Button>
                          )}
                          <Button
                            variant="destructive"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              setPlivoNumberToRelease(number);
                              setPlivoReleaseDialogOpen(true);
                            }}
                            data-testid={`button-release-plivo-${number.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Release Number
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>

                {plivoTotalPages > 1 && (
                  <DataPagination
                    currentPage={plivoCurrentPage}
                    totalPages={plivoTotalPages}
                    totalItems={plivoTotalItems}
                    itemsPerPage={plivoItemsPerPage}
                    onPageChange={handlePlivoPageChange}
                    onItemsPerPageChange={handlePlivoItemsPerPageChange}
                    itemsPerPageOptions={[9, 18, 27, 54]}
                    data-testid="pagination-plivo-numbers"
                  />
                )}
              </div>
            )}
          </TabsContent>
        )}

        {/* TCXC DIDs Tab */}
        <TabsContent value="tcxc-dids" className="space-y-4">
          {!tcxcConfigured ? (
            <Card className="p-8 sm:p-16 text-center">
              <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">TCXC Not Configured</h3>
              <p className="text-muted-foreground mb-4">
                Configure your TelecomXchange API credentials to browse and purchase DIDs from the marketplace.
              </p>
              <Button onClick={() => setLocation("/admin/settings")} data-testid="button-configure-tcxc">
                Configure TCXC API
              </Button>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* My Interconnections Section */}
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Network className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">My Interconnections</h3>
                    <p className="text-sm text-muted-foreground">Network topology and tech prefix routing</p>
                  </div>
                </div>

                {tcxcInterconnections.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Network className="h-8 w-8 mx-auto mb-2" />
                    <p>No interconnections configured yet.</p>
                    <p className="text-sm">Add your tech prefixes in Admin Settings.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Network Topology Diagram */}
                    <div className="rounded-lg border p-4 bg-muted/30">
                      <h4 className="text-sm font-medium mb-3">Call Flow Topology</h4>
                      <div className="flex items-center justify-center gap-2 flex-wrap py-4">
                        <div className="flex flex-col items-center">
                          <div className="h-16 w-16 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                            <Phone className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                          </div>
                          <span className="text-xs text-muted-foreground mt-1">Inbound Call</span>
                        </div>
                        <div className="text-2xl text-muted-foreground">→</div>
                        <div className="flex flex-col items-center">
                          <div className="h-16 w-20 rounded-lg bg-amber-100 dark:bg-amber-900 flex flex-col items-center justify-center px-2">
                            <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-300">Tech Prefix</span>
                            <div className="flex gap-1 mt-1 flex-wrap justify-center">
                              {tcxcInterconnections.flatMap(i => i.techPrefixes).slice(0, 3).map((prefix, idx) => (
                                <Badge key={idx} variant="secondary" className="text-[10px] font-mono px-1">
                                  {prefix}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground mt-1">Routing</span>
                        </div>
                        <div className="text-2xl text-muted-foreground">→</div>
                        <div className="flex gap-2">
                          {tcxcInterconnections.map((interconnection) => (
                            <div key={interconnection.id} className="flex flex-col items-center">
                              <div className={`h-16 w-20 rounded-lg flex flex-col items-center justify-center px-2 ${
                                interconnection.healthStatus === 'healthy' 
                                  ? 'bg-green-100 dark:bg-green-900' 
                                  : 'bg-muted'
                              }`}>
                                {interconnection.connectionType === 'softswitch' ? (
                                  <Server className={`h-6 w-6 ${interconnection.healthStatus === 'healthy' ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} />
                                ) : (
                                  <Globe className={`h-6 w-6 ${interconnection.healthStatus === 'healthy' ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} />
                                )}
                                <span className="text-[10px] font-medium mt-1 text-center truncate max-w-full">
                                  {interconnection.name}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground mt-1">
                                {interconnection.connectionType === 'softswitch' ? 'Softswitch' : 'TCXC'}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="text-2xl text-muted-foreground">→</div>
                        <div className="flex flex-col items-center">
                          <div className="h-16 w-16 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                            <Bot className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                          </div>
                          <span className="text-xs text-muted-foreground mt-1">AI Agent</span>
                        </div>
                      </div>
                    </div>

                    {/* Interconnection Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {tcxcInterconnections.map((interconnection) => (
                        <div key={interconnection.id} className="p-4 rounded-lg border" data-testid={`card-interconnection-${interconnection.id}`}>
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2">
                              {interconnection.connectionType === 'softswitch' ? (
                                <Server className="h-5 w-5 text-muted-foreground" />
                              ) : (
                                <Globe className="h-5 w-5 text-muted-foreground" />
                              )}
                              <h4 className="font-semibold">{interconnection.name}</h4>
                            </div>
                            <Badge 
                              variant={interconnection.healthStatus === 'healthy' ? 'default' : 'secondary'}
                              className={interconnection.healthStatus === 'healthy' ? 'bg-green-600 dark:bg-green-700' : ''}
                            >
                              {interconnection.healthStatus === 'healthy' ? 'Connected' : 'Unknown'}
                            </Badge>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Type:</span>
                              <span>{interconnection.connectionType === 'softswitch' ? 'Softswitch' : 'TCXC API'}</span>
                            </div>
                            {interconnection.techPrefixes && interconnection.techPrefixes.length > 0 && (
                              <div>
                                <span className="text-muted-foreground">Tech Prefixes:</span>
                                <div className="flex gap-1 mt-1 flex-wrap">
                                  {interconnection.techPrefixes.map((prefix, idx) => (
                                    <Badge key={idx} variant="outline" className="font-mono text-xs">
                                      {prefix}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            {interconnection.connectionType === 'softswitch' && interconnection.sipServer && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">SIP Server:</span>
                                <span className="font-mono text-xs">{interconnection.sipServer}:{interconnection.sipPort || 5060}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>

              {/* DID Search Section */}
              <Card className="p-6">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold">Browse TCXC DID Marketplace</h3>
                  <p className="text-sm text-muted-foreground">Select a country and type to search available numbers</p>
                </div>

                {/* Search Form - Twilio Style */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Select value={tcxcSearchCountry} onValueChange={setTcxcSearchCountry}>
                      <SelectTrigger data-testid="select-tcxc-country">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {gccCountries.length > 0 && (
                          <>
                            {gccCountries.map((country) => (
                              <SelectItem key={country.code} value={country.code}>
                                {country.name}
                              </SelectItem>
                            ))}
                          </>
                        )}
                        <SelectItem value="US">United States</SelectItem>
                        <SelectItem value="GB">United Kingdom</SelectItem>
                        <SelectItem value="CA">Canada</SelectItem>
                        <SelectItem value="AU">Australia</SelectItem>
                        <SelectItem value="DE">Germany</SelectItem>
                        <SelectItem value="FR">France</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={tcxcSearchType} onValueChange={(v) => setTcxcSearchType(v as "local" | "tollfree" | "mobile")}>
                      <SelectTrigger data-testid="select-tcxc-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="local">Local</SelectItem>
                        <SelectItem value="tollfree">Toll-Free</SelectItem>
                        <SelectItem value="mobile">Mobile</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    onClick={() => searchTcxcDids()} 
                    disabled={!tcxcSearchCountry || tcxcSearchLoading}
                    data-testid="button-search-tcxc"
                  >
                    {tcxcSearchLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                    Search DIDs
                  </Button>
                  <Button variant="outline" onClick={() => refetchTcxcMyDids()} data-testid="button-refresh-my-tcxc">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh My DIDs
                  </Button>
                </div>
              </Card>

              {/* Search Results - Organized by Type */}
              {tcxcSearchCountry && (
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold">
                        Available DIDs in {
                          [
                            { code: 'SA', name: 'Saudi Arabia' },
                            { code: 'AE', name: 'UAE' },
                            { code: 'QA', name: 'Qatar' },
                            { code: 'KW', name: 'Kuwait' },
                            { code: 'BH', name: 'Bahrain' },
                            { code: 'OM', name: 'Oman' },
                            { code: 'US', name: 'USA' },
                            { code: 'GB', name: 'UK' },
                            { code: 'CA', name: 'Canada' },
                            { code: 'AU', name: 'Australia' },
                            { code: 'DE', name: 'Germany' },
                            { code: 'FR', name: 'France' },
                          ].find(c => c.code === tcxcSearchCountry)?.name || tcxcSearchCountry
                        }
                      </h3>
                      {tcxcSearchLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    </div>
                    <Badge variant="secondary">{tcxcAvailableDids.length} numbers found</Badge>
                  </div>

                  {tcxcSearchLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="p-4 rounded-md border animate-pulse">
                          <div className="h-6 bg-muted rounded w-3/4 mb-2" />
                          <div className="h-4 bg-muted rounded w-full mb-1" />
                          <div className="h-4 bg-muted rounded w-2/3" />
                        </div>
                      ))}
                    </div>
                  ) : tcxcAvailableDids.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Globe className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="font-medium">No DIDs available for {tcxcSearchCountry}</p>
                      <p className="text-sm mt-1">Try selecting a different country or type</p>
                    </div>
                  ) : (
                    <>
                      {/* Group by Type */}
                      {['local', 'tollfree', 'mobile'].map((type) => {
                        const didsOfType = tcxcAvailableDids.filter(d => d.type.toLowerCase() === type);
                        if (didsOfType.length === 0) return null;
                        
                        return (
                          <div key={type} className="mb-6 last:mb-0">
                            <div className="flex items-center gap-2 mb-3">
                              {type === 'local' && <MapPin className="h-4 w-4 text-blue-500" />}
                              {type === 'tollfree' && <Phone className="h-4 w-4 text-green-500" />}
                              {type === 'mobile' && <Smartphone className="h-4 w-4 text-purple-500" />}
                              <h4 className="font-medium capitalize">{type} Numbers</h4>
                              <Badge variant="outline" className="text-xs">{didsOfType.length}</Badge>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {didsOfType.map((did) => (
                                <div 
                                  key={did.id} 
                                  className={`p-4 rounded-lg border cursor-pointer hover-elevate transition-all ${
                                    selectedTcxcDid?.id === did.id 
                                      ? 'ring-2 ring-primary border-primary bg-primary/5' 
                                      : 'hover:border-primary/50'
                                  }`}
                                  onClick={() => setSelectedTcxcDid(did)}
                                  data-testid={`card-tcxc-did-${did.id}`}
                                >
                                  <div className="flex items-start justify-between gap-2 mb-2">
                                    <h5 className="font-mono font-semibold text-lg">{did.phoneNumber}</h5>
                                    {selectedTcxcDid?.id === did.id && (
                                      <Check className="h-5 w-5 text-primary" />
                                    )}
                                  </div>
                                  <div className="text-sm text-muted-foreground space-y-1">
                                    {did.city && (
                                      <div className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        <span>{did.city}, {did.region}</span>
                                      </div>
                                    )}
                                    <div className="flex items-center justify-between pt-2 border-t mt-2">
                                      <span className="text-xs">Monthly</span>
                                      <span className="font-semibold text-foreground">{did.currency} {did.monthlyPrice}</span>
                                    </div>
                                    {did.setupPrice > 0 && (
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs">Setup</span>
                                        <span>{did.currency} {did.setupPrice}</span>
                                      </div>
                                    )}
                                  </div>
                                  {selectedTcxcDid?.id === did.id && (
                                    <Button 
                                      className="w-full mt-3" 
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setTcxcBuyDialogOpen(true);
                                      }}
                                      data-testid={`button-buy-tcxc-${did.id}`}
                                    >
                                      <ShoppingCart className="h-4 w-4 mr-2" />
                                      Purchase This DID
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </Card>
              )}

              {/* My DIDs */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">My TCXC DIDs ({tcxcMyDids.length})</h3>
                {tcxcMyDidsLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="p-4 rounded-md border animate-pulse">
                        <div className="h-6 bg-muted rounded w-3/4 mb-2" />
                        <div className="h-4 bg-muted rounded w-full" />
                      </div>
                    ))}
                  </div>
                ) : tcxcMyDids.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Phone className="h-8 w-8 mx-auto mb-2" />
                    <p>No DIDs purchased yet. Search above to find and purchase DIDs.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tcxcMyDids.map((did) => (
                      <div key={did.id} className="p-4 rounded-md border" data-testid={`card-my-tcxc-${did.id}`}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-mono font-semibold">{did.phoneNumber}</h4>
                          <Badge>{did.available ? 'Active' : 'Inactive'}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <div className="flex justify-between">
                            <span>Country:</span>
                            <span>{did.countryName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Type:</span>
                            <span>{did.type}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Outbound Tab */}
        <TabsContent value="outbound" className="space-y-4">
          {/* Browse Provider Numbers - Same UI as TCXC DID Marketplace */}
          <Card className="p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold">Browse Provider Numbers</h3>
              <p className="text-sm text-muted-foreground">Select a provider and country to search available caller IDs</p>
            </div>

            {/* Search Form - Same style as TCXC DIDs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select 
                  value={selectedCarrier?.id || ""} 
                  onValueChange={(value) => {
                    const carrier = carrierProviders.find(p => p.id === value);
                    setSelectedCarrier(carrier || null);
                  }}
                >
                  <SelectTrigger data-testid="select-outbound-provider">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {carrierProviders.map((carrier) => (
                      <SelectItem key={carrier.id} value={carrier.id}>
                        <div className="flex items-center gap-2">
                          <span>{carrier.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">({carrier.techPrefix})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Country (optional)</Label>
                <Select 
                  value={marketplaceSearchPrefix} 
                  onValueChange={setMarketplaceSearchPrefix}
                >
                  <SelectTrigger data-testid="select-outbound-country">
                    <SelectValue placeholder="All countries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Countries</SelectItem>
                    {gccCountries.length > 0 && (
                      <>
                        {gccCountries.map((country) => (
                          <SelectItem key={country.code} value={country.prefix}>
                            {country.name} (+{country.prefix})
                          </SelectItem>
                        ))}
                      </>
                    )}
                    <SelectItem value="1">United States (+1)</SelectItem>
                    <SelectItem value="44">United Kingdom (+44)</SelectItem>
                    <SelectItem value="49">Germany (+49)</SelectItem>
                    <SelectItem value="33">France (+33)</SelectItem>
                    <SelectItem value="61">Australia (+61)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => {
                    // Search TCXC marketplace - "all" or empty means no country filter
                    const prefix = marketplaceSearchPrefix === 'all' || !marketplaceSearchPrefix 
                      ? undefined 
                      : marketplaceSearchPrefix;
                    searchMarketplaceDids(undefined, prefix);
                  }}
                  disabled={isSearchingMarketplace}
                  data-testid="button-search-outbound"
                >
                  {isSearchingMarketplace ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Search className="h-4 w-4 mr-1" />
                  )}
                  Search Marketplace
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => {
                    setSelectedCarrier(null);
                    setMarketplaceSearchPrefix('');
                    setMarketplaceSearchResults([]);
                  }}
                  data-testid="button-reset-outbound-search"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Search Results */}
            {marketplaceSearchResults.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium">Available Numbers ({marketplaceSearchResults.length})</h4>
                </div>
                <div className="grid gap-4">
                  {marketplaceSearchResults.map((did, index) => (
                    <div 
                      key={`${did.did}-${index}`}
                      className="p-4 rounded-lg border hover-elevate"
                      data-testid={`outbound-result-${index}`}
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold font-mono">{did.did}</h3>
                          <p className="text-muted-foreground mt-1">
                            {did.country}{did.description ? ` - ${did.description}` : ''}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Seller: {did.seller || 'Unknown'}
                          </p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {did.voice && <Badge variant="secondary">Voice</Badge>}
                            {did.sms && <Badge variant="secondary">SMS</Badge>}
                            {did.fax && <Badge variant="secondary">Fax</Badge>}
                            {did.video && <Badge variant="secondary">Video</Badge>}
                            {did.did_type && did.did_type !== 'any' && (
                              <Badge variant="outline">{did.did_type}</Badge>
                            )}
                            {did.capacity && (
                              <Badge variant="outline">Capacity: {did.capacity}</Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <p className="text-lg font-bold">
                            ${(did.monthly_fee || 0).toFixed(2)}/month
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Setup: ${(did.setup_fee || 0).toFixed(2)}
                          </p>
                          {did.price_per_minute > 0 && (
                            <p className="text-xs text-muted-foreground">
                              ${did.price_per_minute.toFixed(4)}/min
                            </p>
                          )}
                          <Button 
                            className="mt-2"
                            onClick={() => {
                              setSelectedMarketplaceDid(did);
                              setRentDialogOpen(true);
                            }}
                            data-testid={`button-rent-outbound-${index}`}
                          >
                            Purchase & Use
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State for Search */}
            {marketplaceSearchResults.length === 0 && !isSearchingMarketplace && (
              <div className="text-center py-8 text-muted-foreground mt-6">
                <Phone className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No Numbers Found</p>
                <p className="text-sm">
                  Select a country and click "Search Marketplace" to find available phone numbers.
                  <br />
                  The TCXC marketplace availability varies by region - try different countries.
                </p>
              </div>
            )}

            {/* Loading State */}
            {isSearchingMarketplace && (
              <div className="text-center py-8 text-muted-foreground mt-6">
                <Loader2 className="h-10 w-10 mx-auto mb-3 animate-spin" />
                <p className="font-medium">Searching Marketplace...</p>
                <p className="text-sm">Finding available phone numbers from TCXC providers</p>
              </div>
            )}

            {/* Empty State */}
            {carrierProviders.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Network className="h-10 w-10 mx-auto mb-3" />
                <p className="font-medium">No carrier providers configured</p>
                <p className="text-sm">Configure your provider interconnections with tech prefixes in the TCXC tab first.</p>
              </div>
            )}
          </Card>

          {/* My Outbound Caller IDs */}
          <Card className="p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">My Outbound Caller IDs</h3>
              <p className="text-sm text-muted-foreground">Phone numbers available for outbound calling</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {ownedNumbers.filter(n => n.status === 'active').map((number) => (
                <div 
                  key={number.id} 
                  className="flex items-center justify-between p-3 rounded-lg border"
                  data-testid={`outbound-number-${number.id}`}
                >
                  <div>
                    <p className="font-mono text-sm">{formatPhoneNumber(number.phoneNumber)}</p>
                    <p className="text-xs text-muted-foreground">{number.country} - Twilio</p>
                  </div>
                  <Badge variant="outline">Available</Badge>
                </div>
              ))}
              {plivoNumbers.filter(n => n.status === 'active').map((number) => (
                <div 
                  key={number.id} 
                  className="flex items-center justify-between p-3 rounded-lg border"
                  data-testid={`outbound-plivo-${number.id}`}
                >
                  <div>
                    <p className="font-mono text-sm">{formatPhoneNumber(number.phoneNumber)}</p>
                    <p className="text-xs text-muted-foreground">{number.country} - Plivo</p>
                  </div>
                  <Badge variant="outline">Available</Badge>
                </div>
              ))}
              {tcxcMyDids.map((did) => (
                <div 
                  key={did.id} 
                  className="flex items-center justify-between gap-2 p-3 rounded-lg border"
                  data-testid={`outbound-tcxc-${did.id}`}
                >
                  <div>
                    <p className="font-mono text-sm">{did.phoneNumber}</p>
                    <p className="text-xs text-muted-foreground">{did.countryName} - TCXC</p>
                  </div>
                  <Badge variant="outline">Available</Badge>
                </div>
              ))}
              {providerCallerIds.map((callerId) => (
                <div 
                  key={callerId.id} 
                  className="flex items-center justify-between gap-2 p-3 rounded-lg border"
                  data-testid={`outbound-provider-${callerId.id}`}
                >
                  <div>
                    <p className="font-mono text-sm">{callerId.phoneNumber}</p>
                    <div className="flex items-center gap-1 flex-wrap">
                      <p className="text-xs text-muted-foreground">{callerId.country} - {callerId.providerName}</p>
                      <Badge variant="outline" className="font-mono text-xs">
                        {callerId.techPrefix}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="bg-green-600 dark:bg-green-700">Active</Badge>
                    <Button 
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteProviderCallerIdMutation.mutate(callerId.id)}
                      disabled={deleteProviderCallerIdMutation.isPending}
                      data-testid={`button-remove-outbound-${callerId.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {(ownedNumbers.length === 0 && plivoNumbers.length === 0 && tcxcMyDids.length === 0 && providerCallerIds.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                <Phone className="h-10 w-10 mx-auto mb-3" />
                <p className="font-medium">No phone numbers available</p>
                <p className="text-sm">Purchase phone numbers or search provider DIDs above to add caller IDs.</p>
              </div>
            )}
          </Card>

          {/* Campaign Settings */}
          <Card className="p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Outbound Campaign Settings</h3>
              <p className="text-sm text-muted-foreground">Configure default settings for outbound calling campaigns</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Default Caller ID</Label>
                <Select>
                  <SelectTrigger data-testid="select-default-caller-id">
                    <SelectValue placeholder="Select default caller ID" />
                  </SelectTrigger>
                  <SelectContent>
                    {ownedNumbers.filter(n => n.status === 'active').map((number) => (
                      <SelectItem key={number.id} value={number.id}>
                        {formatPhoneNumber(number.phoneNumber)} (Twilio)
                      </SelectItem>
                    ))}
                    {plivoNumbers.filter(n => n.status === 'active').map((number) => (
                      <SelectItem key={number.id} value={number.id}>
                        {formatPhoneNumber(number.phoneNumber)} (Plivo)
                      </SelectItem>
                    ))}
                    {tcxcMyDids.map((did) => (
                      <SelectItem key={did.id} value={did.id}>
                        {did.phoneNumber} (TCXC)
                      </SelectItem>
                    ))}
                    {providerCallerIds.map((callerId) => (
                      <SelectItem key={callerId.id} value={callerId.id}>
                        {callerId.phoneNumber} ({callerId.providerName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Max Concurrent Calls</Label>
                <Select defaultValue="5">
                  <SelectTrigger data-testid="select-max-concurrent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 call</SelectItem>
                    <SelectItem value="3">3 calls</SelectItem>
                    <SelectItem value="5">5 calls</SelectItem>
                    <SelectItem value="10">10 calls</SelectItem>
                    <SelectItem value="20">20 calls</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        </TabsContent>

        {phoneNumbersTabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="space-y-4">
            <Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
              <tab.component />
            </Suspense>
          </TabsContent>
        ))}
      </Tabs>

      {/* Provider Numbers Lookup Dialog */}
      <Dialog open={providerLookupDialogOpen} onOpenChange={setProviderLookupDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Provider Numbers Lookup
            </DialogTitle>
            <DialogDescription>
              {selectedProvider 
                ? `Browse available numbers from ${selectedProvider.name}`
                : 'Select a provider to browse available caller ID numbers'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Provider</Label>
              <Select 
                value={selectedProvider?.id || ""} 
                onValueChange={(value) => {
                  const provider = tcxcInterconnections.find(p => p.id === value);
                  setSelectedProvider(provider || null);
                }}
              >
                <SelectTrigger data-testid="select-provider-lookup">
                  <SelectValue placeholder="Choose a provider" />
                </SelectTrigger>
                <SelectContent>
                  {tcxcInterconnections.map((interconnection) => (
                    <SelectItem key={interconnection.id} value={interconnection.id}>
                      <div className="flex items-center gap-2">
                        <span>{interconnection.name}</span>
                        {interconnection.techPrefixes[0] && (
                          <span className="font-mono text-xs text-muted-foreground">
                            ({interconnection.techPrefixes[0]})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProvider && (
              <>
                <div className="rounded-lg border p-3 bg-muted/30">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{selectedProvider.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedProvider.connectionType === 'softswitch' ? 'Softswitch Connection' : 'TCXC Marketplace'}
                      </p>
                    </div>
                    <Badge 
                      variant={selectedProvider.healthStatus === 'healthy' ? 'default' : 'secondary'}
                      className={selectedProvider.healthStatus === 'healthy' ? 'bg-green-600 dark:bg-green-700' : ''}
                    >
                      {selectedProvider.healthStatus === 'healthy' ? 'Active' : 'Unknown'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedProvider.techPrefixes.map((prefix, idx) => (
                      <Badge key={idx} variant="outline" className="font-mono text-xs">
                        {prefix}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Search Available Numbers</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Country code prefix (e.g., 971, 966)"
                      value={marketplaceSearchPrefix}
                      onChange={(e) => setMarketplaceSearchPrefix(e.target.value)}
                      data-testid="input-marketplace-search-prefix"
                    />
                    <Button 
                      onClick={() => searchMarketplaceDids(selectedProvider.name, marketplaceSearchPrefix)}
                      disabled={isSearchingMarketplace}
                      data-testid="button-search-marketplace"
                    >
                      {isSearchingMarketplace ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  
                  {marketplaceSearchResults.length > 0 && (
                    <div className="rounded-lg border max-h-64 overflow-y-auto">
                      {marketplaceSearchResults.map((did) => (
                        <div 
                          key={did.i_did}
                          className="p-3 border-b last:border-b-0 flex items-center justify-between gap-2 hover-elevate"
                          data-testid={`marketplace-did-${did.i_did}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-sm truncate">{did.did}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-muted-foreground">{did.country}</span>
                              <Badge variant="outline" className="text-xs">{did.did_type}</Badge>
                              {did.voice && <Badge variant="secondary" className="text-xs">Voice</Badge>}
                              {did.sms && <Badge variant="secondary" className="text-xs">SMS</Badge>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="text-right">
                              <p className="text-sm font-medium">${did.monthly_fee}/mo</p>
                              <p className="text-xs text-muted-foreground">${did.price_per_minute}/min</p>
                            </div>
                            <Button 
                              size="sm"
                              onClick={() => {
                                setSelectedMarketplaceDid(did);
                                setRentDialogOpen(true);
                              }}
                              data-testid={`button-rent-did-${did.i_did}`}
                            >
                              Rent
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {marketplaceSearchResults.length === 0 && !isSearchingMarketplace && (
                    <div className="text-center py-6 text-muted-foreground border rounded-lg">
                      <Search className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">Search for available numbers from {selectedProvider.name}</p>
                      <p className="text-xs">Enter a country code prefix and click search</p>
                    </div>
                  )}
                </div>

                <div className="rounded-lg border p-4">
                  <h4 className="text-sm font-medium mb-3">Your Rented Numbers from {selectedProvider.name}</h4>
                  <div className="space-y-2">
                    {providerCallerIds
                      .filter(c => c.credentialId === selectedProvider.id)
                      .map((callerId) => (
                        <div 
                          key={callerId.id} 
                          className="p-3 rounded-lg border flex items-center justify-between gap-2"
                          data-testid={`caller-id-${callerId.id}`}
                        >
                          <div>
                            <p className="font-mono text-sm">{callerId.phoneNumber}</p>
                            <p className="text-xs text-muted-foreground">{callerId.country} via {callerId.providerName}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-xs">
                              {callerId.techPrefix}
                            </Badge>
                            <Button 
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteProviderCallerIdMutation.mutate(callerId.id)}
                              disabled={deleteProviderCallerIdMutation.isPending}
                              data-testid={`button-delete-caller-id-${callerId.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    {providerCallerIds.filter(c => c.credentialId === selectedProvider.id).length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No numbers rented yet from this provider.
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Marketplace DID Rent Confirmation Dialog */}
      <AlertDialog open={rentDialogOpen} onOpenChange={setRentDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rent Phone Number</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedMarketplaceDid && (
                <div className="space-y-2 mt-2">
                  <p>You are about to rent:</p>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="font-mono font-semibold text-lg">{selectedMarketplaceDid.did}</p>
                    <p className="text-sm text-muted-foreground">{selectedMarketplaceDid.country}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <Badge variant="outline">{selectedMarketplaceDid.did_type}</Badge>
                      {selectedMarketplaceDid.voice && <Badge variant="secondary">Voice</Badge>}
                      {selectedMarketplaceDid.sms && <Badge variant="secondary">SMS</Badge>}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Monthly Fee:</span>
                      <span className="font-medium">${selectedMarketplaceDid.monthly_fee}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Setup Fee:</span>
                      <span className="font-medium">${selectedMarketplaceDid.setup_fee}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Rate:</span>
                      <span className="font-medium">${selectedMarketplaceDid.price_per_minute}/min</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Seller:</span>
                      <span className="font-medium">{selectedMarketplaceDid.seller}</span>
                    </div>
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-rent">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (selectedMarketplaceDid && (selectedCarrier || selectedProvider)) {
                  const carrier = selectedCarrier;
                  const provider = selectedProvider;
                  rentMarketplaceDidMutation.mutate({
                    iDid: selectedMarketplaceDid.i_did,
                    did: selectedMarketplaceDid.did,
                    seller: selectedMarketplaceDid.seller || carrier?.name || provider?.name || '',
                    country: selectedMarketplaceDid.country,
                    monthlyFee: selectedMarketplaceDid.monthly_fee,
                    credentialId: carrier?.interconnectionId || provider?.id || '',
                    techPrefix: carrier?.techPrefix || provider?.techPrefixes[0] || '',
                  });
                }
              }}
              disabled={rentMarketplaceDidMutation.isPending || (!selectedCarrier && !selectedProvider)}
              data-testid="button-confirm-rent"
            >
              {rentMarketplaceDidMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Renting...
                </>
              ) : (
                'Rent Number'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* TCXC Purchase Confirmation Dialog */}
      <AlertDialog open={tcxcBuyDialogOpen} onOpenChange={setTcxcBuyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm DID Purchase</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedTcxcDid && (
                <div className="space-y-2 mt-2">
                  <p>You are about to purchase:</p>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="font-mono font-semibold text-lg">{selectedTcxcDid.phoneNumber}</p>
                    <p className="text-sm">{selectedTcxcDid.countryName} - {selectedTcxcDid.type}</p>
                    <p className="text-sm mt-2">
                      Monthly: <span className="font-semibold">{selectedTcxcDid.currency} {selectedTcxcDid.monthlyPrice}</span>
                      {selectedTcxcDid.setupPrice > 0 && (
                        <span> | Setup: {selectedTcxcDid.currency} {selectedTcxcDid.setupPrice}</span>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-tcxc-purchase">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleTcxcPurchase}
              disabled={tcxcPurchaseMutation.isPending}
              data-testid="button-confirm-tcxc-purchase"
            >
              {tcxcPurchaseMutation.isPending ? "Purchasing..." : "Confirm Purchase"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={buyDialogOpen} onOpenChange={setBuyDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('phoneNumbers.dialog.buyTitle')}</DialogTitle>
            <DialogDescription>
              {t('phoneNumbers.dialog.buyDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="bg-accent/50 border border-accent rounded-lg p-4 flex items-start gap-3">
            <CreditCard className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm mb-1">{t('phoneNumbers.dialog.monthlyBilling')}</h4>
              <p className="text-sm text-muted-foreground">
                {t('phoneNumbers.dialog.monthlyBillingDesc', { credits: MONTHLY_CREDITS })}
              </p>
            </div>
          </div>

          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Label>{t('phoneNumbers.labels.country')}</Label>
              <Select value={searchCountry} onValueChange={setSearchCountry} disabled={countriesLoading}>
                <SelectTrigger data-testid="select-country">
                  <Globe className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder={countriesLoading ? t('phoneNumbers.placeholders.loadingCountries') : t('phoneNumbers.placeholders.selectCountry')} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {countries.map((country) => (
                    <SelectItem key={country.code} value={country.code}>
                      {country.name} ({country.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Optional search filter */}
            <div className="space-y-2">
              <Label htmlFor="search-contains">Search by digits (optional)</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search-contains"
                  placeholder="e.g. 2200, 555"
                  value={searchContains}
                  onChange={(e) => setSearchContains(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className="pl-10"
                  data-testid="input-search-contains"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Filter numbers containing specific digits (leave empty to see all available)
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setHasSearched(true);
                  searchNumbers();
                }}
                disabled={!canSearch() || searchLoading}
                className="flex-1"
                data-testid="button-search-numbers"
              >
                {searchLoading ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                    {t('phoneNumbers.actions.searching')}
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    {t('phoneNumbers.actions.searchNumbers')}
                  </>
                )}
              </Button>
              {hasSearched && (
                <Button
                  variant="outline"
                  onClick={() => searchNumbers()}
                  disabled={!canSearch() || searchLoading}
                  data-testid="button-refresh-numbers"
                  title="Load different numbers"
                >
                  <RefreshCw className={`h-4 w-4 ${searchLoading ? 'animate-spin' : ''}`} />
                </Button>
              )}
            </div>

            {!searchLoading && hasSearched && availableNumbers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {t('phoneNumbers.search.noResults')}
              </div>
            )}

            {availableNumbers.length > 0 && (
              <div className="space-y-2">
                <Label>{t('phoneNumbers.labels.availableNumbers')}</Label>
                <div className="border rounded-md divide-y max-h-96 overflow-y-auto">
                  {availableNumbers.map((number) => (
                    <div
                      key={number.phoneNumber}
                      className={`p-4 hover-elevate cursor-pointer ${
                        selectedNumber?.phoneNumber === number.phoneNumber ? "bg-accent" : ""
                      }`}
                      onClick={() => setSelectedNumber(number)}
                      data-testid={`available-number-${number.phoneNumber}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-mono font-semibold">
                            {formatPhoneNumber(number.phoneNumber)}
                          </div>
                          {number.locality && number.region && (
                            <div className="text-sm text-muted-foreground">
                              {number.locality}, {number.region}
                            </div>
                          )}
                        </div>
                        {selectedNumber?.phoneNumber === number.phoneNumber && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedNumber && (
              <div className="space-y-2">
                <Label htmlFor="friendly-name">{t('phoneNumbers.labels.friendlyName')}</Label>
                <Input
                  id="friendly-name"
                  placeholder={t('phoneNumbers.placeholders.friendlyName')}
                  value={friendlyName}
                  onChange={(e) => setFriendlyName(e.target.value)}
                  data-testid="input-friendly-name"
                />
              </div>
            )}

          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setBuyDialogOpen(false);
              setSelectedNumber(null);
              setFriendlyName("");
              setSearchContains("");
              setHasSearched(false);
            }}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleBuyNumber}
              disabled={!selectedNumber || buyMutation.isPending}
              data-testid="button-confirm-purchase"
            >
              {buyMutation.isPending ? (
                t('phoneNumbers.actions.purchasing')
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  {t('phoneNumbers.actions.purchaseFor', { credits: MONTHLY_CREDITS })}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={releaseDialogOpen} onOpenChange={setReleaseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('phoneNumbers.dialog.releaseTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('phoneNumbers.dialog.releaseDescription', { number: numberToRelease ? formatPhoneNumber(numberToRelease.phoneNumber) : '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={releaseMutation.isPending}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReleaseNumber}
              disabled={releaseMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-release"
            >
              {releaseMutation.isPending ? t('phoneNumbers.actions.releasing') : t('phoneNumbers.actions.releaseNumber')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Plivo Buy Dialog - Redesigned with pagination-first approach */}
      <Dialog open={plivoBuyDialogOpen} onOpenChange={(open) => {
        setPlivoBuyDialogOpen(open);
        if (!open) {
          setSelectedPlivoNumber(null);
          setPlivoSearchRegion("");
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rent Phone Number</DialogTitle>
            <DialogDescription>
              Select a country to see available phone numbers. Numbers are billed monthly.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Pricing Info Banner */}
            {plivoSearchCountry && (() => {
              const pricing = getPlivoPricing(plivoSearchCountry);
              return pricing ? (
                <div className="bg-accent/50 border border-accent rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    <span className="font-semibold">Pricing</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">One-time Purchase:</span>
                      <span className="font-semibold ml-2">{pricing.purchaseCredits} credits</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Monthly Rental:</span>
                      <span className="font-semibold ml-2">{pricing.monthlyCredits} credits/mo</span>
                    </div>
                  </div>
                  {pricing.kycRequired && (
                    <div className="mt-3 flex items-center gap-2 text-amber-600 dark:text-amber-400">
                      <Shield className="h-4 w-4" />
                      <span className="text-sm">KYC verification is required for numbers in this country</span>
                    </div>
                  )}
                </div>
              ) : null;
            })()}

            {/* Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Country</Label>
                <Select 
                  value={plivoSearchCountry} 
                  onValueChange={(value) => {
                    setPlivoSearchCountry(value);
                    setSelectedPlivoNumber(null);
                  }} 
                  disabled={plivoCountriesLoading}
                >
                  <SelectTrigger data-testid="select-plivo-country">
                    <Globe className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder={plivoCountriesLoading ? "Loading..." : "Select country"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {activePlivoCountries.map((country) => (
                      <SelectItem 
                        key={country.countryCode} 
                        value={country.countryCode}
                        data-testid={`option-country-${country.countryCode}`}
                      >
                        {country.countryName} ({country.countryCode})
                        {country.kycRequired && " 🔒"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Number Type</Label>
                <Select value={plivoSearchType} onValueChange={(value: "local" | "tollfree") => {
                  setPlivoSearchType(value);
                  setSelectedPlivoNumber(null);
                }}>
                  <SelectTrigger data-testid="select-plivo-type">
                    <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Local Numbers</SelectItem>
                    <SelectItem value="tollfree">Toll-Free Numbers</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Region (Optional)</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="e.g., CA, NY, TX"
                    value={plivoSearchRegion}
                    onChange={(e) => {
                      setPlivoSearchRegion(e.target.value.toUpperCase());
                      setSelectedPlivoNumber(null);
                    }}
                    className="pl-9"
                    maxLength={10}
                    data-testid="input-plivo-region"
                  />
                </div>
              </div>
            </div>

            {/* Numbers Display Area */}
            {!plivoSearchCountry ? (
              <div className="text-center py-12 border rounded-lg bg-muted/20">
                <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Select a country to view available numbers</p>
              </div>
            ) : plivoSearchLoading ? (
              <div className="text-center py-12 border rounded-lg">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-muted-foreground">Loading available numbers...</p>
              </div>
            ) : plivoAvailableNumbers.length === 0 ? (
              <div className="text-center py-12 border rounded-lg bg-muted/20">
                <Phone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-2">No numbers available</p>
                <p className="text-sm text-muted-foreground">Try a different region or number type</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Available Numbers ({plivoAvailableNumbers.length})</Label>
                  {selectedPlivoNumber && (
                    <Badge variant="secondary" className="gap-1">
                      <Check className="h-3 w-3" />
                      Selected: {formatPhoneNumber(selectedPlivoNumber.phoneNumber)}
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto p-1">
                  {plivoAvailableNumbers.map((number) => (
                    <div
                      key={number.phoneNumber}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedPlivoNumber?.phoneNumber === number.phoneNumber 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedPlivoNumber(number)}
                      data-testid={`plivo-number-${number.phoneNumber.replace(/\+/g, '')}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-mono font-semibold text-sm truncate">
                            {formatPhoneNumber(number.phoneNumber)}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {number.region || number.country} · {number.type}
                          </div>
                        </div>
                        {selectedPlivoNumber?.phoneNumber === number.phoneNumber && (
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => {
              setPlivoBuyDialogOpen(false);
              setSelectedPlivoNumber(null);
              setPlivoSearchRegion("");
            }}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handlePlivoBuy}
              disabled={!selectedPlivoNumber || plivoBuyMutation.isPending}
              data-testid="button-purchase-plivo"
            >
              {plivoBuyMutation.isPending ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                  Purchasing...
                </>
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  {selectedPlivoNumber ? `Purchase for ${getPlivoPricing(plivoSearchCountry)?.purchaseCredits || 0} Credits` : 'Select a Number'}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Plivo Release Dialog */}
      <AlertDialog open={plivoReleaseDialogOpen} onOpenChange={setPlivoReleaseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Release Plivo Number</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to release {plivoNumberToRelease ? formatPhoneNumber(plivoNumberToRelease.phoneNumber) : ''}? 
              This action cannot be undone and the number will be returned to Plivo's pool.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={plivoReleaseMutation.isPending}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePlivoRelease}
              disabled={plivoReleaseMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {plivoReleaseMutation.isPending ? "Releasing..." : "Release Number"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* KYC Required Dialog */}
      <Dialog open={kycRequiredDialogOpen} onOpenChange={setKycRequiredDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-500" />
              KYC Verification Required
            </DialogTitle>
            <DialogDescription>
              To purchase phone numbers, you need to complete KYC verification first.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="space-y-3">
                <p className="text-sm">
                  KYC verification is a one-time process. Once approved, you can purchase phone numbers from any provider.
                </p>
                <div className="text-sm">
                  <p className="font-medium mb-2">Required documents:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Photo ID</li>
                    <li>Company Registration Certificate</li>
                    <li>GST Certificate</li>
                    <li>Authorization Letter</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setKycRequiredDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => {
              setKycRequiredDialogOpen(false);
              setLocation('/app/settings?tab=kyc');
            }}>
              <Shield className="h-4 w-4 mr-2" />
              Complete KYC Verification
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Address Required Dialog */}
      <Dialog open={addressRequiredDialogOpen} onOpenChange={setAddressRequiredDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-amber-500" />
              Address Verification Required
            </DialogTitle>
            <DialogDescription>
              To purchase phone numbers in {addressRequiredCountry}, you need to add and verify an address first.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="space-y-3">
                <p className="text-sm">
                  {addressRequiredCountry} requires address verification for phone number purchases. This is a regulatory requirement.
                </p>
                <div className="text-sm">
                  <p className="font-medium mb-2">What you need to do:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Go to Settings → Addresses</li>
                    <li>Add your address for {addressRequiredCountry}</li>
                    <li>Wait for Twilio to verify your address</li>
                    <li>Return here to purchase your phone number</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddressRequiredDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => {
              setAddressRequiredDialogOpen(false);
              setBuyDialogOpen(false);
              setLocation('/app/settings?tab=addresses');
            }} data-testid="button-go-to-addresses">
              <MapPin className="h-4 w-4 mr-2" />
              Add Address
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Provider Selection Dialog */}
      <Dialog open={providerSelectDialogOpen} onOpenChange={setProviderSelectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Choose Telephony Provider</DialogTitle>
            <DialogDescription>
              Select which provider you'd like to purchase a phone number from.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-4">
            <div 
              className="border rounded-lg p-4 cursor-pointer hover-elevate transition-all"
              onClick={() => {
                setProviderSelectDialogOpen(false);
                handleBuyClick('twilio');
              }}
              data-testid="provider-option-twilio"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Phone className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Twilio + ElevenLabs</h3>
                  <p className="text-sm text-muted-foreground">Premium voice quality with ElevenLabs AI</p>
                  {twilioKycRequired && !isKycApproved && (
                    <p className="text-xs text-amber-600 mt-1">KYC verification required</p>
                  )}
                </div>
              </div>
            </div>
            {plivoEnabled ? (
              <div 
                className="border rounded-lg p-4 cursor-pointer hover-elevate transition-all"
                onClick={() => {
                  setProviderSelectDialogOpen(false);
                  handleBuyClick('plivo');
                }}
                data-testid="provider-option-plivo"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Phone className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">Plivo + OpenAI</h3>
                    <p className="text-sm text-muted-foreground">OpenAI Realtime voices with Plivo telephony</p>
                    {plivoKycRequired && !isKycApproved && (
                      <p className="text-xs text-amber-600 mt-1">KYC verification required</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div 
                className="border rounded-lg p-4 opacity-50 cursor-not-allowed"
                data-testid="provider-option-plivo-disabled"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <Phone className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-muted-foreground">Plivo + OpenAI</h3>
                    <p className="text-sm text-muted-foreground">Not available - Plivo integration is not enabled</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setProviderSelectDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
