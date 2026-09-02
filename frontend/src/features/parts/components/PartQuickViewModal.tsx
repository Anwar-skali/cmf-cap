import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Boxes,
  Building2,
  Calendar,
  Layers,
  Edit,
  ExternalLink,
  Copy,
  Check,
  Tag,
  FileText,
  Save,
  X,
  Hash,
  Briefcase,
  Sparkles,
} from 'lucide-react';
import type { ProjectPart } from '@/types';
import {
  getPartInitials,
  getPartAvatarStyle,
  getPartStatusVariant,
  formatPartStatus,
  getMaterialStyle,
} from '../utils/partUtils';
import { useUpdatePartMutation } from '@/hooks/mutations/usePartMutations';
import { toast } from 'sonner';

interface PartQuickViewModalProps {
  part: ProjectPart | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeletePart?: (part: ProjectPart) => void;
}

export function PartQuickViewModal({
  part,
  open,
  onOpenChange,
  onDeletePart,
}: PartQuickViewModalProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');

  const updatePartMutation = useUpdatePartMutation();

  useEffect(() => {
    if (part) {
      setNotesValue(part.notes || '');
      setIsEditingNotes(false);
    }
  }, [part, open]);

  if (!part) return null;

  const initials = getPartInitials(part.name);
  const avatarStyle = getPartAvatarStyle(part.name);
  const materialStyle = getMaterialStyle(part.material);

  const handleCopyPartNumber = () => {
    if (part.partNumber) {
      navigator.clipboard.writeText(part.partNumber);
      setCopied(true);
      toast.success('Part number copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

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

  const coforCode = part.manufacturingCofor || part.supplier?.code || '-';
  const commodityName = part.material || 'Direct Material';
  const useCaseText = part.useCase || 'Series Production';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border-border bg-card shadow-2xl">
        <DialogHeader className="space-y-4 border-b border-border pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border font-black text-sm tracking-wider shadow-xs ${avatarStyle.bg} ${avatarStyle.text} ${avatarStyle.border}`}
              >
                {initials}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-bold text-muted-foreground uppercase flex items-center gap-1.5 bg-muted/60 px-2 py-0.5 rounded-md">
                    PN: {part.partNumber}
                    <button
                      onClick={handleCopyPartNumber}
                      className="hover:text-foreground text-muted-foreground transition-colors p-0.5 cursor-pointer"
                      title="Copy part number"
                    >
                      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </span>
                  <Badge
                    variant={getPartStatusVariant(part.status)}
                    className="text-[10px] font-bold px-2 py-0.5 capitalize"
                  >
                    {formatPartStatus(part.status)}
                  </Badge>
                </div>
                <DialogTitle className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                  {part.name}
                </DialogTitle>
              </div>
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            BOM Component and technical specifications overview.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Key Metrics Grid: Part Number, Commodity, Use Case, COFOR Supplier */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* 1. Part Number */}
            <div className="rounded-2xl border border-border bg-muted/30 p-3 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Hash className="h-3 w-3 text-blue-500" /> Part Number
              </span>
              <p className="text-xs font-mono font-black text-foreground truncate" title={part.partNumber}>
                {part.partNumber}
              </p>
            </div>

            {/* 2. Commodity */}
            <div className="rounded-2xl border border-border bg-muted/30 p-3 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Layers className="h-3 w-3 text-indigo-500" /> Commodity
              </span>
              <div className="pt-0.5">
                <span className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-lg border truncate max-w-full ${materialStyle.bg} ${materialStyle.text} ${materialStyle.border}`} title={commodityName}>
                  {commodityName}
                </span>
              </div>
            </div>

            {/* 3. Use Case */}
            <div className="rounded-2xl border border-border bg-muted/30 p-3 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Briefcase className="h-3 w-3 text-amber-500" /> Use Case
              </span>
              <p className="text-xs font-extrabold text-foreground truncate" title={useCaseText}>
                {useCaseText}
              </p>
            </div>

            {/* 4. COFOR Supplier */}
            <div className="rounded-2xl border border-border bg-muted/30 p-3 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3 text-emerald-500" /> COFOR Supplier
              </span>
              <p className="text-xs font-mono font-extrabold text-foreground truncate" title={coforCode}>
                {coforCode}
              </p>
            </div>
          </div>

          {/* Quantity & Unit info pill */}
          <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-muted/20 border border-border text-xs">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Boxes className="h-3.5 w-3.5 text-blue-500" /> Program Quantity:
            </span>
            <span className="font-extrabold text-foreground">
              {part.quantity?.toLocaleString()} {part.unit || 'pcs'}
            </span>
          </div>

          {/* Supplier Details Card */}
          {part.supplier && (
            <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-blue-500" /> Assigned Supplier & COFOR
                </span>
                <Link
                  to={`/suppliers/${part.supplier.id}`}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                >
                  View Supplier <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                <div>
                  <span className="text-muted-foreground">Supplier Name: </span>
                  <span className="font-semibold text-foreground">{part.supplier.name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">COFOR / Code: </span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    {coforCode}
                  </span>
                </div>
                {part.supplier.contactPerson && (
                  <div>
                    <span className="text-muted-foreground">Contact: </span>
                    <span className="font-semibold text-foreground">{part.supplier.contactPerson}</span>
                  </div>
                )}
                {part.supplier.email && (
                  <div>
                    <span className="text-muted-foreground">Email: </span>
                    <span className="font-semibold text-foreground">{part.supplier.email}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          {part.description && (
            <div className="rounded-2xl border border-border bg-muted/10 p-3.5 space-y-1">
              <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-slate-500" /> Description
              </span>
              <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {part.description}
              </p>
            </div>
          )}

          {/* Editable Procurement / Engineering Notes Card */}
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" /> Procurement / Engineering Notes
              </span>
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
            </div>

            {isEditingNotes ? (
              <div className="space-y-3 pt-1">
                <Textarea
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  placeholder="Enter procurement, sourcing, tooling, or engineering notes..."
                  className="min-h-[100px] text-xs bg-card border-amber-500/40 focus-visible:ring-amber-500"
                  rows={4}
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
              <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {part.notes}
              </p>
            ) : (
              <div className="py-2 text-center space-y-2">
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
          </div>

          {/* Metadata Footer */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border pt-3">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Created: {new Date(part.createdAt).toLocaleDateString()}
            </span>
            <span>
              Updated: {new Date(part.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 border-t border-border pt-4">
          <Button
            variant="outline"
            className="rounded-full cursor-pointer text-xs"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="rounded-full cursor-pointer text-xs gap-1.5"
              onClick={() => {
                onOpenChange(false);
                navigate(`/parts/${part.id}/edit`);
              }}
            >
              <Edit className="h-3.5 w-3.5" /> Full Edit
            </Button>

            <Button
              className="rounded-full bg-[#0066CC] hover:bg-[#0052A3] text-white cursor-pointer text-xs gap-1.5 shadow-sm shadow-blue-500/20"
              onClick={() => {
                onOpenChange(false);
                navigate(`/parts/${part.id}`);
              }}
            >
              Full Details <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
