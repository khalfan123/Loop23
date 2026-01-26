import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  Handle,
  Position,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Phone,
  Building2,
  Headphones,
  ShoppingCart,
  Calendar,
  Settings,
  Plus,
  ZoomIn,
  ZoomOut,
  Save,
  Trash2,
  Loader2,
  GitBranch,
  Mic,
  Globe,
  Check,
  Volume2,
  Square,
} from "lucide-react";

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  friendlyName: string | null;
  provider: string;
}

interface Agent {
  id: string;
  name: string;
  type: string;
  language: string | null;
  voiceName: string | null;
  openaiVoice: string | null;
}

const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
];

const OPENAI_VOICE_PREVIEWS: Record<string, string> = {
  alloy: "https://cdn.openai.com/API/docs/audio/alloy.wav",
  echo: "https://cdn.openai.com/API/docs/audio/echo.wav",
  shimmer: "https://cdn.openai.com/API/docs/audio/shimmer.wav",
  ash: "https://cdn.openai.com/API/docs/audio/ash.wav",
  ballad: "https://cdn.openai.com/API/docs/audio/ballad.wav",
  coral: "https://cdn.openai.com/API/docs/audio/coral.wav",
  sage: "https://cdn.openai.com/API/docs/audio/sage.wav",
  verse: "https://cdn.openai.com/API/docs/audio/verse.wav",
};

interface CanvasPhoneNode {
  id: string;
  phoneNumber: PhoneNumber;
}

interface CanvasDepartment {
  id: string;
  type: "sales" | "support" | "scheduling" | "custom";
  name: string;
  description: string;
  agentId?: string;
  agentName?: string;
  voiceProvider?: string;
  voiceName?: string;
  language?: string;
  systemPrompt?: string;
  enableTransfer?: boolean;
  enableRecording?: boolean;
  enableLanguageDetection?: boolean;
  knowledgeBaseIds?: string[];
}

const departmentTemplates = [
  {
    type: "sales" as const,
    name: "Sales",
    description: "Handle sales calls and demos",
    icon: ShoppingCart,
    color: "bg-green-500",
    defaultPrompt: "You are a professional sales representative. Help qualify leads, answer product questions, and schedule demos when appropriate.",
  },
  {
    type: "support" as const,
    name: "Support",
    description: "Customer support and issues",
    icon: Headphones,
    color: "bg-blue-500",
    defaultPrompt: "You are a helpful customer support agent. Assist customers with their issues, answer FAQs, and escalate complex problems when needed.",
  },
  {
    type: "scheduling" as const,
    name: "Scheduling",
    description: "Book appointments",
    icon: Calendar,
    color: "bg-purple-500",
    defaultPrompt: "You are an appointment scheduling assistant. Help callers book, reschedule, or cancel appointments efficiently.",
  },
];

interface DepartmentConfigPanelProps {
  selectedNode: Node;
  agents: Agent[];
  updateDepartmentConfig: (nodeId: string, config: Partial<CanvasDepartment>) => void;
  deleteNode: (nodeId: string) => void;
}

function DepartmentConfigPanel({ selectedNode, agents, updateDepartmentConfig, deleteNode }: DepartmentConfigPanelProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const nodeData = selectedNode.data as unknown as CanvasDepartment;
  const selectedLanguage = nodeData.language || "en";
  
  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      const agentLang = (agent.language || "en").toLowerCase();
      const targetLang = selectedLanguage.toLowerCase();
      return agentLang === targetLang;
    });
  }, [agents, selectedLanguage]);
  
  const selectedAgent = useMemo(() => {
    return agents.find((a) => a.id === nodeData.agentId);
  }, [agents, nodeData.agentId]);
  
  const voicePreviewUrl = useMemo(() => {
    if (!selectedAgent?.openaiVoice) return null;
    return OPENAI_VOICE_PREVIEWS[selectedAgent.openaiVoice] || null;
  }, [selectedAgent]);
  
  const handlePlayVoice = () => {
    if (!voicePreviewUrl) return;
    
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      return;
    }
    
    if (audioRef.current) {
      audioRef.current.src = voicePreviewUrl;
      audioRef.current.play();
      setIsPlaying(true);
      
      audioRef.current.onended = () => setIsPlaying(false);
      audioRef.current.onerror = () => setIsPlaying(false);
    }
  };
  
  useEffect(() => {
    audioRef.current = new Audio();
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);
  
  return (
    <div className="mt-6 space-y-4">
      <div>
        <Label>Department Name</Label>
        <Input
          value={nodeData.name || ""}
          onChange={(e) => updateDepartmentConfig(selectedNode.id, { name: e.target.value })}
          className="mt-1.5"
          data-testid="input-dept-name"
        />
      </div>
      
      <div>
        <Label>Language</Label>
        <Select
          value={selectedLanguage}
          onValueChange={(val) => {
            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
              setIsPlaying(false);
            }
            updateDepartmentConfig(selectedNode.id, { 
              language: val,
              agentId: undefined,
              agentName: undefined,
              voiceName: undefined,
              voiceProvider: undefined,
            });
          }}
        >
          <SelectTrigger className="mt-1.5" data-testid="select-dept-language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <SelectItem key={lang.code} value={lang.code}>
                {lang.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label>Assign AI Agent</Label>
        {filteredAgents.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-1.5">
            No agents available for {SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage)?.label}
          </p>
        ) : (
          <Select
            value={nodeData.agentId || ""}
            onValueChange={(val) => {
              const agent = agents.find((a) => a.id === val);
              updateDepartmentConfig(selectedNode.id, {
                agentId: val,
                agentName: agent?.name,
                voiceName: agent?.openaiVoice || agent?.voiceName || undefined,
              });
            }}
          >
            <SelectTrigger className="mt-1.5" data-testid="select-dept-agent">
              <SelectValue placeholder="Select an agent..." />
            </SelectTrigger>
            <SelectContent>
              {filteredAgents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      
      {selectedAgent && (
        <div className="p-3 bg-muted/50 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs text-muted-foreground">Agent Voice</Label>
              <p className="text-sm font-medium capitalize">
                {selectedAgent.openaiVoice || selectedAgent.voiceName || "Default"}
              </p>
            </div>
            {voicePreviewUrl && (
              <Button
                size="icon"
                variant="outline"
                onClick={handlePlayVoice}
                data-testid="button-voice-preview"
              >
                {isPlaying ? (
                  <Square className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      )}
      
      <div>
        <Label>System Prompt</Label>
        <Textarea
          value={nodeData.systemPrompt || ""}
          onChange={(e) => updateDepartmentConfig(selectedNode.id, { systemPrompt: e.target.value })}
          rows={5}
          className="mt-1.5"
          placeholder="Instructions for the AI agent..."
          data-testid="input-dept-prompt"
        />
      </div>
      
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <Label>Call Transfer</Label>
            <p className="text-xs text-muted-foreground">Allow transfer to human</p>
          </div>
          <Switch
            checked={nodeData.enableTransfer}
            onCheckedChange={(val) => updateDepartmentConfig(selectedNode.id, { enableTransfer: val })}
            data-testid="switch-dept-transfer"
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label>Call Recording</Label>
            <p className="text-xs text-muted-foreground">Record all calls</p>
          </div>
          <Switch
            checked={nodeData.enableRecording}
            onCheckedChange={(val) => updateDepartmentConfig(selectedNode.id, { enableRecording: val })}
            data-testid="switch-dept-recording"
          />
        </div>
      </div>
      
      <div className="pt-4">
        <Button
          variant="destructive"
          size="sm"
          onClick={() => deleteNode(selectedNode.id)}
          data-testid="button-delete-dept"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Remove Department
        </Button>
      </div>
    </div>
  );
}

const PhoneNodeComponent = ({ data }: { data: any }) => {
  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-green-400 rounded-lg p-3 min-w-[160px] shadow-md">
      <Handle type="source" position={Position.Right} className="!bg-green-500 !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
          <Phone className="h-4 w-4 text-green-600" />
        </div>
        <div>
          <div className="font-medium text-sm">{data.phoneNumber}</div>
          <div className="text-xs text-muted-foreground">{data.provider}</div>
        </div>
      </div>
    </div>
  );
};

const IVRNodeComponent = ({ data, selected }: { data: any; selected: boolean }) => {
  return (
    <div className={`bg-amber-50 dark:bg-amber-900/20 border-2 ${selected ? 'border-amber-600' : 'border-amber-400'} rounded-xl p-4 min-w-[180px] shadow-lg`}>
      <Handle type="target" position={Position.Left} className="!bg-amber-500 !w-3 !h-3" />
      <Handle type="source" position={Position.Right} className="!bg-amber-500 !w-3 !h-3" />
      <div className="flex items-center gap-3">
        <div className="p-2 bg-amber-200 dark:bg-amber-800 rounded-lg">
          <GitBranch className="h-5 w-5 text-amber-700 dark:text-amber-300" />
        </div>
        <div>
          <div className="font-semibold">IVR Router</div>
          <Badge variant="outline" className="mt-1 text-xs bg-green-100 text-green-700 border-green-300">
            Active
          </Badge>
        </div>
      </div>
      <div className="mt-3 text-xs text-muted-foreground">
        {data.inputCount || 0} inputs
      </div>
    </div>
  );
};

const DepartmentNodeComponent = ({ data, selected }: { data: any; selected: boolean }) => {
  const icons: Record<string, any> = {
    sales: ShoppingCart,
    support: Headphones,
    scheduling: Calendar,
    custom: Building2,
  };
  const colors: Record<string, string> = {
    sales: "bg-green-100 dark:bg-green-900/30 text-green-600 border-green-400",
    support: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 border-blue-400",
    scheduling: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 border-purple-400",
    custom: "bg-gray-100 dark:bg-gray-800 text-gray-600 border-gray-400",
  };
  const Icon = icons[data.type] || Building2;
  const colorClass = colors[data.type] || colors.custom;

  return (
    <div className={`bg-white dark:bg-gray-800 border-2 ${selected ? 'border-primary' : colorClass.split(' ').pop()} rounded-lg p-3 min-w-[180px] shadow-md`}>
      <Handle type="target" position={Position.Left} className="!bg-primary !w-3 !h-3" />
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClass.split(' ').slice(0, 2).join(' ')}`}>
          <Icon className={`h-4 w-4 ${colorClass.split(' ')[2]}`} />
        </div>
        <div className="flex-1">
          <div className="font-medium text-sm">{data.name}</div>
          <div className="text-xs text-muted-foreground truncate max-w-[120px]">
            {data.description}
          </div>
        </div>
      </div>
      {data.agentName && (
        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Mic className="h-3 w-3" />
          <span className="truncate">{data.agentName}</span>
        </div>
      )}
      {data.dialKey && (
        <Badge variant="secondary" className="mt-2 text-xs">
          Press {data.dialKey}
        </Badge>
      )}
    </div>
  );
};

const nodeTypes: NodeTypes = {
  phone: PhoneNodeComponent,
  ivr: IVRNodeComponent,
  department: DepartmentNodeComponent,
};

function DepartmentCanvasContent() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [configPanelOpen, setConfigPanelOpen] = useState(false);
  const [customDeptName, setCustomDeptName] = useState("");
  const [ivrGreeting, setIvrGreeting] = useState("Thank you for calling. Please listen to the following options.");
  const [ivrLanguage, setIvrLanguage] = useState("en");
  const [saving, setSaving] = useState(false);

  const [canvasPhones, setCanvasPhones] = useState<string[]>([]);
  const [canvasDepartments, setCanvasDepartments] = useState<CanvasDepartment[]>([]);

  const { data: phoneNumbers = [] } = useQuery<PhoneNumber[]>({
    queryKey: ["/api/phone-numbers"],
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const { data: knowledgeBases = [] } = useQuery<any[]>({
    queryKey: ["/api/knowledge-base"],
  });

  const availablePhones = useMemo(() => {
    return phoneNumbers.filter((p) => !canvasPhones.includes(p.id));
  }, [phoneNumbers, canvasPhones]);

  useEffect(() => {
    const ivrNode: Node = {
      id: "ivr-main",
      type: "ivr",
      position: { x: 400, y: 250 },
      data: { inputCount: 0 },
    };
    setNodes([ivrNode]);
  }, []);

  const phoneNodeCount = useMemo(() => {
    return nodes.filter((n) => n.type === "phone").length;
  }, [nodes]);

  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === "ivr-main" && (node.data as any).inputCount !== phoneNodeCount) {
          return { ...node, data: { ...node.data, inputCount: phoneNodeCount } };
        }
        return node;
      })
    );
  }, [phoneNodeCount, setNodes]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "smoothstep",
            animated: true,
            style: { stroke: "#f59e0b", strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#f59e0b" },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const onNodeClick = useCallback((_: any, node: Node) => {
    if (node.type === "ivr" || node.type === "department") {
      setSelectedNode(node);
      setConfigPanelOpen(true);
    }
  }, []);

  const addPhoneToCanvas = (phone: PhoneNumber) => {
    const phoneCount = nodes.filter((n) => n.type === "phone").length;
    const newNode: Node = {
      id: `phone-${phone.id}`,
      type: "phone",
      position: { x: 100, y: 150 + phoneCount * 100 },
      data: {
        phoneNumber: phone.phoneNumber,
        friendlyName: phone.friendlyName,
        provider: phone.provider,
        phoneId: phone.id,
      },
    };

    const newEdge: Edge = {
      id: `edge-phone-${phone.id}-ivr`,
      source: `phone-${phone.id}`,
      target: "ivr-main",
      type: "smoothstep",
      animated: true,
      style: { stroke: "#22c55e", strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#22c55e" },
    };

    setNodes((nds) => [...nds, newNode]);
    setEdges((eds) => [...eds, newEdge]);
    setCanvasPhones((prev) => [...prev, phone.id]);
  };

  const addDepartmentToCanvas = (template: typeof departmentTemplates[0] | { type: "custom"; name: string }) => {
    const deptCount = nodes.filter((n) => n.type === "department").length;
    const dialKey = String(deptCount + 1);

    const newDept: CanvasDepartment = {
      id: `dept-${Date.now()}`,
      type: template.type,
      name: template.name,
      description: template.type === "custom" ? "Custom department" : (template as any).description || "",
      systemPrompt: template.type !== "custom" ? (template as any).defaultPrompt : "",
      language: "en",
      enableTransfer: true,
      enableRecording: false,
      enableLanguageDetection: false,
    };

    const newNode: Node = {
      id: newDept.id,
      type: "department",
      position: { x: 650, y: 100 + deptCount * 130 },
      data: {
        ...newDept,
        dialKey,
      },
    };

    const newEdge: Edge = {
      id: `edge-ivr-${newDept.id}`,
      source: "ivr-main",
      target: newDept.id,
      type: "smoothstep",
      animated: true,
      style: { stroke: "#f59e0b", strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#f59e0b" },
      label: `Press ${dialKey}`,
      labelStyle: { fontSize: 10, fontWeight: 500 },
      labelBgStyle: { fill: "#fef3c7", fillOpacity: 0.9 },
    };

    setNodes((nds) => [...nds, newNode]);
    setEdges((eds) => [...eds, newEdge]);
    setCanvasDepartments((prev) => [...prev, newDept]);
  };

  const updateDepartmentConfig = (nodeId: string, updates: Partial<CanvasDepartment>) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, ...updates } };
        }
        return node;
      })
    );
    setCanvasDepartments((prev) =>
      prev.map((dept) => {
        if (dept.id === nodeId) {
          return { ...dept, ...updates };
        }
        return dept;
      })
    );
  };

  const deleteNode = (nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));

    if (nodeId.startsWith("phone-")) {
      const phoneId = nodeId.replace("phone-", "");
      setCanvasPhones((prev) => prev.filter((id) => id !== phoneId));
    } else if (nodeId.startsWith("dept-")) {
      setCanvasDepartments((prev) => prev.filter((d) => d.id !== nodeId));
    }

    setConfigPanelOpen(false);
    setSelectedNode(null);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const departmentNodes = nodes.filter((n) => n.type === "department");
      const phoneNodes = nodes.filter((n) => n.type === "phone");

      const canvasToDbIdMap = new Map<string, string>();

      for (const deptNode of departmentNodes) {
        const deptData = deptNode.data as unknown as CanvasDepartment & { dialKey: string };

        const deptResponse = await apiRequest("POST", "/api/departments", {
          name: deptData.name,
          description: deptData.description,
          icon: deptData.type,
          color: deptData.type === "sales" ? "#22c55e" : deptData.type === "support" ? "#3b82f6" : deptData.type === "scheduling" ? "#a855f7" : "#6b7280",
          isActive: true,
        });
        const deptResult = await deptResponse.json();

        canvasToDbIdMap.set(deptNode.id, deptResult.id);

        if (deptData.agentId) {
          await apiRequest("POST", `/api/departments/${deptResult.id}/agents`, {
            agentId: deptData.agentId,
            language: deptData.language || "en",
            isPrimary: true,
          });
        }
      }

      if (phoneNodes.length > 0 && departmentNodes.length > 0) {
        const menuOptions = departmentNodes.map((node, idx) => ({
          key: String(idx + 1),
          label: (node.data as any).name,
          departmentId: canvasToDbIdMap.get(node.id) || node.id,
        }));

        await apiRequest("POST", "/api/departments/ivr", {
          phoneNumberId: (phoneNodes[0].data as any).phoneId,
          name: "Auto Distribution",
          isActive: true,
          greetingMessage: ivrGreeting,
          menuOptions,
        });
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({
        title: "Canvas Saved",
        description: "All departments and routing have been created successfully.",
      });
      setLocation("/app/departments");
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save canvas configuration",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const deptCount = nodes.filter((n) => n.type === "department").length;
    if (deptCount === 0) {
      toast({
        title: "No Departments",
        description: "Please add at least one department to the canvas.",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate();
  };

  const phoneCount = nodes.filter((n) => n.type === "phone").length;
  const deptCount = nodes.filter((n) => n.type === "department").length;
  const connectionCount = edges.length;

  return (
    <div className="h-screen flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/app/departments")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="font-semibold">Department Canvas</h1>
            <p className="text-xs text-muted-foreground">Design your call flow visually</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => reactFlowInstance?.zoomOut()} data-testid="button-zoom-out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground min-w-[50px] text-center">
            {Math.round((reactFlowInstance?.getZoom() || 1) * 100)}%
          </span>
          <Button variant="outline" size="sm" onClick={() => reactFlowInstance?.zoomIn()} data-testid="button-zoom-in">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save">
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save & Deploy
          </Button>
        </div>
      </div>

      <div className="flex-1 flex">
        <div className="w-64 border-r bg-muted/30 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  <Phone className="h-3.5 w-3.5" />
                  Available Phone Numbers
                </div>
                {availablePhones.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No available numbers</p>
                ) : (
                  <div className="space-y-2">
                    {availablePhones.map((phone) => (
                      <Card
                        key={phone.id}
                        className="cursor-pointer hover-elevate"
                        onClick={() => addPhoneToCanvas(phone)}
                        data-testid={`card-phone-${phone.id}`}
                      >
                        <CardContent className="p-3 flex items-center gap-2">
                          <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded">
                            <Phone className="h-3.5 w-3.5 text-green-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{phone.phoneNumber}</div>
                            <div className="text-xs text-muted-foreground">{phone.provider}</div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2 text-muted-foreground"
                  onClick={() => setLocation("/app/phone-numbers")}
                  data-testid="button-buy-numbers"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Buy More Numbers
                </Button>
              </div>

              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  <Building2 className="h-3.5 w-3.5" />
                  Add Department
                </div>
                <div className="space-y-2">
                  {departmentTemplates.map((template) => (
                    <Card
                      key={template.type}
                      className="cursor-pointer hover-elevate"
                      onClick={() => addDepartmentToCanvas(template)}
                      data-testid={`card-dept-${template.type}`}
                    >
                      <CardContent className="p-3 flex items-center gap-2">
                        <div className={`p-1.5 rounded ${template.color} bg-opacity-20`}>
                          <template.icon className={`h-3.5 w-3.5 text-${template.color.replace('bg-', '').replace('-500', '-600')}`} />
                        </div>
                        <div>
                          <div className="font-medium text-sm">{template.name}</div>
                          <div className="text-xs text-muted-foreground">{template.description}</div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  <div className="pt-2">
                    <Input
                      placeholder="Custom department name..."
                      value={customDeptName}
                      onChange={(e) => setCustomDeptName(e.target.value)}
                      className="text-sm"
                      data-testid="input-custom-dept"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2 text-muted-foreground"
                      onClick={() => {
                        if (customDeptName.trim()) {
                          addDepartmentToCanvas({ type: "custom", name: customDeptName.trim() });
                          setCustomDeptName("");
                        }
                      }}
                      disabled={!customDeptName.trim()}
                      data-testid="button-add-custom"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add Custom
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Canvas Stats
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone Numbers</span>
                    <span className="font-medium">{phoneCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Departments</span>
                    <span className="font-medium">{deptCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Connections</span>
                    <span className="font-medium">{connectionCount}</span>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        <div ref={reactFlowWrapper} className="flex-1 bg-gray-50 dark:bg-gray-900">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onInit={setReactFlowInstance}
            nodeTypes={nodeTypes}
            fitView
            snapToGrid
            snapGrid={[15, 15]}
          >
            <Background gap={20} size={1} color="#e5e7eb" />
            <Controls showInteractive={false} />
            <MiniMap
              nodeStrokeColor={(n) => {
                if (n.type === "phone") return "#22c55e";
                if (n.type === "ivr") return "#f59e0b";
                return "#6b7280";
              }}
              nodeColor={(n) => {
                if (n.type === "phone") return "#dcfce7";
                if (n.type === "ivr") return "#fef3c7";
                return "#f3f4f6";
              }}
            />
          </ReactFlow>
        </div>
      </div>

      <Sheet open={configPanelOpen} onOpenChange={setConfigPanelOpen}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle>
              {selectedNode?.type === "ivr" ? "IVR Configuration" : "Department Configuration"}
            </SheetTitle>
          </SheetHeader>

          {selectedNode?.type === "ivr" && (
            <div className="mt-6 space-y-4">
              <div>
                <Label>Greeting Message</Label>
                <Textarea
                  value={ivrGreeting}
                  onChange={(e) => setIvrGreeting(e.target.value)}
                  placeholder="Thank you for calling..."
                  rows={3}
                  className="mt-1.5"
                  data-testid="input-ivr-greeting"
                />
              </div>
              <div>
                <Label>Language</Label>
                <Select value={ivrLanguage} onValueChange={setIvrLanguage}>
                  <SelectTrigger className="mt-1.5" data-testid="select-ivr-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                    <SelectItem value="pt">Portuguese</SelectItem>
                    <SelectItem value="it">Italian</SelectItem>
                    <SelectItem value="ja">Japanese</SelectItem>
                    <SelectItem value="zh">Chinese</SelectItem>
                    <SelectItem value="ko">Korean</SelectItem>
                    <SelectItem value="ar">Arabic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Multi-language Support</Label>
                  <p className="text-xs text-muted-foreground">Auto-detect caller language</p>
                </div>
                <Switch data-testid="switch-ivr-multilang" />
              </div>
            </div>
          )}

          {selectedNode?.type === "department" && (
            <DepartmentConfigPanel
              selectedNode={selectedNode}
              agents={agents}
              updateDepartmentConfig={updateDepartmentConfig}
              deleteNode={deleteNode}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function DepartmentCanvas() {
  return (
    <ReactFlowProvider>
      <DepartmentCanvasContent />
    </ReactFlowProvider>
  );
}
