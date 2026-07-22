import { useState } from 'react';
import { useDocumentsQuery } from '@/hooks/queries/useDocumentsQuery';
import { useDeleteDocumentMutation } from '@/hooks/mutations/useDocumentMutations';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { Search, FileText, Download, Trash2, Upload, Filter } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { Document } from '@/types';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export default function DocumentsPage() {
  const [search, setSearch] = useState('');
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const { data: documents, isLoading, error, refetch } = useDocumentsQuery();
  const deleteMutation = useDeleteDocumentMutation();

  const filtered = documents?.items?.filter(
    (d) => d.title?.toLowerCase().includes(search.toLowerCase()) || d.description?.toLowerCase().includes(search.toLowerCase()),
  );

  const columns: ColumnDef<Document>[] = [
    {
      accessorKey: 'title',
      header: 'Name',
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <span className="font-medium">{row.original.title}</span>
        </div>
      ),
    },
    {
      accessorKey: 'documentType',
      header: 'Type',
      cell: ({ row }) => <Badge variant="outline">{row.original.documentType}</Badge>,
    },
    {
      accessorKey: 'projectId',
      header: 'Project ID',
      cell: ({ row }) => row.original.projectId || '-',
    },
    {
      accessorKey: 'uploadedBy',
      header: 'Uploaded By',
      cell: ({ row }) => row.original.uploadedBy || '-',
    },
    {
      accessorKey: 'createdAt',
      header: 'Uploaded',
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => window.open(row.original.filePath, '_blank')}>
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDeleteDocId(row.original.id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Documents" description="Manage uploaded documents">
        <Button asChild>
          <a href="#"><Upload className="mr-2 h-4 w-4" /> Upload Document</a>
        </Button>
      </PageHeader>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search documents..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button variant="outline" size="sm" className="gap-2"><Filter className="h-4 w-4" /> Filters</Button>
      </div>

      <DataTable columns={columns} data={filtered ?? []} loading={isLoading} error={error?.message ?? null} onRetry={refetch} />

      <ConfirmDialog
        open={!!deleteDocId}
        onOpenChange={(open) => { if (!open) setDeleteDocId(null); }}
        onConfirm={() => { if (deleteDocId) deleteMutation.mutate(deleteDocId); setDeleteDocId(null); }}
        title="Delete Document"
        message="Are you sure you want to delete this document? This action cannot be undone."
        confirmText="Delete"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
