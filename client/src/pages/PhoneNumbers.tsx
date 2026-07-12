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
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Phone, ShoppingCart, Check, Trash2, CreditCard, Link as LinkIcon, Smartphone, Globe, MapPin, Upload, FileText, AlertCircle, Shield, Server, Loader2, RefreshCw, PhoneOutgoing, PhoneIncoming, Network, Bot, PanelLeft, ClipboardList, ChevronLeft, ArrowRightLeft, MessageCircle } from "lucide-react";
import NumberPortingView from "@/components/NumberPortingView";
import EmbeddedSignupButton from "@/components/whatsapp/EmbeddedSignupButton";
import AutoAssignButton from "@/components/whatsapp/AutoAssignButton";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePluginRegistry } from "@/contexts/plugin-registry";
import { AuthStorage } from "@/lib/auth-storage";
import { usePluginStatus } from "@/hooks/use-plugin-status";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useSearch } from "wouter";
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

const COUNTRY_CODE_TO_NAME: Record<string, string> = {
  US: "United States",
  AE: "United Arab Emirates",
  GB: "United Kingdom",
  DE: "Germany",
  FR: "France",
  ES: "Spain",
  IT: "Italy",
  NL: "Netherlands",
  BE: "Belgium",
  AT: "Austria",
  CH: "Switzerland",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  IE: "Ireland",
  NZ: "New Zealand",
  AU: "Australia",
  JP: "Japan",
  SG: "Singapore",
  HK: "Hong Kong",
  CA: "Canada",
  IN: "India",
  BR: "Brazil",
  MX: "Mexico",
  SA: "Saudi Arabia",
  QA: "Qatar",
  KW: "Kuwait",
  BH: "Bahrain",
  OM: "Oman",
};

function getCountryName(code: string): string {
  return COUNTRY_CODE_TO_NAME[code] || code;
}

function getFlagEmoji(iso: string): string {
  if (!iso || iso.length !== 2) return "🌐";
  return Array.from(iso.toUpperCase())
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

function getFlagImageSrc(iso: string): string | null {
  if (!iso || iso.length !== 2) return null;
  // FlagCDN provides flat SVG flags (ISO 3166-1 alpha-2).
  return `https://flagcdn.com/${iso.toLowerCase()}.svg`;
}

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

interface IvrConfigConnection {
  id: string;
  name: string;
  phoneNumberId: string | null;
  isActive: boolean;
  menuOptions?: { key: string; label: string; departmentId: string; }[];
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
  twilio_kyc_required: boolean;
}

interface UserWithKyc {
  id: string;
  kycStatus?: 'pending' | 'submitted' | 'approved' | 'rejected' | null;
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
  const search = useSearch();
  const [searchCountry, setSearchCountry] = useState("");
  const [searchContains, setSearchContains] = useState("");
  const [selectedNumber, setSelectedNumber] = useState<AvailableNumber | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [friendlyName, setFriendlyName] = useState("");
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
  const [numberToRelease, setNumberToRelease] = useState<PhoneNumber | null>(null);

  // Add number menu (inline in right panel)
  const [showAddNumberMenu, setShowAddNumberMenu] = useState(false);

  // Inline inner views (replaces dialogs)
  const [showBuyNumberView, setShowBuyNumberView] = useState(false);
  const [showPortingView, setShowPortingView] = useState(false);
  const [addMenuCountrySearch, setAddMenuCountrySearch] = useState("");
  const [cameFromCountryGrid, setCameFromCountryGrid] = useState(false);


  // SIP Trunks sidebar state
  const [selectedSipTrunkId, setSelectedSipTrunkId] = useState<string | null>(null);
  const { data: sipTrunksData } = useQuery<any>({ queryKey: ["/api/sip/trunks"] });
  const sipTrunks = sipTrunksData?.trunks || sipTrunksData || [];
  const { data: sipPhoneNumbersData } = useQuery<any>({ queryKey: ["/api/sip/phone-numbers"] });
  const sipPhoneNumbers = sipPhoneNumbersData?.phoneNumbers || sipPhoneNumbersData || [];

  // UAE direct purchase state
  const [uaeDirectNumber, setUaeDirectNumber] = useState("");

  // Import existing Twilio number state
  const [selectedImportNumber, setSelectedImportNumber] = useState<any>(null);

  // Active tab state for controlled Tabs
  const [activeTab, setActiveTab] = useState("owned");

  // Two-panel layout state
  const [selectedPhoneId, setSelectedPhoneId] = useState<string | null>(null);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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
  const [whatsappSetupOpen, setWhatsappSetupOpen] = useState(false);
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
  const [deleteTrunkDialogOpen, setDeleteTrunkDialogOpen] = useState(false);
  const [trunkToDelete, setTrunkToDelete] = useState<any>(null);
  
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

  const { data: voiceEngineSettings } = useQuery<VoiceEngineSettings>({
    queryKey: ["/api/settings/voice-engine"],
  });
  const twilioKycRequired = voiceEngineSettings?.twilio_kyc_required ?? true;
  
  // SIP access - requires plugin enabled AND user's plan has SIP access
  const { isSipPluginEnabled } = usePluginStatus();
  const pluginRegistry = usePluginRegistry();
  const phoneNumbersTabs = pluginRegistry.getPhoneNumbersTabs();

  // User KYC status
  const { data: currentUser } = useQuery<UserWithKyc>({
    queryKey: ["/api/auth/me"],
  });
  const isKycApproved = currentUser?.kycStatus === 'approved';

  const canPurchaseTwilio = true;

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

  // Existing Twilio numbers for import (response can be array OR { numbers, _debug })
  const { data: twilioExistingResp, isLoading: loadingExisting, refetch: refetchExisting } = useQuery<any>({
    queryKey: ["/api/phone-numbers/twilio-existing"],
    enabled: showBuyNumberView && searchCountry === "AE",
  });
  const existingTwilioNumbers: any[] = Array.isArray(twilioExistingResp)
    ? twilioExistingResp
    : (twilioExistingResp?.numbers || []);
  const twilioInventoryDebug = !Array.isArray(twilioExistingResp) ? twilioExistingResp?._debug : null;

  const importMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/phone-numbers/import-existing", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers/twilio-existing"] });
      setShowBuyNumberView(false);
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

  useEffect(() => {
    if (countries.length > 0 && !searchCountry) {
      const usCountry = countries.find(c => c.code === "US");
      setSearchCountry(usCountry ? "US" : countries[0].code);
    }
  }, [countries, searchCountry]);

  useEffect(() => {
    const qs = new URLSearchParams(search || "");
    if (qs.get("add") === "1") {
      setSelectedPhoneId(null);
      setSelectedSipTrunkId(null);
      setAddMenuCountrySearch("");
      setShowBuyNumberView(false);
      setShowPortingView(false);
      setShowAddNumberMenu(true);
    }
  }, [search]);

  const { data: incomingData } = useQuery<{ connections: IncomingConnection[]; allConnections: IncomingConnection[]; availablePhoneNumbers: PhoneNumber[] }>({
    queryKey: ["/api/incoming-connections"],
  });

  const allConnections = incomingData?.allConnections || [];

  const getConnection = (phoneNumberId: string) => {
    return allConnections.find(c => c.phoneNumberId === phoneNumberId);
  };

  const { data: ivrConfigs = [] } = useQuery<IvrConfigConnection[]>({
    queryKey: ["/api/departments/ivr/all"],
  });

  const getIvrConfig = (phoneNumberId: string) => {
    return ivrConfigs.find(c => c.phoneNumberId === phoneNumberId);
  };

  const isCountryValid = countries.some(c => c.code === searchCountry);

  const COUNTRY_GRID_ORDER: string[] = [
    "AE",
    "AR",
    "AU",
    "AT",
    "BE",
    "BR",
    "CA",
    "CL",
    "CZ",
    "FI",
    "FR",
    "DE",
    "HK",
    "IE",
    "IL",
    "JP",
    "MX",
    "NZ",
    "PH",
    "PR",
    "ZA",
    "CH",
    "GB",
    "US",
  ];

  const orderedCountriesForAddMenu = useMemo(() => {
    if (!countries?.length) return [];
    const byCode = new Map(countries.map((c) => [c.code, c]));
    return COUNTRY_GRID_ORDER.map((code) => byCode.get(code)).filter(Boolean) as TwilioCountry[];
  }, [countries]);

  const filteredCountriesForAddMenu = useMemo(() => {
    const q = addMenuCountrySearch.trim().toLowerCase();
    if (!q) return orderedCountriesForAddMenu;
    return orderedCountriesForAddMenu.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.dialCode.replace("+", "").includes(q)
    );
  }, [orderedCountriesForAddMenu, addMenuCountrySearch]);

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
      setShowBuyNumberView(false);
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

  const deleteTrunkMutation = useMutation({
    mutationFn: async (trunkId: string) => {
      const res = await apiRequest("DELETE", `/api/sip/trunks/${trunkId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sip/trunks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sip/phone-numbers"] });
      setDeleteTrunkDialogOpen(false);
      setTrunkToDelete(null);
      setSelectedSipTrunkId(null);
      toast({ title: "SIP trunk deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete SIP trunk",
        description: error.message || "Please try again.",
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

  const handleBuyClick = (provider: 'twilio' | 'select') => {
    if (provider === 'twilio') {
      if (!canPurchaseTwilio) {
        setKycRequiredDialogOpen(true);
        return;
      }
      setCameFromCountryGrid(false);
      setShowBuyNumberView(true);
      setShowAddNumberMenu(false);
      setSelectedPhoneId(null);
      setSelectedSipTrunkId(null);
    }
  };

  const openBuyForCountry = (code: string) => {
    if (!canPurchaseTwilio) {
      setKycRequiredDialogOpen(true);
      return;
    }
    setCameFromCountryGrid(true);
    setSearchCountry(code);
    setShowAddNumberMenu(false);
    setShowBuyNumberView(true);
    setSelectedPhoneId(null);
    setSelectedSipTrunkId(null);
    setSelectedNumber(null);
    setSearchContains("");
    setFriendlyName("");
    setHasSearched(true);
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

  const totalNumbers = ownedNumbers.length;
  const activeNumbers = ownedNumbers.filter(n => n.status === 'active').length;
  const agentPhoneIds = new Set([
    ...allConnections.map(c => c.phoneNumberId),
  ]);
  const ivrOnlyCount = ivrConfigs.filter(c => c.phoneNumberId && !agentPhoneIds.has(c.phoneNumberId)).length;
  const connectedNumbers = allConnections.length + ivrOnlyCount;
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
    provider: 'twilio' | 'tcxc';
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
  }, [ownedNumbers, tcxcMyDids]);

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
            onClick={() => {
              setSelectedPhoneId(null);
              setSelectedSipTrunkId(null);
              setAddMenuCountrySearch("");
              setShowAddNumberMenu(true);
            }}
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
          {(ownedLoading || tcxcMyDidsLoading) ? (
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
                  setSelectedSipTrunkId(null);
                  setShowAddNumberMenu(false);
                  setShowBuyNumberView(false);
                  setSelectedPhoneId(phone.id);
                  setMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                  selectedPhoneId === phone.id
                    ? 'bg-primary/10 dark:bg-primary/[0.15]'
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
                    {getCountryName(phone.country)}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {Array.isArray(sipTrunks) && sipTrunks.length > 0 && (
          <div className="border-t border-black/[0.06] dark:border-white/[0.08]">
            <div className="px-3 py-2">
              <div className="flex items-center gap-2 mb-1">
                <Network className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">SIP Trunks</span>
              </div>
            </div>
            {sipTrunks.map((trunk: any) => (
              <button
                key={trunk.id}
                onClick={() => {
                  setSelectedPhoneId(null);
                  setShowAddNumberMenu(false);
                  setShowBuyNumberView(false);
                  setSelectedSipTrunkId(trunk.id);
                  setMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                  selectedSipTrunkId === trunk.id
                    ? 'bg-primary/10 dark:bg-primary/[0.15]'
                    : 'hover-elevate'
                }`}
                data-testid={`sidebar-trunk-${trunk.id}`}
              >
                <Server className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground truncate">
                    {trunk.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono truncate">
                    {trunk.sipHost}
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex-shrink-0">
                  {(sipPhoneNumbers || []).filter((p: any) => p.sipTrunkId === trunk.id).length}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </>
  );

  const renderSipTrunkDetails = () => {
    if (!selectedSipTrunkId) return null;
    const trunk = sipTrunks.find((t: any) => t.id === selectedSipTrunkId);
    if (!trunk) return null;
    const trunkNumbers = (sipPhoneNumbers || []).filter((p: any) => p.sipTrunkId === trunk.id);

    return (
      <div className="max-w-2xl">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Server className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{trunk.name}</h2>
                <p className="text-sm text-muted-foreground font-mono">{trunk.sipHost}:{trunk.sipPort}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => {
                setTrunkToDelete(trunk);
                setDeleteTrunkDialogOpen(true);
              }}
              data-testid="button-delete-sip-trunk"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-muted-foreground">Provider</span>
                <p className="text-sm font-medium capitalize">{trunk.provider || "Twilio"}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Transport</span>
                <p className="text-sm font-medium uppercase">{trunk.transport || "TLS"}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Encryption</span>
                <p className="text-sm font-medium capitalize">{trunk.mediaEncryption || "Required"}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Status</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <p className="text-sm font-medium">Active</p>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold">Connected Numbers</span>
                <Badge variant="secondary">{trunkNumbers.length} numbers</Badge>
              </div>
              {trunkNumbers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No phone numbers connected to this trunk yet.</p>
              ) : (
                <div className="space-y-2">
                  {trunkNumbers.map((num: any) => (
                    <div key={num.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50" data-testid={`trunk-number-${num.id}`}>
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-mono text-sm">{num.phoneNumber}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{num.label || ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    );
  };

  const renderSelectedDetails = () => {
    if (!selectedPhone) return null;
    const original = getSelectedOriginalNumber();
    if (!original?.data) return null;

    const { type, data } = original;
    const connection = type === 'twilio' ? getConnection((data as PhoneNumber).id) : null;
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-semibold font-mono tracking-tight text-foreground" data-testid="text-selected-phone-number">
              {formatPhoneNumber(selectedPhone.phoneNumber)}
            </h2>
            {(type === 'twilio' && twilioKycRequired) && (
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
              <span className="text-sm text-muted-foreground">Type</span>
              <Badge variant="outline">
                Toll Free
              </Badge>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">{t('phoneNumbers.labels.country')}</span>
              <span className="text-sm font-medium text-foreground">{getCountryName(selectedPhone.country)}</span>
            </div>

            {type === 'twilio' && !(data as PhoneNumber).isSystemPool && (
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">{t('phoneNumbers.labels.monthlyCost')}</span>
                <span className="text-sm font-medium text-foreground">{MONTHLY_CREDITS} {t('phoneNumbers.labels.credits')}</span>
              </div>
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
              ) : (() => {
                const ivrConfig = type === 'twilio' ? getIvrConfig((data as PhoneNumber).id) : null;
                if (ivrConfig) {
                  return (
                    <div className="mt-1.5 space-y-1.5">
                      <div className="flex items-center gap-2" data-testid={`connection-status-ivr-${(data as PhoneNumber).id}`}>
                        <LinkIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm text-muted-foreground">Assigned to IVR:</span>
                        <span className="text-sm font-medium text-foreground">{ivrConfig.name}</span>
                      </div>
                      {ivrConfig.menuOptions && ivrConfig.menuOptions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 ml-5">
                          {ivrConfig.menuOptions.map((opt) => (
                            <Badge key={opt.key} variant="secondary" className="text-xs">
                              Press {opt.key}: {opt.label}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }
                return (
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-sm text-muted-foreground">{t('phoneNumbers.status.notConnected')}</span>
                  </div>
                );
              })()}
            </div>

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

          <Button
            variant="outline"
            className="rounded-full border-[#25D366]/40 text-[#1fa855] hover:bg-[#25D366]/10 hover:border-[#25D366]/60"
            onClick={() => setWhatsappSetupOpen(true)}
            title="Enable WhatsApp"
            aria-label="Enable WhatsApp"
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Enable WhatsApp
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

          {(type === 'twilio' && twilioKycRequired && !isKycApproved) && (
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

  const renderWhatsappSetupDialog = () => (
    <Dialog open={whatsappSetupOpen} onOpenChange={setWhatsappSetupOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enable WhatsApp</DialogTitle>
          <DialogDescription>
            Connect your first WhatsApp sender to Byan AI.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-lg border p-3">
            <div className="font-medium mb-1">Before you start</div>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>The phone number you onboard must not already be active on WhatsApp with another provider.</li>
              <li>Meta may require verification during the flow.</li>
              <li>After verification, Twilio may take a short processing period to complete registration.</li>
            </ul>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setWhatsappSetupOpen(false)}>
              Cancel
            </Button>
            <AutoAssignButton
              variant="secondary"
              onCompleted={() => {
                setWhatsappSetupOpen(false);
                setLocation("/app/inbox");
              }}
            />
            <EmbeddedSignupButton
              onCompleted={() => {
                setWhatsappSetupOpen(false);
                setLocation("/app/inbox");
              }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  const selectedCountryMeta = countries.find((c) => c.code === searchCountry);

  const renderTwilioRegularSearchAndPurchase = () => (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="search-contains-inline">Search by digits (optional)</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="search-contains-inline"
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
              {t("phoneNumbers.actions.searching")}
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              {t("phoneNumbers.actions.searchNumbers")}
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
            <RefreshCw className={`h-4 w-4 ${searchLoading ? "animate-spin" : ""}`} />
          </Button>
        )}
      </div>

      {!searchLoading && hasSearched && availableNumbers.length === 0 && (
        <div className="text-center py-8 text-muted-foreground space-y-2">
          <p>{t("phoneNumbers.search.noResults")}</p>
          <p className="text-xs">
            If you already own a number in this country, an admin can import it from the Admin Panel under Phone
            Numbers.
          </p>
        </div>
      )}

      {availableNumbers.length > 0 && (
        <div className="space-y-2">
          <Label>{t("phoneNumbers.labels.availableNumbers")}</Label>
          <div className="border rounded-md divide-y max-h-72 overflow-y-auto">
            {availableNumbers.map((number) => (
              <div
                key={number.phoneNumber}
                className={`p-4 hover-elevate cursor-pointer ${selectedNumber?.phoneNumber === number.phoneNumber ? "bg-accent" : ""}`}
                onClick={() => setSelectedNumber(number)}
                data-testid={`available-number-${number.phoneNumber}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-mono font-semibold">{formatPhoneNumber(number.phoneNumber)}</div>
                    {number.locality && number.region && (
                      <div className="text-sm text-muted-foreground">
                        {number.locality}, {number.region}
                      </div>
                    )}
                  </div>
                  {selectedNumber?.phoneNumber === number.phoneNumber && <Check className="h-5 w-5 text-primary" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedNumber && (
        <div className="space-y-2">
          <Label htmlFor="friendly-name-inline">{t("phoneNumbers.labels.friendlyName")}</Label>
          <Input
            id="friendly-name-inline"
            placeholder={t("phoneNumbers.placeholders.friendlyName")}
            value={friendlyName}
            onChange={(e) => setFriendlyName(e.target.value)}
            data-testid="input-friendly-name"
          />
        </div>
      )}

      {selectedNumber && (
        <Button
          onClick={handleBuyNumber}
          disabled={!selectedNumber || buyMutation.isPending}
          className="w-full"
          data-testid="button-confirm-purchase"
        >
          {buyMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Purchasing...
            </>
          ) : (
            <>
              <ShoppingCart className="h-4 w-4 mr-2" />
              {t("phoneNumbers.actions.buyNumber")}
            </>
          )}
        </Button>
      )}
    </div>
  );

  const renderUaeTollFreePurchaseSection = () => (
    <div className="space-y-6 pt-2">
      <div>
        <p className="text-sm font-medium mb-2">Available UAE Toll-Free Numbers</p>
        {loadingExisting ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground text-sm">Loading available numbers...</span>
          </div>
        ) : existingTwilioNumbers.length === 0 ? (
          <div className="py-4 px-4 text-muted-foreground border rounded-md space-y-2">
            <p className="text-sm font-medium text-foreground">No UAE toll-free numbers are currently available.</p>
            <p className="text-xs">Use the purchase form below to request a specific UAE 800 number.</p>
          </div>
        ) : (
          <div className="border rounded-md divide-y max-h-64 overflow-y-auto">
            {existingTwilioNumbers.map((number: any) => {
              const isSelected = uaeDirectNumber === number.phoneNumber;
              return (
                <div
                  key={number.sid}
                  className={`p-3 ${number.allocated ? "opacity-60 cursor-not-allowed" : "hover-elevate cursor-pointer"} ${isSelected ? "bg-accent" : ""}`}
                  onClick={() => {
                    if (number.allocated) return;
                    setUaeDirectNumber(number.phoneNumber);
                    if (!friendlyName && number.friendlyName) {
                      setFriendlyName(number.friendlyName);
                    }
                  }}
                  data-testid={`available-number-${number.phoneNumber}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium font-mono text-sm">{number.phoneNumber}</p>
                      <p className="text-xs text-muted-foreground">{number.friendlyName}</p>
                    </div>
                    {number.allocated ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border shrink-0">
                        In Use
                      </span>
                    ) : isSelected ? (
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
        <div>
          <p className="text-sm font-medium mb-1">Purchase Number</p>
          <p className="text-xs text-muted-foreground mb-3">
            Select an available number above, or enter a UAE 800 number manually (e.g. +9718001234567).
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="uae-direct-number">Phone Number</Label>
          <Input
            id="uae-direct-number"
            placeholder="+9718001234567"
            value={uaeDirectNumber}
            onChange={(e) => setUaeDirectNumber(e.target.value)}
            data-testid="input-uae-direct-number"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="uae-direct-name">Friendly Name (optional)</Label>
          <Input
            id="uae-direct-name"
            placeholder="e.g. UAE Support Line"
            value={friendlyName}
            onChange={(e) => setFriendlyName(e.target.value)}
          />
        </div>
        <Button
          className="w-full"
          disabled={
            !uaeDirectNumber ||
            !uaeDirectNumber.startsWith("+971") ||
            buyMutation.isPending ||
            importMutation.isPending ||
            (() => {
              const match = existingTwilioNumbers.find(
                (n: any) => n.phoneNumber === uaeDirectNumber,
              );
              return !!(match && match.allocated);
            })()
          }
          onClick={() => {
            if (!uaeDirectNumber) return;
            // If the number is already in the user's Twilio account (pre-allocated
            // by Twilio's regulatory team), import it instead of trying to "buy"
            // it again — Twilio rejects re-purchase with "This account can't buy ..."
            const existing = existingTwilioNumbers.find(
              (n: any) => n.phoneNumber === uaeDirectNumber,
            );
            if (existing) {
              if (existing.allocated) {
                toast({
                  title: "Number already in use",
                  description: "This number is already allocated to a user.",
                  variant: "destructive",
                });
                return;
              }
              importMutation.mutate({
                phoneNumber: existing.phoneNumber,
                twilioSid: existing.sid,
                friendlyName: friendlyName || existing.friendlyName,
                capabilities: existing.capabilities,
              });
              return;
            }
            // Brand-new number not yet in the account → real Twilio purchase
            buyMutation.mutate({
              phoneNumber: uaeDirectNumber,
              friendlyName,
              country: "AE",
            });
          }}
          data-testid="button-buy-uae-tollfree-number"
        >
          {buyMutation.isPending || importMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              {importMutation.isPending ? "Activating..." : "Purchasing..."}
            </>
          ) : (
            <>
              <ShoppingCart className="h-4 w-4 mr-2" />
              {existingTwilioNumbers.some(
                (n: any) => n.phoneNumber === uaeDirectNumber,
              )
                ? "Activate Number"
                : "Purchase Number"}
            </>
          )}
        </Button>
      </div>
    </div>
  );

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
            onClick={() => {
              setSelectedPhoneId(null);
              setSelectedSipTrunkId(null);
              setAddMenuCountrySearch("");
              setShowAddNumberMenu(true);
            }}
            data-testid="button-add-number"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="p-6 h-full overflow-y-auto">
          {showAddNumberMenu ? (
            <div className="max-w-5xl mx-auto" data-testid="add-number-menu">
              <div className="rounded-3xl border border-black/[0.06] dark:border-white/[0.08] bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl shadow-sm p-5 md:p-6">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-6 items-start mb-5">
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="h-8 w-8 -ml-1" onClick={() => setShowAddNumberMenu(false)} data-testid="button-back-add-number">
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div>
                      <h2 className="text-[17px] font-semibold tracking-tight flex items-center gap-2">
                        <Plus className="h-[18px] w-[18px]" />
                        {t('phoneNumbers.addNumber', { defaultValue: 'Add Number' })}
                      </h2>
                      <p className="text-[13px] text-muted-foreground">
                        {t('phoneNumbers.addNumberDescription', { defaultValue: 'Choose an option to add a number.' })}
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        className="h-10 inline-flex items-center justify-center gap-2 rounded-2xl border border-black/[0.06] dark:border-white/[0.10] bg-white/70 dark:bg-zinc-950/20 hover:bg-white/90 dark:hover:bg-zinc-950/30 transition-colors px-3"
                        onClick={() => {
                          setShowAddNumberMenu(false);
                          setLocation("/app/phone-numbers/sip-trunking");
                        }}
                        data-testid="option-sip-trunking"
                      >
                        <Network className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-[12px] font-semibold tracking-tight">SIP Trunk</span>
                      </button>

                      <button
                        className="h-10 inline-flex items-center justify-center gap-2 rounded-2xl border border-black/[0.06] dark:border-white/[0.10] bg-white/70 dark:bg-zinc-950/20 hover:bg-white/90 dark:hover:bg-zinc-950/30 transition-colors px-3"
                        onClick={() => {
                          setShowAddNumberMenu(false);
                          setShowPortingView(true);
                          setShowBuyNumberView(false);
                          setSelectedPhoneId(null);
                          setSelectedSipTrunkId(null);
                        }}
                        data-testid="option-port-number"
                      >
                        <ArrowRightLeft className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        <span className="text-[12px] font-semibold tracking-tight">Port</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[15px] font-semibold text-foreground tracking-tight">
                      {t('phoneNumbers.addNumberMenu.buyNumberHeading', { defaultValue: 'Buy a number' })}
                    </h3>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('phoneNumbers.addNumberMenu.searchCountries', { defaultValue: 'Search countries' })}
                      value={addMenuCountrySearch}
                      onChange={(e) => setAddMenuCountrySearch(e.target.value)}
                      className="pl-10 rounded-2xl bg-white/70 dark:bg-zinc-950/30 border-black/[0.06] dark:border-white/[0.10] focus-visible:ring-2 focus-visible:ring-black/[0.08] dark:focus-visible:ring-white/[0.12]"
                      data-testid="input-country-grid-search"
                    />
                  </div>

                  {countriesLoading ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {Array.from({ length: 12 }).map((_, idx) => (
                        <div
                          key={idx}
                          className="rounded-2xl border border-black/[0.06] dark:border-white/[0.10] bg-white/40 dark:bg-zinc-950/10 h-[92px]"
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                      {filteredCountriesForAddMenu.map((country) => (
                        <button
                          key={country.code}
                          className="group rounded-2xl border border-black/[0.06] dark:border-white/[0.10] bg-white/65 dark:bg-zinc-950/20 hover:bg-white/90 dark:hover:bg-zinc-950/30 transition-colors p-3.5 text-left shadow-[0_1px_0_rgba(0,0,0,0.03)] dark:shadow-none focus:outline-none focus-visible:ring-2 focus-visible:ring-black/[0.08] dark:focus-visible:ring-white/[0.12] hover:shadow-[0_6px_18px_rgba(0,0,0,0.06)] dark:hover:shadow-none hover:-translate-y-[1px] will-change-transform"
                          onClick={() => openBuyForCountry(country.code)}
                          data-testid={`country-tile-${country.code}`}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="h-7 w-10 rounded-md bg-black/[0.03] dark:bg-white/[0.06] flex items-center justify-center ring-1 ring-black/[0.06] dark:ring-white/[0.10] overflow-hidden">
                              <img
                                src={getFlagImageSrc(country.code) || undefined}
                                alt={`${country.name} flag`}
                                className="h-full w-full object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = "none";
                                  const fallback = (e.currentTarget as HTMLImageElement)
                                    .nextElementSibling as HTMLElement | null;
                                  if (fallback) fallback.style.display = "flex";
                                }}
                              />
                              <div
                                className="hidden h-full w-full items-center justify-center text-[11px] font-mono text-muted-foreground"
                                aria-hidden="true"
                              >
                                {country.code}
                              </div>
                            </div>
                          </div>

                          <div className="mt-2.5 text-[13px] font-semibold truncate tracking-tight text-foreground leading-5">
                            {country.name}
                          </div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground font-mono">
                            {country.dialCode} {country.code}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : showBuyNumberView ? (
            <div className="max-w-3xl mx-auto" data-testid="buy-number-view">
              <div className="flex items-center gap-3 mb-6">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 -ml-1"
                  onClick={() => {
                    setShowBuyNumberView(false);
                    setSelectedNumber(null);
                    setHasSearched(false);
                    if (cameFromCountryGrid) setShowAddNumberMenu(true);
                  }}
                  data-testid="button-back-buy-number"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    {t('phoneNumbers.dialog.buyTitle', { defaultValue: 'Buy New Number' })}
                  </h2>
                  <p className="text-sm text-muted-foreground">{t('phoneNumbers.dialog.buyDescription', { defaultValue: 'Search and purchase a new phone number' })}</p>
                </div>
              </div>

              <div className="rounded-3xl border border-black/[0.06] dark:border-white/[0.10] bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl shadow-sm p-4 flex items-start gap-3 mb-6">
                <CreditCard className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-[13px] mb-1 tracking-tight">{t('phoneNumbers.dialog.monthlyBilling')}</h4>
                  <p className="text-[13px] text-muted-foreground">
                    {t('phoneNumbers.dialog.monthlyBillingDesc', { credits: MONTHLY_CREDITS })}
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-3xl border border-black/[0.06] dark:border-white/[0.10] bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl shadow-sm p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-5 w-8 rounded-md bg-black/[0.03] dark:bg-white/[0.06] flex items-center justify-center ring-1 ring-black/[0.06] dark:ring-white/[0.10] overflow-hidden flex-shrink-0">
                        <img
                          src={getFlagImageSrc(searchCountry) || undefined}
                          alt={`${selectedCountryMeta?.name || searchCountry} flag`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                            const fallback = (e.currentTarget as HTMLImageElement)
                              .nextElementSibling as HTMLElement | null;
                            if (fallback) fallback.style.display = "flex";
                          }}
                        />
                        <div
                          className="hidden h-full w-full items-center justify-center text-[10px] font-mono text-muted-foreground"
                          aria-hidden="true"
                        >
                          {searchCountry}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[15px] font-semibold truncate tracking-tight" data-testid="text-selected-country-name">
                          {selectedCountryMeta?.name || searchCountry}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {selectedCountryMeta?.dialCode || ""} {searchCountry}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowBuyNumberView(false);
                        setSelectedNumber(null);
                        setHasSearched(false);
                        setAddMenuCountrySearch("");
                        setShowAddNumberMenu(true);
                      }}
                      data-testid="button-change-country"
                    >
                      {t('phoneNumbers.dialog.changeCountry', { defaultValue: 'Change country' })}
                    </Button>
                  </div>
                </div>

                {searchCountry === "AE" ? (
                  renderUaeTollFreePurchaseSection()
                ) : (
                  renderTwilioRegularSearchAndPurchase()
                )}
              </div>
            </div>
          ) : showPortingView ? (
            <NumberPortingView onBack={() => { setShowPortingView(false); setShowAddNumberMenu(true); }} />
          ) : selectedSipTrunkId ? (
            renderSipTrunkDetails()
          ) : allPhoneNumbers.length === 0 && (!Array.isArray(sipTrunks) || sipTrunks.length === 0) ? (
            <div className="flex flex-col items-center justify-center h-full text-center" data-testid="empty-state">
              <ClipboardList className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-base font-medium text-foreground mb-1">You don't have any phone numbers</h3>
              <p className="text-sm text-muted-foreground mb-4">Add your first phone number to get started.</p>
              <Button
                onClick={() => {
                  setSelectedPhoneId(null);
                  setSelectedSipTrunkId(null);
                  setAddMenuCountrySearch("");
                  setShowAddNumberMenu(true);
                }}
                data-testid="button-add-first-number"
              >
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
                <div className="rounded-xl bg-muted/30 p-3">
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
                    <div className="rounded-xl bg-muted/20 max-h-64 overflow-y-auto">
                      {marketplaceSearchResults.map((did) => (
                        <div 
                          key={did.i_did}
                          className="p-3 border-b last:border-b-0 flex items-center justify-between gap-2 hover-elevate"
                          data-testid={`marketplace-did-${did.i_did}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-sm truncate">{did.did}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-muted-foreground">{getCountryName(did.country)}</span>
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

                <div className="rounded-xl bg-muted/20 p-4">
                  <h4 className="text-sm font-medium mb-3">Your Rented Numbers from {selectedProvider.name}</h4>
                  <div className="space-y-2">
                    {providerCallerIds
                      .filter(c => c.credentialId === selectedProvider.id)
                      .map((callerId) => (
                        <div 
                          key={callerId.id} 
                          className="p-3 rounded-xl bg-muted/30 flex items-center justify-between gap-2"
                          data-testid={`caller-id-${callerId.id}`}
                        >
                          <div>
                            <p className="font-mono text-sm">{callerId.phoneNumber}</p>
                            <p className="text-xs text-muted-foreground">{getCountryName(callerId.country)}</p>
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
                    <p className="text-sm text-muted-foreground">{getCountryName(selectedMarketplaceDid.country)}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <Badge variant="outline">{selectedMarketplaceDid.did_type}</Badge>
                      {selectedMarketplaceDid.voice && <Badge variant="secondary">Voice</Badge>}
                      {selectedMarketplaceDid.sms && <Badge variant="secondary">SMS</Badge>}
                    </div>
                  </div>
                  <div className="rounded-xl bg-muted/30 p-3 space-y-1">
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

      <AlertDialog open={deleteTrunkDialogOpen} onOpenChange={setDeleteTrunkDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete SIP Trunk</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the SIP trunk "{trunkToDelete?.name}" and remove all associated phone numbers from ElevenLabs. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTrunkMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => trunkToDelete && deleteTrunkMutation.mutate(trunkToDelete.id)}
              disabled={deleteTrunkMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete-trunk"
            >
              {deleteTrunkMutation.isPending ? "Deleting..." : "Delete Trunk"}
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
                    <li>Wait for your address to be verified</li>
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
              setShowBuyNumberView(false);
              setLocation('/app/settings?tab=addresses');
            }} data-testid="button-go-to-addresses">
              <MapPin className="h-4 w-4 mr-2" />
              Add Address
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {renderWhatsappSetupDialog()}

    </div>
  );
}
