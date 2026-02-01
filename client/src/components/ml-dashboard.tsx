import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  Clock,
  FileText,
  Network,
  Layers,
  Target,
  Zap,
  RefreshCw,
  Play,
  CheckCircle,
  XCircle,
  BarChart3,
  Activity,
  Timer,
  Sparkles,
  Globe
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PipelineAnalytics {
  totalPipelines: number;
  completedPipelines: number;
  failedPipelines: number;
  averageDuration: number;
  totalArticlesGenerated: number;
  totalPagesProcessed: number;
}

interface ContentCluster {
  id: string;
  name: string;
  items: string[];
}

interface ContentClusters {
  clusters: ContentCluster[];
  unclustered: string[];
}

interface StaleContent {
  id: string;
  title: string;
  url?: string;
  lastUpdated: string;
  staleDays: number;
}

interface PipelineHistory {
  id: string;
  name: string;
  status: string;
  currentStage: string;
  overallProgress: number;
  createdAt: string;
  completedAt?: string;
  stageDetails?: {
    crawling: { pagesDiscovered: number; pagesCrawled: number };
    analyzing: { entitiesFound: number; topicsFound: number; faqsFound: number };
    generating: { articlesGenerated: number };
    websiteNature?: { industry: string; productCategory: string };
    topicMining?: { topicsDiscovered: number; topicsSelected: number; clusters: number };
  };
}

interface IntelligenceStats {
  crawlJobs: number;
  entities: number;
  topics: number;
  faqs: number;
  articles: number;
  graphNodes: number;
}

export default function MLDashboard() {
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading } = useQuery<IntelligenceStats>({
    queryKey: ["/api/knowledge-intelligence/intelligence-stats"],
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery<PipelineAnalytics>({
    queryKey: ["/api/knowledge-intelligence/pipeline-analytics"],
  });

  const { data: clusters, isLoading: clustersLoading } = useQuery<ContentClusters>({
    queryKey: ["/api/knowledge-intelligence/content-clusters"],
  });

  const { data: staleContent = [], isLoading: staleLoading } = useQuery<StaleContent[]>({
    queryKey: ["/api/knowledge-intelligence/stale-content"],
  });

  const { data: pipelineHistory = [], isLoading: historyLoading } = useQuery<PipelineHistory[]>({
    queryKey: ["/api/knowledge-intelligence/pipeline-history"],
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/knowledge-intelligence/intelligence-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/knowledge-intelligence/pipeline-analytics"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/knowledge-intelligence/content-clusters"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/knowledge-intelligence/stale-content"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/knowledge-intelligence/pipeline-history"] }),
      ]);
    },
    onSuccess: () => {
      toast({ title: "Dashboard Refreshed" });
    }
  });

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
      case 'crawling':
      case 'analyzing':
      case 'generating': return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-dashboard-title">ML Intelligence Dashboard</h2>
          <p className="text-muted-foreground">Monitor your knowledge base ML capabilities</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          data-testid="button-refresh-dashboard"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-stat-pages">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pages Processed</p>
                {analyticsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-bold" data-testid="text-pages-processed">
                    {analytics?.totalPagesProcessed || 0}
                  </p>
                )}
              </div>
              <Globe className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-articles">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Articles Generated</p>
                {analyticsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-bold" data-testid="text-articles-generated">
                    {analytics?.totalArticlesGenerated || 0}
                  </p>
                )}
              </div>
              <Sparkles className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-pipelines">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                {analyticsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-bold" data-testid="text-success-rate">
                    {analytics && analytics.totalPipelines > 0 
                      ? Math.round((analytics.completedPipelines / analytics.totalPipelines) * 100) 
                      : 0}%
                  </p>
                )}
              </div>
              <Target className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-duration">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Duration</p>
                {analyticsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-bold" data-testid="text-avg-duration">
                    {formatDuration(analytics?.averageDuration || 0)}
                  </p>
                )}
              </div>
              <Timer className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2" data-testid="card-knowledge-metrics">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Knowledge Metrics
            </CardTitle>
            <CardDescription>AI-extracted intelligence from your content</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-muted/50" data-testid="metric-entities">
                  <div className="flex items-center gap-2 mb-2">
                    <Network className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Entities</span>
                  </div>
                  <p className="text-2xl font-bold">{stats?.entities || 0}</p>
                  <p className="text-xs text-muted-foreground">People, products, concepts</p>
                </div>

                <div className="p-4 rounded-lg bg-muted/50" data-testid="metric-topics">
                  <div className="flex items-center gap-2 mb-2">
                    <Layers className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">Topics</span>
                  </div>
                  <p className="text-2xl font-bold">{stats?.topics || 0}</p>
                  <p className="text-xs text-muted-foreground">Content categories</p>
                </div>

                <div className="p-4 rounded-lg bg-muted/50" data-testid="metric-faqs">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-medium">FAQs</span>
                  </div>
                  <p className="text-2xl font-bold">{stats?.faqs || 0}</p>
                  <p className="text-xs text-muted-foreground">Auto-detected Q&A</p>
                </div>

                <div className="p-4 rounded-lg bg-muted/50" data-testid="metric-articles">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium">Articles</span>
                  </div>
                  <p className="text-2xl font-bold">{stats?.articles || 0}</p>
                  <p className="text-xs text-muted-foreground">Generated content</p>
                </div>

                <div className="p-4 rounded-lg bg-muted/50" data-testid="metric-crawls">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="h-4 w-4 text-cyan-500" />
                    <span className="text-sm font-medium">Crawl Jobs</span>
                  </div>
                  <p className="text-2xl font-bold">{stats?.crawlJobs || 0}</p>
                  <p className="text-xs text-muted-foreground">Data sources</p>
                </div>

                <div className="p-4 rounded-lg bg-muted/50" data-testid="metric-graph">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="h-4 w-4 text-pink-500" />
                    <span className="text-sm font-medium">Graph Nodes</span>
                  </div>
                  <p className="text-2xl font-bold">{stats?.graphNodes || 0}</p>
                  <p className="text-xs text-muted-foreground">Knowledge graph</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-content-clusters">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Content Clusters
            </CardTitle>
            <CardDescription>Related content groups</CardDescription>
          </CardHeader>
          <CardContent>
            {clustersLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : clusters && clusters.clusters.length > 0 ? (
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {clusters.clusters.slice(0, 8).map((cluster) => (
                    <div 
                      key={cluster.id} 
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                      data-testid={`cluster-${cluster.id}`}
                    >
                      <span className="text-sm font-medium truncate flex-1">{cluster.name}</span>
                      <Badge variant="secondary" className="ml-2">
                        {cluster.items.length} items
                      </Badge>
                    </div>
                  ))}
                  {clusters.unclustered.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-2">
                      + {clusters.unclustered.length} unclustered items
                    </div>
                  )}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No clusters detected yet</p>
                <p className="text-xs">Add more content to enable clustering</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card data-testid="card-pipeline-history">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Pipeline History
            </CardTitle>
            <CardDescription>Recent automation runs</CardDescription>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : pipelineHistory.length > 0 ? (
              <ScrollArea className="h-[250px]">
                <div className="space-y-3">
                  {pipelineHistory.slice(0, 10).map((pipeline) => (
                    <div 
                      key={pipeline.id} 
                      className="p-3 rounded-lg border"
                      data-testid={`pipeline-history-${pipeline.id}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(pipeline.status)}
                          <span className="font-medium text-sm">{pipeline.name}</span>
                        </div>
                        <Badge 
                          variant={pipeline.status === 'completed' ? 'default' : 
                                   pipeline.status === 'failed' ? 'destructive' : 'secondary'}
                        >
                          {pipeline.status}
                        </Badge>
                      </div>
                      {pipeline.status !== 'pending' && pipeline.status !== 'failed' && (
                        <Progress value={pipeline.overallProgress} className="h-1 mb-2" />
                      )}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{new Date(pipeline.createdAt).toLocaleDateString()}</span>
                        {pipeline.stageDetails && (
                          <div className="flex gap-3">
                            {pipeline.stageDetails.crawling && (
                              <span>{pipeline.stageDetails.crawling.pagesCrawled} pages</span>
                            )}
                            {pipeline.stageDetails.generating && (
                              <span>{pipeline.stageDetails.generating.articlesGenerated} articles</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No pipelines run yet</p>
                <p className="text-xs">Start a new pipeline to automate content generation</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-stale-content">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Content Freshness
            </CardTitle>
            <CardDescription>Content that may need updates</CardDescription>
          </CardHeader>
          <CardContent>
            {staleLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : staleContent.length > 0 ? (
              <ScrollArea className="h-[250px]">
                <div className="space-y-2">
                  {staleContent.map((content) => (
                    <div 
                      key={content.id} 
                      className="flex items-center justify-between p-3 rounded-lg border"
                      data-testid={`stale-content-${content.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{content.title}</p>
                        {content.url && (
                          <p className="text-xs text-muted-foreground truncate">{content.url}</p>
                        )}
                      </div>
                      <Badge 
                        variant={content.staleDays > 60 ? 'destructive' : 
                                 content.staleDays > 30 ? 'default' : 'secondary'}
                        className="ml-2"
                      >
                        {content.staleDays}d old
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500 opacity-50" />
                <p className="text-sm">All content is fresh</p>
                <p className="text-xs">No outdated content detected</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-ml-capabilities">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            ML Capabilities
          </CardTitle>
          <CardDescription>Automated intelligence features</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg border hover-elevate">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="h-5 w-5 text-blue-500" />
                <span className="font-medium">Web Crawling</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Sitemap parsing, robots.txt compliance, incremental crawling with change detection
              </p>
            </div>

            <div className="p-4 rounded-lg border hover-elevate">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="h-5 w-5 text-purple-500" />
                <span className="font-medium">AI Analysis</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Entity extraction, topic clustering, FAQ detection, knowledge graph construction
              </p>
            </div>

            <div className="p-4 rounded-lg border hover-elevate">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <span className="font-medium">Topic Intelligence</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Website nature analysis, topic mining, expansion, scoring, and auto-selection
              </p>
            </div>

            <div className="p-4 rounded-lg border hover-elevate">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-orange-500" />
                <span className="font-medium">Content Generation</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Intent-based templates, SEO optimization, editorial QA, citation injection
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
