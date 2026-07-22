import { useRecentActivitiesQuery } from '@/hooks/queries/useActivityQuery';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Activity, Clock, User, FileText, AlertTriangle, Building2, Package } from 'lucide-react';
import { ErrorState } from '@/components/ui/error-state';

const iconMap: Record<string, typeof Activity> = {
  project: Building2,
  risk: AlertTriangle,
  part: Package,
  document: FileText,
  user: User,
};

export default function ActivityPage() {
  const { data: activities, isLoading, error, refetch } = useRecentActivitiesQuery();
  if (error) return <ErrorState title="Failed to load activity log" message={error?.message} onRetry={refetch} />;
  if (isLoading) return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full rounded-xl" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Activity Log" description="Track all platform activities" />

      {activities && activities.length > 0 ? (
        <div className="space-y-2">
          {activities.map((activity) => {
            const Icon = iconMap[activity.entityType] ?? Activity;
            return (
              <Card key={activity.id} className="transition-all duration-200 hover:shadow-soft-md">
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{activity.user?.firstName || activity.user?.lastName || 'System'}</span>
                      {' '}{activity.action}{' '}
                      <span className="font-medium">{activity.entityName}</span>
                    </p>
                    {activity.details && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {typeof activity.details === 'string' ? activity.details : JSON.stringify(activity.details)}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground/60">
                      <Clock className="h-3 w-3" />
                      {new Date(activity.createdAt).toLocaleString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Activity className="h-8 w-8" />}
          title="No activity recorded yet"
          description="Activities will appear here as users interact with the platform."
        />
      )}
    </div>
  );
}
