import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useProjectQuery } from '@/hooks/queries/useProjectsQuery';
import { useDeleteProjectMutation } from '@/hooks/mutations/useProjectMutations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Edit, Trash2, Building2, Calendar, FileText, AlertTriangle, Puzzle, Users } from 'lucide-react';
import { getStatusVariant } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [showDelete, setShowDelete] = useState(false);
  const deleteMutation = useDeleteProjectMutation();

  const { data: project, isLoading, error, refetch } = useProjectQuery(projectId!);

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-32 w-full" /></div>;
  if (error) return <ErrorState title="Failed to load project" message={error?.message} onRetry={refetch} />;
  if (!project) return <EmptyState title="Project not found" description="The project you are looking for does not exist." />;

  const handleDelete = () => {
    deleteMutation.mutate(projectId!, { onSuccess: () => navigate('/projects') });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/projects"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
              <Badge variant={getStatusVariant(project.status)}>{project.status}</Badge>
            </div>
            <p className="text-muted-foreground">{project.description || 'No description'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/projects/${project.id}/edit`}><Edit className="mr-2 h-4 w-4" /> Edit</Link>
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setShowDelete(true)} disabled={deleteMutation.isPending}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Start Date</CardTitle><Calendar className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{project.startDate ? new Date(project.startDate).toLocaleDateString() : '-'}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">End Date</CardTitle><Calendar className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{project.endDate ? new Date(project.endDate).toLocaleDateString() : '-'}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Parts</CardTitle><Puzzle className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{project.partsCount ?? 0}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="parts">
        <TabsList>
          <TabsTrigger value="parts"><Puzzle className="mr-2 h-4 w-4" /> Parts</TabsTrigger>
          <TabsTrigger value="risks"><AlertTriangle className="mr-2 h-4 w-4" /> Risks</TabsTrigger>
          <TabsTrigger value="documents"><FileText className="mr-2 h-4 w-4" /> Documents</TabsTrigger>
        </TabsList>
        <TabsContent value="parts">
          <Card><CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">Project parts management</p>
            <Button asChild><Link to={`/projects/${project.id}/parts`}>Manage Parts</Link></Button>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="risks">
          <Card><CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">Project risks management</p>
            <Button asChild><Link to={`/projects/${project.id}/risks`}>Manage Risks</Link></Button>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="documents">
          <Card><CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">Project documents</p>
            <Button asChild><Link to={`/projects/${project.id}/documents`}>View Documents</Link></Button>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        onConfirm={handleDelete}
        title="Delete Project"
        message={`Are you sure you want to delete "${project.name}"? This action cannot be undone.`}
        confirmText="Delete"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
