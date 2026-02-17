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
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Edit, Trash2, GitBranch, Play, FileText, LayoutTemplate } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { nanoid } from "nanoid";
import { TestFlowDialog } from "@/components/TestFlowDialog";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FlowTemplatesPage from "@/pages/FlowTemplatesPage";

export default function FlowsPage() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [flowToDelete, setFlowToDelete] = useState<any>(null);
  const [flowToTest, setFlowToTest] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("flows");

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const tab = params.get("tab");
    if (tab === "templates") {
      setActiveTab("templates");
    }
  }, [searchString]);

  const { data: flows, isLoading } = useQuery<any[]>({
    queryKey: ["/api/flow-automation/flows"],
  });

  const {
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    paginatedItems: paginatedFlows,
    handlePageChange,
    handleItemsPerPageChange,
  } = usePagination(flows || [], 9);

  const deleteMutation = useMutation({
    mutationFn: async (flowId: string) => {
      return apiRequest("DELETE", `/api/flow-automation/flows/${flowId}`);
    },
    onSuccess: () => {
      toast({
        title: "Flow deleted",
        description: "The flow has been deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/flow-automation/flows"] });
      setFlowToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting flow",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ flowId, isActive }: { flowId: string; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/flow-automation/flows/${flowId}`, { isActive });
    },
    onSuccess: () => {
      toast({
        title: "Flow updated",
        description: "Flow status has been updated",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/flow-automation/flows"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating flow",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createNewFlowMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/flow-automation/flows", {
        name: "Untitled Flow",
        description: "",
        nodes: [],
        edges: [],
        isActive: false,
      });
      return await response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/flow-automation/flows"] });
      if (data?.id) {
        setLocation(`/app/settings/flows/${data.id}`);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error creating flow",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createTemplateFlowMutation = useMutation({
    mutationFn: async () => {
      const nodeIds = {
        start: `node-${nanoid()}`,
        question: `node-${nanoid()}`,
        condition: `node-${nanoid()}`,
        transfer: `node-${nanoid()}`,
        end: `node-${nanoid()}`,
      };
      
      const templateNodes = [
        {
          id: nodeIds.start,
          type: "message",
          position: { x: 250, y: 50 },
          data: {
            type: "message",
            label: "Greeting",
            config: {
              type: "message",
              message: "Hello! Thank you for calling. How can I help you today?",
            },
          },
        },
        {
          id: nodeIds.question,
          type: "question",
          position: { x: 250, y: 180 },
          data: {
            type: "question",
            label: "Ask Transfer",
            config: {
              type: "question",
              question: "Would you like me to transfer your call to a specialist?",
              variableName: "transfer_consent",
            },
          },
        },
        {
          id: nodeIds.condition,
          type: "condition",
          position: { x: 250, y: 310 },
          data: {
            type: "condition",
            label: "Check Response",
            config: {
              type: "condition",
              condition: 'The caller wants to be transferred or said yes',
            },
          },
        },
        {
          id: nodeIds.transfer,
          type: "transfer",
          position: { x: 100, y: 440 },
          data: {
            type: "transfer",
            label: "Transfer Call",
            config: {
              type: "transfer",
              transferNumber: "+1234567890",
              message: "I'll transfer you now. Please hold.",
            },
          },
        },
        {
          id: nodeIds.end,
          type: "end",
          position: { x: 400, y: 440 },
          data: {
            type: "end",
            label: "End Call",
            config: {
              type: "end",
              endMessage: "Thank you for calling. Have a great day!",
            },
          },
        },
      ];

      const templateEdges = [
        {
          id: `edge-${nanoid()}`,
          source: nodeIds.start,
          target: nodeIds.question,
          animated: true,
        },
        {
          id: `edge-${nanoid()}`,
          source: nodeIds.question,
          target: nodeIds.condition,
          animated: true,
        },
        {
          id: `edge-${nanoid()}`,
          source: nodeIds.condition,
          sourceHandle: "true",
          target: nodeIds.transfer,
          animated: true,
        },
        {
          id: `edge-${nanoid()}`,
          source: nodeIds.condition,
          sourceHandle: "false",
          target: nodeIds.end,
          animated: true,
        },
      ];

      const response = await apiRequest("POST", "/api/flow-automation/flows", {
        name: "Call Transfer Flow (Template)",
        description: "Example flow showing how to ask permission and transfer calls based on user response",
        nodes: templateNodes,
        edges: templateEdges,
        isActive: false,
      });
      return await response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Template created",
        description: "Call Transfer Flow template has been created",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/flow-automation/flows"] });
      if (data?.id) {
        setLocation(`/app/settings/flows/${data.id}`);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error creating template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center">
            <GitBranch className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold" data-testid="text-page-title">Flow Builder</h1>
              <Badge variant="secondary" className="text-xs">
                {flows?.length || 0} flows
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Create and manage conversation flows
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList data-testid="tabs-flows">
            <TabsTrigger value="flows" data-testid="tab-flows">
              <GitBranch className="w-4 h-4 mr-2" />
              My Flows
            </TabsTrigger>
            <TabsTrigger value="templates" data-testid="tab-templates">
              <LayoutTemplate className="w-4 h-4 mr-2" />
              Templates
            </TabsTrigger>
          </TabsList>
          
          {activeTab === "flows" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  disabled={createNewFlowMutation.isPending || createTemplateFlowMutation.isPending}
                  data-testid="button-create-flow"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {createNewFlowMutation.isPending || createTemplateFlowMutation.isPending ? "Creating..." : "Create Flow"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => createNewFlowMutation.mutate()} data-testid="menu-item-blank-flow">
                  <Plus className="w-4 h-4 mr-2" />
                  Blank Flow
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => createTemplateFlowMutation.mutate()} data-testid="menu-item-template-flow">
                  <FileText className="w-4 h-4 mr-2" />
                  Call Transfer Template
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <TabsContent value="flows" className="space-y-6">
          {!flows || flows.length === 0 ? (
            <div className="rounded-xl bg-card p-12">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
                  <GitBranch className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-1">No flows yet</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                  Create your first visual conversation flow to build complex multi-step conversations
                </p>
                <div className="flex flex-col gap-2">
                  <Button 
                    onClick={() => createNewFlowMutation.mutate()} 
                    disabled={createNewFlowMutation.isPending}
                    data-testid="button-create-first-flow"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {createNewFlowMutation.isPending ? "Creating..." : "Create Blank Flow"}
                  </Button>
                  <Button 
                    onClick={() => createTemplateFlowMutation.mutate()} 
                    disabled={createTemplateFlowMutation.isPending}
                    variant="outline"
                    data-testid="button-create-template-flow"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    {createTemplateFlowMutation.isPending ? "Creating..." : "Use Call Transfer Template"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-xl bg-card overflow-visible">
                {paginatedFlows.map((flow, index) => (
                  <div
                    key={flow.id}
                    className={`flex items-center gap-4 px-4 py-3 hover-elevate ${index > 0 ? "border-t ml-0" : ""}`}
                    data-testid={`card-flow-${flow.id}`}
                  >
                    <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <GitBranch className="w-4 h-4 text-muted-foreground" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate" data-testid={`text-flow-name-${flow.id}`}>
                          {flow.name}
                        </span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {flow.nodes?.length || 0} nodes
                        </Badge>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {flow.edges?.length || 0} edges
                        </Badge>
                      </div>
                      {flow.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {flow.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={flow.isActive}
                          onCheckedChange={(checked) =>
                            toggleActiveMutation.mutate({ flowId: flow.id, isActive: checked })
                          }
                          data-testid={`switch-flow-active-${flow.id}`}
                        />
                        <Badge variant={flow.isActive ? "default" : "secondary"} className="text-xs">
                          {flow.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setLocation(`/app/settings/flows/${flow.id}`)}
                          data-testid={`button-edit-flow-${flow.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setFlowToTest(flow)}
                          data-testid={`button-test-flow-${flow.id}`}
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setFlowToDelete(flow)}
                          data-testid={`button-delete-flow-${flow.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <DataPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
                itemsPerPageOptions={[6, 9, 12, 24]}
              />
            </>
          )}

          {flowToTest && (
            <TestFlowDialog
              open={!!flowToTest}
              onOpenChange={(open) => !open && setFlowToTest(null)}
              flowId={flowToTest.id}
              flowName={flowToTest.name}
            />
          )}

          <AlertDialog open={!!flowToDelete} onOpenChange={(open) => !open && setFlowToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Flow</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{flowToDelete?.name}"? This action cannot be undone.
                  Any campaigns using this flow will need to be updated.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => flowToDelete && deleteMutation.mutate(flowToDelete.id)}
                  className="bg-destructive text-destructive-foreground"
                  data-testid="button-confirm-delete"
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete Flow"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <FlowTemplatesPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
