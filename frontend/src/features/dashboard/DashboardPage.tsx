import { Link } from 'react-router-dom';
import { useDashboardStatsQuery } from '@/hooks/queries/useDashboardQuery';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, AlertTriangle, ClipboardList, Package, Activity, ArrowUp, ArrowDown } from 'lucide-react';
import { ErrorState } from '@/components/ui/error-state';

export default function DashboardPage() {
  const { data: stats, isLoading, error, refetch } = useDashboardStatsQuery();
  if (error) return <ErrorState title="Failed to load dashboard" message={error?.message} onRetry={refetch} />;

  if (isLoading) return <div className="space-y-6"><Skeleton className="h-8 w-48" /><div className="grid grid-cols-4 gap-4"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-24 rounded-xl" /></div></div>;

  const cards = [
    { title: 'Total Projects', value: stats?.totalProjects ?? 0, icon: Building2, href: '/projects', color: 'text-blue-600', trend: { value: 12, isUp: true } },
    { title: 'Active Projects', value: stats?.activeProjects ?? 0, icon: Activity, href: '/projects', color: 'text-emerald-600', trend: { value: 8, isUp: true } },
    { title: 'Open Risks', value: stats?.openRisks ?? 0, icon: AlertTriangle, href: '/risks', color: 'text-amber-600', trend: { value: 3, isUp: false } },
    { title: 'Critical Risks', value: stats?.criticalRisks ?? 0, icon: AlertTriangle, href: '/risks', color: 'text-red-600', trend: { value: 5, isUp: true } },
    { title: 'Total Parts', value: stats?.totalParts ?? 0, icon: Package, href: '/projects', color: 'text-purple-600' },
    { title: 'Pending Assessments', value: stats?.pendingAssessments ?? 0, icon: ClipboardList, href: '/capacity', color: 'text-yellow-600' },
    { title: 'Total Suppliers', value: stats?.totalSuppliers ?? 0, icon: Building2, href: '/capacity', color: 'text-indigo-600' },
    { title: 'Active Suppliers', value: stats?.activeSuppliers ?? 0, icon: Building2, href: '/capacity', color: 'text-teal-600' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-balance">Overview of your CMF platform</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, idx) => (
          <Link key={card.title} to={card.href} className="group">
            <Card className="transition-all duration-200 hover:shadow-soft-md hover:-translate-y-0.5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">{card.title}</CardTitle>
                <card.icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.recentActivities && stats.recentActivities.length > 0 ? (
              <div className="space-y-1">
                {stats.recentActivities.slice(0, 10).map((activity) => (
                  <div key={activity.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted/50">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                      <Activity className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-muted-foreground">{activity.action}</span>
                    <span className="text-muted-foreground">{activity.entityType}:</span>
                    <span className="font-medium">{activity.entityName}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(activity.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Activity className="h-8 w-8 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">No recent activity</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
              <span className="text-sm font-medium">Projects completion</span>
              <span className="text-sm font-bold text-emerald-600">78%</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
              <span className="text-sm font-medium">Risk resolution rate</span>
              <span className="text-sm font-bold text-amber-600">62%</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
              <span className="text-sm font-medium">Supplier compliance</span>
              <span className="text-sm font-bold text-blue-600">94%</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
              <span className="text-sm font-medium">On-time delivery</span>
              <span className="text-sm font-bold text-indigo-600">85%</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
