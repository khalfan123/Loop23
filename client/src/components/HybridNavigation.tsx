/**
 * Hybrid Navigation System
 * Microsoft 365 / Google Workspace inspired layout:
 * - Slim top bar (48px) with logo, search, notifications, user menu
 * - Collapsible side rail (56px collapsed, 240px expanded) for navigation
 */
import { useState, useEffect, createContext, useContext } from "react";
import { 
  Users, BookOpen, Link as LinkIcon, Phone, Settings, 
  Plus, BarChart3, Home, Target, LogOut, Coins, Shield, 
  CreditCard, TrendingUp, UserCheck, Workflow, Webhook, 
  ClipboardList, Calendar, Globe, Bot, ContactRound, 
  Building2, ShieldCheck, Menu, ChevronDown, Zap, 
  ChevronLeft, ChevronRight, Search, Bell, Grid3X3
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  SheetTrigger,
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
import { ScrollArea } from "@/components/ui/scroll-area";

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
  icon: React.ComponentType<{ className?: string }>;
  hasPlus?: boolean;
  iconColor?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

// Sidebar context for managing expanded/collapsed state
interface SidebarContextType {
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  isHovered: boolean;
  setIsHovered: (hovered: boolean) => void;
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
  
  // Sidebar state with localStorage persistence
  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar-expanded');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });
  const [isHovered, setIsHovered] = useState(false);

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem('sidebar-expanded', String(isExpanded));
  }, [isExpanded]);

  // Navigation items
  const topItems: NavItem[] = [
    { title: t('nav.home'), url: variant === 'admin' || variant === 'admin-team' ? "/admin" : "/app", icon: Home },
  ];

  const buildItems: NavItem[] = [
    { title: t('nav.campaigns'), url: "/app/campaigns", icon: Target, hasPlus: true, iconColor: "text-orange-500" },
    { title: t('nav.agents'), url: "/app/agents", icon: Bot, hasPlus: true, iconColor: "text-blue-500" },
    { title: t('nav.knowledgeBase'), url: "/app/knowledge-base", icon: BookOpen, iconColor: "text-violet-500" },
  ];

  const evaluateItems: NavItem[] = [
    { title: t('nav.allContacts'), url: "/app/contacts", icon: UserCheck, iconColor: "text-teal-500" },
    { title: t('nav.calls'), url: "/app/calls", icon: Phone, iconColor: "text-blue-500" },
    { title: t('nav.crm'), url: "/app/crm", icon: ContactRound, iconColor: "text-cyan-500" },
    { title: t('nav.analytics'), url: "/app/analytics", icon: BarChart3, iconColor: "text-purple-500" },
    { title: t('nav.qualityAssurance', 'Quality Assurance'), url: "/app/quality-assurance", icon: ShieldCheck, iconColor: "text-green-500" },
  ];

  const telephonyItems: NavItem[] = [
    { title: t('nav.phoneNumbers'), url: "/app/phone-numbers", icon: Phone, iconColor: "text-emerald-500" },
    { title: t('nav.incomingConnections'), url: "/app/incoming-connections", icon: LinkIcon, iconColor: "text-amber-500" },
    { title: t('nav.departments'), url: "/app/departments", icon: Building2, iconColor: "text-sky-500" },
  ];

  const flowAutomationItems: NavItem[] = [
    { title: t('nav.flowBuilder'), url: "/app/flows", icon: Workflow, iconColor: "text-indigo-500" },
    { title: t('nav.executionLogs'), url: "/app/flows/execution", icon: BarChart3, iconColor: "text-slate-500" },
    { title: t('nav.forms'), url: "/app/flows/forms", icon: ClipboardList, iconColor: "text-cyan-500" },
    { title: t('nav.appointments'), url: "/app/flows/appointments", icon: Calendar, iconColor: "text-rose-500" },
  ];

  const toolsItems: NavItem[] = [
    { title: t('nav.webhooks'), url: "/app/flows/webhooks", icon: Webhook, iconColor: "text-violet-500" },
    { title: t('nav.websiteWidget') || 'Website Widget', url: "/app/tools/widgets", icon: Globe, iconColor: "text-sky-500" },
  ];

  const billingItems: NavItem[] = [
    { title: t('nav.upgradePlan'), url: "/app/upgrade", icon: TrendingUp, iconColor: "text-amber-500" },
    { title: t('nav.billingCredits'), url: "/app/billing", icon: CreditCard, iconColor: "text-amber-500" },
  ];

  const navSections: NavSection[] = variant === 'admin' || variant === 'admin-team' ? [] : [
    { label: t('sidebar.build'), items: buildItems },
    { label: t('sidebar.evaluate'), items: evaluateItems },
    { label: t('sidebar.telephony'), items: telephonyItems },
    { label: t('sidebar.flowAutomation'), items: flowAutomationItems },
    { label: t('sidebar.tools') || 'Tools', items: toolsItems },
    { label: t('sidebar.billing'), items: billingItems },
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

  // Determine if sidebar should appear expanded (either pinned or hovered)
  const showExpanded = isExpanded || isHovered;

  // Sidebar navigation item component
  const NavItemComponent = ({ item, showLabel }: { item: NavItem; showLabel: boolean }) => {
    const active = isActive(item.url);
    
    const content = (
      <Link
        href={item.url}
        onClick={() => setMobileMenuOpen(false)}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
          active 
            ? "bg-primary/10 text-primary font-medium" 
            : "text-foreground/70 hover:bg-accent hover:text-foreground"
        )}
        data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <item.icon className={cn("h-5 w-5 shrink-0", item.iconColor)} />
        {showLabel && (
          <span className="truncate text-sm">{item.title}</span>
        )}
        {showLabel && item.hasPlus && (
          <Plus className="ml-auto h-4 w-4 text-muted-foreground" />
        )}
      </Link>
    );

    if (!showLabel) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {item.title}
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  // Desktop Sidebar
  const DesktopSidebar = () => (
    <aside
      className={cn(
        "hidden lg:flex flex-col h-full border-r bg-background transition-all duration-300 ease-in-out",
        showExpanded ? "w-60" : "w-14"
      )}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Sidebar Header */}
      <div className={cn(
        "flex items-center h-12 px-3 border-b",
        showExpanded ? "justify-between" : "justify-center"
      )}>
        {showExpanded && (
          <span className="font-semibold text-sm truncate">
            {t('sidebar.navigation') || 'Navigation'}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
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

      {/* Navigation Content */}
      <ScrollArea className="flex-1 py-2">
        <nav className="px-2 space-y-1">
          {/* Home */}
          {topItems.map((item) => (
            <NavItemComponent key={item.url} item={item} showLabel={showExpanded} />
          ))}

          {/* Nav Sections */}
          {navSections.map((section) => (
            <div key={section.label} className="mt-4">
              {showExpanded && (
                <div className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {section.label}
                </div>
              )}
              {!showExpanded && <div className="h-px bg-border mx-2 my-2" />}
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavItemComponent key={item.url} item={item} showLabel={showExpanded} />
                ))}
              </div>
            </div>
          ))}

          {/* Admin Link */}
          {user.role === 'admin' && (variant === 'user' || variant === 'team') && (
            <div className="mt-4">
              {showExpanded && (
                <div className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t('nav.administration')}
                </div>
              )}
              {!showExpanded && <div className="h-px bg-border mx-2 my-2" />}
              <NavItemComponent 
                item={{ title: t('nav.adminDashboard'), url: "/admin", icon: Shield }} 
                showLabel={showExpanded} 
              />
            </div>
          )}
        </nav>
      </ScrollArea>

      {/* Credits Section */}
      <div className={cn("p-2 border-t", !showExpanded && "flex justify-center")}>
        {showExpanded ? (
          <div 
            className="p-3 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border border-amber-200/50 dark:border-amber-800/30 cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-colors"
            onClick={() => setLocation("/app/billing")}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-medium text-muted-foreground">{t('sidebar.credits')}</span>
              </div>
              {isPaidPlan && (
                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200">
                  {planDisplayName}
                </span>
              )}
            </div>
            <div className="mt-1 text-lg font-bold">{remainingCredits.toLocaleString()}</div>
          </div>
        ) : (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={() => setLocation("/app/billing")}
              >
                <Coins className="h-5 w-5 text-amber-500" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <div className="font-medium">{remainingCredits.toLocaleString()} {t('sidebar.credits')}</div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Settings Link */}
      <div className={cn("p-2 border-t", !showExpanded && "flex justify-center")}>
        <NavItemComponent 
          item={{ title: t('nav.accountSettings'), url: "/app/settings", icon: Settings }} 
          showLabel={showExpanded} 
        />
      </div>
    </aside>
  );

  // Mobile Sidebar Sheet
  const MobileSidebar = () => (
    <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            {currentLogo ? (
              <img src={currentLogo} alt={branding.app_name} className="h-8 w-auto" />
            ) : (
              <>
                <Zap className="h-6 w-6 text-primary" />
                <span>{branding.app_name}</span>
              </>
            )}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 h-[calc(100vh-180px)]">
          <nav className="p-2 space-y-1">
            {topItems.map((item) => (
              <NavItemComponent key={item.url} item={item} showLabel={true} />
            ))}

            {navSections.map((section) => (
              <div key={section.label} className="mt-4">
                <div className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {section.label}
                </div>
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <NavItemComponent key={item.url} item={item} showLabel={true} />
                  ))}
                </div>
              </div>
            ))}

            {user.role === 'admin' && (variant === 'user' || variant === 'team') && (
              <div className="mt-4">
                <div className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t('nav.administration')}
                </div>
                <NavItemComponent 
                  item={{ title: t('nav.adminDashboard'), url: "/admin", icon: Shield }} 
                  showLabel={true} 
                />
              </div>
            )}
          </nav>
        </ScrollArea>

        {/* Mobile Credits & Actions */}
        <div className="p-3 border-t space-y-2">
          <div 
            className="p-3 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border border-amber-200/50 dark:border-amber-800/30"
            onClick={() => { setLocation("/app/billing"); setMobileMenuOpen(false); }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">{t('sidebar.credits')}</span>
              </div>
              <span className="text-lg font-bold">{remainingCredits.toLocaleString()}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            {t('auth.logout')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <SidebarContext.Provider value={{ isExpanded, setIsExpanded, isHovered, setIsHovered }}>
      <div className="flex h-screen w-full overflow-hidden">
        {/* Desktop Sidebar */}
        <DesktopSidebar />
        <MobileSidebar />

        {/* Main Content Area */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Top Bar */}
          <header className="sticky top-0 z-40 flex h-12 items-center gap-4 border-b bg-background px-4">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-9 w-9"
              onClick={() => setMobileMenuOpen(true)}
              data-testid="button-mobile-menu"
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Logo */}
            <Link 
              href={variant === 'admin' || variant === 'admin-team' ? "/admin" : "/app"}
              className="flex items-center gap-2 shrink-0"
              data-testid="link-logo"
            >
              {currentLogo ? (
                <img src={currentLogo} alt={branding.app_name} className="h-8 w-auto max-w-[160px] object-contain" />
              ) : (
                <>
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
                    <Zap className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <span className="hidden sm:inline font-semibold text-lg">{branding.app_name}</span>
                </>
              )}
            </Link>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Right side utilities */}
            <div className="flex items-center gap-2">
              {showNotifications && (
                <>
                  <HeaderBannerNotifications />
                  <NotificationBell />
                </>
              )}
              <LanguageSelector variant="compact" />
              <ThemeToggle />

              {/* Credits - Desktop only */}
              <div 
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => setLocation("/app/billing")}
              >
                <Coins className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-semibold">{remainingCredits.toLocaleString()}</span>
              </div>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-9 px-2 gap-2" data-testid="button-user-menu">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                        {userInitial}
                      </AvatarFallback>
                    </Avatar>
                    <ChevronDown className="h-3 w-3 opacity-60 hidden sm:block" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 p-0">
                  {/* User Info */}
                  <div className="p-4 border-b bg-muted/30">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary text-primary-foreground font-medium">
                          {userInitial}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{userName}</p>
                        <p className="text-sm text-muted-foreground truncate">{userEmail}</p>
                      </div>
                    </div>
                  </div>

                  {/* Credits */}
                  <div className="p-3 border-b">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border border-amber-200/50 dark:border-amber-800/30">
                      <div className="flex items-center gap-2">
                        <Coins className="h-5 w-5 text-amber-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">{t('sidebar.credits')}</p>
                          <p className="text-lg font-bold">{remainingCredits.toLocaleString()}</p>
                        </div>
                      </div>
                      {!isPaidPlan && (
                        <Button size="sm" onClick={() => setLocation("/app/upgrade")}>
                          {t('sidebar.upgrade')}
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="p-1">
                    <DropdownMenuItem onClick={() => setLocation("/app/settings")} className="cursor-pointer p-2.5">
                      <Settings className="mr-3 h-4 w-4" />
                      {t('nav.accountSettings')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocation("/app/billing")} className="cursor-pointer p-2.5">
                      <CreditCard className="mr-3 h-4 w-4" />
                      {t('nav.billingCredits')}
                    </DropdownMenuItem>
                  </div>

                  <DropdownMenuSeparator />

                  <div className="p-1">
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer p-2.5 text-destructive focus:text-destructive">
                      <LogOut className="mr-3 h-4 w-4" />
                      {t('auth.logout')}
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-auto bg-muted/30">
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
