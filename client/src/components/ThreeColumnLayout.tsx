import { useState } from "react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { PanelLeft } from "lucide-react";

interface ThreeColumnLayoutProps {
  children: React.ReactNode;
  subPanel?: React.ReactNode;
  subPanelWidth?: "sm" | "md" | "lg";
  subPanelHeader?: React.ReactNode;
  className?: string;
}

export function ThreeColumnLayout({
  children,
  subPanel,
  subPanelWidth = "md",
  subPanelHeader,
  className,
}: ThreeColumnLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const subPanelWidthClass = {
    sm: "w-60",
    md: "w-72",
    lg: "w-80",
  };

  return (
    <div className={cn("flex w-[calc(100%+2rem)] md:w-[calc(100%+4rem)] lg:w-[calc(100%+6rem)] -mx-4 md:-mx-8 lg:-mx-12 -my-4 md:-my-6", className)} style={{ height: 'calc(100vh - 48px)', minHeight: 'calc(100vh - 48px)' }}>
      {subPanel && (
        <>
          <aside
            className={cn(
              "hidden lg:flex flex-col flex-shrink-0 border-r border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-zinc-900 h-full",
              subPanelWidthClass[subPanelWidth]
            )}
          >
            {subPanelHeader && (
              <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.08]">
                <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
                  {subPanelHeader}
                </h2>
              </div>
            )}
            <div className="flex-1 overflow-auto px-3 py-3">
              {subPanel}
            </div>
          </aside>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.08]">
                <SheetTitle className="text-[15px] font-semibold tracking-tight">
                  {subPanelHeader || "Menu"}
                </SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-auto px-3 py-3" onClick={() => setMobileOpen(false)}>
                {subPanel}
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}
      
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-zinc-50/80 dark:bg-zinc-950/50">
        {subPanel && (
          <div className="lg:hidden flex items-center gap-2 px-4 pt-3">
            <Button
              size="icon"
              variant="outline"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              data-testid="button-mobile-menu-toggle"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
            {subPanelHeader && (
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {subPanelHeader}
              </span>
            )}
          </div>
        )}
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

interface SubPanelSectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function SubPanelSection({
  title,
  children,
  className,
}: SubPanelSectionProps) {
  return (
    <div className={cn("mb-3", className)}>
      {title && (
        <h3 className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide px-3 mb-1">
          {title}
        </h3>
      )}
      <div>
        {children}
      </div>
    </div>
  );
}

interface SubPanelItemProps {
  icon?: React.ReactNode;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
  badge?: React.ReactNode | string | number;
  className?: string;
  "data-testid"?: string;
}

export function SubPanelItem({
  icon,
  label,
  isActive,
  onClick,
  badge,
  className,
  "data-testid": dataTestId,
}: SubPanelItemProps) {
  return (
    <button
      onClick={onClick}
      data-testid={dataTestId}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] text-left transition-all duration-150 hover-elevate active-elevate-2",
        isActive 
          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium" 
          : "text-zinc-600 dark:text-zinc-400",
        className
      )}
    >
      {icon && (
        <span className={cn(
          "flex-shrink-0 w-4 h-4",
          isActive ? "text-blue-500" : "text-zinc-400 dark:text-zinc-500"
        )}>
          {icon}
        </span>
      )}
      <span className="flex-1 truncate">{label}</span>
      {badge && (
        <span className="text-[12px] text-zinc-400 dark:text-zinc-500 font-medium">
          {badge}
        </span>
      )}
    </button>
  );
}

interface ContentGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3;
  className?: string;
}

export function ContentGrid({
  children,
  columns = 3,
  className,
}: ContentGridProps) {
  const columnClass = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  };

  return (
    <div className={cn("grid gap-4", columnClass[columns], className)}>
      {children}
    </div>
  );
}
