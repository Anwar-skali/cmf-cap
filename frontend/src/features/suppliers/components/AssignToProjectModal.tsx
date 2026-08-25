import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProjectsQuery } from '@/hooks/queries/useProjectsQuery';
import { assignToProject } from '@/api/endpoints/suppliers';
import { useToast } from '@/hooks/useToast';
import { FolderPlus, Building2, CheckCircle2 } from 'lucide-react';
import type { Supplier } from '@/types';
import { useLanguage } from '@/context/LanguageContext';

interface AssignToProjectModalProps {
  supplier: Supplier | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignToProjectModal({
  supplier,
  open,
  onOpenChange,
}: AssignToProjectModalProps) {
  const { t } = useLanguage();
  const toast = useToast();
  const { data: projectsData, isLoading: isLoadingProjects } = useProjectsQuery();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!supplier) return null;

  const projects = projectsData?.items || [];

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      toast.error('Please select a project to assign.');
      return;
    }

    setIsSubmitting(true);
    try {
      await assignToProject(supplier.id, selectedProjectId);
      const projectName = projects.find((p) => p.id === selectedProjectId)?.name || 'Project';
      toast.success(`Assigned ${supplier.name} to ${projectName} successfully.`);
      onOpenChange(false);
      setSelectedProjectId('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to assign supplier to project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl border-border bg-card shadow-2xl">
        <DialogHeader className="space-y-2 border-b border-border pb-4">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-muted-foreground uppercase">
            <Building2 className="h-4 w-4 text-blue-500" />
            <span>VENDOR: {supplier.code}</span>
          </div>
          <DialogTitle className="text-xl font-black tracking-tight text-foreground">
            {t('suppliers_page.assign_project_title', 'Assign Supplier to Project')}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Link <strong className="text-foreground">{supplier.name}</strong> to a CMF vehicle platform program.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleAssign} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="project-select" className="text-xs font-bold text-foreground">
              {t('suppliers_page.select_project', 'Select Vehicle Platform Project')} *
            </Label>
            <Select
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
            >
              <SelectTrigger id="project-select" className="rounded-xl h-10 text-xs">
                <SelectValue placeholder={isLoadingProjects ? 'Loading projects...' : 'Select a project...'} />
              </SelectTrigger>
              <SelectContent className="max-h-56 rounded-xl">
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    <span className="font-bold">{p.name}</span> ({p.code || 'CMF'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="border-t border-border pt-4 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !selectedProjectId}
              className="rounded-xl text-xs font-bold bg-[#0066CC] hover:bg-[#0052A3] text-white shadow-md shadow-blue-500/20 gap-1.5"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              {isSubmitting ? 'Assigning...' : t('suppliers_page.assign_btn', 'Assign to Program')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
