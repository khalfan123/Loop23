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
  Panel,
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
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Phone,
  Bot,
  FileText,
  Database,
  Plus,
  ZoomIn,
  ZoomOut,
  Save,
  Trash2,
  Loader2,
  Mic,
  Globe,
  Sparkles,
  BookOpen,
  List,
} from "lucide-react";

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  friendlyName: string | null;
  provider: string;
  isConflicted?: boolean;
  conflictReason?: string | null;
}

interface ExistingConnection {
  id: string;
  agentId: string;
  phoneNumberId: string;
  agent?: { id: string; name: string } | null;
  phoneNumber?: { id: string; phoneNumber: string } | null;
}

interface Agent {
  id: string;
  name: string;
  type: string;
  language: string | null;
  voiceName: string | null;
  openaiVoice: string | null;
  systemPrompt: string | null;
  voiceTone: string | null;
}

interface PromptTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  systemPrompt: string;
  firstMessage: string | null;
  suggestedVoiceTone: string | null;
  isSystemTemplate: boolean;
}

interface KnowledgeBase {
  id: string;
  name: string;
  type: string;
  status: string;
}

interface CanvasStaffAI {
  id: string;
  agentId: string | null;
  agentName: string | null;
  customPrompt: string;
  templateId: string | null;
  templateName: string | null;
  knowledgeBaseIds: string[];
  language: string | null;
  voiceName: string | null;
}

const getLanguageLabel = (code: string) => {
  const labels: Record<string, string> = {
    en: "English",
    ar: "Arabic",
    fr: "French",
    hi: "Hindi",
    it: "Italian",
    zh: "Chinese",
    es: "Spanish",
    de: "German",
    pt: "Portuguese",
    ja: "Japanese",
    ko: "Korean",
    ru: "Russian",
    nl: "Dutch",
    tr: "Turkish",
    pl: "Polish",
    sv: "Swedish",
  };
  return labels[code] || code.toUpperCase();
};

const getCategoryColor = (category: string) => {
  const colors: Record<string, string> = {
    agent_preset: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    sales: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    support: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    appointment: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    survey: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    general: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
  };
  return colors[category] || colors.general;
};

const PhoneContainerNode = ({ data }: { data: any }) => {
  const phones = data.phones || [];
  const hasPhones = phones.length > 0;

  return (
    <div className={`border-2 border-dashed ${hasPhones ? "border-green-400 bg-green-50/50 dark:bg-green-900/10" : "border-red-400 bg-red-50/50 dark:bg-red-900/10"} rounded-lg p-2 min-w-[140px] shadow-sm`}>
      <Handle type="source" position={Position.Bottom} className="!bg-green-500 !w-2 !h-2" />
      <div className="flex items-center gap-1.5 mb-1.5">
        <Phone className={`h-3 w-3 ${hasPhones ? "text-green-600" : "text-red-500"}`} />
        <span className="font-semibold text-[10px]">Inbound Numbers</span>
      </div>
      {hasPhones ? (
        <div className="space-y-1">
          {phones.slice(0, 3).map((phone: any) => (
            <div key={phone.id} className="flex items-center gap-1 text-[9px] bg-white dark:bg-gray-800 rounded px-1.5 py-0.5">
              <Phone className="h-2.5 w-2.5 text-green-500" />
              <span className="truncate">{phone.phoneNumber}</span>
            </div>
          ))}
          {phones.length > 3 && (
            <div className="text-[8px] text-muted-foreground">+{phones.length - 3} more</div>
          )}
        </div>
      ) : (
        <div className="text-[9px] text-red-500 italic text-center py-1">
          No numbers assigned
        </div>
      )}
    </div>
  );
};

const StaffAINodeComponent = ({ data, selected }: { data: any; selected: boolean }) => {
  return (
    <div className={`bg-white dark:bg-gray-800 border ${selected ? "border-blue-600" : "border-blue-400"} rounded-lg p-2 min-w-[120px] max-w-[160px] shadow-sm`}>
      <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-2 !h-2" />
      <div className="flex items-center gap-1.5">
        <div className="p-1 bg-blue-100 dark:bg-blue-900/30 rounded">
          <Bot className="h-3 w-3 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[10px] truncate leading-tight">
            {data.agentName || "Staff AI"}
          </div>
          <div className="text-[8px] text-muted-foreground truncate">
            {data.agentId ? "Agent selected" : "Click to configure"}
          </div>
        </div>
      </div>
      {data.language && (
        <div className="mt-1 flex items-center gap-1">
          <Badge variant="outline" className="text-[7px] px-1 py-0 border-blue-300 text-blue-600">
            {data.language.toUpperCase()}
          </Badge>
        </div>
      )}
      {data.customPrompt && (
        <div className="mt-1 pt-1 border-t border-dashed">
          <div className="text-[8px] text-muted-foreground truncate">
            {data.customPrompt.slice(0, 50)}...
          </div>
        </div>
      )}
      {data.templateName && (
        <Badge variant="outline" className="mt-1 text-[7px] px-1 py-0 border-purple-300 text-purple-600">
          {data.templateName}
        </Badge>
      )}
    </div>
  );
};

const PromptTemplateNodeComponent = ({ data, selected }: { data: any; selected: boolean }) => {
  return (
    <div className={`bg-white dark:bg-gray-800 border ${selected ? "border-purple-600" : "border-purple-400"} rounded-lg p-2 min-w-[110px] max-w-[140px] shadow-sm`}>
      <Handle type="target" position={Position.Top} className="!bg-purple-500 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-purple-500 !w-2 !h-2" />
      <div className="flex items-center gap-1.5">
        <div className="p-1 bg-purple-100 dark:bg-purple-900/30 rounded">
          <FileText className="h-3 w-3 text-purple-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[10px] truncate leading-tight">
            {data.templateName || "Template"}
          </div>
          <div className="text-[8px] text-muted-foreground truncate">
            {data.category || "Prompt"}
          </div>
        </div>
      </div>
    </div>
  );
};

const KnowledgeBaseNodeComponent = ({ data, selected }: { data: any; selected: boolean }) => {
  return (
    <div className={`bg-white dark:bg-gray-800 border ${selected ? "border-amber-600" : "border-amber-400"} rounded-lg p-2 min-w-[110px] max-w-[140px] shadow-sm`}>
      <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-2 !h-2" />
      <div className="flex items-center gap-1.5">
        <div className="p-1 bg-amber-100 dark:bg-amber-900/30 rounded">
          <Database className="h-3 w-3 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[10px] truncate leading-tight">
            {data.kbName || "Knowledge Base"}
          </div>
          <div className="text-[8px] text-muted-foreground truncate">
            {data.kbType || "KB"}
          </div>
        </div>
      </div>
    </div>
  );
};

const nodeTypes: NodeTypes = {
  phoneContainer: PhoneContainerNode,
  staffAI: StaffAINodeComponent,
  promptTemplate: PromptTemplateNodeComponent,
  knowledgeBase: KnowledgeBaseNodeComponent,
};

function IncomingCallCanvasContent({ embedded = false }: { embedded?: boolean }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [configPanelOpen, setConfigPanelOpen] = useState(false);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  const [canvasPhones, setCanvasPhones] = useState<string[]>([]);
  const [staffAINodes, setStaffAINodes] = useState<CanvasStaffAI[]>([]);
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [useCaseFilter, setUseCaseFilter] = useState<string>("all");

  const { data: incomingData, isLoading: incomingLoading } = useQuery<{
    connections: ExistingConnection[];
    allConnections: ExistingConnection[];
    availablePhoneNumbers: (PhoneNumber & { isConflicted?: boolean; conflictReason?: string | null })[];
    incomingAgents: Agent[];
    stats: { totalConnections: number; elevenLabsConnections: number; availableNumbers: number; totalAgents: number };
  }>({
    queryKey: ["/api/incoming-connections"],
  });

  const existingConnections = incomingData?.connections || [];
  const phoneNumbers = incomingData?.availablePhoneNumbers || [];
  const agents = incomingData?.incomingAgents || [];
  const phonesLoading = incomingLoading;
  const agentsLoading = incomingLoading;

  const connectedPhones = useMemo(() => {
    return existingConnections.map(c => ({
      phoneNumberId: c.phoneNumberId,
      agentName: (c as any).agent?.name || "Unknown Agent",
    }));
  }, [existingConnections]);

  const { data: promptTemplates = [], isLoading: templatesLoading } = useQuery<PromptTemplate[]>({
    queryKey: ["/api/prompt-templates"],
  });

  const { data: knowledgeBases = [], isLoading: kbLoading } = useQuery<KnowledgeBase[]>({
    queryKey: ["/api/knowledge-base"],
  });

  const availableLanguages = useMemo(() => {
    const langs = new Set<string>();
    agents.forEach((a) => {
      if (a.language) langs.add(a.language);
    });
    return Array.from(langs).sort();
  }, [agents]);

  const filteredAgents = useMemo(() => {
    if (languageFilter === "all") return agents;
    return agents.filter((a) => a.language === languageFilter);
  }, [agents, languageFilter]);

  const useCaseCategories = useMemo(() => {
    const cats = new Set<string>();
    promptTemplates.forEach((t) => {
      if (t.category) cats.add(t.category);
    });
    return Array.from(cats).sort();
  }, [promptTemplates]);

  const filteredTemplates = useMemo(() => {
    if (useCaseFilter === "all") return promptTemplates;
    return promptTemplates.filter((t) => t.category === useCaseFilter);
  }, [promptTemplates, useCaseFilter]);

  const availablePhones = useMemo(() => {
    return phoneNumbers.filter((p) => !canvasPhones.includes(p.id) && !p.isConflicted);
  }, [phoneNumbers, canvasPhones]);

  const conflictedPhones = useMemo(() => {
    return phoneNumbers.filter((p) => p.isConflicted && !canvasPhones.includes(p.id));
  }, [phoneNumbers, canvasPhones]);

  useEffect(() => {
    const phoneContainerNode: Node = {
      id: "phone-container",
      type: "phoneContainer",
      position: { x: 250, y: 20 },
      data: { phones: [] },
      draggable: false,
    };

    setNodes([phoneContainerNode]);
    setEdges([]);
    setStaffAINodes([]);
  }, []);

  const assignedPhones = useMemo(() => {
    return phoneNumbers.filter((p) => canvasPhones.includes(p.id));
  }, [phoneNumbers, canvasPhones]);

  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === "phone-container") {
          return { ...node, data: { ...node.data, phones: assignedPhones } };
        }
        return node;
      })
    );
  }, [assignedPhones, setNodes]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "smoothstep",
            animated: true,
            style: { stroke: "#3b82f6", strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const onNodeClick = useCallback((_: any, node: Node) => {
    if (node.type === "phoneContainer" || node.type === "staffAI" || node.type === "promptTemplate" || node.type === "knowledgeBase") {
      setSelectedNodeId(node.id);
      setConfigPanelOpen(true);
    }
  }, []);

  const addPhoneToCanvas = (phone: PhoneNumber & { isConflicted?: boolean; conflictReason?: string | null }) => {
    if (phone.isConflicted) {
      toast({
        title: "Phone Unavailable",
        description: phone.conflictReason || `${phone.phoneNumber} is currently in use by another campaign.`,
        variant: "destructive",
      });
      return;
    }
    setCanvasPhones((prev) => [...prev, phone.id]);
    toast({
      title: "Phone Added",
      description: `${phone.phoneNumber} assigned to inbound numbers`,
    });
  };

  const removePhoneFromCanvas = (phoneId: string) => {
    setCanvasPhones((prev) => prev.filter((id) => id !== phoneId));
  };

  const addStaffAIToCanvas = (agent: Agent) => {
    const newId = `staff-ai-${Date.now()}`;
    const newStaffAI: CanvasStaffAI = {
      id: newId,
      agentId: agent.id,
      agentName: agent.name,
      customPrompt: agent.systemPrompt || "",
      templateId: null,
      templateName: null,
      knowledgeBaseIds: [],
      language: agent.language || null,
      voiceName: agent.openaiVoice || agent.voiceName || null,
    };

    setNodes((nds) => {
      const staffCount = nds.filter((n) => n.type === "staffAI").length;
      const xOffset = 50 + staffCount * 200;

      const newNode: Node = {
        id: newId,
        type: "staffAI",
        position: { x: xOffset, y: 180 },
        data: { ...newStaffAI },
      };

      return [...nds, newNode];
    });

    setEdges((eds) => {
      const newEdge: Edge = {
        id: `edge-container-${newId}`,
        source: "phone-container",
        target: newId,
        type: "smoothstep",
        animated: true,
        style: { stroke: "#22c55e", strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#22c55e" },
      };
      return [...eds, newEdge];
    });

    setStaffAINodes((prev) => [...prev, newStaffAI]);

    setTimeout(() => {
      if (reactFlowInstance) {
        reactFlowInstance.fitView({ padding: 0.3, duration: 300 });
      }
    }, 50);

    setSelectedNodeId(newId);
    setConfigPanelOpen(true);

    toast({
      title: "Agent Connected",
      description: `${agent.name} added to canvas. Configure it in the panel.`,
    });
  };

  const applyTemplateToStaffAI = (template: PromptTemplate) => {
    const staffAINodesList = nodes.filter((n) => n.type === "staffAI");
    if (staffAINodesList.length === 0) {
      toast({
        title: "No Agent on Canvas",
        description: "Click an agent from the list above to add it first, then apply a template.",
      });
      return;
    }

    const targetNode = selectedNode?.type === "staffAI" ? selectedNode : staffAINodesList[0];
    const targetId = targetNode.id;

    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === targetId) {
          return {
            ...node,
            data: {
              ...node.data,
              customPrompt: template.systemPrompt,
              templateId: template.id,
              templateName: template.name,
            },
          };
        }
        return node;
      })
    );

    setStaffAINodes((prev) =>
      prev.map((s) => {
        if (s.id === targetId) {
          return {
            ...s,
            customPrompt: template.systemPrompt,
            templateId: template.id,
            templateName: template.name,
          };
        }
        return s;
      })
    );

    const existingTemplateNode = nodes.find(
      (n) => n.type === "promptTemplate" && (n.data as any).connectedStaffId === targetId
    );

    if (!existingTemplateNode) {
      const templateNodeId = `template-${Date.now()}`;
      const targetNodeData = nodes.find((n) => n.id === targetId);
      const targetX = targetNodeData?.position.x || 200;
      const targetY = targetNodeData?.position.y || 180;

      setNodes((nds) => [
        ...nds,
        {
          id: templateNodeId,
          type: "promptTemplate",
          position: { x: targetX + 180, y: targetY },
          data: {
            templateId: template.id,
            templateName: template.name,
            category: template.category,
            description: template.description,
            systemPrompt: template.systemPrompt,
            connectedStaffId: targetId,
          },
        },
      ]);

      setEdges((eds) => [
        ...eds,
        {
          id: `edge-template-${templateNodeId}`,
          source: templateNodeId,
          target: targetId,
          type: "smoothstep",
          animated: true,
          style: { stroke: "#a855f7", strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: "#a855f7" },
        },
      ]);
    } else {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === existingTemplateNode.id) {
            return {
              ...node,
              data: {
                ...node.data,
                templateId: template.id,
                templateName: template.name,
                category: template.category,
                description: template.description,
                systemPrompt: template.systemPrompt,
              },
            };
          }
          return node;
        })
      );
    }

    toast({
      title: "Template Applied",
      description: `"${template.name}" prompt applied to ${(targetNode.data as any).agentName || "Staff AI"}`,
    });
  };

  const addKnowledgeBaseToStaffAI = (kb: KnowledgeBase) => {
    const staffAINodesList = nodes.filter((n) => n.type === "staffAI");
    if (staffAINodesList.length === 0) {
      toast({
        title: "No Agent on Canvas",
        description: "Click an agent from the list above to add it first, then attach knowledge bases.",
        variant: "destructive",
      });
      return;
    }

    const targetNode = selectedNode?.type === "staffAI" ? selectedNode : staffAINodesList[0];
    const targetId = targetNode.id;

    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === targetId) {
          const currentKBIds = (node.data as any).knowledgeBaseIds || [];
          if (currentKBIds.includes(kb.id)) return node;
          return {
            ...node,
            data: {
              ...node.data,
              knowledgeBaseIds: [...currentKBIds, kb.id],
            },
          };
        }
        return node;
      })
    );

    setStaffAINodes((prev) =>
      prev.map((s) => {
        if (s.id === targetId) {
          if (s.knowledgeBaseIds.includes(kb.id)) return s;
          return { ...s, knowledgeBaseIds: [...s.knowledgeBaseIds, kb.id] };
        }
        return s;
      })
    );

    const kbNodeId = `kb-${kb.id}-${Date.now()}`;
    const targetNodeData = nodes.find((n) => n.id === targetId);
    const targetX = targetNodeData?.position.x || 200;
    const targetY = targetNodeData?.position.y || 180;
    const existingKBCount = nodes.filter(
      (n) => n.type === "knowledgeBase" && edges.some((e) => e.source === n.id && e.target === targetId)
    ).length;

    setNodes((nds) => [
      ...nds,
      {
        id: kbNodeId,
        type: "knowledgeBase",
        position: { x: targetX - 160 - existingKBCount * 30, y: targetY + 40 },
        data: {
          kbId: kb.id,
          kbName: kb.name,
          kbType: kb.type,
          kbStatus: kb.status,
          connectedStaffId: targetId,
        },
      },
    ]);

    setEdges((eds) => [
      ...eds,
      {
        id: `edge-kb-${kbNodeId}`,
        source: kbNodeId,
        target: targetId,
        type: "smoothstep",
        animated: true,
        style: { stroke: "#f59e0b", strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#f59e0b" },
      },
    ]);

    setTimeout(() => {
      if (reactFlowInstance) {
        reactFlowInstance.fitView({ padding: 0.3, duration: 300 });
      }
    }, 50);

    toast({
      title: "Knowledge Base Attached",
      description: `"${kb.name}" attached to ${(targetNode.data as any).agentName || "Staff AI"}`,
    });
  };

  const updateStaffAIConfig = (nodeId: string, updates: Partial<CanvasStaffAI>) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, ...updates } };
        }
        return node;
      })
    );
    setStaffAINodes((prev) =>
      prev.map((s) => {
        if (s.id === nodeId) {
          return { ...s, ...updates };
        }
        return s;
      })
    );
  };

  const deleteNode = (nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));

    if (nodeId.startsWith("staff-ai-")) {
      setStaffAINodes((prev) => prev.filter((s) => s.id !== nodeId));
      const connectedNodes = nodes.filter(
        (n) =>
          (n.type === "promptTemplate" || n.type === "knowledgeBase") &&
          (n.data as any).connectedStaffId === nodeId
      );
      const connectedIds = connectedNodes.map((n) => n.id);
      setNodes((nds) => nds.filter((n) => !connectedIds.includes(n.id)));
      setEdges((eds) => eds.filter((e) => !connectedIds.includes(e.source) && !connectedIds.includes(e.target)));
    }

    setConfigPanelOpen(false);
    setSelectedNodeId(null);

    toast({
      title: "Node Removed",
      description: "Node has been removed from canvas",
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const staffNodes = nodes.filter((n) => n.type === "staffAI");
      const phonesToAssign = assignedPhones;

      if (staffNodes.length === 0) {
        throw new Error("No Staff AI agents on canvas");
      }
      if (phonesToAssign.length === 0) {
        throw new Error("No phone numbers assigned");
      }

      for (const staffNode of staffNodes) {
        const staffData = staffNode.data as any;
        if (!staffData.agentId) continue;

        const agentUpdates: Record<string, any> = {};
        if (staffData.customPrompt) {
          agentUpdates.systemPrompt = staffData.customPrompt;
        }
        if (staffData.knowledgeBaseIds && staffData.knowledgeBaseIds.length > 0) {
          agentUpdates.knowledgeBaseIds = staffData.knowledgeBaseIds;
        }
        if (Object.keys(agentUpdates).length > 0) {
          await apiRequest("PATCH", `/api/agents/${staffData.agentId}`, agentUpdates);
        }

        for (const phone of phonesToAssign) {
          await apiRequest("POST", "/api/incoming-connections", {
            agentId: staffData.agentId,
            phoneNumberId: phone.id,
          });
        }
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incoming-connections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/phone-numbers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({
        title: "Canvas Saved",
        description: "All incoming connections have been created successfully.",
      });
      if (!embedded) {
        setLocation("/app/incoming-connections/list");
      }
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
    const staffCount = nodes.filter((n) => n.type === "staffAI").length;
    const hasAgentSelected = nodes
      .filter((n) => n.type === "staffAI")
      .some((n) => (n.data as any).agentId);

    if (staffCount === 0) {
      toast({
        title: "No Staff AI",
        description: "Please add at least one Staff AI agent to the canvas.",
        variant: "destructive",
      });
      return;
    }
    if (!hasAgentSelected) {
      toast({
        title: "No Agent Selected",
        description: "Please select an agent for at least one Staff AI node.",
        variant: "destructive",
      });
      return;
    }
    if (assignedPhones.length === 0) {
      toast({
        title: "No Phone Numbers",
        description: "Please assign at least one phone number.",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate();
  };

  const phoneCount = assignedPhones.length;
  const staffCount = nodes.filter((n) => n.type === "staffAI").length;
  const connectionCount = edges.length;

  return (
    <div className={`${embedded ? "h-full" : "h-screen"} flex flex-col`}>
      {!embedded && (
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/app/incoming-connections/list")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="font-semibold">Incoming Call Canvas</h1>
            <p className="text-xs text-muted-foreground">Design your incoming call flow visually</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setLocation("/app/incoming-connections/list")} data-testid="button-list-view">
            <List className="h-4 w-4 mr-1" />
            List View
          </Button>
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
      )}

      {embedded && (
      <div className="flex items-center justify-between px-3 py-2 border-b bg-background">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => reactFlowInstance?.zoomOut()} data-testid="button-zoom-out-embedded">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground min-w-[50px] text-center">
            {Math.round((reactFlowInstance?.getZoom() || 1) * 100)}%
          </span>
          <Button variant="outline" size="sm" onClick={() => reactFlowInstance?.zoomIn()} data-testid="button-zoom-in-embedded">
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
        <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-embedded">
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save & Deploy
        </Button>
      </div>
      )}

      <div className="flex-1 flex">
        <div className="w-64 border-r bg-muted/30 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  <Phone className="h-3.5 w-3.5" />
                  Available Phone Numbers
                </div>
                {(phonesLoading || incomingLoading) ? (
                  <div className="space-y-2">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                  </div>
                ) : availablePhones.length === 0 && conflictedPhones.length === 0 ? (
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
                    {conflictedPhones.length > 0 && (
                      <>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-3 mb-1">Unavailable (Campaign Conflict)</div>
                        {conflictedPhones.map((phone) => (
                          <Card
                            key={phone.id}
                            className="opacity-50 cursor-not-allowed"
                            data-testid={`card-phone-conflict-${phone.id}`}
                          >
                            <CardContent className="p-3 flex items-center gap-2">
                              <div className="p-1.5 bg-red-100 dark:bg-red-900/30 rounded">
                                <Phone className="h-3.5 w-3.5 text-red-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">{phone.phoneNumber}</div>
                                <div className="text-[10px] text-red-500 truncate">
                                  {phone.conflictReason || "In use by active campaign"}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </>
                    )}
                    {connectedPhones.length > 0 && (
                      <>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-3 mb-1">Already Connected</div>
                        {connectedPhones.map((cp) => {
                          const conn = existingConnections.find(c => c.phoneNumberId === cp.phoneNumberId);
                          return (
                            <Card
                              key={cp.phoneNumberId}
                              className="opacity-50 cursor-not-allowed"
                              data-testid={`card-phone-connected-${cp.phoneNumberId}`}
                            >
                              <CardContent className="p-3 flex items-center gap-2">
                                <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded">
                                  <Phone className="h-3.5 w-3.5 text-amber-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm truncate">{(conn as any)?.phoneNumber?.phoneNumber || "Phone"}</div>
                                  <div className="text-[10px] text-amber-600 truncate">
                                    Connected to {cp.agentName}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </>
                    )}
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
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  <Bot className="h-3.5 w-3.5" />
                  Staff AI Agents
                </div>
                <Select value={languageFilter} onValueChange={setLanguageFilter}>
                  <SelectTrigger className="mb-3" data-testid="select-language-filter">
                    <div className="flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                      <SelectValue placeholder="Filter by language" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Languages</SelectItem>
                    {availableLanguages.map((lang) => (
                      <SelectItem key={lang} value={lang}>
                        {lang.toUpperCase()} - {getLanguageLabel(lang)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {agentsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                  </div>
                ) : filteredAgents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {languageFilter !== "all" ? `No agents for ${languageFilter.toUpperCase()}` : "No agents available"}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredAgents.slice(0, 8).map((agent) => (
                      <Card
                        key={agent.id}
                        className="cursor-pointer hover-elevate"
                        onClick={() => addStaffAIToCanvas(agent)}
                        data-testid={`card-agent-${agent.id}`}
                      >
                        <CardContent className="p-3 flex items-center gap-2">
                          <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded">
                            <Bot className="h-3.5 w-3.5 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{agent.name}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {agent.language && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0">
                                  {agent.language.toUpperCase()}
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">{agent.type}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {filteredAgents.length > 8 && (
                      <p className="text-xs text-muted-foreground text-center">+{filteredAgents.length - 8} more agents</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  <Sparkles className="h-3.5 w-3.5" />
                  Use Case / Prompt
                </div>
                <Select value={useCaseFilter} onValueChange={setUseCaseFilter}>
                  <SelectTrigger className="mb-3" data-testid="select-usecase-filter">
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <SelectValue placeholder="Filter by use case" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Use Cases</SelectItem>
                    {useCaseCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[9px] px-1 py-0 ${getCategoryColor(cat)}`}>
                            {cat}
                          </Badge>
                          <span className="capitalize">{cat.replace("_", " ")}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {templatesLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {useCaseFilter !== "all" ? `No templates for "${useCaseFilter}"` : "No templates available"}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredTemplates.slice(0, 6).map((template) => (
                      <Card
                        key={template.id}
                        className="cursor-pointer hover-elevate"
                        onClick={() => applyTemplateToStaffAI(template)}
                        data-testid={`card-template-${template.id}`}
                      >
                        <CardContent className="p-3 flex items-center gap-2">
                          <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded">
                            <FileText className="h-3.5 w-3.5 text-purple-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{template.name}</div>
                            <Badge variant="outline" className={`text-[10px] ${getCategoryColor(template.category)}`}>
                              {template.category.replace("_", " ")}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {filteredTemplates.length > 6 && (
                      <p className="text-xs text-muted-foreground text-center">+{filteredTemplates.length - 6} more templates</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  <Database className="h-3.5 w-3.5" />
                  Knowledge Base
                </div>
                {kbLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-14 w-full" />
                  </div>
                ) : knowledgeBases.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No knowledge bases available</p>
                ) : (
                  <div className="space-y-2">
                    {knowledgeBases.slice(0, 5).map((kb) => (
                      <Card
                        key={kb.id}
                        className="cursor-pointer hover-elevate"
                        onClick={() => addKnowledgeBaseToStaffAI(kb)}
                        data-testid={`card-kb-${kb.id}`}
                      >
                        <CardContent className="p-3 flex items-center gap-2">
                          <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded">
                            <Database className="h-3.5 w-3.5 text-amber-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{kb.name}</div>
                            <div className="text-xs text-muted-foreground">{kb.type} - {kb.status}</div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {knowledgeBases.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center">+{knowledgeBases.length - 5} more</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Canvas Stats
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone Numbers</span>
                    <span className="font-medium" data-testid="stat-phones">{phoneCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Staff AI Agents</span>
                    <span className="font-medium" data-testid="stat-agents">{staffCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Connections</span>
                    <span className="font-medium" data-testid="stat-connections">{connectionCount}</span>
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
            {staffAINodes.length === 0 && (
              <Panel position="top-center">
                <div className="mt-24 text-center p-6 rounded-lg bg-background/80 backdrop-blur-sm border max-w-xs">
                  <Bot className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium">No agents on canvas</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click an agent from the sidebar to connect it to your phone numbers
                  </p>
                </div>
              </Panel>
            )}
            <Controls showInteractive={false} />
            <MiniMap
              nodeStrokeColor={(n) => {
                if (n.type === "phoneContainer") return "#22c55e";
                if (n.type === "staffAI") return "#3b82f6";
                if (n.type === "promptTemplate") return "#a855f7";
                if (n.type === "knowledgeBase") return "#f59e0b";
                return "#6b7280";
              }}
              nodeColor={(n) => {
                if (n.type === "phoneContainer") return "#dcfce7";
                if (n.type === "staffAI") return "#dbeafe";
                if (n.type === "promptTemplate") return "#f3e8ff";
                if (n.type === "knowledgeBase") return "#fef3c7";
                return "#f3f4f6";
              }}
            />
          </ReactFlow>
        </div>
      </div>

      <Sheet open={configPanelOpen} onOpenChange={setConfigPanelOpen}>
        <SheetContent className="w-[400px] sm:w-[540px] flex flex-col p-0">
          <SheetHeader className="px-6 pt-6 pb-2">
            <SheetTitle>
              {selectedNode?.type === "phoneContainer" && "Inbound Phone Numbers"}
              {selectedNode?.type === "staffAI" && "Staff AI Configuration"}
              {selectedNode?.type === "promptTemplate" && "Prompt Template"}
              {selectedNode?.type === "knowledgeBase" && "Knowledge Base"}
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="flex-1 px-6 pb-6">
            {selectedNode?.type === "phoneContainer" && (
              <div className="mt-4 space-y-4">
                <div className={`p-4 rounded-lg border-2 border-dashed ${assignedPhones.length > 0 ? "border-green-300 bg-green-50/50 dark:bg-green-900/10" : "border-red-300 bg-red-50/50 dark:bg-red-900/10"}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Phone className={`h-5 w-5 ${assignedPhones.length > 0 ? "text-green-600" : "text-red-500"}`} />
                    <span className="font-medium">
                      {assignedPhones.length > 0 ? `${assignedPhones.length} number(s) assigned` : "No numbers assigned"}
                    </span>
                  </div>

                  {assignedPhones.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {assignedPhones.map((phone) => (
                        <div key={phone.id} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-2 border">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-green-600" />
                            <div>
                              <div className="font-medium text-sm">{phone.phoneNumber}</div>
                              {phone.friendlyName && (
                                <div className="text-xs text-muted-foreground">{phone.friendlyName}</div>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removePhoneFromCanvas(phone.id)}
                            data-testid={`button-remove-phone-${phone.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {availablePhones.length > 0 && (
                    <div>
                      <Label className="text-sm mb-2 block">Add Phone Number</Label>
                      <Select onValueChange={(val) => {
                        const phone = availablePhones.find((p) => p.id === val);
                        if (phone) addPhoneToCanvas(phone);
                      }}>
                        <SelectTrigger data-testid="select-add-phone">
                          <SelectValue placeholder="Select a phone number..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availablePhones.map((phone) => (
                            <SelectItem key={phone.id} value={phone.id}>
                              <div className="flex items-center gap-2">
                                <Phone className="h-3 w-3 text-green-600" />
                                <span>{phone.phoneNumber}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {availablePhones.length === 0 && assignedPhones.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No phone numbers available. Purchase phone numbers first.
                    </p>
                  )}
                </div>
              </div>
            )}

            {selectedNode?.type === "staffAI" && (
              <div className="mt-4 space-y-4">
                <div>
                  <Label>Language Filter</Label>
                  <Select value={languageFilter} onValueChange={setLanguageFilter}>
                    <SelectTrigger className="mt-1.5" data-testid="select-config-language-filter">
                      <div className="flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                        <SelectValue placeholder="Filter by language" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Languages</SelectItem>
                      {availableLanguages.map((lang) => (
                        <SelectItem key={lang} value={lang}>
                          {lang.toUpperCase()} - {getLanguageLabel(lang)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Select Agent</Label>
                  <Select
                    value={(selectedNode.data as any).agentId || ""}
                    onValueChange={(val) => {
                      const agent = agents.find((a) => a.id === val);
                      if (agent) {
                        updateStaffAIConfig(selectedNode.id, {
                          agentId: agent.id,
                          agentName: agent.name,
                          customPrompt: agent.systemPrompt || "",
                          language: agent.language || null,
                          voiceName: agent.openaiVoice || agent.voiceName || null,
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1.5" data-testid="select-staff-agent">
                      <SelectValue placeholder="Select an agent..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredAgents.length === 0 ? (
                        <SelectItem value="__empty__" disabled>
                          {languageFilter !== "all" ? `No agents for ${getLanguageLabel(languageFilter)}` : "No agents available"}
                        </SelectItem>
                      ) : (
                        filteredAgents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            <div className="flex items-center gap-2">
                              <span>{agent.name}</span>
                              {agent.language && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0">
                                  {agent.language.toUpperCase()}
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Use Case</Label>
                  <Select
                    value={useCaseFilter}
                    onValueChange={(val) => {
                      setUseCaseFilter(val);
                      if (val !== "all") {
                        const matchingTemplate = promptTemplates.find((t) => t.category === val);
                        if (matchingTemplate) {
                          applyTemplateToStaffAI(matchingTemplate);
                        }
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1.5" data-testid="select-config-usecase">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                        <SelectValue placeholder="Select use case..." />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Use Cases</SelectItem>
                      {useCaseCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          <span className="capitalize">{cat.replace("_", " ")}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Custom Prompt</Label>
                  <Textarea
                    value={(selectedNode.data as any).customPrompt || ""}
                    onChange={(e) =>
                      updateStaffAIConfig(selectedNode.id, { customPrompt: e.target.value })
                    }
                    rows={6}
                    className="mt-1.5"
                    placeholder="Instructions for the AI agent..."
                    data-testid="textarea-staff-prompt"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Voice</Label>
                    <div className="mt-1.5 p-2 bg-muted rounded text-sm flex items-center gap-2" data-testid="display-voice">
                      <Mic className="h-3.5 w-3.5 text-muted-foreground" />
                      {(selectedNode.data as any).voiceName || "Not set"}
                    </div>
                  </div>
                  <div>
                    <Label>Language</Label>
                    <div className="mt-1.5 p-2 bg-muted rounded text-sm flex items-center gap-2" data-testid="display-language">
                      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                      {(selectedNode.data as any).language ? `${((selectedNode.data as any).language as string).toUpperCase()} - ${getLanguageLabel((selectedNode.data as any).language)}` : "Not set"}
                    </div>
                  </div>
                </div>

                {(selectedNode.data as any).templateName && (
                  <div>
                    <Label>Applied Template</Label>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Badge variant="outline" className="border-purple-300 text-purple-600">
                        <FileText className="h-3 w-3 mr-1" />
                        {(selectedNode.data as any).templateName}
                      </Badge>
                    </div>
                  </div>
                )}

                <div>
                  <Label>Knowledge Base</Label>
                  {(() => {
                    const attachedIds = (selectedNode.data as any).knowledgeBaseIds || [];
                    const unattachedKBs = knowledgeBases.filter(kb => !attachedIds.includes(kb.id));
                    return (
                      <>
                        <Select
                          onValueChange={(val) => {
                            if (val && selectedNode) {
                              const kb = knowledgeBases.find((k) => k.id === val);
                              if (kb) {
                                addKnowledgeBaseToStaffAI(kb);
                              }
                            }
                          }}
                        >
                          <SelectTrigger className="mt-1.5" data-testid="select-config-kb">
                            <div className="flex items-center gap-1.5">
                              <Database className="h-3.5 w-3.5 text-muted-foreground" />
                              <SelectValue placeholder="Attach a knowledge base..." />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            {unattachedKBs.length === 0 ? (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                {knowledgeBases.length === 0 ? "No knowledge bases available" : "All knowledge bases attached"}
                              </div>
                            ) : (
                              unattachedKBs.map((kb) => (
                                <SelectItem key={kb.id} value={kb.id}>
                                  <div className="flex items-center gap-2">
                                    <Database className="h-3 w-3 text-amber-600" />
                                    <span>{kb.name}</span>
                                    <span className="text-xs text-muted-foreground">({kb.type})</span>
                                  </div>
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        {attachedIds.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {attachedIds.map((kbId: string) => {
                              const kb = knowledgeBases.find((k) => k.id === kbId);
                              return kb ? (
                                <Badge key={kbId} variant="outline" className="border-amber-300 text-amber-600">
                                  <Database className="h-3 w-3 mr-1" />
                                  {kb.name}
                                </Badge>
                              ) : null;
                            })}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                <div className="pt-4">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteNode(selectedNode.id)}
                    data-testid="button-delete-staff"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove Staff AI
                  </Button>
                </div>
              </div>
            )}

            {selectedNode?.type === "promptTemplate" && (
              <div className="mt-4 space-y-4">
                <div>
                  <Label>Template Name</Label>
                  <div className="mt-1.5 p-2 bg-muted rounded text-sm font-medium" data-testid="display-template-name">
                    {(selectedNode.data as any).templateName}
                  </div>
                </div>

                <div>
                  <Label>Category</Label>
                  <div className="mt-1.5">
                    <Badge variant="outline" className={getCategoryColor((selectedNode.data as any).category)}>
                      {(selectedNode.data as any).category}
                    </Badge>
                  </div>
                </div>

                {(selectedNode.data as any).description && (
                  <div>
                    <Label>Description</Label>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {(selectedNode.data as any).description}
                    </p>
                  </div>
                )}

                <div>
                  <Label>System Prompt Preview</Label>
                  <div className="mt-1.5 p-3 bg-muted rounded text-sm max-h-40 overflow-y-auto" data-testid="display-template-prompt">
                    {(selectedNode.data as any).systemPrompt?.slice(0, 300)}
                    {((selectedNode.data as any).systemPrompt?.length || 0) > 300 && "..."}
                  </div>
                </div>

                <Button
                  onClick={() => {
                    const connectedStaffId = (selectedNode.data as any).connectedStaffId;
                    if (connectedStaffId) {
                      updateStaffAIConfig(connectedStaffId, {
                        customPrompt: (selectedNode.data as any).systemPrompt,
                        templateId: (selectedNode.data as any).templateId,
                        templateName: (selectedNode.data as any).templateName,
                      });
                      toast({
                        title: "Template Applied",
                        description: "Prompt has been applied to the connected Staff AI.",
                      });
                    }
                  }}
                  data-testid="button-apply-template"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Apply to Agent
                </Button>

                <div className="pt-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteNode(selectedNode.id)}
                    data-testid="button-delete-template"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove Template
                  </Button>
                </div>
              </div>
            )}

            {selectedNode?.type === "knowledgeBase" && (
              <div className="mt-4 space-y-4">
                <div>
                  <Label>Knowledge Base Name</Label>
                  <div className="mt-1.5 p-2 bg-muted rounded text-sm font-medium flex items-center gap-2" data-testid="display-kb-name">
                    <Database className="h-4 w-4 text-amber-600" />
                    {(selectedNode.data as any).kbName}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Type</Label>
                    <div className="mt-1.5 p-2 bg-muted rounded text-sm" data-testid="display-kb-type">
                      {(selectedNode.data as any).kbType}
                    </div>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <div className="mt-1.5 p-2 bg-muted rounded text-sm" data-testid="display-kb-status">
                      <Badge variant="outline" className={
                        (selectedNode.data as any).kbStatus === "active"
                          ? "bg-green-100 text-green-700 border-green-300"
                          : "bg-gray-100 text-gray-700 border-gray-300"
                      }>
                        {(selectedNode.data as any).kbStatus}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Change Knowledge Base</Label>
                  <Select
                    value={(selectedNode.data as any).kbId || ""}
                    onValueChange={(val) => {
                      const kb = knowledgeBases.find((k) => k.id === val);
                      if (kb) {
                        setNodes((nds) =>
                          nds.map((node) => {
                            if (node.id === selectedNode.id) {
                              return {
                                ...node,
                                data: {
                                  ...node.data,
                                  kbId: kb.id,
                                  kbName: kb.name,
                                  kbType: kb.type,
                                  kbStatus: kb.status,
                                },
                              };
                            }
                            return node;
                          })
                        );
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1.5" data-testid="select-kb">
                      <SelectValue placeholder="Select knowledge base..." />
                    </SelectTrigger>
                    <SelectContent>
                      {knowledgeBases.map((kb) => (
                        <SelectItem key={kb.id} value={kb.id}>
                          {kb.name} ({kb.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteNode(selectedNode.id)}
                    data-testid="button-delete-kb"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove Knowledge Base
                  </Button>
                </div>
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function IncomingCallCanvas({ embedded = false }: { embedded?: boolean } = {}) {
  return (
    <ReactFlowProvider>
      <IncomingCallCanvasContent embedded={embedded} />
    </ReactFlowProvider>
  );
}
