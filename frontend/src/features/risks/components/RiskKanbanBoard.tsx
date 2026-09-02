import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Risk, RiskStatus } from '@/types';
import {
  calculateRiskScore,
  getRiskScoreLevel,
  formatProbabilityLabel,
  formatSeverityLabel,
} from '../utils/riskUtils';
import { getRiskLevelVariant, getStatusVariant } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Building2,
  User,
  Zap,
  Eye,
  Plus,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUpdateRiskMutation } from '@/hooks/mutations/useRiskMutations';
import { useLanguage } from '@/context/LanguageContext';

interface RiskKanbanBoardProps {
  risks: Risk[];
  onOpenQuickView: (risk: Risk) => void;
  onOpenMitigate: (risk: Risk) => void;
}

const COLUMNS: {
  id: RiskStatus;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  badgeClass: string;
  headerBorder: string;
}[] = [
  {
    id: 'open',
    title: 'Open / Discovered',
    subtitle: 'Newly identified non-conformities',
    icon: AlertTriangle,
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    headerBorder: 'border-rose-500/40',
  },
  {
    id: 'mitigating',
    title: 'In Mitigation',
    subtitle: 'Corrective actions in progress',
    icon: Clock,
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    headerBorder: 'border-amber-500/40',
  },
  {
    id: 'mitigated',
    title: 'Mitigated',
    subtitle: 'Actions implemented & verified',
    icon: ShieldCheck,
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    headerBorder: 'border-emerald-500/40',
  },
  {
    id: 'closed',
    title: 'Closed & Validated',
    subtitle: 'Archived and signed off',
    icon: CheckCircle2,
    badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
    headerBorder: 'border-slate-500/40',
  },
];

export function RiskKanbanBoard({
  risks,
  onOpenQuickView,
  onOpenMitigate,
}: RiskKanbanBoardProps) {
  const { t } = useLanguage();
  const updateMutation = useUpdateRiskMutation();

  const handleMoveStatus = (risk: Risk, newStatus: RiskStatus) => {
    updateMutation.mutate({
      id: risk.id,
      data: { status: newStatus },
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
      {COLUMNS.map((col) => {
        const columnRisks = risks.filter((r) => (r.status || 'open') === col.id);
        const ColIcon = col.icon;

        return (
          <div
            key={col.id}
            className="flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-3.5 space-y-3 min-h-[500px]"
          >
            {/* Column Header */}
            <div className={`flex items-center justify-between border-b pb-3 ${col.headerBorder}`}>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-card border border-border shadow-xs">
                  <ColIcon className="h-3.5 w-3.5 text-foreground" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-foreground">{col.title}</h4>
                  <p className="text-[10px] text-muted-foreground">{col.subtitle}</p>
                </div>
              </div>
              <Badge variant="outline" className={`font-mono font-bold text-xs ${col.badgeClass}`}>
                {columnRisks.length}
              </Badge>
            </div>

            {/* Column Risk Cards */}
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[700px] pr-1">
              {columnRisks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
                  No risks in this stage
                </div>
              ) : (
                columnRisks.map((risk) => {
                  const score = calculateRiskScore(risk.severity, risk.probability, risk.riskScore);
                  const scoreLevel = getRiskScoreLevel(score);
                  const isOverdue = risk.dueDate && new Date(risk.dueDate) < new Date() && risk.status !== 'closed' && risk.status !== 'mitigated';

                  return (
                    <div
                      key={risk.id}
                      className="group rounded-2xl border border-border bg-card p-3.5 shadow-xs hover:shadow-md transition-all space-y-2.5"
                    >
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant={getRiskLevelVariant(risk.severity)} className="text-[10px] px-2 py-0.2 capitalize font-bold">
                            {risk.severity}
                          </Badge>
                          {risk.riskType && (
                            <span className="text-[10px] font-semibold text-muted-foreground rounded bg-muted/60 px-1.5 py-0.2 border border-border">
                              {risk.riskType}
                            </span>
                          )}
                          {risk.utilizationRate != null && (
                            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                              risk.utilizationRate >= 100
                                ? 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                                : risk.utilizationRate >= 85
                                ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                                : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                            }`}>
                              {risk.utilizationRate}% Load
                            </span>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="cursor-pointer group flex items-center">
                                <span className="text-[10px] font-mono rounded bg-secondary px-1.5 py-0.2 text-secondary-foreground border group-hover:bg-primary/20 transition-colors">
                                  {risk.gate || 'CATE 1'} ▾
                                </span>
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-32 rounded-xl">
                              <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">Switch CAT Gate</DropdownMenuLabel>
                              {['CATE 1', 'CATE 2', 'CATE 3', 'Gate 1 (M1)', 'Gate 2 (M2)', 'Gate 3 (M3)'].map((g) => (
                                <DropdownMenuItem
                                  key={g}
                                  onClick={() => updateMutation.mutate({ id: risk.id, data: { gate: g } })}
                                  className="text-xs font-mono"
                                >
                                  {g}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full border ${scoreLevel.badgeClass}`}>
                          {score} pts
                        </span>
                      </div>

                      {/* Title & Link */}
                      <Link
                        to={`/risks/${risk.id}`}
                        className="block text-xs sm:text-sm font-extrabold text-foreground hover:text-primary transition-colors line-clamp-2"
                      >
                        {risk.title}
                      </Link>

                      {/* Project / Part Info */}
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1 truncate">
                          <Building2 className="h-3 w-3 shrink-0 text-blue-500" />
                          <span className="truncate">{risk.projectName || 'Universal Platform'}</span>
                        </div>
                        {risk.partNumber && (
                          <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                            Part {risk.partNumber}
                          </span>
                        )}
                      </div>

                      {/* Due Date & Assignee */}
                      <div className="flex items-center justify-between pt-1 border-t border-border/60 text-[10px]">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <User className="h-3 w-3 text-indigo-500" />
                          <span className="truncate max-w-[90px]">{risk.assignedTo || 'SQD Auditor'}</span>
                        </div>

                        {risk.dueDate ? (
                          <span
                            className={`flex items-center gap-1 font-semibold ${
                              isOverdue ? 'text-rose-500 font-black' : 'text-muted-foreground'
                            }`}
                          >
                            <Calendar className="h-3 w-3" />
                            {new Date(risk.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            {isOverdue && ' (!)'}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">No date</span>
                        )}
                      </div>

                      {/* Action Bar */}
                      <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/40">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenQuickView(risk)}
                          className="h-6 px-1.5 text-[10px] rounded-lg gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <Eye className="h-3 w-3" /> Quick View
                        </Button>

                        <div className="flex items-center gap-0.5">
                          {col.id === 'open' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleMoveStatus(risk, 'mitigating')}
                              disabled={updateMutation.isPending}
                              className="h-6 px-2 text-[10px] rounded-lg gap-1 font-bold text-amber-600 hover:text-amber-700"
                            >
                              Mitigate <ArrowRight className="h-2.5 w-2.5" />
                            </Button>
                          )}
                          {col.id === 'mitigating' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleMoveStatus(risk, 'mitigated')}
                              disabled={updateMutation.isPending}
                              className="h-6 px-2 text-[10px] rounded-lg gap-1 font-bold text-emerald-600 hover:text-emerald-700"
                            >
                              Resolved <ArrowRight className="h-2.5 w-2.5" />
                            </Button>
                          )}
                          {col.id === 'mitigated' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleMoveStatus(risk, 'closed')}
                              disabled={updateMutation.isPending}
                              className="h-6 px-2 text-[10px] rounded-lg gap-1 font-bold text-slate-600 hover:text-slate-700"
                            >
                              Close <ArrowRight className="h-2.5 w-2.5" />
                            </Button>
                          )}
                          {col.id === 'closed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMoveStatus(risk, 'open')}
                              disabled={updateMutation.isPending}
                              className="h-6 px-1.5 text-[10px] rounded-lg text-muted-foreground hover:text-foreground"
                            >
                              Re-open
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
