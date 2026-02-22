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
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, FileText, Trash2, Eye, GripVertical, X, ClipboardList, Download, ExternalLink, ChevronRight, Search, LayoutTemplate, ArrowLeft, Sparkles, Calendar, Phone, Pencil, Plug, Webhook, Mail, Globe, Users, Check, Loader2, Copy } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { Link } from "wouter";
import { AuthStorage } from "@/lib/auth-storage";
import { FORM_TEMPLATES, FORM_TEMPLATE_CATEGORIES, type FormTemplate } from "@/data/form-templates";

interface Form {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  createdAt: string;
  submissionCount?: number;
  uniqueContacts?: number;
  totalResponses?: number;
  latestSubmission?: string | null;
}

interface FormField {
  id: string;
  formId: string;
  label: string;
  type: string;
  required: boolean;
  options: string[] | null;
  order: number;
}

interface FormSubmissionResponse {
  fieldId: string;
  question: string;
  answer: string;
}

interface FormSubmission {
  id: string;
  formId: string;
  callId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  responses: FormSubmissionResponse[] | null;
  submittedAt: string;
}

interface FormWithFields extends Form {
  fields: FormField[];
}

interface FormIntegration {
  id: string;
  form_id: string;
  type: string;
  enabled: boolean;
  config: Record<string, any>;
}

interface IntegrationTypeConfig {
  type: string;
  icon: any;
  title: string;
  description: string;
  color: string;
  configFields: { key: string; label: string; placeholder: string; type?: string }[];
}

function ConfigTextInput({ label, placeholder, initialValue, onSave, saving, testId }: {
  label: string;
  placeholder: string;
  initialValue: string;
  onSave: (value: string) => void;
  saving: boolean;
  testId: string;
}) {
  const [value, setValue] = useState(initialValue);
  const save = () => {
    if (value !== initialValue) onSave(value);
  };
  return (
    <div>
      <Label className="text-xs font-normal text-muted-foreground mb-1.5 block">{label}</Label>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="h-9 text-xs rounded-lg"
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") save(); }}
        disabled={saving}
        data-testid={testId}
      />
    </div>
  );
}

function FormIntegrationsView({ form, onBack }: { form: Form; onBack: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const integrationTypes: IntegrationTypeConfig[] = [
    {
      type: "webhook",
      icon: Webhook,
      title: t("forms.integrations.webhook", "Webhook"),
      description: t("forms.integrations.webhookDesc", "Send form submission data to a custom URL via POST request"),
      color: "text-orange-500",
      configFields: [
        { key: "url", label: t("forms.integrations.webhookUrl", "Webhook URL"), placeholder: "https://api.example.com/webhook" },
        { key: "secret", label: t("forms.integrations.webhookSecret", "Secret (optional)"), placeholder: "whsec_..." },
      ],
    },
    {
      type: "crm_sync",
      icon: Users,
      title: t("forms.integrations.crmSync", "CRM Sync"),
      description: t("forms.integrations.crmSyncDesc", "Automatically create or update leads in your CRM from form responses"),
      color: "text-blue-500",
      configFields: [
        { key: "createLead", label: t("forms.integrations.autoCreateLead", "Auto-create lead on submission"), placeholder: "", type: "toggle" },
        { key: "nameField", label: t("forms.integrations.nameFieldMapping", "Name field mapping"), placeholder: "Select form field for contact name" },
        { key: "phoneField", label: t("forms.integrations.phoneFieldMapping", "Phone field mapping"), placeholder: "Select form field for phone" },
      ],
    },
    {
      type: "email_notification",
      icon: Mail,
      title: t("forms.integrations.emailNotification", "Email Notification"),
      description: t("forms.integrations.emailNotificationDesc", "Send an email with form responses when a new submission is received"),
      color: "text-green-500",
      configFields: [
        { key: "recipients", label: t("forms.integrations.recipients", "Recipients (comma-separated)"), placeholder: "admin@company.com, team@company.com" },
        { key: "subject", label: t("forms.integrations.emailSubject", "Email Subject"), placeholder: "New form submission: {{formName}}" },
      ],
    },
    {
      type: "api_endpoint",
      icon: Globe,
      title: t("forms.integrations.apiEndpoint", "API Endpoint"),
      description: t("forms.integrations.apiEndpointDesc", "Generate a public API endpoint to receive external submissions into this form"),
      color: "text-purple-500",
      configFields: [
        { key: "apiKey", label: t("forms.integrations.apiKey", "API Key"), placeholder: "Auto-generated", type: "readonly" },
      ],
    },
  ];

  const { data: integrationData, isLoading } = useQuery<{ integrations: FormIntegration[]; fields: FormField[] }>({
    queryKey: [`/api/flow-automation/forms/${form.id}/integrations`],
  });

  const saveMutation = useMutation({
    mutationFn: async ({ type, enabled, config }: { type: string; enabled: boolean; config: Record<string, any> }) => {
      const res = await apiRequest("PUT", `/api/flow-automation/forms/${form.id}/integrations/${type}`, { enabled, config });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/flow-automation/forms/${form.id}/integrations`] });
      toast({ title: t("forms.integrations.saved", "Integration saved") });
    },
    onError: (error: any) => {
      toast({ title: t("forms.integrations.saveFailed", "Failed to save integration"), description: error.message, variant: "destructive" });
    },
  });

  const getIntegrationState = (type: string): { enabled: boolean; config: Record<string, any> } => {
    const existing = integrationData?.integrations?.find((i) => i.type === type);
    return {
      enabled: existing?.enabled ?? false,
      config: existing?.config ?? {},
    };
  };

  const handleToggle = (type: string, enabled: boolean) => {
    const current = getIntegrationState(type);
    let config = { ...current.config };
    if (type === "api_endpoint" && enabled && !config.apiKey) {
      config.apiKey = `fk_${form.id.slice(0, 8)}_${Math.random().toString(36).slice(2, 10)}`;
    }
    saveMutation.mutate({ type, enabled, config });
  };

  const handleConfigChange = (type: string, key: string, value: string) => {
    const current = getIntegrationState(type);
    saveMutation.mutate({ type, enabled: current.enabled, config: { ...current.config, [key]: value } });
  };

  const formFields = integrationData?.fields || [];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: t("forms.integrations.copied", "Copied to clipboard") });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onBack} data-testid="button-back-from-integrations">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold truncate" data-testid="text-integrations-title">
            {t("forms.integrations.title", "Integration Points")}
          </h2>
          <p className="text-sm text-muted-foreground font-light truncate">{form.name} · #{form.id.slice(0, 8).toUpperCase()}</p>
        </div>
      </div>

      {formFields.length > 0 && (
        <div className="rounded-2xl bg-card border p-4 mb-5">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3" data-testid="text-form-fields-header">
            {t("forms.integrations.formFieldsData", "Form Fields Data")}
          </h3>
          <div className="flex flex-wrap gap-2">
            {formFields.map((field) => (
              <Badge key={field.id} variant="secondary" className="rounded-full text-xs font-normal px-2.5 py-1" data-testid={`badge-field-${field.id}`}>
                {field.label || (field as any).question}
                <span className="ml-1.5 text-muted-foreground/50 text-[10px]">{field.type || (field as any).fieldType}</span>
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {integrationTypes.map((intType) => {
          const state = getIntegrationState(intType.type);
          const Icon = intType.icon;
          return (
            <div key={intType.type} className="rounded-2xl bg-card border overflow-hidden" data-testid={`card-integration-${intType.type}`}>
              <div className="flex items-center gap-3.5 px-4 py-3.5">
                <div className={`h-10 w-10 rounded-[12px] bg-muted/50 flex items-center justify-center shrink-0`}>
                  <Icon className={`h-[18px] w-[18px] ${intType.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-[14px] leading-tight">{intType.title}</div>
                  <div className="text-[11px] text-muted-foreground/60 font-light mt-0.5">{intType.description}</div>
                </div>
                <Switch
                  checked={state.enabled}
                  onCheckedChange={(checked) => handleToggle(intType.type, checked)}
                  disabled={saveMutation.isPending}
                  data-testid={`switch-integration-${intType.type}`}
                />
              </div>

              {state.enabled && (
                <div className="px-4 pb-4 pt-1 border-t border-border/50">
                  <div className="space-y-3 mt-3">
                    {intType.configFields.map((cf) => {
                      if (cf.type === "toggle") {
                        return (
                          <div key={cf.key} className="flex items-center justify-between">
                            <Label className="text-xs font-normal text-muted-foreground">{cf.label}</Label>
                            <Switch
                              checked={state.config[cf.key] === true || state.config[cf.key] === "true"}
                              onCheckedChange={(checked) => handleConfigChange(intType.type, cf.key, String(checked))}
                              disabled={saveMutation.isPending}
                              data-testid={`switch-config-${intType.type}-${cf.key}`}
                            />
                          </div>
                        );
                      }
                      if (cf.type === "readonly") {
                        const val = state.config[cf.key] || cf.placeholder;
                        return (
                          <div key={cf.key}>
                            <Label className="text-xs font-normal text-muted-foreground mb-1.5 block">{cf.label}</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                value={val}
                                readOnly
                                className="h-9 text-xs rounded-lg bg-muted/30 font-mono"
                                data-testid={`input-config-${intType.type}-${cf.key}`}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-lg shrink-0"
                                onClick={() => copyToClipboard(val)}
                                data-testid={`button-copy-${intType.type}-${cf.key}`}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <ConfigTextInput
                          key={`${intType.type}-${cf.key}`}
                          label={cf.label}
                          placeholder={cf.placeholder}
                          initialValue={state.config[cf.key] || ""}
                          onSave={(value) => handleConfigChange(intType.type, cf.key, value)}
                          saving={saveMutation.isPending}
                          testId={`input-config-${intType.type}-${cf.key}`}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function FormsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [currentView, setCurrentView] = useState<"list" | "templates" | "submissions" | "integrations">("list");
  const [editorDialogOpen, setEditorDialogOpen] = useState(false);
  const [submissionSearch, setSubmissionSearch] = useState("");
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });
  const [fields, setFields] = useState<Array<{
    tempId: string;
    label: string;
    type: string;
    required: boolean;
    options: string;
  }>>([]);

  const [editingFormForId, setEditingFormForId] = useState<string | null>(null);
  const [formSearch, setFormSearch] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const filteredTemplates = useMemo(() => {
    return FORM_TEMPLATES.filter((tpl) => {
      const matchCategory = selectedCategory === "All" || tpl.category === selectedCategory;
      const matchSearch = !templateSearch || 
        tpl.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
        tpl.description.toLowerCase().includes(templateSearch.toLowerCase()) ||
        tpl.category.toLowerCase().includes(templateSearch.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [selectedCategory, templateSearch]);

  const categoryCountMap = useMemo(() => {
    const map: Record<string, number> = { All: FORM_TEMPLATES.length };
    FORM_TEMPLATES.forEach((tpl) => {
      map[tpl.category] = (map[tpl.category] || 0) + 1;
    });
    return map;
  }, []);

  const handleSelectTemplate = (template: FormTemplate) => {
    setFormData({
      name: template.name,
      description: template.description,
    });
    setFields(
      template.fields.map((f, i) => ({
        tempId: `temp-${Date.now()}-${i}`,
        label: f.label,
        type: f.type,
        required: f.required,
        options: f.options ? f.options.join(", ") : "",
      }))
    );
    setEditorDialogOpen(true);
  };

  const handleStartFromScratch = () => {
    setFormData({ name: "", description: "" });
    setFields([]);
    setEditorDialogOpen(true);
  };

  const fieldTypeOptions = [
    { value: "text", label: t("forms.fieldTypes.text") },
    { value: "yes_no", label: t("forms.fieldTypes.yesNo") },
    { value: "multiple_choice", label: t("forms.fieldTypes.multipleChoice") },
    { value: "number", label: t("forms.fieldTypes.number") },
  ];

  const { data: forms = [], isLoading } = useQuery<Form[]>({
    queryKey: ["/api/flow-automation/forms"],
  });

  const { data: submissions = [] } = useQuery<FormSubmission[]>({
    queryKey: [`/api/flow-automation/forms/${selectedForm?.id}/submissions`],
    enabled: !!selectedForm?.id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const mappedFields = fields.map((field, index) => {
        let options = null;
        if (field.type === "multiple_choice" && field.options.trim()) {
          options = field.options.split(",").map((o) => o.trim()).filter(Boolean);
        }
        return {
          question: field.label,
          fieldType: field.type,
          isRequired: field.required,
          options,
          order: index,
        };
      });

      const formRes = await apiRequest("POST", "/api/flow-automation/forms", {
        name: formData.name,
        description: formData.description || null,
        fields: mappedFields,
      });
      const newForm = await formRes.json();

      return newForm;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flow-automation/forms"] });
      toast({ title: t("forms.toast.created") });
      handleCloseEditor();
      handleBackToList();
    },
    onError: (error: any) => {
      toast({
        title: t("forms.toast.createFailed"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/flow-automation/forms/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flow-automation/forms"] });
      toast({ title: t("forms.toast.deleted") });
    },
    onError: (error: any) => {
      toast({
        title: t("forms.toast.deleteFailed"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingFormForId) return;
      const mappedFields = fields.map((field, index) => {
        let options = null;
        if (field.type === "multiple_choice" && field.options.trim()) {
          options = field.options.split(",").map((o) => o.trim()).filter(Boolean);
        }
        return {
          question: field.label,
          fieldType: field.type,
          isRequired: field.required,
          options,
          order: index,
        };
      });

      await apiRequest("PATCH", `/api/flow-automation/forms/${editingFormForId}`, {
        name: formData.name,
        description: formData.description || null,
        fields: mappedFields,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flow-automation/forms"] });
      toast({ title: t("forms.toast.updated") });
      handleCloseEditor();
    },
    onError: (error: any) => {
      toast({
        title: t("forms.toast.updateFailed"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEditForm = (form: Form) => {
    const formWithFields = form as any;
    setEditingFormForId(form.id);
    setFormData({
      name: form.name,
      description: form.description || "",
    });
    setFields(
      (formWithFields.fields || []).map((f: any, i: number) => ({
        tempId: `temp-${Date.now()}-${i}`,
        label: f.question,
        type: f.fieldType,
        required: f.isRequired ?? true,
        options: f.options ? (Array.isArray(f.options) ? f.options.join(", ") : f.options) : "",
      }))
    );
    setEditorDialogOpen(true);
  };

  const handleCloseEditor = () => {
    setEditorDialogOpen(false);
    setEditingFormForId(null);
    setFormData({ name: "", description: "" });
    setFields([]);
  };

  const handleBackToList = () => {
    setCurrentView("list");
    setTemplateSearch("");
    setSelectedCategory("All");
    setSubmissionSearch("");
    setSelectedForm(null);
  };

  const filteredSubmissions = useMemo(() => {
    if (!submissionSearch) return submissions;
    const q = submissionSearch.toLowerCase();
    return submissions.filter((sub) => {
      if (sub.contactName?.toLowerCase().includes(q)) return true;
      if (sub.contactPhone?.toLowerCase().includes(q)) return true;
      if (sub.callId?.toLowerCase().includes(q)) return true;
      if ((sub.responses || []).some(r => (r.answer || "").toLowerCase().includes(q) || (r.question || "").toLowerCase().includes(q))) return true;
      return false;
    });
  }, [submissions, submissionSearch]);

  const filteredForms = useMemo(() => {
    if (!formSearch) return forms;
    const q = formSearch.toLowerCase();
    return forms.filter((form) => {
      if (form.name.toLowerCase().includes(q)) return true;
      if (form.description?.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [forms, formSearch]);

  const addField = () => {
    setFields([
      ...fields,
      {
        tempId: `temp-${Date.now()}`,
        label: "",
        type: "text",
        required: false,
        options: "",
      },
    ]);
  };

  const updateField = (tempId: string, updates: Partial<typeof fields[0]>) => {
    setFields(fields.map((f) => (f.tempId === tempId ? { ...f, ...updates } : f)));
  };

  const removeField = (tempId: string) => {
    setFields(fields.filter((f) => f.tempId !== tempId));
  };

  const moveField = (tempId: string, direction: "up" | "down") => {
    const index = fields.findIndex((f) => f.tempId === tempId);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === fields.length - 1) return;

    const newFields = [...fields];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    [newFields[index], newFields[swapIndex]] = [newFields[swapIndex], newFields[index]];
    setFields(newFields);
  };

  const handleViewSubmissions = (form: Form) => {
    setSelectedForm(form);
    setSubmissionSearch("");
    setCurrentView("submissions");
  };

  const handleViewIntegrations = (form: Form) => {
    setSelectedForm(form);
    setCurrentView("integrations");
  };

  const handleDownloadCSV = () => {
    if (!selectedForm || submissions.length === 0) return;
    
    const headers = ["Submission ID", "Contact Name", "Contact Phone", "Submitted At"];
    const allQuestions = new Set<string>();
    submissions.forEach(sub => {
      (sub.responses || []).forEach(r => allQuestions.add(r.question));
    });
    const questionHeaders = Array.from(allQuestions);
    headers.push(...questionHeaders);
    
    const rows = submissions.map(sub => {
      const row: string[] = [
        sub.id,
        sub.contactName || "N/A",
        sub.contactPhone || "N/A",
        format(new Date(sub.submittedAt), "yyyy-MM-dd HH:mm:ss"),
      ];
      
      questionHeaders.forEach(question => {
        const response = (sub.responses || []).find(r => r.question === question);
        row.push(response ? response.answer : "");
      });
      
      return row;
    });
    
    const escapeCSV = (val: string) => {
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };
    
    const csvContent = [
      headers.map(escapeCSV).join(","),
      ...rows.map(row => row.map(escapeCSV).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${selectedForm.name.replace(/[^a-z0-9]/gi, "_")}_submissions_${format(new Date(), "yyyyMMdd")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    
    toast({ title: t("forms.toast.downloadSuccess") });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-5 w-5 border-2 border-foreground/20 border-t-foreground/70 rounded-full" />
      </div>
    );
  }

  const renderSubmissionsPage = () => {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBackToList}
              data-testid="button-back-from-submissions"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground" data-testid="text-submissions-title">
                {t("forms.formSubmissions")}
              </h1>
              <p className="text-sm text-muted-foreground mt-1 font-light">{selectedForm?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {submissions.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadCSV}
                data-testid="button-download-csv"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                {t("forms.downloadCSV")}
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("forms.searchSubmissions")}
              value={submissionSearch}
              onChange={(e) => setSubmissionSearch(e.target.value)}
              className="pl-9"
              data-testid="input-submission-search"
            />
          </div>
          <div className="text-xs text-muted-foreground font-light shrink-0">
            {filteredSubmissions.length} / {submissions.length} {t("forms.records")}
          </div>
        </div>

        {filteredSubmissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <ClipboardList className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="text-base font-medium mb-1">{t("forms.noSubmissions")}</h3>
            <p className="text-sm text-muted-foreground max-w-sm font-light">
              {submissionSearch ? t("forms.noSubmissionsSearch") : t("forms.noSubmissionsYet")}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSubmissions.map((submission, idx) => (
              <Card key={submission.id} className="hover-elevate" data-testid={`card-submission-${submission.id}`}>
                <CardContent className="p-0">
                  <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-semibold text-primary">#{idx + 1}</span>
                        </div>
                        <div>
                          <div className="text-sm font-medium" data-testid={`text-submission-contact-${submission.id}`}>
                            {submission.contactName || t("forms.anonymousContact")}
                          </div>
                          {submission.contactPhone && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground font-light">
                              <Phone className="h-3 w-3" />
                              {submission.contactPhone}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {submission.callId && (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          data-testid={`button-view-call-${submission.id}`}
                        >
                          <Link href={`/app/calls/${submission.callId}`}>
                            <ExternalLink className="h-3 w-3 mr-1" />
                            {t("forms.viewCall")}
                          </Link>
                        </Button>
                      )}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-light">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(submission.submittedAt), "MMM d, yyyy h:mm a")}
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                      {(submission.responses || []).map((response, rIdx) => (
                        <div key={rIdx} className="space-y-1" data-testid={`text-response-${submission.id}-${rIdx}`}>
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{response.question}</div>
                          <div className="text-sm">{response.answer || t("forms.noData")}</div>
                        </div>
                      ))}
                    </div>
                    {(!submission.responses || submission.responses.length === 0) && (
                      <p className="text-sm text-muted-foreground font-light italic">{t("forms.noResponseData")}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderTemplateGallery = () => (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBackToList}
              data-testid="button-back-to-list"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2" data-testid="text-template-gallery-title">
                <LayoutTemplate className="h-5 w-5" />
                {t("forms.chooseTemplate")}
              </h1>
              <p className="text-sm text-muted-foreground mt-1 font-light">{t("forms.chooseTemplateDescription")}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleStartFromScratch}
            data-testid="button-start-from-scratch"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            {t("forms.startFromScratch")}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("forms.searchTemplates")}
            value={templateSearch}
            onChange={(e) => setTemplateSearch(e.target.value)}
            className="pl-9"
            data-testid="input-template-search"
          />
        </div>
        <div className="text-xs text-muted-foreground font-light shrink-0">
          {filteredTemplates.length} / {FORM_TEMPLATES.length} {t("forms.templatesAvailable")}
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {FORM_TEMPLATE_CATEGORIES.map((cat) => (
          <Button
            key={cat}
            variant={selectedCategory === cat ? "default" : "outline"}
            size="sm"
            className="text-xs"
            onClick={() => setSelectedCategory(cat)}
            data-testid={`button-category-${cat.replace(/[^a-zA-Z]/g, "-").toLowerCase()}`}
          >
            {cat}
            <span className="ml-1 opacity-60">({categoryCountMap[cat] || 0})</span>
          </Button>
        ))}
      </div>

      {filteredTemplates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Search className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground font-light">{t("forms.noTemplatesFound")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredTemplates.map((template) => (
            <Card
              key={template.id}
              className="group cursor-pointer hover-elevate"
              onClick={() => handleSelectTemplate(template)}
              data-testid={`card-template-${template.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{template.name}</div>
                    <div className="text-xs text-muted-foreground font-light mt-0.5 line-clamp-2">{template.description}</div>
                  </div>
                  <Sparkles className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Badge variant="secondary" className="text-[10px] font-normal">{template.category}</Badge>
                  <span className="text-[10px] text-muted-foreground font-light">{template.fields.length} {t("forms.fields")}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  if (currentView === "submissions") {
    return renderSubmissionsPage();
  }

  if (currentView === "integrations" && selectedForm) {
    return <FormIntegrationsView form={selectedForm} onBack={handleBackToList} />;
  }

  if (currentView === "templates") {
    return (
      <div>
        {renderTemplateGallery()}

        <Dialog open={editorDialogOpen} onOpenChange={(open) => { if (!open) handleCloseEditor(); else setEditorDialogOpen(true); }}>
          <DialogContent className="max-h-[90vh] flex flex-col max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold" data-testid="text-create-dialog-title">{editingFormForId ? t("forms.editForm") : t("forms.createForm")}</DialogTitle>
              <DialogDescription className="text-sm font-light">{t("forms.buildCustomForm")}</DialogDescription>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              <div className="space-y-6 py-2">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="form-name" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("forms.formNameRequired")}</Label>
                    <Input
                      id="form-name"
                      placeholder={t("forms.formNamePlaceholder")}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      data-testid="input-form-name"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="form-description" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("forms.formDescription")}</Label>
                    <Textarea
                      id="form-description"
                      placeholder={t("forms.descriptionPlaceholder")}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={2}
                      data-testid="input-form-description"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-sm font-medium">{t("forms.formFields")}</h3>
                    <Button onClick={addField} variant="outline" size="sm" data-testid="button-add-field">
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      {t("forms.addField")}
                    </Button>
                  </div>

                  {fields.length === 0 ? (
                    <div className="text-center py-10 text-sm text-muted-foreground font-light border border-dashed rounded-xl">
                      {t("forms.addFieldHint")}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {fields.map((field, index) => (
                        <div key={field.tempId} className="rounded-xl border p-4">
                          <div className="space-y-3">
                            <div className="flex items-start gap-3">
                              <div className="flex flex-col items-center gap-0.5 pt-6">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => moveField(field.tempId, "up")}
                                  disabled={index === 0}
                                  data-testid={`button-move-up-${field.tempId}`}
                                >
                                  <ChevronRight className="h-3.5 w-3.5 -rotate-90" />
                                </Button>
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => moveField(field.tempId, "down")}
                                  disabled={index === fields.length - 1}
                                  data-testid={`button-move-down-${field.tempId}`}
                                >
                                  <ChevronRight className="h-3.5 w-3.5 rotate-90" />
                                </Button>
                              </div>

                              <div className="flex-1 space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">{t("forms.fieldLabel")}</Label>
                                    <Input
                                      placeholder={t("forms.fieldLabelPlaceholder")}
                                      value={field.label}
                                      onChange={(e) => updateField(field.tempId, { label: e.target.value })}
                                      data-testid={`input-field-label-${field.tempId}`}
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">{t("forms.fieldType")}</Label>
                                    <Select
                                      value={field.type}
                                      onValueChange={(value) => updateField(field.tempId, { type: value })}
                                    >
                                      <SelectTrigger data-testid={`select-field-type-${field.tempId}`}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {fieldTypeOptions.map((option) => (
                                          <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                                {field.type === "multiple_choice" && (
                                  <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">{t("forms.fieldOptions")}</Label>
                                    <Input
                                      placeholder={t("forms.optionsPlaceholder")}
                                      value={field.options}
                                      onChange={(e) => updateField(field.tempId, { options: e.target.value })}
                                      data-testid={`input-field-options-${field.tempId}`}
                                    />
                                  </div>
                                )}

                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    id={`required-${field.tempId}`}
                                    checked={field.required}
                                    onChange={(e) => updateField(field.tempId, { required: e.target.checked })}
                                    data-testid={`checkbox-required-${field.tempId}`}
                                    className="h-4 w-4 rounded"
                                  />
                                  <Label htmlFor={`required-${field.tempId}`} className="cursor-pointer text-sm font-light">
                                    {t("forms.requiredField")}
                                  </Label>
                                </div>
                              </div>

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeField(field.tempId)}
                                data-testid={`button-remove-field-${field.tempId}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleCloseEditor} data-testid="button-cancel-create">
                {t("common.cancel")}
              </Button>
              <Button
                onClick={() => editingFormForId ? updateMutation.mutate() : createMutation.mutate()}
                disabled={!formData.name || fields.length === 0 || createMutation.isPending || updateMutation.isPending}
                data-testid="button-submit-create"
              >
                {editingFormForId ? t("forms.saveChanges") : t("forms.createFormButton")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground" data-testid="text-page-title">
            {t("forms.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-light">{t("forms.subtitle")}</p>
        </div>
        <Button 
          onClick={() => setCurrentView("templates")}
          size="sm"
          className="rounded-full px-4"
          data-testid="button-create-form"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          {t("forms.createForm")}
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
        <Input
          placeholder={t("forms.searchForms")}
          value={formSearch}
          onChange={(e) => setFormSearch(e.target.value)}
          className="pl-10 h-10 rounded-xl bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-ring/30"
          data-testid="input-form-search"
        />
        {formSearch && (
          <button
            onClick={() => setFormSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
            data-testid="button-clear-form-search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {forms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
          <h3 className="text-base font-medium mb-1">{t("forms.noForms")}</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-5 font-light">
            {t("forms.noFormsDescription")}
          </p>
          <Button onClick={() => setCurrentView("templates")} size="sm" className="rounded-full px-4" data-testid="button-create-first-form">
            <Plus className="h-4 w-4 mr-1.5" />
            {t("forms.createFirstForm")}
          </Button>
        </div>
      ) : filteredForms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="h-6 w-6 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground font-light">{t("forms.noFormsSearch")}</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-card border overflow-hidden">
          {filteredForms.map((form, idx) => (
            <div 
              key={form.id} 
              className={`flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-muted/40 active:bg-muted/60 cursor-pointer ${idx < filteredForms.length - 1 ? "border-b border-border/50" : ""}`}
              onClick={() => handleViewSubmissions(form)}
              data-testid={`card-form-${form.id}`}
            >
              <div className="h-10 w-10 rounded-[12px] bg-primary/8 dark:bg-primary/15 flex items-center justify-center shrink-0">
                <FileText className="h-[18px] w-[18px] text-primary/70" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div
                    className="font-medium text-[14px] leading-tight truncate"
                    data-testid={`text-form-name-${form.id}`}
                  >
                    {form.name}
                  </div>
                  <span
                    className="text-[10px] font-mono text-muted-foreground/50 bg-muted/50 px-1.5 py-0.5 rounded-md shrink-0 select-all"
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`text-form-id-${form.id}`}
                  >
                    #{form.id.slice(0, 8).toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="text-[11px] text-muted-foreground/60 font-light">
                    {format(new Date(form.createdAt), "MMM d, yyyy")}
                  </span>
                  <span className="text-muted-foreground/25">·</span>
                  <span className="text-[11px] text-muted-foreground/60 font-light">
                    {form.submissionCount || 0} {t("forms.totalSubmissions").toLowerCase()}
                  </span>
                  <span className="text-muted-foreground/25">·</span>
                  <span className="text-[11px] text-muted-foreground/60 font-light">
                    {form.uniqueContacts || 0} {t("forms.uniqueContacts").toLowerCase()}
                  </span>
                  <span className="text-muted-foreground/25">·</span>
                  <span className="text-[11px] text-muted-foreground/60 font-light">
                    {form.totalResponses || 0} {t("forms.totalResponses").toLowerCase()}
                  </span>
                  {form.latestSubmission && (
                    <>
                      <span className="text-muted-foreground/25">·</span>
                      <span className="text-[11px] text-muted-foreground/60 font-light">
                        {t("forms.latestSubmission").toLowerCase()}: {format(new Date(form.latestSubmission), "MMM d")}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-muted-foreground/60 hover:text-foreground"
                  onClick={() => handleViewIntegrations(form)}
                  data-testid={`button-integrations-${form.id}`}
                >
                  <Plug className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-muted-foreground/60 hover:text-foreground"
                  onClick={() => handleEditForm(form)}
                  data-testid={`button-edit-form-${form.id}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-muted-foreground/40 hover:text-destructive"
                  onClick={() => deleteMutation.mutate(form.id)}
                  disabled={deleteMutation.isPending}
                  data-testid={`button-delete-${form.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={editorDialogOpen && currentView === "list"} onOpenChange={(open) => { if (!open) handleCloseEditor(); else setEditorDialogOpen(true); }}>
        <DialogContent className="max-h-[90vh] flex flex-col max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold" data-testid="text-edit-dialog-title">{editingFormForId ? t("forms.editForm") : t("forms.createForm")}</DialogTitle>
            <DialogDescription className="text-sm font-light">{t("forms.buildCustomForm")}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="space-y-6 py-2">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-form-name" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("forms.formNameRequired")}</Label>
                  <Input
                    id="edit-form-name"
                    placeholder={t("forms.formNamePlaceholder")}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    data-testid="input-edit-form-name"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-form-description" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("forms.formDescription")}</Label>
                  <Textarea
                    id="edit-form-description"
                    placeholder={t("forms.descriptionPlaceholder")}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    data-testid="input-edit-form-description"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-sm font-medium">{t("forms.formFields")}</h3>
                  <Button onClick={addField} variant="outline" size="sm" data-testid="button-edit-add-field">
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    {t("forms.addField")}
                  </Button>
                </div>

                {fields.length === 0 ? (
                  <div className="text-center py-10 text-sm text-muted-foreground font-light border border-dashed rounded-xl">
                    {t("forms.addFieldHint")}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {fields.map((field, index) => (
                      <div key={field.tempId} className="rounded-xl border p-4">
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="flex flex-col items-center gap-0.5 pt-6">
                              <Button variant="ghost" size="icon" onClick={() => moveField(field.tempId, "up")} disabled={index === 0}>
                                <ChevronRight className="h-3.5 w-3.5 -rotate-90" />
                              </Button>
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                              <Button variant="ghost" size="icon" onClick={() => moveField(field.tempId, "down")} disabled={index === fields.length - 1}>
                                <ChevronRight className="h-3.5 w-3.5 rotate-90" />
                              </Button>
                            </div>

                            <div className="flex-1 space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <Label className="text-xs text-muted-foreground">{t("forms.fieldLabel")}</Label>
                                  <Input
                                    placeholder={t("forms.fieldLabelPlaceholder")}
                                    value={field.label}
                                    onChange={(e) => updateField(field.tempId, { label: e.target.value })}
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs text-muted-foreground">{t("forms.fieldType")}</Label>
                                  <Select value={field.type} onValueChange={(value) => updateField(field.tempId, { type: value })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {fieldTypeOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              {field.type === "multiple_choice" && (
                                <div className="space-y-1.5">
                                  <Label className="text-xs text-muted-foreground">{t("forms.fieldOptions")}</Label>
                                  <Input
                                    placeholder={t("forms.optionsPlaceholder")}
                                    value={field.options}
                                    onChange={(e) => updateField(field.tempId, { options: e.target.value })}
                                  />
                                </div>
                              )}

                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id={`edit-required-${field.tempId}`}
                                  checked={field.required}
                                  onChange={(e) => updateField(field.tempId, { required: e.target.checked })}
                                  className="h-4 w-4 rounded"
                                />
                                <Label htmlFor={`edit-required-${field.tempId}`} className="cursor-pointer text-sm font-light">
                                  {t("forms.requiredField")}
                                </Label>
                              </div>
                            </div>

                            <Button variant="ghost" size="icon" onClick={() => removeField(field.tempId)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseEditor}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => editingFormForId ? updateMutation.mutate() : createMutation.mutate()}
              disabled={!formData.name || fields.length === 0 || createMutation.isPending || updateMutation.isPending}
            >
              {editingFormForId ? t("forms.saveChanges") : t("forms.createFormButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
