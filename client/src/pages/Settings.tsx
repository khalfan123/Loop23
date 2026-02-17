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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Save, Loader2, Trash2, AlertTriangle, LogOut, Download, Clock, ShieldCheck, Upload, FileCheck, FilePlus, X, CheckCircle2, XCircle, AlertCircle, ExternalLink, MapPin, RefreshCw, Plus, ChevronRight, ChevronDown, Lock, Bell } from "lucide-react";
import { ApiKeysTab } from "@/components/api-keys/ApiKeysTab";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, Suspense } from "react";
import { usePluginRegistry } from "@/contexts/plugin-registry";
import { useTranslation } from "react-i18next";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePluginStatus } from "@/hooks/use-plugin-status";
import { AuthStorage } from "@/lib/auth-storage";
import { useBranding } from "@/components/BrandingProvider";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  credits: number;
  planType: string;
  company?: string | null;
  timezone?: string | null;
  kycStatus?: 'pending' | 'submitted' | 'approved' | 'rejected' | null;
  kycSubmittedAt?: string | null;
  kycApprovedAt?: string | null;
  kycRejectionReason?: string | null;
}

interface KycDocument {
  id: string;
  userId: string;
  documentType: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
}

const KYC_DOCUMENT_TYPES = [
  { type: 'photo_id', label: 'Photo ID (Passport/Driver License)', description: 'A valid government-issued photo identification' },
  { type: 'company_registration', label: 'Company Registration', description: 'Business registration or incorporation certificate' },
  { type: 'gst_certificate', label: 'GST Certificate', description: 'GST or tax registration certificate' },
  { type: 'authorization_letter', label: 'Authorization Letter', description: 'Letter authorizing phone number usage on company letterhead' },
];

const TIMEZONE_OPTIONS = [
  { value: "UTC", label: "UTC (Coordinated Universal Time)", region: "Universal" },
  { value: "America/New_York", label: "Eastern Time (US & Canada)", region: "Americas" },
  { value: "America/Chicago", label: "Central Time (US & Canada)", region: "Americas" },
  { value: "America/Denver", label: "Mountain Time (US & Canada)", region: "Americas" },
  { value: "America/Los_Angeles", label: "Pacific Time (US & Canada)", region: "Americas" },
  { value: "America/Anchorage", label: "Alaska", region: "Americas" },
  { value: "America/Toronto", label: "Toronto", region: "Americas" },
  { value: "America/Vancouver", label: "Vancouver", region: "Americas" },
  { value: "America/Mexico_City", label: "Mexico City", region: "Americas" },
  { value: "America/Sao_Paulo", label: "Sao Paulo", region: "Americas" },
  { value: "America/Buenos_Aires", label: "Buenos Aires", region: "Americas" },
  { value: "America/Lima", label: "Lima", region: "Americas" },
  { value: "America/Bogota", label: "Bogota", region: "Americas" },
  { value: "Europe/London", label: "London", region: "Europe" },
  { value: "Europe/Paris", label: "Paris", region: "Europe" },
  { value: "Europe/Berlin", label: "Berlin", region: "Europe" },
  { value: "Europe/Madrid", label: "Madrid", region: "Europe" },
  { value: "Europe/Rome", label: "Rome", region: "Europe" },
  { value: "Europe/Amsterdam", label: "Amsterdam", region: "Europe" },
  { value: "Europe/Stockholm", label: "Stockholm", region: "Europe" },
  { value: "Europe/Warsaw", label: "Warsaw", region: "Europe" },
  { value: "Europe/Moscow", label: "Moscow", region: "Europe" },
  { value: "Europe/Istanbul", label: "Istanbul", region: "Europe" },
  { value: "Asia/Dubai", label: "Dubai", region: "Asia" },
  { value: "Asia/Kolkata", label: "India (Mumbai, Delhi, Kolkata)", region: "Asia" },
  { value: "Asia/Bangkok", label: "Bangkok", region: "Asia" },
  { value: "Asia/Singapore", label: "Singapore", region: "Asia" },
  { value: "Asia/Hong_Kong", label: "Hong Kong", region: "Asia" },
  { value: "Asia/Shanghai", label: "Shanghai", region: "Asia" },
  { value: "Asia/Tokyo", label: "Tokyo", region: "Asia" },
  { value: "Asia/Seoul", label: "Seoul", region: "Asia" },
  { value: "Asia/Jakarta", label: "Jakarta", region: "Asia" },
  { value: "Asia/Manila", label: "Manila", region: "Asia" },
  { value: "Africa/Cairo", label: "Cairo", region: "Africa" },
  { value: "Africa/Lagos", label: "Lagos", region: "Africa" },
  { value: "Africa/Johannesburg", label: "Johannesburg", region: "Africa" },
  { value: "Africa/Nairobi", label: "Nairobi", region: "Africa" },
  { value: "Australia/Sydney", label: "Sydney", region: "Oceania" },
  { value: "Australia/Melbourne", label: "Melbourne", region: "Oceania" },
  { value: "Australia/Perth", label: "Perth", region: "Oceania" },
  { value: "Pacific/Auckland", label: "Auckland", region: "Oceania" },
  { value: "Pacific/Honolulu", label: "Hawaii", region: "Oceania" },
];

const groupedTimezones = TIMEZONE_OPTIONS.reduce((acc, tz) => {
  if (!acc[tz.region]) acc[tz.region] = [];
  acc[tz.region].push(tz);
  return acc;
}, {} as Record<string, typeof TIMEZONE_OPTIONS>);

function getCurrentTimeInTimezone(timezone: string): string {
  try {
    return new Date().toLocaleTimeString('en-US', { 
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return '';
  }
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Settings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { branding } = useBranding();
  const { isRestApiPluginEnabled } = usePluginStatus();
  const pluginRegistry = usePluginRegistry();
  const settingsTabs = pluginRegistry.getSettingsTabs();
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [selectedTimezone, setSelectedTimezone] = useState<string>("");
  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordExpanded, setPasswordExpanded] = useState(false);

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  useEffect(() => {
    if (user?.name) {
      const parts = user.name.split(" ");
      setFirstName(parts[0] || "");
      setLastName(parts.slice(1).join(" ") || "");
    }
    if (user?.company) {
      setCompany(user.company);
    }
    if (user?.timezone) {
      setSelectedTimezone(user.timezone);
    }
  }, [user]);

  useEffect(() => {
    if (selectedTimezone) {
      setCurrentTime(getCurrentTimeInTimezone(selectedTimezone));
      const interval = setInterval(() => {
        setCurrentTime(getCurrentTimeInTimezone(selectedTimezone));
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [selectedTimezone]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { name?: string; company?: string | null; timezone?: string }) => {
      const res = await apiRequest("PATCH", "/api/auth/me", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update profile");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: t('settings.profileUpdated'),
        description: t('settings.profileUpdatedDescription'),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (error: any) => {
      toast({
        title: t('settings.updateFailed'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await apiRequest("POST", "/api/auth/change-password", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to change password");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: t('settings.passwordChanged'),
        description: t('settings.passwordChangedDescription'),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordExpanded(false);
    },
    onError: (error: any) => {
      toast({
        title: t('settings.passwordChangeFailed'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (password: string) => {
      const res = await apiRequest("POST", "/api/auth/delete-account", { password });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete account");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: t('settings.accountDeleted'),
        description: t('settings.accountDeletedDescription'),
      });
      AuthStorage.clearAuth();
      window.location.href = "/";
    },
    onError: (error: any) => {
      toast({
        title: t('settings.deleteAccountFailed'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const exportDataMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/auth/export-data");
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to export data");
      }
      return res.blob();
    },
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agentlabs-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "Data Export Complete",
        description: "Your data has been downloaded successfully as JSON.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Export Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDeleteAccount = () => {
    if (!deletePassword) {
      toast({
        title: t('settings.passwordRequired'),
        description: t('settings.enterPasswordToDelete'),
        variant: "destructive",
      });
      return;
    }
    deleteAccountMutation.mutate(deletePassword);
  };

  const handleLogout = () => {
    fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
    AuthStorage.clearAuth();
    window.location.href = "/";
  };

  const handleSaveProfile = () => {
    const fullName = `${firstName} ${lastName}`.trim();
    updateProfileMutation.mutate({
      name: fullName,
      company: company.trim() || null,
      timezone: selectedTimezone || undefined,
    });
  };

  const handleChangePassword = () => {
    if (!currentPassword) {
      toast({
        title: t('settings.currentPasswordRequired'),
        variant: "destructive",
      });
      return;
    }
    if (!newPassword) {
      toast({
        title: t('settings.newPasswordRequired'),
        variant: "destructive",
      });
      return;
    }
    if (newPassword.length < 8) {
      toast({
        title: t('settings.passwordTooShort'),
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: t('settings.passwordsDoNotMatch'),
        variant: "destructive",
      });
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const timezoneLabel = TIMEZONE_OPTIONS.find(tz => tz.value === selectedTimezone)?.label;

  return (
    <div className="max-w-2xl mx-auto pb-12 space-y-7">

      {/* Profile Header */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 text-lg">
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-semibold text-lg">
              {getInitials(user?.name || "U")}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate" data-testid="text-user-name">{user?.name}</h2>
            <p className="text-sm text-muted-foreground truncate" data-testid="text-user-email">{user?.email}</p>
            <Badge variant="secondary" className="mt-1.5" data-testid="badge-plan-type">
              {user?.planType || "Free"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Profile Section */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 mb-1.5">Profile</p>
        <div className="rounded-xl border bg-card">
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="first-name" className="text-xs text-muted-foreground">{t('settings.firstName')}</Label>
                <Input
                  id="first-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  data-testid="input-first-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="last-name" className="text-xs text-muted-foreground">{t('settings.lastName')}</Label>
                <Input
                  id="last-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  data-testid="input-last-name"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs text-muted-foreground">{t('common.email')}</Label>
              <Input id="email" type="email" defaultValue={user?.email} disabled data-testid="input-email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company" className="text-xs text-muted-foreground">{t('settings.company')}</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder={t('settings.companyPlaceholder')}
                data-testid="input-company"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="timezone" className="text-xs text-muted-foreground">Timezone</Label>
              <Select value={selectedTimezone} onValueChange={setSelectedTimezone}>
                <SelectTrigger id="timezone" className="w-full" data-testid="select-timezone">
                  <SelectValue placeholder="Select your timezone..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(groupedTimezones).map(([region, timezones]) => (
                    <div key={region}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                        {region}
                      </div>
                      {timezones.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value} data-testid={`timezone-${tz.value}`}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
              {selectedTimezone && currentTime && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <Clock className="h-3 w-3" />
                  Current time: <span className="font-medium text-foreground">{currentTime}</span>
                </p>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSaveProfile}
                disabled={updateProfileMutation.isPending}
                data-testid="button-save-profile"
              >
                {updateProfileMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {t('settings.saveChanges')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Security Section */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 mb-1.5">Security</p>
        <div className="rounded-xl border bg-card">
          <button
            type="button"
            className="w-full flex items-center gap-3 p-4 text-left"
            onClick={() => setPasswordExpanded(!passwordExpanded)}
            data-testid="button-toggle-password"
          >
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-orange-500/10 text-orange-500">
              <Lock className="h-4 w-4" />
            </div>
            <span className="flex-1 text-sm font-medium">{t('settings.changePassword')}</span>
            {passwordExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {passwordExpanded && (
            <div className="px-4 pb-4 space-y-3 border-t ml-12 mr-0">
              <div className="pt-3 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="current-password" className="text-xs text-muted-foreground">{t('settings.currentPassword')}</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    data-testid="input-current-password"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-password" className="text-xs text-muted-foreground">{t('settings.newPassword')}</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    data-testid="input-new-password"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password" className="text-xs text-muted-foreground">{t('settings.confirmPassword')}</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    data-testid="input-confirm-password"
                  />
                </div>
                <div className="flex justify-end pt-1">
                  <Button
                    onClick={handleChangePassword}
                    disabled={changePasswordMutation.isPending || !currentPassword || !newPassword}
                    data-testid="button-change-password"
                  >
                    {changePasswordMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    {t('settings.changePassword')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KYC Verification Section */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 mb-1.5">KYC Verification</p>
        <KycDocumentsSection user={user} />
      </div>

      {/* Addresses Section */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 mb-1.5">Addresses</p>
        <AddressesSection />
      </div>

      {/* Developer Section */}
      {isRestApiPluginEnabled && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 mb-1.5">Developer</p>
          <div className="rounded-xl border bg-card">
            <button
              type="button"
              className="w-full flex items-center gap-3 p-4 text-left border-b last:border-b-0"
              onClick={() => window.open('/api/docs', '_blank')}
              data-testid="button-open-api-docs"
            >
              <div className="w-7 h-7 rounded-md flex items-center justify-center bg-indigo-500/10 text-indigo-500">
                <ExternalLink className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">API Documentation</span>
                <p className="text-xs text-muted-foreground">Interactive API docs with all endpoints</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <div className="mt-3">
            <ApiKeysTab />
          </div>
        </div>
      )}

      {/* Plugin Tabs */}
      {settingsTabs.map((tab) => (
        <div key={tab.id}>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 mb-1.5">{tab.label}</p>
          <div className="rounded-xl border bg-card p-4">
            <Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
              <tab.component />
            </Suspense>
          </div>
        </div>
      ))}

      {/* Notifications Section */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 mb-1.5">{t('settings.notifications')}</p>
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-3 p-4">
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-purple-500/10 text-purple-500">
              <Bell className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium">{t('settings.notificationPreferences')}</span>
              <p className="text-xs text-muted-foreground">
                Configure how you receive notifications from {branding.app_name}.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Data & Privacy Section */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 mb-1.5">Data & Privacy</p>
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-3 p-4">
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-teal-500/10 text-teal-500">
              <Download className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium">Export Your Data</span>
              <p className="text-xs text-muted-foreground">Download campaigns, contacts, and call history</p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => exportDataMutation.mutate()}
              disabled={exportDataMutation.isPending}
              data-testid="button-export-data"
            >
              {exportDataMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Account Section */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 mb-1.5">{t('settings.account')}</p>
        <div className="rounded-xl border bg-card">
          <button
            type="button"
            className="w-full flex items-center gap-3 p-4 text-left"
            onClick={handleLogout}
            data-testid="button-logout-settings"
          >
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-blue-500/10 text-blue-500">
              <LogOut className="h-4 w-4" />
            </div>
            <span className="flex-1 text-sm font-medium">{t('settings.signOut')}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <div className="border-t ml-12" />
          <div className="flex items-center gap-3 p-4">
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-red-500/10 text-red-500">
              <Trash2 className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-destructive">{t('settings.deleteAccount')}</span>
              <p className="text-xs text-muted-foreground">{t('settings.deleteAccountWarning')}</p>
            </div>
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon" data-testid="button-delete-account">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    <AlertDialogTitle>{t('settings.confirmDeleteAccount')}</AlertDialogTitle>
                  </div>
                  <AlertDialogDescription className="space-y-3">
                    <p>{t('settings.deleteAccountConfirmMessage')}</p>
                    <div className="p-3 bg-destructive/10 rounded-md border border-destructive/20">
                      <p className="text-sm font-medium text-destructive">{t('settings.deleteAccountConsequences')}</p>
                      <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                        <li>{t('settings.deleteConsequence1')}</li>
                        <li>{t('settings.deleteConsequence2')}</li>
                        <li>{t('settings.deleteConsequence3')}</li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="delete-password">{t('settings.enterPasswordToConfirm')}</Label>
                      <Input
                        id="delete-password"
                        type="password"
                        placeholder={t('settings.yourPassword')}
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        data-testid="input-delete-password"
                      />
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDeletePassword("")} data-testid="button-cancel-delete">
                    {t('common.cancel')}
                  </AlertDialogCancel>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={deleteAccountMutation.isPending || !deletePassword}
                    data-testid="button-confirm-delete"
                  >
                    {deleteAccountMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    {t('settings.permanentlyDelete')}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
}

function KycDocumentsSection({ user }: { user: User | undefined }) {
  const { toast } = useToast();
  const [uploadingType, setUploadingType] = useState<string | null>(null);

  const { data: kycDocuments, isLoading: documentsLoading, refetch: refetchDocuments } = useQuery<KycDocument[]>({
    queryKey: ["/api/kyc/documents"],
    enabled: !!user,
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: async ({ file, documentType }: { file: File, documentType: string }) => {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('documentType', documentType);
      
      const token = AuthStorage.getToken();
      const response = await fetch('/api/kyc/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Upload failed');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Document uploaded successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      setUploadingType(null);
    }
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await apiRequest("DELETE", `/api/kyc/documents/${documentId}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Delete failed');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Document deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    }
  });

  const submitKycMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/kyc/submit");
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Submit failed');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "KYC submitted for review", description: "An admin will review your documents soon." });
    },
    onError: (error: any) => {
      toast({ title: "Submit failed", description: error.message, variant: "destructive" });
    }
  });

  const handleFileUpload = (documentType: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          toast({ title: "File too large", description: "Maximum file size is 5MB", variant: "destructive" });
          return;
        }
        setUploadingType(documentType);
        uploadDocumentMutation.mutate({ file, documentType });
      }
    };
    input.click();
  };

  const getDocumentForType = (type: string) => {
    return kycDocuments?.find(doc => doc.documentType === type);
  };

  const allDocumentsUploaded = KYC_DOCUMENT_TYPES.every(doc => getDocumentForType(doc.type));
  const kycStatus = user?.kycStatus || 'pending';

  const getStatusBadge = () => {
    switch (kycStatus) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      case 'submitted':
        return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />Under Review</Badge>;
      default:
        return <Badge variant="outline"><AlertCircle className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center gap-3 p-4 border-b">
        <div className="w-7 h-7 rounded-md flex items-center justify-center bg-green-500/10 text-green-500">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">Verification Status</span>
          <p className="text-xs text-muted-foreground">Upload identity documents to purchase phone numbers</p>
        </div>
        {getStatusBadge()}
      </div>

      {kycStatus === 'rejected' && user?.kycRejectionReason && (
        <div className="mx-4 mt-3 bg-destructive/10 border border-destructive/20 rounded-md p-3">
          <p className="text-sm font-medium text-destructive">Rejection Reason:</p>
          <p className="text-sm text-destructive/80">{user.kycRejectionReason}</p>
        </div>
      )}

      {kycStatus === 'approved' && (
        <div className="mx-4 mt-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-md p-3">
          <p className="text-sm text-green-800 dark:text-green-200">
            Your KYC verification is complete. You can now purchase phone numbers.
          </p>
        </div>
      )}

      {KYC_DOCUMENT_TYPES.map((docType, index) => {
        const existingDoc = getDocumentForType(docType.type);
        const isUploading = uploadingType === docType.type;

        return (
          <div key={docType.type}>
            {index > 0 && <div className="border-t ml-12" />}
            <div className="flex items-center gap-3 p-4">
              <div className="w-7 h-7 rounded-md flex items-center justify-center bg-muted">
                {existingDoc ? (
                  <FileCheck className="h-4 w-4 text-green-600" />
                ) : (
                  <FilePlus className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{docType.label}</p>
                <p className="text-xs text-muted-foreground">{docType.description}</p>
                {existingDoc && (
                  <p className="text-xs text-green-600 mt-0.5">
                    {existingDoc.fileName}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {existingDoc && kycStatus !== 'approved' && kycStatus !== 'submitted' && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteDocumentMutation.mutate(existingDoc.id)}
                    disabled={deleteDocumentMutation.isPending}
                    data-testid={`button-delete-${docType.type}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                {!existingDoc && kycStatus !== 'approved' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleFileUpload(docType.type)}
                    disabled={isUploading}
                    data-testid={`button-upload-${docType.type}`}
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                  </Button>
                )}
                {existingDoc && (
                  <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-transparent">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Done
                  </Badge>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {kycStatus !== 'approved' && kycStatus !== 'submitted' && (
        <div className="p-4 border-t flex justify-end">
          <Button
            onClick={() => submitKycMutation.mutate()}
            disabled={!allDocumentsUploaded || submitKycMutation.isPending}
            data-testid="button-submit-kyc"
          >
            {submitKycMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4 mr-2" />
            )}
            Submit for Review
          </Button>
        </div>
      )}

      <div className="px-4 pb-3">
        <p className="text-xs text-muted-foreground">
          Accepted formats: JPEG, PNG, PDF (max 5MB per file). All 4 documents are required.
        </p>
      </div>
    </div>
  );
}

interface UserAddress {
  id: string;
  userId: string;
  customerName: string;
  street: string;
  city: string;
  region: string;
  postalCode: string;
  isoCountry: string;
  twilioAddressSid?: string;
  status: string;
  verificationStatus?: string;
  validationStatus?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

interface AddressCountry {
  code: string;
  name: string;
  requirement: string;
}

function AddressesSection() {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [refreshingAddressId, setRefreshingAddressId] = useState<string | null>(null);

  const { data: addresses, isLoading } = useQuery<UserAddress[]>({
    queryKey: ["/api/user/addresses"],
  });

  const { data: countries } = useQuery<AddressCountry[]>({
    queryKey: ["/api/user/addresses/countries"],
  });

  const createAddressMutation = useMutation({
    mutationFn: async (data: {
      customerName: string;
      street: string;
      city: string;
      region: string;
      postalCode: string;
      isoCountry: string;
    }) => {
      const response = await apiRequest("POST", "/api/user/addresses", data);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to create address");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/addresses"] });
      toast({ title: "Address submitted", description: "Your address has been submitted to Twilio for verification." });
      setShowAddDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create address", description: error.message, variant: "destructive" });
    },
  });

  const refreshAddressMutation = useMutation({
    mutationFn: async (addressId: string) => {
      setRefreshingAddressId(addressId);
      const response = await apiRequest("GET", `/api/user/addresses/${addressId}/refresh`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to refresh status");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/addresses"] });
      toast({ title: "Status refreshed" });
      setRefreshingAddressId(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to refresh status", description: error.message, variant: "destructive" });
      setRefreshingAddressId(null);
    },
  });

  const deleteAddressMutation = useMutation({
    mutationFn: async (addressId: string) => {
      const response = await apiRequest("DELETE", `/api/user/addresses/${addressId}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to delete address");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/addresses"] });
      toast({ title: "Address deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete address", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setSelectedCountry("");
    setCustomerName("");
    setStreet("");
    setCity("");
    setRegion("");
    setPostalCode("");
  };

  const handleSubmit = () => {
    if (!selectedCountry || !customerName || !street || !city || !region || !postalCode) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }
    createAddressMutation.mutate({
      customerName,
      street,
      city,
      region,
      postalCode,
      isoCountry: selectedCountry,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"><CheckCircle2 className="h-3 w-3 mr-1" />Verified</Badge>;
      case 'submitted':
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending Verification</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCountryName = (code: string) => {
    const country = countries?.find(c => c.code === code);
    return country?.name || code;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center gap-3 p-4 border-b">
        <div className="w-7 h-7 rounded-md flex items-center justify-center bg-sky-500/10 text-sky-500">
          <MapPin className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">Address Verification</span>
          <p className="text-xs text-muted-foreground">Required for phone numbers in certain countries</p>
        </div>
        <AlertDialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <AlertDialogTrigger asChild>
            <Button size="sm" data-testid="button-add-address">
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Add New Address</AlertDialogTitle>
              <AlertDialogDescription>
                Enter your address details. This will be submitted to Twilio for verification.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Country</Label>
                <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                  <SelectTrigger data-testid="select-address-country">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries?.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.name} ({country.requirement === 'local' ? 'Local address required' : 'Any address'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Full Name / Company Name</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="John Doe or Company Ltd"
                  data-testid="input-address-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Street Address</Label>
                <Input
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="123 Main Street"
                  data-testid="input-address-street"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Sydney"
                    data-testid="input-address-city"
                  />
                </div>
                <div className="space-y-2">
                  <Label>State/Province</Label>
                  <Input
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    placeholder="NSW"
                    data-testid="input-address-region"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Postal Code</Label>
                <Input
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="2000"
                  data-testid="input-address-postal"
                />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={resetForm}>Cancel</AlertDialogCancel>
              <Button
                onClick={handleSubmit}
                disabled={createAddressMutation.isPending}
                data-testid="button-submit-address"
              >
                {createAddressMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit Address
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {addresses?.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <MapPin className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No addresses added yet.</p>
          <p className="text-xs mt-1">Add an address for countries requiring verification.</p>
        </div>
      ) : (
        <div>
          {addresses?.map((address, index) => (
            <div key={address.id}>
              {index > 0 && <div className="border-t ml-12" />}
              <div className="flex items-start gap-3 p-4">
                <div className="w-7 h-7 rounded-md flex items-center justify-center bg-muted mt-0.5">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{address.customerName}</span>
                    {getStatusBadge(address.status)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {address.street}, {address.city}, {address.region} {address.postalCode}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {getCountryName(address.isoCountry)}
                  </p>
                  {address.rejectionReason && (
                    <p className="text-xs text-destructive">
                      Reason: {address.rejectionReason}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => refreshAddressMutation.mutate(address.id)}
                    disabled={refreshingAddressId === address.id}
                    title="Refresh status"
                    data-testid={`button-refresh-address-${address.id}`}
                  >
                    <RefreshCw className={`h-4 w-4 ${refreshingAddressId === address.id ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteAddressMutation.mutate(address.id)}
                    disabled={deleteAddressMutation.isPending}
                    title="Delete address"
                    data-testid={`button-delete-address-${address.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
