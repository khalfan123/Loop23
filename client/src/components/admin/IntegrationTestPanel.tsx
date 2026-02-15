import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { CheckCircle, XCircle, Loader2, RefreshCw, Trash2, Play, Zap, Wifi, WifiOff, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface IntegrationApp {
  id: number;
  name: string;
  slug: string;
  category: string | null;
  n8nNodeType: string;
  isActive: boolean;
}

interface TestResult {
  status: "success" | "failed" | "skipped";
  workflowId?: string;
  error?: string;
}

interface N8nStatus {
  configured: boolean;
  connected: boolean;
  error?: string;
}

interface RunAllResult {
  name: string;
  slug: string;
  category: string | null;
  status: string;
  workflowId?: string;
  error?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  CRM: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  Telephony: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "E-Commerce": "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  Marketing: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  Productivity: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  Analytics: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  Support: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  Finance: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  Communication: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
};

export default function IntegrationTestPanel() {
  const { toast } = useToast();
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [runningSlug, setRunningSlug] = useState<string | null>(null);
  const [workflowIds, setWorkflowIds] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("all");

  const { data: apps = [], isLoading: appsLoading } = useQuery<IntegrationApp[]>({
    queryKey: ["/api/admin/integration-tests"],
  });

  const { data: n8nStatus, isLoading: statusLoading } = useQuery<N8nStatus>({
    queryKey: ["/api/admin/integration-tests/n8n-status"],
  });

  const cleanupMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await apiRequest("POST", "/api/admin/integration-tests/cleanup", { workflowIds: ids });
      return res.json();
    },
    onSuccess: (data: { deleted: number; failed: number }) => {
      setWorkflowIds([]);
      toast({
        title: "Cleanup Complete",
        description: `Deleted ${data.deleted} workflow(s). ${data.failed > 0 ? `${data.failed} failed.` : ""}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Cleanup Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRunAll = async () => {
    setIsRunningAll(true);
    setTestResults({});
    setWorkflowIds([]);

    try {
      const res = await apiRequest("POST", "/api/admin/integration-tests/run-all");
      const results: RunAllResult[] = await res.json();

      const newResults: Record<string, TestResult> = {};
      const newWorkflowIds: string[] = [];

      for (const r of results) {
        newResults[r.slug] = {
          status: r.status === "success" ? "success" : r.status === "skipped" ? "skipped" : "failed",
          workflowId: r.workflowId,
          error: r.error,
        };
        if (r.workflowId) {
          newWorkflowIds.push(r.workflowId);
        }
      }

      setTestResults(newResults);
      setWorkflowIds(newWorkflowIds);

      const passed = results.filter((r) => r.status === "success").length;
      const failed = results.filter((r) => r.status === "failed").length;
      const skipped = results.filter((r) => r.status === "skipped").length;

      toast({
        title: skipped === results.length ? "Tests Skipped" : "Tests Complete",
        description: skipped > 0
          ? `${skipped} skipped (n8n unavailable)${passed > 0 ? `, ${passed} passed` : ""}${failed > 0 ? `, ${failed} failed` : ""}`
          : `${passed}/${results.length} passed, ${failed} failed`,
      });
    } catch (error: any) {
      toast({
        title: "Run All Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRunningAll(false);
    }
  };

  const handleRunSingle = async (app: IntegrationApp) => {
    setRunningSlug(app.slug);
    try {
      const res = await apiRequest("POST", "/api/admin/integration-tests/run", {
        slug: app.slug,
        name: app.name,
        n8nNodeType: app.n8nNodeType,
      });
      const result = await res.json();

      setTestResults((prev) => ({
        ...prev,
        [app.slug]: {
          status: result.status === "success" ? "success" : result.status === "skipped" ? "skipped" : "failed",
          workflowId: result.workflowId,
          error: result.error,
        },
      }));

      if (result.workflowId) {
        setWorkflowIds((prev) => [...prev, result.workflowId]);
      }

      toast({
        title: result.status === "success" ? "Test Passed" : result.status === "skipped" ? "Test Skipped" : "Test Failed",
        description: result.status === "success" ? `${app.name} workflow created` : result.error,
        variant: result.status === "success" ? "default" : result.status === "skipped" ? "default" : "destructive",
      });
    } catch (error: any) {
      setTestResults((prev) => ({
        ...prev,
        [app.slug]: { status: "failed", error: error.message },
      }));
      toast({
        title: "Test Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRunningSlug(null);
    }
  };

  const categories = Array.from(new Set(apps.map((a) => a.category).filter(Boolean))) as string[];

  const filteredApps = categoryFilter === "all" ? apps : apps.filter((a) => a.category === categoryFilter);

  const testedCount = Object.keys(testResults).length;
  const passedCount = Object.values(testResults).filter((r) => r.status === "success").length;
  const failedCount = Object.values(testResults).filter((r) => r.status === "failed").length;
  const skippedCount = Object.values(testResults).filter((r) => r.status === "skipped").length;

  const getCategoryBadgeClass = (category: string | null) => {
    if (!category) return "";
    return CATEGORY_COLORS[category] || "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Integration Tests
          </h2>
          <p className="text-sm text-muted-foreground">
            Test n8n workflow creation for all registered integrations
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {statusLoading ? (
            <Badge variant="secondary">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Checking n8n...
            </Badge>
          ) : n8nStatus?.connected ? (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" data-testid="badge-n8n-connected">
              <Wifi className="h-3 w-3 mr-1" />
              n8n Connected
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200" data-testid="badge-n8n-disconnected">
              <WifiOff className="h-3 w-3 mr-1" />
              n8n {n8nStatus?.configured ? "Unreachable" : "Not Configured"}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={handleRunAll}
            disabled={isRunningAll || appsLoading}
            data-testid="button-run-all-tests"
          >
            {isRunningAll ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing {apps.length} integrations...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run All Tests
              </>
            )}
          </Button>

          {workflowIds.length > 0 && (
            <Button
              variant="outline"
              onClick={() => cleanupMutation.mutate(workflowIds)}
              disabled={cleanupMutation.isPending}
              data-testid="button-cleanup-all"
            >
              {cleanupMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Cleanup All ({workflowIds.length})
            </Button>
          )}

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px]" data-testid="select-category-filter">
              <SelectValue placeholder="Filter category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {testedCount > 0 && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground" data-testid="text-test-stats">
            <span className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              {passedCount}/{testedCount} passed
            </span>
            {failedCount > 0 && (
              <span className="flex items-center gap-1">
                <XCircle className="h-4 w-4 text-rose-500" />
                {failedCount} failed
              </span>
            )}
            {skippedCount > 0 && (
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                {skippedCount} skipped
              </span>
            )}
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Integration Apps
          </CardTitle>
          <CardDescription>
            {filteredApps.length} integration(s) available for testing
          </CardDescription>
        </CardHeader>
        <CardContent>
          {appsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredApps.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No integrations found</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="hidden md:table-cell">n8n Node Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApps.map((app) => {
                    const result = testResults[app.slug];
                    return (
                      <TableRow key={app.slug} data-testid={`row-integration-${app.slug}`}>
                        <TableCell>
                          <span className="font-medium">{app.name}</span>
                        </TableCell>
                        <TableCell>
                          {app.category && (
                            <Badge variant="secondary" className={getCategoryBadgeClass(app.category)}>
                              {app.category}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <code className="text-xs text-muted-foreground">{app.n8nNodeType}</code>
                        </TableCell>
                        <TableCell>
                          {!result ? (
                            <Badge variant="secondary" data-testid={`badge-status-${app.slug}`}>
                              Untested
                            </Badge>
                          ) : result.status === "success" ? (
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" data-testid={`badge-status-${app.slug}`}>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Passed
                            </Badge>
                          ) : result.status === "skipped" ? (
                            <div className="flex flex-col gap-1">
                              <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" data-testid={`badge-status-${app.slug}`}>
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Skipped
                              </Badge>
                              {result.error && (
                                <span className="text-xs text-amber-600 dark:text-amber-400 max-w-[200px] truncate" title={result.error} data-testid={`text-error-${app.slug}`}>
                                  {result.error}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <Badge variant="destructive" data-testid={`badge-status-${app.slug}`}>
                                <XCircle className="h-3 w-3 mr-1" />
                                Failed
                              </Badge>
                              {result.error && (
                                <span className="text-xs text-rose-500 max-w-[200px] truncate" title={result.error} data-testid={`text-error-${app.slug}`}>
                                  {result.error}
                                </span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRunSingle(app)}
                            disabled={isRunningAll || runningSlug === app.slug}
                            data-testid={`button-test-${app.slug}`}
                          >
                            {runningSlug === app.slug ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Play className="h-4 w-4 mr-1" />
                                Test
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}