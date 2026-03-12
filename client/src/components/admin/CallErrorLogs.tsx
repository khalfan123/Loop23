'use strict';
import { useState, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Loader2,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  Info,
  Zap,
  ChevronDown,
  ChevronRight,
  Clock,
  User,
  Activity,
} from "lucide-react";
import { format } from "date-fns";
import { Pagination } from "@/components/Pagination";

interface ErrorLogEntry {
  id: string;
  callId: string | null;
  userId: string | null;
  engineType: string;
  errorCategory: string;
  severity: string;
  message: string;
  latencyMs: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
}

interface PaginatedErrorLogsResponse {
  data: ErrorLogEntry[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

interface ErrorSummary {
  totalErrors24h: number;
  mostCommonCategory: string;
  mostCommonCategoryCount: number;
  avgTimeoutLatencyMs: number;
  topAffectedUsers: Array<{
    userId: string;
    userName: string | null;
    userEmail: string | null;
    errorCount: number;
  }>;
  severityBreakdown: Record<string, number>;
}

const SEVERITY_STYLES: Record<string, string> = {
  info: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  warning: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30",
  error: "bg-red-500/10 text-red-700 border-red-500/30",
  critical: "bg-red-700/20 text-red-800 border-red-700/50",
};

const CATEGORY_LABELS: Record<string, string> = {
  timeout: "Timeout",
  tool_call_delay: "Tool Call Delay",
  tts_failure: "TTS Failure",
  stt_failure: "STT Failure",
  bedrock_error: "Bedrock Error",
  stream_abort: "Stream Abort",
  barge_in: "Barge-In",
  hangup: "Hangup",
  kb_slow: "KB Slow",
};

export default function CallErrorLogs() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [engineFilter, setEngineFilter] = useState("all");
  const [userIdFilter, setUserIdFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.append("page", page.toString());
    params.append("pageSize", pageSize.toString());
    if (categoryFilter !== "all") params.append("category", categoryFilter);
    if (severityFilter !== "all") params.append("severity", severityFilter);
    if (engineFilter !== "all") params.append("engine", engineFilter);
    if (userIdFilter) params.append("userId", userIdFilter);
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    return params.toString();
  };

  const { data: response, isLoading, refetch } = useQuery<PaginatedErrorLogsResponse>({
    queryKey: ["/api/admin/call-errors", page, pageSize, categoryFilter, severityFilter, engineFilter, userIdFilter, startDate, endDate],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/call-errors?${buildQueryParams()}`);
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: summary, isLoading: summaryLoading } = useQuery<ErrorSummary>({
    queryKey: ["/api/admin/call-errors/summary"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/call-errors/summary");
      return res.json();
    },
    staleTime: 30000,
  });

  const logs = response?.data || [];
  const pagination = response?.pagination || { page: 1, pageSize: 25, totalItems: 0, totalPages: 1 };

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical": return <Zap className="h-3.5 w-3.5" />;
      case "error": return <AlertCircle className="h-3.5 w-3.5" />;
      case "warning": return <AlertTriangle className="h-3.5 w-3.5" />;
      default: return <Info className="h-3.5 w-3.5" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold" data-testid="text-error-logs-title">Error Logs</h3>
          <p className="text-sm text-muted-foreground">Call error and performance events across all engines</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-error-logs">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-total-errors">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Errors (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-total-errors-count">
                {summary?.totalErrors24h ?? 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-common-category">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Top Category (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <div>
                <div className="text-2xl font-bold" data-testid="text-top-category">
                  {CATEGORY_LABELS[summary?.mostCommonCategory || ""] || summary?.mostCommonCategory || "—"}
                </div>
                <p className="text-xs text-muted-foreground">{summary?.mostCommonCategoryCount ?? 0} occurrences</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-avg-timeout-latency">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Timeout Latency</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-avg-latency">
                {summary?.avgTimeoutLatencyMs ?? 0}ms
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-affected-users">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Most Affected Users</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <div className="space-y-1">
                {(summary?.topAffectedUsers || []).length === 0 && (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
                {(summary?.topAffectedUsers || []).map((u, i) => (
                  <div key={u.userId || i} className="flex items-center justify-between text-sm">
                    <span className="truncate max-w-[120px]" title={u.userEmail || u.userId}>
                      {u.userName || u.userEmail || u.userId}
                    </span>
                    <Badge variant="secondary" className="text-xs">{u.errorCount}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
                <SelectTrigger className="mt-1" data-testid="select-error-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="timeout">Timeout</SelectItem>
                  <SelectItem value="tool_call_delay">Tool Call Delay</SelectItem>
                  <SelectItem value="tts_failure">TTS Failure</SelectItem>
                  <SelectItem value="stt_failure">STT Failure</SelectItem>
                  <SelectItem value="bedrock_error">Bedrock Error</SelectItem>
                  <SelectItem value="stream_abort">Stream Abort</SelectItem>
                  <SelectItem value="barge_in">Barge-In</SelectItem>
                  <SelectItem value="hangup">Hangup</SelectItem>
                  <SelectItem value="kb_slow">KB Slow</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Severity</Label>
              <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v); setPage(1); }}>
                <SelectTrigger className="mt-1" data-testid="select-error-severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Engine</Label>
              <Select value={engineFilter} onValueChange={(v) => { setEngineFilter(v); setPage(1); }}>
                <SelectTrigger className="mt-1" data-testid="select-error-engine">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Engines</SelectItem>
                  <SelectItem value="bedrock-polly">Bedrock-Polly</SelectItem>
                  <SelectItem value="twilio-openai">Twilio-OpenAI</SelectItem>
                  <SelectItem value="plivo">Plivo</SelectItem>
                  <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">User ID</Label>
              <Input
                placeholder="Filter by user..."
                value={userIdFilter}
                onChange={(e) => { setUserIdFilter(e.target.value); setPage(1); }}
                className="mt-1"
                data-testid="input-error-user-filter"
              />
            </div>

            <div>
              <Label className="text-xs">Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="mt-1"
                data-testid="input-error-start-date"
              />
            </div>

            <div>
              <Label className="text-xs">End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="mt-1"
                data-testid="input-error-end-date"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
              <Activity className="h-8 w-8 mb-2" />
              <p>No error logs found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Call ID</TableHead>
                  <TableHead>Engine</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Latency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const isExpanded = expandedRows.has(log.id);
                  return (
                    <Fragment key={log.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleRow(log.id)}
                        data-testid={`row-error-log-${log.id}`}
                      >
                        <TableCell>
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(log.createdAt), "MMM d, HH:mm:ss")}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="truncate max-w-[100px] block" title={log.userEmail || log.userId || "—"}>
                            {log.userName || log.userEmail || log.userId || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {log.callId ? (
                            <span
                              className="text-blue-600 hover:underline cursor-pointer truncate max-w-[80px] block"
                              title={log.callId}
                              data-testid={`link-call-${log.callId}`}
                            >
                              {log.callId.substring(0, 8)}...
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{log.engineType}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {CATEGORY_LABELS[log.errorCategory] || log.errorCategory}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs ${SEVERITY_STYLES[log.severity] || ""}`}
                            data-testid={`badge-severity-${log.severity}`}
                          >
                            {getSeverityIcon(log.severity)}
                            <span className="ml-1">{log.severity}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate" title={log.message}>
                          {log.message}
                        </TableCell>
                        <TableCell className="text-xs">
                          {log.latencyMs != null ? (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {log.latencyMs}ms
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${log.id}-detail`}>
                          <TableCell colSpan={9} className="bg-muted/30 p-4">
                            <div className="space-y-2">
                              <div>
                                <span className="text-xs font-semibold text-muted-foreground">Full Message:</span>
                                <p className="text-sm mt-1">{log.message}</p>
                              </div>
                              {log.metadata && Object.keys(log.metadata).length > 0 && (
                                <div>
                                  <span className="text-xs font-semibold text-muted-foreground">Metadata:</span>
                                  <pre className="text-xs mt-1 p-2 bg-muted rounded overflow-x-auto max-h-48">
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}
                              <div className="flex gap-4 text-xs text-muted-foreground">
                                <span>ID: {log.id}</span>
                                {log.callId && <span>Call: {log.callId}</span>}
                                {log.userId && <span>User: {log.userId}</span>}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {pagination.totalPages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          pageSize={pagination.pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      )}
    </div>
  );
}
