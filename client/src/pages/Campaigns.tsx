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
import { useState, useEffect, lazy, Suspense } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { ThreeColumnLayout, SubPanelSection, SubPanelItem } from "@/components/ThreeColumnLayout";
import FormsPage from "@/pages/FormsPage";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";
import { Phone, AlertTriangle, Loader2, Users, Search, Trash2, Upload, Download, PhoneIncoming, PhoneOutgoing, FileText } from "lucide-react";
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

type ViewMode = 'batch' | 'contacts' | 'forms';

export default function Campaigns() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [showPhoneNumberAlert, setShowPhoneNumberAlert] = useState(false);
  const [activeView, setActiveView] = useState<ViewMode>('batch');
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [deletingContact, setDeletingContact] = useState<DeduplicatedContact | null>(null);

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

  const filteredContacts = contacts.filter((contact) => {
    const searchLower = contactSearchQuery.toLowerCase();
    const allNames = contact.names.map(n => `${n.firstName} ${n.lastName || ""}`).join(" ").toLowerCase();
    return (
      allNames.includes(searchLower) ||
      contact.phone.toLowerCase().includes(searchLower) ||
      contact.email?.toLowerCase().includes(searchLower)
    );
  });

  const {
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    paginatedItems,
    handlePageChange,
    handleItemsPerPageChange,
  } = usePagination(filteredContacts, 10);

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
      
      <SubPanelSection title={t('campaigns.tools', 'TOOLS')}>
        <SubPanelItem
          icon={<FileText className="w-4 h-4" />}
          label={t('nav.forms', 'Forms')}
          isActive={activeView === 'forms'}
          onClick={() => setActiveView('forms')}
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

      <div className="mb-3 px-1">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('contacts.searchPlaceholder', 'Search contacts...')}
            className="pl-9"
            value={contactSearchQuery}
            onChange={(e) => setContactSearchQuery(e.target.value)}
            data-testid="input-search-contacts"
          />
        </div>
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
          <ScrollArea className="h-full">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-medium">{t('contacts.fields.source', 'Source')}</TableHead>
                  <TableHead className="font-medium">{t('contacts.fields.names', 'Names')}</TableHead>
                  <TableHead className="font-medium">{t('contacts.fields.phone', 'Phone')}</TableHead>
                  <TableHead className="font-medium hidden md:table-cell">{t('contacts.fields.email', 'Email')}</TableHead>
                  <TableHead className="font-medium hidden lg:table-cell">{t('contacts.fields.campaigns', 'Campaigns')}</TableHead>
                  <TableHead className="font-medium">{t('contacts.fields.status', 'Status')}</TableHead>
                  <TableHead className="w-[80px]">{t('contacts.fields.actions', 'Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((contact) => (
                  <TableRow key={contact.id} data-testid={`row-contact-${contact.id}`}>
                    <TableCell>
                      {contact.source === 'campaign' ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-700">
                          <Upload className="h-3 w-3 mr-1" />
                          {t('contacts.source.campaign', 'Campaign')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-700">
                          {contact.status === 'incoming_call' ? (
                            <PhoneIncoming className="h-3 w-3 mr-1" />
                          ) : (
                            <PhoneOutgoing className="h-3 w-3 mr-1" />
                          )}
                          {t('contacts.source.call', 'Call')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium" data-testid={`cell-names-${contact.id}`}>
                      {contact.names.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {contact.names.map((name, idx) => (
                            <div key={idx} className="text-sm">
                              {name.firstName} {name.lastName || ""}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">{t('contacts.unknown', 'Unknown')}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{contact.phone}</TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">
                      {contact.email || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden lg:table-cell">
                      {contact.campaigns.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {contact.campaigns.map((campaign) => (
                            <Badge key={campaign.id} variant="secondary" className="text-xs">
                              {campaign.name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                          contact.status === "completed"
                            ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                            : contact.status === "pending"
                            ? "bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400"
                            : contact.status === "incoming_call"
                            ? "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400"
                            : contact.status === "outgoing_call"
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                            : "bg-gray-50 text-gray-700 dark:bg-gray-500/10 dark:text-gray-400"
                        }`}
                      >
                        {contact.status === 'incoming_call' ? t('calls.filters.incoming', 'Incoming') : 
                         contact.status === 'outgoing_call' ? t('calls.filters.outgoing', 'Outgoing') : contact.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {contact.source === 'campaign' ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingContact(contact)}
                          data-testid={`button-delete-contact-${contact.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
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
    <ThreeColumnLayout 
      subPanel={subPanelContent} 
      subPanelWidth="sm"
      subPanelHeader={<span className="font-medium text-sm">{t('campaigns.campaignsAndBatchCalls', 'Campaigns & Batch Calls')}</span>}
    >
      {activeView === 'batch' ? renderBatchCallView() : activeView === 'forms' ? (
        <div className="p-6 overflow-auto h-[calc(100vh-120px)]">
          <FormsPage />
        </div>
      ) : renderContactsView()}
    </ThreeColumnLayout>
  );
}
