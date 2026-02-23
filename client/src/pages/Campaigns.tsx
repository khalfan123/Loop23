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
import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { ThreeColumnLayout, SubPanelSection, SubPanelItem } from "@/components/ThreeColumnLayout";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";
import { Phone, AlertTriangle, Loader2, Users, Search, Trash2, Upload, Download, PhoneIncoming, PhoneOutgoing, Plus, FileSpreadsheet, Contact2, Mail } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  totalContacts: number;
  completedCalls: number;
  successfulCalls: number;
  deletedAt?: string | null;
  phoneNumberId?: string | null;
  errorMessage?: string | null;
  errorCode?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  planType: string;
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

type ViewMode = 'batch' | 'contacts';

export default function Campaigns() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [showPhoneNumberAlert, setShowPhoneNumberAlert] = useState(false);
  const [activeView, setActiveView] = useState<ViewMode>('batch');
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [deletingContact, setDeletingContact] = useState<DeduplicatedContact | null>(null);
  const [contactSortBy, setContactSortBy] = useState<'name' | 'phone' | 'status'>('name');
  const csvFileRef = useRef<HTMLInputElement>(null);
  const vcardFileRef = useRef<HTMLInputElement>(null);

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  const { data: contacts = [], isLoading: contactsLoading } = useQuery<DeduplicatedContact[]>({
    queryKey: ["/api/contacts/deduplicated"],
    enabled: activeView === 'contacts',
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/contacts/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/deduplicated"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setDeletingContact(null);
      toast({ title: t('contacts.deleteSuccess', 'Contact deleted successfully') });
    },
    onError: (error: any) => {
      toast({
        title: t('contacts.deleteFailed', 'Failed to delete contact'),
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const exportToCSV = () => {
    if (contacts.length === 0) {
      toast({
        title: t('contacts.noContactsExport', 'No contacts to export'),
        variant: "destructive",
      });
      return;
    }

    const headers = ["Phone", "Names", "Email", "Source", "Status", "Campaigns", "Call Count"];
    const rows = contacts.map(contact => [
      contact.phone,
      contact.names.map(n => `${n.firstName} ${n.lastName || ""}`).join("; "),
      contact.email || "",
      contact.source,
      contact.status,
      contact.campaigns.map(c => c.name).join("; "),
      String(contact.callCount || 0)
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `contacts_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({ title: `Exported ${contacts.length} contacts to CSV` });
  };

  const handleFileUpload = async (file: File, type: "csv" | "vcard") => {
    const formData = new FormData();
    formData.append("file", file);
    const endpoint = type === "csv" ? "/api/contact-import/csv" : "/api/contact-import/vcard";
    toast({ title: `Importing ${type === "csv" ? "CSV/Excel" : "vCard"} file...` });
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Import failed");
      }
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/deduplicated"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({
        title: "Import completed",
        description: `Imported ${result.imported} contacts${result.skipped ? `, ${result.skipped} skipped` : ""}`,
      });
    } catch (error: any) {
      toast({ title: "Import failed", description: error.message || "An error occurred", variant: "destructive" });
    }
  };

  const handleOAuthImport = async (provider: "google" | "microsoft") => {
    try {
      const endpoint = provider === "google" ? "/api/contact-import/google/auth-url" : "/api/contact-import/microsoft/auth-url";
      const res = await apiRequest("POST", endpoint, {});
      const data = await res.json();
      if (data.authUrl) {
        const width = 600, height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        const popup = window.open(data.authUrl, `${provider}-auth`, `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`);
        toast({ title: `Connecting to ${provider === "google" ? "Google" : "Microsoft"}...` });
        const handleMessage = async (event: MessageEvent) => {
          const origin = `${window.location.protocol}//${window.location.host}`;
          if (event.origin !== origin) return;
          if (!event.data || typeof event.data !== 'object') return;
          if (event.data.type === 'oauth-success') {
            window.removeEventListener('message', handleMessage);
            toast({ title: `Importing contacts from ${provider === "google" ? "Google" : "Microsoft"}...` });
            try {
              const fetchRes = await apiRequest("POST", `/api/contact-import/${provider}/fetch`, { accessToken: event.data.accessToken });
              if (!fetchRes.ok) { const err = await fetchRes.json(); throw new Error(err.error || "Import failed"); }
              const result = await fetchRes.json();
              queryClient.invalidateQueries({ queryKey: ["/api/contacts/deduplicated"] });
              queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
              toast({ title: "Import completed", description: `Imported ${result.imported} contacts${result.skipped ? `, ${result.skipped} skipped` : ""}` });
            } catch (fetchError: any) {
              toast({ title: "Import failed", description: fetchError.message || "Failed to import contacts", variant: "destructive" });
            }
          } else if (event.data.type === 'oauth-error') {
            window.removeEventListener('message', handleMessage);
            toast({ title: "Connection failed", description: `Authorization error: ${event.data.error || 'Unknown error'}`, variant: "destructive" });
          }
        };
        window.addEventListener('message', handleMessage);
        const checkClosed = setInterval(() => { if (popup?.closed) { clearInterval(checkClosed); setTimeout(() => window.removeEventListener('message', handleMessage), 1000); } }, 500);
      }
    } catch (error: any) {
      toast({ title: "Connection failed", description: error.message || "Failed to connect", variant: "destructive" });
    }
  };

  const isPro = user?.planType === "pro";
  const campaignsWithoutPhoneNumber = campaigns.filter(c => !c.phoneNumberId && c.status !== 'completed');
  const unassignedIds = campaignsWithoutPhoneNumber.map(c => c.id);

  useEffect(() => {
    if (userLoading || isLoading || !user || !isPro || unassignedIds.length === 0) {
      return;
    }

    const sessionKey = `phone_alert_dismissed_${user.id}`;
    try {
      const dismissedData = sessionStorage.getItem(sessionKey);
      
      if (dismissedData) {
        const { ids: dismissedIds } = JSON.parse(dismissedData);
        const dismissedSet = new Set(dismissedIds || []);
        const hasNewUnassigned = unassignedIds.some(id => !dismissedSet.has(id));
        
        if (!hasNewUnassigned) {
          return;
        }
      }
    } catch {
      sessionStorage.removeItem(sessionKey);
    }
    
    setShowPhoneNumberAlert(true);
  }, [userLoading, isLoading, user, isPro, unassignedIds.join(',')]);

  const handleDismissAlert = () => {
    if (user) {
      const sessionKey = `phone_alert_dismissed_${user.id}`;
      sessionStorage.setItem(sessionKey, JSON.stringify({ ids: unassignedIds }));
    }
    setShowPhoneNumberAlert(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="secondary">{t('campaigns.status.completed')}</Badge>;
      case 'in_progress':
        return <Badge variant="default">{t('campaigns.status.active')}</Badge>;
      case 'pending':
        return <Badge variant="outline">{t('campaigns.status.pending')}</Badge>;
      case 'scheduled':
        return <Badge variant="outline">{t('campaigns.status.scheduled')}</Badge>;
      case 'failed':
        return <Badge variant="destructive">{t('campaigns.status.failed')}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const activeCampaigns = campaigns.filter(c => c.status === 'in_progress').length;
  const completedCampaigns = campaigns.filter(c => c.status === 'completed').length;
  const pendingCampaigns = campaigns.filter(c => c.status === 'pending' || c.status === 'scheduled').length;

  const filteredContacts = contacts
    .filter((contact) => {
      const searchLower = contactSearchQuery.toLowerCase();
      const allNames = contact.names.map(n => `${n.firstName} ${n.lastName || ""}`).join(" ").toLowerCase();
      return (
        allNames.includes(searchLower) ||
        contact.phone.toLowerCase().includes(searchLower) ||
        contact.email?.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      if (contactSortBy === 'name') {
        const nameA = a.names[0] ? `${a.names[0].firstName} ${a.names[0].lastName || ""}`.trim().toLowerCase() : "";
        const nameB = b.names[0] ? `${b.names[0].firstName} ${b.names[0].lastName || ""}`.trim().toLowerCase() : "";
        return nameA.localeCompare(nameB);
      }
      if (contactSortBy === 'phone') return a.phone.localeCompare(b.phone);
      if (contactSortBy === 'status') return a.status.localeCompare(b.status);
      return 0;
    });

  const {
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    paginatedItems,
    handlePageChange,
    handleItemsPerPageChange,
  } = usePagination(filteredContacts, 25);

  const subPanelContent = (
    <div className="space-y-1">
      <SubPanelSection title={t('campaigns.allCampaigns', 'ALL CAMPAIGNS')}>
        <SubPanelItem
          icon={<Phone className="w-4 h-4" />}
          label={t('campaigns.batchCall', 'Batch Call')}
          isActive={activeView === 'batch'}
          badge={campaigns.length}
          onClick={() => setActiveView('batch')}
        />
        <SubPanelItem
          icon={<Users className="w-4 h-4" />}
          label={t('nav.contacts', 'Contacts')}
          isActive={activeView === 'contacts'}
          badge={activeView === 'contacts' ? contacts.length : undefined}
          onClick={() => setActiveView('contacts')}
        />
      </SubPanelSection>

      <SubPanelSection title={t('campaigns.status.title', 'STATUS')}>
        <div className="px-2.5 py-2 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('campaigns.status.active', 'Active')}</span>
            <span className="font-medium text-blue-600">{activeCampaigns}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('campaigns.status.completed', 'Completed')}</span>
            <span className="font-medium text-emerald-600">{completedCampaigns}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('campaigns.status.pending', 'Pending')}</span>
            <span className="font-medium">{pendingCampaigns}</span>
          </div>
        </div>
      </SubPanelSection>
    </div>
  );

  const renderBatchCallView = () => (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      <div className="flex items-center justify-between gap-2 flex-wrap py-4 px-1">
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-foreground" />
          <span className="font-medium">{t('campaigns.campaignsAndBatchCalls', 'Campaigns & Batch Calls')}</span>
        </div>
        <Button 
          onClick={() => setLocation('/app/campaigns/new')}
          data-testid="button-create-campaign"
        >
          {t('campaigns.createBatchCall', 'Create a batch call')}
        </Button>
      </div>
    
      <div className="flex-1 bg-white dark:bg-card rounded-xl border overflow-hidden">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center h-full">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md border bg-background">
              <Phone className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground" data-testid="text-empty-state">{t('campaigns.noBatchCalls', 'You don\'t have any batch calls')}</p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-medium">{t('campaigns.table.batchCallName', 'Batch Call Name')}</TableHead>
                  <TableHead className="font-medium">{t('campaigns.table.status', 'Status')}</TableHead>
                  <TableHead className="font-medium">{t('campaigns.table.recipients', 'Recipients')}</TableHead>
                  <TableHead className="font-medium">
                    <div className="flex items-center gap-1">
                      <span>{t('campaigns.table.completed', 'Completed')}</span>
                      <span className="text-muted-foreground">|</span>
                      <span>{t('campaigns.table.successful', 'Successful')}</span>
                    </div>
                  </TableHead>
                  <TableHead className="font-medium">{t('campaigns.table.lastUpdated', 'Last Updated')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow 
                    key={campaign.id} 
                    className="cursor-pointer"
                    onClick={() => setLocation(`/app/campaigns/${campaign.id}`)}
                    data-testid={`row-campaign-${campaign.id}`}
                  >
                    <TableCell className="font-medium" data-testid={`text-name-${campaign.id}`}>
                      {campaign.name}
                    </TableCell>
                    <TableCell data-testid={`status-campaign-${campaign.id}`}>
                      {getStatusBadge(campaign.status)}
                    </TableCell>
                    <TableCell data-testid={`text-recipients-${campaign.id}`}>
                      {campaign.totalContacts}
                    </TableCell>
                    <TableCell data-testid={`text-stats-${campaign.id}`}>
                      <div className="flex items-center gap-1 text-sm">
                        <span data-testid={`text-completed-${campaign.id}`}>{campaign.completedCalls}</span>
                        <span className="text-muted-foreground">|</span>
                        <span data-testid={`text-successful-${campaign.id}`}>{campaign.successfulCalls}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground" data-testid={`text-date-${campaign.id}`}>
                      {formatDate(campaign.updatedAt || campaign.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </div>

      <AlertDialog open={showPhoneNumberAlert} onOpenChange={setShowPhoneNumberAlert}>
        <AlertDialogContent data-testid="dialog-phone-number-required">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <AlertDialogTitle className="text-xl">
                {t('campaigns.phoneNumberRequired', 'Phone Number Required')}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base">
              {t('campaigns.proUserPhoneNumberMessage', 
                `You have ${campaignsWithoutPhoneNumber.length} campaign(s) that need a phone number assigned. As a Pro user, you need to use your own phone number for campaigns.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDismissAlert}>
              {t('common.remindLater', 'Remind me later')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              handleDismissAlert();
              setLocation('/app/phone-numbers');
            }}>
              {t('campaigns.managePhoneNumbers', 'Manage Phone Numbers')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  const renderContactsView = () => (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      <div className="flex items-center justify-between gap-2 flex-wrap py-4 px-1">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-foreground" />
          <span className="font-medium">{t('contacts.title', 'Contacts')}</span>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button data-testid="button-import-contacts">
                <Download className="h-4 w-4 mr-2" />
                {t('contacts.importContacts', 'Import Contacts')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Import Contacts</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => csvFileRef.current?.click()} data-testid="menu-import-csv">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Upload CSV/Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => vcardFileRef.current?.click()} data-testid="menu-import-vcard">
                <Contact2 className="h-4 w-4 mr-2" />
                Upload vCard
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleOAuthImport("google")} data-testid="menu-import-google">
                <SiGoogle className="h-4 w-4 mr-2" />
                Google Contacts
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleOAuthImport("microsoft")} data-testid="menu-import-microsoft">
                <Mail className="h-4 w-4 mr-2" />
                Microsoft Outlook
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled data-testid="menu-import-hubspot">
                <span className="flex items-center gap-2 w-full">
                  HubSpot
                  <Badge variant="secondary" className="text-[10px] ml-auto">coming soon</Badge>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem disabled data-testid="menu-import-salesforce">
                <span className="flex items-center gap-2 w-full">
                  Salesforce
                  <Badge variant="secondary" className="text-[10px] ml-auto">coming soon</Badge>
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button 
            onClick={exportToCSV}
            disabled={contacts.length === 0}
            variant="outline"
            data-testid="button-export-contacts"
          >
            <Download className="h-4 w-4 mr-2" />
            {t('contacts.exportContacts', 'Export CSV')}
          </Button>
        </div>
      </div>

      <div className="mb-3 px-1 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('contacts.searchPlaceholder', 'Search contacts...')}
            className="pl-9"
            value={contactSearchQuery}
            onChange={(e) => setContactSearchQuery(e.target.value)}
            data-testid="input-search-contacts"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" data-testid="button-sort-contacts">
              Sort: {contactSortBy === 'name' ? 'Name' : contactSortBy === 'phone' ? 'Phone' : 'Status'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setContactSortBy('name')}>Name</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setContactSortBy('phone')}>Phone</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setContactSortBy('status')}>Status</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="text-xs text-muted-foreground">{filteredContacts.length} contacts</span>
      </div>

      <div className="flex-1 bg-white dark:bg-card rounded-xl border overflow-hidden">
        {contactsLoading ? (
          <div className="flex-1 flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center h-full">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md border bg-background">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground" data-testid="text-empty-contacts">{t('contacts.noContacts', 'No contacts yet')}</p>
          </div>
        ) : (
          <ScrollArea className="h-full" type="always">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-medium w-[160px]">{t('contacts.fields.names', 'Name')}</TableHead>
                  <TableHead className="font-medium w-[140px]">{t('contacts.fields.phone', 'Phone')}</TableHead>
                  <TableHead className="font-medium hidden md:table-cell">{t('contacts.fields.email', 'Email')}</TableHead>
                  <TableHead className="font-medium w-[100px]">{t('contacts.fields.status', 'Status')}</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((contact) => {
                  const primaryName = contact.names[0];
                  const fullName = primaryName
                    ? `${primaryName.firstName} ${primaryName.lastName || ""}`.trim()
                    : "";
                  const displayName = fullName.length > 14 ? fullName.slice(0, 14) + "..." : fullName;
                  return (
                    <TableRow key={contact.id} data-testid={`row-contact-${contact.id}`}>
                      <TableCell data-testid={`cell-names-${contact.id}`} className="overflow-hidden">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
                            {fullName ? fullName.charAt(0).toUpperCase() : "?"}
                          </div>
                          <span className="font-medium text-sm" title={fullName}>
                            {displayName || <span className="text-muted-foreground italic">Unknown</span>}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs overflow-hidden text-ellipsis">{contact.phone}</TableCell>
                      <TableCell className="text-muted-foreground text-sm hidden md:table-cell overflow-hidden text-ellipsis">
                        {contact.email || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            contact.status === "completed"
                              ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-700"
                              : contact.status === "pending"
                              ? "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-700"
                              : contact.status === "incoming_call"
                              ? "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-700"
                              : contact.status === "outgoing_call"
                              ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-700"
                              : "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-500/10 dark:text-gray-400 dark:border-gray-700"
                          }
                        >
                          {contact.status === 'incoming_call' ? (
                            <><PhoneIncoming className="h-3 w-3 mr-1" />{t('calls.filters.incoming', 'Incoming')}</>
                          ) : contact.status === 'outgoing_call' ? (
                            <><PhoneOutgoing className="h-3 w-3 mr-1" />{t('calls.filters.outgoing', 'Outgoing')}</>
                          ) : (
                            contact.status
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {contact.source === 'campaign' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setDeletingContact(contact)}
                            data-testid={`button-delete-contact-${contact.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </div>

      {filteredContacts.length > 0 && (
        <div className="pt-3 px-1">
          <DataPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            onItemsPerPageChange={handleItemsPerPageChange}
            showItemsPerPage={true}
          />
        </div>
      )}

      <AlertDialog open={!!deletingContact} onOpenChange={() => setDeletingContact(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('contacts.deleteDialog.title', 'Delete Contact')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('contacts.deleteDialog.description', { name: deletingContact?.names.map(n => `${n.firstName} ${n.lastName || ""}`).join(", "), phone: deletingContact?.phone })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingContact && deleteMutation.mutate(deletingContact.id)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? t('common.deleting', 'Deleting...') : t('common.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  return (
    <>
      <ThreeColumnLayout 
        subPanel={subPanelContent} 
        subPanelWidth="sm"
        subPanelHeader={<span className="font-medium text-sm">{t('campaigns.campaignsAndBatchCalls', 'Campaigns & Batch Calls')}</span>}
      >
        {activeView === 'batch' ? renderBatchCallView() : renderContactsView()}
      </ThreeColumnLayout>
      <input ref={csvFileRef} type="file" accept=".csv,.xlsx,.xls,.txt" className="hidden" data-testid="input-csv-file" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileUpload(file, "csv"); e.target.value = ""; }} />
      <input ref={vcardFileRef} type="file" accept=".vcf,.vcard" className="hidden" data-testid="input-vcard-file" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileUpload(file, "vcard"); e.target.value = ""; }} />
    </>
  );
}
