import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Info,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Inbox,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  isRead: boolean;
  link?: string;
  createdAt: string;
}

const mockNotifications: Notification[] = [
  {
    id: '1',
    title: 'New project assigned',
    message: 'Project "Aircraft Wing Assembly" has been assigned to you.',
    type: 'info',
    isRead: false,
    link: '/projects/1',
    createdAt: '5 minutes ago',
  },
  {
    id: '2',
    title: 'Supplier assessment due',
    message: 'Capacity assessment for "AeroParts Inc." is due in 3 days.',
    type: 'warning',
    isRead: false,
    link: '/capacity',
    createdAt: '1 hour ago',
  },
  {
    id: '3',
    title: 'Risk mitigation required',
    message: 'Critical risk "Material shortage" requires immediate attention.',
    type: 'error',
    isRead: false,
    link: '/risks',
    createdAt: '2 hours ago',
  },
  {
    id: '4',
    title: 'Document approved',
    message: 'Specification document v2.3 has been approved.',
    type: 'success',
    isRead: true,
    link: '/documents',
    createdAt: 'Yesterday',
  },
];

const typeIcons = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
};

const typeColors = {
  info: 'text-blue-500 bg-blue-50 dark:bg-blue-950',
  success: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950',
  warning: 'text-amber-500 bg-amber-50 dark:bg-amber-950',
  error: 'text-red-500 bg-red-50 dark:bg-red-950',
};

interface NotificationDropdownProps {
  unreadCount?: number;
}

function NotificationDropdown({ unreadCount: _initialUnread }: NotificationDropdownProps) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [open, setOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className="relative rounded-lg p-2 transition-colors hover:bg-accent">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 p-0" align="end" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {unreadCount} new
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
        </div>
        <Separator />
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-muted-foreground">
            <Inbox className="mb-2 h-8 w-8" />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          <ScrollArea className="max-h-80">
            {notifications.map((notification) => {
              const Icon = typeIcons[notification.type];
              return (
                <button
                  key={notification.id}
                  onClick={() => {
                    markAsRead(notification.id);
                    if (notification.link) navigate(notification.link);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-accent',
                    !notification.isRead && 'bg-accent/30',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                      typeColors[notification.type],
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-tight">
                        {notification.title}
                      </p>
                      {!notification.isRead && (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {notification.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60">
                      {notification.createdAt}
                    </p>
                  </div>
                </button>
              );
            })}
          </ScrollArea>
        )}
        <Separator />
        <div className="p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center text-xs"
            onClick={() => {
              navigate('/notifications');
              setOpen(false);
            }}
          >
            <ExternalLink className="mr-1 h-3.5 w-3.5" />
            View all notifications
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { NotificationDropdown };
