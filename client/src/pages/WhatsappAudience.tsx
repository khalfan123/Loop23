import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Search, ArrowLeft, X } from "lucide-react";

type Tag = { id: string; name: string; color: string | null };
type Contact = {
  id: string;
  phoneNumberE164: string;
  profileName: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  tags: Tag[];
};

export default function WhatsappAudience() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string>("ALL");
  const [newTagName, setNewTagName] = useState("");

  const { data: tags = [] } = useQuery<Tag[]>({ queryKey: ["/api/whatsapp/tags"] });

  const contactsKey = useMemo(
    () => ["/api/whatsapp/audience/contacts", search, tagFilter] as const,
    [search, tagFilter],
  );
  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: contactsKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (tagFilter !== "ALL") params.set("tagId", tagFilter);
      const res = await apiRequest("GET", `/api/whatsapp/audience/contacts?${params.toString()}`);
      return (await res.json()) as Contact[];
    },
  });

  const createTag = useMutation({
    mutationFn: async (name: string) => apiRequest("POST", "/api/whatsapp/tags", { name }),
    onSuccess: async () => {
      setNewTagName("");
      await queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/tags"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const assignTag = useMutation({
    mutationFn: async ({ contactId, tagId }: { contactId: string; tagId: string }) =>
      apiRequest("POST", `/api/whatsapp/audience/contacts/${encodeURIComponent(contactId)}/tags`, { tagId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: contactsKey });
    },
  });

  const removeTag = useMutation({
    mutationFn: async ({ contactId, tagId }: { contactId: string; tagId: string }) =>
      apiRequest("DELETE", `/api/whatsapp/audience/contacts/${encodeURIComponent(contactId)}/tags/${encodeURIComponent(tagId)}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: contactsKey });
    },
  });

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/app/inbox")} className="-ml-2 gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back to Inbox
        </Button>
      </div>

      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Audience</h1>
          <p className="text-sm text-muted-foreground">All WhatsApp contacts, with tags and last-seen.</p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Filter by tag</Label>
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All contacts</SelectItem>
                {tags.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Phone or profile name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-[220px]"
              />
            </div>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tags</CardTitle>
          <CardDescription>Group contacts to broadcast template messages or trigger automations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {tags.map((t) => (
              <Badge key={t.id} variant="outline">
                {t.name}
              </Badge>
            ))}
            {tags.length === 0 ? <div className="text-sm text-muted-foreground">No tags yet.</div> : null}
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={newTagName}
              placeholder="New tag name"
              onChange={(e) => setNewTagName(e.target.value)}
              className="w-[220px]"
              maxLength={64}
            />
            <Button
              size="sm"
              onClick={() => newTagName.trim() && createTag.mutate(newTagName.trim())}
              disabled={createTag.isPending || !newTagName.trim()}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add tag
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Contacts</CardTitle>
          <CardDescription>
            Click tags to assign. Custom fields are editable on each contact's detail (coming soon).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : contacts.length === 0 ? (
            <Alert>
              <AlertTitle>No contacts yet</AlertTitle>
              <AlertDescription>Contacts are added automatically when someone messages your WhatsApp.</AlertDescription>
            </Alert>
          ) : (
            <div className="rounded-lg border divide-y">
              {contacts.map((c) => (
                <div key={c.id} className="px-4 py-3 flex flex-wrap gap-3 items-start text-sm">
                  <div className="min-w-[200px]">
                    <div className="font-mono">{c.phoneNumberE164}</div>
                    {c.profileName ? (
                      <div className="text-xs text-muted-foreground">{c.profileName}</div>
                    ) : null}
                    <div className="text-[11px] text-muted-foreground">
                      Last seen {new Date(c.lastSeenAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 flex-1">
                    {c.tags.map((t) => (
                      <Badge key={t.id} variant="outline" className="cursor-pointer" onClick={() => removeTag.mutate({ contactId: c.id, tagId: t.id })}>
                        {t.name} <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                    {tags.filter((t) => !c.tags.some((ct) => ct.id === t.id)).length > 0 ? (
                      <Select
                        value=""
                        onValueChange={(tagId) => {
                          if (tagId) assignTag.mutate({ contactId: c.id, tagId });
                        }}
                      >
                        <SelectTrigger className="h-7 w-[140px] text-xs">
                          <SelectValue placeholder="+ Add tag" />
                        </SelectTrigger>
                        <SelectContent>
                          {tags
                            .filter((t) => !c.tags.some((ct) => ct.id === t.id))
                            .map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
