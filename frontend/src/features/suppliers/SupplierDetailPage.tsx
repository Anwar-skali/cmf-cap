import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import {
  Edit,
  Trash2,
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Globe,
  Building2,
  FolderPlus,
  Calendar,
  ShieldCheck,
  ExternalLink,
  Users,
  CheckCircle2,
} from 'lucide-react';
import { useSupplierQuery } from '@/hooks/queries/useSuppliersQuery';
import { useDeleteSupplierMutation } from '@/hooks/mutations/useSupplierMutations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AssignToProjectModal } from './components/AssignToProjectModal';
import {
  getSupplierInitials,
  getSupplierAvatarStyle,
  getSupplierStatusVariant,
  formatSupplierStatus,
} from './utils/supplierUtils';
import { useLanguage } from '@/context/LanguageContext';

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [showDelete, setShowDelete] = useState(false);
  const [showAssign, setShowAssign] = useState(false);

  const { data: supplier, isLoading, error, refetch } = useSupplierQuery(id!);
  const deleteSupplier = useDeleteSupplierMutation();

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !supplier) {
    return (
      <ErrorState
        title="Supplier not found"
        message={error?.message ?? 'The supplier could not be loaded or has been removed.'}
        onRetry={refetch}
      />
    );
  }

  const initials = getSupplierInitials(supplier.name);
  const avatarStyle = getSupplierAvatarStyle(supplier.name);

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Top Navigation & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="rounded-xl">
            <Link to="/suppliers">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Suppliers
            </Link>
          </Button>
          <div className="h-4 w-[1px] bg-border hidden sm:block" />
          <Badge
            variant={getSupplierStatusVariant(supplier.status)}
            className="capitalize font-bold px-2.5 py-0.5"
          >
            {formatSupplierStatus(supplier.status)}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAssign(true)}
            className="rounded-xl gap-1.5 font-bold text-blue-600 dark:text-blue-400"
          >
            <FolderPlus className="h-4 w-4" /> Assign to Project
          </Button>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="rounded-xl gap-1.5 font-bold"
          >
            <Link to={`/suppliers/${id}/edit`}>
              <Edit className="h-4 w-4" /> Edit
            </Link>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDelete(true)}
            className="rounded-xl gap-1.5 font-bold"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      {/* Hero Vendor Banner Card */}
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border font-black text-xl tracking-wider shadow-sm ${avatarStyle.bg} ${avatarStyle.text} ${avatarStyle.border}`}
            >
              {initials}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-muted-foreground uppercase">
                  VENDOR CODE: {supplier.code}
                </span>
                <Badge variant="outline" className="text-[10px] font-bold text-emerald-600 border-emerald-500/20 bg-emerald-500/10">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Approved Vendor
                </Badge>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                {supplier.name}
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Contact Information */}
        <Card className="rounded-2xl border-border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
            <CardTitle className="text-sm font-extrabold flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-500" />
              Primary Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Name</span>
              <p className="text-sm font-extrabold text-foreground">{supplier.contactPerson || 'Unassigned'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Email Address</span>
              {supplier.email ? (
                <a
                  href={`mailto:${supplier.email}`}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1.5 truncate"
                >
                  <Mail className="h-3.5 w-3.5" /> {supplier.email}
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">None provided</p>
              )}
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Phone</span>
              {supplier.phone ? (
                <a
                  href={`tel:${supplier.phone}`}
                  className="text-xs font-bold text-foreground hover:text-primary flex items-center gap-1.5 truncate"
                >
                  <Phone className="h-3.5 w-3.5" /> {supplier.phone}
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">None provided</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Location & Web */}
        <Card className="rounded-2xl border-border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
            <CardTitle className="text-sm font-extrabold flex items-center gap-2">
              <MapPin className="h-4 w-4 text-rose-500" />
              Facility & Web
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Manufacturing Site</span>
              <p className="text-xs sm:text-sm text-foreground leading-relaxed">
                {supplier.address || 'Global Production Facility'}
              </p>
            </div>
            <div className="space-y-1 pt-1">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Official Portal</span>
              {supplier.website ? (
                <a
                  href={supplier.website.startsWith('http') ? supplier.website : `https://${supplier.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1.5 truncate"
                >
                  <Globe className="h-3.5 w-3.5" /> {supplier.website} <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">No official URL recorded</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Procurement & Lifecycle */}
        <Card className="rounded-2xl border-border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
            <CardTitle className="text-sm font-extrabold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Quality Compliance
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between py-1 border-b border-border/60">
              <span className="text-xs text-muted-foreground font-semibold">Vendor Status</span>
              <Badge variant={getSupplierStatusVariant(supplier.status)} className="capitalize font-bold text-xs">
                {formatSupplierStatus(supplier.status)}
              </Badge>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/60">
              <span className="text-xs text-muted-foreground font-semibold">Onboarded</span>
              <span className="text-xs font-extrabold text-foreground">
                {new Date(supplier.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-xs text-muted-foreground font-semibold">Audit Record</span>
              <span className="text-xs font-extrabold text-foreground">
                {new Date(supplier.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Procurement Notes */}
      {supplier.notes && (
        <Card className="rounded-2xl border-border shadow-xs">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-sm font-extrabold">Procurement & Sourcing Notes</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {supplier.notes}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Assign Modal & Delete Dialog */}
      <AssignToProjectModal
        supplier={supplier}
        open={showAssign}
        onOpenChange={setShowAssign}
      />

      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        onConfirm={() => {
          deleteSupplier.mutate(id!, {
            onSuccess: () => navigate('/suppliers'),
          });
        }}
        title="Delete Supplier"
        message={`Are you sure you want to delete "${supplier.name}"? This action cannot be undone.`}
        confirmText="Delete"
        loading={deleteSupplier.isPending}
      />
    </div>
  );
}
