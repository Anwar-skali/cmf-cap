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
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateRiskMutation } from '@/hooks/mutations/useRiskMutations';
import { ShieldCheck, Save, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { Risk, RiskStatus } from '@/types';
import { useLanguage } from '@/context/LanguageContext';

interface QuickMitigateModalProps {
  risk: Risk | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickMitigateModal({ risk, open, onOpenChange }: QuickMitigateModalProps) {
  const { t } = useLanguage();
  const updateMutation = useUpdateRiskMutation();

  const [mitigation, setMitigation] = useState('');
  const [contingency, setContingency] = useState('');
  const [status, setStatus] = useState<RiskStatus>('mitigating');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (risk) {
      setMitigation(risk.mitigation || '');
      setContingency(risk.contingency || '');
      setStatus(risk.status || 'mitigating');
      setDueDate(risk.dueDate ? risk.dueDate.split('T')[0] : '');
    }
  }, [risk]);

  if (!risk) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(
      {
        id: risk.id,
        data: {
          mitigation,
          contingency,
          status,
          dueDate: dueDate || undefined,
        },
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      },
    );
  };

  const handleQuickStatus = (newStatus: RiskStatus) => {
    setStatus(newStatus);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border-border bg-card shadow-2xl">
        <DialogHeader className="space-y-2 border-b border-border pb-4">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-muted-foreground uppercase">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>RISK #{risk.id.slice(0, 8)}</span>
          </div>
          <DialogTitle className="text-xl font-black tracking-tight text-foreground">
            {t('risks_page.modal_quick_mitigate_title', 'Mitigation Plan')}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {risk.title}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Quick status selection buttons */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">
              {t('risks_page.status_label', 'Resolution Status')}
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'open', label: 'Open', color: 'border-rose-500/40 text-rose-500' },
                { id: 'mitigating', label: 'In Mitigation', color: 'border-amber-500/40 text-amber-500' },
                { id: 'mitigated', label: 'Mitigated', color: 'border-emerald-500/40 text-emerald-500' },
                { id: 'closed', label: 'Closed', color: 'border-slate-500/40 text-slate-400' },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => handleQuickStatus(st.id as RiskStatus)}
                  className={`rounded-xl border p-2 text-xs font-bold transition-all text-center cursor-pointer ${
                    status === st.id
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : `bg-muted/30 hover:bg-muted/60 ${st.color}`
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mitigation-input" className="text-xs font-bold text-foreground">
              {t('risks_page.mitigation_plan_label', 'Mitigation Plan & Corrective Actions')} *
            </Label>
            <Textarea
              id="mitigation-input"
              rows={3}
              placeholder="Outline specific technical steps, counter-measures, and supplier quality requirements..."
              value={mitigation}
              onChange={(e) => setMitigation(e.target.value)}
              className="text-xs resize-none rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contingency-input" className="text-xs font-bold text-foreground">
              {t('risks_page.contingency_plan_label', 'Contingency Fallback Plan')}
            </Label>
            <Textarea
              id="contingency-input"
              rows={2}
              placeholder="Fallback plan if mitigation is delayed (e.g. buffer stock, secondary tooling)..."
              value={contingency}
              onChange={(e) => setContingency(e.target.value)}
              className="text-xs resize-none rounded-xl"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="due-date-input" className="text-xs font-bold text-foreground">
                {t('risks_page.due_date_label', 'Target Completion Date')}
              </Label>
              <Input
                id="due-date-input"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Severity Rating
              </Label>
              <div className="flex items-center gap-2 h-9 px-3 rounded-xl border border-border bg-muted/20 text-xs font-bold text-foreground">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <span className="capitalize">{risk.severity} Severity</span>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-border pt-4 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs font-semibold"
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="rounded-xl text-xs font-bold bg-[#0066CC] hover:bg-[#0052A3] text-white shadow-md shadow-blue-500/20 gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              {updateMutation.isPending
                ? t('common.loading', 'Saving...')
                : t('risks_page.modal_save_mitigation', 'Save Mitigation')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
