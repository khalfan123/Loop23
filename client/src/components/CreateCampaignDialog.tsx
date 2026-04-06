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
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Loader2, Clock, ChevronLeft, ChevronRight, Download, Phone, Info, Minus, Plus, Link2, CalendarCheck, FileText, Brain, Globe, Sparkles, X, Check, Volume2, Square, Pencil, RefreshCw } from "lucide-react";
import { AuthStorage } from "@/lib/auth-storage";
import { TimezoneEnforcementModal } from "@/components/TimezoneEnforcementModal";
import { PhoneConflictDialog, PhoneConflictState, initialPhoneConflictState } from "./PhoneConflictDialog";
import { usePluginStatus } from "@/hooks/use-plugin-status";
import { ScrollArea } from "@/components/ui/scroll-area";

interface GeneratedFormField {
  question: string;
  fieldType: string;
  isRequired: boolean;
  options: string[] | null;
}

interface Agent {
  id: string;
  name: string;
  personality: string;
  type: 'incoming' | 'natural' | 'flow';
  telephonyProvider: 'twilio' | 'twilio_openai' | 'elevenlabs-sip' | 'openai-sip' | null;
  sipPhoneNumberId?: string | null;
  voiceProvider?: string | null;
  elevenLabsVoiceId?: string | null;
  awsPollyVoiceId?: string | null;
  openaiVoice?: string | null;
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

interface UserData {
  id: number;
  email: string;
  name: string;
  timezone?: string | null;
}

interface CreateCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedContact {
  phone_number: string;
  [key: string]: string;
}

export function CreateCampaignDialog({ open, onOpenChange }: CreateCampaignDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
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

  const [generatedFormFields, setGeneratedFormFields] = useState<GeneratedFormField[]>([]);
  const [generatedFormName, setGeneratedFormName] = useState('');
  const [isGeneratingForm, setIsGeneratingForm] = useState(false);
  const [formGenerated, setFormGenerated] = useState(false);
  const [createdFormId, setCreatedFormId] = useState<string | null>(null);

  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [promptGenerated, setPromptGenerated] = useState(false);

  const [referenceUrl, setReferenceUrl] = useState('');
  const [isImportingUrl, setIsImportingUrl] = useState(false);
  const [importedKBs, setImportedKBs] = useState<Array<{ id: string; title: string }>>([]);
  const [showAdvancedScript, setShowAdvancedScript] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [voiceAudioRef, setVoiceAudioRef] = useState<HTMLAudioElement | null>(null);
  const [useCaseLocked, setUseCaseLocked] = useState(true);
  const [campaignGoal, setCampaignGoal] = useState('');
  const [isGeneratingUseCases, setIsGeneratingUseCases] = useState(false);
  const [onDemandUseCases, setOnDemandUseCases] = useState<GeneratedUseCase[]>([]);

  interface GeneratedUseCase {
    id: string;
    name: string;
    description: string;
    category: string;
  }

  const { data: dynamicUseCases = [], isLoading: useCasesLoading } = useQuery<GeneratedUseCase[]>({
    queryKey: ["/api/campaigns/use-cases"],
    enabled: open,
  });

  const displayedUseCases = onDemandUseCases.length > 0 ? onDemandUseCases : dynamicUseCases;

  const handleGenerateUseCases = async () => {
    setIsGeneratingUseCases(true);
    try {
      const res = await apiRequest("POST", "/api/campaigns/generate-use-cases", {
        goal: campaignGoal.trim() || undefined,
      });
      const data = await res.json();
      setOnDemandUseCases(data);
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns/use-cases"] });
    } catch (err: any) {
      toast({ title: "Failed to generate use cases", description: err.message, variant: "destructive" });
    } finally {
      setIsGeneratingUseCases(false);
    }
  };

  const { data: userData } = useQuery<UserData>({
    queryKey: ["/api/auth/me"],
    enabled: open,
  });

  useEffect(() => {
    if (open && userData) {
      if (!userData.timezone) {
        setShowTimezoneModal(true);
      } else {
        setFormData(prev => ({ ...prev, scheduleTimezone: userData.timezone! }));
      }
    }
  }, [open, userData]);

  const handleTimezoneSet = () => {
    setShowTimezoneModal(false);
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  };

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
    enabled: open,
  });

  const { data: phoneNumbers = [] } = useQuery<PhoneNumber[]>({
    queryKey: ["/api/phone-numbers"],
    enabled: open,
  });

  const { data: sipPhoneNumbersResponse } = useQuery<{ success: boolean; data: SipPhoneNumber[] }>({
    queryKey: ["/api/sip/phone-numbers"],
    enabled: open && isSipPluginEnabled,
  });

  const sipPhoneNumbers = sipPhoneNumbersResponse?.data || [];

  const selectedAgent = agents.find(a => a.id === formData.agentId);
  const isSipAgent = selectedAgent?.telephonyProvider === 'elevenlabs-sip' || selectedAgent?.telephonyProvider === 'openai-sip';
  const isTwilioAgent = !selectedAgent?.telephonyProvider || selectedAgent?.telephonyProvider === 'twilio' || selectedAgent?.telephonyProvider === 'twilio_openai';

  const getAvailablePhoneNumbers = (): (PhoneNumber | SipPhoneNumber)[] => {
    if (isSipAgent) return sipPhoneNumbers;
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

  const isAppointmentBooking = formData.type.toLowerCase().includes('appointment') || formData.type.toLowerCase().includes('booking');

  const generateFormForUseCase = async () => {
    if (isAppointmentBooking) return;
    setIsGeneratingForm(true);
    try {
      const res = await apiRequest("POST", "/api/campaigns/generate-form", {
        useCase: formData.type,
        language: selectedAgent?.telephonyProvider ? 'en' : 'en',
      });
      const data = await res.json();
      setGeneratedFormFields(data.fields || []);
      setGeneratedFormName(data.formName || `${formData.type} Form`);
      setFormGenerated(true);
    } catch (err: any) {
      toast({ title: "Failed to generate form", description: err.message, variant: "destructive" });
    } finally {
      setIsGeneratingForm(false);
    }
  };

  const createFormAndGetId = async (): Promise<string | null> => {
    if (createdFormId) return createdFormId;
    if (generatedFormFields.length === 0) return null;
    try {
      const res = await apiRequest("POST", "/api/campaigns/create-form", {
        formName: generatedFormName,
        formDescription: `Auto-generated for ${formData.type} campaign`,
        fields: generatedFormFields,
      });
      const data = await res.json();
      setCreatedFormId(data.formId);
      return data.formId;
    } catch {
      return null;
    }
  };

  const generatePromptForUseCase = async () => {
    if (!formData.agentId || !formData.type) return;
    setIsGeneratingPrompt(true);
    try {
      const importedKbIds = importedKBs.map(kb => kb.id);
      const res = await apiRequest("POST", "/api/campaigns/generate-use-case-prompt", {
        useCase: formData.type,
        agentId: formData.agentId,
        knowledgeBaseIds: importedKbIds.length > 0 ? importedKbIds : undefined,
        formFields: !isAppointmentBooking && generatedFormFields.length > 0 ? generatedFormFields : undefined,
      });
      const data = await res.json();
      setGeneratedPrompt(data.systemPrompt || '');
      setPromptGenerated(true);
      if (data.systemPrompt) {
        setFormData(prev => ({ ...prev, script: data.systemPrompt }));
      }
    } catch (err: any) {
      toast({ title: "Failed to generate prompt", description: err.message, variant: "destructive" });
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleImportUrl = async () => {
    if (!referenceUrl.trim()) return;
    setIsImportingUrl(true);
    try {
      const res = await apiRequest("POST", "/api/campaigns/import-reference-url", { url: referenceUrl.trim() });
      const data = await res.json();
      setImportedKBs(prev => [...prev, { id: data.knowledgeBaseId, title: data.title }]);
      setReferenceUrl('');
      toast({ title: "URL imported successfully", description: `"${data.title}" added as knowledge` });
    } catch (err: any) {
      toast({ title: "Failed to import URL", description: err.message, variant: "destructive" });
    } finally {
      setIsImportingUrl(false);
    }
  };

  const [isLoadingVoice, setIsLoadingVoice] = useState(false);

  const handlePlayVoice = async () => {
    if (isPlayingVoice && voiceAudioRef) {
      voiceAudioRef.pause();
      voiceAudioRef.currentTime = 0;
      setIsPlayingVoice(false);
      setVoiceAudioRef(null);
      return;
    }

    if (!selectedAgent || isLoadingVoice) return;

    const voiceProvider = selectedAgent.voiceProvider || 'elevenlabs';
    const previewText = 'Hi there! This is a quick call regarding an exciting opportunity we have for you. Do you have a moment to chat?';

    let endpoint = '';
    let body: Record<string, unknown> = {};

    if (voiceProvider === 'openai' || ((!selectedAgent.elevenLabsVoiceId && !selectedAgent.awsPollyVoiceId) && selectedAgent.openaiVoice)) {
      endpoint = '/api/openai/voices/preview';
      body = { voiceId: selectedAgent.openaiVoice || 'alloy', text: previewText };
    } else if (voiceProvider === 'elevenlabs' || selectedAgent.elevenLabsVoiceId) {
      if (!selectedAgent.elevenLabsVoiceId) {
        toast({ title: "No voice configured", description: "This agent doesn't have an ElevenLabs voice set up yet.", variant: "destructive" });
        return;
      }
      endpoint = '/api/voices/preview';
      body = { voiceId: selectedAgent.elevenLabsVoiceId, text: previewText };
    } else if (selectedAgent.openaiVoice) {
      endpoint = '/api/openai/voices/preview';
      body = { voiceId: selectedAgent.openaiVoice, text: previewText };
    } else if (selectedAgent.awsPollyVoiceId) {
      toast({ title: "Polly voice preview", description: `This agent uses AWS Polly voice "${selectedAgent.awsPollyVoiceId}". Preview is available in the agent settings.` });
      return;
    } else {
      toast({ title: "No voice configured", description: "This agent doesn't have a voice set up yet.", variant: "destructive" });
      return;
    }

    setIsLoadingVoice(true);
    setIsPlayingVoice(true);
    try {
      const token = AuthStorage.getToken();
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Failed to generate voice preview');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      setVoiceAudioRef(audio);
      setIsLoadingVoice(false);
      audio.onended = () => {
        setIsPlayingVoice(false);
        setVoiceAudioRef(null);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setIsPlayingVoice(false);
        setVoiceAudioRef(null);
        URL.revokeObjectURL(url);
      };
      audio.play().catch(() => {});
    } catch (err: any) {
      toast({ title: "Voice preview failed", description: err.message, variant: "destructive" });
      setIsPlayingVoice(false);
      setIsLoadingVoice(false);
      setVoiceAudioRef(null);
    }
  };

  useEffect(() => {
    if (formData.type && open && !isAppointmentBooking && !formGenerated) {
      generateFormForUseCase();
    }
  }, [formData.type, open]);

  useEffect(() => {
    if (formData.agentId && formData.type && open) {
      if (isAppointmentBooking || formGenerated) {
        generatePromptForUseCase();
      }
    }
  }, [formData.agentId, formGenerated, formData.type]);

  const dayKeys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

  const createMutation = useMutation({
    mutationFn: async () => {
      let selectedFormId: string | undefined;
      if (!isAppointmentBooking && generatedFormFields.length > 0) {
        const fId = await createFormAndGetId();
        if (fId) selectedFormId = fId;
      }

      const importedKbIds = importedKBs.map(kb => kb.id);

      const payload: any = {
        ...formData,
        selectedFormId: selectedFormId || undefined,
        knowledgeBaseIds: importedKbIds.length > 0 ? importedKbIds : undefined,
        appointmentBookingEnabled: isAppointmentBooking || undefined,
      };
      if (payload.flowId) {
        payload.script = "";
      }
      const res = await apiRequest("POST", "/api/campaigns", payload);
      return res.json();
    },
    onSuccess: async (campaign) => {
      if (csvFile) {
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
      }

      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({ title: t("campaigns.toast.createdSuccess") });
      handleClose();
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

  const resetFormState = () => {
    setFormData({
      name: "",
      type: "Lead Qualification",
      goal: "",
      script: "",
      flowId: "",
      agentId: "",
      phoneNumberId: "",
      sipPhoneNumberId: "",
      transferNumber: "",
      transferKeywords: [],
      scheduleEnabled: false,
      scheduleTimeStart: "00:00",
      scheduleTimeEnd: "23:59",
      scheduleDays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
      scheduleTimezone: "America/New_York",
      reservedConcurrency: 5,
    });
    setCsvFile(null);
    setParsedContacts([]);
    setShowScheduleSettings(false);
    setGeneratedFormFields([]);
    setGeneratedFormName('');
    setIsGeneratingForm(false);
    setFormGenerated(false);
    setCreatedFormId(null);
    setGeneratedPrompt('');
    setIsGeneratingPrompt(false);
    setPromptGenerated(false);
    setReferenceUrl('');
    setImportedKBs([]);
    setShowAdvancedScript(false);
    setIsPlayingVoice(false);
    setIsLoadingVoice(false);
    if (voiceAudioRef) {
      voiceAudioRef.pause();
      setVoiceAudioRef(null);
    }
    setUseCaseLocked(true);
  };

  const handleClose = () => {
    resetFormState();
    onOpenChange(false);
  };

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

  return (
    <>
      <TimezoneEnforcementModal
        open={showTimezoneModal}
        onOpenChange={(isOpen) => {
          setShowTimezoneModal(isOpen);
          if (!isOpen && !userData?.timezone) {
            onOpenChange(false);
          }
        }}
        onSuccess={handleTimezoneSet}
      />
      <Dialog open={open && !showTimezoneModal} onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) resetFormState();
      }}>
        <DialogContent className="max-w-5xl p-0 gap-0 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={handleClose} data-testid="button-back">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div>
                <h2 className="font-semibold">{t('campaigns.createBatchCall', 'Create a batch call')}</h2>
                <p className="text-xs text-muted-foreground">{t('campaigns.batchCallCost', 'Batch call cost $0.005 per dial')}</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex h-[70vh]">
            {/* Left Form Column */}
            <div className="w-1/2 border-r overflow-auto">
              <ScrollArea className="h-full">
                <div className="p-6 space-y-6">
                  {/* Batch Call Name */}
                  <div className="space-y-2">
                    <Label htmlFor="batch-call-name">{t('campaigns.batchCallName', 'Batch Call Name')}</Label>
                    <Input
                      id="batch-call-name"
                      placeholder={t('campaigns.enterName', 'Enter')}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      data-testid="input-batch-call-name"
                    />
                  </div>

                  {/* Campaign Type */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>{t('campaigns.create.typeRequired', 'Campaign Type *')}</Label>
                      <div className="flex items-center gap-1">
                        {useCaseLocked && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={() => setUseCaseLocked(false)}
                            data-testid="button-edit-use-case"
                            title="Edit use case"
                          >
                            <Pencil className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                        )}
                      </div>
                    </div>
                    {useCaseLocked ? (
                      <div className="flex items-center gap-2 p-2.5 rounded-md border bg-muted/50">
                        {isAppointmentBooking ? (
                          <CalendarCheck className="h-4 w-4 text-green-500 shrink-0" />
                        ) : (
                          <FileText className="h-4 w-4 text-purple-500 shrink-0" />
                        )}
                        <span className="text-sm font-medium flex-1">{formData.type}</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 space-y-2">
                          <div className="flex items-center gap-1.5">
                            <Brain className="h-3.5 w-3.5 text-primary" />
                            <span className="text-xs font-medium">What do you want to achieve?</span>
                          </div>
                          <Textarea
                            value={campaignGoal}
                            onChange={(e) => setCampaignGoal(e.target.value)}
                            placeholder="e.g. I want to follow up with customers who purchased our premium plan and upsell add-on services..."
                            className="min-h-[60px] text-xs resize-none"
                            data-testid="textarea-campaign-goal"
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="w-full h-8 text-xs"
                            onClick={handleGenerateUseCases}
                            disabled={isGeneratingUseCases}
                            data-testid="button-generate-use-cases"
                          >
                            {isGeneratingUseCases ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                                Analyzing your business & generating use cases...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-3 w-3 mr-1.5" />
                                Generate Tailored Use Cases
                              </>
                            )}
                          </Button>
                        </div>

                        {(useCasesLoading || isGeneratingUseCases) ? (
                          <div className="grid gap-1.5 grid-cols-1 sm:grid-cols-2">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                              <div key={i} className="h-16 rounded-lg bg-muted/50 animate-pulse" />
                            ))}
                          </div>
                        ) : displayedUseCases.length > 0 ? (
                          <>
                            {onDemandUseCases.length > 0 && (
                              <div className="flex items-center gap-1.5 text-[10px] text-primary font-medium">
                                <Sparkles className="h-3 w-3" />
                                AI-generated use cases tailored to your business
                              </div>
                            )}
                            <ScrollArea className="max-h-[200px]">
                              <div className="grid gap-1.5 grid-cols-1 sm:grid-cols-2 pr-2">
                                {displayedUseCases.map((uc) => {
                                  const isAppointment = uc.name.toLowerCase().includes('appointment') || uc.name.toLowerCase().includes('booking');
                                  const isSelected = formData.type === uc.name;
                                  return (
                                    <button
                                      key={uc.id || uc.name}
                                      type="button"
                                      className={`text-left p-2.5 rounded-lg border transition-all ${
                                        isSelected
                                          ? isAppointment
                                            ? "border-green-500 bg-green-50 dark:bg-green-950/30 ring-1 ring-green-500/30"
                                            : "border-primary bg-primary/5 ring-1 ring-primary/30"
                                          : "border-border hover:border-primary/40 hover:bg-accent/30"
                                      }`}
                                      onClick={() => {
                                        setFormData({ ...formData, type: uc.name });
                                        setFormGenerated(false);
                                        setGeneratedFormFields([]);
                                        setCreatedFormId(null);
                                        setPromptGenerated(false);
                                        setGeneratedPrompt('');
                                        setUseCaseLocked(true);
                                      }}
                                      data-testid={`button-usecase-${uc.name.toLowerCase().replace(/\s+/g, '-')}`}
                                    >
                                      <div className="flex items-start gap-2">
                                        <div className={`flex items-center justify-center h-6 w-6 rounded-md flex-shrink-0 mt-0.5 ${
                                          isSelected
                                            ? isAppointment ? "bg-green-500 text-white" : "bg-primary text-primary-foreground"
                                            : "bg-muted"
                                        }`}>
                                          {isSelected ? (
                                            <Check className="h-3 w-3" />
                                          ) : isAppointment ? (
                                            <CalendarCheck className="h-3 w-3" />
                                          ) : (
                                            <Sparkles className="h-3 w-3" />
                                          )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-medium truncate">{uc.name}</p>
                                          <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{uc.description}</p>
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </ScrollArea>
                          </>
                        ) : null}
                        {displayedUseCases.length > 0 && displayedUseCases[0]?.id?.startsWith('default-') && (
                          <p className="text-[10px] text-muted-foreground text-center">
                            <Sparkles className="h-3 w-3 inline mr-1" />
                            Add knowledge base entries for smarter, business-specific use cases
                          </p>
                        )}
                      </div>
                    )}

                    {isAppointmentBooking && (
                      <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800" data-testid="info-appointment-booking">
                        <CalendarCheck className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium text-green-700 dark:text-green-300">Appointment Booking Mode</p>
                          <p className="text-green-600 dark:text-green-400 text-xs mt-0.5">The AI agent will focus on booking appointments. Results will appear in your Appointments page.</p>
                        </div>
                      </div>
                    )}

                    {!isAppointmentBooking && (
                      <div className="flex items-start gap-2 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800" data-testid="info-form-collection">
                        <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium text-purple-700 dark:text-purple-300">Data Collection Mode</p>
                          <p className="text-purple-600 dark:text-purple-400 text-xs mt-0.5">
                            {isGeneratingForm ? 'Generating data collection form...' :
                              formGenerated ? `A "${generatedFormName}" form with ${generatedFormFields.length} fields will collect data during calls. Results in Forms page.` :
                              'A dynamic form will be auto-generated to collect data during calls.'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Agent Selection */}
                  <div className="space-y-2">
                    <Label>{t('campaigns.selectAgent', 'Select Agent *')}</Label>
                    <div className="flex items-center gap-2">
                      <Select 
                        value={formData.agentId} 
                        onValueChange={(value) => setFormData({ ...formData, agentId: value, phoneNumberId: '', sipPhoneNumberId: '' })}
                      >
                        <SelectTrigger data-testid="select-agent" className="flex-1">
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
                      {formData.agentId && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="shrink-0 h-10 w-10"
                          onClick={handlePlayVoice}
                          disabled={!selectedAgent || isLoadingVoice}
                          data-testid="button-play-voice"
                          title={isPlayingVoice ? "Stop voice preview" : "Listen to agent voice"}
                        >
                          {isLoadingVoice ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : isPlayingVoice ? (
                            <Square className="h-4 w-4 text-red-500" />
                          ) : (
                            <Volume2 className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                    {agents.filter(a => a.type !== 'incoming').length === 0 && (
                      <p className="text-sm text-muted-foreground">{t("campaigns.create.goToAgentsPage")}</p>
                    )}
                  </div>

                  {/* AI System Prompt */}
                  {formData.agentId && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-1.5">
                          <Brain className="h-4 w-4" />
                          AI Agent Script
                        </Label>
                        <div className="flex gap-1">
                          {isGeneratingPrompt && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={generatePromptForUseCase}
                            disabled={isGeneratingPrompt}
                            data-testid="button-regenerate-prompt"
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            {promptGenerated ? 'Regenerate' : 'Generate'}
                          </Button>
                        </div>
                      </div>
                      {promptGenerated ? (
                        <Textarea
                          value={formData.script}
                          onChange={(e) => setFormData({ ...formData, script: e.target.value })}
                          rows={4}
                          className="text-xs font-mono"
                          placeholder="AI agent system prompt will be auto-generated..."
                          data-testid="textarea-system-prompt"
                        />
                      ) : (
                        <div className="p-3 rounded-md border border-dashed text-xs text-muted-foreground text-center">
                          {isGeneratingPrompt ? 'Generating AI script based on your use case...' : 'Select an agent to auto-generate an AI script'}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reference URL Import */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Globe className="h-4 w-4" />
                      Reference URL
                    </Label>
                    <p className="text-xs text-muted-foreground">All your knowledge base articles are used automatically. Import additional reference URLs below.</p>

                    {importedKBs.length > 0 && (
                      <div className="space-y-1">
                        {importedKBs.map((kb) => (
                          <div key={kb.id} className="flex items-center gap-2 text-xs bg-blue-50 dark:bg-blue-950/30 p-1.5 rounded" data-testid={`imported-kb-${kb.id}`}>
                            <Check className="h-3 w-3 text-green-500" />
                            <span className="truncate flex-1">{kb.title}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={() => {
                                setImportedKBs(prev => prev.filter(k => k.id !== kb.id));
                              }}
                              data-testid={`button-remove-kb-${kb.id}`}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Link2 className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          value={referenceUrl}
                          onChange={(e) => setReferenceUrl(e.target.value)}
                          placeholder="Import reference URL..."
                          className="pl-7 h-8 text-xs"
                          data-testid="input-reference-url"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={handleImportUrl}
                        disabled={isImportingUrl || !referenceUrl.trim()}
                        data-testid="button-import-url"
                      >
                        {isImportingUrl ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Import'}
                      </Button>
                    </div>
                  </div>

                  {/* From Number */}
                  <div className="space-y-2">
                    <Label>{t('campaigns.fromNumber', 'From number')}</Label>
                    {isSipAgent && !isSipPluginEnabled ? (
                      <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                        <p className="text-sm text-destructive font-medium">SIP Plugin is disabled</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          The selected agent uses SIP telephony, but the SIP Engine plugin is currently disabled.
                        </p>
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
                        <SelectTrigger data-testid="select-from-number">
                          <SelectValue placeholder={availablePhoneNumbers.length === 0 
                            ? (isSipAgent ? "No SIP phone numbers available" : t("campaigns.create.noPhoneNumbers"))
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
                    {availablePhoneNumbers.length === 0 && formData.agentId && !(isSipAgent && !isSipPluginEnabled) && (
                      <p className="text-sm text-muted-foreground">
                        {isSipAgent ? "No SIP phone numbers available. Import a SIP phone number first." 
                          : t("campaigns.create.goToPhoneNumbers")}
                      </p>
                    )}
                  </div>

                  {/* Upload Recipients */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>{t('campaigns.uploadRecipients', 'Upload Recipients')}</Label>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs text-muted-foreground"
                        asChild
                      >
                        <a 
                          href="/campaign_template.csv"
                          download="campaign_template.csv"
                          data-testid="link-download-template"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          {t('campaigns.downloadTemplate', 'Download the template')}
                        </a>
                      </Button>
                    </div>
                    <div 
                      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                        isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
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
                      <Phone className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      {csvFile ? (
                        <p className="text-sm font-medium">{csvFile.name} ({parsedContacts.length} contacts)</p>
                      ) : (
                        <>
                          <p className="text-sm">{t('campaigns.dragDropCsv', 'Choose a csv or drag & drop it here.')}</p>
                          <p className="text-xs text-muted-foreground mt-1">{t('campaigns.upTo50MB', 'Up to 50 MB')}</p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* When to send the calls */}
                  <div className="space-y-3">
                    <Label>{t('campaigns.whenToSend', 'When to send the calls')}</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={!formData.scheduleEnabled ? "default" : "outline"}
                        className="rounded-full"
                        onClick={() => setFormData({ ...formData, scheduleEnabled: false })}
                        data-testid="button-send-now"
                      >
                        {t('campaigns.sendNow', 'Send Now')}
                        {!formData.scheduleEnabled && <div className="h-2 w-2 rounded-full bg-primary-foreground ml-2" />}
                      </Button>
                      <Button
                        type="button"
                        variant={formData.scheduleEnabled ? "default" : "outline"}
                        className="rounded-full"
                        onClick={() => setFormData({ ...formData, scheduleEnabled: true })}
                        data-testid="button-schedule"
                      >
                        {t('campaigns.schedule', 'Schedule')}
                        {formData.scheduleEnabled && <div className="h-2 w-2 rounded-full bg-primary-foreground ml-2" />}
                      </Button>
                    </div>
                  </div>

                  {/* When Calls Can Run - only show when scheduling is enabled */}
                  {formData.scheduleEnabled && (
                    <div className="space-y-2">
                      <Label>{t('campaigns.whenCallsCanRun', 'When Calls Can Run')}</Label>
                      <Button 
                        type="button"
                        variant="outline"
                        className="w-full justify-between"
                        onClick={() => setShowScheduleSettings(!showScheduleSettings)}
                        data-testid="button-schedule-settings"
                      >
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          {formatSchedule()}
                        </div>
                        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showScheduleSettings ? 'rotate-90' : ''}`} />
                      </Button>
                      
                      {showScheduleSettings && (
                        <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor="schedule-time-start">{t("campaigns.schedule.startTime")}</Label>
                              <Input
                                id="schedule-time-start"
                                type="time"
                                value={formData.scheduleTimeStart}
                                onChange={(e) => setFormData({ ...formData, scheduleTimeStart: e.target.value })}
                                data-testid="input-schedule-time-start"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="schedule-time-end">{t("campaigns.schedule.endTime")}</Label>
                              <Input
                                id="schedule-time-end"
                                type="time"
                                value={formData.scheduleTimeEnd}
                                onChange={(e) => setFormData({ ...formData, scheduleTimeEnd: e.target.value })}
                                data-testid="input-schedule-time-end"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>{t("campaigns.schedule.daysOfWeek")}</Label>
                            <div className="grid grid-cols-2 gap-2">
                              {dayKeys.map((day) => (
                                <div key={day} className="flex items-center gap-2">
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
                                    data-testid={`checkbox-day-${day}`}
                                  />
                                  <Label htmlFor={`day-${day}`} className="text-sm font-normal cursor-pointer">
                                    {t(`campaigns.schedule.days.${day}`)}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="schedule-timezone">{t("campaigns.schedule.timezone")}</Label>
                            <Select 
                              value={formData.scheduleTimezone} 
                              onValueChange={(value) => setFormData({ ...formData, scheduleTimezone: value })}
                            >
                              <SelectTrigger data-testid="select-schedule-timezone">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="UTC">UTC (Coordinated Universal Time)</SelectItem>
                                <SelectItem value="America/New_York">Eastern Time (US & Canada)</SelectItem>
                                <SelectItem value="America/Chicago">Central Time (US & Canada)</SelectItem>
                                <SelectItem value="America/Denver">Mountain Time (US & Canada)</SelectItem>
                                <SelectItem value="America/Los_Angeles">Pacific Time (US & Canada)</SelectItem>
                                <SelectItem value="America/Toronto">Toronto</SelectItem>
                                <SelectItem value="Europe/London">London</SelectItem>
                                <SelectItem value="Europe/Paris">Paris</SelectItem>
                                <SelectItem value="Europe/Berlin">Berlin</SelectItem>
                                <SelectItem value="Asia/Dubai">Dubai</SelectItem>
                                <SelectItem value="Asia/Kolkata">Mumbai/New Delhi</SelectItem>
                                <SelectItem value="Asia/Singapore">Singapore</SelectItem>
                                <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                                <SelectItem value="Australia/Sydney">Sydney</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reserved Concurrency */}
                  <div className="space-y-3">
                    <div>
                      <Label>{t('campaigns.reservedConcurrency', 'Reserved Concurrency for Other Calls')}</Label>
                      <p className="text-xs text-muted-foreground">{t('campaigns.concurrencyDescription', 'Number of concurrency reserved for all other calls, such as inbound calls.')}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Button 
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setFormData({ ...formData, reservedConcurrency: Math.max(0, formData.reservedConcurrency - 1) })}
                        data-testid="button-decrease-concurrency"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Slider
                        value={[formData.reservedConcurrency]}
                        onValueChange={(value) => setFormData({ ...formData, reservedConcurrency: value[0] })}
                        max={20}
                        min={0}
                        step={1}
                        className="flex-1"
                        data-testid="slider-concurrency"
                      />
                      <span className="text-sm font-medium w-6 text-center">{formData.reservedConcurrency}</span>
                      <Button 
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setFormData({ ...formData, reservedConcurrency: Math.min(20, formData.reservedConcurrency + 1) })}
                        data-testid="button-increase-concurrency"
                      >
                        <Plus className="h-4 w-4" />
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
                      <Button variant="link" size="sm" className="h-auto p-0 text-xs text-blue-600 dark:text-blue-400" data-testid="link-purchase-concurrency">
                        {t('campaigns.purchaseMoreConcurrency', 'Purchase more concurrency')}
                        <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </div>

                  {/* Terms */}
                  <p className="text-xs text-muted-foreground">
                    {t('campaigns.termsAgreement', "You've read and agree with the")} <Button variant="link" size="sm" className="h-auto p-0 text-xs text-primary" asChild><a href="/terms" data-testid="link-terms">{t('campaigns.termsOfService', 'Terms of service')}</a></Button>.
                  </p>
                </div>
              </ScrollArea>
            </div>

            {/* Right Preview Column */}
            <div className="w-1/2 flex flex-col bg-muted/30">
              <div className="p-4 border-b">
                <h3 className="font-semibold">
                  {parsedContacts.length > 0 ? t('campaigns.recipients', 'Recipients') :
                    !isAppointmentBooking && formGenerated ? 'Data Collection Form' : 'Campaign Preview'}
                </h3>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-6 space-y-4">
                  {/* Recipients */}
                  {parsedContacts.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('campaigns.recipients', 'Recipients')} ({parsedContacts.length})</p>
                      {parsedContacts.slice(0, 20).map((contact, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-2 bg-background rounded border" data-testid={`recipient-row-${idx}`}>
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{contact.phone_number}</span>
                        </div>
                      ))}
                      {parsedContacts.length > 20 && (
                        <p className="text-xs text-muted-foreground text-center">+{parsedContacts.length - 20} more contacts</p>
                      )}
                    </div>
                  )}

                  {/* Generated Form Preview */}
                  {!isAppointmentBooking && formGenerated && generatedFormFields.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Form Fields ({generatedFormFields.length})</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={generateFormForUseCase}
                          disabled={isGeneratingForm}
                          data-testid="button-regenerate-form"
                        >
                          <Sparkles className="h-3 w-3 mr-1" />
                          Regenerate
                        </Button>
                      </div>
                      {generatedFormFields.map((field, idx) => (
                        <div key={idx} className="p-3 bg-background rounded-lg border space-y-1" data-testid={`form-field-preview-${idx}`}>
                          <div className="flex items-start justify-between">
                            <p className="text-sm font-medium">{field.question}</p>
                            {field.isRequired && <span className="text-[10px] text-red-500 font-medium">Required</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{field.fieldType}</span>
                            {field.options && field.options.length > 0 && (
                              <span className="text-[10px] text-muted-foreground">{field.options.join(', ')}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {isGeneratingForm && (
                    <div className="flex flex-col items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
                      <p className="text-sm text-muted-foreground">Generating form fields for {formData.type}...</p>
                    </div>
                  )}

                  {/* Appointment Booking Info */}
                  {isAppointmentBooking && (
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Appointment Booking</p>
                      <div className="p-4 bg-background rounded-lg border space-y-2">
                        <div className="flex items-center gap-2">
                          <CalendarCheck className="h-5 w-5 text-green-500" />
                          <p className="text-sm font-medium">Automatic Appointment Booking</p>
                        </div>
                        <p className="text-xs text-muted-foreground">The AI agent will collect:</p>
                        <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                          <li>Contact name</li>
                          <li>Preferred date and time</li>
                          <li>Contact phone number</li>
                          <li>Any special requirements</li>
                        </ul>
                        <p className="text-xs text-muted-foreground mt-2">Booked appointments will appear at <span className="font-medium text-foreground">/app/appointments</span></p>
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {parsedContacts.length === 0 && !formGenerated && !isGeneratingForm && !isAppointmentBooking && (
                    <div className="text-center text-muted-foreground py-8">
                      <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">{t('campaigns.pleaseUploadRecipients', 'Please upload recipients first')}</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-4 border-t">
            <Button variant="outline" onClick={handleClose} data-testid="button-save-draft">
              {t('campaigns.saveAsDraft', 'Save as draft')}
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createMutation.isPending || !formData.agentId || (isSipAgent ? (!isSipPluginEnabled || !formData.sipPhoneNumberId) : !formData.phoneNumberId)}
              data-testid="button-send"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('campaigns.send', 'Send')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
