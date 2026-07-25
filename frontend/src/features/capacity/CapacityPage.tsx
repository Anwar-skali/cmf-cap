import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCapacityAssessmentsQuery } from '@/hooks/queries/useCapacityQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { Plus, Search, ChevronRight, BarChart3, Filter, Lock } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { CapacityAssessment } from '@/types';
import { getStatusVariant } from '@/lib/utils';

export default function CapacityPage() {
  const [search, setSearch] = useState('');
  const { canCreateCapacityAssessment, roleMeta } = usePermissions();

  const { data: assessments, isLoading, error, refetch } = useCapacityAssessmentsQuery();


  const filtered = assessments?.items?.filter(
    (a) =>
      (a.bottleneck && a.bottleneck.toLowerCase().includes(search.toLowerCase())) ||
      (a.notes && a.notes.toLowerCase().includes(search.toLowerCase())),
  );

  const columns: ColumnDef<CapacityAssessment>[] = [
    {
      accessorKey: 'bottleneck',
      header: 'Bottleneck',
      cell: ({ row }) => (
        <Link to={`/capacity/${row.original.id}`} className="flex items-center gap-2.5 text-primary hover:underline font-medium">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <BarChart3 className="h-3.5 w-3.5" />
          </div>
          {row.original.bottleneck || 'N/A'}
        </Link>
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
      accessorKey: 'month',
      header: 'Period',
      cell: ({ row }) => `${row.original.month}/${row.original.year}`,
    },
    {
      accessorKey: 'utilization_rate',
      header: 'Utilization',
      cell: ({ row }) => row.original.utilizationRate != null ? `${row.original.utilizationRate}%` : '-',
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Link to={`/capacity/${row.original.id}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8"><ChevronRight className="h-4 w-4" /></Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Capacity Assessments" description="Manage organizational capacity assessments & bottleneck analysis">
        {canCreateCapacityAssessment ? (
          <Button asChild className="bg-amber-600 hover:bg-amber-700 text-white">
            <Link to="/capacity/new"><Plus className="mr-2 h-4 w-4" /> New Assessment</Link>
          </Button>
        ) : (
          <Badge variant="outline" className="px-3 py-1.5 text-xs text-muted-foreground bg-muted/50 border gap-1.5">
            <Lock className="h-3.5 w-3.5" /> Creation restricted to Capacity Managers
          </Badge>
        )}
      </PageHeader>


      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search assessments..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button variant="outline" size="sm" className="gap-2"><Filter className="h-4 w-4" /> Filters</Button>
      </div>

      <DataTable columns={columns} data={filtered ?? []} loading={isLoading} error={error?.message ?? null} onRetry={refetch} />
    </div>
  );
}
