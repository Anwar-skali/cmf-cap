import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface StatsCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isUp: boolean;
    label?: string;
  };
  loading?: boolean;
  onClick?: () => void;
  className?: string;
  iconClassName?: string;
}

function StatsCard({
  label,
  value,
  icon: Icon,
  trend,
  loading = false,
  onClick,
  className,
  iconClassName,
}: StatsCardProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const TrendIcon = trend?.isUp ? TrendingUp : TrendingDown;
  const trendColor = trend?.isUp ? 'text-emerald-600' : 'text-red-600';

  return (
    <Card
      className={cn(
        'transition-all duration-200 hover:shadow-soft-md hover:-translate-y-0.5',
        onClick && 'cursor-pointer',
        className,
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {trend && (
              <div className="flex items-center gap-1 text-xs">
                <TrendIcon className={cn('h-3 w-3', trendColor)} />
                <span className={cn('font-medium', trendColor)}>{trend.value}%</span>
                {trend.label && (
                  <span className="text-muted-foreground">{trend.label}</span>
                )}
              </div>
            )}
          </div>
          {Icon && (
            <div
              className={cn(
                'rounded-xl bg-primary/10 p-3 text-primary ring-1 ring-primary/10',
                iconClassName,
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export { StatsCard };
