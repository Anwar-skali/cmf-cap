import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useProjectQuery } from '@/hooks/queries/useProjectsQuery';
import { useDeleteProjectMutation, useUpdateProjectMutation } from '@/hooks/mutations/useProjectMutations';
import { useTemplate } from '@/context/TemplateContext';
import { DynamicForm } from '@/components/template-engine/DynamicForm';
import { K9ProjectView } from '@/components/projects/K9ProjectView';
import { ProjectMasterTableView } from '@/components/projects/ProjectMasterTableView';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Edit, Trash2, FileText, AlertTriangle, Puzzle, Layers } from 'lucide-react';
import { getStatusVariant } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [showDelete, setShowDelete] = useState(false);
  const { templates, activeTemplate } = useTemplate();
  const deleteMutation = useDeleteProjectMutation();
  const updateMutation = useUpdateProjectMutation();

  const { data: project, isLoading, error, refetch } = useProjectQuery(projectId!);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (error) return <ErrorState title="Failed to load project" message={error?.message} onRetry={refetch} />;
  if (!project) return <EmptyState title="Project not found" description="The project you are looking for does not exist." />;

  const currentTemplate =
    templates.find((t) => t.id === project.templateId) ||
    activeTemplate ||
    templates[0];

  const templateCode = currentTemplate?.code?.toUpperCase();
  const isCMFTemplate = templateCode === 'K9' || templateCode === 'K0';

  const initialValues = {
    project_name: project.name,
    project_code: project.code,
    status: project.status,
    ...(project.data || {}),
  };

  const handleDelete = () => {
    deleteMutation.mutate(projectId!, { onSuccess: () => navigate('/projects') });
  };

  const handleSaveK9 = async (sectionValues: Record<string, any>) => {
    const name =
      sectionValues.part_name ||
      sectionValues.project_name ||
      project.data?.part_name ||
      project.name;
    updateMutation.mutate(
      { id: projectId!, data: { name, data: sectionValues } as any },
      {
        onSuccess: () => {
          toast.success(`CMF ${templateCode} Project section saved successfully!`);
          refetch();
        },
        onError: (err: any) => {
          toast.error(err?.message || `Failed to save CMF ${templateCode} project section`);
        },
      }
    );
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/projects">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
              <Badge variant={getStatusVariant(project.status)}>{project.status}</Badge>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                <Layers className="h-3 w-3" /> Template {currentTemplate?.code} v{currentTemplate?.version}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">CMF Code: {project.code}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/projects/${project.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" /> Edit Project
            </Link>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDelete(true)}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details" className="space-y-4">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="details">
            <Layers className="mr-2 h-4 w-4" /> {isCMFTemplate ? `CMF ${templateCode} Module View` : 'Dynamic Form Details'}
          </TabsTrigger>
          <TabsTrigger value="parts">
            <Puzzle className="mr-2 h-4 w-4" /> Parts ({project.partsCount || 0})
          </TabsTrigger>
          <TabsTrigger value="risks">
            <AlertTriangle className="mr-2 h-4 w-4" /> Risks
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="mr-2 h-4 w-4" /> Documents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          {isCMFTemplate ? (
            <K9ProjectView
              project={project}
              template={currentTemplate}
              templateCode={templateCode}
              onSave={handleSaveK9}
              isSaving={updateMutation.isPending}
            />
          ) : (
            <ProjectMasterTableView
              project={project}
              template={currentTemplate}
              templateCode={templateCode}
              onSave={handleSaveK9}
              isSaving={updateMutation.isPending}
            />
          )}
        </TabsContent>

        <TabsContent value="parts">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <p className="text-sm text-muted-foreground">Manage specific part components associated with this vehicle line project.</p>
            <Button asChild>
              <Link to={`/projects/${project.id}/parts`}>Open Parts Manager</Link>
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="risks">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <p className="text-sm text-muted-foreground">Manage risk items and mitigation plans for this project.</p>
            <Button asChild>
              <Link to={`/projects/${project.id}/risks`}>Open Risk Register</Link>
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <p className="text-sm text-muted-foreground">Upload and inspect technical specifications and CAD drawings.</p>
            <Button asChild>
              <Link to={`/projects/${project.id}/documents`}>Open Document Repository</Link>
            </Button>
          </div>
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
