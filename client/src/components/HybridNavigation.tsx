/**
 * Hybrid Navigation System - iOS 18 Minimal Design
 * Clean, minimal sidebar with pill-shaped selections
 */
import { useState, useEffect, createContext, useContext } from "react";
import { 
  Settings, LogOut, Coins, Menu, ChevronDown,
  ChevronLeft, ChevronRight, BarChart3, Users, Phone,
  Building2, PhoneCall, PhoneIncoming, PhoneOutgoing,
  Bot, BookOpen, Calendar, FileText, Home, Plus, Plug, Webhook,
  type LucideIcon
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
  collapsible?: boolean;
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
    { title: t('nav.analytics', 'Analytics'), url: "/app/analytics", icon: BarChart3 },
    { title: t('nav.quickCrm', 'Quick CRM'), url: "/app/crm", icon: Users },
    { title: t('nav.callHistory', 'Call History'), url: "/app/calls", icon: PhoneCall },
  ];
  
  const returnToAppItem: NavItem = { 
    title: t('nav.returnToApp') || 'Return to App', 
    url: "/app",
    icon: Home
  };

  const setupItems: NavItem[] = [
    { title: t('nav.phoneNumbers'), url: "/app/phone-numbers", icon: Phone },
    { title: t('nav.aiStaff', 'AI Staff'), url: "/app/agents", icon: Bot },
    { title: t('nav.knowledgeBase'), url: "/app/knowledge-base", icon: BookOpen },
    { title: t('nav.departments', 'Departments'), url: "/app/departments", icon: Building2 },
    { title: t('nav.batchCall', 'Batch Call'), url: "/app/campaigns", icon: PhoneOutgoing },
    { title: t('nav.integrations', 'Integrations'), url: "/app/integrations", icon: Plug },
  ];

  const manageItems: NavItem[] = [
    { title: t('nav.appointments'), url: "/app/flows/appointments", icon: Calendar },
    { title: t('nav.forms'), url: "/app/flows/forms", icon: FileText },
  ];

  const settingsItems: NavItem[] = [
    { title: t('nav.settings', 'Settings'), url: "/app/settings", icon: Settings },
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

  // iOS 18 style nav item with icon
  const NavItemComponent = ({ item, showLabel }: { item: NavItem; showLabel: boolean }) => {
    const active = isActive(item.url);
    const IconComponent = item.icon;
    
    return (
      <Link
        href={item.url}
        onClick={() => setMobileMenuOpen(false)}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-[14px] group",
          active 
            ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-medium shadow-sm" 
            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        )}
        data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        {IconComponent && (
          <IconComponent className={cn(
            "h-4 w-4 flex-shrink-0",
            active ? "text-white dark:text-zinc-900" : "text-zinc-400 dark:text-zinc-500"
          )} />
        )}
        {showLabel && <span className="truncate flex-1">{item.title}</span>}
        {item.badge !== undefined && item.badge > 0 && (
          <span className={cn(
            "ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-semibold min-w-[18px] text-center",
            active 
              ? "bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-900" 
              : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
          )}>
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  // Desktop Sidebar - iOS 18 Minimal Style with soft gray (always expanded)
  const DesktopSidebar = () => (
    <aside
      className="hidden lg:flex flex-col h-full bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-xl border-r border-black/[0.06] dark:border-white/[0.08] w-64"
    >
      {/* Logo - Uncontained */}
      <Link 
        href={variant === 'admin' || variant === 'admin-team' ? "/admin" : "/app"}
        className="flex-shrink-0 flex flex-col items-center py-2"
        data-testid="link-logo-sidebar"
      >
        {currentLogo ? (
          <img src={currentLogo} alt={branding.app_name} className="h-[120px] w-[120px] object-contain" />
        ) : (
          <>
            <div className="h-[120px] w-[120px] rounded-3xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-2xl shadow-blue-500/40">
              <span className="text-white font-bold text-5xl">{branding.app_name?.charAt(0) || 'A'}</span>
            </div>
            <div className="flex flex-col items-center mt-1">
              <span className="font-bold text-lg text-zinc-900 dark:text-white tracking-tight">{branding.app_name}</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">AI Platform</span>
            </div>
          </>
        )}
      </Link>

      {/* Navigation Content - Scrollable (no top gap) */}
      <div className="flex-1 min-h-0 pt-0 pb-2 px-3 space-y-0.5 overflow-y-auto">
        {/* Top Items */}
        {topItems.map((item) => (
          <NavItemComponent key={item.url} item={item} showLabel={true} />
        ))}

        {/* Return to App */}
        {(variant === 'admin' || variant === 'admin-team') && (
          <div className="pt-1">
            <NavItemComponent item={returnToAppItem} showLabel={true} />
          </div>
        )}

        {/* Nav Sections */}
        {navSections.map((section, idx) => (
          <div key={section.label || idx} className="pt-4">
            {section.label && (
              <div className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-widest text-foreground/40">
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

        {/* Admin Link */}
        {user.role === 'admin' && (variant === 'user' || variant === 'team') && (
          <div className="pt-4">
            <div className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-widest text-foreground/40">
              {t('nav.administration')}
            </div>
            <NavItemComponent 
              item={{ title: t('nav.adminDashboard'), url: "/admin", icon: Settings }} 
              showLabel={true} 
            />
          </div>
        )}
      </div>

      {/* Credits Card - iOS 18 Minimal */}
      <div className="flex-shrink-0 px-3 pb-2">
        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{t('sidebar.credits')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">{remainingCredits.toLocaleString()}</span>
            {isPaidPlan && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
                {planDisplayName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* User Footer - iOS 18 Minimal */}
      <div className="flex-shrink-0 p-2 border-t border-border/20">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2.5 w-full p-2 rounded-2xl transition-colors hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="button-user-menu-sidebar"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-foreground/[0.08] text-foreground text-sm font-medium">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-sm font-medium text-foreground truncate">{userName}</div>
                <div className="text-xs text-muted-foreground truncate">{userEmail}</div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-foreground/30" />
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
          {/* Top Bar - iOS 18 Minimal Style with soft gray */}
          <header className="sticky top-0 z-40 flex h-12 items-center gap-3 border-b border-black/[0.06] dark:border-white/[0.08] bg-zinc-50/90 dark:bg-zinc-900/90 backdrop-blur-xl px-4">
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

            <PhoneNumberDropdown />
            <div className="flex-1 flex justify-center px-2">
              <GlobalSearch />
            </div>

            {/* Right side utilities - iOS 18 pill group */}
            <div className="flex items-center gap-1">
              {showNotifications && (
                <HeaderBannerNotifications />
              )}
              <ThemeToggle />

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

                  {/* Language & Notifications */}
                  <div className="px-2 pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <LanguageSelector variant="compact" />
                      {showNotifications && <NotificationBell />}
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
