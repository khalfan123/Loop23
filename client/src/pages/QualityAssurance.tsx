'use strict';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { 
  ShieldCheck, 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle, 
  BarChart3,
  Play,
  Phone,
  Clock,
  MessageSquare,
  XCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DashboardStats {
  totalAnalyzed: number;
  averageScore: number;
  resolutionRate: number;
  issueBreakdown: {
    hallucinations: number;
    interruptions: number;
    negativeSentiment: number;
    complianceIssues: number;
    kbInaccuracies: number;
  };
  scoreTrend: Array<{ date: string; score: number }>;
  recentAnalyses: QaAnalysis[];
}

interface QaAnalysis {
  id: string;
  callId: string;
  overallScore: number;
  audioQualityScore: number;
  languageScore: number;
  complianceScore: number;
  performanceScore: number;
  resolutionStatus: string;
  resolutionNotes: string;
  hasHallucinations: boolean;
  hasInterruptions: boolean;
  hasNegativeSentiment: boolean;
  hasComplianceIssues: boolean;
  hasKbInaccuracies: boolean;
  diagnostics: any;
  keyMoments: any[];
  evidence: any[];
  analyzedAt: string;
}

interface PendingCall {
  id: string;
  phoneNumber: string;
  status: string;
  duration: number;
  createdAt: string;
}

function ScoreCircle({ score, label, size = 'md' }: { score: number; label: string; size?: 'sm' | 'md' | 'lg' }) {
  const getScoreColor = (s: number) => {
    if (s >= 90) return 'text-green-500';
    if (s >= 70) return 'text-yellow-500';
    if (s >= 50) return 'text-orange-500';
    return 'text-red-500';
  };

  const sizeClasses = {
    sm: 'w-16 h-16 text-lg',
    md: 'w-24 h-24 text-2xl',
    lg: 'w-32 h-32 text-4xl'
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`${sizeClasses[size]} rounded-full border-4 flex items-center justify-center font-bold ${getScoreColor(score)}`} 
           style={{ borderColor: 'currentColor' }}>
        {score}
      </div>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

function IssueCard({ icon: Icon, label, count, total }: { icon: any; label: string; count: number; total: number }) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  
  return (
    <div className="flex items-center gap-3 p-3 glass-surface rounded-2xl border border-border/40">
      <div className="rounded-2xl bg-primary-500/[0.08] dark:bg-primary-500/[0.15] p-2">
        <Icon className="w-5 h-5 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-sm text-muted-foreground">{count} / {total}</span>
        </div>
        <Progress value={percentage} className="h-1.5" />
      </div>
    </div>
  );
}

export default function QualityAssurance() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [selectedAnalysis, setSelectedAnalysis] = useState<QaAnalysis | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/qa/dashboard']
  });

  const { data: pendingData, isLoading: pendingLoading } = useQuery<{ calls: PendingCall[]; count: number }>({
    queryKey: ['/api/qa/calls-pending']
  });

  const { data: analysesData, isLoading: analysesLoading } = useQuery<{ analyses: QaAnalysis[]; total: number }>({
    queryKey: ['/api/qa/analyses']
  });

  const analyzeCallMutation = useMutation({
    mutationFn: async (callId: string) => {
      return await apiRequest('POST', `/api/qa/analyze/${callId}`);
    },
    onSuccess: () => {
      toast({ title: 'Analysis complete', description: 'Call has been analyzed successfully.' });
      queryClient.invalidateQueries({ queryKey: ['/api/qa/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/qa/analyses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/qa/calls-pending'] });
    },
    onError: (error: any) => {
      toast({ title: 'Analysis failed', description: error.message, variant: 'destructive' });
    }
  });

  const batchAnalyzeMutation = useMutation({
    mutationFn: async (callIds: string[]) => {
      const response = await apiRequest('POST', '/api/qa/analyze-batch', { callIds });
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({ title: 'Batch analysis complete', description: data.message });
      queryClient.invalidateQueries({ queryKey: ['/api/qa/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/qa/analyses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/qa/calls-pending'] });
    },
    onError: (error: any) => {
      toast({ title: 'Batch analysis failed', description: error.message, variant: 'destructive' });
    }
  });

  const handleAnalyzeAll = () => {
    if (pendingData?.calls && pendingData.calls.length > 0) {
      const callIds = pendingData.calls.slice(0, 10).map(c => c.id);
      batchAnalyzeMutation.mutate(callIds);
    }
  };

  const getScoreBadgeVariant = (score: number): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (score >= 80) return 'default';
    if (score >= 60) return 'secondary';
    return 'destructive';
  };

  const getResolutionBadge = (status: string) => {
    switch (status) {
      case 'resolved':
        return <Badge variant="default"><CheckCircle2 className="w-3 h-3 mr-1" /> Resolved</Badge>;
      case 'unresolved':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Unresolved</Badge>;
      case 'partial':
        return <Badge variant="secondary"><AlertTriangle className="w-3 h-3 mr-1" /> Partial</Badge>;
      case 'transferred':
        return <Badge variant="outline"><Phone className="w-3 h-3 mr-1" /> Transferred</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
            <div className="rounded-2xl bg-blue-500/[0.08] dark:bg-blue-500/[0.15] p-2">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            {t('qa.title', 'AI Quality Assurance')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('qa.subtitle', 'Analyze call quality with AI-powered insights')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/qa'] })}
            data-testid="button-refresh"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          {pendingData && pendingData.count > 0 && (
            <Button 
              onClick={handleAnalyzeAll}
              disabled={batchAnalyzeMutation.isPending}
              data-testid="button-analyze-all"
            >
              {batchAnalyzeMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Analyze Pending ({Math.min(pendingData.count, 10)})
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="glass-surface rounded-2xl">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">
            <BarChart3 className="w-4 h-4 mr-2" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="analyses" data-testid="tab-analyses">
            <CheckCircle2 className="w-4 h-4 mr-2" /> Analyzed Calls
          </TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending">
            <Clock className="w-4 h-4 mr-2" /> Pending
            {pendingData && pendingData.count > 0 && (
              <Badge variant="secondary" className="ml-2">{pendingData.count}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6 mt-6">
          {statsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="glass-card rounded-2xl" data-testid="card-total-analyzed">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Analyzed</p>
                        <p className="text-3xl font-bold tracking-tight">{stats.totalAnalyzed}</p>
                      </div>
                      <div className="rounded-2xl bg-blue-500/[0.08] dark:bg-blue-500/[0.15] p-3">
                        <BarChart3 className="w-7 h-7 text-primary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="glass-card rounded-2xl" data-testid="card-avg-score">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Average Score</p>
                        <p className="text-3xl font-bold tracking-tight">{stats.averageScore}%</p>
                      </div>
                      <div className="rounded-2xl bg-green-500/[0.08] dark:bg-green-500/[0.15] p-3">
                        <TrendingUp className="w-7 h-7 text-green-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="glass-card rounded-2xl" data-testid="card-resolution-rate">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Resolution Rate</p>
                        <p className="text-3xl font-bold tracking-tight">{stats.resolutionRate}%</p>
                      </div>
                      <div className="rounded-2xl bg-green-500/[0.08] dark:bg-green-500/[0.15] p-3">
                        <CheckCircle2 className="w-7 h-7 text-green-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="glass-card rounded-2xl" data-testid="card-pending">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Pending Analysis</p>
                        <p className="text-3xl font-bold tracking-tight">{pendingData?.count || 0}</p>
                      </div>
                      <div className="rounded-2xl bg-yellow-500/[0.08] dark:bg-yellow-500/[0.15] p-3">
                        <Clock className="w-7 h-7 text-yellow-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="glass-card rounded-2xl">
                  <CardHeader>
                    <CardTitle className="tracking-tight">Issue Detection</CardTitle>
                    <CardDescription>Common issues found in analyzed calls</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <IssueCard 
                      icon={MessageSquare} 
                      label="Hallucinations" 
                      count={stats.issueBreakdown.hallucinations} 
                      total={stats.totalAnalyzed} 
                    />
                    <IssueCard 
                      icon={AlertTriangle} 
                      label="Interruptions" 
                      count={stats.issueBreakdown.interruptions} 
                      total={stats.totalAnalyzed} 
                    />
                    <IssueCard 
                      icon={XCircle} 
                      label="Negative Sentiment" 
                      count={stats.issueBreakdown.negativeSentiment} 
                      total={stats.totalAnalyzed} 
                    />
                    <IssueCard 
                      icon={ShieldCheck} 
                      label="Compliance Issues" 
                      count={stats.issueBreakdown.complianceIssues} 
                      total={stats.totalAnalyzed} 
                    />
                  </CardContent>
                </Card>

                <Card className="glass-card rounded-2xl">
                  <CardHeader>
                    <CardTitle className="tracking-tight">Recent Analyses</CardTitle>
                    <CardDescription>Latest quality assessments</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {stats.recentAnalyses.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No analyses yet</p>
                        <p className="text-sm">Analyze some calls to see results here</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {stats.recentAnalyses.slice(0, 5).map((analysis) => (
                          <div 
                            key={analysis.id}
                            className="flex items-center justify-between p-3 glass-surface rounded-2xl border border-border/30 hover-elevate cursor-pointer"
                            onClick={() => setSelectedAnalysis(analysis)}
                            data-testid={`analysis-row-${analysis.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <Badge variant={getScoreBadgeVariant(analysis.overallScore)}>
                                {analysis.overallScore}
                              </Badge>
                              <span className="text-sm truncate max-w-[150px]">
                                {analysis.callId.substring(0, 8)}...
                              </span>
                            </div>
                            {getResolutionBadge(analysis.resolutionStatus)}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <ShieldCheck className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
                <h3 className="text-lg font-semibold tracking-tight mb-2">No QA Data Yet</h3>
                <p className="text-muted-foreground mb-4">Start analyzing your calls to see quality insights</p>
                {pendingData && pendingData.count > 0 && (
                  <Button onClick={handleAnalyzeAll} disabled={batchAnalyzeMutation.isPending}>
                    <Play className="w-4 h-4 mr-2" />
                    Analyze {Math.min(pendingData.count, 10)} Calls
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analyses" className="mt-6">
          <Card className="glass-card rounded-2xl">
            <CardHeader>
              <CardTitle className="tracking-tight">Analyzed Calls</CardTitle>
              <CardDescription>All completed quality assessments</CardDescription>
            </CardHeader>
            <CardContent>
              {analysesLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : analysesData && analysesData.analyses.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Call ID</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Resolution</TableHead>
                      <TableHead>Issues</TableHead>
                      <TableHead>Analyzed</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysesData.analyses.map((analysis) => (
                      <TableRow key={analysis.id} data-testid={`row-analysis-${analysis.id}`}>
                        <TableCell className="font-mono text-sm">
                          {analysis.callId.substring(0, 12)}...
                        </TableCell>
                        <TableCell>
                          <Badge variant={getScoreBadgeVariant(analysis.overallScore)}>
                            {analysis.overallScore}
                          </Badge>
                        </TableCell>
                        <TableCell>{getResolutionBadge(analysis.resolutionStatus)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {analysis.hasHallucinations && <Badge variant="outline" className="text-xs">Halluc.</Badge>}
                            {analysis.hasInterruptions && <Badge variant="outline" className="text-xs">Interr.</Badge>}
                            {analysis.hasNegativeSentiment && <Badge variant="outline" className="text-xs">Neg.</Badge>}
                            {analysis.hasComplianceIssues && <Badge variant="outline" className="text-xs">Compl.</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(analysis.analyzedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => setSelectedAnalysis(analysis)}
                            data-testid={`button-view-${analysis.id}`}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No analyzed calls yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="mt-6">
          <Card className="glass-card rounded-2xl">
            <CardHeader>
              <CardTitle className="tracking-tight">Pending Analysis</CardTitle>
              <CardDescription>Calls waiting for quality assessment</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : pendingData && pendingData.calls.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Call ID</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingData.calls.map((call) => (
                      <TableRow key={call.id} data-testid={`row-pending-${call.id}`}>
                        <TableCell className="font-mono text-sm">
                          {call.id.substring(0, 12)}...
                        </TableCell>
                        <TableCell>{call.phoneNumber || 'N/A'}</TableCell>
                        <TableCell>{call.duration ? `${call.duration}s` : 'N/A'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(call.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => analyzeCallMutation.mutate(call.id)}
                            disabled={analyzeCallMutation.isPending}
                            data-testid={`button-analyze-${call.id}`}
                          >
                            {analyzeCallMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Play className="w-4 h-4 mr-1" />
                                Analyze
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No pending calls</p>
                  <p className="text-sm">All completed calls have been analyzed</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedAnalysis} onOpenChange={() => setSelectedAnalysis(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="tracking-tight">Call Quality Analysis</DialogTitle>
            <DialogDescription>
              Detailed breakdown of call performance
            </DialogDescription>
          </DialogHeader>
          
          {selectedAnalysis && (
            <div className="space-y-6">
              <div className="flex justify-center gap-6 py-4">
                <ScoreCircle score={selectedAnalysis.overallScore} label="Overall" size="lg" />
              </div>

              <div className="grid grid-cols-4 gap-4">
                <ScoreCircle score={selectedAnalysis.audioQualityScore} label="Audio" size="sm" />
                <ScoreCircle score={selectedAnalysis.languageScore} label="Language" size="sm" />
                <ScoreCircle score={selectedAnalysis.complianceScore} label="Compliance" size="sm" />
                <ScoreCircle score={selectedAnalysis.performanceScore} label="Performance" size="sm" />
              </div>

              <div className="p-4 glass-surface rounded-2xl border border-border/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Resolution Status</span>
                  {getResolutionBadge(selectedAnalysis.resolutionStatus)}
                </div>
                {selectedAnalysis.resolutionNotes && (
                  <p className="text-sm text-muted-foreground">{selectedAnalysis.resolutionNotes}</p>
                )}
              </div>

              <div>
                <h4 className="font-medium tracking-tight mb-3">Issues Detected</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedAnalysis.hasHallucinations && (
                    <Badge variant="destructive">Hallucinations Detected</Badge>
                  )}
                  {selectedAnalysis.hasInterruptions && (
                    <Badge variant="secondary">Frequent Interruptions</Badge>
                  )}
                  {selectedAnalysis.hasNegativeSentiment && (
                    <Badge variant="destructive">Negative Sentiment</Badge>
                  )}
                  {selectedAnalysis.hasComplianceIssues && (
                    <Badge variant="destructive">Compliance Issues</Badge>
                  )}
                  {selectedAnalysis.hasKbInaccuracies && (
                    <Badge variant="secondary">KB Inaccuracies</Badge>
                  )}
                  {!selectedAnalysis.hasHallucinations && 
                   !selectedAnalysis.hasInterruptions && 
                   !selectedAnalysis.hasNegativeSentiment && 
                   !selectedAnalysis.hasComplianceIssues &&
                   !selectedAnalysis.hasKbInaccuracies && (
                    <Badge variant="default">No Issues Detected</Badge>
                  )}
                </div>
              </div>

              {selectedAnalysis.keyMoments && selectedAnalysis.keyMoments.length > 0 && (
                <div>
                  <h4 className="font-medium tracking-tight mb-3">Key Moments</h4>
                  <div className="space-y-2">
                    {selectedAnalysis.keyMoments.map((moment: any, idx: number) => (
                      <div key={idx} className="p-2 glass-surface rounded-2xl border border-border/30 text-sm">
                        <Badge variant="outline" className="mr-2">{moment.type}</Badge>
                        {moment.description}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
