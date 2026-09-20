import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, RefreshCcw, Info, Link2 } from "lucide-react";

type OwnedNumber = { id: string; phoneNumber: string; isSystemPool?: boolean | null };

type Channel = {
  id: string;
  wabaId: string;
  name: string | null;
  currency: string | null;
  timezoneId: string | null;
  accountReviewStatus: string | null;
  businessId: string | null;
  syncStatus: string;
  syncError: string | null;
  lastSyncedAt: string | null;
  phoneNumbers: Array<{
    id: string;
    phoneNumberId: string;
    displayPhoneNumber: string | null;
    verifiedName: string | null;
    codeVerificationStatus: string | null;
    qualityRating: string | null;
    nameStatus: string | null;
    messagingLimitTier: string | null;
  }>;
  senders: Array<{
    id: string;
    twilioSenderSid: string | null;
    phoneNumberE164: string;
    profileName: string | null;
    status: string;
    failureReason: string | null;
  }>;
};

export default function WhatsappChannels() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: channels = [], isLoading } = useQuery<Channel[]>({
    queryKey: ["/api/whatsapp/channels"],
  });

  const syncMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/whatsapp/sync/${encodeURIComponent(id)}`),
    onSuccess: async () => {
      toast({ title: "Sync started", description: "Re-importing templates, phone numbers and profile from Meta." });
      await queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/channels"] });
    },
    onError: (e: any) => {
      toast({ title: "Sync failed", description: e?.message || "Unknown error", variant: "destructive" });
    },
  });

  const { data: ownedNumbers = [] } = useQuery<OwnedNumber[]>({ queryKey: ["/api/phone-numbers"] });

  const linkTwilio = useMutation({
    mutationFn: async ({ senderId, twilioPhoneNumberId }: { senderId: string; twilioPhoneNumberId: string }) =>
      apiRequest("POST", `/api/whatsapp/senders/${encodeURIComponent(senderId)}/link-twilio-number`, {
        twilioPhoneNumberId,
      }),
    onSuccess: async () => {
      toast({ title: "Linked", description: "Twilio sender registration started." });
      await queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/channels"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/senders"] });
    },
    onError: (e: any) => {
      toast({ title: "Link failed", description: e?.message || "Unknown error", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Channels — WhatsApp</h1>
          <p className="text-sm text-muted-foreground">All connected WhatsApp Business accounts and phone numbers.</p>
        </div>
        <Button onClick={() => setLocation("/app/inbox/whatsapp-setup")}>
          <Plus className="h-4 w-4 mr-1" />
          Connect WhatsApp
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : channels.length === 0 ? (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>No WhatsApp Business accounts yet</AlertTitle>
          <AlertDescription>Connect WhatsApp to import templates, business profile and phone numbers.</AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-5">
          {channels.map((c) => (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{c.name || c.wabaId}</CardTitle>
                    <CardDescription>
                      WABA <span className="font-mono">{c.wabaId}</span>
                      {c.currency ? ` · ${c.currency}` : ""}
                      {c.timezoneId ? ` · TZ ${c.timezoneId}` : ""}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <SyncBadge status={c.syncStatus} />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => syncMutation.mutate(c.id)}
                      disabled={syncMutation.isPending}
                    >
                      <RefreshCcw className="h-4 w-4 mr-1" />
                      Sync now
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {c.syncError ? (
                  <Alert>
                    <AlertTitle>Last sync had issues</AlertTitle>
                    <AlertDescription className="break-all text-xs">{c.syncError}</AlertDescription>
                  </Alert>
                ) : null}

                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Phone numbers</div>
                  {c.phoneNumbers.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No phone numbers synced yet.</div>
                  ) : (
                    <div className="rounded-lg border divide-y">
                      {c.phoneNumbers.map((p) => (
                        <div key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                          <span className="font-mono">{p.displayPhoneNumber || p.phoneNumberId}</span>
                          {p.verifiedName ? (
                            <span className="text-xs text-muted-foreground">{p.verifiedName}</span>
                          ) : null}
                          <div className="ml-auto flex flex-wrap items-center gap-2">
                            {p.codeVerificationStatus ? (
                              <Badge variant="outline">{p.codeVerificationStatus}</Badge>
                            ) : null}
                            {p.qualityRating ? <Badge variant="outline">Quality: {p.qualityRating}</Badge> : null}
                            {p.nameStatus ? <Badge variant="outline">Name: {p.nameStatus}</Badge> : null}
                            {p.messagingLimitTier ? (
                              <Badge variant="outline">Tier: {p.messagingLimitTier}</Badge>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Senders (Twilio)</div>
                  {c.senders.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No Twilio senders yet for this WABA.</div>
                  ) : (
                    <div className="rounded-lg border divide-y">
                      {c.senders.map((s) => (
                        <SenderRow
                          key={s.id}
                          sender={s}
                          ownedNumbers={ownedNumbers}
                          onLink={(twilioId) => linkTwilio.mutate({ senderId: s.id, twilioPhoneNumberId: twilioId })}
                          onOpenProfile={() => setLocation(`/app/whatsapp/business-profile/${s.id}`)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation(`/app/whatsapp/templates?wabaRowId=${encodeURIComponent(c.id)}`)}
                  >
                    Templates
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SyncBadge({ status }: { status: string }) {
  const color =
    status === "completed"
      ? "default"
      : status === "completed_with_errors"
        ? "destructive"
        : status === "running" || status === "pending"
          ? "secondary"
          : ("outline" as const);
  return <Badge variant={color as any}>{status.replace("_", " ")}</Badge>;
}

function SenderRow({
  sender,
  ownedNumbers,
  onLink,
  onOpenProfile,
}: {
  sender: { id: string; phoneNumberE164: string; profileName: string | null; status: string; failureReason: string | null };
  ownedNumbers: OwnedNumber[];
  onLink: (twilioPhoneNumberId: string) => void;
  onOpenProfile: () => void;
}) {
  const [picked, setPicked] = useState<string>("");
  const normalize = (s: string) => s.replace(/\D/g, "");
  const matches = useMemo(() => {
    const digits = normalize(sender.phoneNumberE164);
    return ownedNumbers.filter((n) => normalize(n.phoneNumber) === digits && !n.isSystemPool);
  }, [ownedNumbers, sender.phoneNumberE164]);
  const needsLink = sender.status === "needs_twilio_number";
  return (
    <div className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
      <span className="font-mono">{sender.phoneNumberE164}</span>
      {sender.profileName ? <span className="text-xs text-muted-foreground">{sender.profileName}</span> : null}
      <Badge variant={needsLink ? "destructive" : "outline"} className="ml-auto">
        {sender.status.replace(/_/g, " ")}
      </Badge>
      {sender.failureReason ? <span className="text-xs text-destructive w-full">{sender.failureReason}</span> : null}
      {needsLink ? (
        <div className="flex items-center gap-2 w-full">
          {matches.length > 0 ? (
            <>
              <Select value={picked} onValueChange={setPicked}>
                <SelectTrigger className="h-8 w-[220px] text-xs">
                  <SelectValue placeholder="Pick matching Twilio number" />
                </SelectTrigger>
                <SelectContent>
                  {matches.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.phoneNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" disabled={!picked} onClick={() => picked && onLink(picked)}>
                <Link2 className="h-4 w-4 mr-1" />
                Link &amp; register
              </Button>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              No matching Twilio number in your inventory. Buy {sender.phoneNumberE164} in Phone Numbers first, then
              return here.
            </span>
          )}
        </div>
      ) : null}
      <Button variant="ghost" size="sm" onClick={onOpenProfile}>
        Business profile
      </Button>
    </div>
  );
}
