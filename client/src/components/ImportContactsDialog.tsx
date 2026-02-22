import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  FileText,
  FileSpreadsheet,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  X,
  ExternalLink,
  Users,
  Contact2,
} from "lucide-react";
import { SiGoogle, SiMicrosoft, SiHubspot, SiSalesforce } from "react-icons/si";

type ImportSource = "csv" | "vcard" | "google" | "microsoft" | "hubspot" | "salesforce";
type ImportStep = "select-source" | "configure" | "select-campaign" | "importing" | "result";

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  source: string;
}

interface CampaignOption {
  id: string;
  name: string;
  totalContacts: number;
  status: string;
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
  bgColor: string;
  category: "file" | "cloud";
}> = [
  {
    id: "csv",
    label: "CSV / Excel",
    description: "Upload a CSV or Excel file with contacts",
    icon: FileSpreadsheet,
    iconColor: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-800",
    category: "file",
  },
  {
    id: "vcard",
    label: "vCard (.vcf)",
    description: "Import contacts from a vCard file",
    icon: Contact2,
    iconColor: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-800",
    category: "file",
  },
  {
    id: "google",
    label: "Google Contacts",
    description: "Sync contacts from your Google account",
    icon: SiGoogle,
    iconColor: "text-red-500",
    bgColor: "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-800",
    category: "cloud",
  },
  {
    id: "microsoft",
    label: "Outlook / Microsoft 365",
    description: "Import contacts from Outlook or Microsoft 365",
    icon: SiMicrosoft,
    iconColor: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-800",
    category: "cloud",
  },
  {
    id: "hubspot",
    label: "HubSpot CRM",
    description: "Sync contacts from HubSpot",
    icon: SiHubspot,
    iconColor: "text-orange-500",
    bgColor: "bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-800",
    category: "cloud",
  },
  {
    id: "salesforce",
    label: "Salesforce",
    description: "Import contacts from Salesforce CRM",
    icon: SiSalesforce,
    iconColor: "text-sky-500",
    bgColor: "bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-800",
    category: "cloud",
  },
];

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
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<CSVPreview | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [oauthCredentials, setOauthCredentials] = useState({ clientId: "", clientSecret: "" });
  const [oauthAccessToken, setOauthAccessToken] = useState<string>("");
  const [oauthAccountInfo, setOauthAccountInfo] = useState<{ name: string; email: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const { data: campaignsList = [], isLoading: campaignsLoading } = useQuery<CampaignOption[]>({
    queryKey: ["/api/contact-import/campaigns-list"],
    enabled: open,
  });

  const resetState = useCallback(() => {
    setStep("select-source");
    setSelectedSource(null);
    setSelectedCampaignId("");
    setSelectedFile(null);
    setCsvPreview(null);
    setImportResult(null);
    setOauthCredentials({ clientId: "", clientSecret: "" });
    setOauthAccessToken("");
    setOauthAccountInfo(null);
    setIsImporting(false);
  }, []);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setTimeout(resetState, 300);
  }, [onOpenChange, resetState]);

  const handleSourceSelect = (source: ImportSource) => {
    setSelectedSource(source);
    if (source === "csv" || source === "vcard") {
      setStep("configure");
    } else {
      setStep("configure");
    }
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

    try {
      const endpoint = selectedSource === "google"
        ? "/api/contact-import/google/auth-url"
        : "/api/contact-import/microsoft/auth-url";

      const res = await apiRequest("POST", endpoint, {
        clientId: oauthCredentials.clientId,
        clientSecret: oauthCredentials.clientSecret,
      });
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

        const checkPopup = setInterval(async () => {
          try {
            if (popup?.closed) {
              clearInterval(checkPopup);
              return;
            }
            const popupUrl = popup?.location?.href;
            if (popupUrl && popupUrl.includes("code=")) {
              clearInterval(checkPopup);
              const urlParams = new URLSearchParams(new URL(popupUrl).search);
              const code = urlParams.get("code");
              popup?.close();

              if (code) {
                const exchangeEndpoint = selectedSource === "google"
                  ? "/api/contact-import/google/exchange-code"
                  : "/api/contact-import/microsoft/exchange-code";

                const tokenRes = await apiRequest("POST", exchangeEndpoint, {
                  code,
                  clientId: oauthCredentials.clientId,
                  clientSecret: oauthCredentials.clientSecret,
                });
                const tokenData = await tokenRes.json();

                if (tokenData.accessToken) {
                  setOauthAccessToken(tokenData.accessToken);
                  setOauthAccountInfo({
                    name: tokenData.accountName || "",
                    email: tokenData.accountEmail || "",
                  });
                  setStep("select-campaign");
                  toast({ title: `Connected to ${selectedSource === "google" ? "Google" : "Microsoft"} successfully` });
                }
              }
            }
          } catch {
            // Cross-origin - expected until redirect completes
          }
        }, 500);
      }
    } catch (error: any) {
      toast({
        title: "Connection failed",
        description: error.message || "Failed to connect",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    if (!selectedCampaignId || !selectedSource) return;

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
        formData.append("campaignId", selectedCampaignId);

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
          campaignId: selectedCampaignId,
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
      queryClient.invalidateQueries({ queryKey: ["/api/contact-import/campaigns-list"] });
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
    } else if (step === "select-campaign") {
      setStep("configure");
    } else if (step === "result") {
      resetState();
    }
  };

  const needsCampaignBeforeImport = selectedSource === "csv" || selectedSource === "vcard";

  const renderSourceSelection = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">File Upload</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SOURCE_OPTIONS.filter(s => s.category === "file").map((source) => {
            const Icon = source.icon;
            return (
              <Card
                key={source.id}
                className={`cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] border-2 ${source.bgColor} p-4`}
                onClick={() => handleSourceSelect(source.id)}
                data-testid={`card-import-source-${source.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg bg-white/80 dark:bg-white/10`}>
                    <Icon className={`h-5 w-5 ${source.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm">{source.label}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{source.description}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Cloud & CRM Sync</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SOURCE_OPTIONS.filter(s => s.category === "cloud").map((source) => {
            const Icon = source.icon;
            return (
              <Card
                key={source.id}
                className={`cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] border-2 ${source.bgColor} p-4`}
                onClick={() => handleSourceSelect(source.id)}
                data-testid={`card-import-source-${source.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg bg-white/80 dark:bg-white/10`}>
                    <Icon className={`h-5 w-5 ${source.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm">{source.label}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{source.description}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderFileUploadConfig = () => (
    <div className="space-y-4">
      <div
        className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
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
          <div className="flex flex-col items-center gap-2">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <p className="font-medium">{selectedFile.name}</p>
            <p className="text-sm text-muted-foreground">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setCsvPreview(null); }}>
              Choose different file
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium">
              Click to upload {selectedSource === "csv" ? "CSV / Excel" : "vCard"} file
            </p>
            <p className="text-sm text-muted-foreground">
              {selectedSource === "csv" ? "Supports .csv, .xlsx, .xls files" : "Supports .vcf files"}
            </p>
          </div>
        )}
      </div>

      {csvPreview && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Preview ({csvPreview.totalRows} rows detected)</h4>
            <Badge variant="outline">{csvPreview.headers.length} columns</Badge>
          </div>
          <div className="rounded-lg border overflow-x-auto max-h-48">
            <Table>
              <TableHeader>
                <TableRow>
                  {csvPreview.headers.slice(0, 6).map((header) => (
                    <TableHead key={header} className="text-xs whitespace-nowrap">{header}</TableHead>
                  ))}
                  {csvPreview.headers.length > 6 && <TableHead className="text-xs">...</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {csvPreview.preview.map((row, idx) => (
                  <TableRow key={idx}>
                    {csvPreview.headers.slice(0, 6).map((header) => (
                      <TableCell key={header} className="text-xs py-1">{String(row[header] || "")}</TableCell>
                    ))}
                    {csvPreview.headers.length > 6 && <TableCell className="text-xs py-1">...</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="campaign-select">Select Campaign</Label>
        <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
          <SelectTrigger data-testid="select-campaign">
            <SelectValue placeholder="Choose a campaign to import into..." />
          </SelectTrigger>
          <SelectContent>
            {campaignsList.map((campaign) => (
              <SelectItem key={campaign.id} value={campaign.id}>
                {campaign.name} ({campaign.totalContacts} contacts)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        onClick={handleImport}
        disabled={!selectedFile || !selectedCampaignId || isImporting}
        className="w-full"
        data-testid="button-start-import"
      >
        {isImporting ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing...</>
        ) : (
          <><Upload className="h-4 w-4 mr-2" /> Import Contacts</>
        )}
      </Button>
    </div>
  );

  const renderOAuthConfig = () => {
    const sourceConfig = SOURCE_OPTIONS.find(s => s.id === selectedSource);
    const isConnected = !!oauthAccessToken;

    if (selectedSource === "hubspot" || selectedSource === "salesforce") {
      return (
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              {sourceConfig && <sourceConfig.icon className={`h-5 w-5 ${sourceConfig.iconColor}`} />}
              <h4 className="font-medium">{sourceConfig?.label}</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              To import contacts from {sourceConfig?.label}, connect your {sourceConfig?.label} account from the
              Integrations page first, then use the access token here.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Access Token</Label>
            <Input
              type="password"
              placeholder={`Paste your ${sourceConfig?.label} access token`}
              value={oauthAccessToken}
              onChange={(e) => setOauthAccessToken(e.target.value)}
              data-testid="input-access-token"
            />
          </div>

          {oauthAccessToken && (
            <>
              <div className="space-y-2">
                <Label>Select Campaign</Label>
                <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                  <SelectTrigger data-testid="select-campaign-oauth">
                    <SelectValue placeholder="Choose a campaign..." />
                  </SelectTrigger>
                  <SelectContent>
                    {campaignsList.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name} ({campaign.totalContacts} contacts)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleImport}
                disabled={!selectedCampaignId || isImporting}
                className="w-full"
                data-testid="button-start-crm-import"
              >
                {isImporting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing...</>
                ) : (
                  <><Cloud className="h-4 w-4 mr-2" /> Import from {sourceConfig?.label}</>
                )}
              </Button>
            </>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            {sourceConfig && <sourceConfig.icon className={`h-5 w-5 ${sourceConfig.iconColor}`} />}
            <h4 className="font-medium">Connect {sourceConfig?.label}</h4>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            {selectedSource === "google"
              ? "Enter your Google Cloud OAuth credentials to import contacts. You need a project with the People API enabled."
              : "Enter your Microsoft Azure AD app credentials to import Outlook contacts."}
          </p>

          {!isConnected && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Client ID</Label>
                <Input
                  placeholder="Enter Client ID"
                  value={oauthCredentials.clientId}
                  onChange={(e) => setOauthCredentials(prev => ({ ...prev, clientId: e.target.value }))}
                  data-testid="input-oauth-client-id"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Client Secret</Label>
                <Input
                  type="password"
                  placeholder="Enter Client Secret"
                  value={oauthCredentials.clientSecret}
                  onChange={(e) => setOauthCredentials(prev => ({ ...prev, clientSecret: e.target.value }))}
                  data-testid="input-oauth-client-secret"
                />
              </div>
              <Button
                onClick={handleOAuthConnect}
                disabled={!oauthCredentials.clientId || !oauthCredentials.clientSecret}
                className="w-full"
                data-testid="button-oauth-connect"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Connect with {sourceConfig?.label}
              </Button>
            </div>
          )}

          {isConnected && oauthAccountInfo && (
            <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-500/10 rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <div className="text-sm">
                <span className="font-medium">{oauthAccountInfo.name}</span>
                {oauthAccountInfo.email && (
                  <span className="text-muted-foreground ml-1">({oauthAccountInfo.email})</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCampaignSelection = () => (
    <div className="space-y-4">
      {oauthAccountInfo && (
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-500/10 rounded-lg border border-green-200 dark:border-green-800">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <div>
            <p className="font-medium text-sm">Connected to {oauthAccountInfo.name}</p>
            {oauthAccountInfo.email && <p className="text-xs text-muted-foreground">{oauthAccountInfo.email}</p>}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Select Campaign to Import Into</Label>
        <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
          <SelectTrigger data-testid="select-campaign-cloud">
            <SelectValue placeholder="Choose a campaign..." />
          </SelectTrigger>
          <SelectContent>
            {campaignsList.map((campaign) => (
              <SelectItem key={campaign.id} value={campaign.id}>
                {campaign.name} ({campaign.totalContacts} contacts)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {campaignsList.length === 0 && !campaignsLoading && (
          <p className="text-sm text-muted-foreground">No campaigns found. Create a campaign first.</p>
        )}
      </div>

      <Button
        onClick={handleImport}
        disabled={!selectedCampaignId || isImporting}
        className="w-full"
        data-testid="button-import-cloud-contacts"
      >
        {isImporting ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing contacts...</>
        ) : (
          <><Cloud className="h-4 w-4 mr-2" /> Import Contacts</>
        )}
      </Button>
    </div>
  );

  const renderImporting = () => (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <div className="text-center">
        <h3 className="font-semibold text-lg">Importing Contacts</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Fetching and importing contacts from {SOURCE_OPTIONS.find(s => s.id === selectedSource)?.label}...
        </p>
      </div>
    </div>
  );

  const renderResult = () => (
    <div className="space-y-4">
      <div className="flex flex-col items-center py-6 gap-3">
        {importResult && importResult.imported > 0 ? (
          <CheckCircle2 className="h-16 w-16 text-green-500" />
        ) : (
          <AlertCircle className="h-16 w-16 text-yellow-500" />
        )}
        <h3 className="font-semibold text-xl">
          {importResult && importResult.imported > 0 ? "Import Successful!" : "Import Complete"}
        </h3>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-3 bg-green-50 dark:bg-green-500/10 rounded-lg">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{importResult?.imported || 0}</div>
          <div className="text-xs text-muted-foreground">Imported</div>
        </div>
        <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-500/10 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{importResult?.skipped || 0}</div>
          <div className="text-xs text-muted-foreground">Skipped</div>
        </div>
        <div className="text-center p-3 bg-red-50 dark:bg-red-500/10 rounded-lg">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{importResult?.errors?.length || 0}</div>
          <div className="text-xs text-muted-foreground">Errors</div>
        </div>
      </div>

      {importResult?.errors && importResult.errors.length > 0 && (
        <div className="bg-red-50 dark:bg-red-500/10 p-3 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">Errors:</p>
          {importResult.errors.map((err, idx) => (
            <p key={idx} className="text-xs text-red-600 dark:text-red-400">{err}</p>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={resetState} className="flex-1" data-testid="button-import-more">
          Import More
        </Button>
        <Button onClick={handleClose} className="flex-1" data-testid="button-close-import">
          Done
        </Button>
      </div>
    </div>
  );

  const getStepTitle = () => {
    switch (step) {
      case "select-source": return "Import Contacts";
      case "configure": return `Import from ${SOURCE_OPTIONS.find(s => s.id === selectedSource)?.label || ""}`;
      case "select-campaign": return "Select Campaign";
      case "importing": return "Importing...";
      case "result": return "Import Results";
      default: return "Import Contacts";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {step !== "select-source" && step !== "importing" && (
              <Button variant="ghost" size="icon" onClick={goBack} className="h-8 w-8" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {getStepTitle()}
            </DialogTitle>
          </div>
        </DialogHeader>

        {step === "select-source" && renderSourceSelection()}
        {step === "configure" && (selectedSource === "csv" || selectedSource === "vcard") && renderFileUploadConfig()}
        {step === "configure" && selectedSource && !["csv", "vcard"].includes(selectedSource) && renderOAuthConfig()}
        {step === "select-campaign" && renderCampaignSelection()}
        {step === "importing" && renderImporting()}
        {step === "result" && renderResult()}
      </DialogContent>
    </Dialog>
  );
}
