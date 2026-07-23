import { useState, useRef } from 'react';
import { useDocumentsQuery } from '@/hooks/queries/useDocumentsQuery';
import { useDeleteDocumentMutation, useUploadDocumentMutation } from '@/hooks/mutations/useDocumentMutations';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, FileText, Download, Trash2, Upload, Filter, FileSpreadsheet, History, Layers } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { Document } from '@/types';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ImportWizard } from '@/features/import/ImportWizard';
import { ImportHistoryTable } from '@/features/import/ImportHistoryTable';
import { downloadDocument } from '@/api/endpoints/importApi';
import { useToast } from '@/hooks/useToast';

export default function DocumentsPage() {
  const [search, setSearch] = useState('');
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const { data: documents, isLoading, error, refetch } = useDocumentsQuery();
  const deleteMutation = useDeleteDocumentMutation();
  const uploadMutation = useUploadDocumentMutation();

  const handleDownloadDocument = async (doc: Document) => {
    try {
      await downloadDocument(doc.id, doc.fileName || doc.title || 'document');
    } catch (err: any) {
      toast.error('Failed to download document');
    }
  };

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
          <Button variant="ghost" size="sm" onClick={() => handleDownloadDocument(row.original)}>
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
      <PageHeader
        title="Enterprise Import & Document Center"
        description="Bulk Excel Data Ingestion Engine & Business Document Management"
      >
        <Button onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending} variant="outline">
          <Upload className="mr-2 h-4 w-4" /> {uploadMutation.isPending ? 'Uploading...' : 'Upload Attachment'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              uploadMutation.mutate({ file, name: file.name, type: 'other' });
              e.target.value = '';
            }
          }}
        />
      </PageHeader>

      <Tabs defaultValue="excel-import" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-xl h-11">
          <TabsTrigger value="excel-import" className="gap-2 font-bold">
            <FileSpreadsheet className="h-4 w-4 text-primary" /> Excel Import Wizard
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2 font-medium">
            <Layers className="h-4 w-4" /> Document Files
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 font-medium">
            <History className="h-4 w-4" /> Import Audit History
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Enterprise Excel Import Wizard */}
        <TabsContent value="excel-import" className="space-y-6">
          <ImportWizard defaultEntity="projects" />
        </TabsContent>

        {/* Tab 2: Standard Documents Table */}
        <TabsContent value="documents" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search documents..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Button variant="outline" size="sm" className="gap-2"><Filter className="h-4 w-4" /> Filters</Button>
          </div>

          <DataTable columns={columns} data={filtered ?? []} loading={isLoading} error={error?.message ?? null} onRetry={refetch} />
        </TabsContent>

        {/* Tab 3: Import Audit Trail */}
        <TabsContent value="history" className="space-y-6">
          <ImportHistoryTable />
        </TabsContent>
      </Tabs>

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
