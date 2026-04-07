/**
 * Hybrid Navigation System - iOS 26 Frosted Glass Design
 * Clean, minimal sidebar with frosted glass panels and pill-shaped selections
 */
import { useState, useEffect, createContext, useContext } from "react";
import { 
  Settings, LogOut, Coins, Menu, ChevronDown,
  ChevronLeft, ChevronRight, BarChart3, Users, Phone,
  Building2, PhoneIncoming, PhoneOutgoing,
  Bot, BookOpen, Calendar, FileText, Home, Plus, Plug, Webhook, Zap, Mountain, Cpu, Mic,
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
  variant?: 'user' | 'team';
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
    { title: t('nav.dashboard', 'Dashboard'), url: "/app/analytics", icon: BarChart3 },
  ];
  
  const returnToAppItem: NavItem = { 
    title: t('nav.returnToApp') || 'Return to App', 
    url: "/app",
    icon: Home
  };

  const setupItems: NavItem[] = [
    { title: t('nav.phoneNumbers'), url: "/app/phone-numbers", icon: Phone },
    { title: t('nav.knowledgeBase'), url: "/app/knowledge-base", icon: BookOpen },
    { title: t('nav.inbound', 'Inbound'), url: "/app/deprock", icon: PhoneIncoming },
    { title: t('nav.aiStaff', 'AI Staff'), url: "/app/agents", icon: Bot },
    { title: t('nav.integrations', 'Integrations'), url: "/app/integrations", icon: Plug },
  ];

  const manageItems: NavItem[] = [
    { title: t('nav.operations', 'Operations'), url: "/app/ops", icon: Cpu },
    { title: t('nav.voices', 'Voices'), url: "/app/voices", icon: Mic },
  ];

  const settingsItems: NavItem[] = [
    { title: t('nav.settings', 'Settings'), url: "/app/settings", icon: Settings },
  ];

  const navSections: NavSection[] = [
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
    if (url === '/app') {
      return location === url || location === url + '/dashboard';
    }
    if (url === '/app/settings') {
      return location === url || (location.startsWith(url + '/') && !location.startsWith('/app/settings/flows/appointments'));
    }
    return location === url || location.startsWith(url + '/');
  };

  const NavItemComponent = ({ item, showLabel }: { item: NavItem; showLabel: boolean }) => {
    const active = isActive(item.url);
    const IconComponent = item.icon;
    
    return (
      <Link
        href={item.url}
        onClick={() => setMobileMenuOpen(false)}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all duration-300 text-[13px] group",
          active 
            ? "bg-primary/[0.12] dark:bg-primary/20 text-primary dark:text-primary font-medium shadow-[0_1px_3px_rgba(0,0,0,0.04)]" 
            : "text-muted-foreground hover:bg-foreground/[0.04] dark:hover:bg-foreground/[0.06]"
        )}
        data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        {IconComponent && (
          <IconComponent className={cn(
            "h-4 w-4 flex-shrink-0 transition-colors duration-300",
            active ? "text-primary" : "text-muted-foreground/70"
          )} />
        )}
        {showLabel && <span className="truncate flex-1">{item.title}</span>}
        {item.badge !== undefined && item.badge > 0 && (
          <span className={cn(
            "ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-semibold min-w-[18px] text-center",
            active 
              ? "bg-primary/20 text-primary" 
              : "bg-foreground/[0.06] text-muted-foreground"
          )}>
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  const DesktopSidebar = () => (
    <aside
      className="hidden lg:flex flex-col h-full glass-panel border-r border-transparent w-64"
    >
      {/* Navigation Content with Logo merged in */}
      <div className="flex-1 min-h-0 px-3 overflow-y-auto">
        <Link 
          href="/app"
          className="flex flex-col items-center py-3"
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
                <span className="font-bold text-base text-zinc-900 dark:text-white tracking-tight">{branding.app_name}</span>
              </div>
            </>
          )}
        </Link>

        <div className="space-y-0.5">
        {topItems.map((item) => (
          <NavItemComponent key={item.url} item={item} showLabel={true} />
        ))}

        {navSections.map((section, idx) => (
          <div key={section.label || idx} className="pt-3">
            {section.label && (
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-foreground/40">
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

        </div>
      </div>

      <div className="flex-shrink-0 px-3 pb-1.5 pt-1">
        <div className="flex items-center justify-between px-3 py-2.5 rounded-2xl glass-card">
          <div className="flex items-center gap-2">
            <Coins className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[11px] text-muted-foreground">{t('sidebar.credits')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold tabular-nums text-foreground">{remainingCredits.toLocaleString()}</span>
            {isPaidPlan && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
                {planDisplayName}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 px-2 pb-2 border-t" style={{ borderColor: 'var(--glass-border)' }}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2.5 w-full p-2 rounded-2xl transition-colors hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="button-user-menu-sidebar"
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-foreground/[0.08] text-foreground text-xs font-medium">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-[13px] font-medium text-foreground truncate">{userName}</div>
                <div className="text-[11px] text-muted-foreground truncate">{userEmail}</div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-foreground/30" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-60 rounded-2xl p-2 glass-card-heavy border-0">
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
            <DropdownMenuSeparator style={{ backgroundColor: 'var(--glass-border)' }} />
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

  const MobileSidebar = () => (
    <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
      <SheetContent side="left" className="w-72 p-0 border-r-0 flex flex-col glass-panel">
        <SheetHeader className="px-4 py-3 flex-shrink-0 border-b" style={{ borderColor: 'var(--glass-border)' }}>
          <SheetTitle className="text-left text-sm font-medium text-muted-foreground">
            {t('sidebar.navigation') || 'Menu'}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-3 space-y-0.5">
          {topItems.map((item) => (
            <NavItemComponent key={item.url} item={item} showLabel={true} />
          ))}

          {navSections.map((section, idx) => (
            <div key={section.label || idx} className="pt-3">
              {section.label && (
                <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-foreground/40">
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

        </div>

        <div className="flex-shrink-0 p-3 border-t space-y-2" style={{ borderColor: 'var(--glass-border)' }}>
          <div className="flex items-center justify-between px-3 py-2.5 rounded-2xl glass-card">
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
          <header className="sticky top-0 z-40 flex h-12 items-center gap-3 border-b px-4 glass-surface" style={{ borderColor: 'var(--glass-border)' }}>
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

            {/* Right side utilities */}
            <div className="flex items-center gap-1">
              {showNotifications && (
                <HeaderBannerNotifications />
              )}
              <ThemeToggle />

              {/* User Menu */}
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
                <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2 glass-card-heavy border-0">
                  {/* User Info */}
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

                  <div className="px-2 pb-2">
                    <div className="flex items-center justify-between px-3 py-2.5 rounded-2xl glass-card">
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

                  <DropdownMenuSeparator style={{ backgroundColor: 'var(--glass-border)' }} />

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

export function TeamHybridNavigation({ children }: { children: React.ReactNode }) {
  return <HybridNavigation variant="team" showNotifications={false}>{children}</HybridNavigation>;
}
