import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Plus, Trash2, PowerOff, RotateCcw } from "lucide-react";

type PoolEntry = {
  id: string;
  phoneNumberE164: string;
  twilioPhoneNumberSid: string | null;
  metaPhoneNumberId: string | null;
  wabaId: string | null;
  status: "available" | "assigned" | "disabled";
  assignedWorkspaceId: string | null;
  assignedSenderId: string | null;
  assignedAt: string | null;
  displayName: string | null;
  displayNameStatus: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

function statusBadge(status: PoolEntry["status"]) {
  switch (status) {
    case "available":
      return <Badge variant="secondary">Available</Badge>;
    case "assigned":
      return <Badge>Assigned</Badge>;
    case "disabled":
      return <Badge variant="outline">Disabled</Badge>;
  }
}

function displayNameBadge(s: string) {
  if (s === "approved") return <Badge variant="secondary">Approved</Badge>;
  if (s === "pending") return <Badge>Pending</Badge>;
  if (s === "rejected") return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="outline">—</Badge>;
}

export default function WhatsappDidPoolPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    phoneNumberE164: "",
    twilioPhoneNumberSid: "",
    metaPhoneNumberId: "",
    wabaId: "",
    notes: "",
  });

  const { data: pool, isLoading } = useQuery<PoolEntry[]>({
    queryKey: ["/api/admin/whatsapp/did-pool"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/admin/whatsapp/did-pool");
      return r.json();
    },
  });

  const addMut = useMutation({
    mutationFn: async (input: typeof form) => {
      const body: Record<string, unknown> = { phoneNumberE164: input.phoneNumberE164.trim() };
      if (input.twilioPhoneNumberSid.trim()) body.twilioPhoneNumberSid = input.twilioPhoneNumberSid.trim();
      if (input.metaPhoneNumberId.trim()) body.metaPhoneNumberId = input.metaPhoneNumberId.trim();
      if (input.wabaId.trim()) body.wabaId = input.wabaId.trim();
      if (input.notes.trim()) body.notes = input.notes.trim();
      const r = await apiRequest("POST", "/api/admin/whatsapp/did-pool", body);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "DID added to pool" });
      setAddOpen(false);
      setForm({ phoneNumberE164: "", twilioPhoneNumberSid: "", metaPhoneNumberId: "", wabaId: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["/api/admin/whatsapp/did-pool"] });
    },
    onError: (e: any) => toast({ title: "Failed to add DID", description: e?.message, variant: "destructive" }),
  });

  const actMut = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "release" | "disable" | "delete" }) => {
      if (action === "delete") {
        const r = await apiRequest("DELETE", `/api/admin/whatsapp/did-pool/${id}`);
        return r.json();
      }
      const r = await apiRequest("POST", `/api/admin/whatsapp/did-pool/${id}/${action}`);
      return r.json();
    },
    onSuccess: (_d, vars) => {
      toast({ title: `DID ${vars.action === "delete" ? "deleted" : vars.action + "d"}` });
      qc.invalidateQueries({ queryKey: ["/api/admin/whatsapp/did-pool"] });
    },
    onError: (e: any) => toast({ title: "Action failed", description: e?.message, variant: "destructive" }),
  });

  const counts = (pool || []).reduce(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }),
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">WhatsApp DID pool</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Pre-purchased Twilio WhatsApp numbers registered under the shared Loop23 WABA. Customers click
            "Get a WhatsApp number" and one of these is assigned instantly with their business display name.
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add DID
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a DID to the pool</DialogTitle>
              <DialogDescription>
                Add a Twilio number that has already been registered as a WhatsApp sender on the shared Loop23 WABA.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label htmlFor="p">Phone number (E.164) *</Label>
                <Input
                  id="p"
                  value={form.phoneNumberE164}
                  placeholder="+15551234567"
                  onChange={(e) => setForm({ ...form, phoneNumberE164: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tw">Twilio phone number SID</Label>
                <Input
                  id="tw"
                  value={form.twilioPhoneNumberSid}
                  placeholder="PNxxxxxxxx"
                  onChange={(e) => setForm({ ...form, twilioPhoneNumberSid: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mp">Meta phone number ID</Label>
                <Input
                  id="mp"
                  value={form.metaPhoneNumberId}
                  placeholder="1234567890"
                  onChange={(e) => setForm({ ...form, metaPhoneNumberId: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="wa">WABA ID (defaults to META_WABA_ID)</Label>
                <Input
                  id="wa"
                  value={form.wabaId}
                  placeholder="optional"
                  onChange={(e) => setForm({ ...form, wabaId: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="n">Notes</Label>
                <Input id="n" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => addMut.mutate(form)} disabled={addMut.isPending}>
                {addMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Available</CardDescription>
            <CardTitle className="text-3xl">{counts.available || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Assigned</CardDescription>
            <CardTitle className="text-3xl">{counts.assigned || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Disabled</CardDescription>
            <CardTitle className="text-3xl">{counts.disabled || 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading pool…
            </div>
          ) : !pool || pool.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              No DIDs in the pool yet. Click "Add DID" to register your first WhatsApp number.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Display name</TableHead>
                  <TableHead>Assigned to</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pool.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">{r.phoneNumberE164}</TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm">{r.displayName || <span className="text-muted-foreground">—</span>}</span>
                        {displayNameBadge(r.displayNameStatus)}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {r.assignedWorkspaceId || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {r.status === "assigned" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => actMut.mutate({ id: r.id, action: "release" })}
                            disabled={actMut.isPending}
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Release
                          </Button>
                        )}
                        {r.status !== "disabled" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => actMut.mutate({ id: r.id, action: "disable" })}
                            disabled={actMut.isPending}
                          >
                            <PowerOff className="h-3 w-3 mr-1" />
                            Disable
                          </Button>
                        )}
                        {r.status === "available" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`Delete ${r.phoneNumberE164} from the pool?`)) {
                                actMut.mutate({ id: r.id, action: "delete" });
                              }
                            }}
                            disabled={actMut.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
