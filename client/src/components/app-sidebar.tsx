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
import { Settings, ChevronsUpDown, LogOut, Coins, ChevronRight } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
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
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';
import { useBranding } from "@/components/BrandingProvider";
import { AuthStorage } from "@/lib/auth-storage";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
  credits?: number;
  planType?: string;
}

interface NavItemProps {
  title: string;
  url: string;
  isActive: boolean;
  onClick: () => void;
  isCollapsed: boolean;
}

function NavItem({ title, url, isActive, onClick, isCollapsed }: NavItemProps) {
  const content = (
    <Link href={url} onClick={onClick}>
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] font-medium transition-all duration-200",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        )}
        data-testid={`link-${title.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <span className={cn(isCollapsed && "hidden")}>{title}</span>
      </div>
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {title}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

interface NavSectionProps {
  label?: string;
  items: { title: string; url: string }[];
  location: string;
  onNavClick: () => void;
  isCollapsed: boolean;
}

function NavSection({ label, items, location, onNavClick, isCollapsed }: NavSectionProps) {
  return (
    <div className="space-y-1">
      {label && !isCollapsed && (
        <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          {label}
        </div>
      )}
      {label && isCollapsed && (
        <div className="h-px mx-2 my-2 bg-sidebar-border" />
      )}
      <div className="space-y-0.5">
        {items.map((item) => (
          <NavItem
            key={item.url}
            title={item.title}
            url={item.url}
            isActive={location === item.url}
            onClick={onNavClick}
            isCollapsed={isCollapsed}
          />
        ))}
      </div>
    </div>
  );
}

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { t } = useTranslation();
  const { branding, currentLogo, showLogo, showFavicon } = useBranding();
  const { setOpenMobile, isMobile, state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const topItems = [
    { title: t('nav.analytics', 'Analytics'), url: "/app/analytics" },
    { title: t('nav.quickCrm', 'Quick CRM'), url: "/app/crm" },
    { title: t('nav.callHistory', 'Call History'), url: "/app/calls" },
  ];

  const setupItems = [
    { title: t('nav.phoneNumbers'), url: "/app/phone-numbers" },
    { title: t('nav.aiStaff', 'AI Staff'), url: "/app/agents" },
    { title: t('nav.knowledgeBase'), url: "/app/knowledge-base" },
    { title: t('nav.departments', 'Departments'), url: "/app/departments" },
    { title: t('nav.batchCall', 'Batch Call'), url: "/app/campaigns" },
  ];

  const manageItems = [
    { title: t('nav.appointments'), url: "/app/flows/appointments" },
    { title: t('nav.forms'), url: "/app/flows/forms" },
  ];

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  if (userLoading || !user) {
    return null;
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

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-4 border-b border-sidebar-border/50">
        <div className="flex items-center justify-between gap-3 group-data-[collapsible=icon]:hidden">
          <div className="flex-1 min-w-0">
            {showLogo && (
              <img 
                src={currentLogo!} 
                alt={branding.app_name} 
                className={cn(
                  "w-auto object-contain",
                  branding.logo_size === 'small' ? 'h-6 max-w-[100px]' : 
                  branding.logo_size === 'large' ? 'h-10 max-w-[160px]' : 
                  branding.logo_size === 'xlarge' ? 'h-12 max-w-[180px]' : 'h-8 max-w-[140px]'
                )}
              />
            )}
          </div>
          <SidebarTrigger 
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground" 
            data-testid="button-sidebar-toggle" 
          />
        </div>
        <div className="hidden group-data-[collapsible=icon]:flex flex-col items-center gap-3">
          {showFavicon && (
            <img 
              src={branding.favicon_url!} 
              alt={branding.app_name} 
              className="h-7 w-7 object-contain"
            />
          )}
          <SidebarTrigger 
            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground" 
            data-testid="button-sidebar-toggle-collapsed" 
          />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4 space-y-6">
        <NavSection
          items={topItems}
          location={location}
          onNavClick={handleNavClick}
          isCollapsed={isCollapsed}
        />

        <NavSection
          label={t('sidebar.setup', 'Setup')}
          items={setupItems}
          location={location}
          onNavClick={handleNavClick}
          isCollapsed={isCollapsed}
        />

        <NavSection
          label={t('sidebar.manage', 'Manage')}
          items={manageItems}
          location={location}
          onNavClick={handleNavClick}
          isCollapsed={isCollapsed}
        />

        <div className="space-y-0.5">
          <NavItem
            title={t('nav.settings', 'Settings')}
            url="/app/settings"
            isActive={location === "/app/settings" || location.startsWith("/app/settings")}
            onClick={handleNavClick}
            isCollapsed={isCollapsed}
          />
        </div>

        {user.role === 'admin' && (
          <NavSection
            label={t('nav.administration')}
            items={[{ title: t('nav.adminDashboard'), url: "/admin" }]}
            location={location}
            onNavClick={handleNavClick}
            isCollapsed={isCollapsed}
          />
        )}

        {!isCollapsed && (
          <div className="mx-1 mt-4">
            <div className="rounded-2xl bg-gradient-to-br from-muted/80 to-muted/40 p-4 border border-border/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-background/80 flex items-center justify-center">
                    <Coins className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="text-[13px] font-medium text-foreground/80">{t('sidebar.credits')}</span>
                </div>
                {isPaidPlan ? (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide bg-primary/10 text-primary border border-primary/20">
                    {planDisplayName}
                  </span>
                ) : (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="h-7 px-2.5 text-[12px] font-medium text-muted-foreground hover:text-foreground rounded-lg"
                    onClick={() => setLocation("/app/upgrade")}
                    data-testid="button-upgrade-inline"
                  >
                    {t('sidebar.upgrade')}
                    <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                  </Button>
                )}
              </div>
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {remainingCredits.toLocaleString()}
              </div>
            </div>
          </div>
        )}
      </SidebarContent>

      <SidebarFooter className="px-3 py-3 border-t border-sidebar-border/50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              className={cn(
                "flex items-center gap-3 w-full px-2 py-2 rounded-xl transition-colors",
                "hover:bg-sidebar-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isCollapsed && "justify-center px-0"
              )}
              data-testid="button-user-menu"
            >
              <Avatar className="h-9 w-9 ring-2 ring-background shadow-sm">
                <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-primary-foreground text-sm font-semibold">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-[14px] font-semibold text-foreground truncate">
                      {userName}
                    </div>
                    <div className="text-[12px] text-muted-foreground truncate">
                      {t('sidebar.myWorkspace')}
                    </div>
                  </div>
                  <ChevronsUpDown className="h-4 w-4 text-muted-foreground/60" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-72 rounded-xl p-1.5">
            <div className="px-3 py-3 mb-1">
              <div className="flex items-center gap-3">
                <Avatar className="h-11 w-11 ring-2 ring-background shadow-sm">
                  <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-primary-foreground text-base font-semibold">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-semibold text-foreground truncate">
                    {userName}
                  </div>
                  <div className="text-[13px] text-muted-foreground truncate">
                    {user.email}
                  </div>
                </div>
              </div>
            </div>

            <div className="mx-2 mb-2 rounded-xl bg-muted/50 p-3 border border-border/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[13px] font-medium text-foreground/70">{t('sidebar.credits')}</span>
                </div>
                {isPaidPlan ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-primary/10 text-primary">
                    {planDisplayName}
                  </span>
                ) : (
                  <Button 
                    variant="default" 
                    size="sm"
                    className="h-6 px-2.5 text-[11px] font-semibold rounded-lg"
                    onClick={() => setLocation("/app/upgrade")}
                    data-testid="button-upgrade-dropdown"
                  >
                    {t('sidebar.upgrade')}
                  </Button>
                )}
              </div>
              <div className="text-xl font-bold text-foreground">
                {remainingCredits.toLocaleString()}
              </div>
            </div>

            <DropdownMenuSeparator className="my-1.5" />
            
            <DropdownMenuItem 
              onClick={() => setLocation("/app/settings")}
              className="rounded-lg py-2.5 px-3 cursor-pointer"
              data-testid="link-account-settings"
            >
              <Settings className="mr-2.5 h-4 w-4 text-muted-foreground" />
              <span className="text-[14px]">{t('nav.accountSettings')}</span>
            </DropdownMenuItem>
            
            <DropdownMenuSeparator className="my-1.5" />
            
            <DropdownMenuItem 
              onClick={handleLogout}
              className="rounded-lg py-2.5 px-3 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
              data-testid="button-logout"
            >
              <LogOut className="mr-2.5 h-4 w-4" />
              <span className="text-[14px]">{t('auth.logout')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
