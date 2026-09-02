import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSuppliersQuery } from '@/hooks/queries/useSuppliersQuery';
import { useDeleteSupplierMutation, useUpdateSupplierMutation } from '@/hooks/mutations/useSupplierMutations';
import { usePermissions } from '@/hooks/usePermissions';
import { useLanguage } from '@/context/LanguageContext';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  Filter,
  Building2,
  Users,
  MapPin,
  Mail,
  Phone,
  Download,
  FileSpreadsheet,
  FileCode,
  Printer,
  Table as TableIcon,
  LayoutGrid,
  RefreshCw,
  MoreHorizontal,
  Eye,
  Trash2,
  Edit,
  FolderPlus,
  Sparkles,
  TrendingUp,
  PieChart as PieChartIcon,
  X,
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { Supplier, SupplierStatus } from '@/types';
import {
  getSupplierInitials,
  getSupplierAvatarStyle,
  getSupplierStatusVariant,
  formatSupplierStatus,
  exportSuppliersToCsv,
  exportSuppliersToJson,
} from './utils/supplierUtils';
import { SupplierCardGrid } from './components/SupplierCardGrid';
import { SupplierQuickViewModal } from './components/SupplierQuickViewModal';
import { AssignToProjectModal } from './components/AssignToProjectModal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

type ViewMode = 'table' | 'cards' | 'capacity';

const STATUS_PIE_COLORS: Record<string, string> = {
  active: '#10b981',
  inactive: '#94a3b8',
  blacklisted: '#ef4444',
};

export default function SuppliersPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { isBuyer, isCapacityManager, roleMeta, isAdmin } = usePermissions();

  // Queries & Mutations
  const { data: suppliersData, isLoading, error, refetch } = useSuppliersQuery();
  const deleteMutation = useDeleteSupplierMutation();
  const updateMutation = useUpdateSupplierMutation();

  // State
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [quickFilter, setQuickFilter] = useState<string>('all');

  // Modals
  const [activeQuickViewSupplier, setActiveQuickViewSupplier] = useState<Supplier | null>(null);
  const [activeAssignSupplier, setActiveAssignSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  const rawSuppliers = useMemo(() => suppliersData?.items || [], [suppliersData]);

  // Executive KPI stats
  const totalCount = rawSuppliers.length;
  const activeCount = rawSuppliers.filter((s) => s.status === 'active').length;
  const inactiveCount = rawSuppliers.filter((s) => s.status === 'inactive').length;
  const blacklistedCount = rawSuppliers.filter((s) => s.status === 'blacklisted').length;
  const activePct = totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0;

  // Chart data
  const statusChartData = useMemo(() => {
    return [
      { name: 'Active', value: activeCount, color: STATUS_PIE_COLORS.active },
      { name: 'Inactive', value: inactiveCount, color: STATUS_PIE_COLORS.inactive },
      { name: 'Blacklisted', value: blacklistedCount, color: STATUS_PIE_COLORS.blacklisted },
    ].filter((item) => item.value > 0);
  }, [activeCount, inactiveCount, blacklistedCount]);

  // Filter pipeline
  const filteredSuppliers = useMemo(() => {
    return rawSuppliers.filter((s) => {
      // 1. Text Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = (s.name || '').toLowerCase().includes(q);
        const matchesCode = (s.code || '').toLowerCase().includes(q);
        const matchesContact = (s.contactPerson || '').toLowerCase().includes(q);
        const matchesEmail = (s.email || '').toLowerCase().includes(q);
        const matchesAddress = (s.address || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesContact && !matchesEmail && !matchesAddress) {
          return false;
        }
      }

      // 2. Status dropdown filter
      if (selectedStatus !== 'all' && (s.status || 'active').toLowerCase() !== selectedStatus.toLowerCase()) {
        return false;
      }

      // 3. Quick presets
      if (quickFilter === 'active') {
        if (s.status !== 'active') return false;
      } else if (quickFilter === 'inactive') {
        if (s.status !== 'inactive') return false;
      } else if (quickFilter === 'blacklisted') {
        if (s.status !== 'blacklisted') return false;
      } else if (quickFilter === 'has_email') {
        if (!s.email) return false;
      }

      return true;
    });
  }, [rawSuppliers, search, selectedStatus, quickFilter]);

  const hasActiveFilters =
    search.trim() !== '' ||
    selectedStatus !== 'all' ||
    quickFilter !== 'all';

  const handleClearFilters = () => {
    setSearch('');
    setSelectedStatus('all');
    setQuickFilter('all');
  };

  const handleDeleteConfirm = () => {
    if (supplierToDelete) {
      deleteMutation.mutate(supplierToDelete.id, {
        onSuccess: () => setSupplierToDelete(null),
      });
    }
  };

  // Columns definition for DataTable
  const columns: ColumnDef<Supplier>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="-ml-3 h-8 text-xs font-bold gap-1"
        >
          {t('suppliers_page.col_supplier', 'Supplier Name & Code')}
          <ArrowUpDown className="h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => {
        const supplier = row.original;
        const initials = getSupplierInitials(supplier.name);
        const avatarStyle = getSupplierAvatarStyle(supplier.name);

        return (
          <div className="flex items-center gap-3 py-1 min-w-[220px]">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border font-black text-xs tracking-wider shadow-2xs ${avatarStyle.bg} ${avatarStyle.text} ${avatarStyle.border}`}
            >
              {initials}
            </div>
            <div className="space-y-0.5 min-w-0">
              <Link
                to={`/suppliers/${supplier.id}`}
                className="text-xs sm:text-sm font-extrabold text-foreground hover:text-primary transition-colors hover:underline block truncate"
              >
                {supplier.name}
              </Link>
              <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase">
                {supplier.code}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'contactPerson',
      header: 'Primary Contact',
      cell: ({ row }) => {
        const supplier = row.original;
        return (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Users className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
            <span className="truncate max-w-[150px]">
              {supplier.contactPerson || 'Unassigned Contact'}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'email',
      header: 'Communication',
      cell: ({ row }) => {
        const supplier = row.original;
        return (
          <div className="space-y-0.5 text-xs">
            {supplier.email ? (
              <a
                href={`mailto:${supplier.email}`}
                className="flex items-center gap-1.5 text-primary hover:underline font-medium truncate max-w-[170px]"
              >
                <Mail className="h-3 w-3 text-blue-500 shrink-0" />
                <span className="truncate">{supplier.email}</span>
              </a>
            ) : (
              <span className="text-muted-foreground/60 text-[11px]">No email</span>
            )}
            {supplier.phone && (
              <a
                href={`tel:${supplier.phone}`}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground font-medium truncate"
              >
                <Phone className="h-3 w-3 text-emerald-500 shrink-0" />
                <span>{supplier.phone}</span>
              </a>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'address',
      header: 'Location',
      cell: ({ row }) => {
        const supplier = row.original;
        return (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0" />
            <span className="truncate max-w-[170px]">
              {supplier.address || 'Global Facility'}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const supplier = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="cursor-pointer group flex items-center gap-1">
                <Badge
                  variant={getSupplierStatusVariant(supplier.status)}
                  className="capitalize font-bold text-xs px-2.5 py-0.5 shadow-2xs group-hover:opacity-85 transition-opacity"
                >
                  {formatSupplierStatus(supplier.status)}
                </Badge>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-36 rounded-xl">
              <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">Change Status</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => updateMutation.mutate({ id: supplier.id, data: { status: 'active' } as any })}
              >
                Active
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => updateMutation.mutate({ id: supplier.id, data: { status: 'inactive' } as any })}
              >
                Inactive
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => updateMutation.mutate({ id: supplier.id, data: { status: 'blacklisted' } as any })}
              >
                Blacklisted
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const supplier = row.original;
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActiveQuickViewSupplier(supplier)}
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
              title="Quick View"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActiveAssignSupplier(supplier)}
              className="h-8 w-8 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
              title="Assign to Project"
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 rounded-xl">
                <DropdownMenuItem onClick={() => navigate(`/suppliers/${supplier.id}`)} className="gap-2 text-xs">
                  <ChevronRight className="h-3.5 w-3.5" /> Full Vendor Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/suppliers/${supplier.id}/edit`)} className="gap-2 text-xs">
                  <Edit className="h-3.5 w-3.5" /> Edit Information
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveAssignSupplier(supplier)} className="gap-2 text-xs">
                  <FolderPlus className="h-3.5 w-3.5 text-blue-500" /> Assign to Project
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setSupplierToDelete(supplier)}
                  className="gap-2 text-xs text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete Supplier
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
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col justify-between gap-6">
          {/* Top Bar inside Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Badge
                variant="outline"
                className="border-slate-700 bg-slate-900/90 text-blue-400 px-3.5 py-1.5 text-xs font-bold flex items-center gap-2 rounded-full shadow-xs"
              >
                <Building2 className="h-4 w-4 text-blue-400" />
                <span>Global Sourcing & Supplier Management</span>
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
                    <span>{t('suppliers_page.export_directory', 'Export')}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-2xl bg-card border-border shadow-xl">
                  <DropdownMenuLabel className="text-xs text-muted-foreground uppercase">Export Formats</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => exportSuppliersToCsv(filteredSuppliers)} className="gap-2 text-xs font-semibold cursor-pointer">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-500" /> Export CSV Directory
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportSuppliersToJson(filteredSuppliers)} className="gap-2 text-xs font-semibold cursor-pointer">
                    <FileCode className="h-4 w-4 text-blue-500" /> Export JSON Format
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => window.print()} className="gap-2 text-xs font-semibold cursor-pointer">
                    <Printer className="h-4 w-4 text-amber-500" /> Print / Save PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Add New Supplier */}
              <Button
                asChild
                size="sm"
                className="bg-[#0066CC] hover:bg-[#0052A3] text-white font-bold rounded-full px-5 py-2 text-xs shadow-md shadow-blue-500/20 gap-2 cursor-pointer"
              >
                <Link to="/suppliers/new">
                  <Plus className="h-4 w-4" />
                  {t('suppliers_page.new_supplier', 'Add New Supplier')}
                </Link>
              </Button>
            </div>
          </div>

          {/* Title & Description */}
          <div className="space-y-3 max-w-4xl">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
              {t('suppliers_page.title', 'Supplier & Vendor Registry')}
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
              {t(
                'suppliers_page.description',
                'Centralized registry of Tier-1 and Direct Material suppliers, manufacturing facilities, quality ratings, and monthly capacity allocations.'
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
            <span>Supplier Footprint & Procurement KPIs</span>
          </h2>
          <span className="text-xs font-semibold text-muted-foreground">
            {filteredSuppliers.length} of {totalCount} suppliers displayed
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <KPICard
            variant="ltos"
            title="Total Suppliers"
            value={totalCount}
            icon={Building2}
            subtitle="Registered global manufacturing partners"
            trend={{ value: `${totalCount} vendors`, isPositive: true }}
            actionText="View All"
            onClickAction={() => handleClearFilters()}
          />

          <KPICard
            variant="ltos"
            title="Active & Certified"
            value={activeCount}
            icon={CheckCircle2}
            subtitle="Approved for active production volumes"
            trend={{ value: `${activePct}% active`, isPositive: activePct >= 80 }}
            actionText="Filter Active"
            onClickAction={() => setQuickFilter('active')}
          />

          <KPICard
            variant="ltos"
            title="Capacity Assessed"
            value={activeCount}
            icon={Gauge}
            subtitle="Suppliers with monthly volume audits"
            trend={{ value: 'Full Coverage', isPositive: true }}
            actionText="Capacity Matrix"
            onClickAction={() => navigate('/capacity')}
          />

          <KPICard
            variant="ltos"
            title="Direct Material Tiers"
            value={totalCount > 0 ? `${totalCount} Tiers` : '0'}
            icon={Users}
            subtitle="Tier-1 commodities & components"
            trend={{ value: 'Stable', isPositive: true }}
            actionText="Card View"
            onClickAction={() => setViewMode('cards')}
          />

          <KPICard
            variant="ltos"
            title="At Risk / Blacklisted"
            value={blacklistedCount + inactiveCount}
            icon={AlertTriangle}
            subtitle="Inactive or flagged for quality reviews"
            trend={{
              value: blacklistedCount > 0 ? `${blacklistedCount} blacklisted` : 'None',
              isPositive: blacklistedCount === 0,
            }}
            actionText="Review"
            onClickAction={() => setQuickFilter('blacklisted')}
          />
        </div>
      </div>

      {/* ── Status Distribution & Fleet Breakdown ───────────────────────── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <PieChartIcon className="h-4 w-4 text-blue-600" />
            <h3 className="text-base font-extrabold text-foreground">Supplier Status Breakdown</h3>
          </div>
          <Badge variant="outline" className="text-xs font-semibold text-muted-foreground">
            {totalSuppliers} Total Suppliers
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-center">
          <div className="h-44 w-full md:col-span-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={65}
                  paddingAngle={4}
                >
                  {statusChartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 md:col-span-1 lg:col-span-3 gap-3">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center space-y-1">
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Active Production</span>
              <p className="text-2xl font-extrabold text-emerald-600">{activeCount}</p>
              <span className="text-[11px] text-muted-foreground">
                {totalSuppliers > 0 ? Math.round((activeCount / totalSuppliers) * 100) : 0}% of supplier base
              </span>
            </div>
            <div className="rounded-xl border border-slate-500/20 bg-slate-500/5 p-4 text-center space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Inactive</span>
              <p className="text-2xl font-extrabold text-slate-500">{inactiveCount}</p>
              <span className="text-[11px] text-muted-foreground">
                {totalSuppliers > 0 ? Math.round((inactiveCount / totalSuppliers) * 100) : 0}% of supplier base
              </span>
            </div>
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-center space-y-1">
              <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">Blacklisted</span>
              <p className="text-2xl font-extrabold text-rose-600">{blacklistedCount}</p>
              <span className="text-[11px] text-muted-foreground">
                {totalSuppliers > 0 ? Math.round((blacklistedCount / totalSuppliers) * 100) : 0}% of supplier base
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── View Modes & Filtering Toolbar ──────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-5 shadow-sm space-y-4">
        {/* Top Row: View Switcher + Search + Status */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* View Mode Tabs */}
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
              <span>{t('suppliers_page.view_table', 'Table View')}</span>
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-card text-foreground shadow-xs border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5 text-indigo-500" />
              <span>{t('suppliers_page.view_cards', 'Vendor Cards')}</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('suppliers_page.search_placeholder', 'Search by vendor name, code, contact, email...')}
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

          {/* Status Dropdown */}
          <div className="flex items-center gap-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-9 px-3 rounded-xl border border-border bg-background text-xs font-semibold text-foreground focus:outline-hidden cursor-pointer"
            >
              <option value="all">{t('suppliers_page.filter_all', 'All Statuses')}</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="blacklisted">Blacklisted</option>
            </select>
          </div>
        </div>

        {/* Quick Filter Presets Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-muted-foreground mr-1">Presets:</span>
            {[
              { id: 'all', label: t('suppliers_page.quick_all', 'All Suppliers') },
              { id: 'active', label: t('suppliers_page.quick_active', 'Active Only') },
              { id: 'inactive', label: t('suppliers_page.quick_inactive', 'Inactive') },
              { id: 'blacklisted', label: t('suppliers_page.quick_blacklisted', 'Blacklisted') },
              { id: 'has_email', label: t('suppliers_page.quick_has_email', 'Has Direct Email') },
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
              <X className="h-3 w-3" /> {t('suppliers_page.clear_filters', 'Clear Filters')}
            </Button>
          )}
        </div>
      </div>

      {/* ── Active View Rendering ───────────────────────────────────────── */}
      {viewMode === 'table' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-4 shadow-sm">
          <DataTable
            columns={columns}
            data={filteredSuppliers}
            loading={isLoading}
            error={error?.message ?? null}
            onRetry={refetch}
            searchable={false}
            filterable={false}
          />
        </div>
      )}

      {viewMode === 'cards' && (
        <SupplierCardGrid
          suppliers={filteredSuppliers}
          onOpenQuickView={(s) => setActiveQuickViewSupplier(s)}
          onAssignToProject={(s) => setActiveAssignSupplier(s)}
          onDeleteSupplier={(s) => setSupplierToDelete(s)}
        />
      )}

      {/* ── Modals & Dialogs ────────────────────────────────────────────── */}
      <SupplierQuickViewModal
        supplier={activeQuickViewSupplier}
        open={!!activeQuickViewSupplier}
        onOpenChange={(open) => !open && setActiveQuickViewSupplier(null)}
        onAssignToProject={(s) => setActiveAssignSupplier(s)}
      />

      <AssignToProjectModal
        supplier={activeAssignSupplier}
        open={!!activeAssignSupplier}
        onOpenChange={(open) => !open && setActiveAssignSupplier(null)}
      />

      <ConfirmDialog
        open={!!supplierToDelete}
        onOpenChange={(open) => !open && setSupplierToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Supplier"
        message={`Are you sure you want to delete "${supplierToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
