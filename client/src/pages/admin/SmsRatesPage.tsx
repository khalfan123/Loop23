import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";

type Rate = {
  id: string;
  isoCountry: string;
  creditsPerSegment: number;
  label: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * Admin → SMS Rates. CRUD over `sms_country_rates`. The row with
 * isoCountry='*' acts as the global fallback and cannot be deleted.
 */
export default function SmsRatesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [isoCountry, setIsoCountry] = useState("");
  const [creditsPerSegment, setCreditsPerSegment] = useState("");
  const [label, setLabel] = useState("");

  const { data: rates = [], isLoading } = useQuery<Rate[]>({
    queryKey: ["/api/admin/sms-rates"],
  });

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/sms-rates", {
        isoCountry: isoCountry.trim().toUpperCase(),
        creditsPerSegment: Number(creditsPerSegment),
        label: label.trim() || null,
      });
      return res.json();
    },
    onSuccess: () => {
      setIsoCountry("");
      setCreditsPerSegment("");
      setLabel("");
      qc.invalidateQueries({ queryKey: ["/api/admin/sms-rates"] });
      toast({ title: "Rate saved" });
    },
    onError: (err: any) => {
      toast({ title: "Couldn't save rate", description: err?.message || "Unknown error", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/sms-rates/${id}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/sms-rates"] });
      toast({ title: "Rate deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Couldn't delete", description: err?.message || "Unknown error", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6 px-4 py-4">
      <div>
        <h1 className="text-2xl font-semibold">SMS rates</h1>
        <p className="text-sm text-muted-foreground">
          Per-destination-country credit rates for outbound SMS. The row with country <code>*</code> is the
          global fallback applied when a destination isn't listed.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add or update a rate</CardTitle>
          <CardDescription>
            Use the ISO 3166-1 alpha-2 country code (e.g. <code>US</code>, <code>GB</code>, <code>AE</code>) or
            <code> * </code> for the fallback.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="rate-iso">Country</Label>
              <Input
                id="rate-iso"
                placeholder="US"
                maxLength={2}
                value={isoCountry}
                onChange={(e) => setIsoCountry(e.target.value.toUpperCase())}
                data-testid="input-rate-iso"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rate-credits">Credits / segment</Label>
              <Input
                id="rate-credits"
                type="number"
                min={0}
                placeholder="1"
                value={creditsPerSegment}
                onChange={(e) => setCreditsPerSegment(e.target.value)}
                data-testid="input-rate-credits"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="rate-label">Label (optional)</Label>
              <Input
                id="rate-label"
                placeholder="United States"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                data-testid="input-rate-label"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => upsertMutation.mutate()}
              disabled={!isoCountry || !creditsPerSegment || upsertMutation.isPending}
              data-testid="button-save-rate"
            >
              {upsertMutation.isPending ? "Saving…" : "Save rate"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configured rates</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : rates.length === 0 ? (
            <div className="text-sm text-muted-foreground">No rates configured.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Country</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Credits / segment</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs">{r.isoCountry}</code>
                        {r.isDefault && <Badge variant="secondary">default</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>{r.label || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{r.creditsPerSegment}</TableCell>
                    <TableCell>
                      {!r.isDefault && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(r.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-rate-${r.isoCountry}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
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
