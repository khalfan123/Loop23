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
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { GitBranch, Copy, LayoutTemplate } from "lucide-react";
import { useTranslation } from 'react-i18next';

interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  isTemplate: boolean;
  nodeCount: number;
  preview: string[];
}

export default function FlowTemplatesPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<FlowTemplate | null>(null);
  const [flowName, setFlowName] = useState("");

  const { data: templates = [], isLoading } = useQuery<FlowTemplate[]>({
    queryKey: ["/api/flow-automation/flow-templates"],
  });

  const cloneMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/flow-automation/flow-templates/${selectedTemplate?.id}/clone`,
        { name: flowName }
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flow-automation/flows"] });
      toast({
        title: t('flowTemplates.toast.flowCreated'),
        description: t('flowTemplates.toast.flowCreatedDesc'),
      });
      handleCloseClone();
    },
    onError: (error: any) => {
      toast({
        title: t('flowTemplates.toast.createFailed'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCloneTemplate = (template: FlowTemplate) => {
    setSelectedTemplate(template);
    setFlowName(template.name);
    setCloneDialogOpen(true);
  };

  const handleCloseClone = () => {
    setCloneDialogOpen(false);
    setSelectedTemplate(null);
    setFlowName("");
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">{t('flowTemplates.loadingTemplates')}</div>
        </div>
      </div>
    );
  }

  const totalTemplates = templates.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center">
            <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground" data-testid="text-page-title">
              {t('flowTemplates.title')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('flowTemplates.subtitle')}
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="text-xs">
          {totalTemplates} {t('flowTemplates.availableTemplates')}
        </Badge>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-xl bg-card border p-12 flex flex-col items-center justify-center">
          <GitBranch className="h-10 w-10 text-muted-foreground mb-3" />
          <h3 className="text-base font-medium mb-1">{t('flowTemplates.noTemplates')}</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            {t('flowTemplates.noTemplatesDesc')}
          </p>
        </div>
      ) : (
        <div className="rounded-xl bg-card border">
          {templates.map((template, index) => (
            <div
              key={template.id}
              className={`flex items-center gap-4 p-4 hover-elevate ${index > 0 ? "border-t" : ""}`}
              data-testid={`card-template-${template.id}`}
            >
              <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                <GitBranch className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm" data-testid={`text-template-name-${template.id}`}>
                  {template.name}
                </div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  {template.description}
                </div>
              </div>
              <Badge variant="secondary" className="text-xs shrink-0">
                {t('flowTemplates.nodesCount', { count: template.nodeCount })}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCloneTemplate(template)}
                data-testid={`button-use-template-${template.id}`}
              >
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                {t('flowTemplates.useThisTemplate')}
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid="text-clone-dialog-title">{t('flowTemplates.createFromTemplate')}</DialogTitle>
            <DialogDescription>
              {selectedTemplate?.name} - {selectedTemplate?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="flow-name">{t('flowTemplates.flowNameRequired')}</Label>
              <Input
                id="flow-name"
                placeholder={t('flowTemplates.flowNamePlaceholder')}
                value={flowName}
                onChange={(e) => setFlowName(e.target.value)}
                data-testid="input-flow-name"
              />
              <p className="text-xs text-muted-foreground">
                {t('flowTemplates.customizeAfterCreation')}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseClone} data-testid="button-cancel-clone">
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => cloneMutation.mutate()}
              disabled={!flowName || cloneMutation.isPending}
              data-testid="button-submit-clone"
            >
              {t('flowTemplates.createFlow')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
