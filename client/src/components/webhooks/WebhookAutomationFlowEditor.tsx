/**
 * WhatsApp-style visual automation map for /app/settings/automation.
 * Draft persists in localStorage (planning layer until wired to execution).
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { MessageCircle, Zap, Plus, Sparkles, Undo2, Redo2, Check, Link2 } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export const FLOW_STORAGE_KEY = "loop23_webhook_automation_flow_v2";

export type WebhookFlowNodeData =
  | {
      variant: "wa_message";
      title: string;
      body: string;
      buttonLabel?: string;
      triggerHint?: string;
    }
  | {
      variant: "stack_action";
      title: string;
      lines: string[];
    }
  | {
      variant: "wa_wait";
      title: string;
      body: string;
      waitingHint: string;
    };

type RFNode = Node<WebhookFlowNodeData>;

function WaMessageNode({ data, selected }: NodeProps<RFNode>) {
  const d = data as Extract<WebhookFlowNodeData, { variant: "wa_message" }>;
  return (
    <div
      className={cn(
        "min-w-[240px] max-w-[280px] rounded-2xl overflow-hidden shadow-md bg-card border-2 transition-shadow",
        selected ? "shadow-xl ring-2 ring-offset-2 ring-green-600" : "border-green-600/80"
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-green-600 !w-3 !h-3 !border-2 !border-white" />
      <div className="bg-green-600 px-3 py-2 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-white" />
        </div>
        <span className="text-white text-[11px] font-semibold uppercase tracking-wide truncate">{d.title}</span>
      </div>
      <div className="px-3 py-2 border-x border-b border-border rounded-b-2xl space-y-1">
        {d.triggerHint && (
          <p className="text-[10px] text-muted-foreground font-mono truncate">{d.triggerHint}</p>
        )}
        <div className="rounded-lg bg-muted/60 p-2 text-xs leading-snug text-foreground whitespace-pre-wrap line-clamp-4">
          {d.body}
        </div>
        {d.buttonLabel && (
          <div className="inline-block mt-1 px-2 py-1 rounded-md bg-primary/10 text-[11px] font-medium text-primary">
            {d.buttonLabel}
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="next"
        className="!bg-green-600 !w-3 !h-3 !border-2 !border-white"
      />
    </div>
  );
}

function StackActionNode({ data, selected }: NodeProps<RFNode>) {
  const d = data as Extract<WebhookFlowNodeData, { variant: "stack_action" }>;
  return (
    <div
      className={cn(
        "min-w-[240px] max-w-[280px] rounded-2xl overflow-hidden shadow-md bg-card border-2 transition-shadow",
        selected ? "shadow-xl ring-2 ring-offset-2 ring-amber-500" : "border-amber-500/80"
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-3 !h-3 !border-2 !border-white" />
      <div className="bg-amber-500 px-3 py-2 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <span className="text-white text-[11px] font-semibold uppercase tracking-wide truncate">{d.title}</span>
      </div>
      <ul className="px-3 py-2 border-x border-b border-border rounded-b-2xl text-xs space-y-1.5 text-foreground">
        {d.lines.map((line, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-muted-foreground shrink-0">{i + 1}.</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <Handle
        type="source"
        position={Position.Bottom}
        id="next"
        className="!bg-amber-500 !w-3 !h-3 !border-2 !border-white"
      />
    </div>
  );
}

function WaWaitNode({ data, selected }: NodeProps<RFNode>) {
  const d = data as Extract<WebhookFlowNodeData, { variant: "wa_wait" }>;
  return (
    <div
      className={cn(
        "min-w-[260px] max-w-[300px] rounded-2xl overflow-hidden shadow-md bg-card border-2 transition-shadow",
        selected ? "shadow-xl ring-2 ring-offset-2 ring-blue-600" : "border-blue-600/80"
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-600 !w-3 !h-3 !border-2 !border-white" />
      <div className="bg-blue-600 px-3 py-2 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-white" />
        </div>
        <span className="text-white text-[11px] font-semibold uppercase tracking-wide truncate">{d.title}</span>
      </div>
      <div className="px-3 py-2 border-x border-b border-border rounded-b-2xl space-y-2">
        <div className="rounded-lg bg-muted/60 p-2 text-xs whitespace-pre-wrap">{d.body}</div>
        <p className="text-[11px] text-muted-foreground italic">{d.waitingHint}</p>
        <div className="flex justify-between gap-1 pt-1 text-[10px] font-medium">
          <span className="text-amber-700 dark:text-amber-400">● reply</span>
          <span className="text-red-600 dark:text-red-400">● timeout</span>
          <span className="text-blue-700 dark:text-blue-400">● next</span>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="on_reply"
        className="!left-[22%] !bg-amber-500 !w-3 !h-3 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="no_reply"
        className="!left-[50%] !bg-red-500 !w-3 !h-3 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="next_step"
        className="!left-[78%] !bg-blue-600 !w-3 !h-3 !border-2 !border-white"
      />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  wa_message: WaMessageNode,
  stack_action: StackActionNode,
  wa_wait: WaWaitNode,
};

export function buildStarterFlow(
  t: TFunction,
  opts: { flowName: string; triggerEvent: string }
): { nodes: RFNode[]; edges: Edge[] } {
  const { triggerEvent } = opts;
  const nodes: RFNode[] = [
    {
      id: "n1",
      type: "wa_message",
      position: { x: 120, y: 20 },
      data: {
        variant: "wa_message",
        title: t("webhooks.flowBuilder.template.send1Title"),
        triggerHint: t("webhooks.flowBuilder.triggerWhen", { event: triggerEvent }),
        body: t("webhooks.flowBuilder.template.send1Body"),
        buttonLabel: t("webhooks.flowBuilder.template.buttonLabel"),
      },
    },
    {
      id: "n2",
      type: "stack_action",
      position: { x: 100, y: 260 },
      data: {
        variant: "stack_action",
        title: t("webhooks.flowBuilder.actionsTitle"),
        lines: [
          t("webhooks.flowBuilder.template.actionLine1"),
          t("webhooks.flowBuilder.template.actionLine2"),
        ],
      },
    },
    {
      id: "n3",
      type: "wa_wait",
      position: { x: 80, y: 480 },
      data: {
        variant: "wa_wait",
        title: t("webhooks.flowBuilder.template.send2Title"),
        body: t("webhooks.flowBuilder.template.send2Body"),
        waitingHint: t("webhooks.flowBuilder.template.waitingHint"),
      },
    },
  ];
  const edges: Edge[] = [
    { id: "e1", source: "n1", target: "n2", sourceHandle: "next", animated: true },
    { id: "e2", source: "n2", target: "n3", sourceHandle: "next", animated: true },
  ];
  return { nodes, edges };
}

function loadFlow(): { nodes: RFNode[]; edges: Edge[] } | null {
  try {
    const raw = localStorage.getItem(FLOW_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { nodes?: RFNode[]; edges?: Edge[] };
    if (!p.nodes?.length || !p.edges) return null;
    return { nodes: p.nodes as RFNode[], edges: p.edges };
  } catch {
    return null;
  }
}

type Props = {
  seedVersion: number;
  flowTitle: string;
  triggerEvent: string;
  onFlowTitleChange?: (title: string) => void;
};

export function WebhookAutomationFlowEditor({
  seedVersion,
  flowTitle,
  triggerEvent,
  onFlowTitleChange,
}: Props) {
  const { t } = useTranslation();
  const [nodes, setNodes, onNodesChange] = useNodesState<RFNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [history, setHistory] = useState<{ nodes: RFNode[]; edges: Edge[] }[]>([]);
  const [future, setFuture] = useState<{ nodes: RFNode[]; edges: Edge[] }[]>([]);
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    const loaded = loadFlow();
    if (loaded) {
      setNodes(loaded.nodes);
      setEdges(loaded.edges);
    } else {
      const pack = buildStarterFlow(t, {
        flowName: flowTitle || t("webhooks.flowBuilder.untitled"),
        triggerEvent,
      });
      setNodes(pack.nodes);
      setEdges(pack.edges);
    }
    setMounted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once on mount
  }, []);

  useEffect(() => {
    if (!mounted || seedVersion <= 0) return;
    const pack = buildStarterFlow(t, {
      flowName: flowTitle || t("webhooks.flowBuilder.untitled"),
      triggerEvent,
    });
    setNodes(pack.nodes);
    setEdges(pack.edges);
    setSelectedId(null);
    try {
      localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify({ nodes: pack.nodes, edges: pack.edges }));
    } catch {
      /* ignore */
    }
  }, [seedVersion, mounted, t, flowTitle, triggerEvent, setNodes, setEdges]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify({ nodes, edges }));
    } catch {
      /* ignore */
    }
  }, [nodes, edges, mounted]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId]
  );

  const inspectorTitle = useMemo(() => {
    if (!selectedNode) return "";
    const d = selectedNode.data;
    if (d.variant === "wa_message" || d.variant === "stack_action" || d.variant === "wa_wait") {
      return d.title;
    }
    return "";
  }, [selectedNode]);

  const pushHistory = useCallback(() => {
    setHistory((h) => [
      ...h.slice(-40),
      { nodes: JSON.parse(JSON.stringify(nodes)) as RFNode[], edges: JSON.parse(JSON.stringify(edges)) },
    ]);
    setFuture([]);
  }, [nodes, edges]);

  const onConnect = useCallback(
    (params: Connection) => {
      pushHistory();
      setEdges((eds) => addEdge({ ...params, animated: true }, eds));
    },
    [pushHistory, setEdges]
  );

  const updateSelectedData = useCallback(
    (patch: Partial<WebhookFlowNodeData>) => {
      if (!selectedId || !selectedNode) return;
      pushHistory();
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedId ? { ...n, data: { ...n.data, ...patch } as WebhookFlowNodeData } : n
        )
      );
    },
    [selectedId, selectedNode, pushHistory, setNodes]
  );

  const addNode = useCallback(
    (kind: WebhookFlowNodeData["variant"]) => {
      pushHistory();
      const id = `n-${Date.now()}`;
      const base = { x: 140 + nodes.length * 24, y: 80 + nodes.length * 16 };
      let data: WebhookFlowNodeData;
      if (kind === "wa_message") {
        data = {
          variant: "wa_message",
          title: t("webhooks.flowBuilder.newSendTitle"),
          body: t("webhooks.flowBuilder.newSendBody"),
          buttonLabel: "",
        };
      } else if (kind === "stack_action") {
        data = {
          variant: "stack_action",
          title: t("webhooks.flowBuilder.actionsTitle"),
          lines: [t("webhooks.flowBuilder.newActionLine")],
        };
      } else {
        data = {
          variant: "wa_wait",
          title: t("webhooks.flowBuilder.waitTitle"),
          body: t("webhooks.flowBuilder.waitBody"),
          waitingHint: t("webhooks.flowBuilder.waitHint"),
        };
      }
      const type = kind === "stack_action" ? "stack_action" : kind === "wa_wait" ? "wa_wait" : "wa_message";
      setNodes((nds) => [...nds, { id, type, position: base, data }]);
    },
    [nodes.length, pushHistory, setNodes, t]
  );

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    pushHistory();
    setNodes((nds) => nds.filter((n) => n.id !== selectedId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
  }, [selectedId, pushHistory, setNodes, setEdges]);

  const undo = useCallback(() => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setFuture((f) => [{ nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }, ...f]);
    setNodes(prev.nodes);
    setEdges(prev.edges);
  }, [history, nodes, edges, setNodes, setEdges]);

  const redo = useCallback(() => {
    if (!future.length) return;
    const [next, ...rest] = future;
    setFuture(rest);
    setHistory((h) => [...h, { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }]);
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [future, nodes, setNodes, setEdges]);

  const saveLocal = useCallback(() => {
    try {
      localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify({ nodes, edges }));
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1200);
    } catch {
      /* ignore */
    }
  }, [nodes, edges]);

  return (
    <div className="flex flex-col rounded-xl border border-border/40 bg-background overflow-hidden min-h-[min(720px,calc(100vh-10rem))]">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border/60 bg-muted/30 shrink-0">
        <div className="flex flex-wrap items-center gap-2 text-sm min-w-0 flex-1">
          <span className="text-muted-foreground shrink-0">{t("webhooks.flowBuilder.breadcrumbRoot")}</span>
          <span className="text-muted-foreground/60">›</span>
          <Input
            className="h-8 max-w-[min(100%,280px)] text-sm font-medium"
            value={flowTitle}
            placeholder={t("webhooks.flowBuilder.untitled")}
            onChange={(e) => onFlowTitleChange?.(e.target.value)}
            aria-label={t("webhooks.flowWizard.flowName")}
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap justify-end">
          {savedFlash && (
            <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 mr-1">
              <Check className="h-3.5 w-3.5" /> {t("webhooks.flowBuilder.saved")}
            </span>
          )}
          <Button variant="outline" size="sm" className="h-8" type="button" onClick={undo} disabled={!history.length}>
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8" type="button" onClick={redo} disabled={!future.length}>
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button size="sm" className="h-8" type="button" onClick={saveLocal}>
            {t("webhooks.flowBuilder.update")}
          </Button>
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" asChild>
            <Link href="/app/integrations/concierge">{t("webhooks.flowBuilder.goConcierge")}</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        <aside className="w-full lg:w-[340px] shrink-0 border-b lg:border-b-0 lg:border-r border-border/60 bg-card/50 flex flex-col max-h-[42vh] lg:max-h-none">
          <div className="px-3 py-2 border-b border-border/40 font-medium text-sm truncate">
            {selectedNode ? inspectorTitle : <span className="text-muted-foreground">{t("webhooks.flowBuilder.inspectorEmpty")}</span>}
          </div>
          <ScrollArea className="flex-1 p-3">
            {selectedNode && (
              <>
                {selectedNode.data.variant === "wa_message" && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>{t("webhooks.flowBuilder.fieldTitle")}</Label>
                      <Input
                        value={selectedNode.data.title}
                        onChange={(e) => updateSelectedData({ title: e.target.value } as Partial<WebhookFlowNodeData>)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{t("webhooks.flowBuilder.fieldBody")}</Label>
                      <Textarea
                        rows={5}
                        value={selectedNode.data.body}
                        onChange={(e) => updateSelectedData({ body: e.target.value } as Partial<WebhookFlowNodeData>)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{t("webhooks.flowBuilder.fieldButton")}</Label>
                      <Input
                        value={selectedNode.data.buttonLabel ?? ""}
                        onChange={(e) => updateSelectedData({ buttonLabel: e.target.value } as Partial<WebhookFlowNodeData>)}
                      />
                    </div>
                  </div>
                )}
                {selectedNode.data.variant === "stack_action" && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>{t("webhooks.flowBuilder.fieldTitle")}</Label>
                      <Input
                        value={selectedNode.data.title}
                        onChange={(e) => updateSelectedData({ title: e.target.value } as Partial<WebhookFlowNodeData>)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{t("webhooks.flowBuilder.fieldActions")}</Label>
                      <Textarea
                        rows={6}
                        value={selectedNode.data.lines.join("\n")}
                        onChange={(e) =>
                          updateSelectedData({
                            lines: e.target.value.split("\n").filter(Boolean),
                          } as Partial<WebhookFlowNodeData>)
                        }
                      />
                      <p className="text-[11px] text-muted-foreground">{t("webhooks.flowBuilder.actionsHelp")}</p>
                    </div>
                  </div>
                )}
                {selectedNode.data.variant === "wa_wait" && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>{t("webhooks.flowBuilder.fieldTitle")}</Label>
                      <Input
                        value={selectedNode.data.title}
                        onChange={(e) => updateSelectedData({ title: e.target.value } as Partial<WebhookFlowNodeData>)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{t("webhooks.flowBuilder.fieldBody")}</Label>
                      <Textarea
                        rows={4}
                        value={selectedNode.data.body}
                        onChange={(e) => updateSelectedData({ body: e.target.value } as Partial<WebhookFlowNodeData>)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{t("webhooks.flowBuilder.fieldWaiting")}</Label>
                      <Input
                        value={selectedNode.data.waitingHint}
                        onChange={(e) => updateSelectedData({ waitingHint: e.target.value } as Partial<WebhookFlowNodeData>)}
                      />
                    </div>
                  </div>
                )}
                <Separator className="my-4" />
                <Button variant="destructive" size="sm" className="w-full" type="button" onClick={deleteSelected}>
                  {t("webhooks.flowBuilder.deleteStep")}
                </Button>
              </>
            )}
            {!selectedNode && (
              <p className="text-sm text-muted-foreground">{t("webhooks.flowBuilder.inspectorHint")}</p>
            )}
          </ScrollArea>
          <div className="p-3 border-t border-border/40">
            <Button variant="secondary" className="w-full" size="sm" type="button" disabled={!selectedNode}>
              {t("webhooks.flowBuilder.chooseNext")}
            </Button>
          </div>
        </aside>

        <div className="flex-1 min-h-[360px] relative bg-muted/20">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={(sel) => setSelectedId(sel.nodes[0]?.id ?? null)}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            className="bg-[length:20px_20px] bg-[repeating-linear-gradient(0deg,transparent,transparent_19px,hsl(var(--border)/0.35)_20px),repeating-linear-gradient(90deg,transparent,transparent_19px,hsl(var(--border)/0.35)_20px)]"
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} size={1} variant={BackgroundVariant.Dots} className="opacity-40" />
            <Controls className="!shadow-md" />
            <MiniMap className="!bg-card/95 !border !border-border rounded-md" zoomable pannable />
            <Panel position="top-right" className="flex gap-2 m-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" className="rounded-full h-11 w-11 shadow-lg" type="button" aria-label={t("webhooks.flowBuilder.addStep")}>
                    <Plus className="h-6 w-6" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => addNode("wa_message")}>{t("webhooks.flowBuilder.addSend")}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addNode("stack_action")}>{t("webhooks.flowBuilder.addActions")}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addNode("wa_wait")}>{t("webhooks.flowBuilder.addWait")}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="icon" variant="secondary" className="rounded-full h-10 w-10 shadow-md" asChild>
                <Link href="/app/integrations/concierge" aria-label={t("webhooks.automation.openConcierge")}>
                  <Sparkles className="h-5 w-5" />
                </Link>
              </Button>
            </Panel>
          </ReactFlow>
        </div>
      </div>

      <div className="px-3 py-2 border-t border-border/40 bg-muted/20 flex items-center gap-2 text-xs text-muted-foreground">
        <Link2 className="h-3.5 w-3.5 shrink-0" />
        <span>{t("webhooks.flowBuilder.footerHint")}</span>
      </div>
    </div>
  );
}
