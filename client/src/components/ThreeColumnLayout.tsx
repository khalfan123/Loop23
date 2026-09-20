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
  contentClassName?: string;
  /** Extra class on the scrollable main content padding wrapper */
  mainClassName?: string;
}

export function ThreeColumnLayout({
  children,
  subPanel,
  subPanelWidth = "md",
  subPanelHeader,
  className,
  contentClassName,
  mainClassName,
}: ThreeColumnLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const subPanelWidthClass = {
    sm: "w-[208px]",
    md: "w-72",
    lg: "w-80",
  };

  return (
    <div
      className={cn(
        "flex w-[calc(100%+2rem)] md:w-[calc(100%+4rem)] lg:w-[calc(100%+6rem)] -mx-4 md:-mx-8 lg:-mx-12 -my-4 md:-my-6",
        className,
      )}
      style={{ height: "calc(100vh - var(--l9-topbar-height))", minHeight: "calc(100vh - var(--l9-topbar-height))" }}
    >
      {subPanel && (
        <>
          <aside
            className={cn(
              "hidden md:flex flex-col flex-shrink-0 bg-[var(--l9-surface)] border-r border-[var(--l9-border)] h-full",
              subPanelWidthClass[subPanelWidth],
            )}
          >
            {subPanelHeader && (
              <div className="px-4 pt-5 pb-2">
                <h2 className="text-[17px] font-bold tracking-[-0.02em] text-[var(--l9-text)] px-1">
                  {subPanelHeader}
                </h2>
              </div>
            )}
            <div className="flex-1 overflow-auto scrollbar-none px-3 py-2">
              {subPanel}
            </div>
          </aside>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" className="w-72 p-0 bg-[var(--l9-surface)]">
              <SheetHeader className="px-5 py-4 border-b border-[var(--l9-border)]">
                <SheetTitle className="text-[17px] font-bold tracking-tight text-[var(--l9-text)]">
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

      <div
        className={cn(
          "flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[var(--l9-bg-page)]",
          contentClassName,
        )}
      >
        {subPanel && (
          <div className="md:hidden flex items-center gap-2 px-4 pt-3">
            <Button
              size="icon"
              variant="outline"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              data-testid="button-mobile-menu-toggle"
              className="rounded-[10px] border-[var(--l9-border-control)]"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
            {subPanelHeader && (
              <span className="text-sm font-medium text-[var(--l9-text)]">
                {subPanelHeader}
              </span>
            )}
          </div>
        )}
        <div className={cn("flex-1 overflow-auto px-[30px] pt-[26px] pb-[34px]", mainClassName)}>
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
    <div className={cn("mb-1", className)}>
      {title && <div className="l9-grp !pt-2">{title}</div>}
      <div>{children}</div>
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
      data-active={isActive ? "true" : undefined}
      className={cn(
        "w-full flex items-center gap-2.5 px-[11px] py-[9px] rounded-[9px] text-[13.5px] text-left transition-colors duration-150",
        isActive
          ? "bg-[var(--l9-primary-tint)] text-[var(--l9-primary)] font-semibold"
          : "text-[var(--l9-text-secondary)] hover:bg-[var(--l9-hover)]",
        className,
      )}
    >
      {icon && (
        <span
          className={cn(
            "flex-shrink-0 w-[17px] h-[17px] flex items-center justify-center",
            isActive ? "text-[var(--l9-primary)]" : "text-[var(--l9-text-faint)]",
          )}
        >
          {icon}
        </span>
      )}
      <span className="flex-1 truncate">{label}</span>
      {badge && (
        <span className="text-[12px] text-[var(--l9-text-muted)] font-medium">{badge}</span>
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
    <div className={cn("grid gap-[18px]", columnClass[columns], className)}>
      {children}
    </div>
  );
}
