import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useRiskQuery } from '@/hooks/queries/useRisksQuery';
import { useDeleteRiskMutation } from '@/hooks/mutations/useRiskMutations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Edit, Trash2, AlertTriangle, Calendar, User, Building2 } from 'lucide-react';
import { getRiskLevelVariant, getStatusVariant } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';

export default function RiskDetailPage() {
  const { riskId } = useParams<{ riskId: string }>();
  const navigate = useNavigate();
  const [showDelete, setShowDelete] = useState(false);
  const deleteMutation = useDeleteRiskMutation();

  const { data: risk, isLoading, error, refetch } = useRiskQuery(riskId!);

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-32 w-full" /></div>;
  if (error) return <ErrorState title="Failed to load risk" message={error?.message} onRetry={refetch} />;
  if (!risk) return <EmptyState title="Risk not found" description="The risk you are looking for does not exist." />;

  const handleDelete = () => {
    deleteMutation.mutate(riskId!, { onSuccess: () => navigate('/risks') });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/risks"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{risk.title}</h1>
              <Badge variant={getRiskLevelVariant(risk.severity)}>{risk.severity}</Badge>
              <Badge variant={getStatusVariant(risk.status)}>{risk.status}</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="destructive" size="sm" onClick={() => setShowDelete(true)} disabled={deleteMutation.isPending}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Description</CardTitle></CardHeader>
        <CardContent><p>{risk.description || 'No description provided'}</p></CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Project</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">{risk.projectName || '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned To</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">{risk.assignedTo || 'Unassigned'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Identified Date</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">{risk.dueDate ? new Date(risk.dueDate).toLocaleDateString() : '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Probability</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">{risk.probability ? `${risk.probability}%` : '-'}</div>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        onConfirm={handleDelete}
        title="Delete Risk"
        message={`Are you sure you want to delete "${risk.title}"? This action cannot be undone.`}
        confirmText="Delete"
        loading={deleteMutation.isPending}
      />

      {risk.mitigation && (
        <Card>
          <CardHeader><CardTitle>Mitigation Plan</CardTitle></CardHeader>
          <CardContent><p>{risk.mitigation}</p></CardContent>
        </Card>
      )}
    </div>
  );
}
