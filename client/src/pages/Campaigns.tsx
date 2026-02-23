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
import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { ThreeColumnLayout, SubPanelSection, SubPanelItem } from "@/components/ThreeColumnLayout";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";
import { Checkbox } from "@/components/ui/checkbox";
import { Phone, AlertTriangle, Loader2, Users, Search, Trash2, Upload, Download, PhoneIncoming, PhoneOutgoing, Plus, FileSpreadsheet, Contact2, Mail, Pencil, GripVertical, LayoutGrid, List, Globe, Tag, Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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

type ViewMode = 'batch' | 'contacts';

export default function Campaigns() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [showPhoneNumberAlert, setShowPhoneNumberAlert] = useState(false);
  const [activeView, setActiveView] = useState<ViewMode>('batch');
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [deletingContact, setDeletingContact] = useState<DeduplicatedContact | null>(null);
  const [editingContact, setEditingContact] = useState<DeduplicatedContact | null>(null);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", phone: "", email: "" });
  const [contactSortBy, setContactSortBy] = useState<'name' | 'phone'>('name');
  const [contactViewMode, setContactViewMode] = useState<'list' | 'country' | 'groups' | 'grid'>('list');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string | null>(null);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupColor, setNewGroupColor] = useState("#6366f1");
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [colWidths, setColWidths] = useState({ name: 160, phone: 140, email: 200, actions: 50 });
  const resizingCol = useRef<{ col: string; startX: number; startW: number } | null>(null);
  const csvFileRef = useRef<HTMLInputElement>(null);
  const vcardFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setSelectedContacts(new Set()); }, [contactViewMode]);

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

  const { data: contactGroups = [] } = useQuery<ContactGroup[]>({
    queryKey: ["/api/contact-groups"],
    enabled: activeView === 'contacts',
  });

  const { data: groupMemberships = [] } = useQuery<GroupMembership[]>({
    queryKey: ["/api/contact-group-memberships"],
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

  const editContactMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { firstName: string; lastName: string; phone: string; email: string } }) => {
      const res = await apiRequest("PUT", `/api/contacts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/deduplicated"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setEditingContact(null);
      toast({ title: "Contact updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update contact", description: error.message || "Please try again", variant: "destructive" });
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      const res = await apiRequest("POST", "/api/contact-groups", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-groups"] });
      setCreateGroupOpen(false);
      setNewGroupName("");
      toast({ title: "Group created" });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/contact-groups/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contact-group-memberships"] });
      if (selectedGroupFilter) setSelectedGroupFilter(null);
      toast({ title: "Group deleted" });
    },
  });

  const addToGroupMutation = useMutation({
    mutationFn: async ({ groupId, contactPhone }: { groupId: string; contactPhone: string }) => {
      const res = await apiRequest("POST", `/api/contact-groups/${groupId}/members`, { contactPhone });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-group-memberships"] });
      toast({ title: "Added to group" });
    },
  });

  const removeFromGroupMutation = useMutation({
    mutationFn: async ({ groupId, contactPhone }: { groupId: string; contactPhone: string }) => {
      const res = await apiRequest("DELETE", `/api/contact-groups/${groupId}/members/${encodeURIComponent(contactPhone)}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-group-memberships"] });
      toast({ title: "Removed from group" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (contactIds: string[]) => {
      const res = await apiRequest("POST", "/api/contacts/bulk-delete", { contactIds });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/deduplicated"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setSelectedContacts(new Set());
      toast({ title: `Deleted ${data.deleted} contacts` });
    },
  });

  const bulkAssignGroupMutation = useMutation({
    mutationFn: async ({ groupId, phones }: { groupId: string; phones: string[] }) => {
      const res = await apiRequest("POST", `/api/contact-groups/${groupId}/members/bulk`, { phones });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-group-memberships"] });
      setSelectedContacts(new Set());
      toast({ title: `Added ${data.added} contacts to group` });
    },
  });

  const bulkRemoveGroupMutation = useMutation({
    mutationFn: async ({ groupId, phones }: { groupId: string; phones: string[] }) => {
      const res = await apiRequest("POST", `/api/contact-groups/${groupId}/members/bulk-remove`, { phones });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-group-memberships"] });
      setSelectedContacts(new Set());
      toast({ title: "Removed contacts from group" });
    },
  });

  const getContactGroups = useCallback((phone: string) => {
    return groupMemberships.filter(m => m.contact_phone === phone);
  }, [groupMemberships]);

  const openEditDialog = (contact: DeduplicatedContact) => {
    if (contact.source !== 'campaign') return;
    const first = contact.names[0];
    setEditForm({
      firstName: first?.firstName || "",
      lastName: first?.lastName || "",
      phone: contact.phone,
      email: contact.email || "",
    });
    setEditingContact(contact);
  };

  const handleResizeStart = useCallback((col: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = colWidths[col as keyof typeof colWidths] || 150;
    resizingCol.current = { col, startX, startW };

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingCol.current) return;
      const diff = ev.clientX - resizingCol.current.startX;
      const newW = Math.max(60, resizingCol.current.startW + diff);
      setColWidths(prev => ({ ...prev, [resizingCol.current!.col]: newW }));
    };

    const onMouseUp = () => {
      resizingCol.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [colWidths]);

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
      const matchesSearch = allNames.includes(searchLower) || contact.phone.toLowerCase().includes(searchLower) || contact.email?.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
      if (selectedGroupFilter) {
        return groupMemberships.some(m => m.contact_phone === contact.phone && m.group_id === selectedGroupFilter);
      }
      return true;
    })
    .sort((a, b) => {
      if (contactSortBy === 'name') {
        const nameA = a.names[0] ? `${a.names[0].firstName} ${a.names[0].lastName || ""}`.trim().toLowerCase() : "";
        const nameB = b.names[0] ? `${b.names[0].firstName} ${b.names[0].lastName || ""}`.trim().toLowerCase() : "";
        return nameA.localeCompare(nameB);
      }
      if (contactSortBy === 'phone') return a.phone.localeCompare(b.phone);
      return 0;
    });

  const countryGroups = useMemo(() => {
    const groups: Record<string, typeof filteredContacts> = {};
    filteredContacts.forEach(contact => {
      const country = getCountryFromPhone(contact.phone);
      if (!groups[country]) groups[country] = [];
      groups[country].push(contact);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredContacts]);

  const {
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    paginatedItems,
    handlePageChange,
    handleItemsPerPageChange,
  } = usePagination(filteredContacts, 25);

  const toggleContactSelection = useCallback((id: string) => {
    setSelectedContacts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedContacts.size === paginatedItems.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(paginatedItems.map(c => c.id)));
    }
  }, [paginatedItems, selectedContacts.size]);

  const selectedPhones = useMemo(() => {
    return contacts.filter(c => selectedContacts.has(c.id)).map(c => c.phone);
  }, [contacts, selectedContacts]);

  const bulkExportSelected = useCallback(() => {
    const selected = contacts.filter(c => selectedContacts.has(c.id));
    if (selected.length === 0) return;
    const headers = ["Phone", "Names", "Email", "Source"];
    const rows = selected.map(contact => [
      contact.phone,
      contact.names.map(n => `${n.firstName} ${n.lastName || ""}`).join("; "),
      contact.email || "",
      contact.source,
    ]);
    const csvContent = [headers.join(","), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `contacts_selected_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: `Exported ${selected.length} contacts` });
  }, [contacts, selectedContacts, toast]);

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
              Sort: {contactSortBy === 'name' ? 'Name' : 'Phone'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setContactSortBy('name')}>Name</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setContactSortBy('phone')}>Phone</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" data-testid="button-view-mode">
              <LayoutGrid className="h-4 w-4 mr-1" />
              {contactViewMode === 'list' ? 'List' : contactViewMode === 'grid' ? 'Grid' : contactViewMode === 'country' ? 'By Country' : 'Groups'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setContactViewMode('list')}>
              <List className="h-4 w-4 mr-2" /> List View
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setContactViewMode('grid')}>
              <LayoutGrid className="h-4 w-4 mr-2" /> Grid View
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setContactViewMode('country')}>
              <Globe className="h-4 w-4 mr-2" /> Group by Country
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setContactViewMode('groups')}>
              <Tag className="h-4 w-4 mr-2" /> Groups
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="text-xs text-muted-foreground">{filteredContacts.length} contacts</span>
      </div>

      <div className="mb-3 px-1 flex items-center gap-2 flex-wrap">
        <Button
          variant={selectedGroupFilter === null ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedGroupFilter(null)}
        >
          All
        </Button>
        {contactGroups.map(group => {
          const count = groupMemberships.filter(m => m.group_id === group.id).length;
          return (
            <Button
              key={group.id}
              variant={selectedGroupFilter === group.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedGroupFilter(group.id === selectedGroupFilter ? null : group.id)}
              className="gap-1.5"
            >
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: group.color }} />
              {group.name}
              <Badge variant="secondary" className="text-[10px] ml-1">{count}</Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 ml-0.5 -mr-1"
                onClick={(e) => { e.stopPropagation(); deleteGroupMutation.mutate(group.id); }}
              >
                <X className="h-3 w-3" />
              </Button>
            </Button>
          );
        })}
        <Button variant="ghost" size="sm" onClick={() => setCreateGroupOpen(true)} data-testid="button-new-group">
          <Plus className="h-4 w-4 mr-1" /> New Group
        </Button>
      </div>

      {selectedContacts.size > 0 && (
        <div className="mb-3 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{selectedContacts.size} selected</span>
          <div className="h-4 w-px bg-border" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-bulk-assign-group">
                <Tag className="h-4 w-4 mr-1" /> Assign to Group
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {contactGroups.map(group => (
                <DropdownMenuItem
                  key={group.id}
                  onClick={() => bulkAssignGroupMutation.mutate({ groupId: group.id, phones: selectedPhones })}
                >
                  <div className="h-3 w-3 rounded-full mr-2" style={{ backgroundColor: group.color }} />
                  {group.name}
                </DropdownMenuItem>
              ))}
              {contactGroups.length === 0 && <DropdownMenuItem disabled>No groups yet</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-bulk-remove-group">
                <X className="h-4 w-4 mr-1" /> Remove from Group
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {contactGroups.map(group => (
                <DropdownMenuItem
                  key={group.id}
                  onClick={() => bulkRemoveGroupMutation.mutate({ groupId: group.id, phones: selectedPhones })}
                >
                  <div className="h-3 w-3 rounded-full mr-2" style={{ backgroundColor: group.color }} />
                  {group.name}
                </DropdownMenuItem>
              ))}
              {contactGroups.length === 0 && <DropdownMenuItem disabled>No groups yet</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={bulkExportSelected} data-testid="button-bulk-export">
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => bulkDeleteMutation.mutate(Array.from(selectedContacts))}
            disabled={bulkDeleteMutation.isPending}
            data-testid="button-bulk-delete"
          >
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedContacts(new Set())} className="ml-auto">
            Clear
          </Button>
        </div>
      )}

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
            {contactViewMode === 'country' ? (
              <div>
                {countryGroups.map(([country, groupContacts]) => (
                  <div key={country}>
                    <div className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm px-4 py-2 flex items-center gap-2 border-b">
                      <span className="text-base">{getCountryFlag(country)}</span>
                      <span className="font-medium text-sm">{country}</span>
                      <Badge variant="secondary">{groupContacts.length}</Badge>
                    </div>
                    <Table style={{ tableLayout: 'fixed', width: '100%' }}>
                      <colgroup>
                        <col style={{ width: 40 }} />
                        <col style={{ width: colWidths.name }} />
                        <col style={{ width: colWidths.phone }} />
                        <col style={{ width: colWidths.email }} className="hidden md:table-column" />
                        <col style={{ width: colWidths.actions }} />
                      </colgroup>
                      <TableBody>
                        {groupContacts.map((contact) => {
                          const primaryName = contact.names[0];
                          const fullName = primaryName
                            ? `${primaryName.firstName} ${primaryName.lastName || ""}`.trim()
                            : "";
                          const displayName = fullName.length > 14 ? fullName.slice(0, 14) + "..." : fullName;
                          return (
                            <TableRow
                              key={contact.id}
                              data-testid={`row-contact-${contact.id}`}
                              className={contact.source === 'campaign' ? "cursor-pointer hover:bg-muted/50" : ""}
                              onClick={() => openEditDialog(contact)}
                            >
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Checkbox checked={selectedContacts.has(contact.id)} onCheckedChange={() => toggleContactSelection(contact.id)} data-testid={`checkbox-contact-${contact.id}`} />
                              </TableCell>
                              <TableCell data-testid={`cell-names-${contact.id}`} className="overflow-hidden">
                                <div className="flex items-center gap-2">
                                  <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
                                    {fullName ? fullName.charAt(0).toUpperCase() : "?"}
                                  </div>
                                  <span className="font-medium text-sm" title={fullName}>
                                    {displayName || <span className="text-muted-foreground italic">Unknown</span>}
                                  </span>
                                  {getContactGroups(contact.phone).map(g => (
                                    <span key={g.group_id} className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white ml-1" style={{ backgroundColor: g.group_color }}>
                                      {g.group_name}
                                    </span>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-xs overflow-hidden text-ellipsis whitespace-nowrap">{contact.phone}</TableCell>
                              <TableCell className="text-muted-foreground text-sm hidden md:table-cell overflow-hidden text-ellipsis whitespace-nowrap">
                                {contact.email || "-"}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()} data-testid={`button-groups-${contact.id}`}>
                                        <Tag className="h-4 w-4 text-muted-foreground" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                      <DropdownMenuLabel>Assign to Group</DropdownMenuLabel>
                                      <DropdownMenuSeparator />
                                      {contactGroups.length === 0 ? (
                                        <DropdownMenuItem disabled>No groups yet</DropdownMenuItem>
                                      ) : (
                                        contactGroups.map(group => {
                                          const isMember = groupMemberships.some(m => m.contact_phone === contact.phone && m.group_id === group.id);
                                          return (
                                            <DropdownMenuItem
                                              key={group.id}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (isMember) {
                                                  removeFromGroupMutation.mutate({ groupId: group.id, contactPhone: contact.phone });
                                                } else {
                                                  addToGroupMutation.mutate({ groupId: group.id, contactPhone: contact.phone });
                                                }
                                              }}
                                            >
                                              <div className="flex items-center gap-2 w-full">
                                                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: group.color }} />
                                                <span>{group.name}</span>
                                                {isMember && <Check className="h-3 w-3 ml-auto" />}
                                              </div>
                                            </DropdownMenuItem>
                                          );
                                        })
                                      )}
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setCreateGroupOpen(true); }}>
                                        <Plus className="h-4 w-4 mr-2" /> New Group
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                  {contact.source === 'campaign' && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={(e) => { e.stopPropagation(); setDeletingContact(contact); }}
                                      data-testid={`button-delete-contact-${contact.id}`}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            ) : contactViewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
                {paginatedItems.map((contact) => {
                  const primaryName = contact.names[0];
                  const fullName = primaryName
                    ? `${primaryName.firstName} ${primaryName.lastName || ""}`.trim()
                    : "";
                  const initials = fullName ? fullName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) : "?";
                  return (
                    <div
                      key={contact.id}
                      data-testid={`card-contact-${contact.id}`}
                      className="bg-background border rounded-xl p-4 flex flex-col items-center text-center gap-2 hover:shadow-md transition-shadow cursor-pointer group relative"
                      onClick={() => openEditDialog(contact)}
                    >
                      <div className="absolute top-2 left-2">
                        <Checkbox checked={selectedContacts.has(contact.id)} onCheckedChange={(e) => { toggleContactSelection(contact.id); }} onClick={(e: any) => e.stopPropagation()} data-testid={`checkbox-contact-${contact.id}`} />
                      </div>
                      <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuLabel>Assign to Group</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {contactGroups.length === 0 ? (
                              <DropdownMenuItem disabled>No groups yet</DropdownMenuItem>
                            ) : (
                              contactGroups.map(group => {
                                const isMember = groupMemberships.some(m => m.contact_phone === contact.phone && m.group_id === group.id);
                                return (
                                  <DropdownMenuItem
                                    key={group.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isMember) removeFromGroupMutation.mutate({ groupId: group.id, contactPhone: contact.phone });
                                      else addToGroupMutation.mutate({ groupId: group.id, contactPhone: contact.phone });
                                    }}
                                  >
                                    <div className="flex items-center gap-2 w-full">
                                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: group.color }} />
                                      <span>{group.name}</span>
                                      {isMember && <Check className="h-3 w-3 ml-auto" />}
                                    </div>
                                  </DropdownMenuItem>
                                );
                              })
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setCreateGroupOpen(true); }}>
                              <Plus className="h-4 w-4 mr-2" /> New Group
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {contact.source === 'campaign' && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setDeletingContact(contact); }}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border flex items-center justify-center text-sm font-semibold text-primary">
                        {initials}
                      </div>
                      <div className="font-medium text-sm truncate max-w-full">
                        {fullName || <span className="text-muted-foreground italic">Unknown</span>}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground truncate max-w-full">{contact.phone}</div>
                      {contact.email && <div className="text-xs text-muted-foreground truncate max-w-full">{contact.email}</div>}
                      {getContactGroups(contact.phone).length > 0 && (
                        <div className="flex flex-wrap gap-1 justify-center mt-1">
                          {getContactGroups(contact.phone).map(g => (
                            <span key={g.group_id} className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white" style={{ backgroundColor: g.group_color }}>
                              {g.group_name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <Table style={{ tableLayout: 'fixed', width: '100%' }}>
                <colgroup>
                  <col style={{ width: 40 }} />
                  <col style={{ width: colWidths.name }} />
                  <col style={{ width: colWidths.phone }} />
                  <col style={{ width: colWidths.email }} className="hidden md:table-column" />
                  <col style={{ width: colWidths.actions }} />
                </colgroup>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-[40px]">
                      <Checkbox checked={paginatedItems.length > 0 && selectedContacts.size === paginatedItems.length} onCheckedChange={toggleSelectAll} data-testid="checkbox-select-all" />
                    </TableHead>
                    <TableHead className="font-medium relative select-none">
                      {t('contacts.fields.names', 'Name')}
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50" onMouseDown={(e) => handleResizeStart('name', e)} />
                    </TableHead>
                    <TableHead className="font-medium relative select-none">
                      {t('contacts.fields.phone', 'Phone')}
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50" onMouseDown={(e) => handleResizeStart('phone', e)} />
                    </TableHead>
                    <TableHead className="font-medium hidden md:table-cell relative select-none">
                      {t('contacts.fields.email', 'Email')}
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50" onMouseDown={(e) => handleResizeStart('email', e)} />
                    </TableHead>
                    <TableHead className="w-[80px]"></TableHead>
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
                      <TableRow
                        key={contact.id}
                        data-testid={`row-contact-${contact.id}`}
                        className={contact.source === 'campaign' ? "cursor-pointer hover:bg-muted/50" : ""}
                        onClick={() => openEditDialog(contact)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={selectedContacts.has(contact.id)} onCheckedChange={() => toggleContactSelection(contact.id)} data-testid={`checkbox-contact-${contact.id}`} />
                        </TableCell>
                        <TableCell data-testid={`cell-names-${contact.id}`} className="overflow-hidden">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
                              {fullName ? fullName.charAt(0).toUpperCase() : "?"}
                            </div>
                            <span className="font-medium text-sm" title={fullName}>
                              {displayName || <span className="text-muted-foreground italic">Unknown</span>}
                            </span>
                            {getContactGroups(contact.phone).map(g => (
                              <span key={g.group_id} className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white ml-1" style={{ backgroundColor: g.group_color }}>
                                {g.group_name}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs overflow-hidden text-ellipsis whitespace-nowrap">{contact.phone}</TableCell>
                        <TableCell className="text-muted-foreground text-sm hidden md:table-cell overflow-hidden text-ellipsis whitespace-nowrap">
                          {contact.email || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()} data-testid={`button-groups-${contact.id}`}>
                                  <Tag className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuLabel>Assign to Group</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {contactGroups.length === 0 ? (
                                  <DropdownMenuItem disabled>No groups yet</DropdownMenuItem>
                                ) : (
                                  contactGroups.map(group => {
                                    const isMember = groupMemberships.some(m => m.contact_phone === contact.phone && m.group_id === group.id);
                                    return (
                                      <DropdownMenuItem
                                        key={group.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (isMember) {
                                            removeFromGroupMutation.mutate({ groupId: group.id, contactPhone: contact.phone });
                                          } else {
                                            addToGroupMutation.mutate({ groupId: group.id, contactPhone: contact.phone });
                                          }
                                        }}
                                      >
                                        <div className="flex items-center gap-2 w-full">
                                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: group.color }} />
                                          <span>{group.name}</span>
                                          {isMember && <Check className="h-3 w-3 ml-auto" />}
                                        </div>
                                      </DropdownMenuItem>
                                    );
                                  })
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setCreateGroupOpen(true); }}>
                                  <Plus className="h-4 w-4 mr-2" /> New Group
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            {contact.source === 'campaign' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => { e.stopPropagation(); setDeletingContact(contact); }}
                                data-testid={`button-delete-contact-${contact.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        )}
      </div>

      {(contactViewMode === 'list' || contactViewMode === 'groups' || contactViewMode === 'grid') && filteredContacts.length > 0 && (
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

      <Dialog open={!!editingContact} onOpenChange={(open) => { if (!open) setEditingContact(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-firstName">First Name</Label>
                <Input
                  id="edit-firstName"
                  value={editForm.firstName}
                  onChange={(e) => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder="First name"
                  data-testid="input-edit-firstname"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-lastName">Last Name</Label>
                <Input
                  id="edit-lastName"
                  value={editForm.lastName}
                  onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Last name"
                  data-testid="input-edit-lastname"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={editForm.phone}
                onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+1234567890"
                data-testid="input-edit-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="email@example.com"
                data-testid="input-edit-email"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingContact(null)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button
              onClick={() => editingContact && editContactMutation.mutate({ id: editingContact.id, data: editForm })}
              disabled={editContactMutation.isPending || !editForm.phone}
              data-testid="button-confirm-edit"
            >
              {editContactMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createGroupOpen} onOpenChange={setCreateGroupOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Create New Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="group-name">Group Name</Label>
              <Input
                id="group-name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="e.g. VIP, Priority, Follow-up"
                data-testid="input-group-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#64748b'].map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`h-8 w-8 rounded-full border-2 ${newGroupColor === color ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewGroupColor(color)}
                    data-testid={`button-color-${color}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateGroupOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createGroupMutation.mutate({ name: newGroupName, color: newGroupColor })}
              disabled={createGroupMutation.isPending || !newGroupName.trim()}
              data-testid="button-create-group"
            >
              {createGroupMutation.isPending ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>) : "Create Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
