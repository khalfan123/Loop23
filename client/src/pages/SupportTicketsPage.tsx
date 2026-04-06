import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, ArrowLeft, Send, MessageSquare, Clock, AlertCircle, CheckCircle2, TicketIcon, Trash2, XCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useBranding } from "@/components/BrandingProvider";

interface Ticket {
  id: number;
  subject: string;
  status: string;
  priority: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: number;
  ticketId: number;
  senderName: string;
  senderType: string;
  body: string;
  createdAt: string;
}

interface TicketDetail extends Ticket {
  messages: Message[];
}

type ViewMode = "list" | "create" | "detail";

function statusColor(status: string) {
  switch (status) {
    case "open": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    case "in_progress": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "resolved": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "closed": return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
    default: return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
  }
}

function priorityColor(priority: string) {
  switch (priority) {
    case "urgent": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    case "high": return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
    case "medium": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "low": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    default: return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CreateTicketView({ onBack, onCreated }: { onBack: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const { branding } = useBranding();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("medium");

  const { data: user } = useQuery<{ name: string; email: string }>({
    queryKey: ["/api/auth/me"],
  });

  const userName = user?.name || "User";
  const userEmail = user?.email || "";
  const appName = branding.app_name || "Support";

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/support/tickets", {
        subject,
        name: userName,
        email: userEmail,
        priority,
        message: body,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Ticket created", description: "Your support ticket has been submitted." });
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      onCreated();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to create ticket", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-from-create">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Tickets
        </Button>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-1">Contact {appName} Support</h2>
        <p className="text-sm text-muted-foreground">
          Hi {userName}, tell us how we can help you. We'll respond to {userEmail}.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Subject</label>
              <Input
                placeholder="Brief description of your issue"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                data-testid="input-ticket-subject"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Priority</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger data-testid="select-ticket-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Message</label>
            <Textarea
              placeholder="Describe your issue in detail..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              data-testid="input-ticket-body"
            />
          </div>

          <Separator />

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onBack} data-testid="button-cancel-ticket">
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!subject.trim() || !body.trim() || !userEmail || createMutation.isPending}
              data-testid="button-submit-ticket"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Submit Ticket
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TicketDetailView({ ticketId, onBack }: { ticketId: number; onBack: () => void }) {
  const { toast } = useToast();
  const [replyBody, setReplyBody] = useState("");

  const { data: user } = useQuery<{ name: string; email: string }>({
    queryKey: ["/api/auth/me"],
  });

  const { data: ticket, isLoading, isError } = useQuery<TicketDetail>({
    queryKey: ["/api/support/tickets", ticketId.toString()],
    refetchInterval: 5000,
    staleTime: 0,
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/support/tickets/${ticketId}/messages`, {
        senderName: user?.name || "User",
        senderType: "user",
        body: replyBody,
      });
      return res.json();
    },
    onSuccess: () => {
      setReplyBody("");
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets", ticketId.toString()] });
      toast({ title: "Reply sent" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to send reply", variant: "destructive" });
    },
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/support/tickets/${ticketId}/close`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets", ticketId.toString()] });
      toast({ title: "Ticket closed" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to close ticket", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/support/tickets/${ticketId}`);
    },
    onSuccess: () => {
      toast({ title: "Ticket deleted" });
      onBack();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to delete ticket", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !ticket) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="h-12 w-12 text-destructive/50 mb-4" />
            <h3 className="font-medium text-lg mb-1">Failed to load ticket</h3>
            <p className="text-sm text-muted-foreground">The ticket could not be found or loaded.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-tickets">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Tickets
        </Button>
        <div className="flex items-center gap-2">
          {ticket.status !== "closed" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-close-ticket">
                  <XCircle className="h-4 w-4 mr-1" />
                  Close Ticket
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Close this ticket?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will mark ticket #{ticket.id} as closed. You can still view it but won't be able to reply.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-close">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => closeMutation.mutate()}
                    data-testid="button-confirm-close"
                  >
                    {closeMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Close Ticket
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" data-testid="button-delete-ticket">
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this ticket?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete ticket #{ticket.id} and all its messages. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Delete Ticket
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <CardTitle className="text-lg" data-testid="text-ticket-subject">{ticket.subject}</CardTitle>
              <CardDescription>
                #{ticket.id} &middot; {ticket.name} ({ticket.email}) &middot; {formatDate(ticket.createdAt)}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge className={priorityColor(ticket.priority)} data-testid="badge-ticket-priority">{ticket.priority}</Badge>
              <Badge className={statusColor(ticket.status)} data-testid="badge-ticket-status">{ticket.status.replace("_", " ")}</Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-4">
        <h3 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Messages ({ticket.messages?.length || 0})
        </h3>

        {ticket.messages?.map((msg) => (
          <Card
            key={msg.id}
            className={`${msg.senderType === "agent" ? "border-l-4 border-l-primary/50" : "border-l-4 border-l-muted-foreground/30"}`}
            data-testid={`card-message-${msg.id}`}
          >
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm flex items-center gap-2">
                  {msg.senderName}
                  <Badge variant="outline" className="text-xs font-normal">
                    {msg.senderType === "agent" ? "Support" : "You"}
                  </Badge>
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDate(msg.createdAt)}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap" data-testid={`text-message-body-${msg.id}`}>{msg.body}</p>
            </CardContent>
          </Card>
        ))}

        {(!ticket.messages || ticket.messages.length === 0) && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No messages yet.
          </div>
        )}
      </div>

      {ticket.status !== "closed" && (
        <Card>
          <CardContent className="pt-4">
            <div className="space-y-3">
              <label className="text-sm font-medium">Reply</label>
              <Textarea
                placeholder="Type your reply..."
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                rows={3}
                data-testid="input-reply-body"
              />
              <div className="flex justify-end">
                <Button
                  onClick={() => replyMutation.mutate()}
                  disabled={!replyBody.trim() || replyMutation.isPending}
                  data-testid="button-send-reply"
                >
                  {replyMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Send Reply
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function SupportTicketsPage() {
  const { branding } = useBranding();
  const [view, setView] = useState<ViewMode>("list");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const appName = branding.app_name || "Support";

  const ticketUrl = statusFilter !== "all"
    ? `/api/support/tickets?status=${statusFilter}`
    : "/api/support/tickets";

  const { data, isLoading, isError } = useQuery<{ tickets: Ticket[]; total: number; page: number; limit: number }>({
    queryKey: [ticketUrl],
    refetchInterval: 10000,
    staleTime: 0,
  });

  const tickets = data?.tickets || [];

  if (view === "create") {
    return (
      <CreateTicketView
        onBack={() => setView("list")}
        onCreated={() => setView("list")}
      />
    );
  }

  if (view === "detail" && selectedTicketId !== null) {
    return (
      <TicketDetailView
        ticketId={selectedTicketId}
        onBack={() => {
          setView("list");
          setSelectedTicketId(null);
          queryClient.invalidateQueries({ queryKey: [ticketUrl] });
        }}
      />
    );
  }

  const stats = {
    total: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    inProgress: tickets.filter((t) => t.status === "in_progress").length,
    resolved: tickets.filter((t) => t.status === "resolved" || t.status === "closed").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{appName} Support</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create and track your support requests
          </p>
        </div>
        <Button onClick={() => setView("create")} data-testid="button-create-ticket">
          <Plus className="h-4 w-4 mr-2" />
          New Ticket
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                <TicketIcon className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-stat-total">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30">
                <AlertCircle className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-stat-open">{stats.open}</p>
                <p className="text-xs text-muted-foreground">Open</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/30">
                <Clock className="h-4 w-4 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-stat-progress">{stats.inProgress}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/30">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-stat-resolved">{stats.resolved}</p>
                <p className="text-xs text-muted-foreground">Resolved</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="select-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tickets</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="h-12 w-12 text-destructive/50 mb-4" />
            <h3 className="font-medium text-lg mb-1">Failed to load tickets</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Could not load your support tickets. Please try again.
            </p>
            <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: [ticketUrl] })} data-testid="button-retry-tickets">
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <TicketIcon className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-medium text-lg mb-1">No tickets found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {statusFilter !== "all" ? "No tickets match this filter." : "Create your first support ticket to get help."}
            </p>
            {statusFilter === "all" && (
              <Button onClick={() => setView("create")} data-testid="button-create-first-ticket">
                <Plus className="h-4 w-4 mr-2" />
                Create Ticket
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Card
              key={ticket.id}
              className="hover:bg-accent/50 cursor-pointer transition-colors"
              onClick={() => { setSelectedTicketId(ticket.id); setView("detail"); }}
              data-testid={`card-ticket-${ticket.id}`}
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-muted-foreground font-mono">#{ticket.id}</span>
                      <span className="font-medium truncate" data-testid={`text-ticket-subject-${ticket.id}`}>
                        {ticket.subject}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{ticket.name}</span>
                      <span>&middot;</span>
                      <span>{formatDate(ticket.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge className={priorityColor(ticket.priority)} variant="secondary">{ticket.priority}</Badge>
                    <Badge className={statusColor(ticket.status)} variant="secondary">{ticket.status.replace("_", " ")}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
