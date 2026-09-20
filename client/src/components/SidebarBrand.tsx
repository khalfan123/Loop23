import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useBranding } from "@/components/BrandingProvider";

type SidebarBrandProps = {
  collapsed?: boolean;
  className?: string;
  href?: string;
  /** Larger lockup for the main app sidebar / top bar */
  size?: "md" | "lg";
};

/**
 * Brand lockup: Loop9 icon + "Loop9" wordmark + tagline.
 * Matches AURA Command top-bar: 38×38 rounded (11px) mark.
 */
export function SidebarBrand({
  collapsed = false,
  className,
  href = "/app",
  size = "lg",
}: SidebarBrandProps) {
  const { branding } = useBranding();
  const iconSrc = branding.favicon_url || branding.logo_url_dark || "/images/loop9-icon.png";
  const name = branding.app_name || "Loop9";
  const tagline = branding.app_tagline || "AI call center";
  const iconPx = size === "lg" ? "h-[38px] w-[38px]" : "h-9 w-9";

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center min-w-0 rounded-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
        collapsed ? "justify-center" : "gap-[11px]",
        className,
      )}
      data-testid="link-logo-sidebar"
      title={name}
    >
      <img
        src={iconSrc}
        alt=""
        className={cn(
          iconPx,
          "flex-shrink-0 object-contain rounded-[11px]",
        )}
        style={{ boxShadow: "var(--l9-shadow-logo)" }}
      />
      {!collapsed && (
        <div className="min-w-0 flex flex-col justify-center leading-none">
          <span
            className={cn(
              "font-bold tracking-[-0.02em] text-[var(--l9-text)] truncate",
              size === "lg" ? "text-[18px]" : "text-[16px]",
            )}
          >
            {name}
          </span>
          {tagline ? (
            <span className="text-[11.5px] text-[var(--l9-text-faint)] truncate mt-[3px]">
              {tagline}
            </span>
          ) : null}
        </div>
      )}
    </Link>
  );
}
