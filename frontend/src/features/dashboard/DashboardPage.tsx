import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useLanguage } from '@/context/LanguageContext';
import { useAuthStore } from '@/stores/authStore';
import { KPICard } from '@/components/ui/KPICard';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useCmfDashboardData } from '@/hooks/useCmfDashboardData';
import {
  FolderKanban,
  Gauge,
  ShieldCheck,
  PlusCircle,
  Sparkles,
  ChevronRight,
  UserCheck,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  Users,
  Zap,
  Activity,
  Target,
  TrendingUp,
  Layers,
  Package,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from 'recharts';

const PIE_COLORS = ['#0066CC', '#ef4444', '#10b981', '#f59e0b'];

// ─── Reusable section container (same card styling used in DynamicDashboard) ─
function SectionCard({ title, subtitle, icon: Icon, children }: {
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-6 shadow-md shadow-slate-900/5 space-y-4">
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-blue-600">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Mini stat row inside section cards ──────────────────────────────────────
function StatRow({ label, value, color = 'text-foreground' }: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <span className={`text-sm font-extrabold ${color}`}>{value}</span>
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { roleMeta, isBuyer, isCapacityManager, isSQD, isAdmin } = usePermissions();
  const { state: authState } = useAuthStore();

  const cmf = useCmfDashboardData();

  const currentUser = authState.user;
  const userName = currentUser
    ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim()
    : '';

  const RoleIcon = roleMeta.icon;

  if (cmf.error) {
    return <ErrorState title="Failed to load CMF dashboard" message={cmf.error?.message} onRetry={cmf.refetch} />;
  }

  if (cmf.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const welcomeTitle = userName
    ? `${t('dashboard.welcome_title', 'CMF Command Center')}, ${userName}!`
    : `${t('dashboard.welcome_title', 'CMF Command Center')}!`;

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* ── Top Hero Dark Banner (unchanged design) ─────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-[#0a101d] text-white p-6 sm:p-8 lg:p-10 shadow-xl border border-slate-800">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col justify-between gap-6">
          {/* Breadcrumb & Role */}
          <div className="flex items-center justify-between">
            <nav className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <span className="hover:text-white transition-colors cursor-pointer" onClick={() => navigate('/')}>
                {t('dashboard.home', 'Home')}
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-slate-200">{t('nav.dashboard', 'Dashboard')}</span>
            </nav>

            <div className="flex items-center gap-3">
              <Badge variant="outline" className="border-slate-700 bg-slate-900/90 text-blue-400 px-3.5 py-1.5 text-xs font-bold flex items-center gap-2 rounded-full shadow-xs">
                <RoleIcon className="h-4 w-4 text-blue-400" />
                <span>{roleMeta.title}</span>
              </Badge>
              {currentUser && (
                <Badge variant="outline" className="border-slate-700 bg-slate-900/60 text-slate-300 px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 rounded-full">
                  <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span>{currentUser.email}</span>
                </Badge>
              )}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-3 max-w-4xl">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
              {welcomeTitle}
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
              {t(
                'dashboard.welcome_description',
                'The Capacity Management Framework (CMF) is an automated & centralized calculation engine for strategic capacity forecasts. It is a technical enabler for long-term volume forecasts, for any object defined by Stellantis Global Purchasing & Quality mapped to production criteria and volumes.'
              )}
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {(isBuyer || isAdmin) && (
              <Button
                onClick={() => navigate('/projects/new')}
                size="sm"
                className="bg-[#0066CC] hover:bg-[#0052A3] text-white font-bold rounded-full px-5 py-2 text-xs shadow-md shadow-blue-500/20 gap-2 cursor-pointer"
              >
                <PlusCircle className="h-4 w-4" /> {t('dashboard.create_new_project', 'Create New Project')}
              </Button>
            )}

            {(isCapacityManager || isAdmin) && (
              <Button
                onClick={() => navigate('/capacity')}
                size="sm"
                variant="outline"
                className="border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800 font-semibold rounded-full px-5 py-2 text-xs gap-2 cursor-pointer"
              >
                <Gauge className="h-4 w-4 text-amber-400" /> {t('dashboard.view_capacity_matrix', 'Capacity Matrix')}
              </Button>
            )}

            {(isSQD || isAdmin) && (
              <Button
                onClick={() => navigate('/risks')}
                size="sm"
                variant="outline"
                className="border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800 font-semibold rounded-full px-5 py-2 text-xs gap-2 cursor-pointer"
              >
                <ShieldCheck className="h-4 w-4 text-emerald-400" /> {t('dashboard.sqd_audits', 'SQD Audits')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── 6 CMF Top-Level KPI Cards (Executive Overview) ──────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-blue-600" />
            <span>{t('dashboard.overview', 'CMF Executive KPIs')}</span>
          </h2>
          <span className="text-xs font-semibold text-muted-foreground">
            {t('dashboard.updated_live', 'Updated live')} • {new Date().toLocaleTimeString()}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <KPICard
            variant="ltos"
            title="Total CMF"
            value={cmf.totalCmf}
            icon={FolderKanban}
            subtitle="Total CMF project structures tracked across platforms"
            trend={{ value: `${cmf.totalCmf} structures`, isPositive: true }}
            actionText="View All"
            onClickAction={() => navigate('/projects')}
          />

          <KPICard
            variant="ltos"
            title="Total Capacity"
            value={`${(cmf.totalCapacity / 1000).toFixed(1)}K`}
            icon={Gauge}
            subtitle="Available production capacity units across suppliers"
            trend={{
              value: cmf.totalCapacity > 0 ? `${Math.round(cmf.utilizationPct)}% utilized` : '0 capacity',
              isPositive: cmf.utilizationPct <= 85,
            }}
            actionText="Capacity Matrix"
            onClickAction={() => navigate('/capacity')}
          />

          <KPICard
            variant="ltos"
            title="Utilization"
            value={`${cmf.utilizationPct}%`}
            icon={Activity}
            subtitle="Current capacity utilization across all lines"
            trend={{
              value: cmf.utilizationPct > 90 ? 'Critical Load' : cmf.utilizationPct > 80 ? 'High Load' : 'Healthy Load',
              isPositive: cmf.utilizationPct <= 85,
            }}
            actionText="Details"
            onClickAction={() => navigate('/capacity')}
          />

          <KPICard
            variant="ltos"
            title="Capacity Gap"
            value={`${(cmf.capacityGap / 1000).toFixed(1)}K`}
            icon={Zap}
            subtitle="Allocated minus used — available buffer capacity"
            trend={{
              value: cmf.capacityGap > 0 ? `${(cmf.capacityGap / 1000).toFixed(1)}K buffer` : 'No buffer',
              isPositive: cmf.capacityGap >= 0,
            }}
            actionText="Analyse"
            onClickAction={() => navigate('/capacity')}
          />

          <KPICard
            variant="ltos"
            title="Active Suppliers"
            value={cmf.activeSuppliers}
            icon={Users}
            subtitle="Suppliers with active capacity assessments"
            trend={{
              value: `${cmf.activeSuppliers} of ${cmf.totalSuppliers || cmf.activeSuppliers} active`,
              isPositive: cmf.activeSuppliers > 0,
            }}
            actionText="Suppliers"
            onClickAction={() => navigate('/suppliers')}
          />

          <KPICard
            variant="ltos"
            title="Projects at Risk"
            value={cmf.projectsAtRisk}
            icon={AlertTriangle}
            subtitle="Projects flagged with open risks or capacity shortfalls"
            trend={{
              value: cmf.projectsAtRisk > 0 ? `${cmf.projectsAtRisk} open risks` : '0 risks',
              isPositive: cmf.projectsAtRisk === 0,
            }}
            actionText="View Risks"
            onClickAction={() => navigate('/risks')}
          />
        </div>
      </div>

      {/* ── CMF Section Panels ───────────────────────────────────────────── */}
      <div className="space-y-6 pt-2">
        <div className="flex items-center justify-between border-b border-border pb-3 px-1">
          <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <span>CMF Analytics</span>
          </h2>
        </div>

        {/* Row 1: Capacity Overview */}
        <div className="w-full">

          {/* ── Capacity Overview ─────────────────────────────────────── */}
          <SectionCard title="Capacity Overview" subtitle="Production capacity breakdown (units/week)" icon={Gauge}>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: 'Installed Max Capacity', value: cmf.availableCapacity.toLocaleString(), color: 'text-slate-700 dark:text-slate-200' },
                { label: 'Required Demand',        value: cmf.allocatedCapacity.toLocaleString(), color: 'text-slate-700 dark:text-slate-200' },
                { label: 'Secured (Confirmed)',    value: cmf.usedCapacity.toLocaleString(),      color: 'text-slate-700 dark:text-slate-200' },
                { label: 'Capacity Headroom',      value: cmf.remainingCapacity.toLocaleString(), color: 'text-slate-700 dark:text-slate-200' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3 space-y-0.5">
                  <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
                  <p className={`text-lg font-extrabold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
            {/* Utilization % bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-muted-foreground">Utilization</span>
                <span className={cmf.utilizationPct > 90 ? 'text-rose-600' : cmf.utilizationPct > 75 ? 'text-amber-600' : 'text-emerald-600'}>
                  {cmf.utilizationPct}%
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    cmf.utilizationPct > 90 ? 'bg-rose-500' : cmf.utilizationPct > 75 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${cmf.utilizationPct}%` }}
                />
              </div>
            </div>
            {/* Monthly trend chart */}
            {cmf.capacityTrend.length > 0 ? (
              <div className="h-48 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cmf.capacityTrend}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="month" stroke="#888888" fontSize={11} />
                    <YAxis stroke="#888888" fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={(v: number) => v.toLocaleString()} />
                    <Legend fontSize={11} />
                    <Line type="monotone" dataKey="available" stroke="#94a3b8" strokeWidth={1.5} dot={false} name="Installed Max" strokeDasharray="4 2" />
                    <Line type="monotone" dataKey="allocated" stroke="#f59e0b" strokeWidth={2} dot={false} name="Required Demand" />
                    <Line type="monotone" dataKey="used"      stroke="#0066CC" strokeWidth={2.5} dot={false} name="Secured (Confirmed)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 w-full flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-center p-4">
                <Gauge className="h-8 w-8 text-slate-400 mb-1.5 opacity-60" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No monthly capacity assessments recorded</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Timeline will update dynamically as capacity entries are logged</p>
              </div>
            )}
          </SectionCard>
        </div>

        {/* Row 2: SQD Overview */}
        <div className="w-full">
          {/* ── SQD Overview ──────────────────────────────────────────── */}
          <SectionCard title="SQD Overview" subtitle="Supplier Quality & Delivery performance" icon={ShieldCheck}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Open Quality Issues',    value: cmf.openQualityIssues,    icon: AlertTriangle, color: 'text-slate-700 dark:text-slate-200' },
                  { label: 'Critical Issues',        value: cmf.criticalQualityIssues, icon: AlertTriangle, color: 'text-slate-700 dark:text-slate-200' },
                  { label: 'Open Actions',           value: cmf.openActions,           icon: CheckCircle2,  color: 'text-slate-700 dark:text-slate-200' },
                  { label: 'Supplier Quality Status',value: cmf.supplierQualityStatus, icon: ShieldCheck,   color: 'text-slate-700 dark:text-slate-200' },
                ].map(({ label, value, icon: RowIcon, color }) => (
                  <div key={label} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3 space-y-1 flex flex-col">
                    <div className={`flex items-center gap-1.5 ${color}`}>
                      <RowIcon className="h-3.5 w-3.5" />
                      <p className="text-[11px] font-bold">{label}</p>
                    </div>
                    <p className={`text-xl font-extrabold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
              <div className="h-52 w-full">
                {cmf.sqdPie.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={cmf.sqdPie}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {cmf.sqdPie.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend fontSize={11} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-center p-4">
                    <ShieldCheck className="h-8 w-8 text-emerald-500 mb-1.5" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">100% Quality Conformance</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">No open quality issues or critical risks registered</p>
                  </div>
                )}
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* ── Operational Indicators ────────────────────────────────────────── */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <BarChart3 className="h-4.5 w-4.5 text-indigo-600" />
            <span>Operational Indicators</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <KPICard
            variant="ltos"
            title="Project Use Cases"
            value={cmf.projectUseCases}
            icon={Layers}
            subtitle="Total project use cases defined across all CMF structures"
            trend={{
              value: `${cmf.projectUseCases} total use cases`,
              isPositive: true,
            }}
            actionText="View Projects"
            onClickAction={() => navigate('/projects')}
          />

          <KPICard
            variant="ltos"
            title="Active Parts"
            value={cmf.activeParts}
            icon={Package}
            subtitle="Total active parts tracked across CMF structures"
            trend={{
              value: cmf.totalParts > 0 ? `${cmf.activeParts} of ${cmf.totalParts} active` : `${cmf.activeParts} active parts`,
              isPositive: true,
            }}
            actionText="View Parts"
            onClickAction={() => navigate('/parts')}
          />

          <KPICard
            variant="ltos"
            title="Open Quality Issues"
            value={cmf.openQualityIssues}
            icon={ShieldCheck}
            subtitle="Active SQD non-conformities under review"
            trend={{
              value: cmf.criticalQualityIssues > 0 ? `${cmf.criticalQualityIssues} critical` : cmf.openQualityIssues > 0 ? `${cmf.openQualityIssues} open` : '0 issues',
              isPositive: cmf.criticalQualityIssues === 0 && cmf.openQualityIssues === 0,
            }}
            actionText="SQD Risks"
            onClickAction={() => navigate('/risks')}
          />

          <KPICard
            variant="ltos"
            title="Resolved Risks"
            value={cmf.mitigatedRisks}
            icon={CheckCircle2}
            subtitle="Risks successfully mitigated or closed"
            trend={{
              value: cmf.mitigatedRisks > 0 ? `${cmf.mitigatedRisks} resolved` : 'None resolved yet',
              isPositive: cmf.mitigatedRisks > 0,
            }}
            actionText="View Risks"
            onClickAction={() => navigate('/risks')}
          />

          <KPICard
            variant="ltos"
            title="Supplier Status"
            value={cmf.supplierQualityStatus}
            icon={UserCheck}
            subtitle="Aggregate supplier quality health indicator"
            trend={{
              value: cmf.supplierQualityStatus === 'GREEN' ? 'All Clear' : cmf.supplierQualityStatus === 'YELLOW' ? 'Monitor Risks' : 'Action Needed',
              isPositive: cmf.supplierQualityStatus === 'GREEN',
            }}
            actionText="Suppliers"
            onClickAction={() => navigate('/suppliers')}
          />
        </div>
      </div>
    </div>
  );
}
