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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Bot,
  FileText,
  Users,
  Save,
  Loader2,
  Globe,
  Sparkles,
  Check,
  CheckCircle2,
  Circle,
  Search,
  Plus,
  ClipboardList,
  PhoneOutgoing,
  Send,
  LayoutTemplate,
  UserPlus,
  Filter,
  MapPin,
  FolderOpen,
} from "lucide-react";
import { FORM_TEMPLATES, FORM_TEMPLATE_CATEGORIES, type FormTemplate } from "@/data/form-templates";

const PHONE_COUNTRY_PREFIXES: [string, string, string][] = [
  ["+1", "US/CA", "🇺🇸"],
  ["+44", "UK", "🇬🇧"],
  ["+91", "India", "🇮🇳"],
  ["+61", "Australia", "🇦🇺"],
  ["+33", "France", "🇫🇷"],
  ["+49", "Germany", "🇩🇪"],
  ["+39", "Italy", "🇮🇹"],
  ["+34", "Spain", "🇪🇸"],
  ["+81", "Japan", "🇯🇵"],
  ["+86", "China", "🇨🇳"],
  ["+82", "S. Korea", "🇰🇷"],
  ["+55", "Brazil", "🇧🇷"],
  ["+52", "Mexico", "🇲🇽"],
  ["+7", "Russia", "🇷🇺"],
  ["+90", "Turkey", "🇹🇷"],
  ["+966", "Saudi Arabia", "🇸🇦"],
  ["+971", "UAE", "🇦🇪"],
  ["+27", "South Africa", "🇿🇦"],
  ["+234", "Nigeria", "🇳🇬"],
  ["+62", "Indonesia", "🇮🇩"],
  ["+60", "Malaysia", "🇲🇾"],
  ["+65", "Singapore", "🇸🇬"],
  ["+63", "Philippines", "🇵🇭"],
  ["+31", "Netherlands", "🇳🇱"],
  ["+46", "Sweden", "🇸🇪"],
  ["+47", "Norway", "🇳🇴"],
  ["+45", "Denmark", "🇩🇰"],
  ["+358", "Finland", "🇫🇮"],
  ["+48", "Poland", "🇵🇱"],
  ["+92", "Pakistan", "🇵🇰"],
  ["+20", "Egypt", "🇪🇬"],
  ["+212", "Morocco", "🇲🇦"],
  ["+254", "Kenya", "🇰🇪"],
  ["+251", "Ethiopia", "🇪🇹"],
  ["+54", "Argentina", "🇦🇷"],
  ["+56", "Chile", "🇨🇱"],
  ["+57", "Colombia", "🇨🇴"],
  ["+51", "Peru", "🇵🇪"],
  ["+66", "Thailand", "🇹🇭"],
  ["+84", "Vietnam", "🇻🇳"],
  ["+880", "Bangladesh", "🇧🇩"],
  ["+94", "Sri Lanka", "🇱🇰"],
  ["+353", "Ireland", "🇮🇪"],
  ["+41", "Switzerland", "🇨🇭"],
  ["+43", "Austria", "🇦🇹"],
  ["+32", "Belgium", "🇧🇪"],
  ["+351", "Portugal", "🇵🇹"],
  ["+30", "Greece", "🇬🇷"],
  ["+972", "Israel", "🇮🇱"],
  ["+964", "Iraq", "🇮🇶"],
];

const SORTED_PREFIXES = [...PHONE_COUNTRY_PREFIXES].sort((a, b) => b[0].length - a[0].length);

function getCountryFromPhone(phone: string): { name: string; flag: string } | null {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  for (const [prefix, name, flag] of SORTED_PREFIXES) {
    if (cleaned.startsWith(prefix)) return { name, flag };
  }
  return null;
}

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  friendlyName: string | null;
  provider: string;
}

interface Agent {
  id: string;
  name: string;
  type: string;
  language: string | null;
  voiceName: string | null;
  openaiVoice: string | null;
  systemPrompt: string | null;
  voiceTone: string | null;
  voiceProvider: string | null;
  telephonyProvider: string | null;
  awsPollyVoiceId: string | null;
}

interface DeduplicatedContact {
  id: string;
  phone: string;
  email: string | null;
  names: Array<{ firstName: string; lastName: string | null }>;
  campaigns: Array<{ id: string; name: string }>;
  status: string;
  source: string;
  callCount: number;
}

interface ContactGroup {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

interface GroupMembership {
  contact_phone: string;
  group_id: string;
  group_name: string;
  group_color: string;
}

interface FormItem {
  id: string;
  name: string;
  description: string | null;
  fields?: Array<{
    id: string;
    label: string;
    type: string;
    required: boolean;
    options: string[] | null;
    order: number;
  }>;
}

interface ExistingOutbound {
  id: string;
  name: string;
  agentId: string;
  phoneNumberId: string;
  contactCount: number;
  status: string;
  createdAt: string;
  agent?: { id: string; name: string; language?: string } | null;
  phoneNumber?: { id: string; phoneNumber: string } | null;
}

const getLanguageLabel = (code: string) => {
  const labels: Record<string, string> = {
    en: "English", ar: "Arabic", fr: "French", hi: "Hindi",
    it: "Italian", zh: "Chinese", es: "Spanish", de: "German",
    pt: "Portuguese", ja: "Japanese", ko: "Korean", ru: "Russian",
    nl: "Dutch", tr: "Turkish", pl: "Polish", sv: "Swedish",
  };
  return labels[code] || code.toUpperCase();
};

const STEPS = [
  { id: 1, label: "Contacts", icon: Users },
  { id: 2, label: "Phone Number", icon: Phone },
  { id: 3, label: "AI Agent", icon: Bot },
  { id: 4, label: "Script & Form", icon: FileText },
  { id: 5, label: "Review & Launch", icon: Send },
];

function OutboundWizard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [selectedPhoneId, setSelectedPhoneId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [agentSearch, setAgentSearch] = useState("");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [campaignName, setCampaignName] = useState("");
  const [callScript, setCallScript] = useState("");
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [selectedTemplateCategory, setSelectedTemplateCategory] = useState("All");
  const [templateSearch, setTemplateSearch] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);

  const { data: contactsData, isLoading: contactsLoading } = useQuery<DeduplicatedContact[]>({
    queryKey: ["/api/contacts/deduplicated"],
  });

  const { data: phoneNumbers = [], isLoading: phonesLoading } = useQuery<PhoneNumber[]>({
    queryKey: ["/api/phone-numbers"],
  });

  const { data: agents = [], isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const { data: forms = [], isLoading: formsLoading } = useQuery<FormItem[]>({
    queryKey: ["/api/flow-automation/forms"],
  });

  const { data: contactGroups = [] } = useQuery<ContactGroup[]>({
    queryKey: ["/api/contact-groups"],
  });

  const { data: groupMemberships = [] } = useQuery<GroupMembership[]>({
    queryKey: ["/api/contact-group-memberships"],
  });

  const contacts = contactsData || [];

  const contactGroupsByPhone = useMemo(() => {
    const map = new Map<string, GroupMembership[]>();
    groupMemberships.forEach((m) => {
      const existing = map.get(m.contact_phone) || [];
      existing.push(m);
      map.set(m.contact_phone, existing);
    });
    return map;
  }, [groupMemberships]);

  const contactCountryMap = useMemo(() => {
    const map = new Map<string, { name: string; flag: string } | null>();
    contacts.forEach((c) => {
      if (!map.has(c.id)) map.set(c.id, getCountryFromPhone(c.phone));
    });
    return map;
  }, [contacts]);

  const availableCountries = useMemo(() => {
    const countrySet = new Map<string, string>();
    contactCountryMap.forEach((val) => {
      if (val) countrySet.set(val.name, val.flag);
    });
    return Array.from(countrySet.entries())
      .map(([name, flag]) => ({ name, flag }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [contactCountryMap]);

  const filteredContacts = useMemo(() => {
    let result = contacts;
    if (groupFilter !== "all") {
      result = result.filter((c) => {
        const groups = contactGroupsByPhone.get(c.phone);
        return groups?.some((g) => g.group_id === groupFilter);
      });
    }
    if (countryFilter !== "all") {
      result = result.filter((c) => {
        const country = contactCountryMap.get(c.id);
        return country?.name === countryFilter;
      });
    }
    if (contactSearch.trim()) {
      const q = contactSearch.trim().toLowerCase();
      result = result.filter((c) => {
        const name = c.names?.[0]
          ? `${c.names[0].firstName} ${c.names[0].lastName || ""}`.trim()
          : "";
        return (
          c.phone.toLowerCase().includes(q) ||
          name.toLowerCase().includes(q) ||
          (c.email && c.email.toLowerCase().includes(q))
        );
      });
    }
    return result;
  }, [contacts, contactSearch, groupFilter, countryFilter, contactCountryMap, contactGroupsByPhone]);

  const availableLanguages = useMemo(() => {
    const langs = new Set<string>();
    agents.forEach((a) => {
      if (a.language) langs.add(a.language);
    });
    return Array.from(langs).sort();
  }, [agents]);

  const filteredAgents = useMemo(() => {
    let result = agents;
    if (languageFilter !== "all") {
      result = result.filter((a) => a.language === languageFilter);
    }
    if (agentSearch.trim()) {
      const q = agentSearch.trim().toLowerCase();
      result = result.filter((a) => a.name.toLowerCase().includes(q));
    }
    return result;
  }, [agents, languageFilter, agentSearch]);

  const filteredTemplates = useMemo(() => {
    let result = FORM_TEMPLATES;
    if (selectedTemplateCategory !== "All") {
      result = result.filter((t) => t.category === selectedTemplateCategory);
    }
    if (templateSearch.trim()) {
      const q = templateSearch.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      );
    }
    return result;
  }, [selectedTemplateCategory, templateSearch]);

  const selectedAgent = useMemo(() => {
    return agents.find((a) => a.id === selectedAgentId) || null;
  }, [agents, selectedAgentId]);

  const selectedPhone = useMemo(() => {
    return phoneNumbers.find((p) => p.id === selectedPhoneId) || null;
  }, [phoneNumbers, selectedPhoneId]);

  const selectedForm = useMemo(() => {
    return forms.find((f) => f.id === selectedFormId) || null;
  }, [forms, selectedFormId]);

  const selectedContacts = useMemo(() => {
    return contacts.filter((c) => selectedContactIds.includes(c.id));
  }, [contacts, selectedContactIds]);

  const toggleContact = (contactId: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    );
  };

  const selectAllContacts = () => {
    setSelectedContactIds(filteredContacts.map((c) => c.id));
  };

  const clearContacts = () => {
    setSelectedContactIds([]);
  };

  const canProceed = (step: number) => {
    switch (step) {
      case 1: return selectedContactIds.length > 0;
      case 2: return selectedPhoneId !== null;
      case 3: return selectedAgentId !== null;
      case 4: return true;
      case 5: return campaignName.trim().length > 0;
      default: return false;
    }
  };

  const goNext = () => {
    if (canProceed(currentStep) && currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const applyFormTemplate = (template: FormTemplate) => {
    const templateDescription = template.fields
      .map((f) => {
        let desc = `- ${f.label} (${f.type}${f.required ? ", required" : ""})`;
        if (f.options && f.options.length > 0) {
          desc += `: ${f.options.join(", ")}`;
        }
        return desc;
      })
      .join("\n");

    const scriptAddition = `\n\nDuring the call, collect the following information using this form:\nForm: ${template.name}\n${templateDescription}`;

    setCallScript((prev) => prev + scriptAddition);
    setShowTemplates(false);
    toast({
      title: "Template Applied",
      description: `"${template.name}" form fields added to your call script.`,
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAgentId) throw new Error("No agent selected");
      if (!selectedPhoneId) throw new Error("No phone number selected");
      if (selectedContactIds.length === 0) throw new Error("No contacts selected");
      if (!campaignName.trim()) throw new Error("Campaign name is required");

      const payload: Record<string, any> = {
        name: campaignName,
        type: "outbound",
        agentId: selectedAgentId,
        phoneNumberId: selectedPhoneId,
        script: callScript || null,
        selectedFormId: selectedFormId || undefined,
      };

      const res = await apiRequest("POST", "/api/campaigns", payload);
      const campaign = await res.json();

      if (campaign?.id && selectedContactIds.length > 0) {
        await apiRequest("POST", `/api/campaigns/${campaign.id}/contacts/assign`, {
          contactIds: selectedContactIds,
        });
      }

      if (campaign?.id) {
        await apiRequest("POST", `/api/campaigns/${campaign.id}/execute`);
      }

      return campaign;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/deduplicated"] });
      toast({
        title: "Campaign Launched",
        description: `"${campaignName}" is now calling ${selectedContactIds.length} contact(s).`,
      });
      if (data?.id) {
        setLocation(`/app/campaigns/${data.id}`);
      } else {
        setLocation("/app/campaigns");
      }
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to create outbound campaign",
        variant: "destructive",
      });
    },
  });

  const renderStepIndicator = () => (
    <div className="border-b bg-muted/30" data-testid="outbound-step-indicator">
      <div className="flex items-center justify-between px-1 py-2 sm:justify-center sm:gap-1 sm:py-3 sm:px-4">
        {STEPS.map((step, index) => {
          const isCompleted = currentStep > step.id;
          const isActive = currentStep === step.id;
          const StepIcon = step.icon;
          return (
            <div key={step.id} className="flex items-center flex-1 sm:flex-initial last:flex-initial">
              <button
                onClick={() => {
                  if (isCompleted) setCurrentStep(step.id);
                }}
                className={`flex items-center justify-center gap-1 sm:gap-1.5 w-full sm:w-auto px-1 sm:px-3 py-1.5 rounded-md text-[11px] sm:text-sm transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground font-medium"
                    : isCompleted
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 cursor-pointer"
                    : "bg-muted/60 text-muted-foreground"
                }`}
                disabled={!isCompleted && !isActive}
                data-testid={`button-outbound-step-${step.id}`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                ) : isActive ? (
                  <StepIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                ) : (
                  <Circle className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                )}
                <span className="hidden sm:inline">{step.label}</span>
              </button>
              {index < STEPS.length - 1 && (
                <div className={`w-2 sm:w-6 h-px mx-0.5 ${isCompleted ? "bg-green-400" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-4" data-testid="outbound-step-1">
      <div className="text-center mb-2">
        <h2 className="text-lg font-semibold">Select Contacts</h2>
        <p className="text-sm text-muted-foreground">Choose people from your contact list to call</p>
      </div>

      <div className="w-full max-w-2xl mx-auto space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={contactSearch}
            onChange={(e) => setContactSearch(e.target.value)}
            placeholder="Search name, phone, email..."
            className="pl-9 h-9 text-sm"
            data-testid="input-contact-search"
          />
        </div>

        {(contactGroups.length > 0 || availableCountries.length > 0) && (
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0 hidden sm:block" />
            {contactGroups.length > 0 && (
              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger className="w-full sm:w-[170px] h-8 text-xs" data-testid="select-group-filter">
                  <FolderOpen className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="All Tags" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tags</SelectItem>
                  {contactGroups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
                        {g.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {availableCountries.length > 0 && (
              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger className="w-full sm:w-[170px] h-8 text-xs" data-testid="select-country-filter">
                  <MapPin className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="All Countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  {availableCountries.map((c) => (
                    <SelectItem key={c.name} value={c.name}>{c.flag} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {(groupFilter !== "all" || countryFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs px-2"
                onClick={() => { setGroupFilter("all"); setCountryFilter("all"); }}
                data-testid="button-clear-filters"
              >
                Clear
              </Button>
            )}
          </div>
        )}

        {contactsLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-3">No contacts found. Add contacts first.</p>
            <Button variant="outline" size="sm" onClick={() => setLocation("/app/contacts")} data-testid="button-go-contacts">
              <UserPlus className="h-4 w-4 mr-1" />
              Go to Contacts
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm font-medium">
                {selectedContactIds.length} of {filteredContacts.length} selected
                {(groupFilter !== "all" || countryFilter !== "all") && (
                  <span className="text-muted-foreground font-normal ml-1">
                    (filtered from {contacts.length})
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={selectAllContacts} data-testid="button-select-all-contacts">
                  Select All
                </Button>
                {selectedContactIds.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearContacts} data-testid="button-clear-contacts">
                    Clear
                  </Button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto max-h-[50vh] sm:max-h-[400px] -mx-1 px-1">
              <div className="grid gap-1.5 sm:gap-2">
                {filteredContacts.map((contact) => {
                  const isSelected = selectedContactIds.includes(contact.id);
                  const displayName = contact.names?.[0]
                    ? `${contact.names[0].firstName} ${contact.names[0].lastName || ""}`.trim()
                    : "Unknown";

                  return (
                    <Card
                      key={contact.id}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? "border-primary bg-primary/5" : "hover:bg-accent/50"
                      }`}
                      onClick={() => toggleContact(contact.id)}
                      data-testid={`card-contact-${contact.id}`}
                    >
                      <CardContent className="p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3">
                        <div className={`flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-full flex-shrink-0 ${
                          isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                        }`}>
                          {isSelected ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <span className="text-xs font-medium">{displayName.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate flex items-center gap-1.5">
                            {displayName}
                            {(() => {
                              const country = contactCountryMap.get(contact.id);
                              return country ? (
                                <span className="text-xs" title={country.name}>{country.flag}</span>
                              ) : null;
                            })()}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {contact.phone}
                            </span>
                            {contact.email && (
                              <span className="truncate">{contact.email}</span>
                            )}
                          </div>
                          {(() => {
                            const groups = contactGroupsByPhone.get(contact.phone);
                            return groups && groups.length > 0 ? (
                              <div className="flex items-center gap-1 mt-1 flex-wrap">
                                {groups.slice(0, 3).map((g) => (
                                  <Badge key={g.group_id} variant="secondary" className="text-[10px] py-0 px-1.5 h-4 gap-1">
                                    <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: g.group_color }} />
                                    {g.group_name}
                                  </Badge>
                                ))}
                                {groups.length > 3 && (
                                  <span className="text-[10px] text-muted-foreground">
                                    +{groups.length - 3} more
                                  </span>
                                )}
                              </div>
                            ) : null;
                          })()}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {contact.callCount > 0 && (
                            <Badge variant="outline" className="text-[10px]">
                              {contact.callCount} call{contact.callCount > 1 ? "s" : ""}
                            </Badge>
                          )}
                          {(() => {
                            const country = contactCountryMap.get(contact.id);
                            return country ? (
                              <span className="text-[10px] text-muted-foreground">{country.name}</span>
                            ) : null;
                          })()}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4" data-testid="outbound-step-2">
      <div className="text-center mb-2">
        <h2 className="text-lg font-semibold">Select Caller ID</h2>
        <p className="text-sm text-muted-foreground">Choose the phone number for outbound calls</p>
      </div>

      {phonesLoading ? (
        <div className="space-y-3 w-full max-w-2xl mx-auto">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : phoneNumbers.length === 0 ? (
        <div className="text-center py-8">
          <Phone className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">No phone numbers available. Purchase one first.</p>
          <Button variant="outline" size="sm" onClick={() => setLocation("/app/phone-numbers")} data-testid="button-buy-numbers">
            <Plus className="h-4 w-4 mr-1" />
            Buy Phone Number
          </Button>
        </div>
      ) : (
        <div className="w-full max-w-2xl mx-auto grid gap-2 grid-cols-1 sm:grid-cols-2">
          {phoneNumbers.map((phone) => {
            const isSelected = selectedPhoneId === phone.id;
            return (
              <Card
                key={phone.id}
                className={`cursor-pointer transition-colors ${
                  isSelected ? "border-primary bg-primary/5" : "hover:bg-accent/50"
                }`}
                onClick={() => setSelectedPhoneId(phone.id)}
                data-testid={`card-phone-${phone.id}`}
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
        </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4" data-testid="outbound-step-3">
      <div className="text-center mb-2">
        <h2 className="text-lg font-semibold">Select AI Agent</h2>
        <p className="text-sm text-muted-foreground">Choose the AI agent that will make outbound calls to your contacts</p>
      </div>

      <div className="w-full max-w-2xl mx-auto space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={agentSearch}
            onChange={(e) => setAgentSearch(e.target.value)}
            placeholder="Search agents..."
            className="pl-9 h-9 text-sm"
            data-testid="input-agent-search"
          />
        </div>

        {availableLanguages.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <Select value={languageFilter} onValueChange={setLanguageFilter}>
              <SelectTrigger className="w-full sm:w-[160px] h-8 text-xs" data-testid="select-language-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Languages</SelectItem>
                {availableLanguages.map((lang) => (
                  <SelectItem key={lang} value={lang}>{getLanguageLabel(lang)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {agentsLoading ? (
        <div className="space-y-3 w-full max-w-2xl mx-auto">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="text-center py-8">
          <Bot className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {agentSearch.trim()
              ? `No agents match "${agentSearch.trim()}"`
              : languageFilter !== "all"
              ? `No agents available for ${getLanguageLabel(languageFilter)}`
              : "No agents available. Create an agent first."}
          </p>
        </div>
      ) : (
        <div className="w-full max-w-2xl mx-auto grid gap-2 grid-cols-1 sm:grid-cols-2">
          {filteredAgents.map((agent) => {
            const isSelected = selectedAgentId === agent.id;
            return (
              <Card
                key={agent.id}
                className={`cursor-pointer transition-colors ${
                  isSelected ? "border-primary bg-primary/5" : "hover:bg-accent/50"
                }`}
                onClick={() => setSelectedAgentId(agent.id)}
                data-testid={`card-agent-${agent.id}`}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <div className={`flex items-center justify-center h-10 w-10 rounded-md flex-shrink-0 ${
                    isSelected ? "bg-primary text-primary-foreground" : "bg-blue-100 dark:bg-blue-900/30"
                  }`}>
                    {isSelected ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Bot className="h-5 w-5 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{agent.name}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {agent.voiceProvider === 'aws_polly' ? (
                        <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20">
                          AWS Polly
                        </Badge>
                      ) : agent.telephonyProvider === 'twilio_openai' ? (
                        <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                          OpenAI Realtime
                        </Badge>
                      ) : agent.telephonyProvider === 'plivo' ? (
                        <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">
                          Plivo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                          ElevenLabs
                        </Badge>
                      )}
                      {agent.language && (
                        <Badge variant="outline" className="text-[10px]">
                          {getLanguageLabel(agent.language)}
                        </Badge>
                      )}
                      {agent.voiceName && (
                        <span className="text-xs text-muted-foreground">{agent.voiceName}</span>
                      )}
                      {agent.awsPollyVoiceId && (
                        <span className="text-xs text-muted-foreground">{agent.awsPollyVoiceId}</span>
                      )}
                    </div>
                    {agent.systemPrompt && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{agent.systemPrompt}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-5" data-testid="outbound-step-4">
      <div className="text-center mb-2">
        <h2 className="text-lg font-semibold">Call Script & Form</h2>
        <p className="text-sm text-muted-foreground">Configure what the AI agent says and collects during outbound calls</p>
      </div>

      <div className="w-full max-w-2xl mx-auto space-y-5">
        <div className="space-y-2">
          <Label className="font-medium text-sm">Call Script / System Prompt</Label>
          <Textarea
            value={callScript}
            onChange={(e) => setCallScript(e.target.value)}
            placeholder="Write the call script or system prompt for the AI agent. Describe how the agent should greet the contact, what information to share, and what to collect..."
            className="min-h-[140px] text-sm"
            data-testid="textarea-call-script"
          />
          <p className="text-xs text-muted-foreground">
            This prompt guides the AI agent's behavior during each outbound call.
          </p>
        </div>

        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-indigo-600" />
              <Label className="font-medium">Quick Add Templates (Forms)</Label>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTemplates(!showTemplates)}
              data-testid="button-toggle-templates"
            >
              <LayoutTemplate className="h-3.5 w-3.5 mr-1" />
              {showTemplates ? "Hide Templates" : "Browse Templates"}
            </Button>
          </div>

          {showTemplates && (
            <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    placeholder="Search templates..."
                    className="pl-9 h-8 text-sm"
                    data-testid="input-template-search"
                  />
                </div>
                <Select value={selectedTemplateCategory} onValueChange={setSelectedTemplateCategory}>
                  <SelectTrigger className="w-[160px] h-8 text-sm" data-testid="select-template-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORM_TEMPLATE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="overflow-y-auto max-h-[240px]">
                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                  {filteredTemplates.map((template) => (
                    <Card
                      key={template.id}
                      className="cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => applyFormTemplate(template)}
                      data-testid={`card-template-${template.id}`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-2">
                          <div className="flex items-center justify-center h-7 w-7 rounded flex-shrink-0 bg-indigo-100 dark:bg-indigo-900/30">
                            <ClipboardList className="h-3.5 w-3.5 text-indigo-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm truncate">{template.name}</div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{template.description}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <Badge variant="outline" className="text-[10px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20">
                                {template.category}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">{template.fields.length} fields</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {filteredTemplates.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No templates match your search
                </p>
              )}
            </div>
          )}
        </div>

        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-emerald-600" />
            <Label className="font-medium">Attach Existing Form (Optional)</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Select an existing form to collect structured data during outbound calls.
          </p>

          {formsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : forms.length === 0 ? (
            <div className="text-center py-4 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
              <FileText className="h-6 w-6 mx-auto mb-2 opacity-50" />
              <p>No forms available.</p>
              <Button variant="ghost" size="sm" className="mt-1" onClick={() => setLocation("/app/forms")} data-testid="button-go-forms">
                Create a Form
              </Button>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[200px]">
              <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                {forms.map((form) => {
                  const isSelected = selectedFormId === form.id;
                  return (
                    <Card
                      key={form.id}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? "border-emerald-500 bg-emerald-500/5" : "hover:bg-accent/50"
                      }`}
                      onClick={() => setSelectedFormId(isSelected ? null : form.id)}
                      data-testid={`card-form-${form.id}`}
                    >
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className={`flex items-center justify-center h-8 w-8 rounded-md flex-shrink-0 ${
                          isSelected ? "bg-emerald-500 text-white" : "bg-emerald-100 dark:bg-emerald-900/30"
                        }`}>
                          {isSelected ? <Check className="h-4 w-4" /> : <FileText className="h-4 w-4 text-emerald-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{form.name}</div>
                          {form.description && (
                            <p className="text-xs text-muted-foreground truncate">{form.description}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6" data-testid="outbound-step-5">
      <div className="text-center mb-2">
        <h2 className="text-lg font-semibold">Review & Launch</h2>
        <p className="text-sm text-muted-foreground">Review your outbound campaign configuration before launching</p>
      </div>

      <div className="w-full max-w-2xl mx-auto space-y-4">
        <div className="space-y-2">
          <Label className="font-medium text-sm">Campaign Name *</Label>
          <Input
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            placeholder="e.g., Q1 Sales Follow-up, Product Launch Calls..."
            data-testid="input-campaign-name"
          />
        </div>

        <Card>
          <CardContent className="p-3 sm:p-4 space-y-3 sm:space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-violet-600" />
                <span className="font-medium text-sm">Contacts ({selectedContacts.length})</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {selectedContacts.slice(0, 5).map((contact) => {
                  const name = contact.names?.[0]
                    ? `${contact.names[0].firstName} ${contact.names[0].lastName || ""}`.trim()
                    : contact.phone;
                  return (
                    <Badge key={contact.id} variant="outline" className="border-violet-300 text-violet-700 dark:text-violet-400">
                      {name}
                    </Badge>
                  );
                })}
                {selectedContacts.length > 5 && (
                  <Badge variant="outline" className="border-violet-300 text-violet-700 dark:text-violet-400 text-[10px]">
                    +{selectedContacts.length - 5} more
                  </Badge>
                )}
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="h-4 w-4 text-green-600" />
                <span className="font-medium text-sm">Caller ID</span>
              </div>
              {selectedPhone && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-md">
                    <Phone className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{selectedPhone.phoneNumber}</div>
                    <div className="text-xs text-muted-foreground">{selectedPhone.provider}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-sm">AI Agent</span>
              </div>
              {selectedAgent && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-md">
                    <Bot className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{selectedAgent.name}</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedAgent.voiceProvider === 'aws_polly' ? (
                        <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20">
                          AWS Polly
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                          ElevenLabs
                        </Badge>
                      )}
                      {selectedAgent.language && (
                        <Badge variant="outline" className="text-[10px]">{getLanguageLabel(selectedAgent.language)}</Badge>
                      )}
                      {selectedAgent.voiceName && (
                        <span className="text-xs text-muted-foreground">{selectedAgent.voiceName}</span>
                      )}
                      {selectedAgent.awsPollyVoiceId && (
                        <span className="text-xs text-muted-foreground">{selectedAgent.awsPollyVoiceId}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {callScript && (
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-purple-600" />
                  <span className="font-medium text-sm">Call Script</span>
                </div>
                <div className="bg-muted rounded-md p-3 text-sm max-h-[120px] overflow-y-auto">
                  {callScript.slice(0, 400)}{callScript.length > 400 ? "..." : ""}
                </div>
              </div>
            )}

            {selectedForm && (
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <ClipboardList className="h-4 w-4 text-emerald-600" />
                  <span className="font-medium text-sm">Attached Form</span>
                </div>
                <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:text-emerald-400">
                  <FileText className="h-3 w-3 mr-1" />
                  {selectedForm.name}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="bg-muted/50 rounded-md p-3 text-sm text-muted-foreground">
          This will create an outbound campaign named <span className="font-medium text-foreground">"{campaignName || "..."}"</span> that
          calls {selectedContactIds.length} contact(s) using <span className="font-medium text-foreground">{selectedAgent?.name}</span> from{" "}
          <span className="font-medium text-foreground">{selectedPhone?.phoneNumber}</span>.
          {callScript ? " A custom call script will be used." : ""}
          {selectedForm ? ` Form "${selectedForm.name}" will collect data.` : ""}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col" style={{ height: '100dvh' }}>
      <div className="flex items-center px-3 sm:px-4 py-2 sm:py-3 border-b bg-background gap-2 flex-shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3 flex-shrink-0" onClick={() => setLocation("/app/campaigns")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline ml-1">Back</span>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold flex items-center gap-1.5 text-sm sm:text-base truncate">
            <PhoneOutgoing className="h-4 w-4 text-primary flex-shrink-0" />
            New Outbound Campaign
          </h1>
        </div>
        <span className="text-xs text-muted-foreground flex-shrink-0 sm:hidden">
          {currentStep}/5
        </span>
      </div>

      <div className="flex-shrink-0">
        {renderStepIndicator()}
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="px-3 sm:px-4 py-4 pb-6">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
          {currentStep === 5 && renderStep5()}
        </div>
      </div>

      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-t bg-background gap-3 flex-shrink-0 safe-area-bottom">
        <Button
          variant="outline"
          size="sm"
          className="h-9 px-3 text-xs sm:text-sm"
          onClick={() => {
            if (currentStep === 1) {
              setLocation("/app/campaigns");
            } else {
              goBack();
            }
          }}
          data-testid="button-wizard-back"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {currentStep === 1 ? "Cancel" : "Back"}
        </Button>

        <div className="flex items-center gap-2">
          {currentStep < 5 ? (
            <Button
              size="sm"
              className="h-9 px-4 text-xs sm:text-sm"
              onClick={goNext}
              disabled={!canProceed(currentStep)}
              data-testid="button-wizard-next"
            >
              Next
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-9 px-4 text-xs sm:text-sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !campaignName.trim() || !selectedAgentId || !selectedPhoneId || selectedContactIds.length === 0}
              data-testid="button-wizard-save"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              Launch
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OutboundCanvas() {
  return <OutboundWizard />;
}
