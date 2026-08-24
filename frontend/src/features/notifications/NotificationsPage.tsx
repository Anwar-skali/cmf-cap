import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useNotificationsQuery } from '@/hooks/queries/useNotificationsQuery';
import {
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useDeleteNotificationMutation,
} from '@/hooks/mutations/useNotificationMutations';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Bell,
  CheckCheck,
  Trash2,
  Circle,
  Loader2,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Info,
  Search,
  RotateCcw,
  ExternalLink,
  Filter,
  Sparkles,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { ErrorState } from '@/components/ui/error-state';
import type { Notification, NotificationType } from '@/types';

export default function NotificationsPage() {
  const { t } = useLanguage();
  const { data: notificationsData, isLoading, error, refetch } = useNotificationsQuery(1, 100);

  const markReadMutation = useMarkNotificationReadMutation();
  const markAllReadMutation = useMarkAllNotificationsReadMutation();
  const deleteMutation = useDeleteNotificationMutation();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('all');

  const items = useMemo(() => notificationsData?.items || [], [notificationsData]);

  // KPI Metrics Calculation
  const unreadCount = useMemo(() => items.filter((n) => !n.isRead).length, [items]);
  const actionRequiredCount = useMemo(
    () => items.filter((n) => (!n.isRead && (n.type === 'error' || n.type === 'warning'))).length,
    [items],
  );
  const readCount = useMemo(() => items.filter((n) => n.isRead).length, [items]);

  // Filtered Notifications List
  const filteredNotifications = useMemo(() => {
    return items.filter((n) => {
      // Status filter
      if (statusFilter === 'unread' && n.isRead) return false;
      if (statusFilter === 'read' && !n.isRead) return false;

      // Type filter
      if (typeFilter !== 'all' && n.type !== typeFilter) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = n.title?.toLowerCase().includes(q);
        const matchMsg = n.message?.toLowerCase().includes(q);
        if (!matchTitle && !matchMsg) return false;
      }

      return true;
    });
  }, [items, statusFilter, typeFilter, searchQuery]);

  if (error) {
    return (
      <ErrorState
        title="Failed to load notifications"
        message={error?.message}
        onRetry={refetch}
      />
    );
  }

  const getTypeIcon = (type: NotificationType) => {
    switch (type) {
      case 'error':
        return <ShieldAlert className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />;
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />;
      case 'info':
      default:
        return <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />;
    }
  };

  const getTypeBadgeClass = (type: NotificationType) => {
    switch (type) {
      case 'error':
        return 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30';
      case 'warning':
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30';
      case 'success':
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
      case 'info':
      default:
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto pb-12">
      {/* ── Page Header ── */}
      <PageHeader
        title={t('notifications_page.title', 'Platform Notifications & Alerts')}
        description={
          unreadCount > 0
            ? `${t('notifications_page.unread', 'Unread')}: ${unreadCount} ${t('notifications_page.action_required', 'Action Required')}`
            : t('notifications_page.description', 'Real-time alert dispatch for capacity overloads, milestone gates, and risk assignments')
        }
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending || unreadCount === 0}
            className="gap-1.5 font-semibold text-xs"
          >
            {markAllReadMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5 text-primary" />
            )}
            {t('notifications_page.mark_all_read', 'Mark All as Read')}
          </Button>
        </div>
      </PageHeader>

      {/* ── KPI Metric Summary Cards ── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm border-l-4 border-l-primary hover:shadow transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0 px-4 pt-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground">
              {t('notifications_page.all', 'Total Notifications')}
            </CardTitle>
            <Bell className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {isLoading ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <div className="text-2xl font-bold font-mono text-foreground">{items.length}</div>
            )}
            <p className="text-[11px] text-muted-foreground mt-0.5">Platform alerts recorded</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-amber-500 hover:shadow transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0 px-4 pt-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground">
              {t('notifications_page.unread', 'Unread Alerts')}
            </CardTitle>
            <Circle className="h-4 w-4 text-amber-500 fill-amber-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {isLoading ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
                {unreadCount}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-0.5">Pending user attention</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-rose-500 hover:shadow transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0 px-4 pt-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground">
              {t('notifications_page.action_required', 'Action Required')}
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {isLoading ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
                {actionRequiredCount}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-0.5">Critical overloads & risks</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-emerald-500 hover:shadow transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0 px-4 pt-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground">
              {t('notifications_page.read', 'Read & Resolved')}
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {isLoading ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {readCount}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-0.5">Archived notifications</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Filter Controls Toolbar ── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 bg-card p-3.5 rounded-xl border border-border/60 shadow-sm">
        {/* Keyword Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('notifications_page.search_placeholder', 'Filter notifications by keyword...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-background/80 text-xs"
          />
        </div>

        {/* Read Status Filter */}
        <div className="w-full md:w-44">
          <Select
            value={statusFilter}
            onValueChange={(val: 'all' | 'unread' | 'read') => setStatusFilter(val)}
          >
            <SelectTrigger className="bg-background/80 text-xs">
              <SelectValue placeholder="Status: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                {t('notifications_page.all', 'All Notifications')} ({items.length})
              </SelectItem>
              <SelectItem value="unread" className="text-xs">
                {t('notifications_page.unread', 'Unread Only')} ({unreadCount})
              </SelectItem>
              <SelectItem value="read" className="text-xs">
                {t('notifications_page.read', 'Read Only')} ({readCount})
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Severity Type Filter */}
        <div className="w-full md:w-44">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="bg-background/80 text-xs">
              <SelectValue placeholder="Type: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                {t('notifications_page.all_types', 'All Types')}
              </SelectItem>
              <SelectItem value="error" className="text-xs">
                🚨 {t('notifications_page.filter_error', 'Critical Errors')}
              </SelectItem>
              <SelectItem value="warning" className="text-xs">
                ⚠️ {t('notifications_page.filter_warning', 'Warnings')}
              </SelectItem>
              <SelectItem value="success" className="text-xs">
                ✅ {t('notifications_page.filter_success', 'Success')}
              </SelectItem>
              <SelectItem value="info" className="text-xs">
                ℹ️ {t('notifications_page.filter_info', 'Information')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reset Button */}
        {(searchQuery || typeFilter !== 'all' || statusFilter !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setTypeFilter('all');
              setStatusFilter('all');
            }}
            className="text-xs text-muted-foreground hover:text-foreground gap-1 px-2.5 shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
      </div>

      {/* ── Notification Items List ── */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-border/60">
              <CardContent className="p-4 flex items-start gap-4">
                <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredNotifications.length > 0 ? (
        <div className="space-y-3">
          {filteredNotifications.map((notification) => {
            const isUnread = !notification.isRead;
            return (
              <Card
                key={notification.id}
                className={cn(
                  'border-border/60 shadow-xs transition-all duration-200 hover:shadow-soft group overflow-hidden',
                  isUnread
                    ? 'bg-card/90 border-l-4 border-l-primary'
                    : 'bg-muted/10 opacity-90 hover:opacity-100',
                )}
              >
                <CardContent className="flex items-start gap-4 p-4 sm:p-5">
                  {/* Leading Icon with Theme Pill */}
                  <div
                    className={cn(
                      'p-2.5 rounded-xl border flex items-center justify-center shrink-0 mt-0.5',
                      getTypeBadgeClass(notification.type),
                    )}
                  >
                    {getTypeIcon(notification.type)}
                  </div>

                  {/* Main Content Body */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3
                        className={cn(
                          'text-sm leading-snug',
                          isUnread ? 'font-bold text-foreground' : 'font-medium text-foreground/80',
                        )}
                      >
                        {notification.title}
                      </h3>

                      {isUnread && (
                        <Badge
                          variant="outline"
                          className="bg-primary/10 text-primary border-primary/20 text-[10px] font-semibold uppercase px-1.5 py-0"
                        >
                          New
                        </Badge>
                      )}

                      <Badge
                        variant="outline"
                        className={cn('capitalize text-[10px] font-mono', getTypeBadgeClass(notification.type))}
                      >
                        {notification.type}
                      </Badge>
                    </div>

                    {notification.message && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {notification.message}
                      </p>
                    )}

                    <div className="flex items-center gap-4 pt-1 text-[11px] text-muted-foreground/70 font-mono">
                      <span>
                        {notification.createdAt
                          ? new Date(notification.createdAt).toLocaleString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Just now'}
                      </span>

                      {notification.link && (
                        <Link
                          to={notification.link}
                          className="text-primary hover:underline font-semibold flex items-center gap-1"
                        >
                          {t('notifications_page.view_details', 'View Details')}
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Trailing Action Buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    {isUnread && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title={t('notifications_page.mark_as_read', 'Mark as read')}
                        onClick={() => markReadMutation.mutate(notification.id)}
                        disabled={markReadMutation.isPending}
                        className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
                      >
                        <CheckCheck className="h-4 w-4" />
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      title={t('notifications_page.delete', 'Delete notification')}
                      onClick={() => deleteMutation.mutate(notification.id)}
                      disabled={deleteMutation.isPending}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-border/60">
          <CardContent className="py-12">
            <EmptyState
              icon={<Bell className="h-10 w-10 text-muted-foreground/40" />}
              title={t('notifications_page.no_notifications', 'No notifications found')}
              description={t(
                'notifications_page.no_notifications_desc',
                "You're all caught up! New notifications and capacity alerts will appear here.",
              )}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
