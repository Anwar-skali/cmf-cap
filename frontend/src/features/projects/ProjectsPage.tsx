import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProjectsQuery } from '@/hooks/queries/useProjectsQuery';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, ChevronRight, Building2, Filter, FileSpreadsheet } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { Project } from '@/types';
import { getStatusVariant } from '@/lib/utils';

export default function ProjectsPage() {
  const [search, setSearch] = useState('');

  const { data: projects, isLoading, error, refetch } = useProjectsQuery();

  const filtered = projects?.items?.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase()),
  );

  const columns: ColumnDef<Project>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <Link to={`/projects/${row.original.id}`} className="flex items-center gap-2.5 text-primary hover:underline font-medium">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-3.5 w-3.5" />
          </div>
          {row.original.name}
        </Link>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={getStatusVariant(row.original.status)}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'start_date',
      header: 'Start Date',
      cell: ({ row }) => row.original.startDate ? new Date(row.original.startDate).toLocaleDateString() : '-',
    },
    {
      accessorKey: 'end_date',
      header: 'End Date',
      cell: ({ row }) => row.original.endDate ? new Date(row.original.endDate).toLocaleDateString() : '-',
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Link to={`/projects/${row.original.id}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground text-balance">Manage your CMF projects</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" asChild>
            <Link to="/documents">
              <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600" /> Import Excel
            </Link>
          </Button>
          <Button asChild>
            <Link to="/projects/new">
              <Plus className="mr-2 h-4 w-4" /> New Project
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" /> Filters
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filtered ?? []}
        loading={isLoading}
        error={error?.message ?? null}
        onRetry={refetch}
      />
    </div>
  );
}
