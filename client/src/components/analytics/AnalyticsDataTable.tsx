import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const pageRows = filtered.slice(startIdx, startIdx + pageSize);

  const statusColor = (s?: string) => {
    if (!s) return "secondary";
    const l = s.toLowerCase();
    if (l === 'completed') return 'default';
    if (l === 'failed') return 'destructive';
    return 'secondary';
  };

  const handlePageSizeChange = (val: string) => {
    setPageSize(Number(val));
    setPage(1);
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
                onChange={e => { setSearch(e.target.value); setPage(1); }}
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
                <th className="pb-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">No records found</td>
                </tr>
              ) : (
                pageRows.map((row, idx) => (
                  <tr key={row.id || idx} className="border-b last:border-0" data-testid={`row-call-${row.id || idx}`}>
                    <td className="py-2 pr-4">{row.phone || '—'}</td>
                    <td className="py-2 pr-4">
                      <Badge variant={statusColor(row.status) as any}>{row.status || '—'}</Badge>
                    </td>
                    <td className="py-2 pr-4">{row.classification || '—'}</td>
                    <td className="py-2 pr-4">{row.sentiment || '—'}</td>
                    <td className="py-2 pr-4">{row.duration ? `${Math.round(row.duration)}s` : '—'}</td>
                    <td className="py-2">{row.date || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <div className="text-xs text-muted-foreground">
              {filtered.length > 0
                ? `Showing ${startIdx + 1}–${Math.min(startIdx + pageSize, filtered.length)} of ${filtered.length} records`
                : 'No records'}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Rows:</span>
                <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="h-7 w-[70px] text-xs" data-testid="select-page-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">
                  Page {safePage} of {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={safePage <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  data-testid="btn-prev-page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  data-testid="btn-next-page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
