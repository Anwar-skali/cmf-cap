import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCapacityAssessmentsQuery } from '@/hooks/queries/useCapacityQuery';
import { useDeleteCapacityMutation, useUpdateCapacityMutation } from '@/hooks/mutations/useCapacityMutations';
import { usePermissions } from '@/hooks/usePermissions';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Search,
  ChevronRight,
  BarChart3,
  Lock,
  Calendar,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Download,
  Building2,
  Cpu,
  Trash2,
  Eye,
  RotateCcw,
  Gauge,
  ShieldAlert,
  X,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { CapacityAssessment } from '@/types';
import { getStatusVariant } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';

export default function CapacityPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const partParam = searchParams.get('part');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cateFilter, setCateFilter] = useState<string>('all');
  const [healthFilter, setHealthFilter] = useState<string>('all');
  const [selectedAssessment, setSelectedAssessment] = useState<CapacityAssessment | null>(null);
  const [assessmentToDelete, setAssessmentToDelete] = useState<string | null>(null);

  const toast = useToast();
  const { canCreateCapacityAssessment } = usePermissions();
  const { data: assessments, isLoading, error, refetch } = useCapacityAssessmentsQuery();
  const deleteMutation = useDeleteCapacityMutation();
  const updateMutation = useUpdateCapacityMutation();

  const items = assessments?.items ?? [];

  // Match targeted highlighted assessment if URL contains ?highlight=... or ?part=...
  const highlightedItem = useMemo(() => {
    if (!highlightId && !partParam) return null;
    return (
      items.find(
        (a) =>
          (highlightId && a.id === highlightId) ||
          (partParam && a.partNumber === partParam) ||
          (highlightId && a.partNumber === highlightId),
      ) || null
    );
  }, [items, highlightId, partParam]);

  // Notify user when targeted alert is triggered from notification
  useEffect(() => {
    if (highlightId || partParam) {
      const partDisplay = highlightedItem?.partNumber || partParam || 'Automotive Component';
      const utilDisplay = highlightedItem?.utilizationRate ?? 98;
      toast.warning(`Targeted Alert: Highlighting Part ${partDisplay} (${utilDisplay}% Load)`);
    }
  }, [highlightId, partParam, highlightedItem]);

  // ── KPI Metrics Calculation ──
  const kpis = useMemo(() => {
    const total = items.length;
    const confirmedCount = items.filter((a) => a.status === 'confirmed').length;
    const atRiskCount = items.filter(
      (a) =>
        a.status === 'rejected' ||
        a.riskLevel === 'critical' ||
        a.riskLevel === 'high' ||
        (a.utilizationRate != null && a.utilizationRate >= 95),
    ).length;

    const validRates = items
      .map((a) => a.utilizationRate)
      .filter((r): r is number => r != null && !isNaN(r));
    const avgUtil =
      validRates.length > 0
        ? Math.round(validRates.reduce((acc, v) => acc + v, 0) / validRates.length)
        : 0;

    const confirmedPct = total > 0 ? Math.round((confirmedCount / total) * 100) : 0;

    return {
      total,
      confirmedCount,
      confirmedPct,
      atRiskCount,
      avgUtil,
    };
  }, [items]);

  // ── Filtering Logic ──
  const filtered = useMemo(() => {
    return items.filter((a) => {
      const cateVal = a.cate || a.gate || '';
      // Search term
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesQuery =
          (a.bottleneck && a.bottleneck.toLowerCase().includes(q)) ||
          (a.notes && a.notes.toLowerCase().includes(q)) ||
          (a.partNumber && a.partNumber.toLowerCase().includes(q)) ||
          (a.partName && a.partName.toLowerCase().includes(q)) ||
          (a.supplierName && a.supplierName.toLowerCase().includes(q)) ||
          (a.supplierCode && a.supplierCode.toLowerCase().includes(q)) ||
          (a.projectName && a.projectName.toLowerCase().includes(q)) ||
          (cateVal && cateVal.toLowerCase().includes(q));
        if (!matchesQuery) return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (a.status !== statusFilter) return false;
      }

      // CATE filter
      if (cateFilter !== 'all') {
        if (!cateVal || !cateVal.toLowerCase().includes(cateFilter.toLowerCase())) return false;
      }

      // Health / Utilization filter
      if (healthFilter !== 'all') {
        const util = a.utilizationRate ?? 0;
        if (healthFilter === 'bottleneck' && util < 95) return false;
        if (healthFilter === 'high' && (util < 80 || util >= 95)) return false;
        if (healthFilter === 'healthy' && util >= 80) return false;
      }

      return true;
    });
  }, [items, search, statusFilter, cateFilter, healthFilter]);

  const handleDelete = () => {
    if (!assessmentToDelete) return;
    deleteMutation.mutate(assessmentToDelete, {
      onSuccess: () => {
        setAssessmentToDelete(null);
      },
      onError: (err) => toast.error(err?.message || 'Failed to delete assessment'),
    });
  };

  const handleExportCSV = () => {
    if (!filtered.length) {
      toast.error('No records to export');
      return;
    }
    const headers = [
      'ID',
      'Part Number',
      'Part Name',
      'Supplier',
      'Supplier Code',
      'CAT',
      'Status',
      'Risk Level',
      'Current Capacity',
      'Max Capacity',
      'Utilization %',
      'Assessment Date',
      'Target Week',
      'Forecast Week',
      'Completed Week',
      'Lead Time (Days)',
      'Bottleneck',
      'Notes',
    ];
    const rows = filtered.map((a) => [
      a.id,
      `"${a.partNumber || ''}"`,
      `"${a.partName || ''}"`,
      `"${a.supplierName || ''}"`,
      `"${a.supplierCode || ''}"`,
      `"${a.cate || a.gate || ''}"`,
      a.status,
      a.riskLevel || 'low',
      a.currentCapacity,
      a.maximumCapacity,
      a.utilizationRate ?? '',
      a.assessmentDate || '',
      a.targetWeek || '',
      a.forecastWeek || '',
      a.completedWeek || '',
      a.leadTimeDays ?? '',
      `"${(a.bottleneck || '').replace(/"/g, '""')}"`,
      `"${(a.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `capacity_assessments_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV file exported successfully');
  };

  const getCateBadgeStyle = (cate?: string) => {
    if (!cate) return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300';
    const c = cate.toLowerCase();
    if (c.includes('1') || c.includes('m1') || c.includes('a')) return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800';
    if (c.includes('2') || c.includes('m2') || c.includes('b')) return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800';
    if (c.includes('3') || c.includes('m3') || c.includes('c')) return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800';
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800';
  };

  const getRiskBadge = (risk?: string) => {
    const r = (risk || 'low').toLowerCase();
    if (r === 'critical') return <Badge variant="destructive" className="uppercase font-semibold tracking-wider text-[10px]">Critical</Badge>;
    if (r === 'high') return <Badge variant="warning" className="uppercase font-semibold tracking-wider text-[10px]">High</Badge>;
    if (r === 'medium') return <Badge variant="outline" className="text-amber-600 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 uppercase font-semibold tracking-wider text-[10px]">Medium</Badge>;
    return <Badge variant="outline" className="text-emerald-600 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 uppercase font-semibold tracking-wider text-[10px]">Low</Badge>;
  };

  const columns: ColumnDef<CapacityAssessment>[] = [
    {
      accessorKey: 'part',
      header: 'Part & Project',
      cell: ({ row }) => {
        const item = row.original;
        const isTarget =
          (highlightId && item.id === highlightId) ||
          (partParam && item.partNumber === partParam) ||
          (highlightId && item.partNumber === highlightId);

        return (
          <div className="flex flex-col gap-0.5 max-w-[240px]">
            <div className="flex items-center gap-1.5 font-medium text-foreground truncate">
              <Cpu className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="font-mono text-xs font-bold text-primary">
                {item.partNumber || item.projectPartId?.slice(0, 8)}
              </span>
              {isTarget && (
                <Badge
                  variant="destructive"
                  className="ml-1 text-[9px] uppercase px-1.5 py-0 font-bold animate-pulse shrink-0"
                >
                  Alert Target
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground truncate" title={item.partName || 'Component'}>
              {item.partName || item.projectName || 'Automotive Component'}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'supplier',
      header: 'Supplier & Site',
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex flex-col gap-0.5 max-w-[180px]">
            <div className="flex items-center gap-1.5 font-medium text-foreground truncate">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs font-semibold truncate">{item.supplierName || 'Assigned Supplier'}</span>
            </div>
            {item.supplierCode && (
              <span className="text-[11px] font-mono text-muted-foreground">
                COFOR: <span className="font-medium text-foreground">{item.supplierCode}</span>
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'cate',
      header: 'CAT Gate',
      cell: ({ row }) => {
        const item = row.original;
        const rawCate = item.cate || item.gate || 'CATE 1';
        const displayCat = rawCate.replace(/CATE/gi, 'CAT');

        if (!canCreateCapacityAssessment) {
          return (
            <Badge variant="outline" className={`gap-1 px-2.5 py-0.5 text-xs font-semibold border ${getCateBadgeStyle(rawCate)}`}>
              <Layers className="h-3 w-3" />
              {displayCat}
            </Badge>
          );
        }

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="cursor-pointer group flex items-center">
                <Badge variant="outline" className={`gap-1 px-2.5 py-0.5 text-xs font-semibold border group-hover:opacity-80 transition-opacity ${getCateBadgeStyle(rawCate)}`}>
                  <Layers className="h-3 w-3" />
                  {displayCat} ▾
                </Badge>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-36 rounded-xl">
              <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">Switch CAT Gate</DropdownMenuLabel>
              {['CATE 1', 'CATE 2', 'CATE 3', 'Gate 1 (M1)', 'Gate 2 (M2)', 'Gate 3 (M3)'].map((g) => (
                <DropdownMenuItem
                  key={g}
                  onClick={() => updateMutation.mutate({ id: item.id, data: { cate: g, gate: g } })}
                  className="text-xs font-mono"
                >
                  {g}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const item = row.original;
        const status = item.status;

        const statusBadge = (
          <div className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${
                status === 'confirmed'
                  ? 'bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900'
                  : status === 'assessed'
                  ? 'bg-blue-500 ring-2 ring-blue-200 dark:ring-blue-900'
                  : status === 'pending'
                  ? 'bg-amber-500 ring-2 ring-amber-200 dark:ring-amber-900 animate-pulse'
                  : 'bg-rose-500 ring-2 ring-rose-200 dark:ring-rose-900'
              }`}
            />
            <Badge variant={getStatusVariant(status)} className="capitalize text-xs font-medium">
              {status} {canCreateCapacityAssessment && '▾'}
            </Badge>
          </div>
        );

        if (!canCreateCapacityAssessment) return statusBadge;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="cursor-pointer group">
                {statusBadge}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-36 rounded-xl">
              <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">Update Status</DropdownMenuLabel>
              {(['pending', 'assessed', 'confirmed', 'rejected'] as const).map((s) => (
                <DropdownMenuItem
                  key={s}
                  onClick={() => updateMutation.mutate({ id: item.id, data: { status: s } })}
                  className="text-xs capitalize"
                >
                  {s}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
    {
      accessorKey: 'capacity_utilization',
      header: 'Capacity & Gauge',
      cell: ({ row }) => {
        const item = row.original;
        const util = item.utilizationRate ?? 0;
        const isOver = util >= 95;
        const isWarning = util >= 80 && util < 95;

        return (
          <div className="space-y-1.5 min-w-[150px]">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-muted-foreground font-mono">
                {item.currentCapacity?.toLocaleString()} / {item.maximumCapacity?.toLocaleString()}
              </span>
              <span
                className={`font-bold font-mono ${
                  isOver ? 'text-rose-600 dark:text-rose-400' : isWarning ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {util != null ? `${util}%` : '-'}
              </span>
            </div>
            <div className="w-full bg-secondary/50 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isOver
                    ? 'bg-rose-500'
                    : isWarning
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(util, 100)}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'dates',
      header: 'Dates & Milestones',
      cell: ({ row }) => {
        const item = row.original;
        const dateFormatted = item.assessmentDate
          ? new Date(item.assessmentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          : `${item.month}/${item.year}`;

        return (
          <div className="flex flex-col gap-1 text-xs">
            <div className="flex items-center gap-1 text-foreground font-medium">
              <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
              <span>{dateFormatted}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-mono text-muted-foreground">
              {item.targetWeek && (
                <span className="bg-muted px-1.5 py-0.2 rounded text-[10px] text-foreground border">
                  Target: {item.targetWeek}
                </span>
              )}
              {item.forecastWeek && (
                <span className="bg-muted px-1.5 py-0.2 rounded text-[10px] text-foreground border">
                  Fct: {item.forecastWeek}
                </span>
              )}
              {item.completedWeek && (
                <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 px-1.5 py-0.2 rounded text-[10px] border border-emerald-200 dark:border-emerald-800">
                  Done: {item.completedWeek}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'bottleneck',
      header: 'Bottleneck & Risk',
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex flex-col gap-1 max-w-[200px]">
            <div className="flex items-center gap-1.5">
              {getRiskBadge(item.riskLevel)}
              {item.leadTimeDays != null && (
                <span className="text-[11px] text-muted-foreground font-mono">
                  {item.leadTimeDays}d lead
                </span>
              )}
            </div>
            <span className="text-xs text-foreground/80 truncate font-normal" title={item.bottleneck || 'No bottleneck identified'}>
              {item.bottleneck || 'No bottleneck reported'}
            </span>
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Quick View"
              onClick={() => setSelectedAssessment(item)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              title="Full Details"
              asChild
            >
              <Link to={`/capacity/${item.id}`}>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              title="Delete Assessment"
              onClick={() => setAssessmentToDelete(item.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* ── Page Header ── */}
      <PageHeader
        title="Capacity Management & CAT Tracking"
        description="Monitor supplier industrial capacity, CAT milestones, deadline adherence, and operational bottlenecks"
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          {canCreateCapacityAssessment ? (
            <Button asChild className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shadow-sm">
              <Link to="/capacity/new">
                <Plus className="h-4 w-4" /> New Assessment
              </Link>
            </Button>
          ) : (
            <Badge variant="outline" className="px-3 py-1.5 text-xs text-muted-foreground bg-muted/50 border gap-1.5">
              <Lock className="h-3.5 w-3.5" /> SQD only
            </Badge>
          )}
        </div>
      </PageHeader>

      {/* ── Executive KPI Overview Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60 shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Total Assessments</p>
              <p className="text-2xl font-bold tracking-tight">{kpis.total}</p>
              <p className="text-[11px] text-muted-foreground">
                <span className="text-emerald-600 font-semibold">{kpis.confirmedCount}</span> confirmed /{' '}
                <span className="text-amber-600 font-semibold">{kpis.total - kpis.confirmedCount}</span> pending
              </p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <BarChart3 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Capacity Secured</p>
              <p className="text-2xl font-bold tracking-tight text-emerald-600">{kpis.confirmedPct}%</p>
              <div className="w-24 bg-muted rounded-full h-1.5 mt-1 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${kpis.confirmedPct}%` }} />
              </div>
            </div>
            <div className="h-11 w-11 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Bottlenecks & At Risk</p>
              <p className={`text-2xl font-bold tracking-tight ${kpis.atRiskCount > 0 ? 'text-rose-600' : 'text-foreground'}`}>
                {kpis.atRiskCount}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {kpis.atRiskCount > 0 ? 'Action plan required' : 'All clear & compliant'}
              </p>
            </div>
            <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${kpis.atRiskCount > 0 ? 'bg-rose-500/10 text-rose-600' : 'bg-muted text-muted-foreground'}`}>
              <ShieldAlert className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Avg Fleet Utilization</p>
              <p className={`text-2xl font-bold tracking-tight ${kpis.avgUtil >= 95 ? 'text-rose-600' : kpis.avgUtil >= 80 ? 'text-amber-600' : 'text-primary'}`}>
                {kpis.avgUtil}%
              </p>
              <p className="text-[11px] text-muted-foreground">
                {kpis.avgUtil >= 95 ? 'High bottleneck load' : kpis.avgUtil >= 80 ? 'Optimal capacity range' : 'Available headroom'}
              </p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
              <Gauge className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Advanced Search & Filter Toolbar ── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 bg-card p-3 rounded-xl border border-border/60 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search Part, Supplier, CAT, Bottleneck, Project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background/80"
          />
        </div>

        {/* Status Filter */}
        <div className="w-full md:w-44">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="bg-background/80 text-xs">
              <SelectValue placeholder="Status: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="confirmed">Confirmed (Validated)</SelectItem>
              <SelectItem value="assessed">Assessed (In Progress)</SelectItem>
              <SelectItem value="pending">Pending Review</SelectItem>
              <SelectItem value="rejected">Rejected / At Risk</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* CAT Filter */}
        <div className="w-full md:w-44">
          <Select value={cateFilter} onValueChange={setCateFilter}>
            <SelectTrigger className="bg-background/80 text-xs">
              <SelectValue placeholder="CAT: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All CAT</SelectItem>
              <SelectItem value="cat 1">CAT 1</SelectItem>
              <SelectItem value="cat 2">CAT 2</SelectItem>
              <SelectItem value="cat 3">CAT 3</SelectItem>
              <SelectItem value="cat 4">CAT 4</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Health / Utilization Filter */}
        <div className="w-full md:w-44">
          <Select value={healthFilter} onValueChange={setHealthFilter}>
            <SelectTrigger className="bg-background/80 text-xs">
              <SelectValue placeholder="Utilization: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Utilization</SelectItem>
              <SelectItem value="bottleneck">Overloaded (≥95%)</SelectItem>
              <SelectItem value="high">High Load (80-94%)</SelectItem>
              <SelectItem value="healthy">Healthy (&lt;80%)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reset Filters */}
        {(search || statusFilter !== 'all' || cateFilter !== 'all' || healthFilter !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              setStatusFilter('all');
              setCateFilter('all');
              setHealthFilter('all');
            }}
            className="text-xs text-muted-foreground hover:text-foreground gap-1 px-2.5"
            title="Reset Filters"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
      </div>

      {/* ── Active Target Alert Focus Banner (Triggered from Notification) ── */}
      {highlightedItem && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-rose-500/10 border-2 border-rose-500/40 shadow-soft animate-alert-target">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-600 text-white shrink-0 shadow-md animate-bounce">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-rose-700 dark:text-rose-300 text-sm">
                  🚨 Targeted Alert Focus: Part {highlightedItem.partNumber || 'Component'} ({highlightedItem.partName || 'Automotive Component'})
                </span>
                <Badge variant="destructive" className="text-[10px] uppercase font-bold animate-pulse">
                  Line Alert Active
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Supplier: <strong className="text-foreground">{highlightedItem.supplierName || 'Manufacturing Line'}</strong> · Utilization:{' '}
                <strong className="text-rose-600 font-bold">{highlightedItem.utilizationRate ?? 98}%</strong> · Bottleneck:{' '}
                <span className="text-foreground font-medium">{highlightedItem.bottleneck || 'Raw material supply & SMT line constraint'}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="default"
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs gap-1.5 font-semibold shadow-sm"
              onClick={() => setSelectedAssessment(highlightedItem)}
            >
              <Eye className="h-3.5 w-3.5" /> Inspect Alert Details
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                searchParams.delete('highlight');
                searchParams.delete('part');
                setSearchParams(searchParams);
              }}
            >
              <X className="h-3.5 w-3.5" /> Clear Focus
            </Button>
          </div>
        </div>
      )}

      {/* ── Main Data Table ── */}
      <DataTable
        columns={columns}
        data={filtered}
        loading={isLoading}
        error={error?.message ?? null}
        onRetry={refetch}
        highlightId={highlightId || (highlightedItem?.id ?? null)}
        getRowId={(row) => row.id}
      />

      {/* ── Quick-View Assessment Dialog ── */}
      <Dialog open={!!selectedAssessment} onOpenChange={(open) => !open && setSelectedAssessment(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className={`px-2.5 py-0.5 text-xs font-semibold ${getCateBadgeStyle(selectedAssessment?.cate || selectedAssessment?.gate)}`}>
                {(selectedAssessment?.cate || selectedAssessment?.gate || 'CAT 1').replace(/CATE/gi, 'CAT')}
              </Badge>
              <Badge variant={getStatusVariant(selectedAssessment?.status || 'pending')} className="capitalize">
                {selectedAssessment?.status}
              </Badge>
              {selectedAssessment?.riskLevel && getRiskBadge(selectedAssessment.riskLevel)}
            </div>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" />
              {selectedAssessment?.partNumber ? `Part ${selectedAssessment.partNumber}` : 'Capacity Assessment'}
            </DialogTitle>
            <DialogDescription>
              {selectedAssessment?.partName || 'Detailed inspection of supplier capacity and milestone timeline.'}
            </DialogDescription>
          </DialogHeader>

          {selectedAssessment && (
            <div className="space-y-5 pt-2">
              {/* Capacity Utilization Gauge */}
              <div className="p-4 rounded-xl bg-muted/40 border space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    <Gauge className="h-4 w-4 text-primary" /> Production Capacity & Load
                  </span>
                  <span className="text-lg font-mono font-bold text-primary">
                    {selectedAssessment.utilizationRate != null ? `${selectedAssessment.utilizationRate}%` : '-'}
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      (selectedAssessment.utilizationRate ?? 0) >= 95
                        ? 'bg-rose-500'
                        : (selectedAssessment.utilizationRate ?? 0) >= 80
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(selectedAssessment.utilizationRate ?? 0, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground font-mono pt-1">
                  <span>Current: <strong>{selectedAssessment.currentCapacity?.toLocaleString()}</strong> pcs</span>
                  <span>Maximum: <strong>{selectedAssessment.maximumCapacity?.toLocaleString()}</strong> pcs</span>
                  <span>Lead Time: <strong>{selectedAssessment.leadTimeDays ?? '-'}</strong> days</span>
                </div>
              </div>

              {/* Grid Information */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg border bg-card space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" /> Supplier
                  </p>
                  <p className="font-semibold text-foreground">{selectedAssessment.supplierName || 'Assigned Supplier'}</p>
                  {selectedAssessment.supplierCode && (
                    <p className="text-xs font-mono text-muted-foreground">COFOR: {selectedAssessment.supplierCode}</p>
                  )}
                </div>

                <div className="p-3 rounded-lg border bg-card space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" /> Assessment Period
                  </p>
                  <p className="font-semibold text-foreground">
                    {selectedAssessment.assessmentDate
                      ? new Date(selectedAssessment.assessmentDate).toLocaleDateString('en-GB')
                      : `${selectedAssessment.month}/${selectedAssessment.year}`}
                  </p>
                  <p className="text-xs text-muted-foreground">Month {selectedAssessment.month}, {selectedAssessment.year}</p>
                </div>
              </div>

              {/* Milestone Calendar Weeks */}
              <div className="p-3 rounded-lg border bg-card space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Milestone Calendar Tracking (Weeks)
                </p>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded bg-muted/60 border">
                    <p className="text-muted-foreground text-[11px]">Target Week</p>
                    <p className="font-mono font-bold text-foreground mt-0.5">{selectedAssessment.targetWeek || '-'}</p>
                  </div>
                  <div className="p-2 rounded bg-muted/60 border">
                    <p className="text-muted-foreground text-[11px]">Forecast Week</p>
                    <p className="font-mono font-bold text-foreground mt-0.5">{selectedAssessment.forecastWeek || '-'}</p>
                  </div>
                  <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-emerald-700 dark:text-emerald-300 text-[11px]">Completed Week</p>
                    <p className="font-mono font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">{selectedAssessment.completedWeek || 'In Progress'}</p>
                  </div>
                </div>
              </div>

              {/* Bottleneck & Notes */}
              <div className="space-y-2">
                <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 space-y-1">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" /> Bottleneck Identified
                  </p>
                  <p className="text-xs text-amber-900 dark:text-amber-200">
                    {selectedAssessment.bottleneck || 'No bottleneck reported for this capacity assessment.'}
                  </p>
                </div>

                {selectedAssessment.notes && (
                  <div className="p-3 rounded-lg border bg-muted/30 space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground">Observations & Mitigation Remarks</p>
                    <p className="text-xs text-foreground/90 whitespace-pre-wrap">{selectedAssessment.notes}</p>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" onClick={() => setSelectedAssessment(null)}>
                  Close
                </Button>
                <Button asChild className="bg-primary text-primary-foreground">
                  <Link to={`/capacity/${selectedAssessment.id}`}>Open Full Detail Page</Link>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <ConfirmDialog
        open={!!assessmentToDelete}
        onOpenChange={(open) => !open && setAssessmentToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Capacity Assessment"
        message="Are you sure you want to delete this capacity assessment? This action can be undone by administrators."
        confirmText="Delete"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
