import { useNotificationsQuery } from '@/hooks/queries/useNotificationsQuery';
import { useMarkNotificationReadMutation, useMarkAllNotificationsReadMutation, useDeleteNotificationMutation } from '@/hooks/mutations/useNotificationMutations';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { Bell, CheckCheck, Trash2, Circle, Loader2 } from 'lucide-react';
import { ErrorState } from '@/components/ui/error-state';

export default function NotificationsPage() {
  const { data: notifications, isLoading, error, refetch } = useNotificationsQuery();
  if (error) return <ErrorState title="Failed to load notifications" message={error?.message} onRetry={refetch} />;
  const markReadMutation = useMarkNotificationReadMutation();
  const markAllReadMutation = useMarkAllNotificationsReadMutation();
  const deleteMutation = useDeleteNotificationMutation();

  if (isLoading) return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full rounded-xl" /></div>;

  const unreadCount = notifications?.items?.filter((n) => !n.isRead).length ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Notifications"
        description={unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'View and manage your notifications'}
      >
        <Button variant="outline" size="sm" onClick={() => markAllReadMutation.mutate()} disabled={markAllReadMutation.isPending || unreadCount === 0}>
          {markAllReadMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCheck className="mr-2 h-4 w-4" />
          )}
          Mark All Read
        </Button>
      </PageHeader>

      {notifications && notifications.items && notifications.items.length > 0 ? (
        <div className="space-y-2">
          {notifications.items.map((notification) => (
            <Card key={notification.id} className="transition-all duration-200 hover:shadow-soft-md">
              <CardContent className="flex items-start gap-4 p-4">
                <div className="mt-1">
                  {notification.isRead ? (
                    <Bell className="h-5 w-5 text-muted-foreground/50" />
                  ) : (
                    <Circle className="h-5 w-5 text-primary fill-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm', !notification.isRead && 'font-medium')}>{notification.title}</p>
                  {notification.message && <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>}
                  <p className="text-xs text-muted-foreground/60 mt-2">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {!notification.isRead && (
                    <Button variant="ghost" size="sm" onClick={() => markReadMutation.mutate(notification.id)} disabled={markReadMutation.isPending}>
                      <CheckCheck className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(notification.id)} disabled={deleteMutation.isPending}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Bell className="h-8 w-8" />}
          title="No notifications yet"
          description="You're all caught up! New notifications will appear here."
        />
      )}
    </div>
  );
}
