import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  User,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  FolderKanban,
  Package,
  Truck,
  Gauge,
  AlertTriangle,
  FileText,
  BarChart3,
  Bell,
  Shield,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebarStore } from '@/stores/sidebarStore';
import { useAuthStore } from '@/stores/authStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { usePermissions } from '@/hooks/usePermissions';
import { useLanguage } from '@/context/LanguageContext';

interface SidebarNavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  adminOnly?: boolean;
  badge?: number;
}

interface SidebarNavGroup {
  label?: string;
  items: SidebarNavItem[];
}

export function Sidebar() {
  const { isCollapsed, toggle } = useSidebarStore();
  const { state } = useAuthStore();
  const { roleMeta, isAdmin } = usePermissions();
  const { t } = useLanguage();
  const RoleIcon = roleMeta.icon;

  const navGroups: SidebarNavGroup[] = [
    {
      items: [
        { label: t('nav.dashboard', 'Dashboard'), icon: LayoutDashboard, path: '/dashboard' },
      ],
    },
    {
      label: t('dashboard.overview', 'Management'),
      items: [
        { label: t('nav.projects', 'Projects'), icon: FolderKanban, path: '/projects' },
        { label: t('nav.parts', 'Parts'), icon: Package, path: '/parts' },
        { label: 'Suppliers', icon: Truck, path: '/suppliers' },
      ],
    },
    {
      label: 'Analysis',
      items: [
        { label: t('nav.capacity', 'Capacity'), icon: Gauge, path: '/capacity' },
        { label: 'Risks', icon: AlertTriangle, path: '/risks' },
      ],
    },
    {
      label: 'Studio & System',
      items: [
        { label: t('nav.templates', 'Template Studio'), icon: Layers, path: '/templates' },
        { label: 'Documents', icon: FileText, path: '/documents' },
        { label: 'Reports', icon: BarChart3, path: '/reports' },
      ],
    },
    {
      items: [
        { label: t('header.notifications', 'Notifications'), icon: Bell, path: '/notifications', badge: 3 },
        { label: t('nav.admin', 'Admin'), icon: Shield, path: '/admin', adminOnly: true },
      ],
    },
  ];

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Brand Header */}
      <div
        className={cn(
          'flex h-16 items-center border-b border-sidebar-border px-4',
          isCollapsed ? 'justify-center' : 'justify-between',
        )}
      >
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            <img
              src="/capgemini-logo.svg"
              alt="Capgemini"
              className="h-9 w-9 rounded-xl object-contain drop-shadow-md shrink-0"
            />
            <div>
              <span className="text-sm font-bold tracking-tight text-sidebar-foreground flex items-center gap-1.5">
                Capgemini <span className="text-xs font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">CMF</span>
              </span>
              <p className="text-[10px] text-muted-foreground">Capacity Platform</p>
            </div>
          </div>
        )}
        {isCollapsed && (
          <img
            src="/capgemini-logo.svg"
            alt="Capgemini"
            className="h-9 w-9 rounded-xl object-contain drop-shadow-md"
          />
        )}
      </div>

      {/* Navigation List */}
      <ScrollArea className="flex-1 px-2.5 py-4">
        <TooltipProvider delayDuration={0}>
          <nav className="space-y-4">
            {navGroups.map((group, groupIndex) => (
              <div key={groupIndex}>
                {group.label && !isCollapsed && (
                  <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </p>
                )}
                <ul className="space-y-1">
                  {group.items
                    .filter((item) => !item.adminOnly || isAdmin)
                    .map((item) => (
                      <NavItemComp
                        key={item.path}
                        item={item}
                        collapsed={isCollapsed}
                      />
                    ))}
                </ul>
                {groupIndex < navGroups.length - 1 && (
                  <Separator className="my-3 bg-sidebar-border/50" />
                )}
              </div>
            ))}
          </nav>
        </TooltipProvider>
      </ScrollArea>

      {/* User Footer Profile Card */}
      <div className="border-t border-sidebar-border p-3 bg-muted/20">
        {isCollapsed ? (
          <div className="flex justify-center">
            <NavLink to="/profile" title="View Profile">
              <Avatar className="h-8 w-8 cursor-pointer ring-2 ring-sidebar-border hover:ring-primary transition-all">
                {state.user?.avatar ? (
                  <AvatarImage src={state.user.avatar} alt="User" />
                ) : null}
                <AvatarFallback initials={`${state.user?.firstName?.[0] ?? ''}${state.user?.lastName?.[0] ?? ''}`} />
              </Avatar>
            </NavLink>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <NavLink to="/profile" className="flex items-center gap-3 flex-1 overflow-hidden group">
              <Avatar className="h-9 w-9 ring-2 ring-sidebar-border group-hover:ring-primary transition-all shrink-0">
                {state.user?.avatar ? (
                  <AvatarImage src={state.user.avatar} alt="User" />
                ) : null}
                <AvatarFallback initials={`${state.user?.firstName?.[0] ?? ''}${state.user?.lastName?.[0] ?? ''}`} />
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-xs font-bold text-sidebar-foreground group-hover:text-primary transition-colors">
                  {state.user?.firstName} {state.user?.lastName}
                </p>
                <Badge variant="outline" className={cn('mt-0.5 px-1.5 py-0 text-[10px] font-semibold border border-sidebar-border', roleMeta.badgeClass)}>
                  <RoleIcon className="mr-1 h-2.5 w-2.5 inline-block" />
                  {roleMeta.shortTitle}
                </Badge>
              </div>
            </NavLink>
            <NavLink
              to="/profile"
              title="Profile Settings"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <User className="h-4 w-4" />
            </NavLink>
          </div>
        )}
      </div>

      {/* Collapse Toggle Arrow */}
      <button
        onClick={toggle}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-card text-foreground shadow-md transition-all duration-200 hover:scale-110 hover:border-primary hover:bg-primary hover:text-primary-foreground"
      >
        {isCollapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>
    </aside>
  );
}

function NavItemComp({ item, collapsed }: { item: any; collapsed: boolean }) {
  const { pathname } = useLocation();
  const isActive = pathname.startsWith(item.path) && (item.path === '/dashboard' ? pathname === '/dashboard' : true);

  const linkContent = (
    <NavLink
      to={item.path}
      className={cn(
        'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-200',
        isActive
          ? 'bg-primary text-primary-foreground shadow-sm font-bold'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        collapsed && 'justify-center px-2',
      )}
    >
      <item.icon className={cn('h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110', isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground')} />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge !== undefined && (
            <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-[10px]">
              {item.badge}
            </Badge>
          )}
        </>
      )}
    </NavLink>
  );

  if (collapsed) {
    return (
      <li>
        <Tooltip>
          <TooltipTrigger asChild>
            {linkContent}
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-2 bg-popover text-popover-foreground border-border">
            {item.label}
            {item.badge !== undefined && (
              <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                {item.badge}
              </Badge>
            )}
          </TooltipContent>
        </Tooltip>
      </li>
    );
  }

  return <li>{linkContent}</li>;
}
