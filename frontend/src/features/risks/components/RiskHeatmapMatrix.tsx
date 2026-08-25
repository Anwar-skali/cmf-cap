import { useState } from 'react';
import type { Risk, RiskSeverity, RiskProbability } from '@/types';
import {
  getProbabilityWeight,
  getSeverityWeight,
  getRiskScoreLevel,
} from '../utils/riskUtils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Grid, ChevronDown, ChevronUp, X, Filter } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

interface RiskHeatmapMatrixProps {
  risks: Risk[];
  selectedCell: { severity: string; probability: string } | null;
  onSelectCell: (cell: { severity: string; probability: string } | null) => void;
}

const PROBABILITIES: { key: RiskProbability; label: string; weight: number }[] = [
  { key: 'almost_certain', label: '5. Almost Certain', weight: 5 },
  { key: 'likely',         label: '4. Likely',         weight: 4 },
  { key: 'possible',       label: '3. Possible',       weight: 3 },
  { key: 'unlikely',       label: '2. Unlikely',       weight: 2 },
  { key: 'rare',           label: '1. Rare',           weight: 1 },
];

const SEVERITIES: { key: RiskSeverity; label: string; weight: number }[] = [
  { key: 'low',      label: 'Low (1)',      weight: 1 },
  { key: 'medium',   label: 'Medium (2)',   weight: 2 },
  { key: 'high',     label: 'High (3)',     weight: 3 },
  { key: 'critical', label: 'Critical (4)', weight: 4 },
];

function getCellColorStyle(score: number, isSelected: boolean) {
  let baseColor = '';
  if (score >= 15) {
    baseColor = 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40 hover:bg-rose-500/30';
  } else if (score >= 9) {
    baseColor = 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/30';
  } else if (score >= 5) {
    baseColor = 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 hover:bg-blue-500/25';
  } else {
    baseColor = 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25';
  }

  if (isSelected) {
    return `${baseColor} ring-2 ring-primary ring-offset-2 ring-offset-background font-black shadow-md scale-[1.02]`;
  }
  return baseColor;
}

export function RiskHeatmapMatrix({
  risks,
  selectedCell,
  onSelectCell,
}: RiskHeatmapMatrixProps) {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(true);

  // Group risks into cells
  const cellCounts: Record<string, number> = {};
  risks.forEach((r) => {
    const sev = (r.severity || 'medium').toLowerCase();
    const prob = (r.probability || 'possible').toLowerCase();
    const cellKey = `${sev}_${prob}`;
    cellCounts[cellKey] = (cellCounts[cellKey] || 0) + 1;
  });

  const totalRisks = risks.length;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Grid className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
              {t('risks_page.matrix_title', '5x5 Risk Assessment Matrix')}
              {selectedCell && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  Filtered: {selectedCell.severity} / {selectedCell.probability}
                </span>
              )}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t('risks_page.matrix_subtitle', 'Probability vs Severity Heatmap (Click any cell to filter)')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedCell && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelectCell(null)}
              className="h-8 rounded-xl text-xs gap-1.5 font-bold"
            >
              <X className="h-3.5 w-3.5" /> Clear Matrix Filter
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 rounded-xl text-xs gap-1 text-muted-foreground"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" /> Hide
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" /> Show
              </>
            )}
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4 pt-1 animate-fade-in">
          {/* 5x5 Grid Container */}
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[620px] space-y-2">
              {/* Top Severity Column Labels */}
              <div className="grid grid-cols-5 gap-2 text-center text-xs font-extrabold">
                <div className="text-muted-foreground/70 uppercase tracking-wider text-[11px] flex items-center justify-center font-mono">
                  PROBABILITY ↓
                </div>
                {SEVERITIES.map((sev) => (
                  <div
                    key={sev.key}
                    className="py-1.5 px-2 rounded-xl bg-muted/40 border border-border text-foreground font-extrabold text-xs"
                  >
                    {sev.label}
                  </div>
                ))}
              </div>

              {/* Matrix Rows */}
              {PROBABILITIES.map((prob) => (
                <div key={prob.key} className="grid grid-cols-5 gap-2 items-stretch">
                  {/* Probability Row Label */}
                  <div className="py-2.5 px-2.5 rounded-xl bg-muted/30 border border-border/60 text-xs font-bold text-muted-foreground flex items-center">
                    {prob.label}
                  </div>

                  {/* 4 Severity Cells */}
                  {SEVERITIES.map((sev) => {
                    const score = sev.weight * prob.weight;
                    const cellKey = `${sev.key}_${prob.key}`;
                    const count = cellCounts[cellKey] || 0;
                    const isSelected =
                      selectedCell?.severity === sev.key &&
                      selectedCell?.probability === prob.key;

                    return (
                      <button
                        key={cellKey}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            onSelectCell(null);
                          } else {
                            onSelectCell({ severity: sev.key, probability: prob.key });
                          }
                        }}
                        className={`group relative flex flex-col items-center justify-center p-3 rounded-2xl border transition-all cursor-pointer ${getCellColorStyle(
                          score,
                          isSelected,
                        )}`}
                      >
                        <div className="text-base font-black tracking-tight">
                          {count > 0 ? (
                            <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full bg-background/80 shadow-xs border border-current">
                              {count}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/40 font-semibold">—</span>
                          )}
                        </div>
                        <span className="text-[10px] font-bold opacity-75 mt-0.5">
                          Score: {score}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Matrix Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60 text-xs font-semibold text-muted-foreground">
            <span className="text-[11px]">Severity Impact Scale:</span>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-emerald-500" />
                <span>Low (1-4)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-blue-500" />
                <span>Moderate (5-8)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-amber-500" />
                <span>High (9-14)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-rose-500" />
                <span>Critical (15-20)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
