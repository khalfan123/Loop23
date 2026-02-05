import { cn } from "@/lib/utils";

/**
 * ThreeColumnLayout - iOS 18 inspired 3-column page layout.
 * 
 * Features minimal design with:
 * - Clean white sub-panel with subtle borders
 * - Soft gray content area background
 * - Refined typography and spacing
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
    sm: "w-60",
    md: "w-72",
    lg: "w-80",
  };

  return (
    <div className={cn("flex h-full w-full", className)}>
      {/* Left Sub-Panel - iOS 18 style clean white panel */}
      {subPanel && (
        <aside
          className={cn(
            "hidden lg:flex flex-col flex-shrink-0 border-r border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-zinc-900",
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
      )}
      
      {/* Main Content Area - iOS 18 soft gray background */}
      <div className="flex-1 min-w-0 overflow-auto bg-zinc-50/80 dark:bg-zinc-950/50">
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * SubPanelSection - iOS 18 style section with refined typography
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
    <div className={cn("mb-5", className)}>
      {title && (
        <h3 className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide px-3 mb-1.5">
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
 * SubPanelItem - iOS 18 style navigation item
 * Features soft blue selection, rounded corners, smooth transitions
 */
interface SubPanelItemProps {
  icon?: React.ReactNode;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
  badge?: React.ReactNode | string | number;
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
        "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] text-left transition-all duration-150 hover-elevate active-elevate-2",
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
