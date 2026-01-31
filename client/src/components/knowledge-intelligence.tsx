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
  RefreshCw
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

  const { data: stats, isLoading: statsLoading } = useQuery<IntelligenceStats>({
    queryKey: ["/api/knowledge-intelligence/intelligence-stats"],
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
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">AI Content Studio</h3>
            <Button onClick={() => setGenerateDialogOpen(true)} data-testid="button-generate-content">
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Content
            </Button>
          </div>

          {articles.length === 0 ? (
            <Card data-testid="card-no-articles">
              <CardContent className="py-8 text-center">
                <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h4 className="font-medium mb-2" data-testid="text-no-articles-title">No Generated Content Yet</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Use AI to generate articles, FAQs, battlecards, and more from your knowledge base.
                </p>
                <Button onClick={() => setGenerateDialogOpen(true)} data-testid="button-generate-first-article">Generate Your First Article</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {articles.map((article) => (
                <Card key={article.id} data-testid={`card-article-${article.id}`}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium truncate" data-testid={`text-article-title-${article.id}`}>{article.title}</h4>
                          <Badge variant={
                            article.status === "published" ? "default" :
                            article.status === "review" ? "secondary" : "outline"
                          } data-testid={`badge-article-status-${article.id}`}>
                            {article.status}
                          </Badge>
                          <Badge variant="outline">{article.articleType}</Badge>
                        </div>
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          {article.seoScore && <span data-testid={`text-article-seo-${article.id}`}>SEO: {article.seoScore}/100</span>}
                          {article.readabilityScore && <span data-testid={`text-article-readability-${article.id}`}>Readability: {article.readabilityScore}/100</span>}
                          <span data-testid={`text-article-date-${article.id}`}>{new Date(article.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" data-testid={`button-view-article-${article.id}`}>View</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
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
    </div>
  );
}
