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
import { Upload, Loader2, Clock, ChevronLeft, ChevronRight, Download, Phone, Info, Minus, Plus } from "lucide-react";
import { AuthStorage } from "@/lib/auth-storage";
import { TimezoneEnforcementModal } from "@/components/TimezoneEnforcementModal";
import { PhoneConflictDialog, PhoneConflictState, initialPhoneConflictState } from "./PhoneConflictDialog";
import { usePluginStatus } from "@/hooks/use-plugin-status";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Agent {
  id: string;
  name: string;
  personality: string;
  type: 'incoming' | 'natural' | 'flow';
  telephonyProvider: 'twilio' | 'plivo' | 'twilio_openai' | 'elevenlabs-sip' | 'openai-sip' | 'retell' | null;
  sipPhoneNumberId?: string | null;
  retellAgentId?: string | null;
  retellCredentialId?: string | null;
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

  const { data: plivoPhoneNumbers = [] } = useQuery<PlivoPhoneNumber[]>({
    queryKey: ["/api/plivo/phone-numbers"],
    enabled: open,
  });

  const selectedAgent = agents.find(a => a.id === formData.agentId);
  const isSipAgent = selectedAgent?.telephonyProvider === 'elevenlabs-sip' || selectedAgent?.telephonyProvider === 'openai-sip';
  const isPlivoAgent = selectedAgent?.telephonyProvider === 'plivo';
  const isRetellAgent = selectedAgent?.telephonyProvider === 'retell';
  const isTwilioAgent = !selectedAgent?.telephonyProvider || selectedAgent?.telephonyProvider === 'twilio' || selectedAgent?.telephonyProvider === 'twilio_openai';

  const getAvailablePhoneNumbers = (): (PhoneNumber | SipPhoneNumber | PlivoPhoneNumber)[] => {
    if (isSipAgent) return sipPhoneNumbers;
    if (isPlivoAgent) return plivoPhoneNumbers;
    if (isRetellAgent) return phoneNumbers;
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
      const payload = {
        ...formData,
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
    
    if (isRetellAgent) {
      if (!selectedAgent?.retellAgentId) {
        toast({ title: "Retell Agent ID is not configured for this agent.", variant: "destructive" });
        return;
      }
      if (!selectedAgent?.retellCredentialId) {
        toast({ title: "Retell credential is not configured for this agent.", variant: "destructive" });
        return;
      }
      if (!formData.phoneNumberId) {
        toast({ title: t("campaigns.toast.pleaseSelectPhone"), variant: "destructive" });
        return;
      }
    } else if (isSipAgent) {
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
                    <Label>{t('campaigns.create.typeRequired', 'Campaign Type *')}</Label>
                    <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                      <SelectTrigger data-testid="select-campaign-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Lead Qualification">{t("campaigns.create.typeOptions.lead")}</SelectItem>
                        <SelectItem value="Feedback Collection">{t("campaigns.create.typeOptions.feedback")}</SelectItem>
                        <SelectItem value="Promotional">{t("campaigns.create.typeOptions.promotional")}</SelectItem>
                        <SelectItem value="Payment Reminder">{t("campaigns.create.typeOptions.payment")}</SelectItem>
                        <SelectItem value="Event Promotion">{t("campaigns.create.typeOptions.event")}</SelectItem>
                        <SelectItem value="Survey">{t("campaigns.create.typeOptions.survey")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Agent Selection */}
                  <div className="space-y-2">
                    <Label>{t('campaigns.selectAgent', 'Select Agent *')}</Label>
                    <Select 
                      value={formData.agentId} 
                      onValueChange={(value) => setFormData({ ...formData, agentId: value, phoneNumberId: '', sipPhoneNumberId: '' })}
                    >
                      <SelectTrigger data-testid="select-agent">
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
                    {agents.filter(a => a.type !== 'incoming').length === 0 && (
                      <p className="text-sm text-muted-foreground">{t("campaigns.create.goToAgentsPage")}</p>
                    )}
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
                            ? (isSipAgent ? "No SIP phone numbers available" : isPlivoAgent ? "No Plivo phone numbers available" : isRetellAgent ? "No phone numbers available" : t("campaigns.create.noPhoneNumbers"))
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
                          : isPlivoAgent ? "No Plivo phone numbers available. Purchase a Plivo phone number first."
                          : isRetellAgent ? "No phone numbers available. Add a phone number first."
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

            {/* Right Recipients Column */}
            <div className="w-1/2 flex flex-col bg-muted/30">
              <div className="p-4 border-b">
                <h3 className="font-semibold">{t('campaigns.recipients', 'Recipients')}</h3>
              </div>
              <div className="flex-1 flex items-center justify-center p-6">
                {parsedContacts.length === 0 ? (
                  <div className="text-center text-muted-foreground">
                    <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{t('campaigns.pleaseUploadRecipients', 'Please upload recipients first')}</p>
                  </div>
                ) : (
                  <ScrollArea className="h-full w-full">
                    <div className="space-y-2">
                      {parsedContacts.map((contact, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-2 bg-background rounded border" data-testid={`recipient-row-${idx}`}>
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{contact.phone_number}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-4 border-t">
            <Button variant="outline" onClick={handleClose} data-testid="button-save-draft">
              {t('campaigns.saveAsDraft', 'Save as draft')}
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createMutation.isPending || !formData.agentId || (isSipAgent ? (!isSipPluginEnabled || !formData.sipPhoneNumberId) : isRetellAgent ? !formData.phoneNumberId : !formData.phoneNumberId)}
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
