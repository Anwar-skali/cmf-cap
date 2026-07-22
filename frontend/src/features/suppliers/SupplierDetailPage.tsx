import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Edit, Trash2, ArrowLeft, Mail, Phone, MapPin, Globe } from 'lucide-react';
import { useSupplierQuery } from '@/hooks/queries/useSuppliersQuery';
import { useDeleteSupplierMutation } from '@/hooks/mutations/useSupplierMutations';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ErrorState } from '@/components/ui/error-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { SupplierStatus } from '@/types';

const statusVariant: Record<SupplierStatus, 'success' | 'secondary' | 'destructive'> = {
  active: 'success',
  inactive: 'secondary',
  blacklisted: 'destructive',
};

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showDelete, setShowDelete] = useState(false);

  const { data: supplier, isLoading, error, refetch } = useSupplierQuery(id!);
  const deleteSupplier = useDeleteSupplierMutation();

  if (isLoading) {
    return <LoadingSpinner className="min-h-[300px]" label="Loading supplier..." />;
  }

  if (error || !supplier) {
    return (
      <ErrorState
        title="Supplier not found"
        message={error?.message ?? 'The supplier could not be loaded.'}
        onRetry={refetch}
      />
    );
  }

  return (
    <div>
      <PageHeader title={supplier.name} description={`Code: ${supplier.code}`}>
        <Button variant="outline" onClick={() => navigate('/suppliers')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Suppliers
        </Button>
        <Button variant="outline" onClick={() => navigate(`/suppliers/${id}/edit`)}>
          <Edit className="mr-2 h-4 w-4" />
          Edit
        </Button>
        <Button variant="destructive" onClick={() => setShowDelete(true)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </PageHeader>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{supplier.email}</span>
            </div>
            {supplier.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{supplier.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">Contact:</span>
              <span>{supplier.contactPerson}</span>
            </div>
            {supplier.address && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{supplier.address}</span>
              </div>
            )}
            {supplier.website && (
              <div className="flex items-center gap-2 text-sm">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <a
                  href={supplier.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {supplier.website}
                </a>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status</span>
              <Badge variant={statusVariant[supplier.status]}>{supplier.status}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Code</span>
              <span className="text-sm">{supplier.code}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Created</span>
              <span className="text-sm">{new Date(supplier.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Updated</span>
              <span className="text-sm">{new Date(supplier.updatedAt).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>
      {supplier.notes && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{supplier.notes}</p>
          </CardContent>
        </Card>
      )}
      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        onConfirm={() => {
          deleteSupplier.mutate(id!, {
            onSuccess: () => navigate('/suppliers'),
          });
        }}
        title="Delete Supplier"
        message={`Are you sure you want to delete "${supplier.name}"? This action cannot be undone.`}
        confirmText="Delete"
        loading={deleteSupplier.isPending}
      />
    </div>
  );
}
