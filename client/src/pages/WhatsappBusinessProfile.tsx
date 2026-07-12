import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save } from "lucide-react";

type ProfilePayload = {
  sender: {
    id: string;
    phoneNumberE164: string;
    wabaId: string | null;
    status: string;
    profileName: string | null;
  };
  profile: null | {
    id: string;
    about: string | null;
    description: string | null;
    email: string | null;
    address: string | null;
    vertical: string | null;
    websites: string[] | null;
    profilePictureUrl: string | null;
    lastSyncedAt: string | null;
  };
};

export default function WhatsappBusinessProfile() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/app/whatsapp/business-profile/:senderId");
  const senderId = params?.senderId || "";
  const { toast } = useToast();

  const { data, isLoading } = useQuery<ProfilePayload | null>({
    queryKey: ["/api/whatsapp/business-profile", senderId],
    enabled: !!senderId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/whatsapp/business-profile/${encodeURIComponent(senderId)}`);
      return (await res.json()) as ProfilePayload;
    },
  });

  const [form, setForm] = useState({
    about: "",
    description: "",
    email: "",
    address: "",
    vertical: "",
    websites: "",
  });

  useEffect(() => {
    if (data?.profile) {
      setForm({
        about: data.profile.about || "",
        description: data.profile.description || "",
        email: data.profile.email || "",
        address: data.profile.address || "",
        vertical: data.profile.vertical || "",
        websites: (data.profile.websites || []).join("\n"),
      });
    }
  }, [data?.profile]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PUT", `/api/whatsapp/business-profile/${encodeURIComponent(senderId)}`, {
        about: form.about || undefined,
        description: form.description || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
        vertical: form.vertical || undefined,
        websites: form.websites
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      });
    },
    onSuccess: async () => {
      toast({ title: "Profile saved", description: "Updated on Meta." });
      await queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/business-profile", senderId] });
    },
    onError: (e: any) =>
      toast({ title: "Save failed", description: e?.message || "Unknown error", variant: "destructive" }),
  });

  if (!senderId) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/app/channels/whatsapp")} className="-ml-2 gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back to Channels
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : !data ? (
        <Alert>
          <AlertTitle>Sender not found</AlertTitle>
          <AlertDescription>Make sure the sender id is correct.</AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>WhatsApp Business Profile</CardTitle>
            <CardDescription>
              Editing the public profile for <span className="font-mono">{data.sender.phoneNumberE164}</span>
              {data.sender.profileName ? ` · ${data.sender.profileName}` : ""}. Changes write directly to Meta.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>About</Label>
              <Input
                value={form.about}
                onChange={(e) => setForm({ ...form, about: e.target.value })}
                placeholder="Short tagline shown on the chat header"
                maxLength={139}
              />
            </div>
            <div>
              <Label>Description</Label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full min-h-[80px] rounded-md border bg-background p-2 text-sm"
                maxLength={512}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Vertical</Label>
                <Input
                  value={form.vertical}
                  onChange={(e) => setForm({ ...form, vertical: e.target.value })}
                  placeholder="e.g. RETAIL, EDUCATION"
                />
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <Label>Websites (one per line, up to 2)</Label>
              <textarea
                value={form.websites}
                onChange={(e) => setForm({ ...form, websites: e.target.value })}
                className="w-full min-h-[60px] rounded-md border bg-background p-2 text-sm font-mono"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
