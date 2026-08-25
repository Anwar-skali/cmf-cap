import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const routeLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  projects: 'Projects',
  new: 'New',
  parts: 'Parts',
  suppliers: 'Suppliers',
  capacity: 'Capacity',
  risks: 'Risks',
  documents: 'Documents',
  notifications: 'Notifications',
  activity: 'Activity',
  profile: 'Profile',
  settings: 'Settings',
  edit: 'Edit',
};

function formatSegmentLabel(part: string, previousPart?: string): string {
  if (routeLabels[part]) {
    return routeLabels[part];
  }
  // Check if it's a UUID or long hash
  if (/^[0-9a-fA-F-]{16,}$/.test(part)) {
    const prefix = previousPart ? `${previousPart.charAt(0).toUpperCase() + previousPart.slice(1, -1)} #` : '#';
    return `${prefix}${part.slice(0, 8)}`;
  }
  return part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' ');
}

function Breadcrumb() {
  const { pathname } = useLocation();

  const segments = useMemo(() => {
    const parts = pathname.split('/').filter(Boolean);
    return parts.map((part, index) => {
      const path = '/' + parts.slice(0, index + 1).join('/');
      const label = formatSegmentLabel(part, parts[index - 1]);
      return { label, path, isLast: index === parts.length - 1 };
    });
  }, [pathname]);

  if (segments.length === 0) return null;

  return (
    <nav className="flex items-center gap-1 text-xs font-medium text-muted-foreground overflow-hidden whitespace-nowrap">
      <Link
        to="/dashboard"
        className="flex items-center gap-1 transition-colors hover:text-foreground shrink-0"
      >
        <Home className="h-3.5 w-3.5" />
      </Link>
      {segments.map((segment) => (
        <div key={segment.path} className="flex items-center gap-1 min-w-0">
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
          {segment.isLast ? (
            <span className="font-semibold text-foreground truncate max-w-[140px] sm:max-w-[200px]" title={segment.label}>
              {segment.label}
            </span>
          ) : (
            <Link
              to={segment.path}
              className="transition-colors hover:text-foreground truncate max-w-[100px] sm:max-w-[160px]"
              title={segment.label}
            >
              {segment.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}

export { Breadcrumb };
