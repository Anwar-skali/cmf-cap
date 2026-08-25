import { Link, useNavigate } from 'react-router-dom';
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
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Globe,
  User,
  Calendar,
  ExternalLink,
  Edit,
  FolderPlus,
  ShieldCheck,
} from 'lucide-react';
import type { Supplier } from '@/types';
import {
  getSupplierInitials,
  getSupplierAvatarStyle,
  getSupplierStatusVariant,
  formatSupplierStatus,
} from '../utils/supplierUtils';
import { useLanguage } from '@/context/LanguageContext';

interface SupplierQuickViewModalProps {
  supplier: Supplier | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssignToProject?: (supplier: Supplier) => void;
}

export function SupplierQuickViewModal({
  supplier,
  open,
  onOpenChange,
  onAssignToProject,
}: SupplierQuickViewModalProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();

  if (!supplier) return null;

  const initials = getSupplierInitials(supplier.name);
  const avatarStyle = getSupplierAvatarStyle(supplier.name);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border-border bg-card shadow-2xl">
        <DialogHeader className="space-y-4 border-b border-border pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border font-black text-sm tracking-wider shadow-xs ${avatarStyle.bg} ${avatarStyle.text} ${avatarStyle.border}`}
              >
                {initials}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-muted-foreground uppercase">
                    CODE: {supplier.code}
                  </span>
                  <Badge
                    variant={getSupplierStatusVariant(supplier.status)}
                    className="text-[10px] font-bold px-2 py-0.2 capitalize"
                  >
                    {formatSupplierStatus(supplier.status)}
                  </Badge>
                </div>
                <DialogTitle className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                  {supplier.name}
                </DialogTitle>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Contact Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border bg-muted/20 p-3.5 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                <User className="h-3.5 w-3.5 text-indigo-500" />
                <span>Contact Person</span>
              </div>
              <p className="text-sm font-extrabold text-foreground">
                {supplier.contactPerson || 'Unspecified'}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-muted/20 p-3.5 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                <Mail className="h-3.5 w-3.5 text-blue-500" />
                <span>Email Address</span>
              </div>
              {supplier.email ? (
                <a
                  href={`mailto:${supplier.email}`}
                  className="text-xs font-bold text-primary hover:underline block truncate"
                >
                  {supplier.email}
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">No email provided</p>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-muted/20 p-3.5 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                <Phone className="h-3.5 w-3.5 text-emerald-500" />
                <span>Phone Number</span>
              </div>
              {supplier.phone ? (
                <a
                  href={`tel:${supplier.phone}`}
                  className="text-xs font-bold text-foreground hover:text-primary block truncate"
                >
                  {supplier.phone}
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">No phone recorded</p>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-muted/20 p-3.5 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                <Globe className="h-3.5 w-3.5 text-amber-500" />
                <span>Official Website</span>
              </div>
              {supplier.website ? (
                <a
                  href={supplier.website.startsWith('http') ? supplier.website : `https://${supplier.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1 truncate"
                >
                  Visit Website <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">No website available</p>
              )}
            </div>
          </div>

          {/* Address */}
          {supplier.address && (
            <div className="rounded-2xl border border-border bg-muted/20 p-3.5 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 text-rose-500" />
                <span>Facility / Headquarters Location</span>
              </div>
              <p className="text-xs sm:text-sm text-foreground">{supplier.address}</p>
            </div>
          )}

          {/* Notes */}
          {supplier.notes && (
            <div className="rounded-2xl border border-border bg-muted/20 p-3.5 space-y-1">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Procurement & Capacity Notes
              </h4>
              <p className="text-xs sm:text-sm text-foreground leading-relaxed">
                {supplier.notes}
              </p>
            </div>
          )}

          {/* Metadata */}
          <div className="flex flex-wrap items-center justify-between text-[11px] text-muted-foreground border-t border-border pt-3">
            <span>Added: {new Date(supplier.createdAt).toLocaleDateString()}</span>
            <span>Last Updated: {new Date(supplier.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>

        <DialogFooter className="border-t border-border pt-4 flex-row items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="rounded-xl text-xs font-semibold gap-1.5"
          >
            <Link to={`/suppliers/${supplier.id}`}>
              <ExternalLink className="h-3.5 w-3.5" /> Full Vendor Profile
            </Link>
          </Button>

          <div className="flex items-center gap-2">
            {onAssignToProject && (
              <Button
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onAssignToProject(supplier);
                }}
                className="rounded-xl text-xs font-bold bg-[#0066CC] hover:bg-[#0052A3] text-white shadow-sm gap-1.5"
              >
                <FolderPlus className="h-3.5 w-3.5" /> Assign to Project
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs font-semibold"
            >
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
