import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  BookOpen,
  Sparkles,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Zap,
  Database,
  GraduationCap,
  Shield,
  Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AgentLearning {
  id: string;
  name: string;
  expertMode: boolean;
  knowledgeSources: number;
  chunksLearned: number;
  totalChunks: number;
  learningScore: number;
}

interface KBDetail {
  id: string;
  name: string;
  totalChunks: number;
  embeddedChunks: number;
  contentSize: number;
}

interface DepartmentLearning {
  id: string;
  name: string;
  agents: AgentLearning[];
  knowledgeBases: KBDetail[];
  overallScore: number;
}

interface LearningProgressData {
  success: boolean;
  departments: DepartmentLearning[];
  globalStats: {
    totalAgents: number;
    expertAgents: number;
    totalKBs: number;
    totalChunks: number;
    embeddedChunks: number;
    lastTrainedAt: string | null;
    isTraining: boolean;
  };
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  if (score > 0) return "text-orange-600 dark:text-orange-400";
  return "text-muted-foreground";
}

function getScoreLabel(score: number): string {
  if (score >= 90) return "Mastered";
  if (score >= 70) return "Proficient";
  if (score >= 50) return "Learning";
  if (score > 0) return "Starting";
  return "No Data";
}

function getProgressColor(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 50) return "bg-amber-500";
  if (score > 0) return "bg-orange-500";
  return "bg-muted";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AgentLearningProgress() {
  const { toast } = useToast();
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  const { data, isLoading, isRefetching } = useQuery<LearningProgressData>({
    queryKey: ['/api/deprock/kb-mastermind/learning-progress'],
    refetchInterval: 30000,
  });

  const trainMutation = useMutation({
    mutationFn: async (departmentId?: string) => {
      const res = await apiRequest('POST', '/api/deprock/kb-mastermind/run', departmentId ? { departmentId } : {});
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/deprock/kb-mastermind/learning-progress'] });
      toast({
        title: "Training Complete",
        description: `Processed ${result.stats?.departmentsProcessed || 0} departments, ${result.stats?.kbsProcessed || 0} knowledge bases, ${result.stats?.cacheWarmed || 0} queries warmed.`,
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Training Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const toggleDept = (deptId: string) => {
    setExpandedDepts(prev => {
      const next = new Set(prev);
      if (next.has(deptId)) next.delete(deptId);
      else next.add(deptId);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="agent-learning-loading">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading learning progress...</span>
      </div>
    );
  }

  const departments = data?.departments || [];
  const stats = data?.globalStats;

  return (
    <div className="space-y-5 px-3 sm:px-4 md:px-6 py-3 sm:py-4" data-testid="agent-learning-page">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <GraduationCap className="h-4 w-4 text-foreground shrink-0" />
          <span className="font-medium text-sm sm:text-base truncate">Agent Learning Progress</span>
          {isRefetching && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => trainMutation.mutate()}
          disabled={trainMutation.isPending || stats?.isTraining}
          data-testid="button-train-all"
        >
          {trainMutation.isPending || stats?.isTraining ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          )}
          {trainMutation.isPending ? "Training..." : "Train All"}
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="learning-global-stats">
          <StatCard icon={<Brain className="h-4 w-4" />} label="Total Agents" value={stats.totalAgents} />
          <StatCard icon={<Sparkles className="h-4 w-4" />} label="Expert Agents" value={stats.expertAgents} accent />
          <StatCard icon={<BookOpen className="h-4 w-4" />} label="Knowledge Bases" value={stats.totalKBs} />
          <StatCard icon={<Database className="h-4 w-4" />} label="Total Chunks" value={stats.totalChunks} />
          <StatCard icon={<Zap className="h-4 w-4" />} label="Embedded" value={stats.embeddedChunks} />
          <StatCard
            icon={<Clock className="h-4 w-4" />}
            label="Last Trained"
            value={stats.lastTrainedAt ? timeAgo(stats.lastTrainedAt) : "Never"}
            isText
          />
        </div>
      )}

      {departments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="agent-learning-empty">
          <GraduationCap className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="font-medium text-muted-foreground">No Deprock Departments</h3>
          <p className="text-sm text-muted-foreground/70 mt-1 max-w-sm">
            Create a Deprock department with agents and knowledge bases to see learning progress.
          </p>
        </div>
      ) : (
        <div className="space-y-3" data-testid="learning-departments-list">
          {departments.map((dept) => (
            <DepartmentCard
              key={dept.id}
              department={dept}
              isExpanded={expandedDepts.has(dept.id)}
              onToggle={() => toggleDept(dept.id)}
              onTrain={() => trainMutation.mutate(dept.id)}
              isTraining={trainMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, accent, isText }: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  accent?: boolean;
  isText?: boolean;
}) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
          {icon}
          <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
        </div>
        <div className={`text-lg font-semibold ${accent ? 'text-violet-600 dark:text-violet-400' : ''} ${isText ? 'text-sm' : ''}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function DepartmentCard({ department, isExpanded, onToggle, onTrain, isTraining }: {
  department: DepartmentLearning;
  isExpanded: boolean;
  onToggle: () => void;
  onTrain: () => void;
  isTraining: boolean;
}) {
  const hasAgents = department.agents.length > 0;
  const hasKBs = department.knowledgeBases.length > 0;

  return (
    <Card className="border-border/50 overflow-hidden" data-testid={`dept-learning-${department.id}`}>
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={onToggle}
        data-testid={`dept-toggle-${department.id}`}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{department.name}</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
              {department.agents.length} agent{department.agents.length !== 1 ? 's' : ''}
            </Badge>
            {department.agents.some(a => a.expertMode) && (
              <Badge className="text-[10px] px-1.5 py-0 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border-0 shrink-0">
                <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                Expert
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-[140px]">
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getProgressColor(department.overallScore)}`}
                style={{ width: `${department.overallScore}%` }}
              />
            </div>
            <span className={`text-xs font-medium w-8 text-right ${getScoreColor(department.overallScore)}`}>
              {department.overallScore}%
            </span>
          </div>
          <span className={`text-[10px] font-medium uppercase tracking-wide w-16 text-right ${getScoreColor(department.overallScore)}`}>
            {getScoreLabel(department.overallScore)}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-border/30 bg-muted/10">
          {hasAgents && (
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Agents</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={(e) => { e.stopPropagation(); onTrain(); }}
                  disabled={isTraining}
                  data-testid={`button-train-dept-${department.id}`}
                >
                  {isTraining ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                  Train
                </Button>
              </div>
              {department.agents.map((agent) => (
                <AgentRow key={agent.id} agent={agent} />
              ))}
            </div>
          )}

          {hasKBs && (
            <div className={`p-3 space-y-2 ${hasAgents ? 'border-t border-border/20' : ''}`}>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Knowledge Sources</span>
              {department.knowledgeBases.map((kb) => (
                <KBRow key={kb.id} kb={kb} />
              ))}
            </div>
          )}

          {!hasAgents && !hasKBs && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No agents or knowledge bases linked to this department.
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function AgentRow({ agent }: { agent: AgentLearning }) {
  return (
    <div
      className="flex items-center gap-3 px-2 py-2 rounded-lg bg-background/60 border border-border/30"
      data-testid={`agent-learning-row-${agent.id}`}
    >
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted shrink-0">
        {agent.expertMode ? (
          <Shield className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
        ) : (
          <Brain className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">{agent.name}</span>
          {agent.expertMode && (
            <Sparkles className="h-3 w-3 text-violet-500 shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
          <span>{agent.knowledgeSources} source{agent.knowledgeSources !== 1 ? 's' : ''}</span>
          <span>{agent.chunksLearned} chunk{agent.chunksLearned !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getProgressColor(agent.learningScore)}`}
            style={{ width: `${agent.learningScore}%` }}
          />
        </div>
        <span className={`text-xs font-medium w-8 text-right ${getScoreColor(agent.learningScore)}`}>
          {agent.learningScore}%
        </span>
      </div>
    </div>
  );
}

function KBRow({ kb }: { kb: KBDetail }) {
  const embeddingRate = kb.totalChunks > 0 ? Math.round((kb.embeddedChunks / kb.totalChunks) * 100) : 0;

  return (
    <div
      className="flex items-center gap-3 px-2 py-2 rounded-lg bg-background/60 border border-border/30"
      data-testid={`kb-learning-row-${kb.id}`}
    >
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted shrink-0">
        <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium truncate block">{kb.name}</span>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
          <span>{kb.totalChunks} chunk{kb.totalChunks !== 1 ? 's' : ''}</span>
          <span>{formatBytes(kb.contentSize)}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getProgressColor(embeddingRate)}`}
            style={{ width: `${embeddingRate}%` }}
          />
        </div>
        <span className={`text-xs font-medium w-8 text-right ${getScoreColor(embeddingRate)}`}>
          {embeddingRate}%
        </span>
      </div>
    </div>
  );
}
