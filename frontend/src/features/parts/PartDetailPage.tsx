import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  Trash2,
  ArrowLeft,
  Pencil,
  Building2,
  Calendar,
  Layers,
  Briefcase,
  Hash,
  Tag,
  Boxes,
  FileText,
  Save,
  X,
  Edit,
  Sparkles,
} from 'lucide-react';
import { usePartQuery } from '@/hooks/queries/usePartsQuery';
import { useDeletePartMutation, useUpdatePartMutation } from '@/hooks/mutations/usePartMutations';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ErrorState } from '@/components/ui/error-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
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
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');

  const { data: part, isLoading, error, refetch } = usePartQuery(id!);
  const deletePart = useDeletePartMutation();
  const updatePartMutation = useUpdatePartMutation();

  useEffect(() => {
    if (part) {
      setNotesValue(part.notes || '');
      setIsEditingNotes(false);
    }
  }, [part]);

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

  const coforCode = part.manufacturingCofor || part.supplier?.code || '-';
  const commodityName = part.material || 'Direct Material';
  const useCaseText = part.useCase || 'Series Production';

  const handleSaveNotes = () => {
    updatePartMutation.mutate(
      {
        id: part.id,
        data: { notes: notesValue },
      },
      {
        onSuccess: () => {
          setIsEditingNotes(false);
          toast.success('Procurement notes updated successfully');
        },
        onError: (err) => {
          toast.error(err.message || 'Failed to update notes');
        },
      }
    );
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-fade-in">
      <PageHeader title={part.name} description={`Part Number: ${part.partNumber}`}>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/parts')}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to Parts
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/parts/${id}/edit`}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setShowDelete(true)}>
            <Trash2 className="mr-1.5 h-4 w-4" />
            Delete
          </Button>
        </div>
      </PageHeader>

      {/* 4 Overview Metric Cards: Part Number, Commodity, Use Case, COFOR Supplier */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-4 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Hash className="h-3 w-3 text-blue-500" /> Part Number
            </span>
            <p className="text-sm font-mono font-black text-foreground truncate" title={part.partNumber}>
              {part.partNumber}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-4 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Layers className="h-3 w-3 text-indigo-500" /> Commodity
            </span>
            <p className="text-sm font-extrabold text-foreground truncate" title={commodityName}>
              {commodityName}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-4 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Briefcase className="h-3 w-3 text-amber-500" /> Use Case
            </span>
            <p className="text-sm font-extrabold text-foreground truncate" title={useCaseText}>
              {useCaseText}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-4 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Building2 className="h-3 w-3 text-emerald-500" /> COFOR Supplier
            </span>
            <p className="text-sm font-mono font-extrabold text-emerald-600 dark:text-emerald-400 truncate" title={coforCode}>
              {coforCode}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Boxes className="h-4 w-4 text-primary" /> Technical & BOM Specifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3.5">
            <div className="flex items-center justify-between py-1 border-b border-border/50 text-sm">
              <span className="text-muted-foreground">Part Name</span>
              <span className="font-semibold text-foreground">{part.name}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50 text-sm">
              <span className="text-muted-foreground">Part Number</span>
              <span className="font-mono font-bold text-foreground">{part.partNumber}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50 text-sm">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={statusVariant[part.status]} className="capitalize text-xs font-semibold">
                {part.status.replace('_', ' ')}
              </Badge>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50 text-sm">
              <span className="text-muted-foreground">Program Quantity</span>
              <span className="font-bold text-foreground">{part.quantity?.toLocaleString()} {part.unit || 'pcs'}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50 text-sm">
              <span className="text-muted-foreground">Commodity</span>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">{commodityName}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50 text-sm">
              <span className="text-muted-foreground">Use Case</span>
              <span className="font-semibold text-foreground">{useCaseText}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Supplier & Sourcing Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3.5">
            <div className="flex items-center justify-between py-1 border-b border-border/50 text-sm">
              <span className="text-muted-foreground">Supplier Name</span>
              <span className="font-semibold text-foreground">{part.supplier?.name ?? 'Unassigned'}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50 text-sm">
              <span className="text-muted-foreground">COFOR Supplier</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                {coforCode}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50 text-sm">
              <span className="text-muted-foreground">Supplier Code</span>
              <span className="font-mono text-foreground">{part.supplier?.code || coforCode}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50 text-sm">
              <span className="text-muted-foreground">Created Date</span>
              <span className="text-foreground">{new Date(part.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center justify-between py-1 text-sm">
              <span className="text-muted-foreground">Last Updated</span>
              <span className="text-foreground">{new Date(part.updatedAt).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {part.description && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-500" /> Description
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{part.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Editable Procurement / Engineering Notes Card */}
      <Card className="border-amber-500/30 bg-amber-500/5 shadow-sm">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-amber-700 dark:text-amber-400 flex items-center gap-2">
            <Tag className="h-4 w-4" /> Procurement / Engineering Notes
          </CardTitle>
          {!isEditingNotes && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditingNotes(true)}
              className="h-7 px-2.5 text-xs font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 rounded-lg gap-1 cursor-pointer"
            >
              <Edit className="h-3 w-3" /> Edit Notes
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isEditingNotes ? (
            <div className="space-y-3 pt-1">
              <Textarea
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                placeholder="Enter procurement, sourcing, tooling, or engineering notes..."
                className="min-h-[120px] text-xs bg-card border-amber-500/40 focus-visible:ring-amber-500"
                rows={5}
                autoFocus
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNotesValue(part.notes || '');
                    setIsEditingNotes(false);
                  }}
                  disabled={updatePartMutation.isPending}
                  className="h-7 px-3 text-xs rounded-lg gap-1"
                >
                  <X className="h-3 w-3" /> Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveNotes}
                  disabled={updatePartMutation.isPending}
                  className="h-7 px-3 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-lg gap-1.5 shadow-sm"
                >
                  <Save className="h-3 w-3" />
                  {updatePartMutation.isPending ? 'Saving...' : 'Save Notes'}
                </Button>
              </div>
            </div>
          ) : part.notes ? (
            <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{part.notes}</p>
          ) : (
            <div className="py-3 text-center space-y-2">
              <p className="text-xs text-muted-foreground italic">No procurement or engineering notes entered yet.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditingNotes(true)}
                className="h-7 text-xs border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 gap-1.5"
              >
                <Sparkles className="h-3 w-3" /> Add Procurement Notes
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

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
