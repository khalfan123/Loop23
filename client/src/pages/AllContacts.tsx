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
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";
import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Users,
  Trash2,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Upload,
  Download,
  UserPlus,
  Pencil,
  FileSpreadsheet,
  Contact2,
  Mail,
  Loader2,
  LayoutGrid,
  List,
  Globe,
  Tag,
  Check,
  X,
  Plus,
} from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

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

export default function AllContacts() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingContact, setDeletingContact] = useState<DeduplicatedContact | null>(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<DeduplicatedContact | null>(null);
  const [addForm, setAddForm] = useState({ firstName: "", lastName: "", phone: "", email: "" });
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", phone: "", email: "" });
  const [contactViewMode, setContactViewMode] = useState<'list' | 'country' | 'groups' | 'grid'>('list');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string | null>(null);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupColor, setNewGroupColor] = useState("#6366f1");
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const csvFileRef = useRef<HTMLInputElement>(null);
  const vcardFileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => { setSelectedContacts(new Set()); }, [contactViewMode]);

  const { data: contacts = [], isLoading } = useQuery<DeduplicatedContact[]>({
    queryKey: ["/api/contacts/deduplicated"],
  });

  const { data: contactGroups = [] } = useQuery<ContactGroup[]>({
    queryKey: ["/api/contact-groups"],
  });

  const { data: groupMemberships = [] } = useQuery<GroupMembership[]>({
    queryKey: ["/api/contact-group-memberships"],
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
      toast({ title: "Contact deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete contact",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/contacts/all");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/deduplicated"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setDeleteAllOpen(false);
      toast({ title: "All contacts deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete all contacts",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const addContactMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; phone: string; email: string }) => {
      const res = await apiRequest("POST", "/api/contacts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/deduplicated"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setAddDialogOpen(false);
      setAddForm({ firstName: "", lastName: "", phone: "", email: "" });
      toast({ title: "Contact added successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add contact",
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
      toast({
        title: "Failed to update contact",
        description: error.message || "Please try again",
        variant: "destructive",
      });
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

  const handleFileUpload = async (file: File, type: "csv" | "vcard") => {
    const formData = new FormData();
    formData.append("file", file);

    const endpoint = type === "csv" ? "/api/contact-import/csv" : "/api/contact-import/vcard";

    toast({ title: `Importing ${type === "csv" ? "CSV/Excel" : "vCard"} file...` });

    try {
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

      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/deduplicated"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({
        title: "Import completed",
        description: `Imported ${result.imported} contacts${result.skipped ? `, ${result.skipped} skipped` : ""}`,
      });
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error.message || "An error occurred during import",
        variant: "destructive",
      });
    }
  };

  const handleOAuthImport = async (provider: "google" | "microsoft") => {
    try {
      const endpoint = provider === "google"
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
          `${provider}-auth`,
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
        );

        toast({ title: `Connecting to ${provider === "google" ? "Google" : "Microsoft"}...` });

        const handleMessage = async (event: MessageEvent) => {
          const protocol = window.location.protocol;
          const host = window.location.host;
          if (event.origin !== `${protocol}//${host}`) return;
          if (!event.data || typeof event.data !== 'object') return;

          if (event.data.type === 'oauth-success') {
            window.removeEventListener('message', handleMessage);

            toast({ title: `Importing contacts from ${provider === "google" ? "Google" : "Microsoft"}...` });

            try {
              const fetchEndpoint = `/api/contact-import/${provider}/fetch`;
              const fetchRes = await apiRequest("POST", fetchEndpoint, {
                accessToken: event.data.accessToken,
              });

              if (!fetchRes.ok) {
                const err = await fetchRes.json();
                throw new Error(err.error || "Import failed");
              }

              const result = await fetchRes.json();
              queryClient.invalidateQueries({ queryKey: ["/api/contacts/deduplicated"] });
              queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
              toast({
                title: "Import completed",
                description: `Imported ${result.imported} contacts${result.skipped ? `, ${result.skipped} skipped` : ""}`,
              });
            } catch (fetchError: any) {
              toast({
                title: "Import failed",
                description: fetchError.message || "Failed to import contacts",
                variant: "destructive",
              });
            }
          } else if (event.data.type === 'oauth-error') {
            window.removeEventListener('message', handleMessage);
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
              window.removeEventListener('message', handleMessage);
            }, 1000);
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

  const exportToCSV = () => {
    if (contacts.length === 0) {
      toast({
        title: "No contacts to export",
        description: "Add some contacts before exporting",
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

  const filteredContacts = contacts.filter((contact) => {
    const searchLower = searchQuery.toLowerCase();
    const allNames = contact.names.map(n => `${n.firstName} ${n.lastName || ""}`).join(" ").toLowerCase();
    const matchesSearch = allNames.includes(searchLower) ||
      contact.phone.toLowerCase().includes(searchLower) ||
      contact.email?.toLowerCase().includes(searchLower);
    if (!matchesSearch) return false;
    if (selectedGroupFilter) {
      return groupMemberships.some(m => m.contact_phone === contact.phone && m.group_id === selectedGroupFilter);
    }
    return true;
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
  } = usePagination(filteredContacts, 10);

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

  const campaignContactsCount = contacts.filter(c => c.source === 'campaign').length;
  const callOnlyContactsCount = contacts.filter(c => c.source === 'call').length;
  const campaignCount = new Set(contacts.flatMap(c => c.campaigns.map(camp => camp.id))).size;

  const openEditDialog = (contact: DeduplicatedContact) => {
    const firstNameEntry = contact.names[0];
    setEditForm({
      firstName: firstNameEntry?.firstName || "",
      lastName: firstNameEntry?.lastName || "",
      phone: contact.phone,
      email: contact.email || "",
    });
    setEditingContact(contact);
  };

  return (
    <div className="space-y-6">
      <input
        ref={csvFileRef}
        type="file"
        accept=".csv,.xlsx,.xls,.txt"
        className="hidden"
        data-testid="input-csv-file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file, "csv");
          e.target.value = "";
        }}
      />
      <input
        ref={vcardFileRef}
        type="file"
        accept=".vcf,.vcard"
        className="hidden"
        data-testid="input-vcard-file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file, "vcard");
          e.target.value = "";
        }}
      />

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-50 via-cyan-100/50 to-emerald-50 dark:from-teal-950/40 dark:via-cyan-900/30 dark:to-emerald-950/40 border border-teal-100 dark:border-teal-900/50 p-6 md:p-8">
        <div className="absolute inset-0 bg-grid-slate-200/50 dark:bg-grid-slate-700/20 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.5))]" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-teal-500/25">
              <Users className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">{t('contacts.title')}</h1>
              <p className="text-muted-foreground mt-0.5">{t('contacts.description')}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setAddDialogOpen(true)}
              data-testid="button-add-contact"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" data-testid="button-import-contacts">
                  <Download className="h-4 w-4 mr-2" />
                  Import
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Import Contacts</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => csvFileRef.current?.click()}
                  data-testid="menu-import-csv"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Upload CSV/Excel
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => vcardFileRef.current?.click()}
                  data-testid="menu-import-vcard"
                >
                  <Contact2 className="h-4 w-4 mr-2" />
                  Upload vCard
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleOAuthImport("google")}
                  data-testid="menu-import-google"
                >
                  <SiGoogle className="h-4 w-4 mr-2" />
                  Google Contacts
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleOAuthImport("microsoft")}
                  data-testid="menu-import-microsoft"
                >
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
              <Upload className="h-4 w-4 mr-2" />
              {t('contacts.exportContacts')}
            </Button>

            <Button
              onClick={() => setDeleteAllOpen(true)}
              disabled={contacts.length === 0}
              variant="destructive"
              data-testid="button-delete-all"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete All
            </Button>
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white/80 dark:bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-teal-100/50 dark:border-teal-800/30">
            <div className="text-2xl font-bold text-teal-700 dark:text-teal-300" data-testid="text-total-contacts">{contacts.length}</div>
            <div className="text-teal-600/70 dark:text-teal-400/70 text-sm">{t('contacts.stats.uniqueContacts')}</div>
          </div>
          <div className="bg-white/80 dark:bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-emerald-100/50 dark:border-emerald-800/30">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{campaignContactsCount}</div>
            </div>
            <div className="text-emerald-600/70 dark:text-emerald-400/70 text-sm">{t('contacts.stats.fromCampaigns')}</div>
          </div>
          <div className="bg-white/80 dark:bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-violet-100/50 dark:border-violet-800/30">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              <div className="text-2xl font-bold text-violet-700 dark:text-violet-300">{callOnlyContactsCount}</div>
            </div>
            <div className="text-violet-600/70 dark:text-violet-400/70 text-sm">{t('contacts.stats.fromCalls')}</div>
          </div>
          <div className="bg-white/80 dark:bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-cyan-100/50 dark:border-cyan-800/30">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">{campaignCount}</div>
            </div>
            <div className="text-cyan-600/70 dark:text-cyan-400/70 text-sm">{t('contacts.stats.campaigns')}</div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('contacts.searchPlaceholder')}
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-contacts"
          />
        </div>
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

      <div className="flex items-center gap-2 flex-wrap">
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
        <div className="px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg flex items-center gap-2 flex-wrap">
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

      {contactViewMode === 'country' ? (
        <Card>
          <ScrollArea className="h-[600px]" type="always">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : countryGroups.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                {searchQuery ? t('contacts.noMatchingSearch') : t('contacts.noContacts')}
              </div>
            ) : (
              <div>
                {countryGroups.map(([country, groupContacts]) => (
                  <div key={country}>
                    <div className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm px-4 py-2 flex items-center gap-2 border-b">
                      <span className="text-base">{getCountryFlag(country)}</span>
                      <span className="font-medium text-sm">{country}</span>
                      <Badge variant="secondary">{groupContacts.length}</Badge>
                    </div>
                    <Table>
                      <TableBody>
                        {groupContacts.map((contact) => (
                          <TableRow key={contact.id} data-testid={`row-contact-${contact.id}`}>
                            <TableCell onClick={(e) => e.stopPropagation()}><Checkbox checked={selectedContacts.has(contact.id)} onCheckedChange={() => toggleContactSelection(contact.id)} data-testid={`checkbox-contact-${contact.id}`} /></TableCell>
                            <TableCell>
                              {contact.source === 'campaign' ? (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-700">
                                  <Upload className="h-3 w-3 mr-1" />
                                  {t('contacts.source.campaign')}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-700">
                                  {contact.status === 'incoming_call' ? (
                                    <PhoneIncoming className="h-3 w-3 mr-1" />
                                  ) : (
                                    <PhoneOutgoing className="h-3 w-3 mr-1" />
                                  )}
                                  {t('contacts.source.call')}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="font-medium" data-testid={`cell-names-${contact.id}`}>
                              <div className="flex items-center gap-2">
                                {contact.names.length > 0 ? (
                                  <div className="flex flex-col gap-1">
                                    {contact.names.map((name, idx) => (
                                      <div key={idx} className="text-sm">
                                        {name.firstName} {name.lastName || ""}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground italic">{t('contacts.unknown')}</span>
                                )}
                                {getContactGroups(contact.phone).map(g => (
                                  <span key={g.group_id} className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white ml-1" style={{ backgroundColor: g.group_color }}>
                                    {g.group_name}
                                  </span>
                                ))}
                              </div>
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
                              <div className="flex items-center gap-1">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" data-testid={`button-groups-${contact.id}`}>
                                      <Tag className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
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
                                            onClick={() => {
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
                                    <DropdownMenuItem onClick={() => setCreateGroupOpen(true)}>
                                      <Plus className="h-4 w-4 mr-2" /> New Group
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                {contact.source === 'campaign' && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEditDialog(contact)}
                                    data-testid={`button-edit-contact-${contact.id}`}
                                  >
                                    <Pencil className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                )}
                                {contact.source === 'campaign' ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setDeletingContact(contact)}
                                    data-testid={`button-delete-contact-${contact.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>
      ) : contactViewMode === 'grid' ? (
        <>
          <Card className="p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : paginatedItems.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground">
                {searchQuery ? t('contacts.noMatchingSearch') : t('contacts.noContacts')}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
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
                      onClick={() => contact.source === 'campaign' && openEditDialog(contact)}
                    >
                      <div className="absolute top-2 left-2">
                        <Checkbox checked={selectedContacts.has(contact.id)} onCheckedChange={() => toggleContactSelection(contact.id)} onClick={(e: any) => e.stopPropagation()} data-testid={`checkbox-contact-${contact.id}`} />
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
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEditDialog(contact); }}>
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setDeletingContact(contact); }}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </>
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
                      <Badge variant="outline" className="text-[10px]">
                        {contact.source === 'campaign' ? t('contacts.source.campaign') : t('contacts.source.call')}
                      </Badge>
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
            )}
          </Card>

          {paginatedItems.length > 0 && (
            <DataPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
              onItemsPerPageChange={handleItemsPerPageChange}
              showItemsPerPage={true}
            />
          )}
        </>
      ) : (
        <>
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"><Checkbox checked={paginatedItems.length > 0 && selectedContacts.size === paginatedItems.length} onCheckedChange={toggleSelectAll} data-testid="checkbox-select-all" /></TableHead>
                    <TableHead>{t('contacts.fields.source')}</TableHead>
                    <TableHead>{t('contacts.fields.names')}</TableHead>
                    <TableHead>{t('contacts.fields.phone')}</TableHead>
                    <TableHead className="hidden md:table-cell">{t('contacts.fields.email')}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t('contacts.fields.campaigns')}</TableHead>
                    <TableHead className="w-[100px]">{t('contacts.fields.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        {t('contacts.loading')}
                      </TableCell>
                    </TableRow>
                  ) : paginatedItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        {searchQuery ? t('contacts.noMatchingSearch') : t('contacts.noContacts')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedItems.map((contact) => (
                      <TableRow key={contact.id} data-testid={`row-contact-${contact.id}`}>
                        <TableCell onClick={(e) => e.stopPropagation()}><Checkbox checked={selectedContacts.has(contact.id)} onCheckedChange={() => toggleContactSelection(contact.id)} data-testid={`checkbox-contact-${contact.id}`} /></TableCell>
                        <TableCell>
                          {contact.source === 'campaign' ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-700">
                              <Upload className="h-3 w-3 mr-1" />
                              {t('contacts.source.campaign')}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-700">
                              {contact.status === 'incoming_call' ? (
                                <PhoneIncoming className="h-3 w-3 mr-1" />
                              ) : (
                                <PhoneOutgoing className="h-3 w-3 mr-1" />
                              )}
                              {t('contacts.source.call')}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-medium" data-testid={`cell-names-${contact.id}`}>
                          <div className="flex items-center gap-2">
                            {contact.names.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                {contact.names.map((name, idx) => (
                                  <div key={idx} className="text-sm">
                                    {name.firstName} {name.lastName || ""}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic">{t('contacts.unknown')}</span>
                            )}
                            {getContactGroups(contact.phone).map(g => (
                              <span key={g.group_id} className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white ml-1" style={{ backgroundColor: g.group_color }}>
                                {g.group_name}
                              </span>
                            ))}
                          </div>
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
                          <div className="flex items-center gap-1">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" data-testid={`button-groups-${contact.id}`}>
                                  <Tag className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
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
                                        onClick={() => {
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
                                <DropdownMenuItem onClick={() => setCreateGroupOpen(true)}>
                                  <Plus className="h-4 w-4 mr-2" /> New Group
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            {contact.source === 'campaign' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(contact)}
                                data-testid={`button-edit-contact-${contact.id}`}
                              >
                                <Pencil className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            )}
                            {contact.source === 'campaign' ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeletingContact(contact)}
                                data-testid={`button-delete-contact-${contact.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          {paginatedItems.length > 0 && (
            <DataPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
              onItemsPerPageChange={handleItemsPerPageChange}
              showItemsPerPage={true}
            />
          )}
        </>
      )}

      <AlertDialog open={!!deletingContact} onOpenChange={() => setDeletingContact(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('contacts.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('contacts.deleteDialog.description', { name: deletingContact?.names.map(n => `${n.firstName} ${n.lastName || ""}`).join(", "), phone: deletingContact?.phone })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingContact && deleteMutation.mutate(deletingContact.id)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? t('common.deleting') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Contacts</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all {contacts.length} contacts? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-all">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAllMutation.mutate()}
              disabled={deleteAllMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-all"
            >
              {deleteAllMutation.isPending ? "Deleting..." : "Delete All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="add-firstName">First Name</Label>
                <Input
                  id="add-firstName"
                  value={addForm.firstName}
                  onChange={(e) => setAddForm(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder="First name"
                  data-testid="input-add-firstname"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-lastName">Last Name</Label>
                <Input
                  id="add-lastName"
                  value={addForm.lastName}
                  onChange={(e) => setAddForm(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Last name"
                  data-testid="input-add-lastname"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-phone">Phone</Label>
              <Input
                id="add-phone"
                value={addForm.phone}
                onChange={(e) => setAddForm(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+1234567890"
                data-testid="input-add-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-email">Email</Label>
              <Input
                id="add-email"
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="email@example.com"
                data-testid="input-add-email"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)} data-testid="button-cancel-add">
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => addContactMutation.mutate(addForm)}
              disabled={addContactMutation.isPending || !addForm.phone}
              data-testid="button-confirm-add"
            >
              {addContactMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adding...</>
              ) : (
                "Add Contact"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              {t('common.cancel')}
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
}
