import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useRiskQuery } from '@/hooks/queries/useRisksQuery';
import { useDeleteRiskMutation } from '@/hooks/mutations/useRiskMutations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Trash2,
  AlertTriangle,
  Calendar,
  User,
  Building2,
  ShieldCheck,
  Zap,
  Clock,
  Layers,
  FileCheck2,
  ExternalLink,
} from 'lucide-react';
import { getRiskLevelVariant, getStatusVariant } from '@/lib/utils';
import {
  calculateRiskScore,
  getRiskScoreLevel,
  formatProbabilityLabel,
  formatSeverityLabel,
  formatStatusLabel,
} from './utils/riskUtils';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { QuickMitigateModal } from './components/QuickMitigateModal';
import { useLanguage } from '@/context/LanguageContext';

export default function RiskDetailPage() {
  const { riskId } = useParams<{ riskId: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [showDelete, setShowDelete] = useState(false);
  const [showMitigate, setShowMitigate] = useState(false);
  const deleteMutation = useDeleteRiskMutation();

  const { data: risk, isLoading, error, refetch } = useRiskQuery(riskId!);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-10 w-72 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Failed to load risk details" message={error?.message} onRetry={refetch} />;
  }

  if (!risk) {
    return <EmptyState title="Risk not found" description="The risk record you are looking for does not exist or has been removed." />;
  }

  const riskScore = calculateRiskScore(risk.severity, risk.probability, risk.riskScore);
  const scoreLevel = getRiskScoreLevel(riskScore);

  const handleDelete = () => {
    deleteMutation.mutate(riskId!, { onSuccess: () => navigate('/risks') });
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Navigation & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="rounded-xl">
            <Link to="/risks">
              <ArrowLeft className="h-4 w-4 mr-1" /> {t('common.back', 'Back to Risks')}
            </Link>
          </Button>
          <div className="h-4 w-[1px] bg-border hidden sm:block" />
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={getRiskLevelVariant(risk.severity)} className="capitalize font-bold px-2.5 py-0.5">
              {formatSeverityLabel(risk.severity)}
            </Badge>
            <Badge variant={getStatusVariant(risk.status)} className="capitalize font-bold px-2.5 py-0.5">
              {formatStatusLabel(risk.status)}
            </Badge>
            <span className={`inline-flex items-center gap-1 text-xs font-black px-2.5 py-0.5 rounded-full border ${scoreLevel.badgeClass}`}>
              <Zap className="h-3 w-3" /> Score: {riskScore} ({scoreLevel.label})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMitigate(true)}
            className="rounded-xl gap-2 font-bold"
          >
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            {t('risks_page.quick_mitigate', 'Mitigate Plan')}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDelete(true)}
            disabled={deleteMutation.isPending}
            className="rounded-xl gap-1.5 font-bold"
          >
            <Trash2 className="h-4 w-4" /> {t('common.delete', 'Delete')}
          </Button>
        </div>
      </div>

      {/* Hero Title Section */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-wider">
                RISK #{risk.id.slice(0, 8)}
              </span>
              {risk.riskType && (
                <span className="rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[11px] font-bold px-2.5 py-0.5 border border-blue-500/20">
                  {risk.riskType}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">{risk.title}</h1>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              {risk.description || 'No detailed description provided for this risk item.'}
            </p>
          </div>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Associated Project
            </CardTitle>
            <Building2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-base font-extrabold text-foreground truncate">
              {risk.projectName || 'Universal Platform'}
            </div>
            {risk.projectId && (
              <Link
                to={`/projects/${risk.projectId}`}
                className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
              >
                View Project <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Assigned Lead
            </CardTitle>
            <User className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-base font-extrabold text-foreground truncate">
              {risk.assignedTo || 'SQD Lead Auditor'}
            </div>
            <p className="text-xs text-muted-foreground">Responsible for mitigation</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Target Due Date
            </CardTitle>
            <Calendar className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-base font-extrabold text-foreground">
              {risk.dueDate ? new Date(risk.dueDate).toLocaleDateString() : 'No Target Set'}
            </div>
            <p className="text-xs text-muted-foreground">
              {risk.dueDate ? 'Milestone deadline' : 'Pending scheduling'}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Probability
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-base font-extrabold text-foreground">
              {formatProbabilityLabel(risk.probability)}
            </div>
            <p className="text-xs text-muted-foreground">Automotive 5-level scale</p>
          </CardContent>
        </Card>
      </div>

      {/* Linked Industrial Capacity Assessment Card (if capacity linked) */}
      {(risk.capacityAssessmentId || risk.utilizationRate != null || risk.partNumber) && (
        <Card className="rounded-2xl border-border/80 bg-card/60 shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border/40 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Linked Industrial Capacity Assessment
              </CardTitle>
              {risk.capacityAssessmentId && (
                <Button variant="outline" size="sm" asChild className="h-7 text-xs rounded-lg gap-1">
                  <Link to={`/capacity/${risk.capacityAssessmentId}`}>
                    Open Capacity Audit <ExternalLink className="h-3 w-3" />
                  </Link>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground font-medium">Automotive Part</p>
              <p className="text-sm font-bold font-mono text-foreground">{risk.partNumber ? `Part ${risk.partNumber}` : risk.partName || 'Component'}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground font-medium">Supplier Site</p>
              <p className="text-sm font-bold text-foreground">{risk.supplierName || 'Manufacturing Supplier'}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground font-medium">Production Load Rate</p>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-extrabold font-mono ${
                  (risk.utilizationRate ?? 0) >= 100
                    ? 'text-rose-600'
                    : (risk.utilizationRate ?? 0) >= 85
                    ? 'text-amber-600'
                    : 'text-emerald-600'
                }`}>
                  {risk.utilizationRate != null ? `${risk.utilizationRate}%` : 'Audited'}
                </span>
                {risk.gate && <Badge variant="secondary" className="text-[10px] font-mono">{risk.gate}</Badge>}
              </div>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground font-medium">Audited Bottleneck</p>
              <p className="text-xs font-semibold text-foreground truncate">{risk.bottleneck || 'Production tooling / Line throughput'}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Impact & Mitigation Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="rounded-2xl border-border shadow-xs">
          <CardHeader className="flex flex-row items-center gap-2 border-b border-border pb-3">
            <Zap className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-base font-extrabold">Potential Impact & Severity</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm text-foreground leading-relaxed">
              {risk.impact || 'No detailed impact statement documented. Evaluate production line volume and customer quality impact.'}
            </p>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3 space-y-1.5">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-muted-foreground">Risk Exposure Index:</span>
                <span className={scoreLevel.textClass}>{riskScore} / 20 ({scoreLevel.label})</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full ${scoreLevel.bgClass}`}
                  style={{ width: `${Math.min(100, (riskScore / 20) * 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <CardTitle className="text-base font-extrabold">Mitigation & Action Plan</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMitigate(true)}
              className="text-xs h-7 rounded-lg"
            >
              Update Plan
            </Button>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm text-foreground leading-relaxed">
              {risk.mitigation || 'No mitigation plan recorded yet. Click "Update Plan" to submit action items, assigned owners, and target completion dates.'}
            </p>
            {risk.contingency && (
              <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Contingency / Fallback Plan:
                </p>
                <p className="text-xs text-foreground">{risk.contingency}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        onConfirm={handleDelete}
        title="Delete Risk Record"
        message={`Are you sure you want to delete "${risk.title}"? This action cannot be undone and will remove the risk from audit tracking.`}
        confirmText="Delete"
        loading={deleteMutation.isPending}
      />

      {showMitigate && (
        <QuickMitigateModal
          risk={risk}
          open={showMitigate}
          onOpenChange={setShowMitigate}
        />
      )}
    </div>
  );
}
