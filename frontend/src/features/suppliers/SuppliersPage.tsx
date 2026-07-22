import { useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { Edit, Eye, Plus, Trash2 } from 'lucide-react';
import { useSuppliersQuery } from '@/hooks/queries/useSuppliersQuery';
import { useDeleteSupplierMutation } from '@/hooks/mutations/useSupplierMutations';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { Supplier, SupplierStatus } from '@/types';

const statusVariant: Record<SupplierStatus, 'success' | 'secondary' | 'destructive'> = {
  active: 'success',
  inactive: 'secondary',
  blacklisted: 'destructive',
};

export default function SuppliersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useSuppliersQuery(
    search ? { search } : undefined,
  );
  const deleteSupplier = useDeleteSupplierMutation();

  const columnHelper = createColumnHelper<Supplier>();

  const columns = useMemo(
    () =>
      [
        columnHelper.accessor('name', {
          header: 'Name',
          cell: (info) => (
            <button
              className="font-medium text-primary hover:underline"
              onClick={() => navigate(`/suppliers/${info.row.original.id}`)}
            >
              {info.getValue()}
            </button>
          ),
        }),
        columnHelper.accessor('code', {
          header: 'Code',
        }),
        columnHelper.accessor('contactPerson', {
          header: 'Contact Person',
        }),
        columnHelper.accessor('email', {
          header: 'Email',
        }),
        columnHelper.accessor('phone', {
          header: 'Phone',
        }),
        columnHelper.accessor('status', {
          header: 'Status',
          cell: (info) => (
            <Badge variant={statusVariant[info.getValue()]}>
              {info.getValue()}
            </Badge>
          ),
        }),
        columnHelper.display({
          id: 'actions',
          header: 'Actions',
          cell: (info) => (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(`/suppliers/${info.row.original.id}`)}
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(`/suppliers/${info.row.original.id}/edit`)}
              >
                <Edit className="h-4 w-4" />
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
      ] as ColumnDef<Supplier, unknown>[],
    [columnHelper, navigate],
  );

  const suppliers = data?.items ?? [];

  return (
    <div>
      <PageHeader title="Suppliers" description="Manage your suppliers">
        <Button onClick={() => navigate('/suppliers/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Supplier
        </Button>
      </PageHeader>
      <DataTable
        columns={columns}
        data={suppliers}
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
            deleteSupplier.mutate(deleteId, {
              onSuccess: () => setDeleteId(null),
            });
          }
        }}
        title="Delete Supplier"
        message="Are you sure you want to delete this supplier? This action cannot be undone."
        confirmText="Delete"
        loading={deleteSupplier.isPending}
      />
    </div>
  );
}
