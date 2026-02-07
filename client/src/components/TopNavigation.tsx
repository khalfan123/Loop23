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
  ChevronDown, Zap, Grid3X3, Search, HelpCircle
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
  icon: React.ComponentType<{ className?: string }>;
  hasPlus?: boolean;
  iconColor?: string;
  description?: string;
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
  const [appLauncherOpen, setAppLauncherOpen] = useState(false);

  const topItems: NavItem[] = [
    { title: t('nav.home'), url: variant === 'admin' || variant === 'admin-team' ? "/admin" : "/app", icon: Home },
  ];

  const evaluateItems: NavItem[] = [
    { title: t('nav.allContacts'), url: "/app/contacts", icon: UserCheck, iconColor: "text-teal-500", description: "Contact management" },
    { title: t('nav.callHistory', 'Call History'), url: "/app/calls", icon: Phone, iconColor: "text-blue-500", description: "Call history & logs" },
    { title: t('nav.crm'), url: "/app/crm", icon: ContactRound, iconColor: "text-cyan-500", description: "Customer relationships" },
    { title: t('nav.analytics'), url: "/app/analytics", icon: BarChart3, iconColor: "text-purple-500", description: "Performance insights" },
    { title: t('nav.qualityAssurance', 'Quality Assurance'), url: "/app/quality-assurance", icon: ShieldCheck, iconColor: "text-green-500", description: "Call quality monitoring" },
  ];

  const setupItems: NavItem[] = [
    { title: t('nav.phoneNumbers'), url: "/app/phone-numbers", icon: Phone, iconColor: "text-emerald-500", description: "Manage phone numbers" },
    { title: t('nav.agents'), url: "/app/agents", icon: Bot, hasPlus: true, iconColor: "text-blue-500", description: "AI voice agents" },
    { title: t('nav.knowledgeBase'), url: "/app/knowledge-base", icon: BookOpen, iconColor: "text-violet-500", description: "Train your AI" },
    { title: t('nav.departments'), url: "/app/departments", icon: Building2, iconColor: "text-sky-500", description: "Department management" },
    { title: t('nav.batchCall', 'Batch Call'), url: "/app/campaigns", icon: Target, hasPlus: true, iconColor: "text-orange-500", description: "Batch calling campaigns" },
  ];

  const formsAppointmentsItems: NavItem[] = [
    { title: t('nav.forms'), url: "/app/flows/forms", icon: ClipboardList, iconColor: "text-cyan-500", description: "Form builder" },
    { title: t('nav.appointments'), url: "/app/flows/appointments", icon: Calendar, iconColor: "text-rose-500", description: "Scheduling system" },
  ];

  const settingsItems: NavItem[] = [
    { title: t('nav.settings', 'Settings'), url: "/app/settings", icon: Settings, iconColor: "text-slate-500", description: "App settings" },
  ];

  const navSections: NavSection[] = variant === 'admin' || variant === 'admin-team' ? [] : [
    { label: t('sidebar.setup', 'Setup'), items: setupItems },
    { label: t('sidebar.evaluate'), items: evaluateItems },
    { label: t('sidebar.formsAppointments', 'Forms & Appointments'), items: formsAppointmentsItems },
    { label: '', items: settingsItems },
  ];

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  if (userLoading || !user) {
    return (
      <header className="sticky top-0 z-50 w-full border-b bg-background">
        <div className="flex h-12 items-center px-4">
          <div className="animate-pulse h-8 w-40 bg-muted rounded" />
        </div>
      </header>
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
        <button 
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-accent/50 rounded-sm transition-colors"
          data-testid={`dropdown-${section.label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {section.label}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 p-1">
        {section.items.map((item) => (
          <DropdownMenuItem 
            key={item.url} 
            asChild 
            className={cn(
              "cursor-pointer p-2 rounded-md",
              isActive(item.url) && "bg-accent"
            )}
          >
            <Link 
              href={item.url} 
              className="flex items-start gap-3 w-full"
              data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <div className={cn("mt-0.5 p-1.5 rounded-md bg-muted", item.iconColor)}>
                <item.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{item.title}</span>
                  {item.hasPlus && (
                    <Plus className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
                {item.description && (
                  <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                )}
              </div>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const AppLauncher = () => (
    <DropdownMenu open={appLauncherOpen} onOpenChange={setAppLauncherOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon"
          className="h-10 w-10 hover:bg-accent/50"
          data-testid="button-app-launcher"
        >
          <Grid3X3 className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80 p-4">
        <div className="grid grid-cols-3 gap-2">
          {setupItems.concat(evaluateItems.slice(0, 3)).map((item) => (
            <Link
              key={item.url}
              href={item.url}
              onClick={() => setAppLauncherOpen(false)}
              className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-accent/50 transition-colors"
              data-testid={`launcher-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <div className={cn("p-2 rounded-lg bg-muted", item.iconColor)}>
                <item.icon className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium text-center leading-tight">{item.title}</span>
            </Link>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t">
          <Link 
            href="/app" 
            onClick={() => setAppLauncherOpen(false)}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            View all apps
            <ChevronDown className="h-3 w-3 rotate-[-90deg]" />
          </Link>
        </div>
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
    <header className="sticky top-0 z-50 w-full bg-background border-b">
      {/* Microsoft-style top bar */}
      <div className="flex h-12 items-center">
        {/* Left section: App launcher + Logo */}
        <div className="flex items-center h-full">
          {/* App Launcher (Waffle) */}
          <div className="hidden lg:flex items-center justify-center w-12 h-full border-r">
            <AppLauncher />
          </div>

          {/* Logo Section */}
          <Link 
            href={variant === 'admin' || variant === 'admin-team' ? "/admin" : "/app"} 
            className="flex items-center gap-3 px-4 h-full hover:bg-accent/30 transition-colors"
            data-testid="link-logo"
          >
            {currentLogo ? (
              <img 
                src={currentLogo} 
                alt={branding.app_name} 
                className="h-8 w-auto max-w-[180px] object-contain"
              />
            ) : (
              <>
                <div className="flex items-center justify-center w-8 h-8 rounded bg-primary">
                  <Zap className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="text-lg font-semibold tracking-tight hidden sm:inline">
                  {branding.app_name}
                </span>
              </>
            )}
          </Link>

          {/* Divider */}
          <div className="hidden lg:block h-6 w-px bg-border mx-1" />
        </div>

        {/* Center section: Navigation */}
        <nav className="hidden lg:flex items-center gap-0.5 flex-1 px-2">
          {/* Home Link */}
          {topItems.map((item) => (
            <Link
              key={item.url}
              href={item.url}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-sm transition-colors",
                isActive(item.url) 
                  ? "text-foreground bg-accent" 
                  : "text-foreground/80 hover:text-foreground hover:bg-accent/50"
              )}
              data-testid={`link-${item.title.toLowerCase()}`}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </Link>
          ))}

          {/* Nav Dropdowns */}
          {navSections.map((section) => (
            <NavDropdown key={section.label} section={section} />
          ))}

          {/* Admin Link for admin users */}
          {user.role === 'admin' && (variant === 'user' || variant === 'team') && (
            <Link
              href="/admin"
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-sm transition-colors",
                isActive('/admin') 
                  ? "text-foreground bg-accent" 
                  : "text-foreground/80 hover:text-foreground hover:bg-accent/50"
              )}
              data-testid="link-admin-dashboard"
            >
              <Shield className="h-4 w-4" />
              {t('nav.adminDashboard')}
            </Link>
          )}
        </nav>

        <PhoneNumberDropdown />
        {/* Center section: Search */}
        <div className="flex-1 flex justify-center px-2 max-w-lg mx-auto">
          <GlobalSearch />
        </div>

        {/* Right section: Utilities */}
        <div className="flex items-center gap-1 px-2">
          {showNotifications && (
            <>
              <HeaderBannerNotifications />
              <NotificationBell />
            </>
          )}
          
          <LanguageSelector variant="compact" />
          <ThemeToggle />

          {/* Credits Badge - Desktop (display only) */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md border bg-muted/30">
            <Coins className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold">{remainingCredits.toLocaleString()}</span>
          </div>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="h-10 px-2 gap-2 hover:bg-accent/50"
                data-testid="button-user-menu"
              >
                <Avatar className="h-8 w-8 ring-2 ring-primary/20">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="h-3 w-3 opacity-60 hidden sm:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
              {/* User Info Header */}
              <div className="p-4 border-b bg-muted/30">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                    <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-base truncate">{userName}</p>
                    <p className="text-sm text-muted-foreground truncate">{userEmail}</p>
                    {isPaidPlan && (
                      <span className="inline-flex items-center mt-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide bg-gradient-to-r from-amber-400/90 to-yellow-500/90 text-amber-900">
                        {planDisplayName}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Credits Section (display only) */}
              <div className="p-3 border-b">
                <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border border-amber-200/50 dark:border-amber-800/30">
                  <div className="flex items-center gap-2">
                    <Coins className="h-5 w-5 text-amber-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t('sidebar.credits')}</p>
                      <p className="text-lg font-bold">{remainingCredits.toLocaleString()}</p>
                    </div>
                  </div>
                  {isPaidPlan && (
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200">
                      {planDisplayName}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Menu Items */}
              <div className="p-1">
                <DropdownMenuItem 
                  onClick={() => setLocation("/app/settings")}
                  className="cursor-pointer p-2.5 rounded-md"
                  data-testid="link-account-settings"
                >
                  <Settings className="mr-3 h-4 w-4" />
                  <span>{t('nav.settings', 'Settings')}</span>
                </DropdownMenuItem>
              </div>
              
              <DropdownMenuSeparator />
              
              {/* Log out */}
              <div className="p-1">
                <DropdownMenuItem 
                  onClick={handleLogout}
                  className="cursor-pointer p-2.5 rounded-md text-destructive focus:text-destructive"
                  data-testid="button-logout"
                >
                  <LogOut className="mr-3 h-4 w-4" />
                  <span>{t('auth.logout')}</span>
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile Menu Button */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="lg:hidden h-10 w-10"
                data-testid="button-mobile-menu"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 p-0 overflow-y-auto">
              <SheetHeader className="p-4 border-b bg-muted/30">
                <SheetTitle className="flex items-center gap-3">
                  {currentLogo ? (
                    <img 
                      src={currentLogo} 
                      alt={branding.app_name} 
                      className="h-8 w-auto max-w-[150px] object-contain"
                    />
                  ) : (
                    <>
                      <div className="flex items-center justify-center w-8 h-8 rounded bg-primary">
                        <Zap className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <span className="text-lg font-semibold">{branding.app_name}</span>
                    </>
                  )}
                </SheetTitle>
              </SheetHeader>
              
              <div className="p-2">
                {/* Credits on Mobile */}
                <div className="m-2 p-3 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border border-amber-200/50 dark:border-amber-800/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Coins className="h-5 w-5 text-amber-500" />
                      <span className="text-sm font-semibold">{t('sidebar.credits')}</span>
                    </div>
                    <span className="text-xl font-bold">{remainingCredits.toLocaleString()}</span>
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
