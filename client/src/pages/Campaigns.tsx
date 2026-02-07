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
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { ThreeColumnLayout, SubPanelSection, SubPanelItem } from "@/components/ThreeColumnLayout";
import { Badge } from "@/components/ui/badge";
import { Phone, AlertTriangle, Loader2, Users } from "lucide-react";
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

export default function Campaigns() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const [showPhoneNumberAlert, setShowPhoneNumberAlert] = useState(false);

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

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

  const subPanelContent = (
    <div className="space-y-1">
      <SubPanelSection title={t('campaigns.allCampaigns', 'ALL CAMPAIGNS')}>
        <SubPanelItem
          icon={<Phone className="w-4 h-4" />}
          label={t('campaigns.batchCall', 'Batch Call')}
          isActive={true}
          badge={campaigns.length}
        />
        <SubPanelItem
          icon={<Users className="w-4 h-4" />}
          label={t('nav.contacts', 'Contacts')}
          isActive={false}
          onClick={() => setLocation('/app/contacts')}
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

  return (
    <ThreeColumnLayout 
      subPanel={subPanelContent} 
      subPanelWidth="sm"
      subPanelHeader={<span className="font-medium text-sm">{t('campaigns.campaignsAndBatchCalls', 'Campaigns & Batch Calls')}</span>}
    >
      <div className="flex flex-col h-[calc(100vh-120px)]">
        {/* Header */}
        <div className="flex items-center justify-between py-4 px-1">
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
      
      {/* White Content Container */}
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
    </ThreeColumnLayout>
  );
}
