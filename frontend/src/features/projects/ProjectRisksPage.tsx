import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProjectQuery } from '@/hooks/queries/useProjectsQuery';
import { useRisksQuery } from '@/hooks/queries/useRisksQuery';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Search, AlertTriangle } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { Risk } from '@/types';
import { getRiskLevelVariant, getStatusVariant } from '@/lib/utils';
import { ErrorState } from '@/components/ui/error-state';

export default function ProjectRisksPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [search, setSearch] = useState('');

  const { data: project, error: projectError } = useProjectQuery(projectId!);
  const { data: allRisks, isLoading, error: risksError, refetch: refetchRisks } = useRisksQuery();

  const risks = allRisks?.items?.filter((r) => r.projectId === projectId) ?? [];
  const filtered = risks.filter(
    (r) => r.title?.toLowerCase().includes(search.toLowerCase()),
  );

  const columns: ColumnDef<Risk>[] = [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <Link to={`/risks/${row.original.id}`} className="flex items-center gap-2 text-primary hover:underline">
          <AlertTriangle className="h-4 w-4" />
          {row.original.title}
        </Link>
      ),
    },
    {
      accessorKey: 'severity',
      header: 'Level',
      cell: ({ row }) => <Badge variant={getRiskLevelVariant(row.original.severity)}>{row.original.severity}</Badge>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge variant={getStatusVariant(row.original.status)}>{row.original.status}</Badge>,
    },
  ];

  if (projectError) return <ErrorState title="Failed to load project" message={projectError?.message} onRetry={refetchRisks} />;
  if (!project) return <Skeleton className="h-8 w-64" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/projects/${projectId}`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{project.name} - Risks</h1>
          <p className="text-muted-foreground">Manage risks for this project</p>
        </div>
      </div>
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search risks..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>
      <DataTable columns={columns} data={filtered ?? []} loading={isLoading} error={risksError?.message ?? null} onRetry={refetchRisks} />
    </div>
  );
}
