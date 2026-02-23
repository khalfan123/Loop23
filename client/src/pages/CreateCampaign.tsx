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
import { useLocation, Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Clock, ChevronLeft, ChevronRight, Download, Upload, Info, Minus, Plus, Users, Search, Globe, User, X, GitBranch, FileText, Mic, Phone, ArrowRight, MessageSquare, Languages, ClipboardList, ExternalLink, Sparkles, Calendar, Building2, UserPlus, Headphones, Target, MessageCircle, Megaphone, CreditCard, PartyPopper, BarChart3, Settings, AlertTriangle, Wand2, Send, LayoutTemplate } from "lucide-react";
import { AuthStorage } from "@/lib/auth-storage";
import { TimezoneEnforcementModal } from "@/components/TimezoneEnforcementModal";
import { PhoneConflictDialog, PhoneConflictState, initialPhoneConflictState } from "@/components/PhoneConflictDialog";
import { usePluginStatus } from "@/hooks/use-plugin-status";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

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

interface FlowTemplateDetail {
  id: string;
  name: string;
  description?: string;
  isTemplate: boolean;
  nodes: Array<{
    id: string;
    type: string;
    data: {
      type: string;
      label: string;
      config: {
        type: string;
        message?: string;
        question?: string;
        variableName?: string;
        waitForResponse?: boolean;
        options?: string[];
        [key: string]: unknown;
      };
    };
  }>;
}

interface KnowledgeBaseItem {
  id: string;
  title: string;
  type: string;
  content?: string;
  url?: string;
  storageSize: number;
}

interface FormFieldItem {
  id: string;
  formId: string;
  question: string;
  fieldType: string;
  options: string[] | null;
  isRequired: boolean;
  order: number;
}

interface FormItem {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  fields: FormFieldItem[];
  submissionCount?: number;
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
    type: "",
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
  const [recipientSearchQuery, setRecipientSearchQuery] = useState("");
  const [removedPhones, setRemovedPhones] = useState<Set<string>>(new Set());
  const [wizardStep, setWizardStep] = useState(1);
  const [batchMode, setBatchModeRaw] = useState<'flow_template' | 'dynamic_form'>('flow_template');
  const [selectedFormId, setSelectedFormId] = useState<string>("");
  const [testCallNumber, setTestCallNumber] = useState("");
  const [scriptSuggestions, setScriptSuggestions] = useState<string[]>([]);

  const setBatchMode = useCallback((mode: 'flow_template' | 'dynamic_form') => {
    setBatchModeRaw(mode);
    if (mode !== 'dynamic_form') {
      setSelectedFormId("");
    }
  }, []);
  const [greetingMessage, setGreetingMessage] = useState("Hello! Thank you for taking my call. How are you doing today?");
  const [languageOptions, setLanguageOptions] = useState<string[]>(["English"]);
  const [newLanguage, setNewLanguage] = useState("");

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

  const isTemplateId = formData.flowId?.startsWith('template-');
  const { data: flowTemplateDetail } = useQuery<FlowTemplateDetail>({
    queryKey: ["/api/flow-automation/flow-templates", formData.flowId, "detail"],
    enabled: !!formData.flowId && batchMode === 'flow_template' && isTemplateId,
  });

  const { data: existingForms = [] } = useQuery<FormItem[]>({
    queryKey: ["/api/flow-automation/forms"],
    enabled: batchMode === 'dynamic_form',
  });

  const selectedForm = existingForms.find(f => f.id === selectedFormId);

  const { data: knowledgeBases = [] } = useQuery<KnowledgeBaseItem[]>({
    queryKey: ["/api/knowledge-base"],
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

  const generateGreetingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/campaigns/generate-greeting", {
        callType: batchMode,
        campaignName: formData.name,
      });
      return res.json();
    },
    onSuccess: (data: { greeting: string }) => {
      if (data.greeting) {
        setGreetingMessage(data.greeting);
      }
    },
    onError: () => {
      toast({ title: "Could not generate greeting", description: "Please try again or write one manually.", variant: "destructive" });
    },
  });

  const generateScriptMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/campaigns/generate-script", {
        campaignType: formData.type,
        campaignName: formData.name,
        campaignGoal: formData.goal,
      });
      return res.json();
    },
    onSuccess: (data: { suggestions?: string[] }) => {
      if (data.suggestions) {
        setScriptSuggestions(data.suggestions);
      }
    },
    onError: () => {
      toast({ title: "Could not generate script suggestions", description: "Please try again later.", variant: "destructive" });
    },
  });

  const changeToneMutation = useMutation({
    mutationFn: async (tone: string) => {
      const res = await apiRequest("POST", "/api/campaigns/change-tone", {
        script: formData.script,
        tone,
      });
      return res.json();
    },
    onSuccess: (data: { script?: string }) => {
      if (data.script) {
        setFormData(prev => ({ ...prev, script: data.script! }));
      }
    },
    onError: () => {
      toast({ title: "Could not change tone", description: "Please try again later.", variant: "destructive" });
    },
  });

  const humanizeScriptMutation = useMutation({
    mutationFn: async (level: string) => {
      const res = await apiRequest("POST", "/api/campaigns/humanize-script", {
        script: formData.script,
        level,
      });
      return res.json();
    },
    onSuccess: (data: { script?: string }) => {
      if (data.script) {
        setFormData(prev => ({ ...prev, script: data.script! }));
      }
    },
    onError: () => {
      toast({ title: "Could not humanize script", description: "Please try again later.", variant: "destructive" });
    },
  });

  const testCallMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/campaigns/test-call", {
        phoneNumber: testCallNumber,
        agentId: formData.agentId,
        phoneNumberId: isSipAgent ? formData.sipPhoneNumberId : formData.phoneNumberId,
        script: formData.script,
        telephonyType: isSipAgent ? 'sip' : isPlivoAgent ? 'plivo' : 'twilio',
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Test call initiated", description: "The test call has been sent." });
    },
    onError: () => {
      toast({ title: "Test call failed", description: "Please try again later.", variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = { ...formData };
      if (payload.flowId) {
        payload.script = "";
      }
      payload.batchMode = batchMode;
      payload.greetingMessage = greetingMessage;
      payload.languageOptions = languageOptions;
      if (batchMode === 'dynamic_form') {
        payload.selectedFormId = selectedFormId || undefined;
        payload.knowledgeBaseIds = knowledgeBases.map(kb => kb.id);
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
    let contacts: ParsedContact[];
    if (recipientMode === 'csv') {
      contacts = parsedContacts;
    } else {
      contacts = Array.from(resolvedContactPhones).map(phone => {
        const contact = allContacts.find(c => c.phone === phone);
        const name = contact?.names[0];
        return {
          phone_number: phone,
          first_name: name?.firstName || "",
          last_name: name?.lastName || "",
          email: contact?.email || "",
        };
      });
    }
    return contacts.filter(c => !removedPhones.has(c.phone_number));
  }, [recipientMode, parsedContacts, resolvedContactPhones, allContacts, removedPhones]);

  const filteredRecipients = useMemo(() => {
    if (!recipientSearchQuery) return resolvedContacts;
    const q = recipientSearchQuery.toLowerCase();
    return resolvedContacts.filter(c => {
      const name = `${c.first_name || ""} ${c.last_name || ""}`.toLowerCase();
      return c.phone_number.includes(q) || name.includes(q);
    });
  }, [resolvedContacts, recipientSearchQuery]);

  const removeRecipient = useCallback((phone: string) => {
    setRemovedPhones(prev => {
      const next = new Set(prev);
      next.add(phone);
      return next;
    });
    setSelectedIndividualPhones(prev => {
      const next = new Set(prev);
      next.delete(phone);
      return next;
    });
  }, []);

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


  const addLanguageOption = useCallback(() => {
    if (newLanguage && !languageOptions.includes(newLanguage)) {
      setLanguageOptions(prev => [...prev, newLanguage]);
      setNewLanguage("");
    }
  }, [newLanguage, languageOptions]);

  const removeLanguageOption = useCallback((lang: string) => {
    setLanguageOptions(prev => prev.filter(l => l !== lang));
  }, []);


  const allSelectableFlows = useMemo(() => {
    const items: { id: string; name: string; description: string; source: 'template' | 'flow'; nodeCount?: number }[] = [];
    flowTemplates.forEach(t => items.push({ id: t.id, name: t.name, description: t.description || 'Preset conversation template', source: 'template', nodeCount: t.nodeCount }));
    activeFlows.forEach(f => items.push({ id: f.id, name: f.name, description: f.description || 'Custom conversation flow', source: 'flow' }));
    return items;
  }, [flowTemplates, activeFlows]);

  const autoGeneratedNamePattern = /^.+ - [A-Z][a-z]{2} \d{1,2}$/;

  const handleSelectFlow = (flowItem: { id: string; name: string; source: 'template' | 'flow' }) => {
    const now = new Date();
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const autoName = `${flowItem.name} - ${monthNames[now.getMonth()]} ${now.getDate()}`;
    setFormData(prev => ({
      ...prev,
      type: flowItem.name,
      flowId: flowItem.id,
      name: (!prev.name || autoGeneratedNamePattern.test(prev.name)) ? autoName : prev.name,
    }));
    setBatchMode('flow_template');
  };

  const requiredStepsCompleted = (() => {
    let count = 0;
    if (formData.flowId) count++;
    if (formData.agentId) count++;
    if (isSipAgent ? formData.sipPhoneNumberId : formData.phoneNumberId) count++;
    return count;
  })();

  const canAdvanceFromStep = (step: number): boolean => {
    if (step === 1) return !!formData.flowId;
    if (step === 2) {
      const hasAgent = !!formData.agentId;
      const hasPhone = isSipAgent ? !!formData.sipPhoneNumberId : !!formData.phoneNumberId;
      return hasAgent && hasPhone;
    }
    return true;
  };

  const handleNextStep = () => {
    if (!canAdvanceFromStep(wizardStep)) {
      const messages: Record<number, string> = {
        1: "Please select a campaign flow before proceeding.",
        2: "Please select an agent and phone number before proceeding.",
      };
      toast({ title: messages[wizardStep] || "Please complete this step.", variant: "destructive" });
      return;
    }
    setWizardStep(wizardStep + 1);
  };

  const stepLabels: Record<number, string> = {
    1: "Step 1: Campaign Flow",
    2: "Step 2: Agent, Number & Recipients",
    3: "Step 3: Script & Settings",
    4: "Step 4: Schedule",
  };

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
        {/* Left Recipients Column - 20% */}
        <div className="w-full md:w-[20%] flex flex-col bg-muted/30 overflow-hidden min-h-[200px] md:min-h-0 border-b md:border-b-0 md:border-r">
          <div className="p-4 border-b flex-shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLocation("/app/campaigns")} data-testid="button-back">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h3 className="font-semibold text-sm">{t('campaigns.recipients', 'Recipients')}</h3>
            </div>
            {resolvedContacts.length > 0 && (
              <Badge variant="secondary" className="text-xs">{resolvedContacts.length}</Badge>
            )}
          </div>
          {resolvedContacts.length > 0 && (
            <div className="px-3 py-2 border-b flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={recipientSearchQuery}
                  onChange={(e) => setRecipientSearchQuery(e.target.value)}
                  className="h-8 pl-7 text-xs"
                  data-testid="input-search-recipients"
                />
              </div>
            </div>
          )}
          <div className="flex-1 flex items-center justify-center p-2 overflow-y-auto">
            {resolvedContacts.length === 0 ? (
              <div className="text-center text-muted-foreground px-2">
                <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-xs font-medium mb-1">{t('campaigns.noRecipientsYet', 'No recipients yet')}</p>
                <p className="text-[10px]">{recipientMode === 'csv' ? t('campaigns.pleaseUploadRecipients', 'Please upload recipients first') : 'Select contacts from the form'}</p>
              </div>
            ) : (
              <ScrollArea className="h-full w-full">
                <div className="space-y-1 p-1">
                  {filteredRecipients.map((contact, idx) => {
                    const displayName = contact.first_name ? `${contact.first_name} ${contact.last_name || ""}`.trim() : "";
                    return (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-white dark:bg-card rounded-lg border group" data-testid={`recipient-row-${idx}`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <span className="text-xs">{getCountryFlag(getCountryFromPhone(contact.phone_number))}</span>
                            <span className="text-xs font-medium truncate">{contact.phone_number}</span>
                          </div>
                          {displayName && <p className="text-[10px] text-muted-foreground truncate">{displayName}</p>}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                          onClick={() => removeRecipient(contact.phone_number)}
                          data-testid={`button-remove-recipient-${idx}`}
                        >
                          <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        {/* Right Form Column - 80% */}
        <div className="w-full md:w-[80%] flex flex-col md:min-h-0 md:overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('campaigns.createBatchCall', 'Create a batch call')}
                  className="font-semibold text-base bg-transparent border-none outline-none w-full placeholder:text-foreground focus:border-b focus:border-primary/30 transition-colors"
                  data-testid="input-batch-call-name"
                />
                <p className="text-xs text-muted-foreground">{t('campaigns.batchCallCost', 'Batch call cost $0.005 per dial')}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Badge variant="outline" className="text-[10px] mr-1">{requiredStepsCompleted}/3 filled</Badge>
                {[1, 2, 3, 4].map((step) => (
                  <div key={step} className="flex items-center gap-1">
                    <button
                      onClick={() => setWizardStep(step)}
                      className={`h-6 w-6 rounded-full text-[10px] font-medium flex items-center justify-center transition-colors ${
                        wizardStep === step
                          ? 'bg-primary text-primary-foreground'
                          : wizardStep > step
                          ? 'bg-primary/20 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}
                      data-testid={`wizard-step-${step}`}
                    >
                      {step}
                    </button>
                    {step < 4 && (
                      <div className={`w-3 h-0.5 ${wizardStep > step ? 'bg-primary/40' : 'bg-muted'}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-2">
              <p className="text-xs font-medium text-primary">
                {stepLabels[wizardStep]}
              </p>
            </div>
          </div>

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-5">

              {/* === STEP 1: Select Flow === */}
              {wizardStep === 1 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Select Campaign Flow</Label>
                    <Link href="/app/settings/flows">
                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" data-testid="link-manage-flows">
                        <ExternalLink className="h-3 w-3" /> Manage Flows
                      </Button>
                    </Link>
                  </div>
                  {allSelectableFlows.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
                      <GitBranch className="h-8 w-8 mx-auto text-muted-foreground/40" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">No flows available</p>
                        <p className="text-xs text-muted-foreground mt-1">Create a conversation flow first to use as a campaign type.</p>
                      </div>
                      <Link href="/app/settings/flows">
                        <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1.5" data-testid="button-create-flow">
                          <Plus className="h-3 w-3" /> Create a Flow
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {allSelectableFlows.map((item) => {
                        const isSelected = formData.flowId === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelectFlow(item)}
                            className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                              isSelected
                                ? 'border-primary bg-primary/5 dark:bg-primary/10'
                                : 'border-border hover:border-muted-foreground/40 dark:hover:border-muted-foreground/40'
                            }`}
                            data-testid={`campaign-flow-${item.id}`}
                          >
                            <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              isSelected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                            }`}>
                              {item.source === 'template' ? <LayoutTemplate className="h-4 w-4" /> : <GitBranch className="h-4 w-4" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <p className={`text-sm font-medium truncate ${isSelected ? 'text-primary' : ''}`}>{item.name}</p>
                                <Badge variant="secondary" className="text-[9px] h-4 px-1 shrink-0">
                                  {item.source === 'template' ? 'Template' : 'Custom'}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                              {item.nodeCount !== undefined && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">{item.nodeCount} steps</p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* === STEP 2: Agent, From Number & Recipients === */}
              {wizardStep === 2 && (
                <div className="space-y-5">
                  {/* Agent Selection */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">{t('campaigns.selectAgent', 'Agent')}</Label>
                    {filteredAgents.length === 0 ? (
                      <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
                        <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">No agents available</p>
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">You need to create an AI agent before creating a campaign.</p>
                          <Link href="/app/agents">
                            <Button type="button" variant="outline" size="sm" className="mt-2 h-7 text-xs gap-1" data-testid="link-create-agent">
                              <ExternalLink className="h-3 w-3" /> Go to Agents
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <Select
                        value={formData.agentId}
                        onValueChange={(value) => setFormData({ ...formData, agentId: value, phoneNumberId: '', sipPhoneNumberId: '' })}
                      >
                        <SelectTrigger className="h-9" data-testid="select-agent">
                          <SelectValue placeholder={t('campaigns.selectAgentPlaceholder', 'Select an agent')} />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredAgents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {selectedAgent && (
                      <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5" data-testid="agent-preview-card">
                        <p className="text-sm font-semibold">{selectedAgent.name}</p>
                        {selectedAgent.personality && (
                          <p className="text-xs text-muted-foreground">{selectedAgent.personality}</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary" className="text-[10px]">Type: {selectedAgent.type}</Badge>
                          {selectedAgent.telephonyProvider && (
                            <Badge variant="secondary" className="text-[10px]">Engine: {selectedAgent.telephonyProvider}</Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* From Number */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">{t('campaigns.fromNumber', 'From Number')}</Label>
                    {!formData.agentId ? (
                      <p className="text-xs text-muted-foreground">Select an agent above to see available phone numbers</p>
                    ) : isSipAgent && !isSipPluginEnabled ? (
                      <div className="p-2 rounded-md bg-destructive/10 border border-destructive/20">
                        <p className="text-xs text-destructive font-medium">SIP Plugin is disabled</p>
                      </div>
                    ) : (
                      <Select
                        value={isSipAgent ? formData.sipPhoneNumberId : formData.phoneNumberId}
                        onValueChange={(value) => {
                          if (isSipAgent) {
                            setFormData(prev => ({ ...prev, sipPhoneNumberId: value }));
                          } else {
                            setFormData(prev => ({ ...prev, phoneNumberId: value }));
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

                  {/* Recipients */}
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
                          <div className="space-y-1 max-h-[200px] overflow-y-auto">
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
                          <div className="space-y-1 max-h-[200px] overflow-y-auto">
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
                            <div className="space-y-0.5 max-h-[180px] overflow-y-auto">
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
                </div>
              )}

              {/* === STEP 3: Script & Settings === */}
              {wizardStep === 3 && (
                <>
                  {/* Campaign Script */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Campaign Script</Label>
                    <Textarea
                      value={formData.script}
                      onChange={(e) => setFormData({ ...formData, script: e.target.value })}
                      placeholder="Enter your call script..."
                      className="text-sm min-h-[100px] resize-none"
                      data-testid="input-campaign-script"
                    />
                  </div>

                  {/* AI Script Suggestions */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium flex items-center gap-1.5">
                        <Wand2 className="h-3.5 w-3.5" />
                        AI Script Suggestions
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => generateScriptMutation.mutate()}
                        disabled={generateScriptMutation.isPending}
                        data-testid="button-ai-suggest-script"
                      >
                        {generateScriptMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        {generateScriptMutation.isPending ? "Generating..." : "AI Suggest"}
                      </Button>
                    </div>
                    {scriptSuggestions.length > 0 && (
                      <div className="space-y-2">
                        {scriptSuggestions.map((suggestion, idx) => (
                          <div key={idx} className="rounded-lg border p-3 space-y-2" data-testid={`script-suggestion-${idx}`}>
                            <p className="text-xs text-muted-foreground leading-relaxed">{suggestion}</p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 text-[10px]"
                              onClick={() => setFormData(prev => ({ ...prev, script: suggestion }))}
                              data-testid={`button-apply-suggestion-${idx}`}
                            >
                              Apply
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Tone Changer */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Tone</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {["Professional", "Friendly", "Casual", "Formal"].map((tone) => (
                        <Button
                          key={tone}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => changeToneMutation.mutate(tone)}
                          disabled={changeToneMutation.isPending || !formData.script}
                          data-testid={`button-tone-${tone.toLowerCase()}`}
                        >
                          {changeToneMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                          {tone}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Humanize Script */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Humanize Script</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {["Light", "Moderate", "Heavy"].map((level) => (
                        <Button
                          key={level}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => humanizeScriptMutation.mutate(level)}
                          disabled={humanizeScriptMutation.isPending || !formData.script}
                          data-testid={`button-humanize-${level.toLowerCase()}`}
                        >
                          {humanizeScriptMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                          {level}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Greeting Message */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5" />
                        Greeting Message
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => generateGreetingMutation.mutate()}
                        disabled={generateGreetingMutation.isPending}
                        data-testid="button-ai-generate-greeting"
                      >
                        {generateGreetingMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        {generateGreetingMutation.isPending ? "Generating..." : "AI Generate"}
                      </Button>
                    </div>
                    <Textarea
                      value={greetingMessage}
                      onChange={(e) => setGreetingMessage(e.target.value)}
                      placeholder="Enter the greeting the AI will use when calling..."
                      className="text-sm min-h-[60px] resize-none"
                      data-testid="input-greeting-message"
                    />
                  </div>

                  {/* Campaign Goal */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Campaign Goal</Label>
                    <Input
                      value={formData.goal}
                      onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                      placeholder="e.g., Book appointments, qualify leads..."
                      className="h-9"
                      data-testid="input-campaign-goal"
                    />
                  </div>

                  {/* Additional Mode - Dynamic Form */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Data Collection Mode</Label>
                    <Select
                      value={batchMode}
                      onValueChange={(value) => {
                        setBatchMode(value as 'flow_template' | 'dynamic_form');
                      }}
                    >
                      <SelectTrigger className="h-9" data-testid="select-batch-mode">
                        <SelectValue placeholder="Select data collection mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flow_template">Flow Only - Use selected conversation flow</SelectItem>
                        <SelectItem value="dynamic_form">Dynamic Form - Also collect custom data using AI and knowledge base</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Data Collection Form - shown when dynamic_form */}
                  {batchMode === 'dynamic_form' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium flex items-center gap-1.5">
                          <ClipboardList className="h-3.5 w-3.5" />
                          Data Collection Form
                        </Label>
                        <div className="flex items-center gap-1.5">
                          {selectedForm && selectedForm.fields.length > 0 && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1" data-testid="button-show-fields">
                                  <FileText className="h-3 w-3" /> Show Fields
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-md">
                                <DialogHeader>
                                  <DialogTitle className="flex items-center gap-2">
                                    <ClipboardList className="h-4 w-4" />
                                    {selectedForm.name} - Fields
                                  </DialogTitle>
                                </DialogHeader>
                                <div className="rounded-lg border bg-muted/20 divide-y max-h-[400px] overflow-y-auto">
                                  {selectedForm.fields
                                    .sort((a, b) => a.order - b.order)
                                    .map((field, idx) => (
                                    <div key={field.id} className="flex items-center gap-2 px-3 py-2.5" data-testid={`form-field-preview-${idx}`}>
                                      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-[10px] font-medium text-primary shrink-0">
                                        {idx + 1}
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium truncate">{field.question}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                          <Badge variant="secondary" className="text-[9px] h-4 px-1.5">{field.fieldType}</Badge>
                                          {field.isRequired && <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-amber-300 text-amber-600">Required</Badge>}
                                          {field.options && field.options.length > 0 && (
                                            <span className="text-[9px] text-muted-foreground">{field.options.length} options</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                          <Link href="/app/forms">
                            <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" data-testid="button-manage-forms">
                              <ExternalLink className="h-3 w-3" /> Manage Forms
                            </Button>
                          </Link>
                        </div>
                      </div>
                      <Select value={selectedFormId} onValueChange={setSelectedFormId}>
                        <SelectTrigger className="h-9" data-testid="select-form">
                          <SelectValue placeholder={existingForms.length === 0 ? "No forms available" : "Select a form"} />
                        </SelectTrigger>
                        <SelectContent>
                          {existingForms.filter(f => f.isActive).map(form => (
                            <SelectItem key={form.id} value={form.id}>
                              <div className="flex items-center gap-2">
                                <span>{form.name}</span>
                                <span className="text-[10px] text-muted-foreground">({form.fields?.length || 0} fields)</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {existingForms.length === 0 && (
                        <div className="rounded-lg border border-dashed p-3 text-center">
                          <ClipboardList className="h-5 w-5 mx-auto text-muted-foreground/40 mb-1.5" />
                          <p className="text-xs text-muted-foreground mb-2">No forms created yet.</p>
                          <Link href="/app/forms">
                            <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" data-testid="button-create-form">
                              <Plus className="h-3 w-3" /> Create a Form
                            </Button>
                          </Link>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Flow Preview - shows selected flow from Step 1 */}
                  {formData.flowId && (
                    <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                      <GitBranch className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                      <div className="text-xs text-blue-700 dark:text-blue-300">
                        <p className="font-medium">Flow: {formData.type}</p>
                        <p className="mt-0.5 text-blue-600 dark:text-blue-400">
                          {isTemplateId ? 'Using a preset template flow.' : 'Using your custom flow.'} You can change it in Step 1.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Language Options - shown when dynamic_form */}
                  {batchMode === 'dynamic_form' && (
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium flex items-center gap-1.5">
                        <Languages className="h-3.5 w-3.5" />
                        Language Options
                      </Label>
                      <div className="flex flex-wrap gap-1.5">
                        {languageOptions.map(lang => (
                          <Badge key={lang} variant="secondary" className="text-xs gap-1 pr-1">
                            {lang}
                            {languageOptions.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeLanguageOption(lang)}
                                className="hover:text-destructive"
                                data-testid={`button-remove-lang-${lang}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-1.5">
                        <Input
                          placeholder="Add language (e.g., Spanish)"
                          value={newLanguage}
                          onChange={(e) => setNewLanguage(e.target.value)}
                          className="h-8 text-xs"
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLanguageOption())}
                          data-testid="input-add-language"
                        />
                        <Button type="button" variant="outline" size="sm" className="h-8 px-2" onClick={addLanguageOption} data-testid="button-add-language">
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* === STEP 4: Schedule === */}
              {wizardStep === 4 && (
                <>
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

                  {/* Test Call */}
                  <div className="space-y-2 pt-2 border-t">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" />
                      Test Call
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={testCallNumber}
                        onChange={(e) => setTestCallNumber(e.target.value)}
                        placeholder="Enter phone number for test call..."
                        className="h-9 flex-1"
                        data-testid="input-test-call-number"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 gap-1"
                        onClick={() => testCallMutation.mutate()}
                        disabled={testCallMutation.isPending || !testCallNumber || !formData.agentId}
                        data-testid="button-send-test-call"
                      >
                        {testCallMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        {testCallMutation.isPending ? "Calling..." : "Send Test Call"}
                      </Button>
                    </div>
                  </div>
                </>
              )}

            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t flex items-center justify-between">
            <div>
              {wizardStep > 1 && (
                <Button variant="outline" size="sm" onClick={() => setWizardStep(wizardStep - 1)} data-testid="button-wizard-back">
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setLocation("/app/campaigns")} data-testid="button-save-draft">
                {t('campaigns.saveAsDraft', 'Save as draft')}
              </Button>
              {wizardStep < 4 ? (
                <Button 
                  size="sm"
                  onClick={handleNextStep}
                  data-testid="button-wizard-next"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button 
                  size="sm"
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || !formData.agentId || (isSipAgent ? (!isSipPluginEnabled || !formData.sipPhoneNumberId) : !formData.phoneNumberId)}
                  data-testid="button-send"
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t('campaigns.send', 'Send')}
                </Button>
              )}
            </div>
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
