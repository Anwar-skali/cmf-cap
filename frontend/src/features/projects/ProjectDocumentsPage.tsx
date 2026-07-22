import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProjectQuery } from '@/hooks/queries/useProjectsQuery';
import { useDocumentsQuery } from '@/hooks/queries/useDocumentsQuery';
import { useDeleteDocumentMutation } from '@/hooks/mutations/useDocumentMutations';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Search, FileText, Download, Trash2 } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { Document } from '@/types';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ErrorState } from '@/components/ui/error-state';

export default function ProjectDocumentsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [search, setSearch] = useState('');
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const deleteMutation = useDeleteDocumentMutation();

  const { data: project, error: projectError } = useProjectQuery(projectId!);
  const { data: allDocuments, isLoading, error: docsError, refetch: refetchDocs } = useDocumentsQuery();

  const documents = allDocuments?.items?.filter((d) => d.projectId === projectId) ?? [];
  const filtered = documents.filter(
    (d) => d.title?.toLowerCase().includes(search.toLowerCase()),
  );

  const columns: ColumnDef<Document>[] = [
    {
      accessorKey: 'title',
      header: 'Name',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          {row.original.title}
        </div>
      ),
    },
    {
      accessorKey: 'documentType',
      header: 'Type',
      cell: ({ row }) => <Badge variant="outline">{row.original.documentType}</Badge>,
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

  if (projectError) return <ErrorState title="Failed to load project" message={projectError?.message} onRetry={refetchDocs} />;
  if (!project) return <Skeleton className="h-8 w-64" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/projects/${projectId}`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{project.name} - Documents</h1>
          <p className="text-muted-foreground">View documents for this project</p>
        </div>
      </div>
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search documents..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>
      <DataTable columns={columns} data={filtered ?? []} loading={isLoading} error={docsError?.message ?? null} onRetry={refetchDocs} />

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
