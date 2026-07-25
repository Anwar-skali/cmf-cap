import { useEffect, useState } from 'react';
import { useDashboardStatsQuery } from '@/hooks/queries/useDashboardQuery';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';

// ── Professional Gradient Radial Ring ────────────────────────────────────────
interface RingConfig {
  value: number;
  rawValue?: number;
  label: string;
  description: string;
  gradientFrom: string;
  gradientTo: string;
  glowColor: string;
}

function RadialRing({
  value,
  rawValue,
  label,
  description,
  gradientFrom,
  gradientTo,
  glowColor,
  size = 160,
  strokeWidth = 14,
}: RingConfig & { size?: number; strokeWidth?: number }) {
  const [animated, setAnimated] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animated / 100) * circumference;
  const gradientId = `grad-${label.replace(/\s+/g, '-')}`;
  const filterId = `glow-${label.replace(/\s+/g, '-')}`;

  useEffect(() => {
    let startTime: number | null = null;
    const target = Math.min(Math.max(value, 0), 100);
    const duration = 1400;

    const step = (ts: number) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setAnimated(eased * target);
      if (progress < 1) requestAnimationFrame(step);
    };
    const raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const display = rawValue !== undefined ? rawValue : Math.round(animated);
  const displaySuffix = rawValue !== undefined ? '' : '%';

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Ring with glow */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        {/* Ambient glow backdrop */}
        <div
          className="absolute rounded-full"
          style={{
            width: size * 0.7,
            height: size * 0.7,
            background: `radial-gradient(circle, ${glowColor}30 0%, transparent 70%)`,
            filter: 'blur(12px)',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />

        <svg
          width={size}
          height={size}
          style={{ transform: 'rotate(-90deg)', position: 'relative', zIndex: 1 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={gradientFrom} />
              <stop offset="100%" stopColor={gradientTo} />
            </linearGradient>
            <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Track ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(148,163,184,0.12)"
            strokeWidth={strokeWidth}
          />

          {/* Glow duplicate arc behind */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth + 6}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            opacity={0.25}
            filter={`url(#${filterId})`}
          />

          {/* Main progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>

        {/* Center value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ zIndex: 2 }}>
          <span
            className="font-extrabold leading-none tabular-nums"
            style={{
              fontSize: size * 0.18,
              background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {display}{displaySuffix}
          </span>
        </div>
      </div>

      {/* Label & description */}
      <div className="text-center space-y-1 px-2">
        <p
          className="text-xs font-bold uppercase tracking-[0.15em]"
          style={{
            background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {label}
        </p>
        <p className="text-xs text-muted-foreground leading-snug">{description}</p>
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { usePermissions } from '@/hooks/usePermissions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PlusCircle, FolderKanban, Gauge, AlertTriangle, FileText, Truck, Package } from 'lucide-react';

// ── Dashboard Page ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: stats, isLoading, error, refetch } = useDashboardStatsQuery();
  const { state } = useAuthStore();
  const { roleMeta, isBuyer, isCapacityManager, isSQD, isAdmin } = usePermissions();

  const RoleIcon = roleMeta.icon;

  if (error) return <ErrorState title="Failed to load dashboard" message={error?.message} onRetry={refetch} />;

  if (isLoading) return (
    <div className="space-y-8">
      <Skeleton className="h-9 w-56 rounded-xl" />
      <div className="grid grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64 rounded-3xl" />)}
      </div>
    </div>
  );


  const totalProjects  = stats?.totalProjects  ?? 0;
  const activeProjects = stats?.activeProjects ?? 0;
  const openRisks      = stats?.openRisks      ?? 0;
  const criticalRisks  = stats?.criticalRisks  ?? 0;
  const totalSuppliers = stats?.totalSuppliers ?? 0;
  const activeSuppliers = stats?.activeSuppliers ?? 0;
  const pendingAssessments = stats?.pendingAssessments ?? 0;

  const activeProjectsPct   = totalProjects  > 0 ? Math.round((activeProjects  / totalProjects)  * 100) : 0;
  const criticalRiskPct     = openRisks      > 0 ? Math.round((criticalRisks   / openRisks)       * 100) : 0;
  const supplierActivePct   = totalSuppliers > 0 ? Math.round((activeSuppliers / totalSuppliers)  * 100) : 0;
  const openRiskIntensityPct = Math.min(openRisks * 4, 100);

  const topRings: (RingConfig & { size?: number; strokeWidth?: number })[] = [
    {
      value: activeProjectsPct,
      rawValue: activeProjects,
      label: 'Active Projects',
      description: `${activeProjects} of ${totalProjects} projects running`,
      gradientFrom: '#818cf8',
      gradientTo: '#6366f1',
      glowColor: '#6366f1',
    },
    {
      value: openRiskIntensityPct,
      rawValue: openRisks,
      label: 'Open Risks',
      description: `${openRisks} risks open across all projects`,
      gradientFrom: '#38bdf8',
      gradientTo: '#0ea5e9',
      glowColor: '#0ea5e9',
    },
    {
      value: criticalRiskPct,
      rawValue: criticalRisks,
      label: 'Critical Risks',
      description: `${criticalRiskPct}% of open risks are critical`,
      gradientFrom: '#fb7185',
      gradientTo: '#e11d48',
      glowColor: '#e11d48',
    },
    {
      value: supplierActivePct,
      rawValue: activeSuppliers,
      label: 'Active Suppliers',
      description: `${activeSuppliers} of ${totalSuppliers} suppliers active`,
      gradientFrom: '#34d399',
      gradientTo: '#059669',
      glowColor: '#059669',
    },
  ];

  const bottomRings: (RingConfig & { size?: number; strokeWidth?: number })[] = [
    {
      value: supplierActivePct,
      label: 'Supplier Compliance',
      description: `${supplierActivePct}% of suppliers are active`,
      gradientFrom: '#a78bfa',
      gradientTo: '#7c3aed',
      glowColor: '#7c3aed',
      size: 210,
      strokeWidth: 18,
    },
    {
      value: Math.min(pendingAssessments * 8, 100),
      rawValue: pendingAssessments,
      label: 'Pending Assessments',
      description: `${pendingAssessments} assessments awaiting review`,
      gradientFrom: '#fbbf24',
      gradientTo: '#d97706',
      glowColor: '#d97706',
      size: 210,
      strokeWidth: 18,
    },
  ];

  return (
    <div className="space-y-8" style={{ animation: 'fadeSlideIn 0.5s ease both' }}>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Role Workspace Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl border bg-card/60 backdrop-blur-md shadow-soft">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight">
              Welcome back, {state.user?.firstName || 'User'}!
            </h1>
            <Badge variant="outline" className={cn('px-2.5 py-1 text-xs font-bold border flex items-center gap-1.5 shadow-sm', roleMeta.badgeClass)}>
              <RoleIcon className="h-3.5 w-3.5" />
              {roleMeta.title}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            {roleMeta.description}
          </p>
        </div>

        {/* Role Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {(isBuyer || isAdmin) && (
            <>
              <Button asChild size="sm" variant="default" className="gap-1.5 rounded-xl">
                <Link to="/projects/new">
                  <FolderKanban className="h-4 w-4" /> + New Project
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="gap-1.5 rounded-xl">
                <Link to="/parts/new">
                  <Package className="h-4 w-4" /> + New Part
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="gap-1.5 rounded-xl">
                <Link to="/suppliers/new">
                  <Truck className="h-4 w-4" /> + New Supplier
                </Link>
              </Button>
            </>
          )}

          {(isCapacityManager || isAdmin) && (
            <>
              <Button asChild size="sm" variant="default" className="gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white">
                <Link to="/capacity/new">
                  <Gauge className="h-4 w-4" /> + New Assessment
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="gap-1.5 rounded-xl">
                <Link to="/capacity">
                  <Gauge className="h-4 w-4" /> Review Capacity Lines
                </Link>
              </Button>
            </>
          )}

          {(isSQD || isAdmin) && (
            <>
              <Button asChild size="sm" variant="default" className="gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
                <Link to="/risks/new">
                  <AlertTriangle className="h-4 w-4" /> + Log Quality Risk
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="gap-1.5 rounded-xl">
                <Link to="/documents">
                  <FileText className="h-4 w-4" /> Upload Quality Audit
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>


      {/* Top KPI Rings Panel */}
      <div
        className="rounded-3xl border p-8"
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.04) 0%, rgba(14,165,233,0.04) 50%, rgba(5,150,105,0.04) 100%)',
          backdropFilter: 'blur(20px)',
          borderColor: 'rgba(148,163,184,0.12)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
        }}
      >
        <div className="mb-8 text-center">
          <h2 className="text-lg font-bold tracking-widest uppercase text-foreground/70">Platform Overview</h2>
          <p className="text-sm text-muted-foreground mt-1">Key indicators derived from live data</p>
        </div>

        <div className="grid grid-cols-2 gap-y-10 gap-x-6 sm:grid-cols-4">
          {topRings.map((ring) => (
            <RadialRing key={ring.label} {...ring} size={158} strokeWidth={13} />
          ))}
        </div>
      </div>

      {/* Bottom Panels */}
      <div className="grid gap-6 md:grid-cols-2">
        {bottomRings.map((ring) => (
          <div
            key={ring.label}
            className="rounded-3xl border flex flex-col items-center py-10 px-6 gap-2"
            style={{
              background: `linear-gradient(160deg, ${ring.glowColor}08 0%, transparent 60%)`,
              backdropFilter: 'blur(20px)',
              borderColor: `${ring.glowColor}25`,
              boxShadow: `0 4px 24px ${ring.glowColor}12`,
            }}
          >
            <p className="text-sm font-semibold text-foreground/60 uppercase tracking-widest mb-4">{ring.label}</p>
            <RadialRing {...ring} />
          </div>
        ))}
      </div>
    </div>
  );
}
