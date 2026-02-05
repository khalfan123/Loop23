import { cn } from "@/lib/utils";

/**
 * ThreeColumnLayout - Creates the center and right columns of a 3-column page layout.
 * 
 * This component is designed to work with the existing sidebar (AppSidebar/HybridNavigation)
 * which provides the left column. Together they form a 3-column layout:
 * - Left sidebar (from HybridNavigation wrapper)
 * - Center content area (children prop)
 * - Right panel (optional, for contextual info like stats, actions, details)
 * 
 * Usage: Wrap page content in ThreeColumnLayout within pages that are already
 * rendered inside the HybridNavigation/UserRouter structure.
 */
interface ThreeColumnLayoutProps {
  children: React.ReactNode;
  rightPanel?: React.ReactNode;
  rightPanelWidth?: "sm" | "md" | "lg";
  className?: string;
}

export function ThreeColumnLayout({
  children,
  rightPanel,
  rightPanelWidth = "md",
  className,
}: ThreeColumnLayoutProps) {
  const rightPanelWidthClass = {
    sm: "w-64",
    md: "w-80",
    lg: "w-96",
  };

  return (
    <div className={cn("flex h-full w-full gap-6", className)}>
      <div className="flex-1 min-w-0 overflow-auto">
        {children}
      </div>
      
      {rightPanel && (
        <aside
          className={cn(
            "hidden xl:block flex-shrink-0 overflow-auto",
            rightPanelWidthClass[rightPanelWidth]
          )}
        >
          <div className="sticky top-0 space-y-4">
            {rightPanel}
          </div>
        </aside>
      )}
    </div>
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
