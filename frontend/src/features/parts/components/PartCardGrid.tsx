import { Link } from 'react-router-dom';
import type { ProjectPart } from '@/types';
import {
  getPartInitials,
  getPartAvatarStyle,
  getPartStatusVariant,
  formatPartStatus,
  getMaterialStyle,
} from '../utils/partUtils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Boxes,
  Building2,
  Layers,
  Scale,
  Eye,
  Pencil,
  Trash2,
  Copy,
  Check,
  Package,
  FolderKanban,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface PartCardGridProps {
  parts: ProjectPart[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onOpenQuickView: (part: ProjectPart) => void;
  onDeletePart: (part: ProjectPart) => void;
}

export function PartCardGrid({
  parts,
  selectedIds,
  onToggleSelect,
  onOpenQuickView,
  onDeletePart,
}: PartCardGridProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Part number copied');
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (parts.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border p-12 text-center text-muted-foreground space-y-3 bg-card/40">
        <Package className="h-10 w-10 mx-auto text-muted-foreground/40" />
        <div className="space-y-1">
          <p className="text-base font-bold text-foreground">No parts found matching your criteria</p>
          <p className="text-xs text-muted-foreground">Try adjusting your filters or search keywords.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {parts.map((part) => {
        const initials = getPartInitials(part.name);
        const avatarStyle = getPartAvatarStyle(part.name);
        const materialStyle = getMaterialStyle(part.material);
        const isSelected = selectedIds.includes(part.id);

        return (
          <div
            key={part.id}
            className={`group relative rounded-3xl border bg-card p-5 shadow-xs hover:shadow-xl transition-all duration-200 flex flex-col justify-between space-y-4 ${
              isSelected ? 'border-primary ring-2 ring-primary/20 bg-primary/[0.02]' : 'border-border hover:border-border/80'
            }`}
          >
            {/* Top Bar: Checkbox + Avatar + Title + Status */}
            <div className="space-y-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(part.id)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                    aria-label={`Select part ${part.name}`}
                  />
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border font-black text-sm tracking-wider shadow-2xs ${avatarStyle.bg} ${avatarStyle.text} ${avatarStyle.border}`}
                  >
                    {initials}
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-mono font-bold text-muted-foreground uppercase flex items-center gap-1">
                        {part.partNumber}
                        <button
                          onClick={(e) => handleCopy(part.id, part.partNumber, e)}
                          className="opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity cursor-pointer p-0.5"
                          title="Copy part number"
                        >
                          {copiedId === part.id ? (
                            <Check className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </span>
                    </div>
                    <Link
                      to={`/parts/${part.id}`}
                      className="block text-base font-black text-foreground hover:text-primary transition-colors truncate"
                      title={part.name}
                    >
                      {part.name}
                    </Link>
                  </div>
                </div>

                <Badge
                  variant={getPartStatusVariant(part.status)}
                  className="text-[10px] font-bold px-2 py-0.5 capitalize shrink-0"
                >
                  {formatPartStatus(part.status)}
                </Badge>
              </div>

              {/* Specs Chips */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="rounded-xl border border-border/60 bg-muted/30 p-2.5 space-y-0.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Boxes className="h-3 w-3 text-blue-500" /> Quantity
                  </span>
                  <p className="text-sm font-black text-foreground">
                    {part.quantity?.toLocaleString()} <span className="text-[11px] font-normal text-muted-foreground">{part.unit || 'pcs'}</span>
                  </p>
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/30 p-2.5 space-y-0.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Layers className="h-3 w-3 text-indigo-500" /> Commodity
                  </span>
                  <p className="text-xs font-extrabold truncate">
                    <span className={`inline-block px-1.5 py-0.5 rounded-md border text-[11px] ${materialStyle.bg} ${materialStyle.text} ${materialStyle.border}`}>
                      {part.material || 'Direct Material'}
                    </span>
                  </p>
                </div>
              </div>

              {/* Supplier & COFOR Info */}
              <div className="space-y-1.5 pt-1 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span className="font-medium truncate max-w-[170px] text-foreground font-semibold">
                      {part.supplier?.name || 'No supplier assigned'}
                    </span>
                  </span>
                  {(part.manufacturingCofor || part.supplier?.code) && (
                    <span className="flex items-center gap-1 font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      COFOR: {part.manufacturingCofor || part.supplier?.code}
                    </span>
                  )}
                </div>

                {part.useCase && (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="text-muted-foreground font-medium">Use Case:</span>
                    <span className="text-foreground font-semibold truncate">
                      {part.useCase}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex items-center justify-between border-t border-border pt-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-full text-xs font-bold gap-1.5 text-primary hover:bg-primary/10 cursor-pointer"
                onClick={() => onOpenQuickView(part)}
              >
                <Eye className="h-3.5 w-3.5" /> Quick View
              </Button>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
                  asChild
                  title="Edit Part"
                >
                  <Link to={`/parts/${part.id}/edit`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive cursor-pointer"
                  onClick={() => onDeletePart(part)}
                  title="Delete Part"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
