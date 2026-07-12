/**
 * Hybrid Navigation — Loop9 AURA Command shell
 * Top bar 64px + left nav 236px with SETUP / MANAGE groups
 */
import { useState, useEffect, createContext, useContext } from "react";
import {
  Settings, LogOut, Coins, Menu, ChevronDown, CreditCard,
  BarChart3, Phone, Radio, PhoneIncoming, BookOpen, Cpu, Mic, Zap,
  type LucideIcon,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { SidebarBrand } from "@/components/SidebarBrand";
import { AuthStorage } from "@/lib/auth-storage";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import { NotificationBell } from "@/components/NotificationBell";
import { HeaderBannerNotifications } from "@/components/HeaderBannerNotifications";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "@/components/GlobalSearch";
import { PhoneNumberDropdown } from "@/components/PhoneNumberDropdown";

interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
  credits?: number;
  planType?: string;
}

interface NavItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  badge?: number;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

interface SidebarContextType {
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | null>(null);

export function useSidebarState() {
  const context = useContext(SidebarContext);
  if (!context) throw new Error("useSidebarState must be used within HybridNavigation");
  return context;
}

interface HybridNavigationProps {
  variant?: "user" | "team";
  showNotifications?: boolean;
  children: React.ReactNode;
}

export function HybridNavigation({
  variant: _variant = "user",
  showNotifications = true,
  children,
}: HybridNavigationProps) {
  const [location, setLocation] = useLocation();
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebar-expanded");
      return saved !== null ? saved === "true" : true;
    }
    return true;
  });

  useEffect(() => {
    localStorage.setItem("sidebar-expanded", String(isExpanded));
  }, [isExpanded]);

  const topItems: NavItem[] = [
    { title: t("nav.dashboard", "Dashboard"), url: "/app/analytics", icon: BarChart3 },
    { title: t("nav.live", "Live"), url: "/app/live", icon: Radio },
  ];

  const setupItems: NavItem[] = [
    { title: t("nav.phoneNumbers"), url: "/app/phone-numbers", icon: Phone },
    { title: t("nav.knowledgeBase"), url: "/app/knowledge-base", icon: BookOpen },
    { title: t("nav.inbound", "Inbound"), url: "/app/deprock", icon: PhoneIncoming },
    { title: "Automation", url: "/app/settings/automation", icon: Zap },
  ];

  const manageItems: NavItem[] = [
    { title: t("nav.operations", "Operations"), url: "/app/ops", icon: Cpu },
    { title: t("nav.voices", "Voices"), url: "/app/voices", icon: Mic },
    { title: t("nav.billing", "Billing"), url: "/app/billing", icon: CreditCard },
    { title: t("nav.settings", "Settings"), url: "/app/settings", icon: Settings },
  ];

  const navSections: NavSection[] = [
    { label: "SETUP", items: setupItems },
    { label: "MANAGE", items: manageItems },
  ];

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  if (userLoading || !user) {
    return (
      <div className="flex h-screen w-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  const userName = user.name || "User";
  const userInitial = userName.charAt(0).toUpperCase() || "U";
  const userEmail = user.email || "";
  const isPaidPlan = user.planType && user.planType !== "free";
  const planDisplayName = user.planType
    ? user.planType.charAt(0).toUpperCase() + user.planType.slice(1)
    : "Free";
  const remainingCredits = user.credits || 0;

  const handleLogout = () => {
    fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
    AuthStorage.clearAuth();
    window.location.href = "/";
  };

  const isActive = (url: string) => {
    if (url === "/app") {
      return location === url || location === url + "/dashboard";
    }
    if (url === "/app/settings") {
      return (
        location === url ||
        (location.startsWith(url + "/") &&
          !location.startsWith("/app/settings/flows/appointments") &&
          !location.startsWith("/app/settings/webhooks") &&
          !location.startsWith("/app/settings/automation"))
      );
    }
    if (url === "/app/settings/automation") {
      return (
        location === url ||
        location.startsWith(url + "/") ||
        location === "/app/settings/webhooks" ||
        location.startsWith("/app/settings/webhooks/")
      );
    }
    return location === url || location.startsWith(url + "/");
  };

  const NavItemComponent = ({ item, showLabel }: { item: NavItem; showLabel: boolean }) => {
    const active = isActive(item.url);
    const IconComponent = item.icon;

    return (
      <Link
        href={item.url}
        onClick={() => setMobileMenuOpen(false)}
        data-active={active ? "true" : undefined}
        className={cn(
          "flex items-center gap-[11px] px-3 py-[9px] rounded-[9px] transition-colors duration-150 text-[14px]",
          active
            ? "bg-[var(--l9-primary-tint)] text-[var(--l9-primary)] font-semibold"
            : "text-[var(--l9-text-secondary)] hover:bg-[var(--l9-hover)] hover:text-[var(--l9-text)]",
          !showLabel && "justify-center px-2",
        )}
        data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
      >
        {IconComponent && (
          <IconComponent
            className={cn(
              "h-[18px] w-[18px] flex-shrink-0",
              active ? "text-[var(--l9-primary)]" : "text-[var(--l9-text-faint)]",
            )}
          />
        )}
        {showLabel && <span className="truncate flex-1">{item.title}</span>}
        {item.badge !== undefined && item.badge > 0 && showLabel && (
          <span
            className={cn(
              "ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-semibold min-w-[18px] text-center",
              active
                ? "bg-[var(--l9-primary)]/15 text-[var(--l9-primary)]"
                : "bg-[var(--l9-hover)] text-[var(--l9-text-muted)]",
            )}
          >
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  const NavBody = ({ expanded }: { expanded: boolean }) => (
    <>
      <div className="space-y-0.5">
        {topItems.map((item) => (
          <NavItemComponent key={item.url} item={item} showLabel={expanded} />
        ))}
      </div>
      {navSections.map((section) => (
        <div key={section.label}>
          {expanded && <div className="l9-grp">{section.label}</div>}
          {!expanded && <div className="h-3" />}
          <div className="space-y-0.5">
            {section.items.map((item) => (
              <NavItemComponent key={item.url} item={item} showLabel={expanded} />
            ))}
          </div>
        </div>
      ))}
    </>
  );

  const CreditsCard = ({ expanded }: { expanded: boolean }) => (
    <div
      className={cn(
        "flex items-center gap-2.5 border border-[var(--l9-border)] rounded-xl",
        expanded ? "px-[13px] py-[11px]" : "justify-center p-2",
      )}
    >
      <Coins className="h-[17px] w-[17px] text-[var(--l9-text-faint)] flex-shrink-0" />
      {expanded && (
        <>
          <span className="text-[12.5px] text-[var(--l9-text-muted)]">{t("sidebar.credits")}</span>
          <span className="flex-1 text-right text-[14px] font-bold tabular-nums text-[var(--l9-text)]">
            {remainingCredits.toLocaleString()}
          </span>
          {isPaidPlan && (
            <span className="text-[11px] font-semibold text-[var(--l9-primary)] bg-[var(--l9-primary-tint)] px-[7px] py-0.5 rounded-md">
              {planDisplayName}
            </span>
          )}
        </>
      )}
    </div>
  );

  const AccountFooter = ({ expanded }: { expanded: boolean }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center w-full rounded-[9px] transition-colors hover:bg-[var(--l9-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            expanded ? "gap-2.5 px-0.5 py-1" : "justify-center p-1",
          )}
          data-testid="button-user-menu-sidebar"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-[#E7ECF5] text-[var(--l9-text-secondary)] text-xs font-semibold">
              {userInitial}
            </AvatarFallback>
          </Avatar>
          {expanded && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-[13px] font-semibold text-[var(--l9-text)] truncate">{userName}</div>
                <div className="text-[11.5px] text-[var(--l9-text-faint)] truncate">{userEmail}</div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-[var(--l9-text-faint)]" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-60 rounded-xl p-2 border-[var(--l9-border-card)]">
        <div className="px-3 py-2.5 mb-1">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-[#E7ECF5] text-[var(--l9-text-secondary)] font-semibold">
                {userInitial}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{userName}</div>
              <div className="text-xs text-muted-foreground truncate">{userEmail}</div>
            </div>
          </div>
        </div>
        <DropdownMenuSeparator />
        <div className="p-1">
          <DropdownMenuItem
            onClick={() => setLocation("/app/settings")}
            className="rounded-lg py-2 px-3 cursor-pointer"
            data-testid="link-account-settings"
          >
            <Settings className="mr-2.5 h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{t("nav.settings", "Settings")}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleLogout}
            className="rounded-lg py-2 px-3 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
            data-testid="button-logout"
          >
            <LogOut className="mr-2.5 h-4 w-4" />
            <span className="text-sm">{t("auth.logout")}</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const DesktopSidebar = () => (
    <aside
      className={cn(
        "hidden lg:flex flex-col h-full bg-[var(--l9-surface)] border-r border-[var(--l9-border)] transition-[width] duration-200",
        isExpanded ? "w-[236px]" : "w-14",
      )}
    >
      <div className="flex-1 min-h-0 px-3 pt-4 overflow-y-auto">
        <NavBody expanded={isExpanded} />
      </div>
      <div className="flex-shrink-0 px-3 pb-3 pt-2 space-y-3">
        <CreditsCard expanded={isExpanded} />
        <AccountFooter expanded={isExpanded} />
      </div>
    </aside>
  );

  const MobileSidebar = () => (
    <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
      <SheetContent side="left" className="w-[280px] p-0 border-r border-[var(--l9-border)] flex flex-col bg-[var(--l9-surface)]">
        <SheetHeader className="px-4 py-4 flex-shrink-0 border-b border-[var(--l9-border)]">
          <SheetTitle className="text-left sr-only">{t("sidebar.navigation") || "Menu"}</SheetTitle>
          <SidebarBrand size="lg" />
        </SheetHeader>
        <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
          <NavBody expanded />
        </div>
        <div className="flex-shrink-0 p-3 border-t border-[var(--l9-border)] space-y-3">
          <CreditsCard expanded />
          <Button
            variant="ghost"
            className="w-full justify-start gap-2.5 text-destructive rounded-lg"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            <span className="text-sm">{t("auth.logout")}</span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <SidebarContext.Provider value={{ isExpanded, setIsExpanded }}>
      <div className="flex flex-col h-screen w-full overflow-hidden bg-[var(--l9-surface)]">
        {/* Top bar — 64px */}
        <header
          className="sticky top-0 z-40 flex h-16 items-center border-b border-[var(--l9-border)] bg-[var(--l9-surface)] flex-shrink-0"
          data-testid="app-topbar"
        >
          {/* Brand — matches nav width on desktop */}
          <div
            className={cn(
              "hidden lg:flex items-center flex-shrink-0 h-full px-5",
              isExpanded ? "w-[236px]" : "w-14 justify-center px-2",
            )}
          >
            <SidebarBrand collapsed={!isExpanded} size="lg" />
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden ml-2 rounded-[10px] h-[38px] w-[38px]"
            onClick={() => setMobileMenuOpen(true)}
            data-testid="button-mobile-menu"
          >
            <Menu className="h-5 w-5 text-[var(--l9-text-muted)]" />
          </Button>

          <div className="lg:hidden pl-2">
            <SidebarBrand collapsed size="md" />
          </div>

          <div className="ml-2 flex-shrink-0">
            <PhoneNumberDropdown />
          </div>

          <div className="flex-1 flex justify-center px-4 min-w-0">
            <GlobalSearch />
          </div>

          <div className="flex items-center gap-2.5 pr-5 flex-shrink-0">
            {showNotifications && <HeaderBannerNotifications />}
            <div className="h-[38px] w-[38px] rounded-[10px] flex items-center justify-center hover:bg-[var(--l9-hover)] transition-colors">
              <ThemeToggle />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-[7px] pl-1 pr-1.5 py-1 border border-[var(--l9-border-control)] rounded-[20px] hover:bg-[var(--l9-hover)] transition-colors"
                  data-testid="button-user-menu"
                >
                  <Avatar className="h-[30px] w-[30px]">
                    <AvatarFallback className="bg-[#E7ECF5] text-[var(--l9-text-secondary)] text-[13px] font-semibold">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className="h-[13px] w-[13px] text-[var(--l9-text-faint)] hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 rounded-xl p-2 border-[var(--l9-border-card)]">
                <div className="px-3 py-3 mb-1">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-[#E7ECF5] text-[var(--l9-text-secondary)] font-semibold">
                        {userInitial}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{userName}</p>
                      <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                    </div>
                  </div>
                </div>
                <div className="px-2 pb-2">
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-[var(--l9-border)]">
                    <div className="flex items-center gap-2">
                      <Coins className="h-4 w-4 text-[var(--l9-text-faint)]" />
                      <span className="text-xs text-[var(--l9-text-muted)]">{t("sidebar.credits")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums">{remainingCredits.toLocaleString()}</span>
                      {isPaidPlan && (
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--l9-primary-tint)] text-[var(--l9-primary)]">
                          {planDisplayName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="px-2 pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <LanguageSelector variant="compact" />
                    {showNotifications && <NotificationBell />}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <div className="p-1">
                  <DropdownMenuItem
                    onClick={() => setLocation("/app/settings")}
                    className="rounded-lg cursor-pointer py-2 px-3"
                  >
                    <Settings className="mr-2.5 h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{t("nav.settings", "Settings")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="rounded-lg cursor-pointer py-2 px-3 text-destructive focus:text-destructive focus:bg-destructive/10"
                  >
                    <LogOut className="mr-2.5 h-4 w-4" />
                    <span className="text-sm">{t("auth.logout")}</span>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="flex flex-1 min-h-0">
          <DesktopSidebar />
          <MobileSidebar />
          <main className="flex-1 overflow-auto bg-[var(--l9-bg-page)]">{children}</main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}

export function UserHybridNavigation({ children }: { children: React.ReactNode }) {
  return (
    <HybridNavigation variant="user" showNotifications>
      {children}
    </HybridNavigation>
  );
}

export function TeamHybridNavigation({ children }: { children: React.ReactNode }) {
  return (
    <HybridNavigation variant="team" showNotifications={false}>
      {children}
    </HybridNavigation>
  );
}
