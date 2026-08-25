import { Link } from 'react-router-dom';
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
  ExternalLink,
  ShieldCheck,
  Building2,
  User,
  Calendar,
  Zap,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import type { Risk } from '@/types';
import { getRiskLevelVariant, getStatusVariant } from '@/lib/utils';
import {
  calculateRiskScore,
  getRiskScoreLevel,
  formatProbabilityLabel,
  formatSeverityLabel,
  formatStatusLabel,
} from '../utils/riskUtils';
import { useLanguage } from '@/context/LanguageContext';

interface RiskQuickViewModalProps {
  risk: Risk | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenMitigate?: (risk: Risk) => void;
}

export function RiskQuickViewModal({
  risk,
  open,
  onOpenChange,
  onOpenMitigate,
}: RiskQuickViewModalProps) {
  const { t } = useLanguage();

  if (!risk) return null;

  const riskScore = calculateRiskScore(risk.severity, risk.probability, risk.riskScore);
  const scoreLevel = getRiskScoreLevel(riskScore);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border-border bg-card shadow-2xl">
        <DialogHeader className="space-y-3 border-b border-border pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-muted-foreground uppercase">
                RISK #{risk.id.slice(0, 8)}
              </span>
              {risk.riskType && (
                <Badge variant="outline" className="text-[10px] font-bold">
                  {risk.riskType}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={getRiskLevelVariant(risk.severity)} className="capitalize font-bold text-xs">
                {formatSeverityLabel(risk.severity)}
              </Badge>
              <Badge variant={getStatusVariant(risk.status)} className="capitalize font-bold text-xs">
                {formatStatusLabel(risk.status)}
              </Badge>
            </div>
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
            {risk.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Risk Score Highlight Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <div className="flex items-center gap-1.5 text-foreground">
                <Zap className="h-4 w-4 text-amber-500" />
                <span>Risk Exposure Index</span>
              </div>
              <span className={scoreLevel.textClass}>
                Score: {riskScore} / 20 ({scoreLevel.label})
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full ${scoreLevel.bgClass}`}
                style={{ width: `${Math.min(100, (riskScore / 20) * 100)}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-muted-foreground font-medium">
              <div>Probability: <span className="font-bold text-foreground">{formatProbabilityLabel(risk.probability)}</span></div>
              <div>Severity: <span className="font-bold text-foreground">{formatSeverityLabel(risk.severity)}</span></div>
            </div>
          </div>

          {/* Description */}
          {risk.description && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Description & Context
              </h4>
              <p className="text-xs sm:text-sm text-foreground leading-relaxed rounded-xl border border-border bg-muted/20 p-3">
                {risk.description}
              </p>
            </div>
          )}

          {/* Meta Information Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-border p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 text-blue-500" />
                <span>Project</span>
              </div>
              <p className="text-xs font-extrabold text-foreground truncate">
                {risk.projectName || 'Universal Platform'}
              </p>
            </div>

            <div className="rounded-xl border border-border p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                <User className="h-3.5 w-3.5 text-indigo-500" />
                <span>Assigned Owner</span>
              </div>
              <p className="text-xs font-extrabold text-foreground truncate">
                {risk.assignedTo || 'SQD Auditor'}
              </p>
            </div>

            <div className="rounded-xl border border-border p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 text-amber-500" />
                <span>Target Due Date</span>
              </div>
              <p className="text-xs font-extrabold text-foreground">
                {risk.dueDate ? new Date(risk.dueDate).toLocaleDateString() : 'No Target Set'}
              </p>
            </div>
          </div>

          {/* Mitigation Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                Mitigation Plan
              </h4>
              {onOpenMitigate && (
                <button
                  onClick={() => {
                    onOpenChange(false);
                    onOpenMitigate(risk);
                  }}
                  className="text-xs font-bold text-primary hover:underline cursor-pointer"
                >
                  Edit Plan
                </button>
              )}
            </div>
            <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
              <p className="text-xs sm:text-sm text-foreground leading-relaxed">
                {risk.mitigation || 'No mitigation plan recorded yet.'}
              </p>
              {risk.contingency && (
                <div className="pt-2 border-t border-border">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Contingency:
                  </span>
                  <p className="text-xs text-foreground mt-0.5">{risk.contingency}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border pt-4 flex-row items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="rounded-xl text-xs font-semibold gap-1.5"
          >
            <Link to={`/risks/${risk.id}`}>
              <ExternalLink className="h-3.5 w-3.5" /> Full Page Details
            </Link>
          </Button>

          <div className="flex items-center gap-2">
            {onOpenMitigate && (
              <Button
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onOpenMitigate(risk);
                }}
                className="rounded-xl text-xs font-bold bg-[#0066CC] hover:bg-[#0052A3] text-white shadow-sm gap-1.5"
              >
                <ShieldCheck className="h-3.5 w-3.5" /> Quick Mitigate
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
