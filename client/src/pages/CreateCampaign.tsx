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
import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Clock, ChevronLeft, ChevronRight, Download, Upload, Info, Minus, Plus, Users, Search, Globe, User } from "lucide-react";
import { AuthStorage } from "@/lib/auth-storage";
import { TimezoneEnforcementModal } from "@/components/TimezoneEnforcementModal";
import { PhoneConflictDialog, PhoneConflictState, initialPhoneConflictState } from "@/components/PhoneConflictDialog";
import { usePluginStatus } from "@/hooks/use-plugin-status";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Agent {
  id: string;
  name: string;
  personality: string;
  type: 'incoming' | 'natural' | 'flow';
  telephonyProvider: 'twilio' | 'plivo' | 'twilio_openai' | 'elevenlabs-sip' | 'openai-sip' | null;
  sipPhoneNumberId?: string | null;
}

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  friendlyName?: string;
}

interface SipPhoneNumber {
  id: string;
  phoneNumber: string;
  label?: string;
  trunkId: string;
  engine: string;
}

interface PlivoPhoneNumber {
  id: string;
  phoneNumber: string;
  friendlyName?: string;
}

interface UserData {
  id: number;
  email: string;
  name: string;
  timezone?: string | null;
}

interface ParsedContact {
  phone_number: string;
  [key: string]: string;
}

interface Flow {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

interface FlowTemplate {
  id: string;
  name: string;
  description?: string;
  isTemplate: boolean;
  nodeCount: number;
  preview: string[];
}

interface DeduplicatedContact {
  id: string;
  phone: string;
  email: string | null;
  names: Array<{ firstName: string; lastName: string | null }>;
  campaigns: Array<{ id: string; name: string }>;
  status: string;
  source: 'campaign' | 'call';
  callCount: number;
}

interface ContactGroup {
  id: string;
  user_id: string;
  name: string;
  color: string;
}

interface GroupMembership {
  contact_phone: string;
  group_id: string;
  group_name: string;
  group_color: string;
}

function getCountryFromPhone(phone: string): string {
  const cleaned = phone.replace(/\s/g, '');
  const codes: [string, string][] = [
    ['+358', 'Finland'], ['+353', 'Ireland'], ['+351', 'Portugal'],
    ['+971', 'UAE'], ['+966', 'Saudi Arabia'], ['+965', 'Kuwait'],
    ['+249', 'Sudan'], ['+212', 'Morocco'],
    ['+91', 'India'], ['+86', 'China'], ['+81', 'Japan'], ['+82', 'South Korea'],
    ['+92', 'Pakistan'], ['+90', 'Turkey'], ['+84', 'Vietnam'],
    ['+66', 'Thailand'], ['+65', 'Singapore'], ['+63', 'Philippines'],
    ['+62', 'Indonesia'], ['+61', 'Australia'], ['+60', 'Malaysia'],
    ['+55', 'Brazil'], ['+52', 'Mexico'],
    ['+49', 'Germany'], ['+48', 'Poland'], ['+47', 'Norway'],
    ['+46', 'Sweden'], ['+45', 'Denmark'], ['+44', 'UK'],
    ['+43', 'Austria'], ['+41', 'Switzerland'],
    ['+39', 'Italy'], ['+34', 'Spain'], ['+33', 'France'],
    ['+32', 'Belgium'], ['+31', 'Netherlands'], ['+30', 'Greece'],
    ['+27', 'South Africa'], ['+20', 'Egypt'],
    ['+7', 'Russia'], ['+1', 'US/Canada'],
  ];
  for (const [code, country] of codes) {
    if (cleaned.startsWith(code)) return country;
  }
  return 'Other';
}

function getCountryFlag(country: string): string {
  const isoCodes: Record<string, string> = {
    'US/Canada': 'US', 'UK': 'GB', 'UAE': 'AE', 'Saudi Arabia': 'SA', 'Kuwait': 'KW',
    'Sudan': 'SD', 'Morocco': 'MA', 'India': 'IN', 'China': 'CN', 'Japan': 'JP',
    'South Korea': 'KR', 'France': 'FR', 'Germany': 'DE', 'Italy': 'IT', 'Spain': 'ES',
    'Australia': 'AU', 'Brazil': 'BR', 'Mexico': 'MX', 'Russia': 'RU', 'Turkey': 'TR',
    'Pakistan': 'PK', 'Egypt': 'EG', 'South Africa': 'ZA', 'Philippines': 'PH',
    'Vietnam': 'VN', 'Indonesia': 'ID', 'Malaysia': 'MY', 'Singapore': 'SG',
    'Thailand': 'TH', 'Netherlands': 'NL', 'Sweden': 'SE', 'Norway': 'NO',
    'Denmark': 'DK', 'Finland': 'FI', 'Poland': 'PL', 'Portugal': 'PT',
    'Greece': 'GR', 'Ireland': 'IE', 'Belgium': 'BE', 'Switzerland': 'CH', 'Austria': 'AT',
  };
  const iso = isoCodes[country];
  if (!iso) return String.fromCodePoint(0x1F310);
  return Array.from(iso).map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('');
}

export default function CreateCampaign() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { isSipPluginEnabled } = usePluginStatus();
  const [formData, setFormData] = useState({
    name: "",
    type: "Lead Qualification",
    goal: "",
    script: "",
    flowId: "",
    agentId: "",
    phoneNumberId: "",
    sipPhoneNumberId: "",
    transferNumber: "",
    transferKeywords: [] as string[],
    scheduleEnabled: false,
    scheduleTimeStart: "00:00",
    scheduleTimeEnd: "23:59",
    scheduleDays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as string[],
    scheduleTimezone: "America/New_York",
    reservedConcurrency: 5,
  });
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedContacts, setParsedContacts] = useState<ParsedContact[]>([]);
  const [conflictDialog, setConflictDialog] = useState<PhoneConflictState>(initialPhoneConflictState);
  const [showTimezoneModal, setShowTimezoneModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showScheduleSettings, setShowScheduleSettings] = useState(false);
  const [recipientMode, setRecipientMode] = useState<'csv' | 'contacts'>('contacts');
  const [contactPickerTab, setContactPickerTab] = useState<'groups' | 'countries' | 'individual'>('groups');
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
  const [selectedIndividualPhones, setSelectedIndividualPhones] = useState<Set<string>>(new Set());
  const [contactSearchQuery, setContactSearchQuery] = useState("");

  const { data: userData } = useQuery<UserData>({
    queryKey: ["/api/auth/me"],
  });

  useEffect(() => {
    if (userData) {
      if (!userData.timezone) {
        setShowTimezoneModal(true);
      } else {
        setFormData(prev => ({ ...prev, scheduleTimezone: userData.timezone! }));
      }
    }
  }, [userData]);

  const handleTimezoneSet = () => {
    setShowTimezoneModal(false);
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  };

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const { data: phoneNumbers = [] } = useQuery<PhoneNumber[]>({
    queryKey: ["/api/phone-numbers"],
  });

  const { data: sipPhoneNumbersResponse } = useQuery<{ success: boolean; data: SipPhoneNumber[] }>({
    queryKey: ["/api/sip/phone-numbers"],
    enabled: isSipPluginEnabled,
  });

  const sipPhoneNumbers = sipPhoneNumbersResponse?.data || [];

  const { data: plivoPhoneNumbers = [] } = useQuery<PlivoPhoneNumber[]>({
    queryKey: ["/api/plivo/phone-numbers"],
  });

  const { data: flows = [] } = useQuery<Flow[]>({
    queryKey: ["/api/flow-automation/flows"],
  });

  const { data: flowTemplates = [] } = useQuery<FlowTemplate[]>({
    queryKey: ["/api/flow-automation/flow-templates"],
  });

  const { data: allContacts = [] } = useQuery<DeduplicatedContact[]>({
    queryKey: ["/api/contacts/deduplicated"],
  });

  const { data: contactGroups = [] } = useQuery<ContactGroup[]>({
    queryKey: ["/api/contact-groups"],
  });

  const { data: groupMemberships = [] } = useQuery<GroupMembership[]>({
    queryKey: ["/api/contact-group-memberships"],
  });

  const activeFlows = flows.filter(flow => flow.isActive);

  const selectedAgent = agents.find(a => a.id === formData.agentId);
  const isSipAgent = selectedAgent?.telephonyProvider === 'elevenlabs-sip' || selectedAgent?.telephonyProvider === 'openai-sip';
  const isPlivoAgent = selectedAgent?.telephonyProvider === 'plivo';

  const getAvailablePhoneNumbers = (): (PhoneNumber | SipPhoneNumber | PlivoPhoneNumber)[] => {
    if (isSipAgent) return sipPhoneNumbers;
    if (isPlivoAgent) return plivoPhoneNumbers;
    return phoneNumbers;
  };

  const availablePhoneNumbers = getAvailablePhoneNumbers();

  const filteredAgents = agents
    .filter(agent => agent.type !== 'incoming')
    .filter(agent => {
      const isSipAgentType = agent.telephonyProvider === 'elevenlabs-sip' || agent.telephonyProvider === 'openai-sip';
      if (isSipAgentType && !isSipPluginEnabled) return false;
      return true;
    });

  const dayKeys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...formData };
      if (payload.flowId) {
        payload.script = "";
      }
      const res = await apiRequest("POST", "/api/campaigns", payload);
      return res.json();
    },
    onSuccess: async (campaign) => {
      if (recipientMode === 'csv' && csvFile) {
        const formDataUpload = new FormData();
        formDataUpload.append("file", csvFile);

        try {
          const uploadHeaders: Record<string, string> = {};
          const authHeader = AuthStorage.getAuthHeader();
          if (authHeader) {
            uploadHeaders["Authorization"] = authHeader;
          }
          
          const res = await fetch(`/api/campaigns/${campaign.id}/contacts/upload`, {
            method: "POST",
            headers: uploadHeaders,
            body: formDataUpload,
          });

          if (!res.ok) {
            throw new Error("Failed to upload CSV contacts");
          }
        } catch (error) {
          toast({
            title: t("campaigns.toast.csvUploadFailed"),
            description: t("campaigns.toast.csvUploadFailedDesc"),
            variant: "destructive",
          });
        }
      } else if (recipientMode === 'contacts' && resolvedContacts.length > 0) {
        try {
          const csvHeader = "phone_number,first_name,last_name,email";
          const csvRows = resolvedContacts.map(c => 
            `"${c.phone_number}","${c.first_name || ""}","${c.last_name || ""}","${c.email || ""}"`
          );
          const csvContent = [csvHeader, ...csvRows].join("\n");
          const blob = new Blob([csvContent], { type: "text/csv" });
          const file = new File([blob], "selected_contacts.csv", { type: "text/csv" });
          
          const formDataUpload = new FormData();
          formDataUpload.append("file", file);

          const uploadHeaders: Record<string, string> = {};
          const authHeader = AuthStorage.getAuthHeader();
          if (authHeader) {
            uploadHeaders["Authorization"] = authHeader;
          }

          const res = await fetch(`/api/campaigns/${campaign.id}/contacts/upload`, {
            method: "POST",
            headers: uploadHeaders,
            body: formDataUpload,
          });

          if (!res.ok) {
            throw new Error("Failed to upload selected contacts");
          }
        } catch (error) {
          toast({
            title: "Contact Upload Failed",
            description: "Campaign created but contacts could not be added.",
            variant: "destructive",
          });
        }
      }

      try {
        await apiRequest("POST", `/api/campaigns/${campaign.id}/execute`);
      } catch (execError: any) {
        console.error("Campaign auto-start failed:", execError);
        toast({
          title: "Campaign created but failed to start",
          description: execError?.message || "Please start it manually from the campaigns page.",
          variant: "destructive",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({ title: t("campaigns.toast.createdSuccess") });
      setLocation("/app/campaigns");
    },
    onError: (error: any) => {
      if (error.status === 409 || error.conflictType) {
        setConflictDialog({
          isOpen: true,
          title: error.error || "Phone Number Conflict",
          message: error.message || error.error || "This phone number has a conflict.",
          conflictType: error.conflictType,
          connectedAgentName: error.connectedAgentName,
          campaignName: error.campaignName,
        });
        return;
      }
      
      toast({
        title: t("campaigns.toast.createFailed"),
        description: error.message || t("common.tryAgain"),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!formData.name) {
      toast({ title: t("campaigns.toast.pleaseEnterName"), variant: "destructive" });
      return;
    }
    if (!formData.agentId) {
      toast({ title: t("campaigns.toast.pleaseSelectAgent"), variant: "destructive" });
      return;
    }
    
    if (isSipAgent) {
      if (!isSipPluginEnabled) {
        toast({ title: "SIP Plugin is disabled. Please select a different agent.", variant: "destructive" });
        return;
      }
      if (!formData.sipPhoneNumberId) {
        toast({ title: t("campaigns.toast.pleaseSelectPhone"), variant: "destructive" });
        return;
      }
    } else if (isPlivoAgent) {
      if (!formData.phoneNumberId) {
        toast({ title: t("campaigns.toast.pleaseSelectPhone"), variant: "destructive" });
        return;
      }
    } else {
      if (!formData.phoneNumberId) {
        toast({ title: t("campaigns.toast.pleaseSelectPhone"), variant: "destructive" });
        return;
      }
    }
    
    if (formData.scheduleEnabled) {
      if (formData.scheduleDays.length === 0) {
        toast({ title: t("campaigns.toast.pleaseSelectDays", "Please select at least one day for scheduling"), variant: "destructive" });
        return;
      }
    }
    
    createMutation.mutate();
  };

  const parseCSV = (text: string): ParsedContact[] => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length <= 1) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
    const contacts: ParsedContact[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (const char of lines[i]) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      const contact: ParsedContact = { phone_number: '' };
      headers.forEach((header, idx) => {
        contact[header] = values[idx]?.replace(/^"|"$/g, '') || '';
      });
      if (contact.phone_number) {
        contacts.push(contact);
      }
    }
    return contacts;
  };

  const handleFileChange = (file: File | null) => {
    setCsvFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const contacts = parseCSV(text);
        setParsedContacts(contacts);
      };
      reader.readAsText(file);
    } else {
      setParsedContacts([]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.csv')) {
      handleFileChange(file);
    }
  };

  const formatSchedule = () => {
    const activeDays = formData.scheduleDays;
    let daysStr = 'Mon-Sun';
    if (activeDays.length === 7) {
      daysStr = 'Mon-Sun';
    } else if (activeDays.length === 5 && !activeDays.includes('saturday') && !activeDays.includes('sunday')) {
      daysStr = 'Mon-Fri';
    } else if (activeDays.length > 0) {
      daysStr = activeDays.map(d => d.slice(0, 3).charAt(0).toUpperCase() + d.slice(1, 3)).join(', ');
    }
    return `${formData.scheduleTimeStart}-${formData.scheduleTimeEnd}, ${daysStr}`;
  };

  const allocatedConcurrency = 20 - formData.reservedConcurrency;

  const countryGroups = useMemo(() => {
    const groups: Record<string, DeduplicatedContact[]> = {};
    allContacts.forEach(contact => {
      const country = getCountryFromPhone(contact.phone);
      if (!groups[country]) groups[country] = [];
      groups[country].push(contact);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [allContacts]);

  const filteredIndividualContacts = useMemo(() => {
    if (!contactSearchQuery) return allContacts;
    const q = contactSearchQuery.toLowerCase();
    return allContacts.filter(c => {
      const names = c.names.map(n => `${n.firstName} ${n.lastName || ""}`).join(" ").toLowerCase();
      return names.includes(q) || c.phone.includes(q) || c.email?.toLowerCase().includes(q);
    });
  }, [allContacts, contactSearchQuery]);

  const resolvedContactPhones = useMemo(() => {
    const phones = new Set<string>();
    selectedGroupIds.forEach(gId => {
      groupMemberships.filter(m => m.group_id === gId).forEach(m => phones.add(m.contact_phone));
    });
    selectedCountries.forEach(country => {
      allContacts.filter(c => getCountryFromPhone(c.phone) === country).forEach(c => phones.add(c.phone));
    });
    selectedIndividualPhones.forEach(p => phones.add(p));
    return phones;
  }, [selectedGroupIds, selectedCountries, selectedIndividualPhones, groupMemberships, allContacts]);

  const resolvedContacts = useMemo((): ParsedContact[] => {
    if (recipientMode === 'csv') return parsedContacts;
    return Array.from(resolvedContactPhones).map(phone => {
      const contact = allContacts.find(c => c.phone === phone);
      const name = contact?.names[0];
      return {
        phone_number: phone,
        first_name: name?.firstName || "",
        last_name: name?.lastName || "",
        email: contact?.email || "",
      };
    });
  }, [recipientMode, parsedContacts, resolvedContactPhones, allContacts]);

  const toggleGroup = useCallback((groupId: string) => {
    setSelectedGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const toggleCountry = useCallback((country: string) => {
    setSelectedCountries(prev => {
      const next = new Set(prev);
      if (next.has(country)) next.delete(country);
      else next.add(country);
      return next;
    });
  }, []);

  const toggleIndividual = useCallback((phone: string) => {
    setSelectedIndividualPhones(prev => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone);
      else next.add(phone);
      return next;
    });
  }, []);

  return (
    <>
      <TimezoneEnforcementModal
        open={showTimezoneModal}
        onOpenChange={(isOpen) => {
          setShowTimezoneModal(isOpen);
          if (!isOpen && !userData?.timezone) {
            setLocation("/app/campaigns");
          }
        }}
        onSuccess={handleTimezoneSet}
      />

      <div className="flex flex-col md:flex-row md:h-[calc(100vh-120px)] bg-white dark:bg-card rounded-xl border md:overflow-hidden">
        {/* Left Form Column */}
        <div className="w-full md:w-[320px] flex-shrink-0 border-b md:border-b-0 md:border-r flex flex-col md:min-h-0 md:overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLocation("/app/campaigns")} data-testid="button-back">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div>
                <h2 className="font-semibold text-base">{t('campaigns.createBatchCall', 'Create a batch call')}</h2>
                <p className="text-xs text-muted-foreground">{t('campaigns.batchCallCost', 'Batch call cost $0.005 per dial')}</p>
              </div>
            </div>
          </div>

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-5">
              {/* Batch Call Name */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">{t('campaigns.batchCallName', 'Batch Call Name')}</Label>
                <Input
                  placeholder={t('campaigns.enterName', 'Enter')}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-9"
                  data-testid="input-batch-call-name"
                />
              </div>

              {/* Agent Selection */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">{t('campaigns.selectAgent', 'Agent')}</Label>
                <Select 
                  value={formData.agentId} 
                  onValueChange={(value) => setFormData({ ...formData, agentId: value, phoneNumberId: '', sipPhoneNumberId: '' })}
                >
                  <SelectTrigger className="h-9" data-testid="select-agent">
                    <SelectValue placeholder={filteredAgents.length === 0 ? t("campaigns.create.noAgentsAvailable") : t('campaigns.selectAgentPlaceholder', 'Select an agent')} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredAgents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Flow Template */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Flow Template</Label>
                <Select 
                  value={formData.flowId || "none"} 
                  onValueChange={(value) => setFormData({ ...formData, flowId: value === "none" ? "" : value })}
                >
                  <SelectTrigger className="h-9" data-testid="select-flow-template">
                    <SelectValue placeholder={(activeFlows.length === 0 && flowTemplates.length === 0) ? "No flows available" : "Select a flow template"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (use agent script)</SelectItem>
                    {flowTemplates.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                          Preset Templates
                        </div>
                        {flowTemplates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {activeFlows.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                          Your Flows
                        </div>
                        {activeFlows.map((flow) => (
                          <SelectItem key={flow.id} value={flow.id}>
                            {flow.name}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* From Number */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">{t('campaigns.fromNumber', 'From number')}</Label>
                {isSipAgent && !isSipPluginEnabled ? (
                  <div className="p-2 rounded-md bg-destructive/10 border border-destructive/20">
                    <p className="text-xs text-destructive font-medium">SIP Plugin is disabled</p>
                  </div>
                ) : (
                  <Select 
                    value={isSipAgent ? formData.sipPhoneNumberId : formData.phoneNumberId} 
                    onValueChange={(value) => {
                      if (isSipAgent) {
                        setFormData({ ...formData, sipPhoneNumberId: value });
                      } else {
                        setFormData({ ...formData, phoneNumberId: value });
                      }
                    }}
                  >
                    <SelectTrigger className="h-9" data-testid="select-from-number">
                      <SelectValue placeholder={availablePhoneNumbers.length === 0 
                        ? (isSipAgent ? "No SIP numbers" : isPlivoAgent ? "No Plivo numbers" : t("campaigns.create.noPhoneNumbers"))
                        : t('campaigns.selectNumber', 'Select a phone number')} 
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePhoneNumbers.map((phone: any) => (
                        <SelectItem key={phone.id} value={phone.id}>
                          {phone.friendlyName || phone.label || phone.phoneNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Recipients Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Recipients</Label>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant={recipientMode === 'contacts' ? "default" : "outline"}
                    size="sm"
                    className="rounded-full h-7 px-3 text-xs"
                    onClick={() => setRecipientMode('contacts')}
                    data-testid="button-mode-contacts"
                  >
                    <Users className="h-3 w-3 mr-1" /> Select Contacts
                  </Button>
                  <Button
                    type="button"
                    variant={recipientMode === 'csv' ? "default" : "outline"}
                    size="sm"
                    className="rounded-full h-7 px-3 text-xs"
                    onClick={() => setRecipientMode('csv')}
                    data-testid="button-mode-csv"
                  >
                    <Upload className="h-3 w-3 mr-1" /> Upload CSV
                  </Button>
                </div>

                {recipientMode === 'csv' ? (
                  <div className="space-y-1.5">
                    <a 
                      href="/campaign_template.csv"
                      download="campaign_template.csv"
                      className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
                      data-testid="link-download-template"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      {t('campaigns.downloadTemplate', 'Download the template')}
                    </a>
                    <div 
                      className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                        isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/40'
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => document.getElementById('csv-upload')?.click()}
                      data-testid="dropzone-csv"
                    >
                      <input
                        id="csv-upload"
                        type="file"
                        accept=".csv"
                        onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                        className="hidden"
                        data-testid="input-csv-upload"
                      />
                      <Upload className="h-5 w-5 mx-auto mb-1.5 text-muted-foreground" />
                      {csvFile ? (
                        <p className="text-sm font-medium">{csvFile.name} ({parsedContacts.length} contacts)</p>
                      ) : (
                        <>
                          <p className="text-xs text-muted-foreground">{t('campaigns.dragDropCsv', 'Choose a csv or drag & drop it here.')}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{t('campaigns.upTo50MB', 'Up to 50 MB')}</p>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-1 border-b pb-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={`h-7 px-2 text-xs rounded-none border-b-2 ${contactPickerTab === 'groups' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
                        onClick={() => setContactPickerTab('groups')}
                        data-testid="tab-groups"
                      >
                        <Users className="h-3 w-3 mr-1" /> Groups
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={`h-7 px-2 text-xs rounded-none border-b-2 ${contactPickerTab === 'countries' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
                        onClick={() => setContactPickerTab('countries')}
                        data-testid="tab-countries"
                      >
                        <Globe className="h-3 w-3 mr-1" /> Countries
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={`h-7 px-2 text-xs rounded-none border-b-2 ${contactPickerTab === 'individual' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
                        onClick={() => setContactPickerTab('individual')}
                        data-testid="tab-individual"
                      >
                        <User className="h-3 w-3 mr-1" /> Individual
                      </Button>
                    </div>

                    {contactPickerTab === 'groups' && (
                      <div className="space-y-1 max-h-[180px] overflow-y-auto">
                        {contactGroups.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-3">No groups created yet. Create groups from the Contacts page.</p>
                        ) : (
                          contactGroups.map(group => {
                            const count = groupMemberships.filter(m => m.group_id === group.id).length;
                            return (
                              <label
                                key={group.id}
                                className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                                data-testid={`group-option-${group.id}`}
                              >
                                <Checkbox
                                  checked={selectedGroupIds.has(group.id)}
                                  onCheckedChange={() => toggleGroup(group.id)}
                                />
                                <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
                                <span className="text-sm flex-1 truncate">{group.name}</span>
                                <Badge variant="secondary" className="text-[10px]">{count}</Badge>
                              </label>
                            );
                          })
                        )}
                      </div>
                    )}

                    {contactPickerTab === 'countries' && (
                      <div className="space-y-1 max-h-[180px] overflow-y-auto">
                        {countryGroups.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-3">No contacts available.</p>
                        ) : (
                          countryGroups.map(([country, contacts]) => (
                            <label
                              key={country}
                              className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                              data-testid={`country-option-${country}`}
                            >
                              <Checkbox
                                checked={selectedCountries.has(country)}
                                onCheckedChange={() => toggleCountry(country)}
                              />
                              <span className="text-sm">{getCountryFlag(country)}</span>
                              <span className="text-sm flex-1 truncate">{country}</span>
                              <Badge variant="secondary" className="text-[10px]">{contacts.length}</Badge>
                            </label>
                          ))
                        )}
                      </div>
                    )}

                    {contactPickerTab === 'individual' && (
                      <div className="space-y-1.5">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            placeholder="Search contacts..."
                            value={contactSearchQuery}
                            onChange={(e) => setContactSearchQuery(e.target.value)}
                            className="h-8 pl-7 text-xs"
                            data-testid="input-search-individual"
                          />
                        </div>
                        <div className="space-y-0.5 max-h-[160px] overflow-y-auto">
                          {filteredIndividualContacts.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-3">No contacts found.</p>
                          ) : (
                            filteredIndividualContacts.map(contact => {
                              const name = contact.names[0];
                              const fullName = name ? `${name.firstName} ${name.lastName || ""}`.trim() : "";
                              return (
                                <label
                                  key={contact.id}
                                  className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/50 cursor-pointer"
                                  data-testid={`individual-option-${contact.id}`}
                                >
                                  <Checkbox
                                    checked={selectedIndividualPhones.has(contact.phone)}
                                    onCheckedChange={() => toggleIndividual(contact.phone)}
                                  />
                                  <span className="text-xs">{getCountryFlag(getCountryFromPhone(contact.phone))}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm truncate">{fullName || contact.phone}</div>
                                    {fullName && <div className="text-[11px] text-muted-foreground truncate">{contact.phone}</div>}
                                  </div>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}

                    {resolvedContactPhones.size > 0 && (
                      <div className="flex items-center justify-between pt-1 border-t">
                        <span className="text-xs text-muted-foreground">
                          {resolvedContactPhones.size} contact{resolvedContactPhones.size !== 1 ? 's' : ''} selected
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-muted-foreground"
                          onClick={() => {
                            setSelectedGroupIds(new Set());
                            setSelectedCountries(new Set());
                            setSelectedIndividualPhones(new Set());
                          }}
                          data-testid="button-clear-selection"
                        >
                          Clear all
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* When to send the calls */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('campaigns.whenToSend', 'When to send the calls')}</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={!formData.scheduleEnabled ? "default" : "outline"}
                    size="sm"
                    className="rounded-full h-8 px-4"
                    onClick={() => setFormData({ ...formData, scheduleEnabled: false })}
                    data-testid="button-send-now"
                  >
                    {t('campaigns.sendNow', 'Send Now')}
                    {!formData.scheduleEnabled && <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground ml-2" />}
                  </Button>
                  <Button
                    type="button"
                    variant={formData.scheduleEnabled ? "default" : "outline"}
                    size="sm"
                    className="rounded-full h-8 px-4"
                    onClick={() => setFormData({ ...formData, scheduleEnabled: true })}
                    data-testid="button-schedule"
                  >
                    Schedule
                    {formData.scheduleEnabled && <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground ml-2" />}
                  </Button>
                </div>
              </div>

              {/* When Calls Can Run */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">{t('campaigns.whenCallsCanRun', 'When Calls Can Run')}</Label>
                <Button 
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full justify-start h-9 text-sm font-normal"
                  onClick={() => setShowScheduleSettings(!showScheduleSettings)}
                  data-testid="button-schedule-settings"
                >
                  <Clock className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  <span className="text-muted-foreground">{formatSchedule()}</span>
                  <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
                </Button>
                
                {showScheduleSettings && (
                  <div className="space-y-3 p-3 border rounded-lg bg-muted/20 mt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Start Time</Label>
                        <Input
                          type="time"
                          value={formData.scheduleTimeStart}
                          onChange={(e) => setFormData({ ...formData, scheduleTimeStart: e.target.value })}
                          className="h-8 text-sm"
                          data-testid="input-schedule-time-start"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">End Time</Label>
                        <Input
                          type="time"
                          value={formData.scheduleTimeEnd}
                          onChange={(e) => setFormData({ ...formData, scheduleTimeEnd: e.target.value })}
                          className="h-8 text-sm"
                          data-testid="input-schedule-time-end"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Days of Week</Label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {dayKeys.map((day) => (
                          <div key={day} className="flex items-center gap-1.5">
                            <Checkbox
                              id={`day-${day}`}
                              checked={formData.scheduleDays.includes(day)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setFormData({ ...formData, scheduleDays: [...formData.scheduleDays, day] });
                                } else {
                                  setFormData({ ...formData, scheduleDays: formData.scheduleDays.filter(d => d !== day) });
                                }
                              }}
                              className="h-3.5 w-3.5"
                              data-testid={`checkbox-day-${day}`}
                            />
                            <Label htmlFor={`day-${day}`} className="text-xs font-normal cursor-pointer">
                              {day.charAt(0).toUpperCase() + day.slice(1)}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Timezone</Label>
                      <Select 
                        value={formData.scheduleTimezone} 
                        onValueChange={(value) => setFormData({ ...formData, scheduleTimezone: value })}
                      >
                        <SelectTrigger className="h-8 text-sm" data-testid="select-schedule-timezone">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UTC">UTC</SelectItem>
                          <SelectItem value="America/New_York">Eastern Time</SelectItem>
                          <SelectItem value="America/Chicago">Central Time</SelectItem>
                          <SelectItem value="America/Denver">Mountain Time</SelectItem>
                          <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                          <SelectItem value="Europe/London">London</SelectItem>
                          <SelectItem value="Europe/Paris">Paris</SelectItem>
                          <SelectItem value="Asia/Kolkata">Mumbai</SelectItem>
                          <SelectItem value="Asia/Singapore">Singapore</SelectItem>
                          <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                          <SelectItem value="Australia/Sydney">Sydney</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {/* Reserved Concurrency */}
              <div className="space-y-2">
                <div>
                  <Label className="text-sm font-medium">{t('campaigns.reservedConcurrency', 'Reserved Concurrency for Other Calls')}</Label>
                  <p className="text-xs text-muted-foreground">{t('campaigns.concurrencyDescription', 'Number of concurrency reserved for all other calls, such as inbound calls.')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Button 
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={() => setFormData({ ...formData, reservedConcurrency: Math.max(0, formData.reservedConcurrency - 1) })}
                    data-testid="button-decrease-concurrency"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <div className="flex-1 relative">
                    <Slider
                      value={[formData.reservedConcurrency]}
                      onValueChange={(value) => setFormData({ ...formData, reservedConcurrency: value[0] })}
                      max={20}
                      min={0}
                      step={1}
                      data-testid="slider-concurrency"
                    />
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-medium">
                      {formData.reservedConcurrency}
                    </div>
                  </div>
                  <Button 
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={() => setFormData({ ...formData, reservedConcurrency: Math.min(20, formData.reservedConcurrency + 1) })}
                    data-testid="button-increase-concurrency"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Concurrency Info */}
              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-blue-700 dark:text-blue-300">
                    {t('campaigns.concurrencyAllocated', 'Concurrency allocated to batch calling:')} {allocatedConcurrency}
                  </p>
                  <a href="/app/billing" className="inline-flex items-center text-xs text-blue-600 dark:text-blue-400 hover:underline" data-testid="link-purchase-concurrency">
                    {t('campaigns.purchaseMoreConcurrency', 'Purchase more concurrency')}
                    <ChevronRight className="h-3 w-3 ml-0.5" />
                  </a>
                </div>
              </div>

              {/* Terms */}
              <p className="text-xs text-muted-foreground">
                {t('campaigns.termsAgreement', "You've read and agree with the")} <a href="/terms" className="text-primary hover:underline" data-testid="link-terms">{t('campaigns.termsOfService', 'Terms of service')}</a>.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t flex items-center justify-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setLocation("/app/campaigns")} data-testid="button-save-draft">
              {t('campaigns.saveAsDraft', 'Save as draft')}
            </Button>
            <Button 
              size="sm"
              onClick={handleSubmit}
              disabled={createMutation.isPending || !formData.agentId || (isSipAgent ? (!isSipPluginEnabled || !formData.sipPhoneNumberId) : !formData.phoneNumberId)}
              data-testid="button-send"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('campaigns.send', 'Send')}
            </Button>
          </div>
        </div>

        {/* Right Recipients Column */}
        <div className="flex-1 flex flex-col bg-muted/30 overflow-hidden min-h-[200px] md:min-h-0">
          <div className="p-4 border-b flex-shrink-0 flex items-center justify-between">
            <h3 className="font-semibold text-sm">{t('campaigns.recipients', 'Recipients')}</h3>
            {resolvedContacts.length > 0 && (
              <Badge variant="secondary" className="text-xs">{resolvedContacts.length}</Badge>
            )}
          </div>
          <div className="flex-1 flex items-center justify-center p-4 overflow-y-auto">
            {resolvedContacts.length === 0 ? (
              <div className="text-center text-muted-foreground">
                <p className="text-sm">{recipientMode === 'csv' ? t('campaigns.pleaseUploadRecipients', 'Please upload recipients first') : 'Select contacts from groups, countries, or individually'}</p>
              </div>
            ) : (
              <ScrollArea className="h-full w-full">
                <div className="space-y-2 p-2">
                  {resolvedContacts.map((contact, idx) => {
                    const displayName = contact.first_name ? `${contact.first_name} ${contact.last_name || ""}`.trim() : "";
                    return (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-white dark:bg-card rounded-lg border" data-testid={`recipient-row-${idx}`}>
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-medium">{idx + 1}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{getCountryFlag(getCountryFromPhone(contact.phone_number))}</span>
                            <span className="text-sm font-medium truncate">{contact.phone_number}</span>
                          </div>
                          {displayName && <p className="text-xs text-muted-foreground truncate">{displayName}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </div>

      <PhoneConflictDialog
        open={conflictDialog.isOpen}
        onClose={() => setConflictDialog(initialPhoneConflictState)}
        title={conflictDialog.title}
        message={conflictDialog.message}
        conflictType={conflictDialog.conflictType}
        connectedAgentName={conflictDialog.connectedAgentName}
        campaignName={conflictDialog.campaignName}
      />
    </>
  );
}
