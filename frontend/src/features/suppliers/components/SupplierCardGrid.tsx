import { Link } from 'react-router-dom';
import type { Supplier } from '@/types';
import {
  getSupplierInitials,
  getSupplierAvatarStyle,
  getSupplierStatusVariant,
  formatSupplierStatus,
} from '../utils/supplierUtils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Mail,
  Phone,
  MapPin,
  Globe,
  User,
  Eye,
  Edit,
  Trash2,
  FolderPlus,
  ExternalLink,
  Building2,
} from 'lucide-react';

interface SupplierCardGridProps {
  suppliers: Supplier[];
  onOpenQuickView: (supplier: Supplier) => void;
  onAssignToProject: (supplier: Supplier) => void;
  onDeleteSupplier: (supplier: Supplier) => void;
}

export function SupplierCardGrid({
  suppliers,
  onOpenQuickView,
  onAssignToProject,
  onDeleteSupplier,
}: SupplierCardGridProps) {
  if (suppliers.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground space-y-2">
        <Building2 className="h-8 w-8 mx-auto text-muted-foreground/50" />
        <p className="text-sm font-semibold">No suppliers found matching your criteria</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {suppliers.map((supplier) => {
        const initials = getSupplierInitials(supplier.name);
        const avatarStyle = getSupplierAvatarStyle(supplier.name);

        return (
          <div
            key={supplier.id}
            className="group relative rounded-3xl border border-border bg-card p-5 shadow-xs hover:shadow-lg transition-all space-y-4 flex flex-col justify-between"
          >
            {/* Top Bar: Avatar, Code, Status */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border font-black text-sm tracking-wider shadow-2xs ${avatarStyle.bg} ${avatarStyle.text} ${avatarStyle.border}`}
                  >
                    {initials}
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-mono font-bold text-muted-foreground uppercase">
                      {supplier.code}
                    </span>
                    <Link
                      to={`/suppliers/${supplier.id}`}
                      className="block text-base font-extrabold text-foreground hover:text-primary transition-colors line-clamp-1"
                    >
                      {supplier.name}
                    </Link>
                  </div>
                </div>

                <Badge
                  variant={getSupplierStatusVariant(supplier.status)}
                  className="text-[10px] font-bold px-2 py-0.5 capitalize shrink-0"
                >
                  {formatSupplierStatus(supplier.status)}
                </Badge>
              </div>

              {/* Contact Information Chips */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <User className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                  <span className="font-semibold text-foreground truncate">
                    {supplier.contactPerson || 'Unassigned Contact'}
                  </span>
                </div>

                {supplier.email && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    <a
                      href={`mailto:${supplier.email}`}
                      className="hover:text-primary transition-colors truncate"
                    >
                      {supplier.email}
                    </a>
                  </div>
                )}

                {supplier.phone && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <a
                      href={`tel:${supplier.phone}`}
                      className="hover:text-primary transition-colors truncate"
                    >
                      {supplier.phone}
                    </a>
                  </div>
                )}

                {supplier.address && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                    <span className="truncate">{supplier.address}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-border/60 gap-1">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenQuickView(supplier)}
                  className="h-8 px-2.5 rounded-xl text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground"
                >
                  <Eye className="h-3.5 w-3.5" /> Quick View
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onAssignToProject(supplier)}
                  className="h-8 px-2.5 rounded-xl text-xs font-semibold gap-1 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                >
                  <FolderPlus className="h-3.5 w-3.5" /> Assign
                </Button>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  asChild
                  className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
                >
                  <Link to={`/suppliers/${supplier.id}/edit`}>
                    <Edit className="h-3.5 w-3.5" />
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDeleteSupplier(supplier)}
                  className="h-8 w-8 rounded-xl text-destructive hover:bg-destructive/10"
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
