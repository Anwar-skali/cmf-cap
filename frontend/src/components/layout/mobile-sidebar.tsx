import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { Logo } from '@/components/brand/logo';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { navGroups } from '@/config/navigation';

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
}

function MobileSidebar({ open, onClose }: MobileSidebarProps) {
  const { state } = useAuthStore();
  const { pathname } = useLocation();
  const isAdmin = state.user?.role === 'admin';

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    onClose();
  }, [pathname]);

  const initials = `${state.user?.firstName?.[0] ?? ''}${state.user?.lastName?.[0] ?? ''}`;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r bg-sidebar text-sidebar-foreground shadow-xl"
          >
            <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
              <div className="flex items-center gap-2">
              <Logo size="sm" />
            </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 transition-colors hover:bg-sidebar-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <ScrollArea className="flex-1 px-3 py-4">
              <nav className="space-y-4">
                {navGroups.map((group, groupIndex) => (
                  <div key={groupIndex}>
                    {group.label && (
                      <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
                        {group.label}
                      </p>
                    )}
                    <ul className="space-y-1">
                      {group.items
                        .filter((item) => !item.adminOnly || isAdmin)
                        .map((item) => {
                          const isActive = pathname.startsWith(item.path);
                          return (
                            <li key={item.path}>
                              <NavLink
                                to={item.path}
                                className={cn(
                                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                                  isActive
                                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                                )}
                              >
                                <item.icon className="h-5 w-5 shrink-0" />
                                <span className="flex-1 truncate">{item.label}</span>
                                {item.badge !== undefined && (
                                  <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-[10px]">
                                    {item.badge}
                                  </Badge>
                                )}
                              </NavLink>
                            </li>
                          );
                        })}
                    </ul>
                    {groupIndex < navGroups.length - 1 && (
                      <Separator className="my-3 bg-sidebar-border" />
                    )}
                  </div>
                ))}
              </nav>
            </ScrollArea>

            <div className="border-t border-sidebar-border p-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  {state.user?.avatar ? (
                    <AvatarImage src={state.user.avatar} alt="User" />
                  ) : null}
                  <AvatarFallback initials={initials} />
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium">
                    {state.user?.firstName} {state.user?.lastName}
                  </p>
                  <p className="truncate text-xs text-sidebar-foreground/60 capitalize">
                    {state.user?.role}
                  </p>
                </div>
                <NavLink
                  to="/profile"
                  className="rounded-lg p-2 transition-colors hover:bg-sidebar-accent"
                >
                  <User className="h-4 w-4" />
                </NavLink>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export { MobileSidebar };
