import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

export interface CallRow {
  id: string | number;
  phone?: string;
  status?: string;
  classification?: string;
  sentiment?: string;
  duration?: number;
  campaign?: string;
  date?: string;
  summary?: string;
}

interface AnalyticsDataTableProps {
  data: CallRow[];
  activeFilter?: { type: string; value: string } | null;
  onClearFilter?: () => void;
}

export function AnalyticsDataTable({ data, activeFilter, onClearFilter }: AnalyticsDataTableProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let rows = data;
    if (activeFilter) {
      rows = rows.filter(r => {
        if (activeFilter.type === 'classification') return r.classification === activeFilter.value;
        if (activeFilter.type === 'sentiment') return r.sentiment === activeFilter.value;
        if (activeFilter.type === 'status') return r.status === activeFilter.value;
        if (activeFilter.type === 'campaign') return r.campaign === activeFilter.value;
        return true;
      });
    }
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.phone?.toLowerCase().includes(q) ||
        r.status?.toLowerCase().includes(q) ||
        r.classification?.toLowerCase().includes(q) ||
        r.campaign?.toLowerCase().includes(q) ||
        r.summary?.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [data, activeFilter, search]);

  const statusColor = (s?: string) => {
    if (!s) return "secondary";
    const l = s.toLowerCase();
    if (l === 'completed') return 'default';
    if (l === 'failed') return 'destructive';
    return 'secondary';
  };

  return (
    <Card className="glass-card" data-testid="analytics-data-table">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Call Records</CardTitle>
          <div className="flex items-center gap-2">
            {activeFilter && (
              <Badge variant="outline" className="gap-1">
                {activeFilter.type}: {activeFilter.value}
                <button onClick={onClearFilter} data-testid="btn-clear-filter">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 w-48 h-9"
                data-testid="input-search-calls"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Phone</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Classification</th>
                <th className="pb-2 pr-4 font-medium">Sentiment</th>
                <th className="pb-2 pr-4 font-medium">Duration</th>
                <th className="pb-2 pr-4 font-medium">Campaign</th>
                <th className="pb-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">No records found</td>
                </tr>
              ) : (
                filtered.slice(0, 50).map((row, idx) => (
                  <tr key={row.id || idx} className="border-b last:border-0" data-testid={`row-call-${row.id || idx}`}>
                    <td className="py-2 pr-4">{row.phone || '—'}</td>
                    <td className="py-2 pr-4">
                      <Badge variant={statusColor(row.status) as any}>{row.status || '—'}</Badge>
                    </td>
                    <td className="py-2 pr-4">{row.classification || '—'}</td>
                    <td className="py-2 pr-4">{row.sentiment || '—'}</td>
                    <td className="py-2 pr-4">{row.duration ? `${Math.round(row.duration)}s` : '—'}</td>
                    <td className="py-2 pr-4">{row.campaign || '—'}</td>
                    <td className="py-2">{row.date || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {filtered.length > 50 && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Showing 50 of {filtered.length} records
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
