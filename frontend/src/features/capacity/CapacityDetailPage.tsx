import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useCapacityAssessmentQuery } from '@/hooks/queries/useCapacityQuery';
import { useDeleteCapacityMutation } from '@/hooks/mutations/useCapacityMutations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Trash2, BarChart3, Calendar, User, Target, Gauge, Clock } from 'lucide-react';
import { getStatusVariant } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';

export default function CapacityDetailPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const navigate = useNavigate();
  const [showDelete, setShowDelete] = useState(false);
  const deleteMutation = useDeleteCapacityMutation();

  const { data: assessment, isLoading, error, refetch } = useCapacityAssessmentQuery(assessmentId!);

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-32 w-full" /></div>;
  if (error) return <ErrorState title="Failed to load assessment" message={error?.message} onRetry={refetch} />;
  if (!assessment) return <EmptyState title="Assessment not found" description="The capacity assessment you are looking for does not exist." />;

  const handleDelete = () => {
    deleteMutation.mutate(assessmentId!, { onSuccess: () => navigate('/capacity') });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/capacity"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{assessment.bottleneck || 'Capacity Assessment'}</h1>
              <Badge variant={getStatusVariant(assessment.status)}>{assessment.status}</Badge>
            </div>
            <p className="text-muted-foreground">{assessment.notes || 'No description'}</p>
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={() => setShowDelete(true)} disabled={deleteMutation.isPending}>
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Capacity</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assessment.currentCapacity?.toLocaleString() ?? '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Maximum Capacity</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assessment.maximumCapacity?.toLocaleString() ?? '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilization</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assessment.utilizationRate != null ? `${assessment.utilizationRate}%` : '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lead Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assessment.leadTimeDays != null ? `${assessment.leadTimeDays}d` : '-'}</div>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        onConfirm={handleDelete}
        title="Delete Assessment"
        message="Are you sure you want to delete this capacity assessment? This action cannot be undone."
        confirmText="Delete"
        loading={deleteMutation.isPending}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Period</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">{assessment.month}/{assessment.year}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assessed By</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">{assessment.assessedBy || '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assessment Date</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">{assessment.assessmentDate ? new Date(assessment.assessmentDate).toLocaleDateString() : '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bottleneck</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">{assessment.bottleneck || '-'}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
