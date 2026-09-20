import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Trash2, Image as ImageIcon, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { AuthStorage } from "@/lib/auth-storage";
import { useBranding, clearBrandingCache } from "@/components/BrandingProvider";

interface AdminBranding {
  app_name: string | null;
  app_tagline: string | null;
  logo_url: string | null;
  logo_url_light: string | null;
  logo_url_dark: string | null;
  favicon_url: string | null;
  branding_updated_at: string | null;
}

async function uploadAsset(endpoint: string, field: string, file: File) {
  const form = new FormData();
  form.append(field, file);
  const headers: Record<string, string> = {};
  const authHeader = AuthStorage.getAuthHeader();
  if (authHeader) headers["Authorization"] = authHeader;
  const res = await fetch(endpoint, {
    method: "POST",
    body: form,
    credentials: "include",
    headers,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Upload failed (${res.status})`);
  }
  return res.json() as Promise<{ url: string }>;
}

type AssetSlot = {
  key: "logo_url" | "logo_url_light" | "logo_url_dark" | "favicon_url";
  title: string;
  description: string;
  uploadPath: string;
  deletePath: string;
  field: "logo" | "favicon";
  accept: string;
};

const SLOTS: AssetSlot[] = [
  {
    key: "logo_url",
    title: "Default Logo",
    description: "Used where a single logo is shown.",
    uploadPath: "/api/admin/branding/upload-logo",
    deletePath: "/api/admin/branding/logo",
    field: "logo",
    accept: "image/png,image/jpeg,image/gif,image/webp,image/svg+xml",
  },
  {
    key: "logo_url_light",
    title: "Light Mode Logo",
    description: "Shown when the UI is in light mode. Optional.",
    uploadPath: "/api/admin/branding/upload-logo-light",
    deletePath: "/api/admin/branding/logo-light",
    field: "logo",
    accept: "image/png,image/jpeg,image/gif,image/webp,image/svg+xml",
  },
  {
    key: "logo_url_dark",
    title: "Dark Mode Logo",
    description: "Shown when the UI is in dark mode. Optional.",
    uploadPath: "/api/admin/branding/upload-logo-dark",
    deletePath: "/api/admin/branding/logo-dark",
    field: "logo",
    accept: "image/png,image/jpeg,image/gif,image/webp,image/svg+xml",
  },
  {
    key: "favicon_url",
    title: "Favicon",
    description: "Shown in browser tabs. Square PNG/ICO recommended.",
    uploadPath: "/api/admin/branding/upload-favicon",
    deletePath: "/api/admin/branding/favicon",
    field: "favicon",
    accept: "image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml,image/jpeg,image/gif,image/webp",
  },
];

export default function BrandingAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { invalidate: invalidateBranding } = useBranding();

  const { data, isLoading, refetch } = useQuery<AdminBranding>({
    queryKey: ["/api/admin/branding"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/branding");
      return res.json();
    },
  });

  const [appName, setAppName] = useState("");
  const [appTagline, setAppTagline] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (data) {
      setAppName(data.app_name ?? "");
      setAppTagline(data.app_tagline ?? "");
    }
  }, [data]);

  const refreshAll = async () => {
    clearBrandingCache();
    await qc.invalidateQueries({ queryKey: ["/api/admin/branding"] });
    await invalidateBranding();
    await refetch();
  };

  const saveText = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/admin/branding", {
        app_name: appName,
        app_tagline: appTagline,
      });
      return res.json();
    },
    onSuccess: async () => {
      toast({ title: "Saved", description: "Branding text updated." });
      await refreshAll();
    },
    onError: (e: any) => {
      toast({ title: "Save failed", description: e?.message ?? String(e), variant: "destructive" });
    },
  });

  const handleUpload = async (slot: AssetSlot, file: File) => {
    try {
      setBusyKey(slot.key);
      await uploadAsset(slot.uploadPath, slot.field, file);
      toast({ title: "Uploaded", description: `${slot.title} updated.` });
      await refreshAll();
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setBusyKey(null);
    }
  };

  const handleDelete = async (slot: AssetSlot) => {
    try {
      setBusyKey(slot.key);
      await apiRequest("DELETE", slot.deletePath);
      toast({ title: "Removed", description: `${slot.title} removed.` });
      await refreshAll();
    } catch (e: any) {
      toast({ title: "Remove failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setBusyKey(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-6" data-testid="branding-admin-page">
      <div>
        <h1 className="text-2xl font-bold">Branding</h1>
        <p className="text-muted-foreground">
          Upload your logo, light/dark variants, and favicon. Changes take effect immediately.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>App Identity</CardTitle>
          <CardDescription>Text shown around the product.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="app-name">App Name</Label>
            <Input
              id="app-name"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              data-testid="input-app-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="app-tagline">Tagline</Label>
            <Input
              id="app-tagline"
              value={appTagline}
              onChange={(e) => setAppTagline(e.target.value)}
              data-testid="input-app-tagline"
            />
          </div>
          <Button
            onClick={() => saveText.mutate()}
            disabled={saveText.isPending}
            data-testid="button-save-text"
          >
            {saveText.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {SLOTS.map((slot) => {
          const currentUrl = (data?.[slot.key] as string | null) ?? null;
          const isBusy = busyKey === slot.key;
          return (
            <Card key={slot.key} data-testid={`slot-${slot.key}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ImageIcon className="h-4 w-4" /> {slot.title}
                </CardTitle>
                <CardDescription>{slot.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-center h-28 rounded border bg-muted/30 overflow-hidden">
                  {currentUrl ? (
                    <img
                      src={currentUrl}
                      alt={slot.title}
                      className="max-h-24 max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-sm text-muted-foreground">No asset</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    ref={(el) => (fileRefs.current[slot.key] = el)}
                    type="file"
                    accept={slot.accept}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(slot, f);
                      e.target.value = "";
                    }}
                    data-testid={`file-${slot.key}`}
                  />
                  <Button
                    variant="default"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => fileRefs.current[slot.key]?.click()}
                    data-testid={`button-upload-${slot.key}`}
                  >
                    {isBusy ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Upload
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isBusy || !currentUrl}
                    onClick={() => handleDelete(slot)}
                    data-testid={`button-delete-${slot.key}`}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {data?.branding_updated_at && (
        <p className="text-xs text-muted-foreground">
          Last updated: {new Date(data.branding_updated_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}
