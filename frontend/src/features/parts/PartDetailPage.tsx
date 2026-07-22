import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Trash2, ArrowLeft, Package } from 'lucide-react';
import { usePartQuery } from '@/hooks/queries/usePartsQuery';
import { useDeletePartMutation } from '@/hooks/mutations/usePartMutations';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ErrorState } from '@/components/ui/error-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { PartStatus } from '@/types';

const statusVariant: Record<PartStatus, 'warning' | 'success' | 'default' | 'destructive' | 'secondary'> = {
  active: 'success',
  inactive: 'secondary',
  obsolete: 'destructive',
};

export default function PartDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showDelete, setShowDelete] = useState(false);

  const { data: part, isLoading, error, refetch } = usePartQuery(id!);
  const deletePart = useDeletePartMutation();

  if (isLoading) {
    return <LoadingSpinner className="min-h-[300px]" label="Loading part..." />;
  }

  if (error || !part) {
    return (
      <ErrorState
        title="Part not found"
        message={error?.message ?? 'The part could not be loaded.'}
        onRetry={refetch}
      />
    );
  }

  return (
    <div>
      <PageHeader title={part.name} description={`Part Number: ${part.partNumber}`}>
        <Button variant="outline" onClick={() => navigate('/parts')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Parts
        </Button>
        <Button variant="destructive" onClick={() => setShowDelete(true)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </PageHeader>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Part Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Name</span>
              <span className="text-sm">{part.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Part Number</span>
              <span className="text-sm">{part.partNumber}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status</span>
              <Badge variant={statusVariant[part.status]}>
                {part.status.replace('_', ' ')}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Quantity</span>
              <span className="text-sm">{part.quantity} {part.unit}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Material</span>
              <span className="text-sm">{part.material ?? '-'}</span>
            </div>
            {part.weight !== undefined && part.weight !== null && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Weight</span>
                <span className="text-sm">{part.weight}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Supplier</span>
              <span className="text-sm">{part.supplier?.name ?? '-'}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Additional Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Created</span>
              <span className="text-sm">{new Date(part.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Updated</span>
              <span className="text-sm">{new Date(part.updatedAt).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>
      {part.description && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{part.description}</p>
          </CardContent>
        </Card>
      )}
      {part.notes && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{part.notes}</p>
          </CardContent>
        </Card>
      )}
      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        onConfirm={() => {
          deletePart.mutate(id!, {
            onSuccess: () => navigate('/parts'),
          });
        }}
        title="Delete Part"
        message={`Are you sure you want to delete "${part.name}"? This action cannot be undone.`}
        confirmText="Delete"
        loading={deletePart.isPending}
      />
    </div>
  );
}
