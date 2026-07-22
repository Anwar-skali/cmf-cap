import { NavLink, useLocation } from 'react-router-dom';
import {
  User,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebarStore } from '@/stores/sidebarStore';
import { useAuthStore } from '@/stores/authStore';
import { Logo } from '@/components/brand/logo';
import { APP_NAME } from '@/lib/constants';
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
import { navGroups, type NavItem } from '@/config/navigation';

function Sidebar() {
  const { isCollapsed, toggle } = useSidebarStore();
  const { state } = useAuthStore();
  const isAdmin = state.user?.role === 'admin';

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64',
      )}
    >
      <div
        className={cn(
          'flex h-16 items-center border-b border-sidebar-border/50 px-4',
          isCollapsed ? 'justify-center' : 'justify-between',
        )}
      >
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-xs font-bold text-primary-foreground shadow-soft">
              CM
            </div>
            <span className="text-sm font-semibold tracking-tight">{APP_NAME}</span>
          </div>
        )}
        {isCollapsed && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-xs font-bold text-primary-foreground shadow-soft">
            CM
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 px-2 py-4">
        <TooltipProvider delayDuration={0}>
          <nav className="space-y-4">
            {navGroups.map((group, groupIndex) => (
              <div key={groupIndex}>
                {group.label && !isCollapsed && (
                  <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/40">
                    {group.label}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {group.items
                    .filter((item) => !item.adminOnly || isAdmin)
                    .map((item) => (
                      <NavItem
                        key={item.path}
                        item={item}
                        collapsed={isCollapsed}
                      />
                    ))}
                </ul>
                {groupIndex < navGroups.length - 1 && (
                  <Separator className="my-3 bg-sidebar-border/30" />
                )}
              </div>
            ))}
          </nav>
        </TooltipProvider>
      </ScrollArea>

      <div className="border-t border-sidebar-border/50 p-3">
        {isCollapsed ? (
          <div className="flex justify-center">
            <Avatar className="h-8 w-8 cursor-pointer ring-2 ring-sidebar-border/30">
              {state.user?.avatar ? (
                <AvatarImage src={state.user.avatar} alt="User" />
              ) : null}
              <AvatarFallback initials={`${state.user?.firstName?.[0] ?? ''}${state.user?.lastName?.[0] ?? ''}`} />
            </Avatar>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 ring-2 ring-sidebar-border/30">
              {state.user?.avatar ? (
                <AvatarImage src={state.user.avatar} alt="User" />
              ) : null}
              <AvatarFallback initials={`${state.user?.firstName?.[0] ?? ''}${state.user?.lastName?.[0] ?? ''}`} />
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium">
                {state.user?.firstName} {state.user?.lastName}
              </p>
              <p className="truncate text-xs text-sidebar-foreground/50 capitalize">
                {state.user?.role}
              </p>
            </div>
            <NavLink
              to="/profile"
              className="rounded-lg p-1.5 transition-colors hover:bg-sidebar-accent/50"
            >
              <User className="h-4 w-4" />
            </NavLink>
          </div>
        )}
      </div>

      <button
        onClick={toggle}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border bg-background shadow-soft-md transition-all duration-200 hover:scale-105 hover:shadow-soft-lg active:scale-95"
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

function NavItem({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const { pathname } = useLocation();
  const isActive = pathname.startsWith(item.path) && (item.path === '/dashboard' ? pathname === '/dashboard' : true);

  const linkContent = (
    <NavLink
      to={item.path}
      className={cn(
        'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
        collapsed && 'justify-center px-2',
      )}
    >
      <item.icon className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-110" />
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
          <TooltipContent side="right" className="flex items-center gap-2">
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

export { Sidebar };
