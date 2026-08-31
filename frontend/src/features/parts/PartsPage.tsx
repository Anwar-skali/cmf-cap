import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { usePartsQuery } from '@/hooks/queries/usePartsQuery';
import { useDeletePartMutation, useUpdatePartMutation } from '@/hooks/mutations/usePartMutations';
import { usePermissions } from '@/hooks/usePermissions';
import { useLanguage } from '@/context/LanguageContext';
import { useAuthStore } from '@/stores/authStore';
import { KPICard } from '@/components/ui/KPICard';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Package,
  Plus,
  Search,
  Filter,
  Layers,
  Boxes,
  Scale,
  Building2,
  Eye,
  Pencil,
  Trash2,
  Download,
  FileSpreadsheet,
  FileCode,
  Printer,
  Table as TableIcon,
  LayoutGrid,
  PieChart as PieChartIcon,
  RefreshCw,
  MoreHorizontal,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  X,
  ChevronRight,
  UserCheck,
  Copy,
  Check,
  ArrowUpDown,
  Tag,
  ExternalLink,
} from 'lucide-react';
import type { ProjectPart, PartStatus } from '@/types';
import {
  getPartInitials,
  getPartAvatarStyle,
  getPartStatusVariant,
  formatPartStatus,
  getMaterialStyle,
  calculatePartsMetrics,
  exportPartsToCsv,
  exportPartsToJson,
} from './utils/partUtils';
import { PartCardGrid } from './components/PartCardGrid';
import { PartQuickViewModal } from './components/PartQuickViewModal';
import { toast } from 'sonner';

type ViewMode = 'table' | 'cards';

export default function PartsPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { roleMeta, isBuyer, isCapacityManager, isSQD, isAdmin } = usePermissions();
  const { state: authState } = useAuthStore();
  const currentUser = authState.user;

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  // Filter & Search states
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [materialFilter, setMaterialFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('default');

  // Selection & Modal states
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [quickViewPart, setQuickViewPart] = useState<ProjectPart | null>(null);
  const [deleteTargetPart, setDeleteTargetPart] = useState<ProjectPart | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Queries & Mutations
  // Pass search to server AND use a large pageSize so all parts are returned (no pagination cut-off).
  const { data: partsResponse, isLoading, error, refetch, isFetching } = usePartsQuery(
    { search: search.trim() || undefined, pageSize: 1000 }
  );
  const deletePartMutation = useDeletePartMutation();
  const updatePartMutation = useUpdatePartMutation();

  const allParts = partsResponse?.items ?? [];

  // Extract unique materials & suppliers for dropdown filters
  const uniqueMaterials = useMemo(() => {
    const set = new Set<string>();
    allParts.forEach((p) => {
      if (p.material?.trim()) set.add(p.material.trim());
    });
    return Array.from(set).sort();
  }, [allParts]);

  const uniqueSuppliers = useMemo(() => {
    const set = new Set<string>();
    allParts.forEach((p) => {
      if (p.supplier?.name) set.add(p.supplier.name);
    });
    return Array.from(set).sort();
  }, [allParts]);

  // Client-side filters (status, material, supplier). Search is handled server-side.
  const filteredParts = useMemo(() => {
    return allParts
      .filter((part) => {
        // Status filter
        if (statusFilter !== 'all' && part.status !== statusFilter) return false;
        // Material filter
        if (materialFilter !== 'all' && part.material?.toLowerCase().trim() !== materialFilter.toLowerCase().trim()) return false;
        // Supplier filter
        if (supplierFilter !== 'all' && part.supplier?.name !== supplierFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
        if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
        if (sortBy === 'quantity_desc') return (b.quantity || 0) - (a.quantity || 0);
        if (sortBy === 'quantity_asc') return (a.quantity || 0) - (b.quantity || 0);
        if (sortBy === 'partNumber_asc') return (a.partNumber || '').localeCompare(b.partNumber || '');
        if (sortBy === 'date_desc') return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        return 0;
      });
  }, [allParts, statusFilter, materialFilter, supplierFilter, sortBy]);

  // Overall metrics
  const metrics = useMemo(() => calculatePartsMetrics(allParts), [allParts]);

  const RoleIcon = roleMeta.icon;

  // Copy handler
  const handleCopyPartNumber = (id: string, partNumber: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(partNumber);
    setCopiedId(id);
    toast.success('Part number copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Toggle selection
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredParts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredParts.map((p) => p.id));
    }
  };

  // Bulk actions
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      await Promise.all(selectedIds.map((id) => deletePartMutation.mutateAsync(id)));
      toast.success(`Successfully deleted ${selectedIds.length} parts`);
      setSelectedIds([]);
      setShowBulkDeleteConfirm(false);
      refetch();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete selected parts');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleBulkExportCsv = () => {
    const targets = selectedIds.length > 0
      ? allParts.filter((p) => selectedIds.includes(p.id))
      : filteredParts;
    exportPartsToCsv(targets, `cmf-parts-${targets.length}-items.csv`);
    toast.success(`Exported ${targets.length} parts to CSV`);
  };

  const handleBulkExportJson = () => {
    const targets = selectedIds.length > 0
      ? allParts.filter((p) => selectedIds.includes(p.id))
      : filteredParts;
    exportPartsToJson(targets, `cmf-parts-${targets.length}-items.json`);
    toast.success(`Exported ${targets.length} parts to JSON`);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleQuickStatusChange = (part: ProjectPart, newStatus: PartStatus) => {
    updatePartMutation.mutate(
      { id: part.id, data: { status: newStatus } as any },
      {
        onSuccess: () => {
          toast.success(`Part "${part.name}" updated to ${formatPartStatus(newStatus)}`);
        },
      }
    );
  };

  // Reset filters
  const hasActiveFilters =
    search.trim() !== '' ||
    statusFilter !== 'all' ||
    materialFilter !== 'all' ||
    supplierFilter !== 'all' ||
    sortBy !== 'default';

  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setMaterialFilter('all');
    setSupplierFilter('all');
    setSortBy('default');
  };

  // TanStack Table columns
  const columnHelper = createColumnHelper<ProjectPart>();

  const columns = useMemo<ColumnDef<ProjectPart, any>[]>(
    () => [
      columnHelper.display({
        id: 'select',
        header: () => (
          <input
            type="checkbox"
            checked={filteredParts.length > 0 && selectedIds.length === filteredParts.length}
            onChange={handleSelectAll}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            aria-label="Select all parts"
          />
        ),
        cell: (info) => (
          <input
            type="checkbox"
            checked={selectedIds.includes(info.row.original.id)}
            onChange={() => handleToggleSelect(info.row.original.id)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            aria-label={`Select ${info.row.original.name}`}
          />
        ),
      }),
      columnHelper.accessor('name', {
        header: 'Component / Part',
        cell: (info) => {
          const part = info.row.original;
          const initials = getPartInitials(part.name);
          const avatarStyle = getPartAvatarStyle(part.name);

          return (
            <div className="flex items-center gap-3 py-1">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border font-black text-xs tracking-wider shadow-2xs ${avatarStyle.bg} ${avatarStyle.text} ${avatarStyle.border}`}
              >
                {initials}
              </div>
              <div className="space-y-0.5">
                <Link
                  to={`/parts/${part.id}`}
                  className="font-extrabold text-foreground hover:text-primary transition-colors line-clamp-1 block text-sm"
                >
                  {part.name}
                </Link>
                {part.description && (
                  <p className="text-[11px] text-muted-foreground line-clamp-1 max-w-[220px]">
                    {part.description}
                  </p>
                )}
              </div>
            </div>
          );
        },
      }),
      columnHelper.accessor('partNumber', {
        header: 'Part Number',
        cell: (info) => {
          const part = info.row.original;
          return (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs font-bold text-foreground bg-muted/60 px-2 py-0.5 rounded-md">
                {info.getValue()}
              </span>
              <button
                onClick={(e) => handleCopyPartNumber(part.id, part.partNumber, e)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 cursor-pointer"
                title="Copy part number"
              >
                {copiedId === part.id ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          );
        },
      }),
      columnHelper.accessor('status', {
        header: 'Lifecycle Status',
        cell: (info) => {
          const part = info.row.original;
          const status = info.getValue();
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="cursor-pointer focus:outline-hidden">
                  <Badge
                    variant={getPartStatusVariant(status)}
                    className="capitalize font-bold text-[11px] px-2.5 py-0.5 gap-1.5 hover:opacity-85 transition-opacity"
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        status === 'active'
                          ? 'bg-emerald-500'
                          : status === 'obsolete'
                          ? 'bg-rose-500'
                          : 'bg-slate-400'
                      }`}
                    />
                    {formatPartStatus(status)}
                  </Badge>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-36 rounded-2xl">
                <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground">
                  Change Status
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => handleQuickStatusChange(part, 'active')}
                  className="cursor-pointer text-xs gap-2 font-semibold text-emerald-600"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Active
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleQuickStatusChange(part, 'inactive')}
                  className="cursor-pointer text-xs gap-2 font-semibold text-slate-600"
                >
                  <Layers className="h-3.5 w-3.5" /> Inactive
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleQuickStatusChange(part, 'obsolete')}
                  className="cursor-pointer text-xs gap-2 font-semibold text-rose-600"
                >
                  <AlertTriangle className="h-3.5 w-3.5" /> Obsolete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      }),
      columnHelper.accessor('quantity', {
        header: 'Quantity / BOM',
        cell: (info) => {
          const qty = info.getValue();
          const unit = info.row.original.unit || 'pcs';
          return (
            <div className="space-y-0.5">
              <span className="font-extrabold text-sm text-foreground">
                {qty?.toLocaleString()}
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground ml-1">
                {unit}
              </span>
            </div>
          );
        },
      }),
      columnHelper.accessor('material', {
        header: 'Material Spec',
        cell: (info) => {
          const material = info.getValue();
          const matStyle = getMaterialStyle(material);
          if (!material) return <span className="text-xs text-muted-foreground">-</span>;
          return (
            <span
              className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-lg border ${matStyle.bg} ${matStyle.text} ${matStyle.border}`}
            >
              {material}
            </span>
          );
        },
      }),
      columnHelper.accessor('supplier', {
        header: 'Sourcing Supplier',
        cell: (info) => {
          const supplier = info.getValue();
          if (!supplier?.name) {
            return <span className="text-xs text-muted-foreground italic">Unassigned</span>;
          }
          return (
            <Link
              to={`/suppliers/${supplier.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground hover:text-primary transition-colors"
            >
              <Building2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span className="truncate max-w-[140px]">{supplier.name}</span>
            </Link>
          );
        },
      }),
      columnHelper.accessor('weight', {
        header: 'Unit Mass',
        cell: (info) => {
          const weight = info.getValue();
          if (weight === undefined || weight === null) {
            return <span className="text-xs text-muted-foreground">-</span>;
          }
          return (
            <span className="font-mono text-xs text-muted-foreground font-medium">
              {weight} kg
            </span>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: (info) => {
          const part = info.row.original;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary cursor-pointer"
                onClick={() => setQuickViewPart(part)}
                title="Quick View"
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => navigate(`/parts/${part.id}/edit`)}
                title="Edit Part"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 rounded-2xl">
                  <DropdownMenuItem
                    onClick={() => navigate(`/parts/${part.id}`)}
                    className="cursor-pointer text-xs gap-2"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Full Page Details
                  </DropdownMenuItem>
                  {part.projectId && (
                    <DropdownMenuItem
                      onClick={() => navigate(`/projects/${part.projectId}`)}
                      className="cursor-pointer text-xs gap-2"
                    >
                      <Layers className="h-3.5 w-3.5" /> View Project
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setDeleteTargetPart(part)}
                    className="cursor-pointer text-xs gap-2 text-rose-600 focus:text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete Part
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      }),
    ] as ColumnDef<ProjectPart, any>[],
    [columnHelper, filteredParts, selectedIds, copiedId, navigate]
  );

  if (error) {
    return (
      <ErrorState
        title="Failed to load parts catalog"
        message={(error as any)?.message}
        onRetry={refetch}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full rounded-3xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* ── Top Hero Dark Banner ────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-[#0a101d] text-white p-6 sm:p-8 lg:p-10 shadow-xl border border-slate-800">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col justify-between gap-6">
          {/* Breadcrumb & Role */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <nav className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <span
                className="hover:text-white transition-colors cursor-pointer"
                onClick={() => navigate('/')}
              >
                {t('dashboard.home', 'Home')}
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-slate-200">Parts & Components</span>
            </nav>

            <div className="flex items-center gap-3">
              <Badge
                variant="outline"
                className="border-slate-700 bg-slate-900/90 text-blue-400 px-3.5 py-1.5 text-xs font-bold flex items-center gap-2 rounded-full shadow-xs"
              >
                <RoleIcon className="h-4 w-4 text-blue-400" />
                <span>{roleMeta.title}</span>
              </Badge>
              {currentUser && (
                <Badge
                  variant="outline"
                  className="border-slate-700 bg-slate-900/60 text-slate-300 px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 rounded-full"
                >
                  <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span>{currentUser.email}</span>
                </Badge>
              )}
            </div>
          </div>

          {/* Title & Description */}
          <div className="space-y-3 max-w-4xl">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white flex items-center gap-3">
              Parts & Components Catalog
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
              Automated Bill of Materials (BOM) management, part classification, technical specifications, and industrial supplier mappings across CMF production lines.
            </p>
          </div>

          {/* Quick Actions Bar */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              onClick={() => navigate('/parts/new')}
              size="sm"
              className="bg-[#0066CC] hover:bg-[#0052A3] text-white font-bold rounded-full px-5 py-2 text-xs shadow-md shadow-blue-500/20 gap-2 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Create New Part
            </Button>

            {/* Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800 font-semibold rounded-full px-4 py-2 text-xs gap-2 cursor-pointer"
                >
                  <Download className="h-4 w-4 text-blue-400" /> Export Catalog
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 rounded-2xl">
                <DropdownMenuItem
                  onClick={handleBulkExportCsv}
                  className="cursor-pointer text-xs gap-2 font-semibold"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleBulkExportJson}
                  className="cursor-pointer text-xs gap-2 font-semibold"
                >
                  <FileCode className="h-4 w-4 text-amber-600" /> Export as JSON
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handlePrint}
                  className="cursor-pointer text-xs gap-2 font-semibold"
                >
                  <Printer className="h-4 w-4 text-slate-600" /> Print Summary
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Refresh Button */}
            <Button
              onClick={() => refetch()}
              size="sm"
              variant="outline"
              className="border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800 font-semibold rounded-full px-4 py-2 text-xs gap-2 cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 text-emerald-400 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* ── 6 Top-Level KPI Cards Row ───────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-blue-600" />
            <span>Parts Inventory Overview</span>
          </h2>
          <span className="text-xs font-semibold text-muted-foreground">
            {metrics.totalParts} Parts Tracked
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <KPICard
            variant="ltos"
            title="Total Parts"
            value={metrics.totalParts}
            icon={Package}
            subtitle="Catalog components across all programs"
            trend={{ value: '+4 items', isPositive: true }}
            actionText="View Table"
            onClickAction={() => setViewMode('table')}
          />

          <KPICard
            variant="ltos"
            title="Active Parts"
            value={metrics.activeCount}
            icon={CheckCircle2}
            accentColor="#10b981"
            subtitle="Qualified in active production lines"
            trend={{ value: 'In-Production', isPositive: true }}
            actionText="Filter Active"
            onClickAction={() => {
              setStatusFilter('active');
              setViewMode('table');
            }}
          />

          <KPICard
            variant="ltos"
            title="Standby / Inactive"
            value={metrics.inactiveCount}
            icon={Layers}
            accentColor="#64748b"
            subtitle="Components in review or on hold"
            trend={{ value: metrics.inactiveCount > 0 ? 'Pending' : 'Zero', isPositive: metrics.inactiveCount === 0 }}
            actionText="Filter Inactive"
            onClickAction={() => {
              setStatusFilter('inactive');
              setViewMode('table');
            }}
          />

          <KPICard
            variant="ltos"
            title="Obsolete / EOL"
            value={metrics.obsoleteCount}
            icon={AlertTriangle}
            accentColor="#ef4444"
            subtitle="Discontinued or phased-out items"
            trend={{ value: metrics.obsoleteCount > 0 ? 'Phase-out' : 'Clean', isPositive: metrics.obsoleteCount === 0 }}
            actionText="Filter Obsolete"
            onClickAction={() => {
              setStatusFilter('obsolete');
              setViewMode('table');
            }}
          />

          <KPICard
            variant="ltos"
            title="Total BOM Units"
            value={`${(metrics.totalQuantity / 1000).toFixed(1)}K`}
            icon={Boxes}
            accentColor="#8b5cf6"
            subtitle="Aggregated component quantity in BOM"
            trend={{ value: 'High Volume', isPositive: true }}
            actionText="Analytics"
            onClickAction={() => setViewMode('analytics')}
          />

          <KPICard
            variant="ltos"
            title="Sourced Suppliers"
            value={metrics.uniqueSuppliersCount}
            icon={Building2}
            accentColor="#f59e0b"
            subtitle="Suppliers assigned to catalog parts"
            trend={{ value: 'Qualified', isPositive: true }}
            actionText="Suppliers"
            onClickAction={() => navigate('/suppliers')}
          />
        </div>
      </div>

      {/* ── Filter Toolbar & View Mode Switcher ─────────────────────────── */}
      <div className="rounded-3xl border border-border bg-card p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by part name, PN, material, supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-10 rounded-full border-border bg-muted/30 focus:bg-card text-xs h-10"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filter Selects & View Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-full border border-border bg-muted/30 px-3 text-xs font-semibold text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="all">Status: All ({allParts.length})</option>
              <option value="active">Active ({metrics.activeCount})</option>
              <option value="inactive">Inactive ({metrics.inactiveCount})</option>
              <option value="obsolete">Obsolete ({metrics.obsoleteCount})</option>
            </select>

            {/* Material Filter */}
            {uniqueMaterials.length > 0 && (
              <select
                value={materialFilter}
                onChange={(e) => setMaterialFilter(e.target.value)}
                className="h-9 rounded-full border border-border bg-muted/30 px-3 text-xs font-semibold text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="all">Material: All</option>
                {uniqueMaterials.map((mat) => (
                  <option key={mat} value={mat}>
                    {mat}
                  </option>
                ))}
              </select>
            )}

            {/* Supplier Filter */}
            {uniqueSuppliers.length > 0 && (
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="h-9 rounded-full border border-border bg-muted/30 px-3 text-xs font-semibold text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer max-w-[150px] truncate"
              >
                <option value="all">Supplier: All</option>
                {uniqueSuppliers.map((sup) => (
                  <option key={sup} value={sup}>
                    {sup}
                  </option>
                ))}
              </select>
            )}

            {/* Sort Select */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-9 rounded-full border border-border bg-muted/30 px-3 text-xs font-semibold text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="default">Sort: Default</option>
              <option value="name_asc">Name (A-Z)</option>
              <option value="name_desc">Name (Z-A)</option>
              <option value="partNumber_asc">Part Number</option>
              <option value="quantity_desc">Quantity (High to Low)</option>
              <option value="quantity_asc">Quantity (Low to High)</option>
              <option value="date_desc">Newest First</option>
            </select>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-9 rounded-full text-xs font-bold text-rose-500 hover:bg-rose-500/10 cursor-pointer gap-1"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}

            {/* View Mode Toggle Buttons */}
            <div className="flex items-center bg-muted/40 p-1 rounded-full border border-border ml-auto lg:ml-0">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <TableIcon className="h-3.5 w-3.5" /> Table
              </button>

              <button
                onClick={() => setViewMode('cards')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Cards
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Selection Floating Action Bar */}
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-2xl px-4 py-2.5 animate-fade-in">
            <div className="flex items-center gap-2">
              <Badge className="bg-primary text-primary-foreground font-black text-xs px-2.5 py-0.5 rounded-full">
                {selectedIds.length} Selected
              </Badge>
              <span className="text-xs font-medium text-muted-foreground">
                parts selected for batch actions
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-full text-xs font-bold border-border hover:bg-card cursor-pointer gap-1.5"
                onClick={handleBulkExportCsv}
              >
                <Download className="h-3.5 w-3.5" /> Export Selected
              </Button>

              <Button
                variant="destructive"
                size="sm"
                className="h-8 rounded-full text-xs font-bold cursor-pointer gap-1.5"
                onClick={() => setShowBulkDeleteConfirm(true)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete Selected
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => setSelectedIds([])}
              >
                Deselect
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Main Content Views ─────────────────────────────────────────── */}
      {viewMode === 'table' && (
        <div className="space-y-4">
          <DataTable
            columns={columns}
            data={filteredParts}
            searchable={false}
            loading={isLoading}
            error={(error as any)?.message ?? null}
            onRetry={refetch}
          />
        </div>
      )}

      {viewMode === 'cards' && (
        <PartCardGrid
          parts={filteredParts}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onOpenQuickView={(part) => setQuickViewPart(part)}
          onDeletePart={(part) => setDeleteTargetPart(part)}
        />
      )}

      {/* ── Modals & Dialogs ───────────────────────────────────────────── */}
      {/* Quick View Modal */}
      <PartQuickViewModal
        part={quickViewPart}
        open={quickViewPart !== null}
        onOpenChange={(open) => !open && setQuickViewPart(null)}
      />

      {/* Single Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteTargetPart !== null}
        onOpenChange={() => setDeleteTargetPart(null)}
        onConfirm={() => {
          if (deleteTargetPart) {
            deletePartMutation.mutate(deleteTargetPart.id, {
              onSuccess: () => {
                setDeleteTargetPart(null);
                setSelectedIds((prev) => prev.filter((id) => id !== deleteTargetPart.id));
              },
            });
          }
        }}
        title="Delete Component Part"
        message={`Are you sure you want to delete "${deleteTargetPart?.name}" (${deleteTargetPart?.partNumber})? This action cannot be undone.`}
        confirmText="Delete Part"
        loading={deletePartMutation.isPending}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showBulkDeleteConfirm}
        onOpenChange={setShowBulkDeleteConfirm}
        onConfirm={handleBulkDelete}
        title="Delete Selected Parts"
        message={`Are you sure you want to delete ${selectedIds.length} selected parts? This action cannot be undone and will remove them from the BOM.`}
        confirmText={`Delete ${selectedIds.length} Parts`}
        loading={isBulkDeleting}
      />
    </div>
  );
}
