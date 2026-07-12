import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Clock,
  ArrowRight,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {
  CALL_CENTER_STARTER_PACK,
  STARTER_PACK_BY_OUTCOME,
  OUTCOME_META,
  type StarterOutcome,
  type StarterTemplate,
} from "@/data/automation-starter-pack";

const OUTCOME_ORDER: StarterOutcome[] = [
  "recover",
  "convert",
  "comply",
  "coach",
  "notify",
];

export default function AutomationOverview() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeOutcome, setActiveOutcome] = useState<StarterOutcome | "all">(
    "all",
  );
  const [installingId, setInstallingId] = useState<string | null>(null);

  const visibleTemplates = useMemo(() => {
    if (activeOutcome === "all") return CALL_CENTER_STARTER_PACK;
    return STARTER_PACK_BY_OUTCOME[activeOutcome] || [];
  }, [activeOutcome]);

  const installMutation = useMutation({
    mutationFn: async (template: StarterTemplate) => {
      setInstallingId(template.id);
      const chat = await apiRequest("POST", "/api/integrations/concierge/chat", {
        message: template.prompt,
        context: { source: "starter-pack", templateId: template.id },
      });
      const chatJson = await chat.json();

      if (chatJson?.type !== "recipe" || !chatJson.recipe) {
        throw new Error(
          chatJson?.message ||
            t(
              "automation.starterPack.toast.needsCreds",
              "This template needs a few credentials. Opening the marketplace…",
            ),
        );
      }

      const res = await apiRequest(
        "POST",
        "/api/integrations/concierge/provision",
        { recipe: chatJson.recipe, inputs: {} },
      );
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connected"] });
      toast({
        title: t("automation.starterPack.toast.installed", "Automation installed"),
      });
      setInstallingId(null);
    },
    onError: (err: any, template) => {
      toast({
        title: t("automation.starterPack.toast.opening", "Opening marketplace"),
        description: err?.message || "",
      });
      setInstallingId(null);
      navigate(
        `/app/settings/automation/marketplace?template=${encodeURIComponent(
          template.id,
        )}`,
      );
    },
  });

  return (
    <div className="px-6 py-6 space-y-8 max-w-[1400px] mx-auto">
      <section>
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">
                {t(
                  "automation.starterPack.title",
                  "AI Call Center starter pack",
                )}
              </h2>
              <Badge variant="secondary" className="text-[10px] uppercase">
                {t("automation.starterPack.curated", "Curated")}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              {t(
                "automation.starterPack.subtitle",
                "Battle-tested workflows for real call-center jobs — recover missed calls, convert hot leads, stay compliant, and keep humans in the loop. One click to install.",
              )}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/app/settings/automation/marketplace")}
            data-testid="button-open-full-marketplace"
          >
            {t("automation.starterPack.browseAll", "Browse all templates")}
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            size="sm"
            variant={activeOutcome === "all" ? "default" : "outline"}
            className="h-8"
            onClick={() => setActiveOutcome("all")}
            data-testid="filter-outcome-all"
          >
            {t("common.all", "All")}
            <span className="ml-2 text-[11px] text-muted-foreground">
              {CALL_CENTER_STARTER_PACK.length}
            </span>
          </Button>
          {OUTCOME_ORDER.map((o) => (
            <Button
              key={o}
              size="sm"
              variant={activeOutcome === o ? "default" : "outline"}
              className="h-8"
              onClick={() => setActiveOutcome(o)}
              data-testid={`filter-outcome-${o}`}
            >
              <span className={activeOutcome === o ? undefined : OUTCOME_META[o].tone}>
                {OUTCOME_META[o].label}
              </span>
              <span className="ml-2 text-[11px] text-muted-foreground">
                {STARTER_PACK_BY_OUTCOME[o]?.length || 0}
              </span>
            </Button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleTemplates.map((tpl) => (
            <StarterCard
              key={tpl.id}
              template={tpl}
              installing={installingId === tpl.id}
              onInstall={() => installMutation.mutate(tpl)}
              onPreview={() =>
                navigate(
                  `/app/settings/automation/marketplace?template=${encodeURIComponent(
                    tpl.id,
                  )}`,
                )
              }
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function StarterCard({
  template,
  installing,
  onInstall,
  onPreview,
}: {
  template: StarterTemplate;
  installing: boolean;
  onInstall: () => void;
  onPreview: () => void;
}) {
  const { t } = useTranslation();
  const meta = OUTCOME_META[template.outcome];
  return (
    <Card
      className="rounded-xl border-border/50 bg-card/60 hover:border-border/80 transition-colors flex flex-col"
      data-testid={`starter-card-${template.id}`}
    >
      <CardContent className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className={`text-[11px] ${meta.tone}`}>
            {meta.label}
          </Badge>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3" />
            {t("automation.starterPack.verified", "Verified")}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold leading-snug">{template.title}</h3>
          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-3">
            {template.summary}
          </p>
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-auto pt-2 border-t border-border/40">
          <span className="tabular-nums">
            {template.installCount.toLocaleString()}{" "}
            {t("automation.starterPack.installs", "installs")}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {template.setupMinutes}{" "}
            {t("automation.starterPack.minSetup", "min setup")}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="flex-1 h-8"
            disabled={installing}
            onClick={onInstall}
            data-testid={`install-${template.id}`}
          >
            {installing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                {t("automation.starterPack.installing", "Installing")}
              </>
            ) : (
              t("automation.starterPack.install", "Install")
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={onPreview}
            data-testid={`preview-${template.id}`}
          >
            {t("automation.starterPack.preview", "Preview")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
