import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useCapacityAssessmentQuery } from '@/hooks/queries/useCapacityQuery';
import { useDeleteCapacityMutation } from '@/hooks/mutations/useCapacityMutations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Trash2,
  BarChart3,
  Calendar,
  User,
  Target,
  Gauge,
  Clock,
  Layers,
  Building2,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import { getStatusVariant } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/hooks/useToast';

export default function CapacityDetailPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [showDelete, setShowDelete] = useState(false);
  const deleteMutation = useDeleteCapacityMutation();

  const { data: assessment, isLoading, error, refetch } = useCapacityAssessmentQuery(assessmentId!);

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  if (error) return <ErrorState title="Failed to load assessment" message={error?.message} onRetry={refetch} />;
  if (!assessment) return <EmptyState title="Assessment not found" description="The capacity assessment you are looking for does not exist." />;

  const handleDelete = () => {
    deleteMutation.mutate(assessmentId!, {
      onSuccess: () => {
        toast.success('Capacity assessment deleted successfully');
        navigate('/capacity');
      },
      onError: (err) => toast.error(err?.message || 'Failed to delete assessment'),
    });
  };

  const getCateBadgeStyle = (cate?: string) => {
    if (!cate) return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300';
    const c = cate.toLowerCase();
    if (c.includes('1') || c.includes('m1') || c.includes('a')) return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800';
    if (c.includes('2') || c.includes('m2') || c.includes('b')) return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800';
    if (c.includes('3') || c.includes('m3') || c.includes('c')) return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800';
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800';
  };

  const getRiskBadge = (risk?: string) => {
    const r = (risk || 'low').toLowerCase();
    if (r === 'critical') return <Badge variant="destructive" className="uppercase font-semibold tracking-wider text-[11px]">Critical Risk</Badge>;
    if (r === 'high') return <Badge variant="warning" className="uppercase font-semibold tracking-wider text-[11px]">High Risk</Badge>;
    if (r === 'medium') return <Badge variant="outline" className="text-amber-600 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 uppercase font-semibold tracking-wider text-[11px]">Medium Risk</Badge>;
    return <Badge variant="outline" className="text-emerald-600 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 uppercase font-semibold tracking-wider text-[11px]">Low Risk</Badge>;
  };

  const util = assessment.utilizationRate ?? 0;
  const isOver = util >= 95;
  const isWarning = util >= 80 && util < 95;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-fade-in">
      {/* Top Navigation & Action */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/capacity"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <Badge variant="outline" className={`gap-1 px-2.5 py-0.5 text-xs font-semibold border ${getCateBadgeStyle(assessment.cate || assessment.gate)}`}>
                <Layers className="h-3.5 w-3.5" />
                {assessment.cate || assessment.gate || 'CATE 1'}
              </Badge>
              <Badge variant={getStatusVariant(assessment.status)} className="capitalize text-xs font-medium">
                {assessment.status}
              </Badge>
              {getRiskBadge(assessment.riskLevel)}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2 mt-1">
              <Cpu className="h-5 w-5 text-primary" />
              {assessment.partNumber ? `Part ${assessment.partNumber}` : assessment.bottleneck || 'Capacity Assessment'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {assessment.partName || assessment.notes || 'Detailed capacity evaluation & milestone review'}
            </p>
          </div>
        </div>

        <Button variant="destructive" size="sm" onClick={() => setShowDelete(true)} disabled={deleteMutation.isPending} className="gap-1.5">
          <Trash2 className="h-4 w-4" /> Delete Assessment
        </Button>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Required Capacity</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{assessment.currentCapacity?.toLocaleString() ?? '-'}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">pcs / month</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Installed Max Capacity</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{assessment.maximumCapacity?.toLocaleString() ?? '-'}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">pcs / month</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Utilization Rate</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold font-mono ${isOver ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-emerald-600'}`}>
              {assessment.utilizationRate != null ? `${assessment.utilizationRate}%` : '-'}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isOver ? 'Bottleneck Overload' : isWarning ? 'High Production Load' : 'Optimal Capacity Range'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Lead Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{assessment.leadTimeDays != null ? `${assessment.leadTimeDays}d` : '-'}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">days to manufacture</p>
          </CardContent>
        </Card>
      </div>

      {/* Capacity Utilization Progress Bar Card */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-primary" /> Production Capacity Load Gauge
            </span>
            <span className="font-mono font-bold text-sm text-primary">{util}%</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="w-full bg-secondary rounded-full h-3.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isOver ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(util, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground font-mono pt-1">
            <span>0 pcs</span>
            <span>Required: {assessment.currentCapacity?.toLocaleString()} pcs</span>
            <span>Installed Max: {assessment.maximumCapacity?.toLocaleString()} pcs</span>
          </div>
        </CardContent>
      </Card>

      {/* Milestone Calendar Weeks Tracking */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> Milestone Calendar Tracking (Weeks & Dates)
          </CardTitle>
          <CardDescription>Target, forecast, and actual completion dates for industrial transfer</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-lg border bg-card space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Assessment Date</p>
              <p className="font-semibold text-foreground">
                {assessment.assessmentDate ? new Date(assessment.assessmentDate).toLocaleDateString('en-GB') : `${assessment.month}/${assessment.year}`}
              </p>
              <p className="text-[11px] text-muted-foreground font-mono">Period: {assessment.month}/{assessment.year}</p>
            </div>

            <div className="p-3 rounded-lg border bg-card space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Target Week (M1/M2/M3)</p>
              <p className="text-base font-bold font-mono text-foreground">{assessment.targetWeek || 'N/A'}</p>
              <p className="text-[11px] text-muted-foreground">Contractual Target</p>
            </div>

            <div className="p-3 rounded-lg border bg-card space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Forecast Week</p>
              <p className="text-base font-bold font-mono text-foreground">{assessment.forecastWeek || 'N/A'}</p>
              <p className="text-[11px] text-muted-foreground">Supplier Projection</p>
            </div>

            <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 space-y-1">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Completed Week</p>
              <p className="text-base font-bold font-mono text-emerald-700 dark:text-emerald-300">{assessment.completedWeek || 'In Progress'}</p>
              <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400">Actual Realization</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Component & Supplier Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Supplier & Plant Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between py-1.5 border-b border-border/50">
              <span className="text-muted-foreground">Supplier Name:</span>
              <span className="font-semibold text-foreground">{assessment.supplierName || 'Assigned Supplier'}</span>
            </div>
            {assessment.supplierCode && (
              <div className="flex justify-between py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">Supplier COFOR:</span>
                <span className="font-mono font-medium text-foreground">{assessment.supplierCode}</span>
              </div>
            )}
            <div className="flex justify-between py-1.5 border-b border-border/50">
              <span className="text-muted-foreground">Assessed By:</span>
              <span className="text-foreground">{assessment.assessedBy || 'Capacity Manager'}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-muted-foreground">Logged At:</span>
              <span className="text-xs text-muted-foreground">
                {assessment.createdAt ? new Date(assessment.createdAt).toLocaleString() : '-'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" /> Component & Project Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between py-1.5 border-b border-border/50">
              <span className="text-muted-foreground">Part Number:</span>
              <span className="font-mono font-bold text-primary">{assessment.partNumber || assessment.projectPartId?.slice(0, 10)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border/50">
              <span className="text-muted-foreground">Part Designation:</span>
              <span className="font-medium text-foreground">{assessment.partName || 'Automotive Part'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border/50">
              <span className="text-muted-foreground">CMF Project:</span>
              <span className="text-foreground">{assessment.projectName || 'CMF Project'}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-muted-foreground">CATE:</span>
              <Badge variant="outline" className={`text-xs font-semibold ${getCateBadgeStyle(assessment.cate || assessment.gate)}`}>
                {assessment.cate || assessment.gate || 'CATE 1'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottleneck & Action Notes */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" /> Bottleneck Analysis & Action Plan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3.5 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 space-y-1">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Identified Constraint / Bottleneck</p>
            <p className="text-sm text-amber-900 dark:text-amber-200">
              {assessment.bottleneck || 'No bottleneck reported for this capacity assessment.'}
            </p>
          </div>

          {assessment.notes && (
            <div className="p-3.5 rounded-lg border bg-muted/30 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">Evaluation Notes & Action Plan</p>
              <p className="text-sm text-foreground/90 whitespace-pre-wrap">{assessment.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        onConfirm={handleDelete}
        title="Delete Assessment"
        message="Are you sure you want to delete this capacity assessment? This action cannot be undone."
        confirmText="Delete"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
