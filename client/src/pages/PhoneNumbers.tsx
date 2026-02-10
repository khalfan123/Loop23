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
import { Plus, Search, Phone, ShoppingCart, Check, Trash2, CreditCard, Link as LinkIcon, Smartphone, Globe, MapPin, Upload, FileText, AlertCircle, Shield, Server, Loader2, RefreshCw, PhoneOutgoing, PhoneIncoming, Network, Bot, PanelLeft, ClipboardList } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
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

  // Add number method selection dialog (Buy vs SIP Trunking)
  const [addNumberDialogOpen, setAddNumberDialogOpen] = useState(false);

  // Import existing Twilio number state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedImportNumber, setSelectedImportNumber] = useState<any>(null);

  // Active tab state for controlled Tabs
  const [activeTab, setActiveTab] = useState("owned");

  // Two-panel layout state
  const [selectedPhoneId, setSelectedPhoneId] = useState<string | null>(null);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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
  
  // HLR Lookup state for outbound calling
  const [hlrLookupNumber, setHlrLookupNumber] = useState("");
  const [hlrLookupResult, setHlrLookupResult] = useState<{
    internationalFormat: string;
    nationalFormat: string;
    countryCode: string;
    countryName: string;
    countryPrefix: string;
    currentCarrier: {
      networkCode: string;
      name: string;
      country: string;
      networkType: string;
    };
    originalCarrier: {
      networkCode: string;
      name: string;
      country: string;
      networkType: string;
    };
    ported: string;
    roaming: { status: string };
  } | null>(null);
  const [isLookingUpHlr, setIsLookingUpHlr] = useState(false);

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

  // TCXC routes query
  const { data: tcxcRoutes = [], isLoading: isLoadingRoutes } = useQuery<any[]>({
    queryKey: ["/api/tcxc/routes"],
    enabled: tcxcConfigured,
  });

  // Log routes for debugging
  console.log('[TCXC Routes] Data:', tcxcRoutes, 'Loading:', isLoadingRoutes);

  // Test market view search for UAE (971)
  const testMarketView = async () => {
    try {
      console.log('[Market View Test] Searching for prefix 971...');
      const response = await apiRequest('POST', '/api/tcxc/marketview/search', { prefix: '971', routeType: 'any', limit: 20 });
      const data = await response.json();
      console.log('[Market View Test] Results:', data);
    } catch (error) {
      console.error('[Market View Test] Error:', error);
    }
  };

  // Auto-run test on mount (for debugging)
  useEffect(() => {
    if (tcxcConfigured) {
      testMarketView();
    }
  }, [tcxcConfigured]);

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

  // Existing Twilio numbers for import
  const { data: existingTwilioNumbers = [], isLoading: loadingExisting, refetch: refetchExisting } = useQuery<any[]>({
    queryKey: ["/api/phone-numbers/twilio-existing"],
    enabled: importDialogOpen,
  });

  const importMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/phone-numbers/import-existing", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers/twilio-existing"] });
      setImportDialogOpen(false);
      setSelectedImportNumber(null);
      toast({ title: "Number imported successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

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
    console.log('[Marketplace] Searching with prefix:', prefix, 'seller:', seller);
    try {
      const response = await apiRequest("POST", "/api/tcxc/marketplace/search", {
        // Only include seller if it's a valid non-empty string
        ...(seller && seller.trim() ? { seller: seller.trim() } : {}),
        prefix: prefix || undefined,
        voice: true,
        limit: 50,
      });
      const data = await response.json() as MarketplaceDid[];
      console.log('[Marketplace] Response received, count:', Array.isArray(data) ? data.length : 0);
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

  // HLR Lookup for outbound number validation
  const performHlrLookup = async () => {
    if (!hlrLookupNumber.trim()) {
      toast({
        title: "Phone Number Required",
        description: "Please enter a phone number to lookup",
        variant: "destructive",
      });
      return;
    }

    setIsLookingUpHlr(true);
    setHlrLookupResult(null);
    try {
      const response = await apiRequest("POST", "/api/tcxc/hlr/lookup", {
        phoneNumber: hlrLookupNumber.trim(),
      });
      const data = await response.json();
      setHlrLookupResult(data);
      toast({
        title: "Lookup Complete",
        description: `Number validated: ${data.internationalFormat}`,
      });
    } catch (error: any) {
      console.error("HLR Lookup error:", error);
      toast({
        title: "Lookup Failed",
        description: error.message || "Failed to lookup phone number",
        variant: "destructive",
      });
    } finally {
      setIsLookingUpHlr(false);
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

  interface UnifiedPhoneNumber {
    id: string;
    phoneNumber: string;
    friendlyName?: string;
    status: string;
    provider: 'twilio' | 'plivo' | 'tcxc';
    country: string;
  }

  const allPhoneNumbers = useMemo<UnifiedPhoneNumber[]>(() => {
    const unified: UnifiedPhoneNumber[] = [];
    ownedNumbers.forEach(n => {
      unified.push({
        id: `twilio-${n.id}`,
        phoneNumber: n.phoneNumber,
        friendlyName: n.friendlyName,
        status: n.status,
        provider: 'twilio',
        country: n.country,
      });
    });
    plivoNumbers.forEach(n => {
      unified.push({
        id: `plivo-${n.id}`,
        phoneNumber: n.phoneNumber,
        status: n.status,
        provider: 'plivo',
        country: n.country,
      });
    });
    tcxcMyDids.forEach(n => {
      unified.push({
        id: `tcxc-${n.id}`,
        phoneNumber: n.phoneNumber,
        status: n.available ? 'active' : 'inactive',
        provider: 'tcxc',
        country: n.countryName || n.countryCode,
      });
    });
    return unified;
  }, [ownedNumbers, plivoNumbers, tcxcMyDids]);

  const filteredPhoneNumbers = useMemo(() => {
    if (!sidebarSearch.trim()) return allPhoneNumbers;
    const q = sidebarSearch.toLowerCase();
    return allPhoneNumbers.filter(n =>
      n.phoneNumber.toLowerCase().includes(q) ||
      (n.friendlyName && n.friendlyName.toLowerCase().includes(q)) ||
      n.provider.toLowerCase().includes(q) ||
      n.country.toLowerCase().includes(q)
    );
  }, [allPhoneNumbers, sidebarSearch]);

  const selectedPhone = useMemo(() => {
    if (!selectedPhoneId) return null;
    return allPhoneNumbers.find(n => n.id === selectedPhoneId) || null;
  }, [selectedPhoneId, allPhoneNumbers]);

  const getSelectedOriginalNumber = () => {
    if (!selectedPhone) return null;
    const [provider, ...idParts] = selectedPhone.id.split('-');
    const rawId = idParts.join('-');
    if (provider === 'twilio') return { type: 'twilio' as const, data: ownedNumbers.find(n => n.id === rawId) };
    if (provider === 'plivo') return { type: 'plivo' as const, data: plivoNumbers.find(n => n.id === rawId) };
    if (provider === 'tcxc') return { type: 'tcxc' as const, data: tcxcMyDids.find(n => n.id === rawId) };
    return null;
  };

  const renderSidebarContent = () => (
    <>
      <div className="px-3 py-3 border-b border-black/[0.06] dark:border-white/[0.08]">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">{t('phoneNumbers.title')}</span>
          </div>
          <Button
            size="icon"
            variant="default"
            className="rounded-full"
            onClick={() => setAddNumberDialogOpen(true)}
            data-testid="button-add-number-sidebar"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search phone numbers"
            value={sidebarSearch}
            onChange={(e) => setSidebarSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
            data-testid="input-sidebar-search"
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="py-1">
          {(ownedLoading || plivoNumbersLoading || tcxcMyDidsLoading) ? (
            <div className="px-3 py-6 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredPhoneNumbers.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              {allPhoneNumbers.length === 0 ? "No phone numbers yet" : "No matching numbers"}
            </div>
          ) : (
            filteredPhoneNumbers.map((phone) => (
              <button
                key={phone.id}
                onClick={() => {
                  setSelectedPhoneId(phone.id);
                  setMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                  selectedPhoneId === phone.id
                    ? 'bg-primary/10 dark:bg-primary/15'
                    : 'hover-elevate'
                }`}
                data-testid={`sidebar-phone-${phone.id}`}
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  phone.status === 'active' ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono font-medium text-foreground truncate">
                    {formatPhoneNumber(phone.phoneNumber)}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {phone.provider === 'twilio' ? 'Twilio' : phone.provider === 'plivo' ? 'Plivo' : 'TCXC'} · {phone.country}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </>
  );

  const renderSelectedDetails = () => {
    if (!selectedPhone) return null;
    const original = getSelectedOriginalNumber();
    if (!original?.data) return null;

    const { type, data } = original;
    const connection = type === 'twilio' ? getConnection((data as PhoneNumber).id) : null;
    const plivoConn = type === 'plivo' ? getPlivoConnection((data as PlivoPhoneNumber).id) : null;

    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-semibold font-mono tracking-tight text-foreground" data-testid="text-selected-phone-number">
              {formatPhoneNumber(selectedPhone.phoneNumber)}
            </h2>
            {((type === 'twilio' && twilioKycRequired) || (type === 'plivo' && plivoKycRequired)) && (
              <Badge 
                variant="outline"
                className={`cursor-pointer ${
                  currentUser?.kycStatus === 'approved'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
                }`}
                onClick={() => setLocation('/app/settings')}
                data-testid="badge-kyc-status-detail"
              >
                <Shield className="h-3 w-3 mr-1" />
                {getKycStatusLabel(currentUser?.kycStatus ?? undefined)}
              </Badge>
            )}
          </div>
          {selectedPhone.friendlyName && (
            <p className="text-sm text-muted-foreground mt-0.5">{selectedPhone.friendlyName}</p>
          )}
        </div>

        <Card className="p-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant={selectedPhone.status === 'active' ? 'default' : 'secondary'}>
                {selectedPhone.status === 'active' ? t('common.active') : selectedPhone.status}
              </Badge>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Provider</span>
              <Badge variant="outline">
                {selectedPhone.provider === 'twilio' ? 'Twilio' : selectedPhone.provider === 'plivo' ? 'Plivo' : 'TCXC'}
              </Badge>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">{t('phoneNumbers.labels.country')}</span>
              <span className="text-sm font-medium text-foreground">{selectedPhone.country}</span>
            </div>

            {type === 'twilio' && !(data as PhoneNumber).isSystemPool && (
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">{t('phoneNumbers.labels.monthlyCost')}</span>
                <span className="text-sm font-medium text-foreground">{MONTHLY_CREDITS} {t('phoneNumbers.labels.credits')}</span>
              </div>
            )}

            {type === 'plivo' && (
              <>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">Monthly Cost</span>
                  <span className="text-sm font-medium text-foreground">{(data as PlivoPhoneNumber).monthlyCredits} credits</span>
                </div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">Purchase Cost</span>
                  <span className="text-sm font-medium text-foreground">{(data as PlivoPhoneNumber).purchaseCredits} credits</span>
                </div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">Purchased</span>
                  <span className="text-sm font-medium text-foreground">
                    {new Date((data as PlivoPhoneNumber).purchasedAt).toLocaleDateString()}
                  </span>
                </div>
              </>
            )}

            {type === 'tcxc' && (
              <>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">Type</span>
                  <span className="text-sm font-medium text-foreground">{(data as TcxcDid).type}</span>
                </div>
                {(data as TcxcDid).monthlyPrice > 0 && (
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground">Monthly Price</span>
                    <span className="text-sm font-medium text-foreground">
                      {(data as TcxcDid).currency} {(data as TcxcDid).monthlyPrice}
                    </span>
                  </div>
                )}
              </>
            )}

            <div className="border-t pt-4">
              <span className="text-sm text-muted-foreground">Connection</span>
              {type === 'twilio' && connection ? (
                <div className="flex items-center gap-2 mt-1.5" data-testid={`connection-status-connected-${(data as PhoneNumber).id}`}>
                  <LinkIcon className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                  <span className="text-sm text-muted-foreground">{t('phoneNumbers.status.connectedTo')}</span>
                  <span className="text-sm font-medium text-foreground" data-testid={`connection-agent-name-${(data as PhoneNumber).id}`}>
                    {connection.agent.name}
                  </span>
                </div>
              ) : type === 'plivo' && plivoConn?.agent ? (
                <div className="flex items-center gap-2 mt-1.5" data-testid={`plivo-connection-status-connected-${(data as PlivoPhoneNumber).id}`}>
                  <LinkIcon className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                  <span className="text-sm text-muted-foreground">{t('phoneNumbers.status.connectedTo')}</span>
                  <span className="text-sm font-medium text-foreground">{plivoConn.agent.name}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-sm text-muted-foreground">{t('phoneNumbers.status.notConnected')}</span>
                </div>
              )}
            </div>

            {type === 'plivo' && (data as PlivoPhoneNumber).kycRejectionReason && (
              <div className="p-3 bg-destructive/10 rounded-md border border-destructive/20">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-destructive">KYC Rejection Reason:</p>
                    <p className="text-sm text-muted-foreground">{(data as PlivoPhoneNumber).kycRejectionReason}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setLocation("/app/incoming-connections")}
            data-testid="button-manage-connections"
          >
            <LinkIcon className="h-4 w-4 mr-2" />
            {t('phoneNumbers.manageConnections')}
          </Button>

          {type === 'twilio' && !(data as PhoneNumber).isSystemPool && (
            <Button
              variant="destructive"
              onClick={() => {
                setNumberToRelease(data as PhoneNumber);
                setReleaseDialogOpen(true);
              }}
              data-testid={`button-release-${(data as PhoneNumber).id}`}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t('phoneNumbers.actions.release')}
            </Button>
          )}

          {type === 'plivo' && (
            <Button
              variant="destructive"
              onClick={() => {
                setPlivoNumberToRelease(data as PlivoPhoneNumber);
                setPlivoReleaseDialogOpen(true);
              }}
              data-testid={`button-release-plivo-${(data as PlivoPhoneNumber).id}`}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Release Number
            </Button>
          )}

          {((type === 'twilio' && twilioKycRequired && !isKycApproved) || (type === 'plivo' && plivoKycRequired && !isKycApproved)) && (
            <Button
              variant="outline"
              onClick={() => setKycRequiredDialogOpen(true)}
              data-testid="button-complete-kyc-detail"
            >
              <Shield className="h-4 w-4 mr-2" />
              Complete KYC
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex w-full -mx-4 md:-mx-8 lg:-mx-12 -my-4 md:-my-6" style={{ minHeight: 'calc(100vh - 48px)' }}>
      {/* Left Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-[240px] flex-shrink-0 border-r border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-zinc-900">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Sidebar Sheet */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="p-0 w-[280px]">
          <SheetHeader className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.08]">
            <SheetTitle className="text-[15px] font-semibold tracking-tight">
              {t('phoneNumbers.title')}
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col flex-1 overflow-auto">
            {renderSidebarContent()}
          </div>
        </SheetContent>
      </Sheet>

      {/* Right Panel */}
      <div className="flex-1 min-w-0 overflow-auto bg-zinc-50/80 dark:bg-zinc-950/50">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-2 px-4 pt-3">
          <Button
            size="icon"
            variant="outline"
            onClick={() => setMobileSidebarOpen(true)}
            data-testid="button-mobile-sidebar-toggle"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-foreground">{t('phoneNumbers.title')}</span>
          <Button
            size="icon"
            variant="default"
            className="rounded-full ml-auto"
            onClick={() => setAddNumberDialogOpen(true)}
            data-testid="button-add-number"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="p-6 h-full">
          {allPhoneNumbers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center" data-testid="empty-state">
              <ClipboardList className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-base font-medium text-foreground mb-1">You don't have any phone numbers</h3>
              <p className="text-sm text-muted-foreground mb-4">Add your first phone number to get started.</p>
              <Button onClick={() => setAddNumberDialogOpen(true)} data-testid="button-add-first-number">
                <Plus className="h-4 w-4 mr-2" />
                {t('phoneNumbers.addNumber', { defaultValue: 'Add Number' })}
              </Button>
            </div>
          ) : selectedPhone ? (
            renderSelectedDetails()
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center" data-testid="no-selection-state">
              <Phone className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-base font-medium text-foreground mb-1">Select a phone number</h3>
              <p className="text-sm text-muted-foreground">Choose a phone number from the list to view its details.</p>
            </div>
          )}
        </div>
      </div>

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
              <div className="text-center py-8 text-muted-foreground space-y-2">
                <p>{t('phoneNumbers.search.noResults')}</p>
                <p className="text-xs">If you already own a number in this country, an admin can import it from the Admin Panel under Phone Numbers.</p>
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

      {/* Add Number Method Selection Dialog */}
      <Dialog open={addNumberDialogOpen} onOpenChange={setAddNumberDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              {t('phoneNumbers.addNumber', { defaultValue: 'Add Number' })}
            </DialogTitle>
            <DialogDescription>
              {t('phoneNumbers.addNumberDescription', { defaultValue: 'Choose how you want to add a phone number to your account.' })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-4">
            <div 
              className="border rounded-md p-4 cursor-pointer hover-elevate transition-all"
              onClick={() => {
                setAddNumberDialogOpen(false);
                if (plivoEnabled) {
                  handleBuyClick('select');
                } else {
                  handleBuyClick('twilio');
                }
              }}
              data-testid="option-buy-number"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-md bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <ShoppingCart className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold">{t('phoneNumbers.buyNewNumber', { defaultValue: 'Buy New Number' })}</h3>
                  <p className="text-sm text-muted-foreground">{t('phoneNumbers.buyNewNumberDesc', { defaultValue: 'Purchase a new phone number from available providers' })}</p>
                </div>
              </div>
            </div>

            <div 
              className="border rounded-md p-4 cursor-pointer hover-elevate transition-all"
              onClick={() => {
                setAddNumberDialogOpen(false);
                setImportDialogOpen(true);
              }}
              data-testid="option-import-existing"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-md bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                  <Upload className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold">Import Existing Number</h3>
                  <p className="text-sm text-muted-foreground">Import a number you already own from your Twilio account</p>
                </div>
              </div>
            </div>

            <div 
              className="border rounded-md p-4 cursor-pointer hover-elevate transition-all"
              onClick={() => {
                setAddNumberDialogOpen(false);
                const sipTab = phoneNumbersTabs.find(tab => tab.id.toLowerCase().includes('sip'));
                if (sipTab) {
                  setActiveTab(sipTab.id);
                } else {
                  setActiveTab("tcxc-dids");
                }
              }}
              data-testid="option-sip-trunking"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-md bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <Network className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold">{t('phoneNumbers.connectViaSipTrunking', { defaultValue: 'Connect via SIP Trunking' })}</h3>
                  <p className="text-sm text-muted-foreground">{t('phoneNumbers.connectViaSipTrunkingDesc', { defaultValue: 'Connect your existing numbers through SIP trunk configuration' })}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setAddNumberDialogOpen(false)} data-testid="button-cancel-add-number">
              {t('common.cancel')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Existing Number Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import Existing Number
            </DialogTitle>
            <DialogDescription>
              Select a number from your Twilio account to import. Only numbers not already in the system are shown.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {loadingExisting ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading your Twilio numbers...</span>
              </div>
            ) : existingTwilioNumbers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No importable numbers found in your Twilio account.</p>
                <p className="text-xs mt-1">All your Twilio numbers may already be imported.</p>
              </div>
            ) : (
              <div className="border rounded-md divide-y max-h-96 overflow-y-auto">
                {existingTwilioNumbers.map((number: any) => (
                  <div
                    key={number.sid}
                    className={`p-4 hover-elevate cursor-pointer ${
                      selectedImportNumber?.sid === number.sid ? "bg-accent" : ""
                    }`}
                    onClick={() => setSelectedImportNumber(number)}
                    data-testid={`import-number-${number.phoneNumber}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{number.phoneNumber}</p>
                        <p className="text-sm text-muted-foreground">{number.friendlyName}</p>
                      </div>
                      {selectedImportNumber?.sid === number.sid && (
                        <Check className="h-5 w-5 text-primary flex-shrink-0" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setImportDialogOpen(false)} data-testid="button-cancel-import">
                Cancel
              </Button>
              <Button
                disabled={!selectedImportNumber || importMutation.isPending}
                onClick={() => {
                  if (selectedImportNumber) {
                    importMutation.mutate({
                      phoneNumber: selectedImportNumber.phoneNumber,
                      twilioSid: selectedImportNumber.sid,
                      friendlyName: selectedImportNumber.friendlyName,
                      capabilities: selectedImportNumber.capabilities,
                    });
                  }
                }}
                data-testid="button-import-number"
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import Number
                  </>
                )}
              </Button>
            </div>
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
