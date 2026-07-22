import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Breadcrumb } from '@/components/layout/breadcrumb';

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  showBreadcrumb?: boolean;
}

function PageHeader({ title, description, children, className, showBreadcrumb = true }: PageHeaderProps) {
  return (
    <div className={cn('mb-8 space-y-1', className)}>
      {showBreadcrumb && <Breadcrumb />}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground text-balance">{description}</p>
          )}
        </div>
        {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
      </div>
    </div>
  );
}

export { PageHeader };
