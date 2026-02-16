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
  Search,
  Trash2,
  ChevronRight,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Phone,
  TrendingDown,
  BarChart3,
  CheckCircle,
  XCircle,
  Clock
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface KnowledgeIntelligenceProps {
  section?: "insights" | "content-studio" | "entities" | "topic-clusters" | "faqs" | "content-gaps" | "ml-conversations" | "all";
}

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

interface TopicDocument {
  id: string;
  title: string;
  type: string;
  url?: string;
}

interface Topic {
  id: string;
  name: string;
  description?: string;
  documentCount: number;
  keywords?: string[];
  documents?: TopicDocument[];
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

export default function KnowledgeIntelligence({ section = "all" }: KnowledgeIntelligenceProps) {
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
  const [pipelineCrawlType, setPipelineCrawlType] = useState("comprehensive");
  const [pipelineMaxPages, setPipelineMaxPages] = useState("50");

  // Content Studio state
  const [articleSearch, setArticleSearch] = useState("");
  const [articleTypeFilter, setArticleTypeFilter] = useState("all");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [articlePreviewOpen, setArticlePreviewOpen] = useState(false);
  
  // Topic expansion state
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  // ML Conversations state
  const [mlAnalysisName, setMlAnalysisName] = useState("");
  const [selectedSampleFilter, setSelectedSampleFilter] = useState("all");

  const { data: stats, isLoading: statsLoading } = useQuery<IntelligenceStats>({
    queryKey: ["/api/knowledge-intelligence/intelligence-stats"],
  });

  // ML Conversations queries
  const { data: mlStats, isLoading: mlStatsLoading, refetch: refetchMlStats } = useQuery<{
    totalCallsAnalyzed: number;
    totalIssuesDiscovered: number;
    totalTrainingSamples: number;
    approvedSamples: number;
    availableCallsForAnalysis: number;
    averageSentimentScore?: number;
    resolutionRate?: number;
    improvementPercentage?: number;
  }>({
    queryKey: ["/api/knowledge-intelligence/ml-conversations/stats"],
  });

  const { data: mlJobs = [], refetch: refetchMlJobs } = useQuery<any[]>({
    queryKey: ["/api/knowledge-intelligence/ml-conversations/jobs"],
    refetchInterval: 5000,
  });

  const { data: mlIssues = [], refetch: refetchMlIssues } = useQuery<any[]>({
    queryKey: ["/api/knowledge-intelligence/ml-conversations/issues"],
  });

  const { data: mlSamples = [], refetch: refetchMlSamples } = useQuery<any[]>({
    queryKey: ["/api/knowledge-intelligence/ml-conversations/samples"],
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

  const deleteCrawlJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiRequest("DELETE", `/api/knowledge-intelligence/crawl-jobs/${jobId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-intelligence/crawl-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-intelligence/intelligence-stats"] });
      toast({ title: "Crawl Job Deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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

  // ML Conversations Mutations
  const startMlAnalysisMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const res = await apiRequest("POST", "/api/knowledge-intelligence/ml-conversations/analyze", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-intelligence/ml-conversations/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-intelligence/ml-conversations/stats"] });
      setMlAnalysisName("");
      toast({ title: "Analysis Started", description: "Analyzing call transcripts for insights and training data..." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateIssueMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; suggestedResponse?: string; isTrainingApproved?: boolean }) => {
      const res = await apiRequest("PATCH", `/api/knowledge-intelligence/ml-conversations/issues/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-intelligence/ml-conversations/issues"] });
      toast({ title: "Issue Updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateSampleMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; status: string; rejectionReason?: string; outputText?: string }) => {
      const res = await apiRequest("PATCH", `/api/knowledge-intelligence/ml-conversations/samples/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-intelligence/ml-conversations/samples"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-intelligence/ml-conversations/stats"] });
      toast({ title: "Sample Updated" });
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
      {/* Pipeline Progress Bar - Always visible when active (outside card) */}
      {activePipelineJob && ["pending", "crawling", "analyzing", "generating"].includes(activePipelineJob.status) && (
        <div className="border border-primary/50 bg-primary/5 rounded-lg p-4" data-testid="card-pipeline-progress">
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
        </div>
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

      {section === "all" ? (
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
            <TabsTrigger value="ml-conversations" data-testid="tab-ml-conversations">
              <MessageSquare className="h-4 w-4 mr-2" />
              ML Conversations
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
                        <Button 
                          size="icon" 
                          variant="ghost"
                          onClick={() => {
                            if (confirm("Delete this crawl job and all associated data?")) {
                              deleteCrawlJobMutation.mutate(job.id);
                            }
                          }}
                          disabled={deleteCrawlJobMutation.isPending || job.status === "running"}
                          data-testid={`button-delete-crawl-${job.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
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

        {/* ML Conversations Tab */}
        <TabsContent value="ml-conversations" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-lg font-medium">ML Conversations</h3>
              <p className="text-sm text-muted-foreground">Train AI using insights from real call conversations</p>
            </div>
            <Button 
              onClick={() => {
                const name = `Analysis ${new Date().toLocaleDateString()}`;
                startMlAnalysisMutation.mutate({ name });
              }}
              disabled={startMlAnalysisMutation.isPending || (mlStats?.availableCallsForAnalysis || 0) === 0}
              data-testid="button-start-ml-analysis"
            >
              {startMlAnalysisMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-2" />
                  Analyze Calls
                </>
              )}
            </Button>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card data-testid="card-ml-calls-available">
              <CardContent className="py-4">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">Calls Available</span>
                </div>
                <p className="text-2xl font-bold mt-1" data-testid="text-calls-available">
                  {mlStatsLoading ? <Skeleton className="h-8 w-16" /> : mlStats?.availableCallsForAnalysis || 0}
                </p>
              </CardContent>
            </Card>
            <Card data-testid="card-ml-analyzed">
              <CardContent className="py-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-muted-foreground">Calls Analyzed</span>
                </div>
                <p className="text-2xl font-bold mt-1" data-testid="text-calls-analyzed">
                  {mlStatsLoading ? <Skeleton className="h-8 w-16" /> : mlStats?.totalCallsAnalyzed || 0}
                </p>
              </CardContent>
            </Card>
            <Card data-testid="card-ml-issues">
              <CardContent className="py-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span className="text-xs text-muted-foreground">Issues Found</span>
                </div>
                <p className="text-2xl font-bold mt-1" data-testid="text-issues-found">
                  {mlStatsLoading ? <Skeleton className="h-8 w-16" /> : mlStats?.totalIssuesDiscovered || 0}
                </p>
              </CardContent>
            </Card>
            <Card data-testid="card-ml-samples">
              <CardContent className="py-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  <span className="text-xs text-muted-foreground">Training Samples</span>
                </div>
                <p className="text-2xl font-bold mt-1" data-testid="text-training-samples">
                  {mlStatsLoading ? <Skeleton className="h-8 w-16" /> : (
                    <span>
                      {mlStats?.approvedSamples || 0}
                      <span className="text-sm text-muted-foreground font-normal">/{mlStats?.totalTrainingSamples || 0}</span>
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Active Analysis Jobs */}
          {mlJobs.filter(j => j.status === "processing").length > 0 && (
            <Card data-testid="card-ml-active-job">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <div className="flex-1">
                    <p className="font-medium">Analysis in Progress</p>
                    {mlJobs.filter(j => j.status === "processing").map(job => (
                      <div key={job.id} className="text-sm text-muted-foreground">
                        {job.name}: {job.processedCalls}/{job.totalCalls} calls processed
                        {job.issuesFound > 0 && ` • ${job.issuesFound} issues found`}
                        {job.trainingSamplesCreated > 0 && ` • ${job.trainingSamplesCreated} samples created`}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Common Issues Section */}
          <Card data-testid="card-ml-common-issues">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Common Issues Discovered
              </CardTitle>
              <CardDescription>Recurring problems identified from call conversations</CardDescription>
            </CardHeader>
            <CardContent>
              {mlIssues.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No issues discovered yet</p>
                  <p className="text-sm">Analyze calls to discover common customer issues</p>
                </div>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {mlIssues.map((issue: any) => (
                      <Card key={issue.id} className="bg-muted/30" data-testid={`card-issue-${issue.id}`}>
                        <CardContent className="py-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium" data-testid={`text-issue-name-${issue.id}`}>{issue.issueName}</span>
                                <Badge variant={
                                  issue.severity === "critical" ? "destructive" :
                                  issue.severity === "high" ? "destructive" :
                                  issue.severity === "medium" ? "secondary" : "outline"
                                }>
                                  {issue.severity}
                                </Badge>
                                <Badge variant="outline" className="capitalize">{issue.category || "general"}</Badge>
                                <span className="text-xs text-muted-foreground">({issue.occurrenceCount} occurrences)</span>
                              </div>
                              {issue.description && (
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{issue.description}</p>
                              )}
                              {issue.suggestedResponse && (
                                <div className="mt-2 p-2 bg-green-50 dark:bg-green-950/20 rounded text-sm">
                                  <span className="font-medium text-green-700 dark:text-green-400">Suggested Response:</span>
                                  <p className="text-green-600 dark:text-green-300">{issue.suggestedResponse}</p>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant={issue.isTrainingApproved ? "default" : "outline"}
                                onClick={() => updateIssueMutation.mutate({ id: issue.id, isTrainingApproved: !issue.isTrainingApproved })}
                                disabled={updateIssueMutation.isPending}
                                title={issue.isTrainingApproved ? "Approved for training" : "Approve for training"}
                                data-testid={`button-approve-issue-${issue.id}`}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Training Samples Section */}
          <Card data-testid="card-ml-training-samples">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Training Samples
                  </CardTitle>
                  <CardDescription>Question-answer pairs extracted from conversations</CardDescription>
                </div>
                <Select value={selectedSampleFilter} onValueChange={setSelectedSampleFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-sample-filter">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="pending">Pending Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {mlSamples.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No training samples yet</p>
                  <p className="text-sm">Analyze calls to generate training data</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {mlSamples
                      .filter((s: any) => selectedSampleFilter === "all" || s.status === selectedSampleFilter)
                      .map((sample: any) => (
                      <Card key={sample.id} className="bg-muted/30" data-testid={`card-sample-${sample.id}`}>
                        <CardContent className="py-3">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="capitalize">{sample.sampleType?.replace("_", " ")}</Badge>
                                <Badge variant={
                                  sample.status === "approved" ? "default" :
                                  sample.status === "rejected" ? "destructive" : "secondary"
                                }>
                                  {sample.status}
                                </Badge>
                                {sample.qualityScore && (
                                  <span className="text-xs text-muted-foreground">Quality: {sample.qualityScore.toFixed(0)}%</span>
                                )}
                              </div>
                              {sample.status === "pending" && (
                                <div className="flex gap-1">
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    onClick={() => updateSampleMutation.mutate({ id: sample.id, status: "approved" })}
                                    disabled={updateSampleMutation.isPending}
                                    title="Approve"
                                    data-testid={`button-approve-sample-${sample.id}`}
                                  >
                                    <ThumbsUp className="h-4 w-4 text-green-500" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    onClick={() => updateSampleMutation.mutate({ id: sample.id, status: "rejected", rejectionReason: "Low quality" })}
                                    disabled={updateSampleMutation.isPending}
                                    title="Reject"
                                    data-testid={`button-reject-sample-${sample.id}`}
                                  >
                                    <ThumbsDown className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              )}
                            </div>
                            <div className="space-y-1">
                              <div className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded">
                                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Customer:</span>
                                <p className="text-sm" data-testid={`text-sample-input-${sample.id}`}>{sample.inputText}</p>
                              </div>
                              <div className="p-2 bg-green-50 dark:bg-green-950/20 rounded">
                                <span className="text-xs font-medium text-green-600 dark:text-green-400">AI Response:</span>
                                <p className="text-sm" data-testid={`text-sample-output-${sample.id}`}>{sample.outputText}</p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Analysis History */}
          {mlJobs.length > 0 && (
            <Card data-testid="card-ml-job-history">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Analysis History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {mlJobs.slice(0, 5).map((job: any) => (
                    <div key={job.id} className="flex items-center justify-between p-2 bg-muted/30 rounded" data-testid={`row-job-${job.id}`}>
                      <div className="flex items-center gap-2">
                        {job.status === "completed" ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : job.status === "processing" ? (
                          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        ) : job.status === "failed" ? (
                          <XCircle className="h-4 w-4 text-red-500" />
                        ) : (
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-medium">{job.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{job.processedCalls}/{job.totalCalls} calls</span>
                        <span>{job.issuesFound} issues</span>
                        <span>{job.trainingSamplesCreated} samples</span>
                        <span>{new Date(job.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      ) : section === "insights" ? (
        /* Direct render of Insights when section="insights" */
        <div className="space-y-4">
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
                  <Network className="h-4 w-4" />
                  Topic Clusters
                </CardTitle>
                <CardDescription>Related content grouped by topic</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  {topics.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-topics">
                      No topics detected yet. Analyze your content to discover topics.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {topics.slice(0, 10).map((topic) => (
                        <div key={topic.id} className="p-2 rounded-lg bg-muted/50" data-testid={`row-topic-${topic.id}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm" data-testid={`text-topic-name-${topic.id}`}>{topic.name}</span>
                            <Badge variant="secondary" className="text-xs" data-testid={`badge-topic-docs-${topic.id}`}>{topic.documentCount} docs</Badge>
                          </div>
                          {topic.keywords && topic.keywords.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {topic.keywords.slice(0, 3).map((keyword, i) => (
                                <Badge key={i} variant="outline" className="text-xs">{keyword}</Badge>
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
          </div>
          <Card data-testid="card-faqs">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <HelpCircle className="h-4 w-4" />
                Detected FAQs
              </CardTitle>
              <CardDescription>Questions and answers automatically extracted from your content</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                {faqs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-faqs">
                    No FAQs detected yet. Analyze your content to extract Q&A pairs.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {faqs.map((faq) => (
                      <div key={faq.id} className="p-3 rounded-lg border" data-testid={`row-faq-${faq.id}`}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-medium text-sm" data-testid={`text-faq-question-${faq.id}`}>{faq.question}</h4>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {faq.isVerified && (
                              <Badge variant="default" className="text-xs" data-testid={`badge-faq-verified-${faq.id}`}>
                                <Check className="h-3 w-3 mr-1" />
                                Verified
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs" data-testid={`badge-faq-confidence-${faq.id}`}>
                              {Math.round(faq.confidence * 100)}%
                            </Badge>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground" data-testid={`text-faq-answer-${faq.id}`}>{faq.answer}</p>
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
                Content Gap Analysis
              </CardTitle>
              <CardDescription>Topics that could benefit from more content</CardDescription>
            </CardHeader>
            <CardContent>
              {topicGaps.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-gaps">
                  Analyze your content to discover potential topic gaps.
                </p>
              ) : (
                <div className="space-y-2">
                  {topicGaps.map((gap, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50" data-testid={`row-gap-${i}`}>
                      <div>
                        <span className="font-medium text-sm" data-testid={`text-gap-topic-${i}`}>{gap.topic}</span>
                        <p className="text-xs text-muted-foreground" data-testid={`text-gap-reason-${i}`}>{gap.suggestion}</p>
                      </div>
                      <Badge 
                        variant={gap.priority === "high" ? "destructive" : gap.priority === "medium" ? "default" : "secondary"}
                        className="text-xs"
                        data-testid={`badge-gap-priority-${i}`}
                      >
                        {gap.priority}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : section === "content-studio" ? (
        /* Direct render of Content Studio when section="content-studio" */
        <div className="space-y-4">
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
                  <SelectItem value="how-to">How-to</SelectItem>
                  <SelectItem value="faq">FAQ</SelectItem>
                  <SelectItem value="troubleshooting">Troubleshooting</SelectItem>
                  <SelectItem value="overview">Overview</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => setGenerateDialogOpen(true)} data-testid="button-new-article">
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Article
              </Button>
            </div>
          </div>

          {articles.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h4 className="font-medium mb-2" data-testid="text-no-articles-title">No Articles Yet</h4>
                <p className="text-sm text-muted-foreground mb-4" data-testid="text-no-articles-desc">
                  Generate AI-powered articles based on your knowledge base content.
                </p>
                <Button onClick={() => setGenerateDialogOpen(true)} data-testid="button-generate-first-article">
                  Generate Your First Article
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
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
        </div>
      ) : section === "entities" ? (
        /* Direct render of Entities section */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Extracted Entities</h3>
            <Button 
              onClick={() => analyzeAllMutation.mutate()}
              disabled={analyzeAllMutation.isPending}
              size="sm"
            >
              {analyzeAllMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing...</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-2" /> Refresh Entities</>
              )}
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Tags className="h-4 w-4" />
                People, Organizations, Products & Concepts
              </CardTitle>
              <CardDescription>AI-extracted entities from your knowledge base content</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : entities.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {entities.map((entity) => (
                    <Badge key={entity.id} variant="secondary" className="text-sm py-1 px-2" data-testid={`entity-${entity.id}`}>
                      <span className="font-medium">{entity.name}</span>
                      <span className="text-muted-foreground ml-1 text-xs">({entity.entityType})</span>
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Tags className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No entities extracted yet</p>
                  <p className="text-xs">Run AI analysis to extract entities from your content</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : section === "topic-clusters" ? (
        /* Direct render of Topic Clusters section */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Topic Clusters</h3>
            <Button 
              onClick={() => analyzeAllMutation.mutate()}
              disabled={analyzeAllMutation.isPending}
              size="sm"
            >
              {analyzeAllMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing...</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-2" /> Refresh Clusters</>
              )}
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Network className="h-4 w-4" />
                Related Content Groups
              </CardTitle>
              <CardDescription>Topics discovered and grouped from your content</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : topics.length > 0 ? (
                <div className="space-y-2">
                  {topics.map((topic) => {
                    const isExpanded = expandedTopics.has(topic.id);
                    return (
                      <div key={topic.id} className="border rounded-lg overflow-hidden" data-testid={`topic-${topic.id}`}>
                        <button
                          onClick={() => {
                            const newExpanded = new Set(expandedTopics);
                            if (isExpanded) {
                              newExpanded.delete(topic.id);
                            } else {
                              newExpanded.add(topic.id);
                            }
                            setExpandedTopics(newExpanded);
                          }}
                          className="w-full flex items-center justify-between p-3 hover-elevate text-left"
                        >
                          <div className="flex items-center gap-2">
                            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            <Network className="h-4 w-4 text-green-500" />
                            <span className="font-medium">{topic.name}</span>
                          </div>
                          <Badge variant="secondary">{topic.documentCount} items</Badge>
                        </button>
                        {isExpanded && (
                          <div className="border-t bg-muted/30 p-3">
                            {topic.keywords && topic.keywords.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-3">
                                {topic.keywords.map((keyword, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">{keyword}</Badge>
                                ))}
                              </div>
                            )}
                            {topic.documents && topic.documents.length > 0 ? (
                              <div className="space-y-2">
                                <p className="text-xs text-muted-foreground font-medium mb-2">Related Content:</p>
                                {topic.documents.map((doc) => (
                                  <div key={doc.id} className="flex items-center gap-2 p-2 rounded bg-background text-sm">
                                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="truncate flex-1">{doc.title}</span>
                                    <Badge variant="outline" className="text-xs">{doc.type}</Badge>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                {topic.description || `This topic contains ${topic.documentCount} related documents.`}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Network className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No topic clusters detected yet</p>
                  <p className="text-xs">Add more content and run AI analysis</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : section === "faqs" ? (
        /* Direct render of FAQs section */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Detected FAQs</h3>
            <Button 
              onClick={() => analyzeAllMutation.mutate()}
              disabled={analyzeAllMutation.isPending}
              size="sm"
            >
              {analyzeAllMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing...</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-2" /> Refresh FAQs</>
              )}
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <HelpCircle className="h-4 w-4" />
                Question-Answer Pairs
              </CardTitle>
              <CardDescription>FAQs automatically extracted from your knowledge base</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : faqs.length > 0 ? (
                <div className="space-y-3">
                  {faqs.map((faq) => (
                    <div key={faq.id} className="p-3 rounded-lg border" data-testid={`faq-${faq.id}`}>
                      <div className="flex items-start gap-2">
                        <HelpCircle className="h-4 w-4 text-orange-500 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">{faq.question}</p>
                          <p className="text-sm text-muted-foreground mt-1">{faq.answer}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <HelpCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No FAQs detected yet</p>
                  <p className="text-xs">Run AI analysis to auto-detect Q&A pairs</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : section === "content-gaps" ? (
        /* Direct render of Content Gaps section */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Content Gap Analysis</h3>
            <Button 
              onClick={() => analyzeAllMutation.mutate()}
              disabled={analyzeAllMutation.isPending}
              size="sm"
            >
              {analyzeAllMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing...</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-2" /> Analyze Gaps</>
              )}
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Topics Needing More Content
              </CardTitle>
              <CardDescription>AI-identified opportunities for additional content</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : topicGaps.length > 0 ? (
                <div className="space-y-3">
                  {topicGaps.map((gap, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg border" data-testid={`gap-${index}`}>
                      <div className="flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-yellow-500" />
                        <span className="font-medium">{gap.topic}</span>
                      </div>
                      <Badge variant={gap.priority === 'high' ? 'destructive' : gap.priority === 'medium' ? 'default' : 'secondary'}>
                        {gap.priority} priority
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No content gaps identified</p>
                  <p className="text-xs">Run AI analysis to find content opportunities</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : section === "ml-conversations" ? (
        /* Direct render of ML Conversations section */
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-lg font-medium">ML Conversations</h3>
              <p className="text-sm text-muted-foreground">Train AI using insights from real call conversations</p>
            </div>
            <Button 
              onClick={() => {
                const name = `Analysis ${new Date().toLocaleDateString()}`;
                startMlAnalysisMutation.mutate({ name });
              }}
              disabled={startMlAnalysisMutation.isPending || (mlStats?.availableCallsForAnalysis || 0) === 0}
              data-testid="button-start-ml-analysis-section"
            >
              {startMlAnalysisMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-2" />
                  Analyze Calls
                </>
              )}
            </Button>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card data-testid="card-ml-calls-available-section">
              <CardContent className="py-4">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">Calls Available</span>
                </div>
                <p className="text-2xl font-bold mt-1">
                  {mlStatsLoading ? <Skeleton className="h-8 w-16" /> : mlStats?.availableCallsForAnalysis || 0}
                </p>
              </CardContent>
            </Card>
            <Card data-testid="card-ml-analyzed-section">
              <CardContent className="py-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-muted-foreground">Calls Analyzed</span>
                </div>
                <p className="text-2xl font-bold mt-1">
                  {mlStatsLoading ? <Skeleton className="h-8 w-16" /> : mlStats?.totalCallsAnalyzed || 0}
                </p>
              </CardContent>
            </Card>
            <Card data-testid="card-ml-issues-section">
              <CardContent className="py-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span className="text-xs text-muted-foreground">Issues Found</span>
                </div>
                <p className="text-2xl font-bold mt-1">
                  {mlStatsLoading ? <Skeleton className="h-8 w-16" /> : mlStats?.totalIssuesDiscovered || 0}
                </p>
              </CardContent>
            </Card>
            <Card data-testid="card-ml-samples-section">
              <CardContent className="py-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  <span className="text-xs text-muted-foreground">Training Samples</span>
                </div>
                <p className="text-2xl font-bold mt-1">
                  {mlStatsLoading ? <Skeleton className="h-8 w-16" /> : (
                    <span>
                      {mlStats?.approvedSamples || 0}
                      <span className="text-sm text-muted-foreground font-normal">/{mlStats?.totalTrainingSamples || 0}</span>
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Active Analysis Jobs */}
          {mlJobs.filter(j => j.status === "processing").length > 0 && (
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <div className="flex-1">
                    <p className="font-medium">Analysis in Progress</p>
                    {mlJobs.filter(j => j.status === "processing").map(job => (
                      <div key={job.id} className="text-sm text-muted-foreground">
                        {job.name}: {job.processedCalls}/{job.totalCalls} calls processed
                        {job.issuesFound > 0 && ` • ${job.issuesFound} issues found`}
                        {job.trainingSamplesCreated > 0 && ` • ${job.trainingSamplesCreated} samples created`}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Common Issues Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Common Issues Discovered
              </CardTitle>
              <CardDescription>Recurring problems identified from call conversations</CardDescription>
            </CardHeader>
            <CardContent>
              {mlIssues.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No issues discovered yet</p>
                  <p className="text-sm">Analyze calls to discover common customer issues</p>
                </div>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {mlIssues.map((issue: any) => (
                      <Card key={issue.id} className="bg-muted/30">
                        <CardContent className="py-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{issue.issueName}</span>
                                <Badge variant={
                                  issue.severity === "critical" ? "destructive" :
                                  issue.severity === "high" ? "destructive" :
                                  issue.severity === "medium" ? "secondary" : "outline"
                                }>
                                  {issue.severity}
                                </Badge>
                                <Badge variant="outline" className="capitalize">{issue.category || "general"}</Badge>
                                <span className="text-xs text-muted-foreground">({issue.occurrenceCount} occurrences)</span>
                              </div>
                              {issue.description && (
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{issue.description}</p>
                              )}
                              {issue.suggestedResponse && (
                                <div className="mt-2 p-2 bg-green-50 dark:bg-green-950/20 rounded text-sm">
                                  <span className="font-medium text-green-700 dark:text-green-400">Suggested Response:</span>
                                  <p className="text-green-600 dark:text-green-300">{issue.suggestedResponse}</p>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant={issue.isTrainingApproved ? "default" : "outline"}
                                onClick={() => updateIssueMutation.mutate({ id: issue.id, isTrainingApproved: !issue.isTrainingApproved })}
                                disabled={updateIssueMutation.isPending}
                                title={issue.isTrainingApproved ? "Approved for training" : "Approve for training"}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Training Samples Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Training Samples
                  </CardTitle>
                  <CardDescription>Question-answer pairs extracted from conversations</CardDescription>
                </div>
                <Select value={selectedSampleFilter} onValueChange={setSelectedSampleFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="pending">Pending Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {mlSamples.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No training samples yet</p>
                  <p className="text-sm">Analyze calls to generate training data</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {mlSamples
                      .filter((s: any) => selectedSampleFilter === "all" || s.status === selectedSampleFilter)
                      .map((sample: any) => (
                      <Card key={sample.id} className="bg-muted/30">
                        <CardContent className="py-3">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="capitalize">{sample.sampleType?.replace("_", " ")}</Badge>
                                <Badge variant={
                                  sample.status === "approved" ? "default" :
                                  sample.status === "rejected" ? "destructive" : "secondary"
                                }>
                                  {sample.status}
                                </Badge>
                                {sample.qualityScore && (
                                  <span className="text-xs text-muted-foreground">Quality: {sample.qualityScore.toFixed(0)}%</span>
                                )}
                              </div>
                              {sample.status === "pending" && (
                                <div className="flex gap-1">
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    onClick={() => updateSampleMutation.mutate({ id: sample.id, status: "approved" })}
                                    disabled={updateSampleMutation.isPending}
                                    title="Approve"
                                  >
                                    <ThumbsUp className="h-4 w-4 text-green-500" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    onClick={() => updateSampleMutation.mutate({ id: sample.id, status: "rejected", rejectionReason: "Low quality" })}
                                    disabled={updateSampleMutation.isPending}
                                    title="Reject"
                                  >
                                    <ThumbsDown className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              )}
                            </div>
                            <div className="space-y-1">
                              <div className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded">
                                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Customer:</span>
                                <p className="text-sm">{sample.inputText}</p>
                              </div>
                              <div className="p-2 bg-green-50 dark:bg-green-950/20 rounded">
                                <span className="text-xs font-medium text-green-600 dark:text-green-400">AI Response:</span>
                                <p className="text-sm">{sample.outputText}</p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Analysis History */}
          {mlJobs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Analysis History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {mlJobs.slice(0, 5).map((job: any) => (
                    <div key={job.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                      <div className="flex items-center gap-2">
                        {job.status === "completed" ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : job.status === "processing" ? (
                          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        ) : job.status === "failed" ? (
                          <XCircle className="h-4 w-4 text-red-500" />
                        ) : (
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-medium">{job.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{job.processedCalls}/{job.totalCalls} calls</span>
                        <span>{job.issuesFound} issues</span>
                        <span>{job.trainingSamplesCreated} samples</span>
                        <span>{new Date(job.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}

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
                  className="prose prose-sm dark:prose-invert max-w-none [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-md [&_pre]:overflow-x-auto [&_pre]:text-sm [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre_code]:bg-transparent [&_pre_code]:p-0"
                  dangerouslySetInnerHTML={{ 
                    __html: (() => {
                      let html = selectedArticle.content || "No content available";
                      html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m: string, lang: string, code: string) => {
                        const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        return `<pre><code class="language-${lang || 'text'}">${escaped.trim()}</code></pre>`;
                      });
                      html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
                      html = html.replace(/^# (.*?)$/gm, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>');
                      html = html.replace(/^## (.*?)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>');
                      html = html.replace(/^### (.*?)$/gm, '<h4 class="font-medium mt-3 mb-1">$1</h4>');
                      html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                      html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
                      html = html.replace(/^- (.*?)$/gm, '<li>$1</li>');
                      html = html.replace(/(<li>.*?<\/li>\n?)+/gs, (match: string) => `<ul>${match}</ul>`);
                      html = html.replace(/^\d+\. (.*?)$/gm, '<li>$1</li>');
                      html = html.replace(/\n\n/g, '</p><p>');
                      html = html.replace(/\n/g, '<br/>');
                      html = '<p>' + html + '</p>';
                      html = html.replace(/<p>\s*(<h[2-4]|<pre|<ul|<ol)/g, '$1');
                      html = html.replace(/(<\/h[2-4]>|<\/pre>|<\/ul>|<\/ol>)\s*<\/p>/g, '$1');
                      html = html.replace(/<p>\s*<\/p>/g, '');
                      return html;
                    })()
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
