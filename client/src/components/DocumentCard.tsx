import { cn } from "@/lib/utils";

interface DocumentCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
}

export function DocumentCard({
  children,
  className,
  onClick,
  hover = false,
}: DocumentCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white dark:bg-card rounded-lg border border-border/50 shadow-sm",
        hover && "cursor-pointer transition-shadow hover:shadow-md",
        onClick && "cursor-pointer",
        className
      )}
      data-testid="document-card"
    >
      {children}
    </div>
  );
}

interface DocumentCardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function DocumentCardHeader({
  children,
  className,
}: DocumentCardHeaderProps) {
  return (
    <div className={cn("px-4 py-3 border-b border-border/30", className)}>
      {children}
    </div>
  );
}

interface DocumentCardContentProps {
  children: React.ReactNode;
  className?: string;
}

export function DocumentCardContent({
  children,
  className,
}: DocumentCardContentProps) {
  return <div className={cn("p-4", className)}>{children}</div>;
}

interface DocumentCardTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function DocumentCardTitle({
  children,
  className,
}: DocumentCardTitleProps) {
  return (
    <h3 className={cn("text-sm font-medium text-foreground", className)}>
      {children}
    </h3>
  );
}

interface DocumentCardDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function DocumentCardDescription({
  children,
  className,
}: DocumentCardDescriptionProps) {
  return (
    <p className={cn("text-xs text-muted-foreground mt-1", className)}>
      {children}
    </p>
  );
}

interface DocumentCardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function DocumentCardFooter({
  children,
  className,
}: DocumentCardFooterProps) {
  return (
    <div className={cn("px-4 py-3 border-t border-border/30 bg-muted/30", className)}>
      {children}
    </div>
  );
}
