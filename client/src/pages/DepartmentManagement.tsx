import { useState, useMemo } from "react";
import { useTranslation } from 'react-i18next';
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  Plus, 
  Trash2, 
  Edit, 
  Phone, 
  Building2, 
  Users, 
  Settings, 
  GitBranch,
  Mic,
  ChevronDown,
  ChevronRight,
  Loader2,
  PhoneIncoming,
  Network,
  Power,
  Headphones,
  LayoutGrid
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Department {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  agentCount?: number;
  languages?: string[];
  createdAt: string;
  updatedAt: string;
}

interface DepartmentAgent {
  id: string;
  departmentId: string;
  agentId: string;
  language: string;
  isPrimary: boolean;
  agent: {
    id: string;
    name: string;
    type: string;
    language: string | null;
  };
}

interface IvrConfiguration {
  id: string;
  phoneNumberId: string | null;
  name: string;
  isActive: boolean;
  voiceName: string | null;
  menuOptions: { key: string; label: string; departmentId: string }[] | null;
}

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  friendlyName: string | null;
  status: string;
}

interface Agent {
  id: string;
  name: string;
  type: string;
  language: string | null;
}

const departmentIcons = [
  { value: "phone", label: "Phone", icon: Phone },
  { value: "building-2", label: "Building", icon: Building2 },
  { value: "users", label: "Users", icon: Users },
  { value: "headphones", label: "Headphones", icon: Headphones },
  { value: "settings", label: "Settings", icon: Settings },
];

const departmentColors = [
  { value: "#3b82f6", label: "Blue" },
  { value: "#22c55e", label: "Green" },
  { value: "#f97316", label: "Orange" },
  { value: "#ef4444", label: "Red" },
  { value: "#a855f7", label: "Purple" },
  { value: "#06b6d4", label: "Cyan" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ec4899", label: "Pink" },
];

const languages = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "ar", label: "Arabic" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "pt", label: "Portuguese" },
];

export default function DepartmentManagement() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [activeTab, setActiveTab] = useState<"org-map" | "departments">("org-map");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [showIvrSettingsDialog, setShowIvrSettingsDialog] = useState(false);
  const [showAddAgentDialog, setShowAddAgentDialog] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
  
  const [newDepartment, setNewDepartment] = useState({
    name: "",
    description: "",
    icon: "building-2",
    color: "#3b82f6",
  });
  
  const [selectedAgent, setSelectedAgent] = useState<{ agentId: string; language: string }>({
    agentId: "",
    language: "en",
  });

  const { data: statsData, isLoading: statsLoading } = useQuery<{
    departments: Department[];
    totalDepartments: number;
    activeIvrCount: number;
    ivrConfigurations: IvrConfiguration[];
  }>({
    queryKey: ["/api/departments/stats/overview"],
  });

  const { data: phoneNumbers } = useQuery<PhoneNumber[]>({
    queryKey: ["/api/phone-numbers"],
  });

  const { data: agents } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const { data: departmentAgents, refetch: refetchDepartmentAgents } = useQuery<DepartmentAgent[]>({
    queryKey: ["/api/departments", selectedDepartment?.id, "agents"],
    enabled: !!selectedDepartment,
  });

  const createDepartmentMutation = useMutation({
    mutationFn: async (data: typeof newDepartment) => {
      return apiRequest("POST", "/api/departments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setShowCreateDialog(false);
      setNewDepartment({ name: "", description: "", icon: "building-2", color: "#3b82f6" });
      toast({ title: "Department created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create department", variant: "destructive" });
    },
  });

  const updateDepartmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Department> }) => {
      return apiRequest("PATCH", `/api/departments/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setShowCreateDialog(false);
      setSelectedDepartment(null);
      toast({ title: "Department updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update department", variant: "destructive" });
    },
  });

  const deleteDepartmentMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/departments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setShowDeleteDialog(false);
      setSelectedDepartment(null);
      toast({ title: "Department deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete department", variant: "destructive" });
    },
  });

  const deleteAllDepartmentsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/departments/all/clear");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setShowDeleteAllDialog(false);
      toast({ title: "All departments deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete departments", variant: "destructive" });
    },
  });

  const addAgentMutation = useMutation({
    mutationFn: async ({ departmentId, agentId, language }: { departmentId: string; agentId: string; language: string }) => {
      return apiRequest("POST", `/api/departments/${departmentId}/agents`, { agentId, language });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      refetchDepartmentAgents();
      setShowAddAgentDialog(false);
      setSelectedAgent({ agentId: "", language: "en" });
      toast({ title: "Agent added to department" });
    },
    onError: () => {
      toast({ title: "Failed to add agent", variant: "destructive" });
    },
  });

  const removeAgentMutation = useMutation({
    mutationFn: async ({ departmentId, agentId }: { departmentId: string; agentId: string }) => {
      return apiRequest("DELETE", `/api/departments/${departmentId}/agents/${agentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      refetchDepartmentAgents();
      toast({ title: "Agent removed from department" });
    },
    onError: () => {
      toast({ title: "Failed to remove agent", variant: "destructive" });
    },
  });

  const toggleDepartmentExpanded = (id: string) => {
    setExpandedDepartments(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreateOrUpdate = () => {
    if (selectedDepartment) {
      updateDepartmentMutation.mutate({
        id: selectedDepartment.id,
        data: newDepartment,
      });
    } else {
      createDepartmentMutation.mutate(newDepartment);
    }
  };

  const openEditDialog = (dept: Department) => {
    setSelectedDepartment(dept);
    setNewDepartment({
      name: dept.name,
      description: dept.description || "",
      icon: dept.icon,
      color: dept.color,
    });
    setShowCreateDialog(true);
  };

  const departments = statsData?.departments || [];
  const ivrConfigurations = statsData?.ivrConfigurations || [];
  const activeIvr = ivrConfigurations.find(ivr => ivr.isActive);
  const activePhoneNumber = phoneNumbers?.find(p => p.id === activeIvr?.phoneNumberId);
  
  const assignedPhoneIds = useMemo(() => {
    return new Set(ivrConfigurations.map(ivr => ivr.phoneNumberId).filter(Boolean));
  }, [ivrConfigurations]);
  
  const unassignedPhones = useMemo(() => {
    return (phoneNumbers || []).filter(p => !assignedPhoneIds.has(p.id));
  }, [phoneNumbers, assignedPhoneIds]);

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center py-16" data-testid="loading-spinner">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="department-management-page">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="page-title">Department Management</h1>
          <p className="text-muted-foreground">
            Organize your AI call center by departments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="destructive" 
            onClick={() => setShowDeleteAllDialog(true)}
            disabled={departments.length === 0}
            data-testid="button-delete-all"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete All
          </Button>
          <Button 
            variant="outline"
            onClick={() => setLocation("/app/departments/canvas")}
            data-testid="button-open-canvas"
          >
            <LayoutGrid className="h-4 w-4 mr-2" />
            Design Canvas
          </Button>
          <Button 
            onClick={() => {
              setSelectedDepartment(null);
              setNewDepartment({ name: "", description: "", icon: "building-2", color: "#3b82f6" });
              setShowCreateDialog(true);
            }}
            data-testid="button-setup-new"
          >
            <Plus className="h-4 w-4 mr-2" />
            Setup New Call Center
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "org-map" | "departments")}>
        <TabsList data-testid="tabs-list">
          <TabsTrigger value="org-map" data-testid="tab-org-map">
            <Network className="h-4 w-4 mr-2" />
            Org Map
          </TabsTrigger>
          <TabsTrigger value="departments" data-testid="tab-departments">
            <LayoutGrid className="h-4 w-4 mr-2" />
            Departments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="org-map" className="space-y-6 mt-6">
          <Card data-testid="call-center-org-card">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                <div>
                  <CardTitle className="text-lg">Call Center Organization</CardTitle>
                  <p className="text-sm text-muted-foreground">Visual map showing how calls flow through your departments</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowIvrSettingsDialog(true)}
                data-testid="button-settings"
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center gap-4 py-4">
                {activePhoneNumber && (
                  <>
                    <div className="bg-emerald-500 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {activePhoneNumber.phoneNumber}
                    </div>
                    <div className="w-px h-8 bg-border" />
                    <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                      <PhoneIncoming className="h-3 w-3 mr-1" />
                      Incoming Calls
                    </Badge>
                    <div className="w-px h-8 bg-border" />
                  </>
                )}
                
                <Card 
                  className="w-64 border-dashed border-orange-300 cursor-pointer hover-elevate transition-all"
                  onClick={() => setShowIvrSettingsDialog(true)}
                  data-testid="unassigned-numbers-panel"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-orange-500" />
                        <CardTitle className="text-sm">Unassigned</CardTitle>
                      </div>
                      <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                        {unassignedPhones.length}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1 pt-0">
                    {unassignedPhones.length > 0 ? (
                      <>
                        {unassignedPhones.slice(0, 3).map((phone) => (
                          <div 
                            key={phone.id} 
                            className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 transition-colors"
                            data-testid={`phone-item-${phone.id}`}
                          >
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs font-mono truncate">{phone.phoneNumber}</span>
                          </div>
                        ))}
                        {unassignedPhones.length > 3 && (
                          <p className="text-xs text-muted-foreground text-center pt-1">
                            +{unassignedPhones.length - 3} more
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">All numbers assigned</p>
                    )}
                    <p className="text-xs text-blue-500 text-center pt-2">Click to assign</p>
                  </CardContent>
                </Card>
                
                <div className="h-6 w-px bg-border" />
                
                <Card className="w-64" data-testid="ivr-panel">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4" />
                        <CardTitle className="text-sm">Auto Distribution</CardTitle>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {ivrConfigurations.filter(i => i.isActive).length} Active
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    {activePhoneNumber && (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{activePhoneNumber.phoneNumber}</span>
                        <Badge className="bg-green-500 text-xs">On</Badge>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {departments.slice(0, 2).map((dept, idx) => (
                        <Badge 
                          key={dept.id} 
                          variant="outline" 
                          className="text-xs"
                          style={{ borderColor: dept.color }}
                          data-testid={`dept-badge-${dept.id}`}
                        >
                          {dept.name}
                        </Badge>
                      ))}
                      {departments.length > 2 && (
                        <Badge variant="outline" className="text-xs">+{departments.length - 2}</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="text-center text-sm text-muted-foreground">
                <Building2 className="h-4 w-4 inline mr-1" />
                Departments & AI Agents
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {departments.map((dept, idx) => (
                  <DepartmentCard
                    key={dept.id}
                    department={dept}
                    index={idx + 1}
                    isExpanded={expandedDepartments.has(dept.id)}
                    onToggleExpand={() => toggleDepartmentExpanded(dept.id)}
                    onEdit={() => openEditDialog(dept)}
                    onDelete={() => {
                      setSelectedDepartment(dept);
                      setShowDeleteDialog(true);
                    }}
                    onFlow={() => setLocation(`/app/flows/${dept.id}`)}
                    onAddAgent={() => {
                      setSelectedDepartment(dept);
                      setShowAddAgentDialog(true);
                    }}
                  />
                ))}
                
                <Card 
                  className="border-dashed hover-elevate cursor-pointer min-h-[200px] flex flex-col items-center justify-center"
                  onClick={() => {
                    setSelectedDepartment(null);
                    setNewDepartment({ name: "", description: "", icon: "building-2", color: "#3b82f6" });
                    setShowCreateDialog(true);
                  }}
                  data-testid="add-department-card"
                >
                  <Plus className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-muted-foreground">Add Department</span>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="departments" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((dept, idx) => (
              <DepartmentCard
                key={dept.id}
                department={dept}
                index={idx + 1}
                isExpanded={expandedDepartments.has(dept.id)}
                onToggleExpand={() => toggleDepartmentExpanded(dept.id)}
                onEdit={() => openEditDialog(dept)}
                onDelete={() => {
                  setSelectedDepartment(dept);
                  setShowDeleteDialog(true);
                }}
                onFlow={() => setLocation(`/app/flows/${dept.id}`)}
                onAddAgent={() => {
                  setSelectedDepartment(dept);
                  setShowAddAgentDialog(true);
                }}
              />
            ))}
            
            <Card 
              className="border-dashed hover-elevate cursor-pointer min-h-[200px] flex flex-col items-center justify-center"
              onClick={() => {
                setSelectedDepartment(null);
                setNewDepartment({ name: "", description: "", icon: "building-2", color: "#3b82f6" });
                setShowCreateDialog(true);
              }}
              data-testid="add-department-card-tab"
            >
              <Plus className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-muted-foreground">Add Department</span>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent data-testid="dialog-create-department">
          <DialogHeader>
            <DialogTitle>
              {selectedDepartment ? "Edit Department" : "Create New Department"}
            </DialogTitle>
            <DialogDescription>
              {selectedDepartment 
                ? "Update your department settings" 
                : "Add a new department to your AI call center"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Department Name</Label>
              <Input
                id="name"
                value={newDepartment.name}
                onChange={(e) => setNewDepartment({ ...newDepartment, name: e.target.value })}
                placeholder="e.g., Sales, Support, Scheduling"
                data-testid="input-department-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newDepartment.description}
                onChange={(e) => setNewDepartment({ ...newDepartment, description: e.target.value })}
                placeholder="What does this department handle?"
                data-testid="input-department-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Icon</Label>
                <Select 
                  value={newDepartment.icon} 
                  onValueChange={(v) => setNewDepartment({ ...newDepartment, icon: v })}
                >
                  <SelectTrigger data-testid="select-icon">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentIcons.map((icon) => (
                      <SelectItem key={icon.value} value={icon.value}>
                        <div className="flex items-center gap-2">
                          <icon.icon className="h-4 w-4" />
                          {icon.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <Select 
                  value={newDepartment.color} 
                  onValueChange={(v) => setNewDepartment({ ...newDepartment, color: v })}
                >
                  <SelectTrigger data-testid="select-color">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentColors.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{ backgroundColor: color.value }}
                          />
                          {color.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button 
              onClick={handleCreateOrUpdate}
              disabled={!newDepartment.name || createDepartmentMutation.isPending || updateDepartmentMutation.isPending}
              data-testid="button-save"
            >
              {(createDepartmentMutation.isPending || updateDepartmentMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {selectedDepartment ? "Save Changes" : "Create Department"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddAgentDialog} onOpenChange={setShowAddAgentDialog}>
        <DialogContent data-testid="dialog-add-agent">
          <DialogHeader>
            <DialogTitle>Add Agent to {selectedDepartment?.name}</DialogTitle>
            <DialogDescription>
              Assign an AI agent to handle calls for this department
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Agent</Label>
              <Select 
                value={selectedAgent.agentId} 
                onValueChange={(v) => setSelectedAgent({ ...selectedAgent, agentId: v })}
              >
                <SelectTrigger data-testid="select-agent">
                  <SelectValue placeholder="Choose an agent..." />
                </SelectTrigger>
                <SelectContent>
                  {agents?.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Language</Label>
              <Select 
                value={selectedAgent.language} 
                onValueChange={(v) => setSelectedAgent({ ...selectedAgent, language: v })}
              >
                <SelectTrigger data-testid="select-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAgentDialog(false)} data-testid="button-cancel-agent">
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedDepartment && selectedAgent.agentId) {
                  addAgentMutation.mutate({
                    departmentId: selectedDepartment.id,
                    agentId: selectedAgent.agentId,
                    language: selectedAgent.language,
                  });
                }
              }}
              disabled={!selectedAgent.agentId || addAgentMutation.isPending}
              data-testid="button-add-agent"
            >
              {addAgentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid="dialog-delete-department">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Department</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedDepartment?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedDepartment && deleteDepartmentMutation.mutate(selectedDepartment.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteDepartmentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <AlertDialogContent data-testid="dialog-delete-all">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Departments</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all {departments.length} departments and their IVR configurations. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-all">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAllDepartmentsMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-all"
            >
              {deleteAllDepartmentsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showIvrSettingsDialog} onOpenChange={setShowIvrSettingsDialog}>
        <DialogContent className="max-w-2xl" data-testid="dialog-ivr-settings">
          <DialogHeader>
            <DialogTitle>IVR Settings</DialogTitle>
            <DialogDescription>
              Configure Auto Distribution for incoming calls
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground text-center py-8">
              IVR configuration settings coming soon. Configure your phone number routing, greeting messages, and department menu options.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface DepartmentCardProps {
  department: Department;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onFlow: () => void;
  onAddAgent: () => void;
}

function DepartmentCard({
  department,
  index,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onFlow,
  onAddAgent,
}: DepartmentCardProps) {
  const IconComponent = departmentIcons.find(i => i.value === department.icon)?.icon || Building2;

  return (
    <Card 
      className="relative overflow-visible"
      style={{ borderTopColor: department.color, borderTopWidth: '3px' }}
      data-testid={`department-card-${department.id}`}
    >
      <Badge 
        className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center p-0 text-xs"
        style={{ backgroundColor: department.color }}
        data-testid={`dept-index-${department.id}`}
      >
        #{index}
      </Badge>
      
      <CardHeader className="pb-2 gap-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center" 
              style={{ backgroundColor: `${department.color}20` }}
            >
              <IconComponent className="h-4 w-4" style={{ color: department.color }} />
            </div>
            <div>
              <CardTitle className="text-base">{department.name}</CardTitle>
              {department.description && (
                <p className="text-xs text-muted-foreground line-clamp-1">{department.description}</p>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs" data-testid={`badge-ivr-active-${department.id}`}>
            <Power className="h-3 w-3 mr-1" />
            IVR {department.isActive ? "Active" : "Inactive"}
          </Badge>
          <Badge variant="outline" className="text-xs" data-testid={`badge-ai-voice-${department.id}`}>
            <Mic className="h-3 w-3 mr-1" />
            AI Voice
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onFlow} className="flex-1" data-testid={`button-flow-${department.id}`}>
            <GitBranch className="h-4 w-4 mr-1" />
            Flow
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit} className="flex-1" data-testid={`button-edit-${department.id}`}>
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive" data-testid={`button-delete-${department.id}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        
        <div 
          className="flex items-center gap-1 cursor-pointer hover-elevate rounded p-1 -mx-1" 
          onClick={onToggleExpand}
          data-testid={`toggle-expand-${department.id}`}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm text-muted-foreground">
            {department.agentCount || 0} Agents • {(department.languages || []).length || 1} Languages
          </span>
        </div>
        
        {isExpanded && (
          <div className="space-y-2 pt-2 border-t" data-testid={`agent-list-${department.id}`}>
            {(department.languages || ["en"]).map((lang) => (
              <div key={lang} className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="capitalize">{languages.find(l => l.value === lang)?.label || lang}</span>
                <span className="text-muted-foreground">- AI Agent</span>
              </div>
            ))}
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-start text-primary" 
              onClick={onAddAgent}
              data-testid={`button-add-agent-${department.id}`}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Agent
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
