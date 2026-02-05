import { cn } from "@/lib/utils";

/**
 * ThreeColumnLayout - Creates a 3-column page layout similar to Retell's design.
 * 
 * Structure (matching reference design):
 * - Left sidebar (from HybridNavigation wrapper - external to this component)
 * - Left sub-panel (for folders, filters, categories - optional)
 * - Main content area (primary content)
 * 
 * The sub-panel is a secondary navigation/filter area that appears
 * between the main sidebar and the content area.
 */
interface ThreeColumnLayoutProps {
  children: React.ReactNode;
  /** Left sub-panel for folders, filters, categories */
  subPanel?: React.ReactNode;
  /** Width of the sub-panel */
  subPanelWidth?: "sm" | "md" | "lg";
  /** Optional header for the sub-panel */
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
  const subPanelWidthClass = {
    sm: "w-56",
    md: "w-64",
    lg: "w-72",
  };

  return (
    <div className={cn("flex h-full w-full", className)}>
      {/* Left Sub-Panel - Folders/Filters */}
      {subPanel && (
        <aside
          className={cn(
            "hidden lg:flex flex-col flex-shrink-0 border-r border-border/40 bg-muted/20",
            subPanelWidthClass[subPanelWidth]
          )}
        >
          {subPanelHeader && (
            <div className="px-4 py-3 border-b border-border/40">
              {subPanelHeader}
            </div>
          )}
          <div className="flex-1 overflow-auto p-3">
            {subPanel}
          </div>
        </aside>
      )}
      
      {/* Main Content Area */}
      <div className="flex-1 min-w-0 overflow-auto bg-background">
        {children}
      </div>
    </div>
  );
}

/**
 * SubPanelSection - Section within the sub-panel (like FOLDERS, TRANSFER AGENTS)
 */
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
    <div className={cn("mb-4", className)}>
      {title && (
        <h3 className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider px-2 mb-2">
          {title}
        </h3>
      )}
      <div className="space-y-0.5">
        {children}
      </div>
    </div>
  );
}

/**
 * SubPanelItem - Individual item in the sub-panel
 * Uses hover-elevate utility for consistent interaction behavior
 */
interface SubPanelItemProps {
  icon?: React.ReactNode;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
  badge?: React.ReactNode;
  className?: string;
}

export function SubPanelItem({
  icon,
  label,
  isActive,
  onClick,
  badge,
  className,
}: SubPanelItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-left hover-elevate active-elevate-2",
        isActive 
          ? "bg-primary/10 text-primary font-medium" 
          : "text-foreground/70",
        className
      )}
    >
      {icon && <span className="flex-shrink-0 w-4 h-4">{icon}</span>}
      <span className="flex-1 truncate">{label}</span>
      {badge}
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
