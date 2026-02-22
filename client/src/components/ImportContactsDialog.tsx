import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Upload,
  FileSpreadsheet,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Contact2,
  Mail,
  ChevronRight,
  FolderUp,
  Shield,
  Zap,
  Database,
  ArrowUpRight,
} from "lucide-react";
import { SiGoogle, SiHubspot, SiSalesforce } from "react-icons/si";

type ImportSource = "csv" | "vcard" | "google" | "microsoft" | "hubspot" | "salesforce";
type ImportStep = "select-source" | "configure" | "importing" | "result";

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  source: string;
}

interface CSVPreview {
  headers: string[];
  preview: Record<string, string>[];
  totalRows: number;
}

const SOURCE_OPTIONS: Array<{
  id: ImportSource;
  label: string;
  description: string;
  icon: any;
  iconColor: string;
  iconBg: string;
  category: "file" | "cloud";
}> = [
  {
    id: "csv",
    label: "CSV / Excel",
    description: "Upload spreadsheet files with contact data",
    icon: FileSpreadsheet,
    iconColor: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-100 dark:bg-emerald-500/15",
    category: "file",
  },
  {
    id: "vcard",
    label: "vCard (.vcf)",
    description: "Standard contact file format",
    icon: Contact2,
    iconColor: "text-indigo-600 dark:text-indigo-400",
    iconBg: "bg-indigo-100 dark:bg-indigo-500/15",
    category: "file",
  },
  {
    id: "google",
    label: "Google Contacts",
    description: "Sync from your Google account",
    icon: SiGoogle,
    iconColor: "text-red-500",
    iconBg: "bg-red-50 dark:bg-red-500/10",
    category: "cloud",
  },
  {
    id: "microsoft",
    label: "Microsoft Outlook",
    description: "Import from Outlook or Microsoft 365",
    icon: Mail,
    iconColor: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-100 dark:bg-blue-500/15",
    category: "cloud",
  },
  {
    id: "hubspot",
    label: "HubSpot CRM",
    description: "Sync contacts from HubSpot",
    icon: SiHubspot,
    iconColor: "text-orange-500",
    iconBg: "bg-orange-50 dark:bg-orange-500/10",
    category: "cloud",
  },
  {
    id: "salesforce",
    label: "Salesforce",
    description: "Import from Salesforce CRM",
    icon: SiSalesforce,
    iconColor: "text-sky-500",
    iconBg: "bg-sky-50 dark:bg-sky-500/10",
    category: "cloud",
  },
];

const STEP_META: Record<ImportStep, { number: number; label: string }> = {
  "select-source": { number: 1, label: "Source" },
  "configure": { number: 2, label: "Configure" },
  "importing": { number: 3, label: "Import" },
  "result": { number: 3, label: "Results" },
};

export default function ImportContactsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ImportStep>("select-source");
  const [selectedSource, setSelectedSource] = useState<ImportSource | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<CSVPreview | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [oauthAccessToken, setOauthAccessToken] = useState<string>("");
  const [oauthAccountInfo, setOauthAccountInfo] = useState<{ name: string; email: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const resetState = useCallback(() => {
    setStep("select-source");
    setSelectedSource(null);
    setSelectedFile(null);
    setCsvPreview(null);
    setImportResult(null);
    setOauthAccessToken("");
    setOauthAccountInfo(null);
    setIsImporting(false);
    setIsConnecting(false);
  }, []);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setTimeout(resetState, 300);
  }, [onOpenChange, resetState]);

  const handleSourceSelect = (source: ImportSource) => {
    setSelectedSource(source);
    setStep("configure");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);

    if (selectedSource === "csv") {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/contact-import/preview-csv", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: formData,
        });
        if (res.ok) {
          const preview = await res.json();
          setCsvPreview(preview);
        }
      } catch (err) {
        console.error("Preview failed:", err);
      }
    }
  };

  const handleOAuthConnect = async () => {
    if (!selectedSource) return;

    setIsConnecting(true);

    try {
      const endpoint = selectedSource === "google"
        ? "/api/contact-import/google/auth-url"
        : "/api/contact-import/microsoft/auth-url";

      const res = await apiRequest("POST", endpoint, {});
      const data = await res.json();

      if (data.authUrl) {
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const popup = window.open(
          data.authUrl,
          `${selectedSource}-auth`,
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
        );

        const handleMessage = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          if (!event.data || typeof event.data !== 'object') return;

          if (event.data.type === 'oauth-success') {
            window.removeEventListener('message', handleMessage);
            setIsConnecting(false);
            setOauthAccessToken(event.data.accessToken);
            setOauthAccountInfo({
              name: event.data.accountName || "",
              email: event.data.accountEmail || "",
            });
            toast({ title: `Connected to ${selectedSource === "google" ? "Google" : "Microsoft"} successfully` });
          } else if (event.data.type === 'oauth-error') {
            window.removeEventListener('message', handleMessage);
            setIsConnecting(false);
            toast({
              title: "Connection failed",
              description: `Authorization error: ${event.data.error || 'Unknown error'}`,
              variant: "destructive",
            });
          }
        };

        window.addEventListener('message', handleMessage);

        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            setTimeout(() => {
              setIsConnecting(false);
              window.removeEventListener('message', handleMessage);
            }, 1000);
          }
        }, 500);
      }
    } catch (error: any) {
      setIsConnecting(false);
      toast({
        title: "Connection failed",
        description: error.message || "Failed to connect",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    if (!selectedSource) return;

    setIsImporting(true);
    setStep("importing");

    try {
      let result: ImportResult;

      if (selectedSource === "csv" || selectedSource === "vcard") {
        if (!selectedFile) {
          toast({ title: "Please select a file", variant: "destructive" });
          setStep("configure");
          setIsImporting(false);
          return;
        }

        const formData = new FormData();
        formData.append("file", selectedFile);

        const endpoint = selectedSource === "csv"
          ? "/api/contact-import/csv"
          : "/api/contact-import/vcard";

        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Import failed");
        }

        result = await res.json();
      } else {
        const fetchEndpoint = `/api/contact-import/${selectedSource}/fetch`;

        const res = await apiRequest("POST", fetchEndpoint, {
          accessToken: oauthAccessToken,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Import failed");
        }

        result = await res.json();
      }

      setImportResult(result);
      setStep("result");
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/deduplicated"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error.message || "An error occurred during import",
        variant: "destructive",
      });
      setStep("configure");
    } finally {
      setIsImporting(false);
    }
  };

  const goBack = () => {
    if (step === "configure") {
      setStep("select-source");
      setSelectedFile(null);
      setCsvPreview(null);
    } else if (step === "result") {
      resetState();
    }
  };

  const renderStepIndicator = () => {
    const steps = [
      { number: 1, label: "Source" },
      { number: 2, label: "Configure" },
      { number: 3, label: "Import" },
    ];

    return (
      <div className="flex items-center justify-between px-2 mb-6">
        {steps.map((s, idx) => {
          const isActive = s.number === STEP_META[step].number;
          const isCompleted = s.number < STEP_META[step].number;
          return (
            <div key={s.number} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-200 ${
                    isCompleted
                      ? "bg-primary text-primary-foreground"
                      : isActive
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    s.number
                  )}
                </div>
                <span className={`text-[10px] font-medium ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                  {s.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div className={`flex-1 h-[2px] mx-2 mt-[-16px] transition-colors duration-200 ${
                  isCompleted ? "bg-primary" : "bg-muted"
                }`} />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderSourceSelection = () => (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <FolderUp className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">File Upload</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {SOURCE_OPTIONS.filter(s => s.category === "file").map((source) => {
            const Icon = source.icon;
            return (
              <button
                key={source.id}
                className="group flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-accent/50 transition-all duration-150 text-left w-full"
                onClick={() => handleSourceSelect(source.id)}
                data-testid={`card-import-source-${source.id}`}
              >
                <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${source.iconBg} flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 ${source.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-foreground">{source.label}</div>
                  <div className="text-xs text-muted-foreground leading-tight mt-0.5">{source.description}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors flex-shrink-0" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-border" />

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Cloud className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cloud & CRM Integrations</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {SOURCE_OPTIONS.filter(s => s.category === "cloud").map((source) => {
            const Icon = source.icon;
            return (
              <button
                key={source.id}
                className="group flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-accent/50 transition-all duration-150 text-left w-full"
                onClick={() => handleSourceSelect(source.id)}
                data-testid={`card-import-source-${source.id}`}
              >
                <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${source.iconBg} flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 ${source.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-foreground">{source.label}</div>
                  <div className="text-xs text-muted-foreground leading-tight mt-0.5">{source.description}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors flex-shrink-0" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border/60">
        <Shield className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Your data is encrypted in transit. Maximum 10,000 contacts per import. Contacts are automatically organized for you.
        </p>
      </div>
    </div>
  );

  const renderFileUploadConfig = () => (
    <div className="space-y-5">
      <div
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
          selectedFile
            ? "border-primary/30 bg-primary/5"
            : "border-muted-foreground/20 hover:border-primary/40 hover:bg-accent/30"
        }`}
        onClick={() => fileInputRef.current?.click()}
        data-testid="dropzone-file-upload"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={selectedSource === "csv" ? ".csv,.xlsx,.xls,.txt" : ".vcf,.vcard"}
          onChange={handleFileChange}
          className="hidden"
          data-testid="input-file-upload"
        />
        {selectedFile ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 text-muted-foreground hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setCsvPreview(null); }}
            >
              Change file
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-muted/80 dark:bg-muted/40 flex items-center justify-center">
              <Upload className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">
                Click to upload {selectedSource === "csv" ? "spreadsheet" : "vCard"} file
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedSource === "csv" ? "CSV, XLSX, XLS up to 20MB" : "VCF files up to 20MB"}
              </p>
            </div>
          </div>
        )}
      </div>

      {csvPreview && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data Preview</span>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px] font-medium h-5">
                {csvPreview.totalRows} rows
              </Badge>
              <Badge variant="outline" className="text-[10px] font-medium h-5">
                {csvPreview.headers.length} columns
              </Badge>
            </div>
          </div>
          <div className="rounded-lg border overflow-x-auto max-h-40">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  {csvPreview.headers.slice(0, 6).map((header) => (
                    <TableHead key={header} className="text-[11px] font-semibold whitespace-nowrap py-2 h-auto">{header}</TableHead>
                  ))}
                  {csvPreview.headers.length > 6 && <TableHead className="text-[11px] py-2 h-auto">...</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {csvPreview.preview.map((row, idx) => (
                  <TableRow key={idx}>
                    {csvPreview.headers.slice(0, 6).map((header) => (
                      <TableCell key={header} className="text-[11px] py-1.5">{String(row[header] || "")}</TableCell>
                    ))}
                    {csvPreview.headers.length > 6 && <TableCell className="text-[11px] py-1.5">...</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Button
        onClick={handleImport}
        disabled={!selectedFile || isImporting}
        className="w-full h-11"
        data-testid="button-start-import"
      >
        {isImporting ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
        ) : (
          <><ArrowUpRight className="h-4 w-4 mr-2" /> Import Contacts</>
        )}
      </Button>
    </div>
  );

  const renderOAuthConfig = () => {
    const sourceConfig = SOURCE_OPTIONS.find(s => s.id === selectedSource);
    const isConnected = !!oauthAccessToken;
    const SourceIcon = sourceConfig?.icon;

    if (selectedSource === "hubspot" || selectedSource === "salesforce") {
      return (
        <div className="space-y-5">
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-lg ${sourceConfig?.iconBg} flex items-center justify-center`}>
                {SourceIcon && <SourceIcon className={`h-5 w-5 ${sourceConfig?.iconColor}`} />}
              </div>
              <div>
                <h4 className="font-semibold text-sm">{sourceConfig?.label}</h4>
                <p className="text-xs text-muted-foreground">API token authentication</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Connect your {sourceConfig?.label} account by providing an API access token.
              You can generate one from your {sourceConfig?.label} account settings.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Access Token</Label>
            <Input
              type="password"
              placeholder={`Paste your ${sourceConfig?.label} access token`}
              value={oauthAccessToken}
              onChange={(e) => setOauthAccessToken(e.target.value)}
              className="h-10 font-mono text-sm"
              data-testid="input-access-token"
            />
          </div>

          {oauthAccessToken && (
            <Button
              onClick={handleImport}
              disabled={isImporting}
              className="w-full h-11"
              data-testid="button-start-crm-import"
            >
              {isImporting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
              ) : (
                <><Database className="h-4 w-4 mr-2" /> Import from {sourceConfig?.label}</>
              )}
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-lg ${sourceConfig?.iconBg} flex items-center justify-center`}>
              {SourceIcon && <SourceIcon className={`h-5 w-5 ${sourceConfig?.iconColor}`} />}
            </div>
            <div>
              <h4 className="font-semibold text-sm">Connect {sourceConfig?.label}</h4>
              <p className="text-xs text-muted-foreground">Secure sign-in with your account</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {selectedSource === "google"
              ? "Sign in with your Google account to import contacts from your Google Contacts."
              : "Sign in with your Microsoft account to import contacts from Outlook or Microsoft 365."}
          </p>
        </div>

        {!isConnected && (
          <Button
            onClick={handleOAuthConnect}
            disabled={isConnecting}
            className={`w-full h-12 text-sm font-medium ${
              selectedSource === "google"
                ? "bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm"
                : "bg-[#2F2F2F] hover:bg-[#404040] text-white"
            }`}
            data-testid="button-oauth-connect"
          >
            {isConnecting ? (
              <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Connecting...</>
            ) : (
              <>
                {SourceIcon && <SourceIcon className={`h-5 w-5 mr-2 ${selectedSource === "google" ? "text-red-500" : "text-white"}`} />}
                Sign in with {sourceConfig?.label}
              </>
            )}
          </Button>
        )}

        {isConnected && oauthAccountInfo && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3.5 bg-primary/5 border border-primary/20 rounded-xl">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{oauthAccountInfo.name}</p>
                {oauthAccountInfo.email && (
                  <p className="text-xs text-muted-foreground truncate">{oauthAccountInfo.email}</p>
                )}
              </div>
              <Badge variant="secondary" className="ml-auto text-[10px] flex-shrink-0">Connected</Badge>
            </div>

            <Button
              onClick={handleImport}
              disabled={isImporting}
              className="w-full h-11"
              data-testid="button-import-cloud-contacts"
            >
              {isImporting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
              ) : (
                <><ArrowUpRight className="h-4 w-4 mr-2" /> Import Contacts</>
              )}
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderImporting = () => (
    <div className="flex flex-col items-center justify-center py-14 gap-5">
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-card border-2 border-background flex items-center justify-center">
          <Zap className="h-4 w-4 text-amber-500" />
        </div>
      </div>
      <div className="text-center space-y-1.5">
        <h3 className="font-semibold text-base text-foreground">Importing Contacts</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Fetching and processing contacts from {SOURCE_OPTIONS.find(s => s.id === selectedSource)?.label}. This may take a moment.
        </p>
      </div>
    </div>
  );

  const renderResult = () => {
    const isSuccess = importResult && importResult.imported > 0;
    const hasErrors = importResult?.errors && importResult.errors.length > 0;

    return (
      <div className="space-y-5">
        <div className="flex flex-col items-center py-6 gap-3">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
            isSuccess ? "bg-emerald-100 dark:bg-emerald-500/15" : "bg-amber-100 dark:bg-amber-500/15"
          }`}>
            {isSuccess ? (
              <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            )}
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-lg text-foreground">
              {isSuccess ? "Import Complete" : "Import Finished"}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isSuccess
                ? `Successfully imported ${importResult?.imported} contacts`
                : "No new contacts were imported"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20">
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{importResult?.imported || 0}</div>
            <div className="text-[11px] font-medium text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">Imported</div>
          </div>
          <div className="text-center p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20">
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{importResult?.skipped || 0}</div>
            <div className="text-[11px] font-medium text-amber-600/70 dark:text-amber-400/70 mt-0.5">Skipped</div>
          </div>
          <div className="text-center p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20">
            <div className="text-2xl font-bold text-red-700 dark:text-red-400">{importResult?.errors?.length || 0}</div>
            <div className="text-[11px] font-medium text-red-600/70 dark:text-red-400/70 mt-0.5">Errors</div>
          </div>
        </div>

        {hasErrors && (
          <div className="rounded-xl border border-red-200 dark:border-red-500/20 overflow-hidden">
            <div className="bg-red-50 dark:bg-red-500/10 px-4 py-2.5 border-b border-red-200 dark:border-red-500/20">
              <p className="text-xs font-semibold uppercase tracking-wider text-red-700 dark:text-red-400">Error Details</p>
            </div>
            <div className="p-3 space-y-1 max-h-32 overflow-y-auto">
              {importResult!.errors.map((err, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>{err}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button variant="outline" onClick={resetState} className="flex-1 h-10" data-testid="button-import-more">
            Import More
          </Button>
          <Button onClick={handleClose} className="flex-1 h-10" data-testid="button-close-import">
            Done
          </Button>
        </div>
      </div>
    );
  };

  const getStepTitle = () => {
    switch (step) {
      case "select-source": return "Import Contacts";
      case "configure": return SOURCE_OPTIONS.find(s => s.id === selectedSource)?.label || "Configure";
      case "importing": return "Processing";
      case "result": return "Import Results";
      default: return "Import Contacts";
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case "select-source": return "Choose where to import your contacts from";
      case "configure": return `Set up your ${SOURCE_OPTIONS.find(s => s.id === selectedSource)?.label || ""} import`;
      case "importing": return "Please wait while we process your contacts";
      case "result": return "Review your import summary";
      default: return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[580px] max-h-[90vh] overflow-y-auto p-0 gap-0">
        <div className="px-6 pt-6 pb-4 border-b bg-muted/30">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-3">
              {step !== "select-source" && step !== "importing" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goBack}
                  className="h-8 w-8 rounded-full flex-shrink-0"
                  data-testid="button-back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <div className="flex-1">
                <DialogTitle className="text-base font-semibold">{getStepTitle()}</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">{getStepDescription()}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="px-6 pt-5 pb-6">
          {step !== "result" && renderStepIndicator()}
          {step === "select-source" && renderSourceSelection()}
          {step === "configure" && (selectedSource === "csv" || selectedSource === "vcard") && renderFileUploadConfig()}
          {step === "configure" && selectedSource && !["csv", "vcard"].includes(selectedSource) && renderOAuthConfig()}
          {step === "importing" && renderImporting()}
          {step === "result" && renderResult()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
