import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRisksQuery } from '@/hooks/queries/useRisksQuery';
import { useProjectsQuery } from '@/hooks/queries/useProjectsQuery';
import { useDeleteRiskMutation, useUpdateRiskMutation } from '@/hooks/mutations/useRiskMutations';
import { usePermissions } from '@/hooks/usePermissions';
import { useLanguage } from '@/context/LanguageContext';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KPICard } from '@/components/ui/KPICard';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Search,
  ChevronRight,
  AlertTriangle,
  Filter,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileCode,
  Printer,
  Table as TableIcon,
  Kanban,
  RefreshCw,
  MoreHorizontal,
  Eye,
  Trash2,
  Edit,
  Building2,
  User,
  Calendar,
  Layers,
  ArrowUpDown,
  Sparkles,
  X,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { Risk, RiskSeverity, RiskStatus, RiskProbability } from '@/types';
import { getRiskLevelVariant, getStatusVariant } from '@/lib/utils';
import {
  calculateRiskScore,
  getRiskScoreLevel,
  formatProbabilityLabel,
  formatSeverityLabel,
  formatStatusLabel,
  exportRisksToCsv,
  exportRisksToJson,
} from './utils/riskUtils';
import { RiskKanbanBoard } from './components/RiskKanbanBoard';
import { QuickMitigateModal } from './components/QuickMitigateModal';
import { RiskQuickViewModal } from './components/RiskQuickViewModal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

type ViewMode = 'table' | 'kanban';

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#0066CC',
  low: '#10b981',
};

export default function RisksPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { isSQD, roleMeta, isAdmin } = usePermissions();

  // Queries
  const { data: risksData, isLoading, error, refetch } = useRisksQuery();
  const { data: projectsData } = useProjectsQuery();
  const deleteMutation = useDeleteRiskMutation();
  const updateMutation = useUpdateRiskMutation();

  // State
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [search, setSearch] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [quickFilter, setQuickFilter] = useState<string>('all');

  // Modals state
  const [activeMitigateRisk, setActiveMitigateRisk] = useState<Risk | null>(null);
  const [activeQuickViewRisk, setActiveQuickViewRisk] = useState<Risk | null>(null);
  const [riskToDelete, setRiskToDelete] = useState<Risk | null>(null);

  const rawRisks = useMemo(() => risksData?.items || [], [risksData]);

  // Extract unique categories & projects
  const categories = useMemo(() => {
    const set = new Set<string>();
    rawRisks.forEach((r) => {
      if (r.riskType) set.add(r.riskType);
    });
    return Array.from(set);
  }, [rawRisks]);

  const projects = useMemo(() => {
    const map = new Map<string, string>();
    rawRisks.forEach((r) => {
      if (r.projectName) map.set(r.projectName, r.projectName);
    });
    return Array.from(map.keys());
  }, [rawRisks]);

  // Executive KPI Calculations
  const totalCount = rawRisks.length;
  const criticalCount = rawRisks.filter((r) => r.severity === 'critical' || r.severity === 'high').length;
  const openCount = rawRisks.filter((r) => !r.status || r.status === 'open').length;
  const inMitigationCount = rawRisks.filter((r) => r.status === 'mitigating').length;
  const resolvedCount = rawRisks.filter((r) => r.status === 'mitigated' || r.status === 'closed').length;
  const resolutionRate = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 100;

  // Filter pipeline
  const filteredRisks = useMemo(() => {
    return rawRisks.filter((r) => {
      // 1. Text search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = (r.title || '').toLowerCase().includes(q);
        const matchesDesc = (r.description || '').toLowerCase().includes(q);
        const matchesProject = (r.projectName || '').toLowerCase().includes(q);
        const matchesOwner = (r.assignedTo || '').toLowerCase().includes(q);
        const matchesType = (r.riskType || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesProject && !matchesOwner && !matchesType) {
          return false;
        }
      }

      // 2. Severity filter
      if (selectedSeverity !== 'all' && (r.severity || '').toLowerCase() !== selectedSeverity.toLowerCase()) {
        return false;
      }

      // 3. Status filter
      if (selectedStatus !== 'all' && (r.status || 'open').toLowerCase() !== selectedStatus.toLowerCase()) {
        return false;
      }

      // 4. Category filter
      if (selectedCategory !== 'all' && (r.riskType || '').toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }

      // 5. Project filter
      if (selectedProject !== 'all' && (r.projectName || '') !== selectedProject) {
        return false;
      }

      // 6. Quick filters
      if (quickFilter === 'capacity') {
        if (!r.riskType?.toLowerCase().includes('capacity') && (r.utilizationRate == null || r.utilizationRate < 95)) return false;
      } else if (quickFilter === 'milestone') {
        if (!r.riskType?.toLowerCase().includes('milestone') && !r.riskType?.toLowerCase().includes('delay')) return false;
      } else if (quickFilter === 'quality') {
        if (!r.riskType?.toLowerCase().includes('quality') && !r.riskType?.toLowerCase().includes('non-conformity') && !r.riskType?.toLowerCase().includes('sqd')) return false;
      } else if (quickFilter === 'critical') {
        if (r.severity !== 'critical') return false;
      } else if (quickFilter === 'high') {
        if (r.severity !== 'critical' && r.severity !== 'high') return false;
      } else if (quickFilter === 'open') {
        if (r.status !== 'open' && r.status !== undefined) return false;
      } else if (quickFilter === 'overdue') {
        const isOverdue = r.dueDate && new Date(r.dueDate) < new Date() && r.status !== 'closed' && r.status !== 'mitigated';
        if (!isOverdue) return false;
      } else if (quickFilter === 'sqd') {
        if (!r.riskType?.toLowerCase().includes('quality') && !r.riskType?.toLowerCase().includes('sqd') && !r.riskType?.toLowerCase().includes('capacity')) return false;
      }

      return true;
    });
  }, [
    rawRisks,
    search,
    selectedSeverity,
    selectedStatus,
    selectedCategory,
    selectedProject,
    quickFilter,
  ]);

  const hasActiveFilters =
    search.trim() !== '' ||
    selectedSeverity !== 'all' ||
    selectedStatus !== 'all' ||
    selectedCategory !== 'all' ||
    selectedProject !== 'all' ||
    quickFilter !== 'all';

  const handleClearFilters = () => {
    setSearch('');
    setSelectedSeverity('all');
    setSelectedStatus('all');
    setSelectedCategory('all');
    setSelectedProject('all');
    setQuickFilter('all');
  };

  const handleDeleteConfirm = () => {
    if (riskToDelete) {
      deleteMutation.mutate(riskToDelete.id, {
        onSuccess: () => setRiskToDelete(null),
      });
    }
  };

  // Table Columns Definition
  const columns: ColumnDef<Risk>[] = [
    {
      accessorKey: 'title',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="-ml-3 h-8 text-xs font-bold gap-1"
        >
          {t('risks_page.col_title', 'Risk Title & Category')}
          <ArrowUpDown className="h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => {
        const risk = row.original;
        return (
          <div className="flex items-start gap-3 py-1 min-w-[260px] max-w-[400px]">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 mt-0.5">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Link
                  to={`/risks/${risk.id}`}
                  className="text-xs sm:text-sm font-extrabold text-foreground hover:text-primary transition-colors hover:underline line-clamp-1"
                >
                  {risk.title}
                </Link>
                {risk.riskType && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-muted/60 text-muted-foreground border border-border">
                    {risk.riskType}
                  </span>
                )}
                {risk.utilizationRate != null && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-mono font-bold px-1.5 py-0 ${
                      risk.utilizationRate >= 100
                        ? 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                        : risk.utilizationRate >= 85
                        ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                        : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                    }`}
                  >
                    {risk.utilizationRate}% Load
                  </Badge>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="cursor-pointer group flex items-center">
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-mono px-1.5 py-0 group-hover:bg-primary/20 transition-colors cursor-pointer"
                        title="Click to switch CAT classification"
                      >
                        {(risk.gate || 'CAT 1').replace(/CATE/gi, 'CAT').replace(/Gate\s*(\d)/gi, 'CAT $1')} ▾
                      </Badge>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-32 rounded-xl">
                    <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">Switch CAT</DropdownMenuLabel>
                    {['CAT 1', 'CAT 2', 'CAT 3', 'CAT 4'].map((g) => (
                      <DropdownMenuItem
                        key={g}
                        onClick={() => updateMutation.mutate({ id: risk.id, data: { gate: g, cate: g } })}
                        className="text-xs font-mono"
                      >
                        {g}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {risk.description && (
                <p className="text-[11px] text-muted-foreground line-clamp-1">
                  {risk.description}
                </p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'severity',
      header: 'Severity & Score',
      cell: ({ row }) => {
        const risk = row.original;
        const score = calculateRiskScore(risk.severity, risk.probability, risk.riskScore);
        const scoreLevel = getRiskScoreLevel(score);

        return (
          <div className="space-y-1">
            <Badge variant={getRiskLevelVariant(risk.severity)} className="capitalize font-bold text-[11px] px-2 py-0.5">
              {risk.severity}
            </Badge>
            <div className="flex items-center gap-1">
              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full border ${scoreLevel.badgeClass}`}>
                {score} pts
              </span>
              <span className="text-[10px] text-muted-foreground font-semibold">({scoreLevel.label})</span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'probability',
      header: 'Probability',
      cell: ({ row }) => {
        const prob = row.original.probability;
        return (
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-foreground">
              {formatProbabilityLabel(prob)}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const risk = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="cursor-pointer group flex items-center gap-1">
                <Badge
                  variant={getStatusVariant(risk.status)}
                  className="capitalize font-bold text-xs px-2.5 py-0.5 shadow-2xs group-hover:opacity-85 transition-opacity"
                >
                  {formatStatusLabel(risk.status)}
                </Badge>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-36 rounded-xl">
              <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">Change Status</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => updateMutation.mutate({ id: risk.id, data: { status: 'open' } })}>
                Open
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateMutation.mutate({ id: risk.id, data: { status: 'mitigating' } })}>
                In Mitigation
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateMutation.mutate({ id: risk.id, data: { status: 'mitigated' } })}>
                Mitigated
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateMutation.mutate({ id: risk.id, data: { status: 'closed' } })}>
                Closed
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
    {
      accessorKey: 'projectName',
      header: 'Project / Part / Supplier',
      cell: ({ row }) => {
        const risk = row.original;
        return (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1 text-xs font-semibold text-foreground">
              <Building2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <span className="truncate max-w-[150px]">{risk.projectName || 'Universal Platform'}</span>
            </div>
            {(risk.partNumber || risk.supplierName) && (
              <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground truncate max-w-[180px]">
                {risk.partNumber && <span>Part {risk.partNumber}</span>}
                {risk.supplierName && <span>• {risk.supplierName}</span>}
              </div>
            )}
            {risk.capacityAssessmentId && (
              <Link
                to={`/capacity/${risk.capacityAssessmentId}`}
                className="text-[10px] text-primary hover:underline font-semibold inline-flex items-center gap-1 mt-0.5"
              >
                <Layers className="h-3 w-3" /> View Capacity Audit
              </Link>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'assignedTo',
      header: 'Owner & Deadline',
      cell: ({ row }) => {
        const risk = row.original;
        const isOverdue = risk.dueDate && new Date(risk.dueDate) < new Date() && risk.status !== 'closed' && risk.status !== 'mitigated';

        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
              <span className="font-semibold text-foreground truncate max-w-[110px]">{risk.assignedTo || 'SQD Auditor'}</span>
            </div>
            {risk.dueDate ? (
              <div
                className={`flex items-center gap-1 text-[11px] font-medium ${
                  isOverdue ? 'text-rose-600 font-bold' : 'text-muted-foreground'
                }`}
              >
                <Calendar className="h-3 w-3" />
                <span>{new Date(risk.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                {isOverdue && <span className="text-[10px] px-1 py-0.2 rounded bg-rose-500/10 text-rose-600 border border-rose-500/20">Overdue</span>}
              </div>
            ) : (
              <span className="text-[11px] text-muted-foreground/60 italic">No deadline</span>
            )}
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const risk = row.original;
        return (
          <div className="flex items-center gap-1 justify-end">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActiveQuickViewRisk(risk)}
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
              title="Quick Modal View"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActiveMitigateRisk(risk)}
              className="h-8 w-8 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
              title="Quick Mitigate Plan"
            >
              <ShieldCheck className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 rounded-xl">
                <DropdownMenuItem onClick={() => navigate(`/risks/${risk.id}`)} className="gap-2 text-xs">
                  <ChevronRight className="h-3.5 w-3.5" /> Full Page Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveMitigateRisk(risk)} className="gap-2 text-xs">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Update Mitigation
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setRiskToDelete(risk)}
                  className="gap-2 text-xs text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete Risk
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* ── Top Hero Dark Banner ────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-[#0a101d] text-white p-6 sm:p-8 lg:p-10 shadow-xl border border-slate-800">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-rose-600/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col justify-between gap-6">
          {/* Top Bar inside Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Badge
                variant="outline"
                className="border-slate-700 bg-slate-900/90 text-rose-400 px-3.5 py-1.5 text-xs font-bold flex items-center gap-2 rounded-full shadow-xs"
              >
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>SQD & Quality Risk Control</span>
              </Badge>
              <Badge
                variant="outline"
                className="border-slate-700 bg-slate-900/60 text-slate-300 px-3 py-1.5 text-xs font-medium rounded-full"
              >
                Role: {roleMeta.title}
              </Badge>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <Button
                onClick={() => refetch()}
                variant="outline"
                size="sm"
                className="border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800 font-semibold rounded-full px-3 py-1.5 text-xs gap-1.5 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Refresh</span>
              </Button>

              {/* Export Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800 font-semibold rounded-full px-4 py-1.5 text-xs gap-1.5 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5 text-blue-400" />
                    <span>{t('risks_page.export_report', 'Export')}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-2xl bg-card border-border shadow-xl">
                  <DropdownMenuLabel className="text-xs text-muted-foreground uppercase">Export Formats</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => exportRisksToCsv(filteredRisks)} className="gap-2 text-xs font-semibold cursor-pointer">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-500" /> Export CSV Spreadsheet
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportRisksToJson(filteredRisks)} className="gap-2 text-xs font-semibold cursor-pointer">
                    <FileCode className="h-4 w-4 text-blue-500" /> Export JSON Format
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => window.print()} className="gap-2 text-xs font-semibold cursor-pointer">
                    <Printer className="h-4 w-4 text-amber-500" /> Print / Save PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Log New Risk Button */}
              <Button
                asChild
                size="sm"
                className="bg-[#0066CC] hover:bg-[#0052A3] text-white font-bold rounded-full px-5 py-2 text-xs shadow-md shadow-blue-500/20 gap-2 cursor-pointer"
              >
                <Link to="/risks/new">
                  <Plus className="h-4 w-4" />
                  {t('risks_page.log_new_risk', 'Log New Risk')}
                </Link>
              </Button>
            </div>
          </div>

          {/* Title & Description */}
          <div className="space-y-3 max-w-4xl">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
              {t('risks_page.title', 'Quality & Project Risks')}
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
              {t(
                'risks_page.description',
                'Track, assess, and mitigate technical non-conformities, supplier capacity risks, and project quality deviations across vehicle platforms.'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ── 5 Executive KPI Cards ────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-blue-600" />
            <span>Risk Exposure & Executive Metrics</span>
          </h2>
          <span className="text-xs font-semibold text-muted-foreground">
            {filteredRisks.length} of {totalCount} risks displayed
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <KPICard
            variant="ltos"
            title="Total Risks Tracked"
            value={totalCount}
            icon={AlertTriangle}
            subtitle="All platform non-conformities & quality logs"
            trend={{ value: `${totalCount} logged`, isPositive: true }}
            actionText="View All"
            onClickAction={() => handleClearFilters()}
          />

          <KPICard
            variant="ltos"
            title="Critical & High"
            value={criticalCount}
            icon={Zap}
            subtitle="Severe impact requiring immediate mitigation"
            trend={{ value: criticalCount > 0 ? `${criticalCount} urgent` : 'Clear', isPositive: criticalCount === 0 }}
            actionText="Filter High"
            onClickAction={() => setQuickFilter('high')}
          />

          <KPICard
            variant="ltos"
            title="Open Non-Conformities"
            value={openCount}
            icon={Clock}
            subtitle="Identified & pending corrective actions"
            trend={{ value: `${openCount} unassigned`, isPositive: openCount === 0 }}
            actionText="Filter Open"
            onClickAction={() => setQuickFilter('open')}
          />

          <KPICard
            variant="ltos"
            title="In Mitigation"
            value={inMitigationCount}
            icon={ShieldCheck}
            subtitle="Active resolution & counter-measures"
            trend={{ value: `${inMitigationCount} active`, isPositive: true }}
            actionText="Kanban"
            onClickAction={() => setViewMode('kanban')}
          />

          <KPICard
            variant="ltos"
            title="Resolution Rate"
            value={`${resolutionRate}%`}
            icon={CheckCircle2}
            subtitle="Mitigated or validated & closed"
            trend={{ value: `${resolvedCount} resolved`, isPositive: resolutionRate >= 75 }}
            actionText="View Table"
            onClickAction={() => setViewMode('table')}
          />
        </div>
      </div>


      {/* ── View Modes & Multi-Criteria Filtering Toolbar ──────────────── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-5 shadow-sm space-y-4">
        {/* Top Filter Row: View Switcher + Search + Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* View Switcher Tabs */}
          <div className="flex items-center p-1 rounded-2xl bg-muted/50 border border-border shrink-0">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-card text-foreground shadow-xs border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <TableIcon className="h-3.5 w-3.5 text-blue-600" />
              <span>{t('risks_page.view_table', 'Table View')}</span>
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-card text-foreground shadow-xs border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Kanban className="h-3.5 w-3.5 text-amber-500" />
              <span>{t('risks_page.view_kanban', 'Kanban Board')}</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('risks_page.search_placeholder', 'Search by title, description, part, project...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10 rounded-xl text-xs bg-background"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Severity Filter */}
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="h-9 px-3 rounded-xl border border-border bg-background text-xs font-semibold text-foreground focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-9 px-3 rounded-xl border border-border bg-background text-xs font-semibold text-foreground focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="mitigating">In Mitigation</option>
              <option value="mitigated">Mitigated</option>
              <option value="closed">Closed</option>
            </select>

            {/* Category Filter */}
            {categories.length > 0 && (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-9 px-3 rounded-xl border border-border bg-background text-xs font-semibold text-foreground focus:outline-hidden cursor-pointer"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}

            {/* Project Filter */}
            {projects.length > 0 && (
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="h-9 px-3 rounded-xl border border-border bg-background text-xs font-semibold text-foreground focus:outline-hidden cursor-pointer max-w-[150px]"
              >
                <option value="all">All Projects</option>
                {projects.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Quick Filter Chips Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-muted-foreground mr-1">Quick Presets:</span>
            {[
              { id: 'all', label: 'All Risks' },
              { id: 'capacity', label: '🔥 Capacity Overload' },
              { id: 'milestone', label: '⏳ CAT Milestone Delays' },
              { id: 'quality', label: '🛡️ Quality Non-Conformities' },
              { id: 'critical', label: 'Critical Only' },
              { id: 'open', label: 'Open & Unmitigated' },
              { id: 'overdue', label: 'Overdue' },
            ].map((chip) => (
              <button
                key={chip.id}
                onClick={() => setQuickFilter(chip.id)}
                className={`text-xs font-bold px-3 py-1 rounded-full transition-all cursor-pointer ${
                  quickFilter === chip.id
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-muted/40 hover:bg-muted text-muted-foreground border border-border'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-7 text-xs font-bold text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg gap-1"
            >
              <X className="h-3 w-3" /> {t('risks_page.clear_filters', 'Clear All Filters')}
            </Button>
          )}
        </div>
      </div>

      {/* ── Active View Rendering ───────────────────────────────────────── */}
      {viewMode === 'table' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-4 shadow-sm">
          <DataTable
            columns={columns}
            data={filteredRisks}
            loading={isLoading}
            error={error?.message ?? null}
            onRetry={refetch}
            searchable={false}
            filterable={false}
          />
        </div>
      )}

      {viewMode === 'kanban' && (
        <RiskKanbanBoard
          risks={filteredRisks}
          onOpenQuickView={(r) => setActiveQuickViewRisk(r)}
          onOpenMitigate={(r) => setActiveMitigateRisk(r)}
        />
      )}

      {/* ── Modals & Dialogs ────────────────────────────────────────────── */}
      <QuickMitigateModal
        risk={activeMitigateRisk}
        open={!!activeMitigateRisk}
        onOpenChange={(open) => !open && setActiveMitigateRisk(null)}
      />

      <RiskQuickViewModal
        risk={activeQuickViewRisk}
        open={!!activeQuickViewRisk}
        onOpenChange={(open) => !open && setActiveQuickViewRisk(null)}
        onOpenMitigate={(r) => setActiveMitigateRisk(r)}
      />

      <ConfirmDialog
        open={!!riskToDelete}
        onOpenChange={(open) => !open && setRiskToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Risk Record"
        message={`Are you sure you want to delete "${riskToDelete?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
