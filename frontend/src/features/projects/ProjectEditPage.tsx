import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useProjectQuery } from '@/hooks/queries/useProjectsQuery';
import { useUpdateProjectMutation } from '@/hooks/mutations/useProjectMutations';
import { useTemplate } from '@/context/TemplateContext';
import { DynamicForm } from '@/components/template-engine/DynamicForm';
import { K9ProjectView } from '@/components/projects/K9ProjectView';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';

import { useAuthStore } from '@/stores/authStore';
import { Badge } from '@/components/ui/badge';
import { Lock, UserCheck, ShieldAlert } from 'lucide-react';

export default function ProjectEditPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { templates, activeTemplate } = useTemplate();
  const updateMutation = useUpdateProjectMutation();
  const { data: project, isLoading, error, refetch } = useProjectQuery(projectId!);
  const { state: authState } = useAuthStore();

  const currentUser = authState.user;
  const userRole = (currentUser?.role || 'buyer').toLowerCase();
  const isAdmin = userRole === 'admin';

  const roleTitle =
    userRole === 'capacity_manager'
      ? 'Step 2: Capacity Manager'
      : userRole === 'sqd'
      ? 'Step 3: SQD Team'
      : userRole === 'admin'
      ? 'Administrator (Full Access)'
      : 'Step 1: Buyer Baseline';

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (error) return <ErrorState title="Failed to load project" message={error?.message} onRetry={refetch} />;
  if (!project) return <EmptyState title="Project not found" description="The project you are trying to edit does not exist." />;

  // Find template bound to project or active template
  const currentTemplate =
    templates.find((t) => t.id === project.templateId) ||
    activeTemplate ||
    templates[0];

  const templateCode = currentTemplate?.code?.toUpperCase();
  const isCMFTemplate = templateCode === 'K9' || templateCode === 'K0';

  // Merge base properties into dynamic data
  const initialValues = {
    project_name: project.name,
    project_code: project.code,
    status: project.status,
    ...(project.data || {}),
  };

  const handleSave = async (sectionValues: Record<string, any>) => {
    try {
      // Merge existing project.data with incoming section values so that
      // saving as Capacity Manager does NOT erase the Buyer or SQD fields.
      const mergedData = {
        ...(project.data || {}),
        ...sectionValues,
      };
      const name =
        mergedData.part_name || mergedData.project_name || mergedData.name || project.name;

      const payload = {
        name,
        data: mergedData,
      };

      updateMutation.mutate(
        { id: projectId!, data: payload as any },
        {
          onSuccess: () => {
            toast.success('Project section updated successfully!');
            refetch();
          },
          onError: (err: any) => {
            toast.error(err?.message || 'Failed to update project');
          },
        }
      );
    } catch (err: any) {
      toast.error('Error saving project');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/projects/${projectId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">Edit Project: {project.name}</h1>
              <Badge variant="outline" className="border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5" /> Logged in: {roleTitle}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Code {project.code} • Template {currentTemplate.code} v{currentTemplate.version}
            </p>
          </div>
        </div>
      </div>

      {/* Role Access Restriction Banner */}
      {!isAdmin && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold">
          <ShieldAlert className="h-5 w-5 shrink-0 text-blue-500" />
          <div>
            <p className="font-extrabold text-xs text-foreground">Role-Based Section Access</p>
            <p className="opacity-90 mt-0.5">
              You are logged in as <strong>{userRole.replace('_', ' ')}</strong>. You have edit permissions for <strong>{roleTitle}</strong> fields. Sections for other roles are locked and set to read-only.
            </p>
          </div>
        </div>
      )}

      {/* Dynamic Form Engine or CMF Role Module View (K9 / K0) */}
      {isCMFTemplate ? (
        <K9ProjectView
          project={project}
          template={currentTemplate}
          templateCode={templateCode}
          onSave={handleSave}
          isSaving={updateMutation.isPending}
          initialMode="role_forms"
        />
      ) : (
        <DynamicForm
          template={currentTemplate}
          initialValues={initialValues}
          onSave={handleSave}
          isSaving={updateMutation.isPending}
          title={`Edit Project - ${project.name}`}
        />
      )}
    </div>
  );
}
