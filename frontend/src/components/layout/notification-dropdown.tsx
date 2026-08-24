import { useState, useMemo } from 'react';
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
  Loader2,
  ShieldAlert,
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
import { useNotificationsQuery, useUnreadCountQuery } from '@/hooks/queries/useNotificationsQuery';
import {
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} from '@/hooks/mutations/useNotificationMutations';
import { useLanguage } from '@/context/LanguageContext';
import type { NotificationType } from '@/types';

const typeIcons: Record<NotificationType, typeof Info> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: ShieldAlert,
};

const typeColors: Record<NotificationType, string> = {
  info: 'text-blue-500 bg-blue-50 dark:bg-blue-950',
  success: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950',
  warning: 'text-amber-500 bg-amber-50 dark:bg-amber-950',
  error: 'text-rose-500 bg-rose-50 dark:bg-rose-950',
};

interface NotificationDropdownProps {
  unreadCount?: number;
}

export function NotificationDropdown({ unreadCount: _initialUnread }: NotificationDropdownProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  const { data: notificationsData, isLoading } = useNotificationsQuery(1, 10);
  const { data: unreadData } = useUnreadCountQuery();

  const markReadMutation = useMarkNotificationReadMutation();
  const markAllReadMutation = useMarkAllNotificationsReadMutation();

  const notifications = useMemo(() => notificationsData?.items || [], [notificationsData]);
  const liveUnreadCount = unreadData?.count ?? notifications.filter((n) => !n.isRead).length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
          title={t('header.notifications', 'Notifications')}
        >
          <Bell className="h-5 w-5" />
          {liveUnreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground animate-pulse">
              {liveUnreadCount > 99 ? '99+' : liveUnreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-84 p-0 shadow-lg border-border" align="end" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 bg-muted/20">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground">
              {t('header.notifications', 'Notifications')}
            </h3>
            {liveUnreadCount > 0 && (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-primary/10 text-primary border-primary/20 font-semibold">
                {liveUnreadCount} {t('notifications_page.unread', 'unread')}
              </Badge>
            )}
          </div>
          {liveUnreadCount > 0 && (
            <button
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="flex items-center gap-1 text-xs text-primary hover:underline font-semibold cursor-pointer"
            >
              {markAllReadMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCheck className="h-3.5 w-3.5" />
              )}
              {t('notifications_page.mark_all_read', 'Mark all read')}
            </button>
          )}
        </div>
        <Separator />
        {isLoading ? (
          <div className="p-4 space-y-2">
            <div className="h-10 bg-muted/40 animate-pulse rounded-lg" />
            <div className="h-10 bg-muted/40 animate-pulse rounded-lg" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-muted-foreground">
            <Inbox className="mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-xs">{t('notifications_page.no_notifications', 'No notifications')}</p>
          </div>
        ) : (
          <ScrollArea className="max-h-80">
            {notifications.map((notification) => {
              const Icon = typeIcons[notification.type] || Info;
              return (
                <button
                  key={notification.id}
                  onClick={() => {
                    if (!notification.isRead) {
                      markReadMutation.mutate(notification.id);
                    }
                    if (notification.link) navigate(notification.link);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-accent border-b border-border/40 last:border-0 cursor-pointer',
                    !notification.isRead ? 'bg-primary/5' : 'bg-transparent',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border/40',
                      typeColors[notification.type],
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={cn(
                          'text-xs leading-snug truncate',
                          !notification.isRead ? 'font-bold text-foreground' : 'font-medium text-foreground/80',
                        )}
                      >
                        {notification.title}
                      </p>
                      {!notification.isRead && (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="line-clamp-2 text-[11px] text-muted-foreground">
                      {notification.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 font-mono">
                      {notification.createdAt
                        ? new Date(notification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </p>
                  </div>
                </button>
              );
            })}
          </ScrollArea>
        )}
        <Separator />
        <div className="p-2 bg-muted/20">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center text-xs font-semibold"
            onClick={() => {
              navigate('/notifications');
              setOpen(false);
            }}
          >
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            {t('notifications_page.all', 'View all notifications')}
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
