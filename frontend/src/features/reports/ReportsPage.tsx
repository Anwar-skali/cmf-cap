import { useState, useMemo } from 'react';
import {
  BarChart3,
  Download,
  Activity,
  AlertTriangle,
  Users,
  CheckCircle2,
  Package,
  TrendingUp,
  Filter,
  PieChart as PieChartIcon,
  Search,
  FileSpreadsheet,
  FileText,
  FileCode,
  Layers,
  Gauge,
  RotateCcw,
  ShieldAlert,
  Building2,
  Calendar,
  Sparkles,
  Zap,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Line,
  ComposedChart,
} from 'recharts';
import { useProjectsQuery } from '@/hooks/queries/useProjectsQuery';
import { useRisksQuery } from '@/hooks/queries/useRisksQuery';
import { useSuppliersQuery } from '@/hooks/queries/useSuppliersQuery';
import { useCapacityAssessmentsQuery } from '@/hooks/queries/useCapacityQuery';
import { exportToPDF, exportToExcel, exportToCSV } from '@/utils/exportUtils';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import type { CapacityAssessment, Supplier, Project, Risk } from '@/types';
import { getStatusVariant } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';

const STATUS_COLORS: Record<string, string> = {
  active: '#10b981',
  completed: '#2563eb',
  on_hold: '#f59e0b',
  draft: '#64748b',
  cancelled: '#ef4444',
};

const SEVERITY_COLORS: Record<string, string> = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
};

const PROBABILITY_LEVELS = ['rare', 'unlikely', 'possible', 'likely', 'almost_certain'];
const SEVERITY_LEVELS = ['critical', 'high', 'medium', 'low'];

export default function ReportsPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');

  // Fetch data
  const { data: projectsData, isLoading: isLoadingProjects } = useProjectsQuery();
  const { data: risksData, isLoading: isLoadingRisks } = useRisksQuery();
  const { data: suppliersData, isLoading: isLoadingSuppliers } = useSuppliersQuery();
  const { data: capacityData, isLoading: isLoadingCapacity } = useCapacityAssessmentsQuery();

  const projects = useMemo(() => projectsData?.items || [], [projectsData]);
  const risks = useMemo(() => risksData?.items || [], [risksData]);
  const suppliers = useMemo(() => suppliersData?.items || [], [suppliersData]);
  const capacity = useMemo(() => capacityData?.items || [], [capacityData]);

  const isLoading = isLoadingProjects || isLoadingRisks || isLoadingSuppliers || isLoadingCapacity;

  // Filtered dataset
  const filteredProjects = useMemo(() => {
    if (!searchQuery) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.code?.toLowerCase().includes(q) ||
        p.clientName?.toLowerCase().includes(q),
    );
  }, [projects, searchQuery]);

  const filteredRisks = useMemo(() => {
    return risks.filter((r) => {
      if (severityFilter !== 'all' && r.severity !== severityFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return r.title?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [risks, severityFilter, searchQuery]);

  const filteredCapacity = useMemo(() => {
    if (!searchQuery) return capacity;
    const q = searchQuery.toLowerCase();
    return capacity.filter(
      (c) =>
        c.partNumber?.toLowerCase().includes(q) ||
        c.supplierName?.toLowerCase().includes(q) ||
        c.cate?.toLowerCase().includes(q) ||
        c.bottleneck?.toLowerCase().includes(q),
    );
  }, [capacity, searchQuery]);

  // ── Project Status Breakdown ──
  const projectStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredProjects.forEach((p) => {
      const s = (p.status || 'draft').toLowerCase();
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).map(([status, value]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '),
      statusKey: status,
      value,
      fill: STATUS_COLORS[status] || '#64748b',
    }));
  }, [filteredProjects]);

  // ── Risk Severity Breakdown ──
  const riskSeverityData = useMemo(() => {
    const counts: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    filteredRisks.forEach((r) => {
      const sev = (r.severity || 'low').toLowerCase();
      counts[sev] = (counts[sev] || 0) + 1;
    });
    return SEVERITY_LEVELS.map((sev) => ({
      name: sev.charAt(0).toUpperCase() + sev.slice(1),
      count: counts[sev] || 0,
      fill: SEVERITY_COLORS[sev],
    })).filter((item) => item.count > 0);
  }, [filteredRisks]);

  // ── Risk Heatmap 5x5 Matrix ──
  const riskHeatmapMatrix = useMemo(() => {
    const matrix: Record<string, Record<string, number>> = {};
    SEVERITY_LEVELS.forEach((sev) => {
      matrix[sev] = {};
      PROBABILITY_LEVELS.forEach((prob) => {
        matrix[sev][prob] = 0;
      });
    });

    filteredRisks.forEach((r) => {
      const sev = (r.severity || 'low').toLowerCase();
      const prob = (r.probability || 'possible').toLowerCase();
      if (matrix[sev] && matrix[sev][prob] !== undefined) {
        matrix[sev][prob] += 1;
      }
    });

    return matrix;
  }, [filteredRisks]);

  // ── CATE Tier Breakdown ──
  const cateData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredCapacity.forEach((c) => {
      const cate = c.cate || c.gate || 'CATE 1';
      counts[cate] = (counts[cate] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name,
      count: value,
    }));
  }, [filteredCapacity]);

  // ── Capacity Volume Composed Chart ──
  const capacityVolumeData = useMemo(() => {
    return filteredCapacity.slice(0, 10).map((c, i) => {
      const partLabel = c.partNumber ? `Part ${c.partNumber}` : `Audit ${i + 1}`;
      const util =
        c.utilizationRate ??
        (c.maximumCapacity > 0 ? Math.round((c.currentCapacity / c.maximumCapacity) * 100) : 0);
      return {
        name: partLabel,
        required: c.currentCapacity,
        maximum: c.maximumCapacity,
        utilization: util,
      };
    });
  }, [filteredCapacity]);

  // KPI Computations
  const activeProjectCount = useMemo(
    () => projects.filter((p) => p.status === 'active').length,
    [projects],
  );
  const completedProjectCount = useMemo(
    () => projects.filter((p) => p.status === 'completed').length,
    [projects],
  );
  const criticalRiskCount = useMemo(
    () => risks.filter((r) => r.severity === 'critical').length,
    [risks],
  );

  const avgUtilization = useMemo(() => {
    const valid = capacity
      .map((c) => c.utilizationRate)
      .filter((u): u is number => u != null && !isNaN(u));
    return valid.length > 0
      ? Math.round(valid.reduce((acc, v) => acc + v, 0) / valid.length)
      : 0;
  }, [capacity]);

  const bottleneckCount = useMemo(
    () =>
      capacity.filter(
        (c) =>
          c.status === 'rejected' ||
          c.riskLevel === 'critical' ||
          c.riskLevel === 'high' ||
          (c.utilizationRate != null && c.utilizationRate >= 95),
      ).length,
    [capacity],
  );

  // ── EXPORT HANDLERS ──

  const handleExportPDF = () => {
    const summaryMetrics = [
      { label: 'Total Projects', value: projects.length },
      { label: 'Active Platforms', value: activeProjectCount },
      { label: 'Critical Risks', value: criticalRiskCount },
      { label: 'Supplier Plants', value: suppliers.length },
      { label: 'Capacity Audits', value: capacity.length },
      { label: 'Avg Fleet Utilization', value: `${avgUtilization}%` },
    ];

    const pdfSections = {
      'Projects Portfolio': {
        headers: ['Project Code', 'Name', 'Status', 'Client', 'Priority'],
        rows: projects.map((p) => [
          p.code || '-',
          p.name || '-',
          p.status || 'draft',
          p.clientName || 'Stellantis',
          p.priority ?? 1,
        ]),
      },
      'Risk Registry': {
        headers: ['Risk Title', 'Severity', 'Probability', 'Status'],
        rows: risks.map((r) => [
          r.title || '-',
          r.severity || 'low',
          r.probability || 'possible',
          r.status || 'open',
        ]),
      },
      'Suppliers Network': {
        headers: ['Supplier Name', 'COFOR Code', 'Status', 'Contact Person'],
        rows: suppliers.map((s) => [
          s.name || '-',
          s.code || '-',
          s.status || 'active',
          s.contactPerson || '-',
        ]),
      },
      'Capacity Assessments (CMF)': {
        headers: ['Part Number', 'Supplier', 'CATE', 'Status', 'Required', 'Max Cap', 'Util %'],
        rows: capacity.map((c) => [
          c.partNumber || c.projectPartId?.slice(0, 8) || '-',
          c.supplierName || '-',
          c.cate || c.gate || 'CATE 1',
          c.status || 'pending',
          c.currentCapacity?.toLocaleString() || '0',
          c.maximumCapacity?.toLocaleString() || '0',
          c.utilizationRate != null ? `${c.utilizationRate}%` : '-',
        ]),
      },
    };

    exportToPDF('Enterprise Platform & CMF Intelligence Report', summaryMetrics, pdfSections);
    toast.success('Executive PDF report downloaded successfully');
  };

  const handleExportExcel = () => {
    const summaryData = [
      { Metric: 'Total Projects', Value: projects.length },
      { Metric: 'Active Projects', Value: activeProjectCount },
      { Metric: 'Completed Projects', Value: completedProjectCount },
      { Metric: 'Total Risks', Value: risks.length },
      { Metric: 'Critical Risks', Value: criticalRiskCount },
      { Metric: 'Active Suppliers', Value: suppliers.length },
      { Metric: 'Capacity Assessments', Value: capacity.length },
      { Metric: 'Average Fleet Utilization', Value: `${avgUtilization}%` },
    ];

    const projectsDataSheet = projects.map((p) => ({
      Code: p.code || '',
      Name: p.name || '',
      Status: p.status || '',
      Client: p.clientName || '',
      Priority: p.priority || 1,
      StartDate: p.startDate || '',
      EndDate: p.endDate || '',
    }));

    const risksDataSheet = risks.map((r) => ({
      Title: r.title || '',
      Severity: r.severity || '',
      Probability: r.probability || '',
      Status: r.status || '',
      Impact: r.impact || '',
      Mitigation: r.mitigation || '',
    }));

    const suppliersDataSheet = suppliers.map((s) => ({
      Name: s.name || '',
      COFOR_Code: s.code || '',
      ContactPerson: s.contactPerson || '',
      Email: s.email || '',
      Phone: s.phone || '',
      Status: s.status || '',
    }));

    const capacityDataSheet = capacity.map((c) => ({
      PartNumber: c.partNumber || '',
      PartName: c.partName || '',
      Supplier: c.supplierName || '',
      SupplierCOFOR: c.supplierCode || '',
      CATE: c.cate || c.gate || 'CATE 1',
      Status: c.status || '',
      RiskLevel: c.riskLevel || 'low',
      CurrentCapacity_Pcs: c.currentCapacity || 0,
      MaxCapacity_Pcs: c.maximumCapacity || 0,
      UtilizationRate_Pct: c.utilizationRate || 0,
      LeadTime_Days: c.leadTimeDays || 0,
      TargetWeek: c.targetWeek || '',
      ForecastWeek: c.forecastWeek || '',
      CompletedWeek: c.completedWeek || '',
      Bottleneck: c.bottleneck || '',
    }));

    exportToExcel('CMF_Enterprise_Report', [
      { sheetName: 'Executive Summary', data: summaryData },
      { sheetName: 'Projects', data: projectsDataSheet },
      { sheetName: 'Risks', data: risksDataSheet },
      { sheetName: 'Suppliers', data: suppliersDataSheet },
      { sheetName: 'Capacity Assessments', data: capacityDataSheet },
    ]);
    toast.success('Formatted Excel workbook downloaded successfully');
  };

  const handleExportCSV = () => {
    const headers = ['Type', 'Identifier / Title', 'Status', 'Risk / Severity', 'Value / Metric', 'Date'];
    const rows: (string | number)[][] = [
      ...projects.map((p) => ['Project', p.name, p.status, '-', p.code || '-', p.createdAt || '']),
      ...risks.map((r) => ['Risk', r.title, r.status, r.severity, r.probability || '-', r.createdAt || '']),
      ...suppliers.map((s) => ['Supplier', s.name, s.status, '-', s.code || '-', s.createdAt || '']),
      ...capacity.map((c) => [
        'Capacity',
        c.partNumber || c.id,
        c.status,
        c.riskLevel || 'low',
        `${c.utilizationRate ?? 0}% util`,
        c.assessmentDate || '',
      ]),
    ];

    exportToCSV('cmf_enterprise_report', headers, rows);
    toast.success('CSV dataset exported successfully');
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* ── Page Header ── */}
      <PageHeader
        title="Executive Analytics & Enterprise Intelligence"
        description="Global platform performance dashboard, project portfolio readiness, risk exposure matrix, and CATE capacity forecasts"
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="gap-2 bg-primary hover:bg-primary/90 shadow-sm font-semibold">
              <Download className="h-4 w-4" /> Export Executive Report
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={handleExportPDF} className="cursor-pointer gap-2.5">
              <FileText className="h-4 w-4 text-rose-500" /> Export PDF Summary Report
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportExcel} className="cursor-pointer gap-2.5">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Export Excel Workbook (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportCSV} className="cursor-pointer gap-2.5">
              <FileCode className="h-4 w-4 text-blue-600" /> Export Raw Dataset (.csv)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </PageHeader>

      {/* ── Executive Hero Banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 p-6 text-white shadow-lg border border-slate-800">
        <div className="absolute right-0 top-0 h-full w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/20 via-indigo-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[11px] font-semibold">
                GLOBAL PLATFORM HEALTH: OPERATIONAL
              </Badge>
              <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-[11px] font-mono">
                CMF CALCULATION ENGINE
              </Badge>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-blue-400 shrink-0" />
              Enterprise Strategic Intelligence Dashboard
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
              Real-time monitoring across {projects.length} platform projects, {suppliers.length} supplier sites, and {capacity.length} capacity audits.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800 shrink-0 backdrop-blur-sm">
            <div className="space-y-0.5">
              <p className="text-[11px] text-slate-400 uppercase font-semibold">Active Fleet Load</p>
              <p className="text-2xl font-bold font-mono text-emerald-400">{avgUtilization}%</p>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div className="space-y-0.5">
              <p className="text-[11px] text-slate-400 uppercase font-semibold">Bottleneck Audits</p>
              <p className={`text-2xl font-bold font-mono ${bottleneckCount > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                {bottleneckCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Executive KPI Metrics Cards ── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm border-l-4 border-l-emerald-500 hover:shadow transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Portfolio Projects</CardTitle>
            <Package className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono">{projects.length}</span>
                <span className="text-xs text-emerald-600 font-semibold flex items-center">
                  <CheckCircle className="h-3.5 w-3.5 mr-1" /> {activeProjectCount} Active
                </span>
              </div>
            )}
            <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all"
                style={{ width: `${projects.length > 0 ? Math.round((activeProjectCount / projects.length) * 100) : 0}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Completed: {completedProjectCount}</span>
              <span>Draft: {projects.length - activeProjectCount - completedProjectCount}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-rose-500 hover:shadow transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Critical Risk Rating</CardTitle>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
                  {criticalRiskCount}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  Total: {risks.length}
                </span>
              </div>
            )}
            <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-rose-500 h-full rounded-full transition-all"
                style={{ width: `${risks.length > 0 ? Math.min(100, Math.round((criticalRiskCount / risks.length) * 100)) : 0}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {criticalRiskCount > 0 ? '⚠️ High priority mitigation required' : '✅ Risk registry within safe limits'}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-blue-500 hover:shadow transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Supplier Plants Network</CardTitle>
            <Building2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono">{suppliers.length}</span>
                <span className="text-xs text-blue-600 font-semibold">100% Verified</span>
              </div>
            )}
            <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
              <div className="bg-blue-500 h-full rounded-full" style={{ width: '100%' }} />
            </div>
            <p className="text-[11px] text-muted-foreground">Global OEM manufacturing coverage</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-amber-500 hover:shadow transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Avg Capacity Fleet Load</CardTitle>
            <Gauge className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="flex items-baseline justify-between">
                <span className={`text-2xl font-bold font-mono ${avgUtilization >= 95 ? 'text-rose-600' : 'text-amber-600'}`}>
                  {avgUtilization}%
                </span>
                <span className="text-xs text-muted-foreground font-mono">{capacity.length} Audits</span>
              </div>
            )}
            <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  avgUtilization >= 95 ? 'bg-rose-500' : avgUtilization >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, avgUtilization)}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {avgUtilization >= 95 ? 'Line overload risk' : avgUtilization >= 80 ? 'Optimal capacity range' : 'Available headroom'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Filter Toolbar ── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 bg-card p-3.5 rounded-xl border border-border/60 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter report charts & tables by project, risk title, supplier, part number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-background/80"
          />
        </div>

        <div className="w-full md:w-48">
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="bg-background/80 text-xs">
              <SelectValue placeholder="Severity: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="critical">Critical Only</SelectItem>
              <SelectItem value="high">High & Critical</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low Severity</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(searchQuery || severityFilter !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setSeverityFilter('all');
            }}
            className="text-xs text-muted-foreground hover:text-foreground gap-1 px-2.5"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset Filters
          </Button>
        )}
      </div>

      {/* ── Main Dashboard Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-card border p-1 rounded-xl">
          <TabsTrigger value="overview" className="gap-2 text-xs font-semibold">
            <BarChart3 className="h-4 w-4" /> Overview Dashboard
          </TabsTrigger>
          <TabsTrigger value="projects" className="gap-2 text-xs font-semibold">
            <Package className="h-4 w-4" /> Projects Portfolio ({filteredProjects.length})
          </TabsTrigger>
          <TabsTrigger value="risks" className="gap-2 text-xs font-semibold">
            <AlertTriangle className="h-4 w-4" /> Risk Heatmap ({filteredRisks.length})
          </TabsTrigger>
          <TabsTrigger value="capacity" className="gap-2 text-xs font-semibold">
            <Gauge className="h-4 w-4" /> Capacity & CATE Readiness ({filteredCapacity.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: OVERVIEW DASHBOARD */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Project Portfolio Status Distribution */}
            <Card className="shadow-sm border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <PieChartIcon className="h-4 w-4 text-primary" /> Project Portfolio Status Breakdown
                  </span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {projects.length} Total Projects
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Distribution of active, completed, on-hold, and draft vehicle platform projects
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {isLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <Skeleton className="h-[200px] w-[200px] rounded-full" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={projectStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={95}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {projectStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(val: number) => [`${val} Projects`, 'Count']} />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Chart 2: Risk Severity Distribution */}
            <Card className="shadow-sm border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-rose-500" /> Risk Severity Profile
                  </span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {risks.length} Total Risks
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Current open risks categorized by severity impact level
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {isLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <Skeleton className="h-[200px] w-full" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={riskSeverityData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <RechartsTooltip cursor={{ fill: 'transparent' }} />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {riskSeverityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: PROJECTS PORTFOLIO */}
        <TabsContent value="projects" className="space-y-6">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" /> Vehicle Platforms & Project Portfolio Matrix
                </span>
                <Badge variant="outline" className="font-mono text-xs">
                  {filteredProjects.length} Projects
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time project inventory with client mapping, priority tiers, and milestone schedule
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-xl border border-border/60 bg-card">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 text-muted-foreground uppercase tracking-wider font-mono">
                    <tr>
                      <th className="p-3">Project Code</th>
                      <th className="p-3">Project Name</th>
                      <th className="p-3">Client Name</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Priority</th>
                      <th className="p-3">Start Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredProjects.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-muted-foreground">
                          No project records found matching search filters.
                        </td>
                      </tr>
                    ) : (
                      filteredProjects.map((p) => (
                        <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                          <td className="p-3 font-mono font-bold text-primary">{p.code || p.id.slice(0, 8)}</td>
                          <td className="p-3 font-semibold text-foreground">{p.name}</td>
                          <td className="p-3 text-muted-foreground">{p.clientName || 'Stellantis Global'}</td>
                          <td className="p-3">
                            <Badge variant={getStatusVariant(p.status)} className="capitalize text-[10px]">
                              {p.status}
                            </Badge>
                          </td>
                          <td className="p-3 font-mono font-medium">Priority {p.priority || 1}</td>
                          <td className="p-3 font-mono text-muted-foreground">
                            {p.startDate ? new Date(p.startDate).toLocaleDateString('en-GB') : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: RISK MATRIX HEATMAP */}
        <TabsContent value="risks" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 5x5 Heatmap Matrix Grid */}
            <Card className="lg:col-span-2 border-border/60 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-rose-500" /> 5x5 Industrial Risk Heatmap Matrix
                </CardTitle>
                <CardDescription className="text-xs">Severity (Rows) vs Probability (Columns) cross-table risk exposure matrix</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-center border-collapse">
                      <thead>
                        <tr>
                          <th className="p-2.5 border bg-muted/40 text-muted-foreground font-semibold">Severity \ Probability</th>
                          {PROBABILITY_LEVELS.map((prob) => (
                            <th key={prob} className="p-2.5 border bg-muted/40 font-mono capitalize">
                              {prob.replace('_', ' ')}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {SEVERITY_LEVELS.map((sev) => (
                          <tr key={sev}>
                            <td className="p-2.5 border font-bold capitalize text-left bg-muted/20 font-mono">
                              {sev}
                            </td>
                            {PROBABILITY_LEVELS.map((prob) => {
                              const count = riskHeatmapMatrix[sev]?.[prob] || 0;
                              let cellBg = 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700';
                              if (sev === 'critical' || (sev === 'high' && (prob === 'likely' || prob === 'almost_certain'))) {
                                cellBg = count > 0 ? 'bg-rose-500 text-white font-bold animate-pulse' : 'bg-rose-50 dark:bg-rose-950/20 text-rose-700';
                              } else if (sev === 'high' || (sev === 'medium' && prob === 'likely')) {
                                cellBg = count > 0 ? 'bg-amber-500 text-white font-bold' : 'bg-amber-50 dark:bg-amber-950/20 text-amber-700';
                              } else if (sev === 'medium') {
                                cellBg = count > 0 ? 'bg-blue-500 text-white font-bold' : 'bg-blue-50 dark:bg-blue-950/20 text-blue-700';
                              }

                              return (
                                <td key={prob} className={`p-3.5 border font-mono text-sm transition-all ${cellBg}`}>
                                  {count}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Critical Risks List */}
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-500" /> High-Impact Risk Items
                </CardTitle>
                <CardDescription className="text-xs">Risks requiring immediate mitigation action items</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {filteredRisks.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No risk items match filters.</p>
                ) : (
                  filteredRisks.slice(0, 6).map((r) => (
                    <div key={r.id} className="p-3 rounded-lg border bg-muted/20 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-foreground truncate max-w-[180px]">{r.title}</span>
                        <Badge
                          variant={r.severity === 'critical' ? 'destructive' : r.severity === 'high' ? 'warning' : 'outline'}
                          className="uppercase text-[10px]"
                        >
                          {r.severity}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-1">{r.description || 'No description provided.'}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 4: CAPACITY & CATE READINESS */}
        <TabsContent value="capacity" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* CATE Tier Distribution */}
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Layers className="h-4 w-4 text-purple-600" /> CATE Tier Milestone Readiness
                </CardTitle>
                <CardDescription className="text-xs">Capacity audits split by CATE classification level</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px]">
                {isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cateData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <RechartsTooltip cursor={{ fill: 'transparent' }} />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Overloaded Lines & Bottlenecks Table */}
            <Card className="lg:col-span-2 border-border/60 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-amber-500" /> Capacity Audits & Overloaded Throughput (≥95%)
                  </span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {filteredCapacity.length} Audits
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">Live capacity audits with supplier names and utilization gauges</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-xl border border-border/60 bg-card">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 text-muted-foreground uppercase tracking-wider font-mono">
                      <tr>
                        <th className="p-3">Part #</th>
                        <th className="p-3">Supplier</th>
                        <th className="p-3">CATE</th>
                        <th className="p-3">Utilization</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Bottleneck</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {filteredCapacity.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-muted-foreground">
                            No capacity records match criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredCapacity.map((c) => {
                          const util =
                            c.utilizationRate ??
                            (c.maximumCapacity > 0 ? Math.round((c.currentCapacity / c.maximumCapacity) * 100) : 0);
                          const isHigh = util >= 95;
                          return (
                            <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                              <td className="p-3 font-mono font-bold text-primary">
                                {c.partNumber || c.projectPartId?.slice(0, 8)}
                              </td>
                              <td className="p-3 font-semibold text-foreground">{c.supplierName || 'Assigned Supplier'}</td>
                              <td className="p-3">
                                <Badge variant="outline" className="font-mono text-[10px]">
                                  {c.cate || c.gate || 'CATE 1'}
                                </Badge>
                              </td>
                              <td className="p-3 font-mono font-bold">
                                <span className={isHigh ? 'text-rose-600' : 'text-emerald-600'}>{util}%</span>
                              </td>
                              <td className="p-3">
                                <Badge variant={getStatusVariant(c.status)} className="capitalize text-[10px]">
                                  {c.status}
                                </Badge>
                              </td>
                              <td className="p-3 text-muted-foreground max-w-[180px] truncate" title={c.bottleneck || 'None'}>
                                {c.bottleneck || 'No bottleneck'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
