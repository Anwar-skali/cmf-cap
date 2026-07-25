import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRisksQuery } from '@/hooks/queries/useRisksQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { Plus, Search, ChevronRight, AlertTriangle, Filter, ShieldCheck } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { Risk } from '@/types';
import { getRiskLevelVariant, getStatusVariant } from '@/lib/utils';

export default function RisksPage() {
  const [search, setSearch] = useState('');
  const { isSQD } = usePermissions();

  const { data: risks, isLoading, error, refetch } = useRisksQuery();


  const filtered = risks?.items?.filter(
    (r) =>
      r.title?.toLowerCase().includes(search.toLowerCase()) ||
      r.description?.toLowerCase().includes(search.toLowerCase()),
  );

  const columns: ColumnDef<Risk>[] = [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <Link to={`/risks/${row.original.id}`} className="flex items-center gap-2.5 text-primary hover:underline font-medium">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <AlertTriangle className="h-3.5 w-3.5" />
          </div>
          {row.original.title}
        </Link>
      ),
    },
    {
      accessorKey: 'severity',
      header: 'Level',
      cell: ({ row }) => (
        <Badge variant={getRiskLevelVariant(row.original.severity)}>
          {row.original.severity}
        </Badge>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={getStatusVariant(row.original.status)}>{row.original.status}</Badge>
      ),
    },
    {
      accessorKey: 'project',
      header: 'Project',
      cell: ({ row }) => row.original.projectName || '-',
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Link to={`/risks/${row.original.id}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8"><ChevronRight className="h-4 w-4" /></Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Quality & Project Risks" description="Track non-conformities, defect severity, and mitigation plans">
        <Button asChild className={isSQD ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}>
          <Link to="/risks/new">
            {isSQD ? <ShieldCheck className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
            Log New Risk
          </Link>
        </Button>
      </PageHeader>


      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search risks..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button variant="outline" size="sm" className="gap-2"><Filter className="h-4 w-4" /> Filters</Button>
      </div>

      <DataTable columns={columns} data={filtered ?? []} loading={isLoading} error={error?.message ?? null} onRetry={refetch} />
    </div>
  );
}
