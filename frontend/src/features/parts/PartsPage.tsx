import { useNavigate, Link } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { Eye, Pencil, Trash2, Plus } from 'lucide-react';
import { usePartsQuery } from '@/hooks/queries/usePartsQuery';
import { useDeletePartMutation } from '@/hooks/mutations/usePartMutations';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { ProjectPart, PartStatus } from '@/types';

const statusVariant: Record<PartStatus, 'warning' | 'success' | 'default' | 'destructive' | 'secondary'> = {
  active: 'success',
  inactive: 'secondary',
  obsolete: 'destructive',
};

export default function PartsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = usePartsQuery(
    search ? { search } : undefined,
  );
  const deletePart = useDeletePartMutation();

  const columnHelper = createColumnHelper<ProjectPart>();

  const columns = useMemo(
    () =>
      [
        columnHelper.accessor('name', {
          header: 'Name',
          cell: (info) => (
            <button
              className="font-medium text-primary hover:underline"
              onClick={() => navigate(`/parts/${info.row.original.id}`)}
            >
              {info.getValue()}
            </button>
          ),
        }),
        columnHelper.accessor('partNumber', {
          header: 'Part Number',
        }),
        columnHelper.accessor('quantity', {
          header: 'Quantity',
        }),
        columnHelper.accessor('unit', {
          header: 'Unit',
        }),
        columnHelper.accessor('material', {
          header: 'Material',
          cell: (info) => info.getValue() ?? '-',
        }),
        columnHelper.accessor('status', {
          header: 'Status',
          cell: (info) => (
            <Badge variant={statusVariant[info.getValue()]}>
              {info.getValue().replace('_', ' ')}
            </Badge>
          ),
        }),
        columnHelper.accessor('supplier', {
          header: 'Supplier',
          cell: (info) => info.getValue()?.name ?? '-',
        }),
        columnHelper.display({
          id: 'actions',
          header: 'Actions',
          cell: (info) => (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(`/parts/${info.row.original.id}`)}
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(`/parts/${info.row.original.id}/edit`)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteId(info.row.original.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ),
        }),
      ] as ColumnDef<ProjectPart, unknown>[],
    [columnHelper, navigate],
  );

  const parts = data?.items ?? [];

  return (
    <div>
      <PageHeader title="Parts" description="Browse and manage all inventory parts">
        <Button asChild>
          <Link to="/parts/new">
            <Plus className="mr-2 h-4 w-4" /> New Part
          </Link>
        </Button>
      </PageHeader>
      <DataTable
        columns={columns}
        data={parts}
        searchValue={search}
        onSearch={setSearch}
        loading={isLoading}
        error={error?.message ?? null}
        onRetry={refetch}
      />
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            deletePart.mutate(deleteId, {
              onSuccess: () => setDeleteId(null),
            });
          }
        }}
        title="Delete Part"
        message="Are you sure you want to delete this part? This action cannot be undone."
        confirmText="Delete"
        loading={deletePart.isPending}
      />
    </div>
  );
}
