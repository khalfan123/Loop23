import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Globe, 
  Brain, 
  FileText, 
  Sparkles, 
  Play, 
  Pause, 
  Loader2,
  Network,
  HelpCircle,
  Tags,
  TrendingUp,
  Lightbulb,
  Check,
  AlertTriangle,
  RefreshCw,
  Search
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CrawlJob {
  id: string;
  name: string;
  startUrl: string;
  crawlType: string;
  status: string;
  pagesDiscovered: number;
  pagesCrawled: number;
  pagesProcessed: number;
  maxPages: number;
  createdAt: string;
}

interface Entity {
  id: string;
  entityType: string;
  name: string;
  description?: string;
  mentionCount: number;
}

interface Topic {
  id: string;
  name: string;
  description?: string;
  documentCount: number;
  keywords?: string[];
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  confidence: number;
  isVerified: boolean;
}

interface Article {
  id: string;
  title: string;
  articleType: string;
  status: string;
  content?: string;
  seoScore?: number;
  readabilityScore?: number;
  createdAt: string;
}

interface IntelligenceStats {
  crawlJobs: number;
  entities: number;
  topics: number;
  faqs: number;
  articles: number;
  graphNodes: number;
}

interface TopicGap {
  topic: string;
  suggestion: string;
  priority: string;
}

interface PipelineJob {
  id: string;
  name: string;
  status: string;
  currentStage: string;
  overallProgress: number;
  stageProgress: number;
  estimatedTimeRemaining: number | null;
  stageDetails?: {
    crawling: { pagesDiscovered: number; pagesCrawled: number; startedAt?: string; completedAt?: string };
    analyzing: { itemsTotal: number; itemsProcessed: number; entitiesFound: number; topicsFound: number; faqsFound: number; startedAt?: string; completedAt?: string };
    generating: { articlesPlanned: number; articlesGenerated: number; startedAt?: string; completedAt?: string };
    websiteNature?: { industry: string; productCategory: string; features: number; personas: number };
    topicMining?: { topicsDiscovered: number; topicsExpanded: number; topicsSelected: number; clusters: number };
  };
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export default function KnowledgeIntelligence() {
  const { toast } = useToast();
  const [crawlDialogOpen, setCrawlDialogOpen] = useState(false);
  const [crawlName, setCrawlName] = useState("");
  const [crawlUrl, setCrawlUrl] = useState("");
  const [crawlType, setCrawlType] = useState("single");
  const [maxPages, setMaxPages] = useState("50");

  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generateTopic, setGenerateTopic] = useState("");
  const [generateType, setGenerateType] = useState("article");
  const [generatedBrief, setGeneratedBrief] = useState<any>(null);

  const [pipelineDialogOpen, setPipelineDialogOpen] = useState(false);
  const [pipelineName, setPipelineName] = useState("");
  const [pipelineUrl, setPipelineUrl] = useState("");
  const [pipelineCrawlType, setPipelineCrawlType] = useState("sitemap");
  const [pipelineMaxPages, setPipelineMaxPages] = useState("50");

  // Content Studio state
  const [articleSearch, setArticleSearch] = useState("");
  const [articleTypeFilter, setArticleTypeFilter] = useState("all");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [articlePreviewOpen, setArticlePreviewOpen] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<IntelligenceStats>({
    queryKey: ["/api/knowledge-intelligence/intelligence-stats"],
  });

  // Poll for active pipeline job
  const { data: activePipelineJob } = useQuery<PipelineJob | null>({
    queryKey: ["/api/knowledge-intelligence/pipeline-jobs/active"],
    refetchInterval: (query) => {
      // Poll every 2 seconds while job is running, otherwise every 30 seconds
      const data = query.state.data;
      if (data && ["pending", "crawling", "analyzing", "generating"].includes(data.status)) {
        return 2000;
      }
      return 30000;
    },
  });

  const { data: crawlJobs = [], refetch: refetchCrawlJobs } = useQuery<CrawlJob[]>({
    queryKey: ["/api/knowledge-intelligence/crawl-jobs"],
    refetchInterval: 10000,
  });

  const { data: entities = [] } = useQuery<Entity[]>({
    queryKey: ["/api/knowledge-intelligence/entities"],
  });

  const { data: topics = [] } = useQuery<Topic[]>({
    queryKey: ["/api/knowledge-intelligence/topics"],
  });

  const { data: faqs = [] } = useQuery<FAQ[]>({
    queryKey: ["/api/knowledge-intelligence/faqs"],
  });

  const { data: articles = [] } = useQuery<Article[]>({
    queryKey: ["/api/knowledge-intelligence/articles"],
  });

  const { data: topicGaps = [] } = useQuery<TopicGap[]>({
    queryKey: ["/api/knowledge-intelligence/topic-gaps"],
    enabled: (stats?.topics || 0) > 0,
  });

  const createCrawlMutation = useMutation({
    mutationFn: async (data: { name: string; startUrl: string; crawlType: string; maxPages: number }) => {
      const res = await apiRequest("POST", "/api/knowledge-intelligence/crawl-jobs", data);
      return res.json();
    },
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-intelligence/crawl-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-intelligence/intelligence-stats"] });
      setCrawlDialogOpen(false);
      setCrawlName("");
      setCrawlUrl("");
      toast({ title: "Crawl Job Created", description: "Starting crawl..." });
      startCrawlMutation.mutate(job.id);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const startCrawlMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiRequest("POST", `/api/knowledge-intelligence/crawl-jobs/${jobId}/start`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-intelligence/crawl-jobs"] });
      toast({ title: "Crawl Started" });
    },
  });

  const processCrawlMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiRequest("POST", `/api/knowledge-intelligence/crawl-jobs/${jobId}/process`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-intelligence/crawl-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rag-knowledge"] });
      toast({ title: "Processing Complete", description: `${data.pagesProcessed} pages processed` });
    },
  });

  const generateBriefMutation = useMutation({
    mutationFn: async (data: { topic: string; articleType: string }) => {
      const res = await apiRequest("POST", "/api/knowledge-intelligence/generate/brief", data);
      return res.json();
    },
    onSuccess: (brief) => {
      setGeneratedBrief(brief);
      toast({ title: "Brief Generated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const generateArticleMutation = useMutation({
    mutationFn: async (brief: any) => {
      const res = await apiRequest("POST", "/api/knowledge-intelligence/generate/article", { 
        brief, 
        articleType: generateType 
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-intelligence/articles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-intelligence/intelligence-stats"] });
      setGenerateDialogOpen(false);
      setGeneratedBrief(null);
      setGenerateTopic("");
      toast({ title: "Article Generated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const analyzeAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/knowledge-intelligence/analyze-all");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-intelligence/entities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-intelligence/topics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-intelligence/faqs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-intelligence/intelligence-stats"] });
      toast({ 
        title: "Analysis Complete", 
        description: `Analyzed ${data.analyzed} of ${data.total} items` 
      });
    },
    onError: (error: any) => {
      toast({ title: "Analysis Failed", description: error.message, variant: "destructive" });
    },
  });

  const createPipelineMutation = useMutation({
    mutationFn: async (data: { name: string; startUrl: string; crawlType: string; maxPages: number }) => {
      const res = await apiRequest("POST", "/api/knowledge-intelligence/pipeline-jobs", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-intelligence/pipeline-jobs/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-intelligence/crawl-jobs"] });
      setPipelineDialogOpen(false);
      setPipelineName("");
      setPipelineUrl("");
      toast({ title: "Pipeline Started", description: "The automated pipeline is now running. You can close this page and the progress will be saved." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleStartPipeline = () => {
    if (!pipelineName || !pipelineUrl) return;
    createPipelineMutation.mutate({
      name: pipelineName,
      startUrl: pipelineUrl,
      crawlType: pipelineCrawlType,
      maxPages: parseInt(pipelineMaxPages) || 50,
    });
  };

  // Format time remaining
  const formatTimeRemaining = (seconds: number | null): string => {
    if (!seconds || seconds <= 0) return "Finishing...";
    if (seconds < 60) return `${seconds}s remaining`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes < 60) return `${minutes}m ${secs}s remaining`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m remaining`;
  };

  // Get stage label
  const getStageLabel = (stage: string): string => {
    switch (stage) {
      case "crawling": return "Crawling Website";
      case "analyzing": return "AI Analysis";
      case "generating": return "Content Generation";
      default: return stage;
    }
  };

  const handleCreateCrawl = () => {
    if (!crawlName || !crawlUrl) return;
    createCrawlMutation.mutate({
      name: crawlName,
      startUrl: crawlUrl,
      crawlType,
      maxPages: parseInt(maxPages) || 50,
    });
  };

  const handleGenerateBrief = () => {
    if (!generateTopic) return;
    generateBriefMutation.mutate({ topic: generateTopic, articleType: generateType });
  };

  const handleGenerateArticle = () => {
    if (!generatedBrief) return;
    generateArticleMutation.mutate(generatedBrief);
  };

  const isLoading = statsLoading;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card data-testid="card-stat-crawl-jobs">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Crawl Jobs</span>
            </div>
            {isLoading ? <Skeleton className="h-8 w-12 mt-1" /> : (
              <p className="text-2xl font-bold mt-1" data-testid="text-stat-crawl-jobs">{stats?.crawlJobs || 0}</p>
            )}
          </CardContent>
        </Card>
        <Card data-testid="card-stat-entities">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Tags className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Entities</span>
            </div>
            {isLoading ? <Skeleton className="h-8 w-12 mt-1" /> : (
              <p className="text-2xl font-bold mt-1" data-testid="text-stat-entities">{stats?.entities || 0}</p>
            )}
          </CardContent>
        </Card>
        <Card data-testid="card-stat-topics">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Topics</span>
            </div>
            {isLoading ? <Skeleton className="h-8 w-12 mt-1" /> : (
              <p className="text-2xl font-bold mt-1" data-testid="text-stat-topics">{stats?.topics || 0}</p>
            )}
          </CardContent>
        </Card>
        <Card data-testid="card-stat-faqs">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">FAQs</span>
            </div>
            {isLoading ? <Skeleton className="h-8 w-12 mt-1" /> : (
              <p className="text-2xl font-bold mt-1" data-testid="text-stat-faqs">{stats?.faqs || 0}</p>
            )}
          </CardContent>
        </Card>
        <Card data-testid="card-stat-articles">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Articles</span>
            </div>
            {isLoading ? <Skeleton className="h-8 w-12 mt-1" /> : (
              <p className="text-2xl font-bold mt-1" data-testid="text-stat-articles">{stats?.articles || 0}</p>
            )}
          </CardContent>
        </Card>
        <Card data-testid="card-stat-graph-nodes">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Network className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Graph Nodes</span>
            </div>
            {isLoading ? <Skeleton className="h-8 w-12 mt-1" /> : (
              <p className="text-2xl font-bold mt-1" data-testid="text-stat-graph-nodes">{stats?.graphNodes || 0}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Progress Bar - Always visible when active */}
      {activePipelineJob && ["pending", "crawling", "analyzing", "generating"].includes(activePipelineJob.status) && (
        <Card className="border-primary/50 bg-primary/5" data-testid="card-pipeline-progress">
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                </div>
                <div>
                  <h4 className="font-medium" data-testid="text-pipeline-name">{activePipelineJob.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {getStageLabel(activePipelineJob.currentStage)} • {formatTimeRemaining(activePipelineJob.estimatedTimeRemaining)}
                  </p>
                </div>
              </div>
              <Badge variant="secondary" data-testid="badge-pipeline-progress">
                {activePipelineJob.overallProgress}%
              </Badge>
            </div>
            
            {/* Main Progress Bar */}
            <div className="space-y-2">
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
                  style={{ width: `${activePipelineJob.overallProgress}%` }}
                  data-testid="progress-bar-overall"
                />
              </div>
              
              {/* Stage Indicators */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className={`flex items-center gap-1.5 ${activePipelineJob.currentStage === "crawling" ? "text-primary font-medium" : activePipelineJob.stageDetails?.crawling?.completedAt ? "text-green-600" : "text-muted-foreground"}`}>
                  {activePipelineJob.stageDetails?.crawling?.completedAt ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : activePipelineJob.currentStage === "crawling" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <div className="h-3.5 w-3.5 rounded-full border border-current" />
                  )}
                  <span>Crawling</span>
                  {activePipelineJob.stageDetails?.crawling && (
                    <span className="text-muted-foreground">
                      ({activePipelineJob.stageDetails.crawling.pagesCrawled} pages)
                    </span>
                  )}
                </div>
                <div className={`flex items-center gap-1.5 ${activePipelineJob.currentStage === "analyzing" ? "text-primary font-medium" : activePipelineJob.stageDetails?.analyzing?.completedAt ? "text-green-600" : "text-muted-foreground"}`}>
                  {activePipelineJob.stageDetails?.analyzing?.completedAt ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : activePipelineJob.currentStage === "analyzing" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <div className="h-3.5 w-3.5 rounded-full border border-current" />
                  )}
                  <span>AI Analysis</span>
                  {activePipelineJob.stageDetails?.analyzing?.itemsProcessed !== undefined && activePipelineJob.stageDetails?.analyzing?.itemsProcessed > 0 && (
                    <span className="text-muted-foreground">
                      ({activePipelineJob.stageDetails.analyzing.entitiesFound} entities)
                    </span>
                  )}
                </div>
                <div className={`flex items-center gap-1.5 ${activePipelineJob.currentStage === "generating" ? "text-primary font-medium" : activePipelineJob.stageDetails?.generating?.completedAt ? "text-green-600" : "text-muted-foreground"}`}>
                  {activePipelineJob.stageDetails?.generating?.completedAt ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : activePipelineJob.currentStage === "generating" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <div className="h-3.5 w-3.5 rounded-full border border-current" />
                  )}
                  <span>Content</span>
                  {activePipelineJob.stageDetails?.generating?.articlesGenerated !== undefined && activePipelineJob.stageDetails?.generating?.articlesGenerated > 0 && (
                    <span className="text-muted-foreground">
                      ({activePipelineJob.stageDetails.generating.articlesGenerated} articles)
                    </span>
                  )}
                </div>
              </div>
              
              {/* Topic Intelligence Progress (shown during generating stage) */}
              {activePipelineJob.currentStage === "generating" && activePipelineJob.stageDetails?.topicMining && (
                <div className="mt-3 pt-3 border-t">
                  <div className="text-xs text-muted-foreground mb-2">Topic Intelligence</div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <div className="text-lg font-semibold">{activePipelineJob.stageDetails.topicMining.topicsDiscovered}</div>
                      <div className="text-xs text-muted-foreground">Discovered</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold">{activePipelineJob.stageDetails.topicMining.topicsExpanded}</div>
                      <div className="text-xs text-muted-foreground">Expanded</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold">{activePipelineJob.stageDetails.topicMining.topicsSelected}</div>
                      <div className="text-xs text-muted-foreground">Selected</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold">{activePipelineJob.stageDetails.topicMining.clusters}</div>
                      <div className="text-xs text-muted-foreground">Clusters</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completed Pipeline Notification */}
      {activePipelineJob && activePipelineJob.status === "completed" && (
        <Card className="border-green-500/50 bg-green-500/5" data-testid="card-pipeline-completed">
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/10">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-green-700">{activePipelineJob.name} - Complete!</h4>
                <p className="text-sm text-muted-foreground">
                  {activePipelineJob.stageDetails?.crawling?.pagesCrawled || 0} pages crawled • 
                  {activePipelineJob.stageDetails?.analyzing?.entitiesFound || 0} entities • 
                  {activePipelineJob.stageDetails?.generating?.articlesGenerated || 0} articles generated
                </p>
              </div>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/knowledge-intelligence/pipeline-jobs/active"] })}
                data-testid="button-dismiss-pipeline"
              >
                Dismiss
              </Button>
            </div>
            
            {/* Website Nature & Topic Intelligence Summary */}
            {activePipelineJob.stageDetails?.websiteNature && (
              <div className="border-t pt-3 mt-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-2 bg-background rounded" data-testid="stat-industry">
                    <div className="text-xs text-muted-foreground">Industry Detected</div>
                    <div className="font-medium text-sm truncate">{activePipelineJob.stageDetails.websiteNature.industry}</div>
                  </div>
                  <div className="p-2 bg-background rounded" data-testid="stat-topics-discovered">
                    <div className="text-xs text-muted-foreground">Topics Discovered</div>
                    <div className="font-medium text-sm">{activePipelineJob.stageDetails.topicMining?.topicsDiscovered || 0}</div>
                  </div>
                  <div className="p-2 bg-background rounded" data-testid="stat-topics-selected">
                    <div className="text-xs text-muted-foreground">Topics Selected</div>
                    <div className="font-medium text-sm">{activePipelineJob.stageDetails.topicMining?.topicsSelected || 0}</div>
                  </div>
                  <div className="p-2 bg-background rounded" data-testid="stat-clusters">
                    <div className="text-xs text-muted-foreground">Topic Clusters</div>
                    <div className="font-medium text-sm">{activePipelineJob.stageDetails.topicMining?.clusters || 0}</div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Failed Pipeline Notification */}
      {activePipelineJob && activePipelineJob.status === "failed" && (
        <Card className="border-destructive/50 bg-destructive/5" data-testid="card-pipeline-failed">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-destructive">{activePipelineJob.name} - Failed</h4>
                <p className="text-sm text-muted-foreground">
                  {activePipelineJob.errorMessage || "An error occurred during processing"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Start Pipeline Button */}
      {!activePipelineJob || !["pending", "crawling", "analyzing", "generating"].includes(activePipelineJob.status) ? (
        <Card className="border-dashed" data-testid="card-start-pipeline">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Automated Knowledge Pipeline</h4>
                <p className="text-sm text-muted-foreground">
                  Crawl a website, extract AI insights, and generate content - all automatically
                </p>
              </div>
              <Button onClick={() => setPipelineDialogOpen(true)} data-testid="button-start-pipeline">
                <Sparkles className="h-4 w-4 mr-2" />
                Start Pipeline
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="crawl" className="space-y-4">
        <TabsList>
          <TabsTrigger value="crawl" data-testid="tab-crawl">
            <Globe className="h-4 w-4 mr-2" />
            Web Crawler
          </TabsTrigger>
          <TabsTrigger value="insights" data-testid="tab-insights">
            <Brain className="h-4 w-4 mr-2" />
            AI Insights
          </TabsTrigger>
          <TabsTrigger value="generate" data-testid="tab-generate">
            <Sparkles className="h-4 w-4 mr-2" />
            Content Studio
          </TabsTrigger>
        </TabsList>

        <TabsContent value="crawl" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Web Crawl Jobs</h3>
            <Button onClick={() => setCrawlDialogOpen(true)} data-testid="button-new-crawl">
              <Globe className="h-4 w-4 mr-2" />
              New Crawl Job
            </Button>
          </div>

          {crawlJobs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h4 className="font-medium mb-2">No Crawl Jobs Yet</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Start crawling websites to automatically import content into your knowledge base.
                </p>
                <Button onClick={() => setCrawlDialogOpen(true)}>Create Your First Crawl</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {crawlJobs.map((job) => (
                <Card key={job.id} data-testid={`card-crawl-job-${job.id}`}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium truncate" data-testid={`text-crawl-job-name-${job.id}`}>{job.name}</h4>
                          <Badge variant={
                            job.status === "completed" ? "default" :
                            job.status === "running" ? "secondary" :
                            job.status === "failed" ? "destructive" : "outline"
                          } data-testid={`badge-crawl-job-status-${job.id}`}>
                            {job.status}
                          </Badge>
                          <Badge variant="outline">{job.crawlType}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate mt-1" data-testid={`text-crawl-job-url-${job.id}`}>{job.startUrl}</p>
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          <span data-testid={`text-crawl-pages-discovered-${job.id}`}>Discovered: {job.pagesDiscovered}</span>
                          <span data-testid={`text-crawl-pages-crawled-${job.id}`}>Crawled: {job.pagesCrawled}</span>
                          <span data-testid={`text-crawl-pages-processed-${job.id}`}>Processed: {job.pagesProcessed}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {job.status === "pending" && (
                          <Button 
                            size="sm" 
                            onClick={() => startCrawlMutation.mutate(job.id)}
                            disabled={startCrawlMutation.isPending}
                            data-testid={`button-start-crawl-${job.id}`}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        {job.status === "completed" && job.pagesCrawled > job.pagesProcessed && (
                          <Button 
                            size="sm"
                            variant="outline"
                            onClick={() => processCrawlMutation.mutate(job.id)}
                            disabled={processCrawlMutation.isPending}
                            data-testid={`button-process-crawl-${job.id}`}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Process
                          </Button>
                        )}
                        {job.status === "running" && (
                          <Button size="sm" variant="outline" disabled data-testid={`button-running-crawl-${job.id}`}>
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">AI-Powered Insights</h3>
            <Button 
              onClick={() => analyzeAllMutation.mutate()}
              disabled={analyzeAllMutation.isPending}
              data-testid="button-analyze-all"
            >
              {analyzeAllMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-2" />
                  Analyze All Content
                </>
              )}
            </Button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Card data-testid="card-entities">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Tags className="h-4 w-4" />
                  Extracted Entities
                </CardTitle>
                <CardDescription>People, organizations, products, and concepts found in your content</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  {entities.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-entities">
                      No entities extracted yet. Analyze your content to extract entities.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {entities.slice(0, 10).map((entity) => (
                        <div key={entity.id} className="flex items-center justify-between py-1" data-testid={`row-entity-${entity.id}`}>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{entity.entityType}</Badge>
                            <span className="text-sm" data-testid={`text-entity-name-${entity.id}`}>{entity.name}</span>
                          </div>
                          <span className="text-xs text-muted-foreground" data-testid={`text-entity-mentions-${entity.id}`}>{entity.mentionCount} mentions</span>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            <Card data-testid="card-topics">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Detected Topics
                </CardTitle>
                <CardDescription>Automatically clustered topics from your content</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  {topics.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No topics detected yet. Analyze your content to discover topics.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {topics.map((topic) => (
                        <div key={topic.id} className="py-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{topic.name}</span>
                            <span className="text-xs text-muted-foreground">{topic.documentCount} docs</span>
                          </div>
                          {topic.keywords && topic.keywords.length > 0 && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {topic.keywords.slice(0, 4).map((kw, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">{kw}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            <Card data-testid="card-faqs">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <HelpCircle className="h-4 w-4" />
                  Detected FAQs
                </CardTitle>
                <CardDescription>Question-answer pairs extracted from your content</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  {faqs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-faqs">
                      No FAQs detected yet. Analyze your content to find Q&A pairs.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {faqs.slice(0, 5).map((faq) => (
                        <div key={faq.id} className="py-1" data-testid={`row-faq-${faq.id}`}>
                          <div className="flex items-start gap-2">
                            {faq.isVerified ? (
                              <Check className="h-4 w-4 text-green-500 mt-0.5" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                            )}
                            <div>
                              <p className="text-sm font-medium" data-testid={`text-faq-question-${faq.id}`}>{faq.question}</p>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2" data-testid={`text-faq-answer-${faq.id}`}>{faq.answer}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            <Card data-testid="card-topic-gaps">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  Topic Gaps
                </CardTitle>
                <CardDescription>Suggested topics that might be missing from your coverage</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  {topicGaps.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-topic-gaps">
                      Add more content to discover topic gaps.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {topicGaps.map((gap, i) => (
                        <div key={i} className="py-1" data-testid={`row-topic-gap-${i}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm" data-testid={`text-topic-gap-name-${i}`}>{gap.topic}</span>
                            <Badge variant={
                              gap.priority === "high" ? "destructive" :
                              gap.priority === "medium" ? "default" : "secondary"
                            } data-testid={`badge-topic-gap-priority-${i}`}>
                              {gap.priority}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1" data-testid={`text-topic-gap-suggestion-${i}`}>{gap.suggestion}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="generate" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-lg font-medium">AI Content Studio</h3>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search articles..."
                value={articleSearch}
                onChange={(e) => setArticleSearch(e.target.value)}
                className="w-48"
                data-testid="input-article-search"
              />
              <Select value={articleTypeFilter} onValueChange={setArticleTypeFilter}>
                <SelectTrigger className="w-32" data-testid="select-article-type-filter">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="guide">Guides</SelectItem>
                  <SelectItem value="how-to">How-To</SelectItem>
                  <SelectItem value="tutorial">Tutorials</SelectItem>
                  <SelectItem value="overview">Overviews</SelectItem>
                  <SelectItem value="faq">FAQs</SelectItem>
                  <SelectItem value="article">Articles</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => setGenerateDialogOpen(true)} data-testid="button-generate-content">
                <Sparkles className="h-4 w-4 mr-2" />
                Generate
              </Button>
            </div>
          </div>

          {articles.length === 0 ? (
            <Card data-testid="card-no-articles">
              <CardContent className="py-8 text-center">
                <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h4 className="font-medium mb-2" data-testid="text-no-articles-title">No Generated Content Yet</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Use AI to generate articles, FAQs, guides, and tutorials from your knowledge base.
                </p>
                <Button onClick={() => setGenerateDialogOpen(true)} data-testid="button-generate-first-article">Generate Your First Article</Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Article Type Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {["guide", "how-to", "tutorial", "overview", "faq"].map((type) => {
                  const count = articles.filter(a => a.articleType === type).length;
                  return (
                    <button
                      key={type}
                      onClick={() => setArticleTypeFilter(type === articleTypeFilter ? "all" : type)}
                      className={`p-3 rounded-md border text-left transition-colors ${
                        articleTypeFilter === type ? "border-primary bg-primary/5" : "hover:bg-muted"
                      }`}
                      data-testid={`button-filter-${type}`}
                    >
                      <div className="text-2xl font-bold">{count}</div>
                      <div className="text-xs text-muted-foreground capitalize">{type.replace("-", " ")}s</div>
                    </button>
                  );
                })}
              </div>

              {/* Filtered Articles List */}
              <div className="space-y-3">
                {articles
                  .filter(article => {
                    const matchesSearch = !articleSearch || 
                      article.title.toLowerCase().includes(articleSearch.toLowerCase());
                    const matchesType = articleTypeFilter === "all" || 
                      article.articleType === articleTypeFilter;
                    return matchesSearch && matchesType;
                  })
                  .map((article) => (
                    <Card 
                      key={article.id} 
                      className="hover-elevate cursor-pointer"
                      onClick={() => {
                        setSelectedArticle(article);
                        setArticlePreviewOpen(true);
                      }}
                      data-testid={`card-article-${article.id}`}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-medium" data-testid={`text-article-title-${article.id}`}>{article.title}</h4>
                              <Badge variant={
                                article.status === "published" ? "default" :
                                article.status === "review" ? "secondary" : "outline"
                              } data-testid={`badge-article-status-${article.id}`}>
                                {article.status}
                              </Badge>
                              <Badge variant="outline" className="capitalize">{article.articleType?.replace("-", " ") || "article"}</Badge>
                            </div>
                            <div className="flex gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                              {article.seoScore && <span data-testid={`text-article-seo-${article.id}`}>SEO: {article.seoScore}/100</span>}
                              {article.readabilityScore && <span data-testid={`text-article-readability-${article.id}`}>Readability: {article.readabilityScore}/100</span>}
                              <span data-testid={`text-article-date-${article.id}`}>{new Date(article.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedArticle(article);
                              setArticlePreviewOpen(true);
                            }}
                            data-testid={`button-view-article-${article.id}`}
                          >
                            Read
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                
                {articles.filter(a => {
                  const matchesSearch = !articleSearch || a.title.toLowerCase().includes(articleSearch.toLowerCase());
                  const matchesType = articleTypeFilter === "all" || a.articleType === articleTypeFilter;
                  return matchesSearch && matchesType;
                }).length === 0 && (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <Search className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No articles match your filters</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={crawlDialogOpen} onOpenChange={setCrawlDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Web Crawl Job</DialogTitle>
            <DialogDescription>
              Crawl a website to automatically import content into your knowledge base.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="crawl-name">Job Name</Label>
              <Input
                id="crawl-name"
                placeholder="e.g., Company Docs Crawl"
                value={crawlName}
                onChange={(e) => setCrawlName(e.target.value)}
                data-testid="input-crawl-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="crawl-url">Start URL</Label>
              <Input
                id="crawl-url"
                placeholder="https://example.com/docs"
                value={crawlUrl}
                onChange={(e) => setCrawlUrl(e.target.value)}
                data-testid="input-crawl-url"
              />
            </div>
            <div className="space-y-2">
              <Label>Crawl Type</Label>
              <Select value={crawlType} onValueChange={setCrawlType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single Page</SelectItem>
                  <SelectItem value="sitemap">From Sitemap</SelectItem>
                  <SelectItem value="recursive">Recursive (Follow Links)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-pages">Max Pages</Label>
              <Input
                id="max-pages"
                type="number"
                value={maxPages}
                onChange={(e) => setMaxPages(e.target.value)}
                data-testid="input-max-pages"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCrawlDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateCrawl}
              disabled={createCrawlMutation.isPending || !crawlName || !crawlUrl}
              data-testid="button-start-crawl"
            >
              {createCrawlMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
              ) : "Create & Start"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pipeline Dialog */}
      <Dialog open={pipelineDialogOpen} onOpenChange={setPipelineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Automated Pipeline</DialogTitle>
            <DialogDescription>
              This will crawl your website, extract AI insights (entities, topics, FAQs), 
              and generate content - all automatically. Progress is saved so you can close this page.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pipeline-name">Pipeline Name</Label>
              <Input
                id="pipeline-name"
                placeholder="e.g., Company Knowledge Import"
                value={pipelineName}
                onChange={(e) => setPipelineName(e.target.value)}
                data-testid="input-pipeline-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pipeline-url">Website URL</Label>
              <Input
                id="pipeline-url"
                placeholder="https://example.com/docs"
                value={pipelineUrl}
                onChange={(e) => setPipelineUrl(e.target.value)}
                data-testid="input-pipeline-url"
              />
            </div>
            <div className="space-y-2">
              <Label>Crawl Type</Label>
              <Select value={pipelineCrawlType} onValueChange={setPipelineCrawlType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sitemap">From Sitemap (Recommended)</SelectItem>
                  <SelectItem value="single">Single Page</SelectItem>
                  <SelectItem value="recursive">Recursive (Follow Links)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pipeline-max-pages">Max Pages</Label>
              <Input
                id="pipeline-max-pages"
                type="number"
                value={pipelineMaxPages}
                onChange={(e) => setPipelineMaxPages(e.target.value)}
                data-testid="input-pipeline-max-pages"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPipelineDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleStartPipeline}
              disabled={createPipelineMutation.isPending || !pipelineName || !pipelineUrl}
              data-testid="button-start-pipeline-confirm"
            >
              {createPipelineMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Starting...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Start Pipeline</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={generateDialogOpen} onOpenChange={(open) => {
        setGenerateDialogOpen(open);
        if (!open) {
          setGeneratedBrief(null);
          setGenerateTopic("");
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Generate Content with AI</DialogTitle>
            <DialogDescription>
              Create articles, FAQs, battlecards, and more using your knowledge base.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="generate-topic">Topic</Label>
              <Input
                id="generate-topic"
                placeholder="e.g., How to get started with our product"
                value={generateTopic}
                onChange={(e) => setGenerateTopic(e.target.value)}
                data-testid="input-generate-topic"
              />
            </div>
            <div className="space-y-2">
              <Label>Content Type</Label>
              <Select value={generateType} onValueChange={setGenerateType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="article">Article</SelectItem>
                  <SelectItem value="faq">FAQ Document</SelectItem>
                  <SelectItem value="battlecard">Sales Battlecard</SelectItem>
                  <SelectItem value="one_pager">One-Pager</SelectItem>
                  <SelectItem value="compliance_doc">Compliance Document</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {generatedBrief && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Generated Brief</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="font-medium">{generatedBrief.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {generatedBrief.targetLength} words | {generatedBrief.tone} tone
                  </p>
                  <div className="space-y-1 mt-2">
                    {generatedBrief.outline?.map((section: any, i: number) => (
                      <div key={i} className="text-sm">
                        <span className="font-medium">{section.heading}</span>
                        <ul className="ml-4 text-xs text-muted-foreground">
                          {section.points?.slice(0, 3).map((point: string, j: number) => (
                            <li key={j}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>Cancel</Button>
            {!generatedBrief ? (
              <Button 
                onClick={handleGenerateBrief}
                disabled={generateBriefMutation.isPending || !generateTopic}
                data-testid="button-generate-brief"
              >
                {generateBriefMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating Brief...</>
                ) : "Generate Brief"}
              </Button>
            ) : (
              <Button 
                onClick={handleGenerateArticle}
                disabled={generateArticleMutation.isPending}
                data-testid="button-generate-article"
              >
                {generateArticleMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
                ) : "Generate Full Content"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Article Preview Dialog */}
      <Dialog open={articlePreviewOpen} onOpenChange={(open) => {
        setArticlePreviewOpen(open);
        if (!open) setSelectedArticle(null);
      }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          {selectedArticle && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={
                    selectedArticle.status === "published" ? "default" :
                    selectedArticle.status === "review" ? "secondary" : "outline"
                  }>
                    {selectedArticle.status}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {selectedArticle.articleType?.replace("-", " ") || "article"}
                  </Badge>
                  {selectedArticle.seoScore && (
                    <Badge variant="outline">SEO: {selectedArticle.seoScore}/100</Badge>
                  )}
                  {selectedArticle.readabilityScore && (
                    <Badge variant="outline">Readability: {selectedArticle.readabilityScore}/100</Badge>
                  )}
                </div>
                <DialogTitle className="text-xl mt-2">{selectedArticle.title}</DialogTitle>
                <DialogDescription>
                  Generated on {new Date(selectedArticle.createdAt).toLocaleDateString()}
                </DialogDescription>
              </DialogHeader>
              
              <div className="py-4">
                <div 
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ 
                    __html: selectedArticle.content
                      ?.replace(/\n\n/g, '</p><p>')
                      .replace(/\n/g, '<br/>')
                      .replace(/^/, '<p>')
                      .replace(/$/, '</p>')
                      .replace(/## (.*?)(<br\/>|<\/p>)/g, '</p><h3 class="text-lg font-semibold mt-4 mb-2">$1</h3><p>')
                      .replace(/### (.*?)(<br\/>|<\/p>)/g, '</p><h4 class="font-medium mt-3 mb-1">$1</h4><p>')
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\*(.*?)\*/g, '<em>$1</em>')
                      .replace(/- (.*?)(<br\/>|<\/p>)/g, '<li>$1</li>')
                      || "No content available" 
                  }}
                />
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setArticlePreviewOpen(false)} data-testid="button-close-preview">
                  Close
                </Button>
                <Button variant="outline" onClick={() => {
                  if (selectedArticle.content) {
                    navigator.clipboard.writeText(selectedArticle.content);
                    toast({ title: "Copied!", description: "Article content copied to clipboard." });
                  }
                }} data-testid="button-copy-content">
                  Copy Content
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
