/**
 * Hybrid Navigation System - iOS 18 Minimal Design
 * Clean, minimal sidebar with pill-shaped selections
 */
import { useState, useEffect, createContext, useContext } from "react";
import { 
  Settings, LogOut, Coins, Menu, ChevronDown,
  ChevronLeft, ChevronRight
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';
import { useBranding } from "@/components/BrandingProvider";
import { AuthStorage } from "@/lib/auth-storage";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import { NotificationBell } from "@/components/NotificationBell";
import { HeaderBannerNotifications } from "@/components/HeaderBannerNotifications";
import { cn } from "@/lib/utils";

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
  variant?: 'user' | 'admin' | 'team' | 'admin-team';
  showNotifications?: boolean;
  children: React.ReactNode;
}

export function HybridNavigation({ 
  variant = 'user', 
  showNotifications = true,
  children 
}: HybridNavigationProps) {
  const [location, setLocation] = useLocation();
  const { t } = useTranslation();
  const { branding, currentLogo } = useBranding();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar-expanded');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  useEffect(() => {
    localStorage.setItem('sidebar-expanded', String(isExpanded));
  }, [isExpanded]);

  const topItems: NavItem[] = [
    { title: t('nav.apps', 'Apps'), url: variant === 'admin' || variant === 'admin-team' ? "/admin" : "/app" },
    { title: t('nav.analytics'), url: "/app/analytics" },
    { title: t('nav.crm'), url: "/app/crm" },
    { title: t('nav.logs', 'Logs'), url: "/app/calls" },
  ];
  
  const returnToAppItem: NavItem = { 
    title: t('nav.returnToApp') || 'Return to App', 
    url: "/app"
  };

  const setupItems: NavItem[] = [
    { title: t('nav.phoneNumbers'), url: "/app/phone-numbers" },
    { title: t('nav.inboundCalls', 'Inbound Calls'), url: "/app/incoming-connections" },
    { title: t('nav.outboundCalls', 'Outbound Calls'), url: "/app/campaigns" },
    { title: t('nav.aiStaff', 'AI Staff'), url: "/app/agents" },
    { title: t('nav.knowledgeBase'), url: "/app/knowledge-base" },
  ];

  const manageItems: NavItem[] = [
    { title: t('nav.appointments'), url: "/app/flows/appointments" },
    { title: t('nav.forms'), url: "/app/flows/forms" },
  ];

  const settingsItems: NavItem[] = [
    { title: t('nav.settings', 'Settings'), url: "/app/settings" },
  ];

  const navSections: NavSection[] = variant === 'admin' || variant === 'admin-team' ? [] : [
    { label: t('sidebar.setup', 'Setup'), items: setupItems },
    { label: t('sidebar.manage', 'Manage'), items: manageItems },
    { label: '', items: settingsItems },
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
    fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
    AuthStorage.clearAuth();
    window.location.href = "/";
  };

  const isActive = (url: string) => {
    if (url === '/app' || url === '/admin') {
      return location === url || location === url + '/dashboard';
    }
    return location === url || location.startsWith(url + '/');
  };

  // iOS 18 style nav item
  const NavItemComponent = ({ item, showLabel }: { item: NavItem; showLabel: boolean }) => {
    const active = isActive(item.url);
    
    const content = (
      <Link
        href={item.url}
        onClick={() => setMobileMenuOpen(false)}
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all duration-200 text-[15px]",
          active 
            ? "bg-foreground/[0.08] text-foreground font-semibold" 
            : "text-foreground/60 hover:text-foreground hover:bg-foreground/[0.04]"
        )}
        data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <span className="truncate">{item.title}</span>
      </Link>
    );

    if (!showLabel) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Link
              href={item.url}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "flex items-center justify-center h-10 w-10 rounded-2xl transition-all duration-200",
                active 
                  ? "bg-foreground/[0.08] text-foreground" 
                  : "text-foreground/60 hover:text-foreground hover:bg-foreground/[0.04]"
              )}
              data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <span className="text-sm font-semibold">{item.title.charAt(0)}</span>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium rounded-xl">
            {item.title}
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  // Desktop Sidebar - iOS 18 Minimal Style
  const DesktopSidebar = () => (
    <aside
      className={cn(
        "hidden lg:flex flex-col h-full bg-background/95 backdrop-blur-2xl border-r border-border/20 transition-all duration-300 ease-out",
        isExpanded ? "w-60" : "w-14"
      )}
    >
      {/* Sidebar Header - Toggle only */}
      <div className="flex-shrink-0 flex items-center justify-center h-12 px-2">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-2xl text-foreground/40"
          onClick={() => setIsExpanded(!isExpanded)}
          data-testid="button-sidebar-toggle"
        >
          {isExpanded ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation Content - Scrollable */}
      <div className="flex-1 min-h-0 py-4 px-3 space-y-1 overflow-y-auto">
        {/* Top Items */}
        {topItems.map((item) => (
          <NavItemComponent key={item.url} item={item} showLabel={isExpanded} />
        ))}

        {/* Return to App */}
        {(variant === 'admin' || variant === 'admin-team') && (
          <div className="pt-2">
            <NavItemComponent item={returnToAppItem} showLabel={isExpanded} />
          </div>
        )}

        {/* Nav Sections */}
        {navSections.map((section, idx) => (
          <div key={section.label || idx} className="pt-6">
            {isExpanded && section.label && (
              <div className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-widest text-foreground/40">
                {section.label}
              </div>
            )}
            {!isExpanded && section.label && (
              <div className="h-px bg-border/50 mx-2 mb-3" />
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavItemComponent key={item.url} item={item} showLabel={isExpanded} />
              ))}
            </div>
          </div>
        ))}

        {/* Admin Link */}
        {user.role === 'admin' && (variant === 'user' || variant === 'team') && (
          <div className="pt-6">
            {isExpanded && (
              <div className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-widest text-foreground/40">
                {t('nav.administration')}
              </div>
            )}
            {!isExpanded && <div className="h-px bg-border/50 mx-2 mb-3" />}
            <NavItemComponent 
              item={{ title: t('nav.adminDashboard'), url: "/admin" }} 
              showLabel={isExpanded} 
            />
          </div>
        )}
      </div>

      {/* Credits Card - iOS 18 Minimal */}
      <div className={cn("flex-shrink-0 p-2", !isExpanded && "flex justify-center")}>
        {isExpanded ? (
          <div className="flex items-center justify-between px-3 py-2.5 rounded-2xl bg-foreground/[0.04] border border-border/20">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">{t('sidebar.credits')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tabular-nums">{remainingCredits.toLocaleString()}</span>
              {isPaidPlan && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
                  {planDisplayName}
                </span>
              )}
            </div>
          </div>
        ) : (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div className="h-9 w-9 rounded-2xl bg-foreground/[0.04] flex items-center justify-center cursor-default">
                <Coins className="h-4 w-4 text-amber-500" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="rounded-2xl">
              <div className="font-medium text-sm">{remainingCredits.toLocaleString()} {t('sidebar.credits')}</div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* User Footer - iOS 18 Minimal */}
      <div className="flex-shrink-0 p-2 border-t border-border/20">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex items-center gap-2.5 w-full p-2 rounded-2xl transition-colors",
                "hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                !isExpanded && "justify-center"
              )}
              data-testid="button-user-menu-sidebar"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-foreground/[0.08] text-foreground text-sm font-medium">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              {isExpanded && (
                <>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-medium text-foreground truncate">{userName}</div>
                    <div className="text-xs text-muted-foreground truncate">{userEmail}</div>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-foreground/30" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-60 rounded-2xl p-2 border-border/30">
            <div className="px-3 py-2.5 mb-1">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-foreground/[0.08] text-foreground font-medium">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{userName}</div>
                  <div className="text-xs text-muted-foreground truncate">{userEmail}</div>
                </div>
              </div>
            </div>
            <DropdownMenuSeparator className="bg-border/20" />
            <div className="p-1">
              <DropdownMenuItem 
                onClick={() => setLocation("/app/settings")} 
                className="rounded-2xl py-2 px-3 cursor-pointer"
                data-testid="link-account-settings"
              >
                <Settings className="mr-2.5 h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{t('nav.settings', 'Settings')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={handleLogout}
                className="rounded-2xl py-2 px-3 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                data-testid="button-logout"
              >
                <LogOut className="mr-2.5 h-4 w-4" />
                <span className="text-sm">{t('auth.logout')}</span>
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );

  // Mobile Sidebar - iOS 18 Minimal Style
  const MobileSidebar = () => (
    <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
      <SheetContent side="left" className="w-72 p-0 border-r-0 flex flex-col">
        <SheetHeader className="px-4 py-3 flex-shrink-0 border-b border-border/20">
          <SheetTitle className="text-left text-sm font-medium text-muted-foreground">
            {t('sidebar.navigation') || 'Menu'}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-1">
          {topItems.map((item) => (
            <NavItemComponent key={item.url} item={item} showLabel={true} />
          ))}

          {navSections.map((section, idx) => (
            <div key={section.label || idx} className="pt-6">
              {section.label && (
                <div className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-widest text-foreground/40">
                  {section.label}
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavItemComponent key={item.url} item={item} showLabel={true} />
                ))}
              </div>
            </div>
          ))}

          {user.role === 'admin' && (variant === 'user' || variant === 'team') && (
            <div className="pt-6">
              <div className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-widest text-foreground/40">
                {t('nav.administration')}
              </div>
              <NavItemComponent 
                item={{ title: t('nav.adminDashboard'), url: "/admin" }} 
                showLabel={true} 
              />
            </div>
          )}
        </div>

        {/* Mobile Footer - iOS 18 Minimal */}
        <div className="flex-shrink-0 p-3 border-t border-border/20 space-y-2">
          <div className="flex items-center justify-between px-3 py-2.5 rounded-2xl bg-foreground/[0.04] border border-border/20">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">{t('sidebar.credits')}</span>
            </div>
            <span className="text-sm font-semibold tabular-nums">{remainingCredits.toLocaleString()}</span>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2.5 text-destructive rounded-2xl"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            <span className="text-sm">{t('auth.logout')}</span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <SidebarContext.Provider value={{ isExpanded, setIsExpanded }}>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        {/* Desktop Sidebar */}
        <DesktopSidebar />
        <MobileSidebar />

        {/* Main Content Area */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Top Bar - iOS 18 Minimal Style */}
          <header className="sticky top-0 z-40 flex h-12 items-center gap-3 border-b border-border/20 bg-background/95 backdrop-blur-2xl px-4">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden rounded-2xl"
              onClick={() => setMobileMenuOpen(true)}
              data-testid="button-mobile-menu"
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Logo - Always visible in toolbar */}
            <Link 
              href={variant === 'admin' || variant === 'admin-team' ? "/admin" : "/app"}
              className="flex items-center shrink-0"
              data-testid="link-logo"
            >
              {currentLogo ? (
                <img src={currentLogo} alt={branding.app_name} className="h-7 w-auto object-contain" />
              ) : (
                <span className="font-semibold text-base tracking-tight">{branding.app_name}</span>
              )}
            </Link>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Right side utilities - iOS 18 pill group */}
            <div className="flex items-center gap-1">
              {showNotifications && (
                <>
                  <HeaderBannerNotifications />
                  <NotificationBell />
                </>
              )}
              <LanguageSelector variant="compact" />
              <ThemeToggle />

              {/* Credits Pill - Desktop only */}
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-foreground/[0.04] border border-border/20">
                <Coins className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-sm font-medium tabular-nums">{remainingCredits.toLocaleString()}</span>
              </div>

              {/* User Menu - iOS 18 Style */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1.5 rounded-2xl" data-testid="button-user-menu">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="bg-foreground/10 text-foreground text-xs font-medium">
                        {userInitial}
                      </AvatarFallback>
                    </Avatar>
                    <ChevronDown className="h-3 w-3 opacity-50 hidden sm:block" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2 border-border/30">
                  {/* User Info - iOS 18 Minimal */}
                  <div className="px-3 py-3 mb-1">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-foreground/[0.08] text-foreground font-medium">
                          {userInitial}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{userName}</p>
                        <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                      </div>
                    </div>
                  </div>

                  {/* Credits Pill - iOS 18 Style */}
                  <div className="px-2 pb-2">
                    <div className="flex items-center justify-between px-3 py-2.5 rounded-2xl bg-foreground/[0.04] border border-border/20">
                      <div className="flex items-center gap-2">
                        <Coins className="h-4 w-4 text-amber-500" />
                        <span className="text-xs text-muted-foreground">{t('sidebar.credits')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums">{remainingCredits.toLocaleString()}</span>
                        {isPaidPlan && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
                            {planDisplayName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <DropdownMenuSeparator className="bg-border/20" />

                  <div className="p-1">
                    <DropdownMenuItem onClick={() => setLocation("/app/settings")} className="rounded-2xl cursor-pointer py-2 px-3">
                      <Settings className="mr-2.5 h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{t('nav.settings', 'Settings')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleLogout} className="rounded-2xl cursor-pointer py-2 px-3 text-destructive focus:text-destructive focus:bg-destructive/10">
                      <LogOut className="mr-2.5 h-4 w-4" />
                      <span className="text-sm">{t('auth.logout')}</span>
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}

// Export variant components
export function UserHybridNavigation({ children }: { children: React.ReactNode }) {
  return <HybridNavigation variant="user" showNotifications={true}>{children}</HybridNavigation>;
}

export function AdminHybridNavigation({ children }: { children: React.ReactNode }) {
  return <HybridNavigation variant="admin" showNotifications={true}>{children}</HybridNavigation>;
}

export function TeamHybridNavigation({ children }: { children: React.ReactNode }) {
  return <HybridNavigation variant="team" showNotifications={false}>{children}</HybridNavigation>;
}

export function AdminTeamHybridNavigation({ children }: { children: React.ReactNode }) {
  return <HybridNavigation variant="admin-team" showNotifications={false}>{children}</HybridNavigation>;
}
