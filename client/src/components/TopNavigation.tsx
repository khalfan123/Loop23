/**
 * ============================================================
 * © 2025 Diploy — a brand of Bisht Technologies Private Limited
 * Original Author: BTPL Engineering Team
 * Website: https://diploy.in
 * Contact: cs@diploy.in
 *
 * Distributed under the Envato / CodeCanyon License Agreement.
 * Licensed to the purchaser for use as defined by the
 * Envato Market (CodeCanyon) Regular or Extended License.
 *
 * You are NOT permitted to redistribute, resell, sublicense,
 * or share this source code, in whole or in part.
 * Respect the author's rights and Envato licensing terms.
 * ============================================================
 */
import { 
  Users, BookOpen, Mic, Link as LinkIcon, Phone, Settings, 
  Plus, BarChart3, Home, Target, LogOut, Coins, Shield, 
  CreditCard, TrendingUp, UserCheck, Workflow, Webhook, 
  ClipboardList, Calendar, Layout, FileText, Wrench, Globe, 
  Bot, ContactRound, Building2, ShieldCheck, Brain, Menu, X, 
  ChevronDown, Zap
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useState } from "react";
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
  icon: React.ComponentType<{ className?: string }>;
  hasPlus?: boolean;
  iconColor?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

interface TopNavigationProps {
  variant?: 'user' | 'admin' | 'team' | 'admin-team';
  showNotifications?: boolean;
}

export function TopNavigation({ variant = 'user', showNotifications = true }: TopNavigationProps) {
  const [location, setLocation] = useLocation();
  const { t } = useTranslation();
  const { branding, currentLogo } = useBranding();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-4 md:px-6">
          <div className="animate-pulse h-8 w-32 bg-muted rounded" />
        </div>
      </header>
    );
  }

  const userName = user.name || "User";
  const userInitial = userName.charAt(0).toUpperCase() || "U";
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

  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  const isActive = (url: string) => {
    if (url === '/app' || url === '/admin') {
      return location === url || location === url + '/dashboard';
    }
    return location === url || location.startsWith(url + '/');
  };

  const NavDropdown = ({ section }: { section: NavSection }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-1"
          data-testid={`dropdown-${section.label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {section.label}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {section.items.map((item) => (
          <DropdownMenuItem 
            key={item.url} 
            asChild 
            className={cn(
              "cursor-pointer",
              isActive(item.url) && "bg-accent"
            )}
          >
            <Link 
              href={item.url} 
              className="flex items-center gap-2 w-full"
              data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <item.icon className={cn("h-4 w-4", item.iconColor)} />
              <span>{item.title}</span>
              {item.hasPlus && (
                <Plus className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const MobileNavSection = ({ section }: { section: NavSection }) => (
    <div className="py-2">
      <div className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {section.label}
      </div>
      <div className="space-y-0.5">
        {section.items.map((item) => (
          <Button
            key={item.url}
            variant="ghost"
            size="sm"
            asChild
            className={cn(
              "w-full justify-start gap-3",
              isActive(item.url) && "bg-accent"
            )}
          >
            <Link
              href={item.url}
              onClick={handleNavClick}
              data-testid={`mobile-link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <item.icon className={cn("h-4 w-4", item.iconColor)} />
              <span>{item.title}</span>
              {item.hasPlus && (
                <Plus className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-4 px-4 md:px-6">
        {/* Logo */}
        <Link href={variant === 'admin' || variant === 'admin-team' ? "/admin" : "/app"} className="flex items-center gap-2 shrink-0">
          {currentLogo ? (
            <img 
              src={currentLogo} 
              alt={branding.app_name} 
              className={cn(
                "w-auto object-contain",
                branding.logo_size === 'small' ? 'h-6 max-w-[100px]' : 
                branding.logo_size === 'large' ? 'h-9 max-w-[150px]' : 
                branding.logo_size === 'xlarge' ? 'h-10 max-w-[170px]' : 'h-7 max-w-[130px]'
              )}
            />
          ) : (
            <Zap className="h-6 w-6 text-primary" />
          )}
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1 flex-1">
          {/* Home Link */}
          {topItems.map((item) => (
            <Button
              key={item.url}
              variant="ghost"
              size="sm"
              asChild
              className={cn(isActive(item.url) && "bg-accent")}
            >
              <Link 
                href={item.url}
                data-testid={`link-${item.title.toLowerCase()}`}
              >
                <item.icon className="h-4 w-4 mr-1.5" />
                {item.title}
              </Link>
            </Button>
          ))}

          {/* Nav Dropdowns */}
          {navSections.map((section) => (
            <NavDropdown key={section.label} section={section} />
          ))}

          {/* Admin Link for admin users */}
          {user.role === 'admin' && (variant === 'user' || variant === 'team') && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className={cn(isActive('/admin') && "bg-accent")}
            >
              <Link 
                href="/admin"
                data-testid="link-admin-dashboard"
              >
                <Shield className="h-4 w-4 mr-1.5" />
                {t('nav.adminDashboard')}
              </Link>
            </Button>
          )}
        </nav>

        {/* Right side utilities */}
        <div className="flex items-center gap-2 ml-auto">
          {showNotifications && (
            <>
              <HeaderBannerNotifications />
              <NotificationBell />
            </>
          )}
          <LanguageSelector variant="compact" />
          <ThemeToggle />

          {/* Credits Badge - Desktop */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-muted/50">
            <Coins className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium">{remainingCredits.toLocaleString()}</span>
          </div>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-2"
                data-testid="button-user-menu"
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline text-sm font-medium max-w-[100px] truncate">
                  {userName}
                </span>
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 p-0">
              {/* Credits Section */}
              <div className="relative overflow-hidden m-2 rounded-xl border border-slate-300/60 dark:border-slate-600/60 p-4 bg-gradient-to-br from-slate-100 via-slate-50 to-white dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 shadow-sm">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/10 -translate-x-full animate-[shimmer_3s_ease-in-out_infinite]" style={{ backgroundSize: '200% 100%' }} />
                <div className="relative space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-600 dark:to-slate-700 shadow-inner">
                        <Coins className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                      </div>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('sidebar.credits')}</span>
                    </div>
                    {isPaidPlan ? (
                      <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide bg-gradient-to-r from-amber-400/90 to-yellow-500/90 text-amber-900 dark:from-amber-500 dark:to-yellow-600 dark:text-amber-950 shadow-sm border border-amber-500/30 dark:border-yellow-600/30">
                        {planDisplayName}
                      </span>
                    ) : (
                      <Button 
                        variant="default" 
                        size="sm"
                        onClick={() => setLocation("/app/upgrade")}
                        data-testid="button-upgrade-dropdown"
                      >
                        {t('sidebar.upgrade')}
                      </Button>
                    )}
                  </div>
                  <div className="text-2xl font-bold bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 dark:from-slate-100 dark:via-slate-200 dark:to-slate-100 bg-clip-text text-transparent">
                    {remainingCredits.toLocaleString()} <span className="text-sm font-medium text-slate-500 dark:text-slate-400">credits</span>
                  </div>
                </div>
              </div>
              <DropdownMenuSeparator />
              
              {/* Account Settings */}
              <DropdownMenuItem 
                onClick={() => setLocation("/app/settings")}
                className="cursor-pointer"
                data-testid="link-account-settings"
              >
                <Settings className="mr-2 h-4 w-4" />
                <span>{t('nav.accountSettings')}</span>
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              {/* Log out */}
              <DropdownMenuItem 
                onClick={handleLogout}
                className="cursor-pointer text-destructive focus:text-destructive"
                data-testid="button-logout"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>{t('auth.logout')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile Menu Button */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="lg:hidden"
                data-testid="button-mobile-menu"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 p-0 overflow-y-auto">
              <SheetHeader className="p-4 border-b">
                <SheetTitle className="flex items-center gap-2">
                  {currentLogo ? (
                    <img 
                      src={currentLogo} 
                      alt={branding.app_name} 
                      className="h-7 w-auto max-w-[130px] object-contain"
                    />
                  ) : (
                    <>
                      <Zap className="h-5 w-5 text-primary" />
                      <span>{branding.app_name}</span>
                    </>
                  )}
                </SheetTitle>
              </SheetHeader>
              
              <div className="p-2">
                {/* Credits on Mobile */}
                <div className="relative overflow-hidden m-2 rounded-xl border border-slate-300/60 dark:border-slate-600/60 p-3 bg-gradient-to-br from-slate-100 via-slate-50 to-white dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Coins className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-semibold">{t('sidebar.credits')}</span>
                    </div>
                    <span className="text-lg font-bold">{remainingCredits.toLocaleString()}</span>
                  </div>
                </div>

                {/* Home */}
                <div className="py-2">
                  {topItems.map((item) => (
                    <Button
                      key={item.url}
                      variant="ghost"
                      size="sm"
                      asChild
                      className={cn(
                        "w-full justify-start gap-3",
                        isActive(item.url) && "bg-accent"
                      )}
                    >
                      <Link
                        href={item.url}
                        onClick={handleNavClick}
                        data-testid={`mobile-link-${item.title.toLowerCase()}`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </Button>
                  ))}
                </div>

                {/* All Nav Sections */}
                {navSections.map((section) => (
                  <MobileNavSection key={section.label} section={section} />
                ))}

                {/* Admin Link */}
                {user.role === 'admin' && (variant === 'user' || variant === 'team') && (
                  <div className="py-2 border-t">
                    <div className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      {t('nav.administration')}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className={cn(
                        "w-full justify-start gap-3",
                        isActive('/admin') && "bg-accent"
                      )}
                    >
                      <Link
                        href="/admin"
                        onClick={handleNavClick}
                        data-testid="mobile-link-admin"
                      >
                        <Shield className="h-4 w-4" />
                        <span>{t('nav.adminDashboard')}</span>
                      </Link>
                    </Button>
                  </div>
                )}

                {/* Settings & Logout */}
                <div className="py-2 border-t mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="w-full justify-start gap-3"
                  >
                    <Link
                      href="/app/settings"
                      onClick={handleNavClick}
                      data-testid="mobile-link-settings"
                    >
                      <Settings className="h-4 w-4" />
                      <span>{t('nav.accountSettings')}</span>
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="w-full justify-start gap-3 text-destructive"
                    data-testid="mobile-button-logout"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>{t('auth.logout')}</span>
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

export function AdminTopNavigation() {
  return <TopNavigation variant="admin" showNotifications={true} />;
}

export function TeamTopNavigation() {
  return <TopNavigation variant="team" showNotifications={false} />;
}

export function AdminTeamTopNavigation() {
  return <TopNavigation variant="admin-team" showNotifications={false} />;
}
