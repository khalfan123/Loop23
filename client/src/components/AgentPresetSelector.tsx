import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot,
  Shield,
  Headphones,
  HeartPulse,
  TrendingUp,
  Users,
  Building2,
  Briefcase,
  GraduationCap,
  Banknote,
  Truck,
  Utensils,
  Sparkles,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  bot: Bot,
  shield: Shield,
  headphones: Headphones,
  "heart-pulse": HeartPulse,
  "trending-up": TrendingUp,
  users: Users,
  "building-2": Building2,
  briefcase: Briefcase,
  "graduation-cap": GraduationCap,
  banknote: Banknote,
  truck: Truck,
  utensils: Utensils,
  sparkles: Sparkles,
};

function getIcon(iconName: string): LucideIcon {
  return iconMap[iconName] || Bot;
}

const industryColors: Record<string, string> = {
  insurance: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  it_support: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  healthcare: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  sales: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  customer_service: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  real_estate: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  finance: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  education: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  logistics: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  hospitality: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
};

function getIndustryColor(industry: string): string {
  return industryColors[industry] || "bg-muted text-muted-foreground";
}

function formatIndustryLabel(industry: string): string {
  return industry
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

interface AgentPreset {
  id: string;
  name: string;
  industry: string;
  description: string;
  iconName: string;
  systemPrompt: string;
  task: string;
  firstMessage: string | null;
  claimSchema: any;
  languageConfig: any;
  behaviorRules: any;
  waitingMessages: string[] | null;
  suggestedVoice: string | null;
  suggestedModel: string | null;
  suggestedTemperature: number | null;
  isActive: boolean;
  sortOrder: number;
}

interface AgentPresetSelectorProps {
  onSelect: (preset: AgentPreset) => void;
  onSkip: () => void;
}

export default function AgentPresetSelector({ onSelect, onSkip }: AgentPresetSelectorProps) {
  const { data: presets = [], isLoading } = useQuery<AgentPreset[]>({
    queryKey: ["/api/agent-presets"],
  });

  const groupedPresets = useMemo(() => {
    const groups: Record<string, AgentPreset[]> = {};
    for (const preset of presets) {
      if (!groups[preset.industry]) {
        groups[preset.industry] = [];
      }
      groups[preset.industry].push(preset);
    }
    return groups;
  }, [presets]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold">Choose a Preset</h3>
          <p className="text-sm text-muted-foreground">
            Start with an industry-optimized configuration
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="p-4 rounded-xl border space-y-3">
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-5 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const industries = Object.keys(groupedPresets);

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold">Choose a Preset</h3>
        <p className="text-sm text-muted-foreground">
          Start with an industry-optimized configuration or build from scratch
        </p>
      </div>

      {industries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="h-12 w-12 rounded-full bg-muted/30 flex items-center justify-center mb-3">
            <Sparkles className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            No presets available yet
          </p>
        </div>
      ) : (
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-5 pr-2">
            {industries.map((industry) => (
              <div key={industry}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className={`text-xs ${getIndustryColor(industry)}`}>
                    {formatIndustryLabel(industry)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {groupedPresets[industry].length} preset{groupedPresets[industry].length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {groupedPresets[industry].map((preset) => {
                    const Icon = getIcon(preset.iconName);
                    return (
                      <Card
                        key={preset.id}
                        className="cursor-pointer hover-elevate transition-all duration-200 border"
                        onClick={() => onSelect(preset)}
                        data-testid={`card-preset-${preset.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Icon className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-semibold truncate" data-testid={`text-preset-name-${preset.id}`}>
                                {preset.name}
                              </h4>
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                {preset.description}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <div className="pt-2 border-t">
        <Button
          variant="ghost"
          className="w-full justify-center gap-2"
          onClick={onSkip}
          data-testid="button-skip-presets"
        >
          <Sparkles className="h-4 w-4" />
          Skip - Start from scratch
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
