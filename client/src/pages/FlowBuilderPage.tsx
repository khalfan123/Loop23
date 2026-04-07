/**
 * ============================================================
 * © 2025 Diploy — a brand of Bisht Technologies Private Limited
 * Original Author: BTPL Engineering Team
 * Website: https://diploy.in
 * Contact: cs@diploy.in
 *
 * Distributed under the Envato / CodeCanyon License Agreement.
 * Licensed to the purchaser for use as defined by the
 * Envato Market (CodeCanyon) Regular or Extended License.
 *
 * You are NOT permitted to redistribute, resell, sublicense,
 * or share this source code, in whole or in part.
 * Respect the author's rights and Envato licensing terms.
 * ============================================================
 */
import { useCallback, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Node,
  type Edge,
  type EdgeProps,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
  BackgroundVariant,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Save,
  Play,
  MessageSquare,
  HelpCircle,
  GitBranch,
  Calendar,
  FileText,
  Webhook,
  Phone,
  Clock,
  StopCircle,
  Plus,
  ArrowLeft,
  X,
  Trash2,
  Info,
  Volume2,
  Upload,
  AlertTriangle,
  Check,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useRoute, useLocation } from "wouter";
import { TestFlowDialog } from "@/components/TestFlowDialog";

// Flow node data interface
interface FlowNodeConfig {
  type?: string;
  message?: string;
  waitForResponse?: boolean;
  question?: string;
  variableName?: string;
  condition?: string;
  trueBranch?: string;
  falseBranch?: string;
  phoneNumber?: string;
  transferType?: "phone" | "agent";
  transferAgentId?: string;
  duration?: number;
  webhookUrl?: string;
  formId?: string;
  appointmentType?: string;
  endMessage?: string;
  // Play Audio node config
  audioUrl?: string;
  audioFileName?: string;
  interruptible?: boolean;
  waitForComplete?: boolean;
}

interface FlowNodeData extends Record<string, unknown> {
  type: string;
  label: string;
  config?: FlowNodeConfig;
}

type FlowNode = Node<FlowNodeData>;
type FlowEdge = Edge;

// Icon mapping
const nodeTypeIcons = {
  message: MessageSquare,
  question: HelpCircle,
  condition: GitBranch,
  appointment: Calendar,
  form: FileText,
  webhook: Webhook,
  transfer: Phone,
  delay: Clock,
  end: StopCircle,
  play_audio: Volume2,
};

// Color theme for each node type
// handle = accent hex for header band, handles, and outlines
// band  = header background (may be darker for emphasis)
const nodeTypeColors = {
  message:     { handle: "#3b82f6", band: "#3b82f6" },
  question:    { handle: "#a855f7", band: "#a855f7" },
  condition:   { handle: "#f59e0b", band: "#f59e0b" },
  appointment: { handle: "#10b981", band: "#10b981" },
  form:        { handle: "#06b6d4", band: "#06b6d4" },
  webhook:     { handle: "#8b5cf6", band: "#8b5cf6" },
  transfer:    { handle: "#ec4899", band: "#ec4899" },
  delay:       { handle: "#f97316", band: "#f97316" },
  end:         { handle: "#ef4444", band: "#b91c1c" },  // darker red for end node
  play_audio:  { handle: "#06b6d4", band: "#06b6d4" },
};

// Human-readable display labels for each node type
const nodeTypeLabels: Record<string, string> = {
  message:     "Message",
  question:    "Question",
  condition:   "Condition",
  appointment: "Appointment",
  form:        "Form",
  webhook:     "Webhook",
  transfer:    "Transfer",
  delay:       "Delay",
  end:         "End Call",
  play_audio:  "Play Audio",
};

// Node palette organized into sections for the sidebar
const nodePaletteSections = [
  { label: "Basic",       types: ["message", "question", "play_audio"] },
  { label: "Logic",       types: ["condition"] },
  { label: "Integration", types: ["webhook", "form", "appointment"] },
  { label: "Control",     types: ["transfer", "delay", "end"] },
];

// Redesigned call-center style node card with colored top header band
function FlowNode({ data, selected }: { data: any; selected?: boolean }) {
  const Icon = nodeTypeIcons[data.type as keyof typeof nodeTypeIcons] || MessageSquare;
  const colors = nodeTypeColors[data.type as keyof typeof nodeTypeColors] || nodeTypeColors.message;
  const hasMultipleOutputs = data.type === "condition";

  // Build a single content preview string from whichever config field is most relevant
  const previewText =
    data.config?.message ||
    data.config?.question ||
    data.config?.condition ||
    data.config?.webhookUrl ||
    (data.config?.duration ? `${data.config.duration}s delay` : null) ||
    data.config?.endMessage;

  return (
    <div
      className={`relative min-w-[260px] rounded-2xl overflow-hidden transition-all ${
        selected ? "shadow-lg" : "shadow-md hover:shadow-lg"
      }`}
      style={selected ? { outline: `2.5px solid ${colors.handle}`, outlineOffset: "2px" } : undefined}
    >
      {/* Input handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: colors.handle }}
        className="!w-3.5 !h-3.5 !border-2 !border-white dark:!border-gray-900"
      />

      {/* Colored header band */}
      <div
        className="px-3 py-2 flex items-center gap-2"
        style={{ backgroundColor: colors.band }}
      >
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>
        <span className="text-white text-[11px] font-semibold uppercase tracking-wider">
          {nodeTypeLabels[data.type] || data.type}
        </span>
        {selected && (
          <span className="ml-auto text-white/70 text-[10px]">●</span>
        )}
      </div>

      {/* Card body */}
      <div className="bg-card border-x border-b border-border px-3 py-2.5 rounded-b-2xl">
        <div className="font-semibold text-sm text-foreground leading-snug">{data.label}</div>
        {previewText && (
          <div className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-snug">
            {previewText.length > 70 ? previewText.substring(0, 70) + "…" : previewText}
          </div>
        )}

        {/* Condition node: Yes / No branch labels */}
        {hasMultipleOutputs && (
          <div className="flex justify-between mt-2.5">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-500/15 text-green-700 dark:text-green-400">
              Yes ↙
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-700 dark:text-red-400">
              ↘ No
            </span>
          </div>
        )}
      </div>

      {/* Output handle(s) — bottom */}
      {hasMultipleOutputs ? (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            style={{ left: "28%", background: "#22c55e" }}
            className="!w-3.5 !h-3.5 !border-2 !border-white dark:!border-gray-900"
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            style={{ left: "72%", background: "#ef4444" }}
            className="!w-3.5 !h-3.5 !border-2 !border-white dark:!border-gray-900"
          />
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Bottom}
          style={{ background: colors.handle }}
          className="!w-3.5 !h-3.5 !border-2 !border-white dark:!border-gray-900"
        />
      )}
    </div>
  );
}

// Custom edge that renders Yes/No labels on condition branch edges
function LabeledEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourceHandle,
  markerEnd,
  style,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY });
  const label =
    sourceHandle === "true" ? "Yes" : sourceHandle === "false" ? "No" : null;

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="absolute nodrag nopan pointer-events-none"
            style={{ transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)` }}
          >
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border shadow-sm ${
                label === "Yes"
                  ? "bg-green-500 text-white border-green-600"
                  : "bg-red-500 text-white border-red-600"
              }`}
            >
              {label}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const nodeTypes: NodeTypes = {
  message:     FlowNode,
  question:    FlowNode,
  condition:   FlowNode,
  appointment: FlowNode,
  form:        FlowNode,
  webhook:     FlowNode,
  transfer:    FlowNode,
  delay:       FlowNode,
  end:         FlowNode,
  play_audio:  FlowNode,
  custom:      FlowNode,
};

const edgeTypes: EdgeTypes = {
  default: LabeledEdge,
  labeled: LabeledEdge,
};

export default function FlowBuilderPage() {
  const { t } = useTranslation();
  const [, settingsParams] = useRoute("/app/settings/flows/:id");
  const [, legacyParams] = useRoute("/app/flows/:id");
  const [, deprockParams] = useRoute("/app/deprock/flows/:id");
  const params = settingsParams || legacyParams || deprockParams;
  const [, setLocation] = useLocation();
  const flowId = params?.id;
  const isDeprockContext = !!deprockParams;
  
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);
  const [flowName, setFlowName] = useState(t("flows.flowNamePlaceholder"));
  const [flowDescription, setFlowDescription] = useState("");
  const [agentId, setAgentId] = useState<string>("");
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Available node types for the sidebar (using translations)
  const availableNodeTypes = [
    { type: "message", label: t("flows.nodeTypes.message"), description: t("flows.nodeDescriptions.message"), icon: MessageSquare },
    { type: "question", label: t("flows.nodeTypes.question"), description: t("flows.nodeDescriptions.question"), icon: HelpCircle },
    { type: "condition", label: t("flows.nodeTypes.condition"), description: t("flows.nodeDescriptions.condition"), icon: GitBranch },
    { type: "appointment", label: t("flows.nodeTypes.appointment"), description: t("flows.nodeDescriptions.appointment"), icon: Calendar },
    { type: "form", label: t("flows.nodeTypes.form"), description: t("flows.nodeDescriptions.form"), icon: FileText },
    { type: "webhook", label: t("flows.nodeTypes.webhook"), description: t("flows.nodeDescriptions.webhook"), icon: Webhook },
    { type: "transfer", label: t("flows.nodeTypes.transfer"), description: t("flows.nodeDescriptions.transfer"), icon: Phone },
    { type: "delay", label: t("flows.nodeTypes.delay"), description: t("flows.nodeDescriptions.delay"), icon: Clock },
    { type: "play_audio", label: t("flows.nodeTypes.playAudio"), description: t("flows.nodeDescriptions.playAudio"), icon: Volume2 },
    { type: "end", label: t("flows.nodeTypes.end"), description: t("flows.nodeDescriptions.end"), icon: StopCircle },
  ];
  
  // Fetch agents for selection
  const { data: agents, isError: agentsError } = useQuery<any[]>({
    queryKey: ["/api/agents"],
  });

  // Check if selected agent uses ElevenLabs engine (doesn't support audio playback)
  const selectedAgent = agents?.find((a: any) => a.id === agentId);
  const isElevenLabsEngine = selectedAgent?.telephonyProvider === 'twilio' || 
                             selectedAgent?.telephonyProvider === 'elevenlabs-sip' ||
                             !selectedAgent?.telephonyProvider; // Default is twilio (ElevenLabs)

  // Fetch forms for form node selection
  const { data: availableForms, isLoading: isLoadingForms, isError: formsError } = useQuery<Array<{
    id: string;
    name: string;
    description: string | null;
    fields?: Array<{
      id: string;
      question: string;
      fieldType: string;
      isRequired: boolean;
      order: number;
    }>;
  }>>({
    queryKey: ["/api/flow-automation/forms"],
  });

  // Load existing flow if editing (not for new flows)
  const { data: flow, isError: flowError, isLoading: flowLoading } = useQuery<any>({
    queryKey: [`/api/flow-automation/flows/${flowId}`],
    enabled: !!flowId && flowId !== "new",
  });

  // Load flow data when fetched
  useEffect(() => {
    if (flow) {
      // Normalize nodes to ensure root-level type matches data.type (matching template format)
      const normalizedNodes = ((flow.nodes as FlowNode[]) || []).map((node) => ({
        ...node,
        type: node.data?.type || node.type, // Ensure type matches data.type
      }));
      setNodes(normalizedNodes);
      setEdges((flow.edges as FlowEdge[]) || []);
      setFlowName(flow.name);
      setFlowDescription(flow.description || "");
      setAgentId(flow.agentId || "");
    }
  }, [flow, setNodes, setEdges]);

  // Handle connection creation with validation
  const onConnect = useCallback(
    (connection: Connection) => {
      // Prevent self-connections
      if (connection.source === connection.target) {
        toast({
          title: t("flows.toast.invalidConnection"),
          description: t("flows.toast.cannotConnectSelf"),
          variant: "destructive",
        });
        return;
      }
      
      // Add edge with ID immediately (required for state management)
      const edgeWithId = {
        ...connection,
        id: `edge-${connection.source}-${connection.target}${connection.sourceHandle ? `-${connection.sourceHandle}` : ''}`,
        animated: true,
      };
      
      // @ts-expect-error - xyflow's addEdge has overly strict animated type requirement
      setEdges((eds) => addEdge(edgeWithId, eds));
    },
    [setEdges, toast, t]
  );

  // Handle node click (single click to select)
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node as FlowNode);
  }, []);

  // Save flow mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Ensure all edges have IDs (required by backend schema)
      const edgesWithIds = edges.map((edge) => ({
        ...edge,
        id: edge.id || `edge-${edge.source}-${edge.target}`,
      }));

      // Ensure nodes have correct format matching templates
      // Root-level type should match data.type (e.g., "message", "question")
      const nodesWithCorrectFormat = nodes.map((node) => ({
        ...node,
        type: node.data.type, // Use actual node type, not "custom"
      }));

      const flowData = {
        name: flowName,
        description: flowDescription,
        nodes: nodesWithCorrectFormat,
        edges: edgesWithIds,
        agentId: agentId || null,
        isActive: flow?.isActive ?? true,
      };

      const isNewFlow = !flowId || flowId === "new";
      const response = isNewFlow 
        ? await apiRequest("POST", "/api/flow-automation/flows", flowData)
        : await apiRequest("PATCH", `/api/flow-automation/flows/${flowId}`, flowData);
      
      // Parse and return the JSON response so onSuccess gets the flow data with id
      const data = await response.json();
      return data;
    },
    onSuccess: (data: any) => {
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 3000);
      toast({
        title: t("flows.toast.saved"),
        description: t("flows.toast.savedDescription"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/flow-automation/flows"] });
      
      const isNewFlow = !flowId || flowId === "new";
      
      // Invalidate the individual flow query to refresh the editor with latest data
      if (!isNewFlow) {
        queryClient.invalidateQueries({ queryKey: [`/api/flow-automation/flows/${flowId}`] });
      }
      
      if (isNewFlow && data?.id) {
        setLocation(isDeprockContext ? `/app/deprock/flows/${data.id}` : `/app/settings/flows/${data.id}`);
      }
    },
    onError: (error: any) => {
      toast({
        title: t("flows.toast.saveError"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Add new node to canvas
  const addNode = (type: string) => {
    const nodeLabel = availableNodeTypes.find((n) => n.type === type)?.label || type;
    const newNode: FlowNode = {
      id: `node-${Date.now()}`,
      type: type, // Use actual node type to match template format (e.g., "message", "question")
      position: { x: 250, y: 50 + nodes.length * 100 },
      data: {
        type,
        label: nodeLabel,
        config: {
          type,
        },
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNode(newNode);
  };

  // Update selected node configuration
  const updateNodeConfig = (config: any) => {
    if (!selectedNode) return;
    
    setNodes((nds) =>
      nds.map((node) =>
        node.id === selectedNode.id
          ? { ...node, data: { ...node.data, config: { ...node.data.config, ...config } } }
          : node
      )
    );
    
    // Update selected node state
    setSelectedNode((prev) =>
      prev ? { ...prev, data: { ...prev.data, config: { ...prev.data.config, ...config } } } : null
    );
  };

  // Delete selected node
  const deleteNode = () => {
    if (!selectedNode) return;
    
    setNodes((nds) => nds.filter((node) => node.id !== selectedNode.id));
    setEdges((eds) => eds.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id));
    setSelectedNode(null);
  };

  // Get available nodes for dropdowns
  const getAvailableNodes = () => {
    return nodes.map((node) => ({
      id: node.id,
      label: `${node.data.label} (${node.id.substring(node.id.length - 8)})`,
    }));
  };

  return (
    <div className="flex h-screen w-full">
      {/* Sidebar - Node Types */}
      <div className="w-48 flex-shrink-0 flex flex-col border-r bg-card">
        {/* Sidebar Header */}
        <div className="p-4 border-b">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation(isDeprockContext ? "/app/deprock" : "/app/settings/flows")}
            className="mb-3 -ml-2"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {isDeprockContext ? t("flows.backToDeprock", "Back to Deprock") : t("flows.backToFlows")}
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
              <GitBranch className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm" data-testid="text-node-types-title">{t("flows.title")}</h3>
              <p className="text-xs text-muted-foreground">
                {t("flows.subtitle")}
              </p>
            </div>
          </div>
        </div>

        {/* Node Palette — 2-column icon grid organized by category */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {nodePaletteSections.map((section) => {
            const sectionNodes = availableNodeTypes.filter((n) =>
              section.types.includes(n.type)
            );
            return (
              <div key={section.label}>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 px-0.5">
                  {section.label}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {sectionNodes.map((nodeType) => {
                    const Icon = nodeType.icon;
                    const color = nodeTypeColors[nodeType.type as keyof typeof nodeTypeColors]?.handle || "#6b7280";
                    return (
                      <button
                        key={nodeType.type}
                        onClick={() => addNode(nodeType.type)}
                        className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border bg-background hover-elevate transition-all text-center"
                        data-testid={`button-add-${nodeType.type}-node`}
                        title={nodeType.description}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${color}20` }}
                        >
                          <Icon className="w-4 h-4" style={{ color }} />
                        </div>
                        <span className="text-[11px] font-medium leading-tight text-foreground">
                          {nodeTypeLabels[nodeType.type] || nodeType.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer Tip */}
        <div className="p-3 border-t">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {t("flows.tipClickNodes")}
          </p>
        </div>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <div className="border-b px-4 py-2.5 flex items-center gap-3 bg-card">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              className="text-base font-semibold bg-transparent border-none outline-none w-full focus:border-b focus:border-primary pb-px leading-tight"
              placeholder={t("flows.flowName")}
              data-testid="input-flow-name"
            />
            <input
              type="text"
              value={flowDescription}
              onChange={(e) => setFlowDescription(e.target.value)}
              className="text-xs text-muted-foreground bg-transparent border-none outline-none w-full mt-0.5"
              placeholder={t("flows.flowDescriptionPlaceholder")}
              data-testid="input-flow-description"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Agent Selection */}
            <div className="min-w-[200px]">
              <Label className="text-xs text-muted-foreground mb-1">{t("flows.voiceAgent")}</Label>
              <Select value={agentId || "none"} onValueChange={(val) => setAgentId(val === "none" ? "" : val)}>
                <SelectTrigger className="h-8 text-sm" data-testid="select-agent">
                  <SelectValue placeholder={t("flows.selectAgent")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("flows.noAgent")}</SelectItem>
                  {agents?.filter((agent: any) => agent.type === 'flow').map((agent: any) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" data-testid="button-help">
                    <Info className="w-4 h-4 mr-2" />
                    {t("flows.help")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-96" align="end">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-sm mb-2">{t("flows.helpContent.howToBuild")}</h4>
                      <p className="text-xs text-muted-foreground">
                        {t("flows.helpContent.howToBuildDesc")}
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-sm mb-2">{t("flows.helpContent.questionVariables")}</h4>
                      <p className="text-xs text-muted-foreground mb-2">
                        {t("flows.helpContent.questionVariablesDesc")}
                      </p>
                      <div className="bg-muted/50 p-2 rounded text-xs font-mono">
                        Question: "Can I transfer your call?"<br/>
                        Variable: transfer_consent
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-sm mb-2">{t("flows.helpContent.usingConditions")}</h4>
                      <p className="text-xs text-muted-foreground mb-2">
                        {t("flows.helpContent.usingConditionsDesc")}
                      </p>
                      <div className="bg-muted/50 p-2 rounded text-xs font-mono space-y-1">
                        <div>transfer_consent == "yes"</div>
                        <div>age &gt; 18</div>
                        <div>response contains "help"</div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-sm mb-2">{t("flows.helpContent.callTransferExample")}</h4>
                      <p className="text-xs text-muted-foreground">
                        {t("flows.helpContent.callTransferExampleDesc")}
                      </p>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </TooltipProvider>
            
            <div className="w-px h-5 bg-border mx-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!flowId) {
                  toast({
                    title: t("flows.toast.saveFirst"),
                    description: t("flows.toast.saveFirstDescription"),
                    variant: "destructive",
                  });
                  return;
                }
                setTestDialogOpen(true);
              }}
              disabled={!flowId}
              data-testid="button-test-flow"
            >
              <Phone className="w-4 h-4 mr-2" />
              {t("flows.test")}
            </Button>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className={justSaved ? "bg-green-600 hover:bg-green-700 text-white border-green-700" : ""}
              data-testid="button-save-flow"
            >
              {justSaved ? (
                <><Check className="w-4 h-4 mr-2" />Saved</>
              ) : saveMutation.isPending ? (
                <><Save className="w-4 h-4 mr-2" />{t("flows.saving")}</>
              ) : (
                <><Save className="w-4 h-4 mr-2" />{t("flows.save")}</>
              )}
            </Button>
          </div>
        </div>

        {/* React Flow Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            snapToGrid
            snapGrid={[15, 15]}
            defaultEdgeOptions={{ 
              animated: true,
              type: "labeled",
              style: { 
                strokeWidth: 2,
                stroke: 'hsl(var(--border))',
              } 
            }}
            data-testid="flow-canvas"
          >
            <Background 
              variant={BackgroundVariant.Dots} 
              gap={24} 
              size={1.5} 
              className="!bg-background" 
            />
            <Controls className="!bg-card !border !border-border !shadow-sm" />
            <MiniMap 
              className="!bg-card !border !border-border !shadow-sm" 
              nodeColor={(node) => {
                const type = node.data?.type as keyof typeof nodeTypeColors;
                const colors = nodeTypeColors[type];
                if (colors) {
                  return colors.handle;
                }
                return "hsl(var(--primary))";
              }}
              maskColor="rgba(0, 0, 0, 0.1)"
            />
          </ReactFlow>

          {/* Properties Panel (Right Sidebar) */}
          {selectedNode && (
            <div className="absolute right-0 top-0 bottom-0 w-72 bg-card border-l shadow-sm overflow-y-auto z-10">
              <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-card backdrop-blur z-10">
                <div className="flex items-center gap-2">
                  {(() => {
                    const Icon = nodeTypeIcons[selectedNode.data.type as keyof typeof nodeTypeIcons] || MessageSquare;
                    return <Icon className="w-4 h-4 text-foreground" />;
                  })()}
                  <h3 className="font-semibold text-sm">{t("flows.nodeProperties")}</h3>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={deleteNode}
                    data-testid="button-delete-node"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedNode(null)}
                    data-testid="button-close-properties"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Node ID (read-only reference) */}
                <div>
                  <Label className="text-xs text-muted-foreground">{t("flows.nodeId")}</Label>
                  <div className="text-sm font-mono bg-muted/50 px-2 py-1.5 rounded mt-1 break-all">
                    {selectedNode.id}
                  </div>
                </div>

                {/* Message Node */}
                {selectedNode.data.type === "message" && (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="message">{t("flows.nodeConfig.message")}</Label>
                      <Textarea
                        id="message"
                        value={selectedNode.data.config?.message || ""}
                        onChange={(e) => updateNodeConfig({ message: e.target.value })}
                        placeholder={t("flows.nodeConfig.messagePlaceholder")}
                        className="mt-1"
                        data-testid="input-message"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="waitForResponse"
                        checked={selectedNode.data.config?.waitForResponse ?? false}
                        onCheckedChange={(checked) => updateNodeConfig({ waitForResponse: !!checked })}
                        data-testid="checkbox-wait-for-response"
                      />
                      <Label htmlFor="waitForResponse" className="text-sm font-normal cursor-pointer">
                        {t("flows.nodeConfig.waitForResponse")}
                      </Label>
                    </div>
                  </div>
                )}

                {/* Question Node */}
                {selectedNode.data.type === "question" && (
                  <>
                    <div>
                      <Label htmlFor="question">{t("flows.nodeConfig.question")}</Label>
                      <Textarea
                        id="question"
                        value={selectedNode.data.config?.question || ""}
                        onChange={(e) => updateNodeConfig({ question: e.target.value })}
                        placeholder={t("flows.nodeConfig.questionPlaceholder")}
                        className="mt-1"
                        data-testid="input-question"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Label htmlFor="variableName">{t("flows.nodeConfig.variableName")}</Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs">
                                {t("flows.nodeConfig.variableTooltip")}
                              </p>
                              <div className="mt-2 p-2 bg-muted rounded text-xs font-mono">
                                {t("flows.nodeConfig.variableExample")}<br/>
                                Variable: transfer_consent<br/>
                                Use in condition: transfer_consent == "yes"
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Input
                        id="variableName"
                        value={selectedNode.data.config?.variableName || ""}
                        onChange={(e) => updateNodeConfig({ variableName: e.target.value })}
                        placeholder={t("flows.nodeConfig.variableNamePlaceholder")}
                        className="mt-1"
                        data-testid="input-variable-name"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("flows.nodeConfig.variableNameHint")}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="waitForResponseQuestion"
                        checked={selectedNode.data.config?.waitForResponse ?? true}
                        onCheckedChange={(checked) => updateNodeConfig({ waitForResponse: !!checked })}
                        data-testid="checkbox-wait-for-response"
                      />
                      <Label htmlFor="waitForResponseQuestion" className="text-sm font-normal cursor-pointer">
                        {t("flows.nodeConfig.waitForResponse")}
                      </Label>
                    </div>
                  </>
                )}

                {/* Condition Node with Smart Node Selector */}
                {selectedNode.data.type === "condition" && (
                  <>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Label htmlFor="condition">{t("flows.nodeConfig.condition")}</Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs mb-2">
                                {t("flows.nodeConfig.conditionTooltip")}
                              </p>
                              <div className="space-y-1 text-xs font-mono bg-muted p-2 rounded">
                                <div>transfer_consent == "yes"</div>
                                <div>age &gt; 18</div>
                                <div>response contains "help"</div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Textarea
                        id="condition"
                        value={selectedNode.data.config?.condition || ""}
                        onChange={(e) => updateNodeConfig({ condition: e.target.value })}
                        placeholder={t("flows.nodeConfig.conditionPlaceholder")}
                        className="mt-1"
                        data-testid="input-condition"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("flows.nodeConfig.conditionHint")}
                      </p>
                    </div>
                    
                    {/* True Branch - Node Selector */}
                    <div>
                      <Label htmlFor="trueBranch">{t("flows.nodeConfig.trueBranch")}</Label>
                      <Select
                        value={selectedNode.data.config?.trueBranch || ""}
                        onValueChange={(value) => updateNodeConfig({ trueBranch: value })}
                      >
                        <SelectTrigger className="mt-1" data-testid="select-true-branch">
                          <SelectValue placeholder={t("flows.nodeConfig.selectNextNode")} />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailableNodes()
                            .filter((n) => n.id !== selectedNode.id)
                            .map((node) => (
                              <SelectItem key={node.id} value={node.id}>
                                {node.label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* False Branch - Node Selector */}
                    <div>
                      <Label htmlFor="falseBranch">{t("flows.nodeConfig.falseBranch")}</Label>
                      <Select
                        value={selectedNode.data.config?.falseBranch || ""}
                        onValueChange={(value) => updateNodeConfig({ falseBranch: value })}
                      >
                        <SelectTrigger className="mt-1" data-testid="select-false-branch">
                          <SelectValue placeholder={t("flows.nodeConfig.selectNextNode")} />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailableNodes()
                            .filter((n) => n.id !== selectedNode.id)
                            .map((node) => (
                              <SelectItem key={node.id} value={node.id}>
                                {node.label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {/* Transfer Node */}
                {selectedNode.data.type === "transfer" && (
                  <div className="space-y-4">
                    {/* Transfer Type Selector */}
                    <div>
                      <Label htmlFor="transferType">{t("flows.nodeConfig.transferType")}</Label>
                      <Select
                        value={selectedNode.data.config?.transferType || "phone"}
                        onValueChange={(value) => updateNodeConfig({ transferType: value as "phone" | "agent" })}
                      >
                        <SelectTrigger className="mt-1" data-testid="select-transfer-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="phone">{t("flows.nodeConfig.phoneNumber")}</SelectItem>
                          <SelectItem value="agent">{t("flows.nodeConfig.aiAgent")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Phone Number Input - shown when transferType is "phone" */}
                    {(selectedNode.data.config?.transferType === "phone" || !selectedNode.data.config?.transferType) && (
                      <div>
                        <Label htmlFor="phoneNumber">{t("flows.nodeConfig.phoneNumber")}</Label>
                        <Input
                          id="phoneNumber"
                          value={selectedNode.data.config?.phoneNumber || ""}
                          onChange={(e) => updateNodeConfig({ phoneNumber: e.target.value })}
                          placeholder={t("flows.nodeConfig.phoneNumberPlaceholder")}
                          className="mt-1"
                          data-testid="input-phone-number"
                        />
                      </div>
                    )}

                    {/* Agent Selector - shown when transferType is "agent" */}
                    {selectedNode.data.config?.transferType === "agent" && (
                      <div>
                        <Label htmlFor="transferAgentId">{t("flows.nodeConfig.selectAgent")}</Label>
                        <Select
                          value={selectedNode.data.config?.transferAgentId || ""}
                          onValueChange={(value) => updateNodeConfig({ transferAgentId: value })}
                        >
                          <SelectTrigger className="mt-1" data-testid="select-transfer-agent">
                            <SelectValue placeholder={t("flows.nodeConfig.selectAgent")} />
                          </SelectTrigger>
                          <SelectContent>
                            {agents?.filter((agent: any) => agent.type === "incoming").map((agent: any) => (
                              <SelectItem key={agent.id} value={agent.id}>
                                {agent.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                {/* Delay Node */}
                {selectedNode.data.type === "delay" && (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="duration">{t("flows.nodeConfig.duration")}</Label>
                      <Input
                        id="duration"
                        type="number"
                        value={selectedNode.data.config?.duration || 1}
                        onChange={(e) => updateNodeConfig({ duration: parseInt(e.target.value) })}
                        placeholder={t("flows.nodeConfig.durationPlaceholder")}
                        min="1"
                        className="mt-1"
                        data-testid="input-duration"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="waitForResponseDelay"
                        checked={selectedNode.data.config?.waitForResponse ?? false}
                        onCheckedChange={(checked) => updateNodeConfig({ waitForResponse: !!checked })}
                        data-testid="checkbox-wait-for-response"
                      />
                      <Label htmlFor="waitForResponseDelay" className="text-sm font-normal cursor-pointer">
                        {t("flows.nodeConfig.waitForResponse")}
                      </Label>
                    </div>
                  </div>
                )}

                {/* Play Audio Node */}
                {selectedNode.data.type === "play_audio" && (
                  <div className="space-y-4">
                    {/* Warning for ElevenLabs engines that don't support audio playback */}
                    {isElevenLabsEngine && agentId && (
                      <Alert variant="destructive" className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <AlertTitle className="text-amber-800 dark:text-amber-200">{t("flows.nodeConfig.playAudioWarningTitle")}</AlertTitle>
                        <AlertDescription className="text-amber-700 dark:text-amber-300 text-xs">
                          {t("flows.nodeConfig.playAudioWarningElevenLabs")}
                        </AlertDescription>
                      </Alert>
                    )}
                    <div>
                      <Label>{t("flows.nodeConfig.audioFile")}</Label>
                      {selectedNode.data.config?.audioUrl ? (
                        <div className="mt-2 p-3 bg-muted/50 rounded-lg border">
                          <div className="flex items-center gap-2">
                            <Volume2 className="w-4 h-4 text-cyan-600" />
                            <span className="text-sm font-medium truncate flex-1">
                              {selectedNode.data.config?.audioFileName || "Audio file"}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="flex-shrink-0"
                              onClick={() => updateNodeConfig({ audioUrl: "", audioFileName: "" })}
                              data-testid="button-remove-audio"
                            >
                              <X className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                          <audio 
                            controls 
                            src={selectedNode.data.config?.audioUrl} 
                            className="w-full mt-2 h-8"
                            data-testid="audio-preview"
                          />
                        </div>
                      ) : (
                        <div className="mt-2">
                          <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer bg-muted/30 hover:bg-muted/50 border-border">
                            <div className="flex flex-col items-center justify-center pt-2 pb-2">
                              <Upload className="w-6 h-6 mb-1 text-muted-foreground" />
                              <p className="text-xs text-muted-foreground">{t("flows.nodeConfig.uploadAudio")}</p>
                              <p className="text-xs text-muted-foreground/70">MP3, WAV (max 5MB)</p>
                            </div>
                            <input 
                              type="file" 
                              className="hidden" 
                              accept=".mp3,.wav,audio/mpeg,audio/wav"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                if (file.size > 5 * 1024 * 1024) {
                                  toast({ title: t("flows.nodeConfig.fileTooLarge"), variant: "destructive" });
                                  return;
                                }
                                const formData = new FormData();
                                formData.append("audio", file);
                                try {
                                  const token = localStorage.getItem("auth_token");
                                  const res = await fetch("/api/audio/upload", { 
                                    method: "POST", 
                                    body: formData,
                                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                                  });
                                  if (!res.ok) throw new Error("Upload failed");
                                  const data = await res.json();
                                  updateNodeConfig({ audioUrl: data.url, audioFileName: file.name });
                                  toast({ title: t("flows.nodeConfig.audioUploaded") });
                                } catch (err) {
                                  toast({ title: t("flows.nodeConfig.uploadFailed"), variant: "destructive" });
                                }
                              }}
                              data-testid="input-audio-upload"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="interruptible"
                        checked={selectedNode.data.config?.interruptible ?? false}
                        onCheckedChange={(checked) => updateNodeConfig({ interruptible: !!checked })}
                        data-testid="checkbox-interruptible"
                      />
                      <Label htmlFor="interruptible" className="text-sm font-normal cursor-pointer">
                        {t("flows.nodeConfig.interruptible")}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="waitForComplete"
                        checked={selectedNode.data.config?.waitForComplete ?? true}
                        onCheckedChange={(checked) => updateNodeConfig({ waitForComplete: !!checked })}
                        data-testid="checkbox-wait-for-complete"
                      />
                      <Label htmlFor="waitForComplete" className="text-sm font-normal cursor-pointer">
                        {t("flows.nodeConfig.waitForComplete")}
                      </Label>
                    </div>
                  </div>
                )}

                {/* Webhook Node */}
                {selectedNode.data.type === "webhook" && (
                  <div>
                    <Label htmlFor="webhookUrl">{t("flows.nodeConfig.webhookUrl")}</Label>
                    <Input
                      id="webhookUrl"
                      value={selectedNode.data.config?.webhookUrl || ""}
                      onChange={(e) => updateNodeConfig({ webhookUrl: e.target.value })}
                      placeholder={t("flows.nodeConfig.webhookUrlPlaceholder")}
                      className="mt-1"
                      data-testid="input-webhook-url"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("flows.nodeConfig.webhookHint")}
                    </p>
                  </div>
                )}

                {/* Form Node */}
                {selectedNode.data.type === "form" && (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="formId">{t("flows.nodeConfig.selectForm")}</Label>
                      <Select
                        value={selectedNode.data.config?.formId || ""}
                        onValueChange={(value) => {
                          const selectedForm = availableForms?.find(f => f.id === value);
                          updateNodeConfig({ 
                            formId: value,
                            formName: selectedForm?.name || ""
                          });
                        }}
                      >
                        <SelectTrigger className="mt-1" data-testid="select-form">
                          <SelectValue placeholder={t("flows.nodeConfig.selectFormPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableForms?.map((form) => (
                            <SelectItem key={form.id} value={form.id}>
                              {form.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {(!availableForms || availableForms.length === 0) && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                          {t("flows.nodeConfig.noFormsAvailable")}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="formIntroMessage">{t("flows.nodeConfig.introMessage")}</Label>
                      <Textarea
                        id="formIntroMessage"
                        value={selectedNode.data.config?.message || ""}
                        onChange={(e) => updateNodeConfig({ message: e.target.value })}
                        placeholder={t("flows.nodeConfig.formIntroPlaceholder")}
                        className="mt-1"
                        rows={2}
                        data-testid="input-form-intro"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("flows.nodeConfig.formIntroHint")}
                      </p>
                    </div>

                    {selectedNode.data.config?.formId && (() => {
                      const selectedForm = availableForms?.find(f => f.id === selectedNode.data.config?.formId);
                      const formFields = selectedForm?.fields;
                      
                      return (
                        <div className="p-3 bg-muted/50 rounded-md">
                          <p className="text-xs font-medium text-muted-foreground mb-2">
                            {t("flows.nodeConfig.formFieldsPreview")}
                          </p>
                          {isLoadingForms || !availableForms ? (
                            <p className="text-xs text-muted-foreground italic">
                              {t("flows.nodeConfig.loadingFields")}
                            </p>
                          ) : !selectedForm ? (
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                              {t("flows.nodeConfig.formNotFound")}
                            </p>
                          ) : formFields && formFields.length > 0 ? (
                            <ul className="text-xs space-y-1">
                              {formFields
                                .sort((a, b) => a.order - b.order)
                                .map((field, idx) => (
                                  <li key={field.id} className="flex items-center gap-2">
                                    <span className="text-muted-foreground">{idx + 1}.</span>
                                    <span>{field.question}</span>
                                    {field.isRequired && (
                                      <span className="text-amber-600 dark:text-amber-400">*</span>
                                    )}
                                  </li>
                                ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">
                              {t("flows.nodeConfig.noFieldsDefined")}
                            </p>
                          )}
                        </div>
                      );
                    })()}
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="waitForResponseForm"
                        checked={selectedNode.data.config?.waitForResponse ?? true}
                        onCheckedChange={(checked) => updateNodeConfig({ waitForResponse: !!checked })}
                        data-testid="checkbox-wait-for-response"
                      />
                      <Label htmlFor="waitForResponseForm" className="text-sm font-normal cursor-pointer">
                        {t("flows.nodeConfig.waitForResponse")}
                      </Label>
                    </div>
                  </div>
                )}

                {/* Appointment Node */}
                {selectedNode.data.type === "appointment" && (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="appointmentType">{t("flows.nodeConfig.appointmentType")}</Label>
                      <Input
                        id="appointmentType"
                        value={selectedNode.data.config?.appointmentType || ""}
                        onChange={(e) => updateNodeConfig({ appointmentType: e.target.value })}
                        placeholder={t("flows.nodeConfig.appointmentTypePlaceholder")}
                        className="mt-1"
                        data-testid="input-appointment-type"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("flows.nodeConfig.appointmentHint")}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="waitForResponseAppointment"
                        checked={selectedNode.data.config?.waitForResponse ?? true}
                        onCheckedChange={(checked) => updateNodeConfig({ waitForResponse: !!checked })}
                        data-testid="checkbox-wait-for-response"
                      />
                      <Label htmlFor="waitForResponseAppointment" className="text-sm font-normal cursor-pointer">
                        {t("flows.nodeConfig.waitForResponse")}
                      </Label>
                    </div>
                  </div>
                )}

                {/* End Node */}
                {selectedNode.data.type === "end" && (
                  <div>
                    <Label htmlFor="endMessage">{t("flows.nodeConfig.endMessage")}</Label>
                    <Textarea
                      id="endMessage"
                      value={selectedNode.data.config?.endMessage || ""}
                      onChange={(e) => updateNodeConfig({ endMessage: e.target.value })}
                      placeholder={t("flows.nodeConfig.endMessagePlaceholder")}
                      className="mt-1"
                      data-testid="input-end-message"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Test Flow Dialog */}
      {flowId && (
        <TestFlowDialog
          open={testDialogOpen}
          onOpenChange={setTestDialogOpen}
          flowId={flowId}
          flowName={flowName}
        />
      )}
    </div>
  );
}
