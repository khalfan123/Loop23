'use strict';

import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Cpu, ListTodo, CheckCircle2, Clock, XCircle, Plus,
  Loader2, RefreshCw, Trash2, Search, PhoneCall, AlertCircle,
  User, CalendarDays, MessageSquareQuote, Smartphone,
  ShieldCheck, ShieldAlert, ShieldX, ChevronDown, ChevronUp, Quote,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

interface OpsTask {
  id: string;
  callId: string | null;
  trackingSerial: string | null;
  title: string;
  description: string | null;
  taskType: 'refund' | 'callback' | 'followup' | 'escalation' | 'other';
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assignedTo: string | null;
  dueDate: string | null;
  intent: string | null;
  entities: Record<string, string | string[] | null> | null;
  sourceExcerpt: string | null;
  callerPhone: string | null;
  createdAt: string;
}

interface OpsStats {
  pending: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  total: number;
}

interface CreateTaskForm {
  title: string;
  description: string;
  taskType: OpsTask['taskType'];
  priority: OpsTask['priority'];
  assignedTo: string;
}

interface TasksResponse {
  data: OpsTask[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

const PRIORITY_BADGE: Record<OpsTask['priority'], string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

const STATUS_BADGE: Record<OpsTask['status'], string> = {
  pending: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  in_progress: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const TYPE_LABELS: Record<OpsTask['taskType'], string> = {
  refund: 'Refund', callback: 'Callback', followup: 'Follow-up',
  escalation: 'Escalation', other: 'Other',
};

const STATUS_LABELS: Record<OpsTask['status'], string> = {
  pending: 'Pending', in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled',
};

const TYPE_ICON: Record<OpsTask['taskType'], string> = {
  refund: '💰', callback: '📞', followup: '📋', escalation: '🚨', other: '📌',
};

interface ComplianceViolation {
  description: string;
  category: 'missing_disclosure' | 'misleading_statement' | 'unauthorized_action' | 'identity_verification_failure';
  severity: 'critical' | 'major' | 'minor';
  evidence: string;
  recommendedCorrection: string;
}

interface ComplianceReport {
  status: 'pass' | 'fail' | 'warning';
  violations: ComplianceViolation[];
}

const SEVERITY_BADGE: Record<ComplianceViolation['severity'], string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
  major: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  minor: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
};

const CATEGORY_LABELS: Record<ComplianceViolation['category'], string> = {
  missing_disclosure: 'Missing Disclosure',
  misleading_statement: 'Misleading Statement',
  unauthorized_action: 'Unauthorized Action',
  identity_verification_failure: 'Identity Verification Failure',
};

const COMPLIANCE_STATUS_CONFIG: Record<ComplianceReport['status'], { label: string; className: string; Icon: typeof ShieldCheck }> = {
  pass: { label: 'Pass', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', Icon: ShieldCheck },
  fail: { label: 'Fail', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', Icon: ShieldX },
  warning: { label: 'Warning', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', Icon: ShieldAlert },
};

function ComplianceReportPanel({ report, callId, analyzedAt }: { report: ComplianceReport; callId?: string; analyzedAt?: string }) {
  const [expanded, setExpanded] = useState(true);
  const statusConfig = COMPLIANCE_STATUS_CONFIG[report.status];
  const StatusIcon = statusConfig.Icon;

  return (
    <Card className="glass-card rounded-2xl" data-testid={`card-compliance-report${callId ? `-${callId}` : ''}`}>
      <CardContent className="p-4 sm:p-5">
        <button
          className="flex items-center justify-between w-full text-left"
          onClick={() => setExpanded(!expanded)}
          data-testid="button-toggle-compliance"
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${statusConfig.className}`}>
              <StatusIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Compliance Report</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge className={`text-xs px-2 py-0.5 ${statusConfig.className}`} data-testid="badge-compliance-status">
                  {statusConfig.label}
                </Badge>
                {report.violations.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {report.violations.length} violation{report.violations.length !== 1 ? 's' : ''}
                  </span>
                )}
                {callId && (
                  <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded" data-testid="text-compliance-callid">
                    {callId.substring(0, 8)}...
                  </span>
                )}
                {analyzedAt && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(analyzedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {expanded && report.violations.length > 0 && (
          <div className="mt-4 space-y-3">
            {report.violations.map((violation, idx) => (
              <div
                key={idx}
                className={`rounded-xl border p-3 space-y-2 ${
                  violation.severity === 'critical'
                    ? 'border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20'
                    : violation.severity === 'major'
                    ? 'border-orange-300 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20'
                    : 'border-yellow-300 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-950/20'
                }`}
                data-testid={`card-violation-${idx}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium" data-testid={`text-violation-desc-${idx}`}>{violation.description}</p>
                  <div className="flex gap-1.5 shrink-0">
                    <Badge className={`text-xs px-2 py-0.5 ${SEVERITY_BADGE[violation.severity]}`} data-testid={`badge-violation-severity-${idx}`}>
                      {violation.severity}
                    </Badge>
                    <Badge variant="outline" className="text-xs px-2 py-0.5" data-testid={`badge-violation-category-${idx}`}>
                      {CATEGORY_LABELS[violation.category]}
                    </Badge>
                  </div>
                </div>

                {violation.evidence && (
                  <div className="flex items-start gap-2">
                    <Quote className="w-3 h-3 text-muted-foreground mt-1 shrink-0" />
                    <blockquote className="text-xs text-muted-foreground italic border-l-2 border-muted-foreground/30 pl-2" data-testid={`text-violation-evidence-${idx}`}>
                      {violation.evidence}
                    </blockquote>
                  </div>
                )}

                {violation.recommendedCorrection && (
                  <div className="text-xs">
                    <span className="font-medium text-foreground">Recommended: </span>
                    <span className="text-muted-foreground" data-testid={`text-violation-correction-${idx}`}>{violation.recommendedCorrection}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {expanded && report.violations.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-500" />
            No compliance violations detected.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function TaskCard({
  task,
  onOpen,
  onDelete,
  deleting,
}: {
  task: OpsTask;
  onOpen: (t: OpsTask) => void;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const formattedDueDate = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <Card
      className="glass-card rounded-2xl cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => onOpen(task)}
      data-testid={`card-task-${task.id}`}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <span className="text-xl shrink-0 mt-0.5">{TYPE_ICON[task.taskType]}</span>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-sm leading-snug" data-testid={`text-task-title-${task.id}`}>
                  {task.title}
                </p>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge className={`text-xs px-2 py-0.5 ${PRIORITY_BADGE[task.priority]}`}>
                      {task.priority}
                    </Badge>
                    <Badge className={`text-xs px-2 py-0.5 ${STATUS_BADGE[task.status]}`}>
                      {STATUS_LABELS[task.status]}
                    </Badge>
                    <Badge variant="outline" className="text-xs px-2 py-0.5">
                      {TYPE_LABELS[task.taskType]}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                    disabled={deleting}
                    data-testid={`button-delete-task-${task.id}`}
                  >
                    {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {task.trackingSerial && (
                  <span className="flex items-center gap-1.5 font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded" data-testid={`text-task-serial-${task.id}`}>
                    {task.trackingSerial}
                  </span>
                )}
                {task.callerPhone && (
                  <span className="flex items-center gap-1.5 font-medium text-foreground" data-testid={`text-task-phone-${task.id}`}>
                    <Smartphone className="w-3 h-3 text-primary" />
                    <span>{task.callerPhone}</span>
                  </span>
                )}
                {task.assignedTo && (
                  <span className="flex items-center gap-1" data-testid={`text-task-assignee-${task.id}`}>
                    <User className="w-3 h-3" />
                    {task.assignedTo}
                  </span>
                )}
                {formattedDueDate && (
                  <span className="flex items-center gap-1" data-testid={`text-task-due-${task.id}`}>
                    <CalendarDays className="w-3 h-3" />
                    {formattedDueDate}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(task.createdAt).toLocaleDateString()}
                </span>
              </div>

              {task.intent && (
                <p className="text-xs text-muted-foreground" data-testid={`text-task-intent-${task.id}`}>
                  <span className="font-medium text-foreground">Intent:</span> {task.intent}
                </p>
              )}

              {task.sourceExcerpt && (
                <p className="text-xs text-muted-foreground italic line-clamp-2 border-l-2 border-primary/30 pl-2" data-testid={`text-task-excerpt-${task.id}`}>
                  <MessageSquareQuote className="w-3 h-3 inline mr-1 not-italic" />
                  {task.sourceExcerpt}
                </p>
              )}

              {task.entities && Object.values(task.entities).some(Boolean) && (
                <div className="flex flex-wrap gap-1">
                  {Object.entries(task.entities)
                    .filter(([, v]) => v)
                    .slice(0, 4)
                    .map(([k, v]) => (
                      <span key={k} className="text-xs bg-muted rounded px-1.5 py-0.5">
                        <span className="font-medium">{k}:</span>{' '}
                        {Array.isArray(v) ? v.join(', ') : v}
                      </span>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskDetailDialog({
  task, open, onClose, onStatusChange, updating, onReanalyze, reanalyzing,
}: {
  task: OpsTask | null;
  open: boolean;
  onClose: () => void;
  onStatusChange: (id: string, status: OpsTask['status']) => void;
  updating: boolean;
  onReanalyze?: (callId: string) => void;
  reanalyzing?: boolean;
}) {
  if (!task) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{TYPE_ICON[task.taskType]}</span>
            <span data-testid="task-detail-title">{task.title}</span>
          </DialogTitle>
          <DialogDescription>
            {TYPE_LABELS[task.taskType]} · {new Date(task.createdAt).toLocaleDateString()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge className={PRIORITY_BADGE[task.priority]}>{task.priority} priority</Badge>
            <Badge className={STATUS_BADGE[task.status]}>{STATUS_LABELS[task.status]}</Badge>
            {task.assignedTo && <Badge variant="outline">{task.assignedTo}</Badge>}
            {task.trackingSerial && (
              <Badge variant="outline" className="font-mono text-[10px]" data-testid="task-detail-serial">
                {task.trackingSerial}
              </Badge>
            )}
          </div>

          {task.callerPhone && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border" data-testid="task-detail-mobile">
              <Smartphone className="w-4 h-4 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Customer Mobile</p>
                <p className="text-sm font-medium">{task.callerPhone}</p>
              </div>
            </div>
          )}

          {task.description && (
            <div>
              <p className="text-sm font-medium mb-1">What needs to be done</p>
              <p className="text-sm text-muted-foreground">{task.description}</p>
            </div>
          )}

          {task.intent && (
            <div>
              <p className="text-sm font-medium mb-1">Customer intent</p>
              <p className="text-sm text-muted-foreground">{task.intent}</p>
            </div>
          )}

          {task.sourceExcerpt && (
            <div>
              <p className="text-sm font-medium mb-1">From the call</p>
              <blockquote className="text-sm text-muted-foreground italic border-l-2 border-primary/40 pl-3">
                {task.sourceExcerpt}
              </blockquote>
            </div>
          )}

          {task.entities && Object.keys(task.entities).length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Details extracted</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(task.entities).map(([k, v]) => v && (
                  <span key={k} className="text-xs bg-muted rounded px-2 py-1">
                    <span className="font-medium">{k}:</span>{' '}
                    {Array.isArray(v) ? v.join(', ') : v}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-medium mb-2">Update status</p>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(STATUS_LABELS) as OpsTask['status'][]).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={task.status === s ? 'default' : 'outline'}
                  onClick={() => onStatusChange(task.id, s)}
                  disabled={updating}
                  data-testid={`button-status-${s}`}
                >
                  {updating && task.status !== s ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                  {STATUS_LABELS[s]}
                </Button>
              ))}
            </div>
          </div>

          {task.callId && onReanalyze && (
            <div className="pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onReanalyze(task.callId!)}
                disabled={reanalyzing}
                data-testid="button-reanalyze-call"
              >
                {reanalyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Re-analyze This Call
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                Deletes existing tasks for this call and re-runs AI analysis with business context
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateTaskDialog({
  open, onClose, onSubmit, isPending,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (form: CreateTaskForm) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<CreateTaskForm>({ title: '', description: '', taskType: 'other', priority: 'medium', assignedTo: '' });
  const set = (k: keyof CreateTaskForm, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
          <DialogDescription>Add a manual action item</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title *</Label>
            <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Process refund for Khalfan" data-testid="input-task-title" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Additional context..." rows={3} data-testid="input-task-description" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={form.taskType} onValueChange={(v) => set('taskType', v)}>
                <SelectTrigger data-testid="select-create-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(TYPE_LABELS) as [OpsTask['taskType'], string][]).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => set('priority', v)}>
                <SelectTrigger data-testid="select-create-priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Assigned To</Label>
            <Input value={form.assignedTo} onChange={(e) => set('assignedTo', e.target.value)} placeholder="Agent name" data-testid="input-task-assignee" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSubmit(form)} disabled={isPending || !form.title.trim()} data-testid="button-create-task-submit">
            {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Callpilot() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedTask, setSelectedTask] = useState<OpsTask | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery<OpsStats>({
    queryKey: ['/api/ops/stats'],
  });

  const { data: complianceData } = useQuery<{
    reports: { callId: string; complianceReport: ComplianceReport; analyzedAt: string }[];
  }>({
    queryKey: ['/api/ops/compliance-reports'],
  });

  const complianceReports = complianceData?.reports || [];

  const { data: tasksData, isLoading: tasksLoading, isError: tasksError, refetch } = useQuery<TasksResponse>({
    queryKey: ['/api/ops/tasks', statusFilter, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: '200' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'all') params.set('taskType', typeFilter);
      const res = await apiRequest('GET', `/api/ops/tasks?${params.toString()}`);
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OpsTask['status'] }) =>
      apiRequest('PATCH', `/api/ops/tasks/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ops/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ops/stats'] });
      toast({ title: 'Task updated' });
      setSelectedTask(null);
    },
    onError: () => toast({ title: 'Failed to update task', variant: 'destructive' }),
  });

  const createMutation = useMutation({
    mutationFn: (form: CreateTaskForm) =>
      apiRequest('POST', '/api/ops/tasks', {
        title: form.title,
        description: form.description || undefined,
        taskType: form.taskType,
        priority: form.priority,
        assignedTo: form.assignedTo || null,
        isDeleted: false,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ops/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ops/stats'] });
      toast({ title: 'Task created' });
      setShowCreate(false);
    },
    onError: () => toast({ title: 'Failed to create task', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/ops/tasks/${id}`),
    onMutate: (id) => setDeletingId(id),
    onSettled: () => setDeletingId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ops/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ops/stats'] });
    },
    onError: () => toast({ title: 'Failed to delete task', variant: 'destructive' }),
  });

  const reanalyzeMutation = useMutation({
    mutationFn: (callId: string) => apiRequest('POST', `/api/ops/reanalyze/${callId}`),
    onSuccess: async (res) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ['/api/ops/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ops/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ops/compliance-reports'] });
      toast({ title: 'Re-analysis complete', description: data.message });
      setSelectedTask(null);
    },
    onError: () => toast({ title: 'Re-analysis failed', variant: 'destructive' }),
  });

  const reanalyzeAllMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/ops/reanalyze-all'),
    onSuccess: async (res) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ['/api/ops/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ops/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ops/compliance-reports'] });
      toast({ title: 'Re-analysis complete', description: data.message });
    },
    onError: () => toast({ title: 'Re-analysis failed', variant: 'destructive' }),
  });

  const tasks = tasksData?.data || [];

  const filtered = useMemo(() => {
    if (!search.trim()) return tasks;
    const q = search.toLowerCase();
    return tasks.filter((t) =>
      t.title.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.assignedTo?.toLowerCase().includes(q)
    );
  }, [tasks, search]);

  const statItems = [
    { label: 'Pending', value: stats?.pending ?? 0, icon: Clock, color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
    { label: 'In Progress', value: stats?.in_progress ?? 0, icon: Loader2, color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
    { label: 'Completed', value: stats?.completed ?? 0, icon: CheckCircle2, color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
    { label: 'Total', value: stats?.total ?? 0, icon: ListTodo, color: 'bg-muted text-muted-foreground' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Cpu className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-ops-title">Callpilot</h1>
            <p className="text-sm text-muted-foreground">AI extracts action items from every call automatically</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => reanalyzeAllMutation.mutate()}
            disabled={reanalyzeAllMutation.isPending}
            data-testid="button-reanalyze-all"
          >
            {reanalyzeAllMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Re-analyze All
          </Button>
          <Button variant="outline" size="sm" onClick={() => { refetch(); queryClient.invalidateQueries({ queryKey: ['/api/ops/stats'] }); }} data-testid="button-refresh-ops">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-new-task">
            <Plus className="w-4 h-4 mr-2" />
            New Task
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statsLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
          : statItems.map(({ label, value, icon: Icon, color }) => (
              <Card key={label} className="glass-card rounded-2xl">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-2xl font-bold">{value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-task-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36" data-testid="select-status-filter"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36" data-testid="select-type-filter"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {(Object.entries(TYPE_LABELS) as [OpsTask['taskType'], string][]).map(([k, label]) => (
              <SelectItem key={k} value={k}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {complianceReports.length > 0 && (
        <div className="space-y-3" data-testid="section-compliance-reports">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Compliance Reports ({complianceReports.length} call{complianceReports.length !== 1 ? 's' : ''})
          </h2>
          {complianceReports.map((r) => (
            <ComplianceReportPanel key={r.callId} report={r.complianceReport} callId={r.callId} analyzedAt={r.analyzedAt} />
          ))}
        </div>
      )}

      {/* Error */}
      {tasksError && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4" />
          Failed to load tasks. Please refresh.
        </div>
      )}

      {/* Task List */}
      {tasksLoading ? (
        <div className="grid gap-3 grid-cols-1">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <ListTodo className="w-10 h-10" />
          <p className="font-medium">No tasks yet</p>
          <p className="text-sm text-center max-w-sm">
            Tasks are extracted automatically from every call. They'll appear here once calls with actionable requests come in.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1">
          {filtered.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onOpen={setSelectedTask}
              onDelete={(id) => deleteMutation.mutate(id)}
              deleting={deletingId === task.id}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <TaskDetailDialog
        task={selectedTask}
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onStatusChange={(id, status) => updateMutation.mutate({ id, status })}
        updating={updateMutation.isPending}
        onReanalyze={(callId) => reanalyzeMutation.mutate(callId)}
        reanalyzing={reanalyzeMutation.isPending}
      />
      <CreateTaskDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={(form) => createMutation.mutate(form)}
        isPending={createMutation.isPending}
      />
    </div>
  );
}
