import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProjectQuery } from '@/hooks/queries/useProjectsQuery';
import { usePartsQuery } from '@/hooks/queries/usePartsQuery';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Search, Package, Plus } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { ProjectPart } from '@/types';
import { getStatusVariant } from '@/lib/utils';
import { ErrorState } from '@/components/ui/error-state';

export default function ProjectPartsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [search, setSearch] = useState('');

  const { data: project, error: projectError } = useProjectQuery(projectId!);
  const { data: allParts, isLoading, error: partsError, refetch: refetchParts } = usePartsQuery();

  const parts = allParts?.items?.filter((p) => p.projectId === projectId) ?? [];
  const filtered = parts.filter(
    (p) => p.name?.toLowerCase().includes(search.toLowerCase()) || p.partNumber?.toLowerCase().includes(search.toLowerCase()),
  );

  const columns: ColumnDef<ProjectPart>[] = [
    { accessorKey: 'partNumber', header: 'Part #' },
    { accessorKey: 'name', header: 'Name' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge variant={getStatusVariant(row.original.status)}>{row.original.status}</Badge>,
    },
    {
      accessorKey: 'supplier',
      header: 'Supplier',
      cell: ({ row }) => row.original.supplier?.name || '-',
    },
  ];

  if (projectError) return <ErrorState title="Failed to load project" message={projectError?.message} onRetry={refetchParts} />;
  if (!project) return <Skeleton className="h-8 w-64" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/projects/${projectId}`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{project.name} - Parts</h1>
          <p className="text-muted-foreground">Manage parts for this project</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search parts..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/parts"><Package className="mr-2 h-4 w-4" /> All Parts</Link>
        </Button>
      </div>
      <DataTable columns={columns} data={filtered ?? []} loading={isLoading} error={partsError?.message ?? null} onRetry={refetchParts} />
    </div>
  );
}
