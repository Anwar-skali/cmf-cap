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

function Breadcrumb() {
  const { pathname } = useLocation();

  const segments = useMemo(() => {
    const parts = pathname.split('/').filter(Boolean);
    return parts.map((part, index) => {
      const path = '/' + parts.slice(0, index + 1).join('/');
      const label = routeLabels[part] || part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' ');
      return { label, path, isLast: index === parts.length - 1 };
    });
  }, [pathname]);

  if (segments.length === 0) return null;

  return (
    <nav className="mb-1 flex items-center gap-1 text-sm text-muted-foreground">
      <Link
        to="/dashboard"
        className="flex items-center gap-1 transition-colors hover:text-foreground"
      >
        <Home className="h-3.5 w-3.5" />
      </Link>
      {segments.map((segment) => (
        <div key={segment.path} className="flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5" />
          {segment.isLast ? (
            <span className="font-medium text-foreground">{segment.label}</span>
          ) : (
            <Link
              to={segment.path}
              className="transition-colors hover:text-foreground"
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
