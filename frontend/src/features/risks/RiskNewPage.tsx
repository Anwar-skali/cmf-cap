import { useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCreateRiskMutation } from '@/hooks/mutations/useRiskMutations';
import { usePartsQuery } from '@/hooks/queries/usePartsQuery';
import { useSuppliersQuery } from '@/hooks/queries/useSuppliersQuery';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Save,
  ShieldAlert,
  AlertTriangle,
  Layers,
  Calendar,
  Building2,
  Cpu,
  CheckCircle2,
  Sparkles,
  Info,
  Clock,
  Zap,
  Target,
  FileText,
  LifeBuoy,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import { createRiskSchema, type CreateRiskFormData } from '@/utils/validators';
import type { CreateRiskRequest, RiskSeverity, RiskProbability, RiskStatus } from '@/types';
import { useToast } from '@/hooks/useToast';
import {
  calculateRiskScore,
  getRiskScoreLevel,
  formatProbabilityLabel,
  formatSeverityLabel,
  SEVERITY_WEIGHTS,
  PROBABILITY_WEIGHTS,
} from './utils/riskUtils';

const RISK_CATEGORIES = [
  { value: 'Quality Non-Conformity', label: 'Quality Non-Conformity (Scrap, PPM, PPAP Defect)' },
  { value: 'Financial & Solvency', label: 'Financial & Commercial Risk (Supplier Solvency, Pricing)' },
  { value: 'Geopolitical & Supply Chain', label: 'Geopolitical & Supply Disruption (Port Delay, Trade Embargo)' },
  { value: 'Single Source Dependency', label: 'Single Source & Monopolistic Dependency' },
  { value: 'Tooling & Equipment Breakdown', label: 'Tooling & Equipment Breakdown (Mold wear, Line Down)' },
  { value: 'Regulatory & Compliance', label: 'Regulatory, Environmental & Safety Compliance' },
  { value: 'Engineering & Design Change', label: 'Engineering & CAD Design Change (Revision Delay)' },
  { value: 'Logistics & Freight Delay', label: 'Logistics, Packaging & Transport Disruption' },
  { value: 'Technical & Material Shortage', label: 'Technical & Raw Material Specification Defect' },
  { value: 'Other Operational Risk', label: 'Other Operational / Project Risk' },
];

const CAT_TIERS = [
  'CAT 1',
  'CAT 2',
  'CAT 3',
  'CAT 4',
];

export default function RiskNewPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const createMutation = useCreateRiskMutation();
  const { data: partsData, isLoading: isLoadingParts } = usePartsQuery();
  const { data: suppliersData } = useSuppliersQuery();

  const form = useForm<CreateRiskFormData>({
    resolver: zodResolver(createRiskSchema),
    defaultValues: {
      title: '',
      projectPartId: '',
      description: '',
      riskType: 'Quality Non-Conformity',
      severity: 'medium',
      probability: 'possible',
      impact: '',
      mitigation: '',
      contingency: '',
      status: 'open',
      dueDate: '',
      gate: 'CAT 1',
      cate: 'CAT 1',
    },
  });

  const selectedPartId = form.watch('projectPartId');
  const selectedSeverity = form.watch('severity');
  const selectedProbability = form.watch('probability');
  const selectedRiskType = form.watch('riskType');
  const selectedGate = form.watch('gate');
  const selectedTitle = form.watch('title');
  const selectedStatus = form.watch('status');
  const mitigationText = form.watch('mitigation');

  // Selected Part Information
  const selectedPart = useMemo(
    () => partsData?.items?.find((p) => p.id === selectedPartId),
    [partsData, selectedPartId],
  );

  const selectedSupplier = useMemo(() => {
    if (!selectedPart?.supplierId) return null;
    return suppliersData?.items?.find((s) => s.id === selectedPart.supplierId);
  }, [suppliersData, selectedPart]);

  // Live Score Calculation
  const liveScore = useMemo(() => {
    const s = SEVERITY_WEIGHTS[selectedSeverity?.toLowerCase() || 'medium'] || 2;
    const p = PROBABILITY_WEIGHTS[selectedProbability?.toLowerCase() || 'possible'] || 3;
    return s * p;
  }, [selectedSeverity, selectedProbability]);

  const scoreLevel = useMemo(() => getRiskScoreLevel(liveScore), [liveScore]);

  const onSubmit = (data: CreateRiskFormData) => {
    const payload: CreateRiskRequest = {
      ...data,
      cate: data.gate || data.cate || 'CATE 1',
      gate: data.gate || data.cate || 'CATE 1',
      severity: data.severity as RiskSeverity,
      probability: data.probability as RiskProbability,
      status: data.status as RiskStatus,
    };

    createMutation.mutate(payload, {
      onSuccess: () => {
        toast.success('Risk logged successfully in Risk Register');
        navigate('/risks');
      },
      onError: (err) => toast.error(err?.message || 'Failed to create risk'),
    });
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-5">
        <div className="flex items-center gap-3.5">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border border-border/60 shadow-xs" asChild>
            <Link to="/risks">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">Log New Risk</h1>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] font-mono font-bold">
                Manual Registry
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Identify and log non-capacity supply chain, quality, financial, or technical risks
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" asChild>
            <Link to="/risks">Cancel</Link>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={form.handleSubmit(onSubmit)}
            disabled={createMutation.isPending}
            className="shadow-sm font-bold"
          >
            <Save className="mr-1.5 h-4 w-4" />
            {createMutation.isPending ? 'Saving...' : 'Create Risk Entry'}
          </Button>
        </div>
      </div>

      {/* Info Callout */}
      <div className="flex items-start gap-3 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300">
        <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Capacity & Demand Overload Notice:</span> For capacity-related risks (supplier throughput shortages vs. monthly demand volume), use{' '}
          <Link to="/capacity/new" className="font-bold underline hover:opacity-80">
            Capacity Assessments (/capacity/new)
          </Link>
          . The engine will automatically evaluate line load and synchronize risks for you.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Form (8 Columns) */}
        <div className="lg:col-span-8 space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Step 1: Part & Core Identification */}
              <Card className="border-border/60 shadow-soft overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2.5 text-foreground">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                        1
                      </div>
                      Part & Core Identification
                    </CardTitle>
                    <Badge variant="outline" className="text-[11px] text-muted-foreground font-mono">
                      Step 1 of 4
                    </Badge>
                  </div>
                  <CardDescription className="text-xs pt-1">
                    Associate risk with a project component, CAT milestone gate, and category
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-6 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Associated Part */}
                    <FormField
                      control={form.control}
                      name="projectPartId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
                            <Cpu className="h-3.5 w-3.5 text-primary" /> Associated Component *
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? ''}>
                            <FormControl>
                              <SelectTrigger className="h-10 bg-background/80">
                                <SelectValue placeholder={isLoadingParts ? 'Loading components...' : 'Select component'} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-h-60">
                              {partsData?.items?.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  <span className="font-semibold">{p.partNumber || p.code}</span> — {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* CAT Milestone */}
                    <FormField
                      control={form.control}
                      name="gate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
                            <Layers className="h-3.5 w-3.5 text-indigo-500" /> CAT Milestone *
                          </FormLabel>
                          <Select
                            onValueChange={(val) => {
                              field.onChange(val);
                              form.setValue('cate', val);
                            }}
                            value={field.value ?? 'CAT 1'}
                          >
                            <FormControl>
                              <SelectTrigger className="h-10 bg-background/80 font-mono">
                                <SelectValue placeholder="Select CAT" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CAT_TIERS.map((g) => (
                                <SelectItem key={g} value={g} className="font-mono text-xs">
                                  {g}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Risk Category / Type */}
                  <FormField
                    control={form.control}
                    name="riskType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
                          <Target className="h-3.5 w-3.5 text-amber-500" /> Risk Category & Classification *
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? 'Quality Non-Conformity'}>
                          <FormControl>
                            <SelectTrigger className="h-10 bg-background/80">
                              <SelectValue placeholder="Select risk category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {RISK_CATEGORIES.map((cat) => (
                              <SelectItem key={cat.value} value={cat.value} className="text-xs">
                                {cat.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Risk Title */}
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" /> Risk Title *
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. PPAP Dim. Non-Conformity on Stamp Die Tooling"
                            className="h-10 bg-background/80 font-medium"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-[11px]">
                          Concise statement of the issue and affected component / process
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Description */}
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Root Cause & Detailed Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Provide technical details, root causes, scrap rates, or supplier audit findings..."
                            rows={3}
                            className="bg-background/80 resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Step 2: Severity & Probability Matrix */}
              <Card className="border-border/60 shadow-soft overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2.5 text-foreground">
                      <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                        2
                      </div>
                      Risk Evaluation Matrix (Severity × Probability)
                    </CardTitle>
                    <Badge variant="outline" className="text-[11px] text-muted-foreground font-mono">
                      Step 2 of 4
                    </Badge>
                  </div>
                  <CardDescription className="text-xs pt-1">
                    Score risk severity and occurrence probability to establish priority
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-6 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Severity */}
                    <FormField
                      control={form.control}
                      name="severity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 text-rose-500" /> Severity Level *
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? 'medium'}>
                            <FormControl>
                              <SelectTrigger className="h-10 bg-background/80">
                                <SelectValue placeholder="Select severity" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="critical">🔴 Critical (4) — Line Stoppage / OEM Halt</SelectItem>
                              <SelectItem value="high">🟠 High (3) — Major Schedule Delay / Severe Defect</SelectItem>
                              <SelectItem value="medium">🟡 Medium (2) — Moderate Delay / Workaround Exists</SelectItem>
                              <SelectItem value="low">🟢 Low (1) — Minor Deviation / Negligible Impact</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Probability */}
                    <FormField
                      control={form.control}
                      name="probability"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-blue-500" /> Occurrence Probability *
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? 'possible'}>
                            <FormControl>
                              <SelectTrigger className="h-10 bg-background/80">
                                <SelectValue placeholder="Select probability" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="almost_certain">Almost Certain (5) — &gt;90% / Ongoing</SelectItem>
                              <SelectItem value="likely">Likely (4) — 60–90% / High Frequency</SelectItem>
                              <SelectItem value="possible">Possible (3) — 30–60% / Realistic Risk</SelectItem>
                              <SelectItem value="unlikely">Unlikely (2) — 10–30% / Low Probability</SelectItem>
                              <SelectItem value="rare">Rare (1) — &lt;10% / Exceptional Event</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Matrix Calculation Preview Banner */}
                  <div className="p-4 rounded-xl border border-border/80 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`h-12 w-12 rounded-xl flex items-center justify-center font-black text-lg border ${scoreLevel.badgeClass}`}>
                        {liveScore}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">Computed Priority:</span>
                          <Badge className={`${scoreLevel.badgeClass} font-bold text-xs`}>
                            {scoreLevel.label} ({liveScore} / 20 pts)
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Severity ({formatSeverityLabel(selectedSeverity)}) × Probability ({formatProbabilityLabel(selectedProbability)})
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground font-mono">
                        Criticality Threshold: {liveScore >= 15 ? 'CRITICAL ESCALATION' : liveScore >= 9 ? 'HIGH PRIORITY' : 'ROUTINE TRACKING'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Step 3: Impact Analysis & Mitigation Strategy */}
              <Card className="border-border/60 shadow-soft overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2.5 text-foreground">
                      <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                        3
                      </div>
                      Impact Analysis & Corrective Actions
                    </CardTitle>
                    <Badge variant="outline" className="text-[11px] text-muted-foreground font-mono">
                      Step 3 of 4
                    </Badge>
                  </div>
                  <CardDescription className="text-xs pt-1">
                    Detail operational consequences, corrective SQD actions, and fallback contingency plans
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-6 space-y-5">
                  {/* Impact */}
                  <FormField
                    control={form.control}
                    name="impact"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Operational & Assembly Impact
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g. Risk of vehicle line stoppage at OEM plant; delay in CAT milestone validation sign-off..."
                            rows={2}
                            className="bg-background/80 resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Mitigation Plan */}
                  <FormField
                    control={form.control}
                    name="mitigation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
                          <LifeBuoy className="h-3.5 w-3.5 text-emerald-600" /> Mitigation Action Plan (SQD Countermeasures)
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g. Mandate 100% supplier sorting, authorize tooling rework, duplicate critical molds, or conduct on-site audit..."
                            rows={3}
                            className="bg-background/80 resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Contingency Plan */}
                  <FormField
                    control={form.control}
                    name="contingency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
                          <Zap className="h-3.5 w-3.5 text-indigo-500" /> Contingency & Fallback Strategy (Optional)
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g. Emergency safety stock buffer, air freight pre-authorization, dual-source activation..."
                            rows={2}
                            className="bg-background/80 resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Step 4: Schedule, Status & Ownership */}
              <Card className="border-border/60 shadow-soft overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2.5 text-foreground">
                      <div className="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
                        4
                      </div>
                      Status & Mitigation Timeline
                    </CardTitle>
                    <Badge variant="outline" className="text-[11px] text-muted-foreground font-mono">
                      Step 4 of 4
                    </Badge>
                  </div>
                  <CardDescription className="text-xs pt-1">
                    Set target closure deadline and initial status in Kanban workflow
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-6 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Status */}
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Initial Status *
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? 'open'}>
                            <FormControl>
                              <SelectTrigger className="h-10 bg-background/80">
                                <SelectValue placeholder="Select initial status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="open">Open (Identified & Pending)</SelectItem>
                              <SelectItem value="mitigating">In Mitigation (Action Plan Underway)</SelectItem>
                              <SelectItem value="mitigated">Mitigated (Countermeasures Validated)</SelectItem>
                              <SelectItem value="closed">Closed (Issue Fully Resolved)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Due Date */}
                    <FormField
                      control={form.control}
                      name="dueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> Mitigation Due Date
                          </FormLabel>
                          <FormControl>
                            <Input type="date" className="h-10 bg-background/80 font-mono" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Bottom Action Footer */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button variant="outline" size="lg" asChild>
                  <Link to="/risks">Cancel</Link>
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  disabled={createMutation.isPending}
                  className="font-bold px-6 shadow-md"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {createMutation.isPending ? 'Logging Risk...' : 'Register Risk in System'}
                </Button>
              </div>
            </form>
          </Form>
        </div>

        {/* Sticky Live Evaluation Sidebar (4 Columns) */}
        <div className="lg:col-span-4 space-y-5">
          <div className="sticky top-6 space-y-5">
            {/* Live Risk Score Card */}
            <Card className="border-border/60 shadow-soft overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border/40 pb-3">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> Live Risk Scoring Matrix
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-2xl font-black tracking-tight text-foreground font-mono">
                      {liveScore} <span className="text-xs font-normal text-muted-foreground">/ 20</span>
                    </span>
                    <p className="text-[11px] text-muted-foreground">Calculated risk index</p>
                  </div>
                  <Badge className={`${scoreLevel.badgeClass} font-bold text-xs px-2.5 py-1`}>
                    {scoreLevel.label}
                  </Badge>
                </div>

                {/* Visual Progress Bar */}
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      liveScore >= 15
                        ? 'bg-rose-500'
                        : liveScore >= 9
                        ? 'bg-amber-500'
                        : liveScore >= 5
                        ? 'bg-blue-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, (liveScore / 20) * 100)}%` }}
                  />
                </div>

                <div className="pt-2 border-t border-border/40 space-y-2 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Severity Weight:</span>
                    <span className="font-semibold text-foreground font-mono">
                      {formatSeverityLabel(selectedSeverity)}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Probability Weight:</span>
                    <span className="font-semibold text-foreground font-mono">
                      {formatProbabilityLabel(selectedProbability)}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>CAT Milestone:</span>
                    <Badge variant="outline" className="font-mono text-[10px] py-0">
                      {(selectedGate || 'CAT 1').replace(/CATE/gi, 'CAT').replace(/Gate\s*(\d)/gi, 'CAT $1')}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Target Summary Card */}
            <Card className="border-border/60 shadow-soft">
              <CardHeader className="bg-muted/30 border-b border-border/40 pb-3">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <ShieldAlert className="h-3.5 w-3.5 text-primary" /> Entry Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-3.5 text-xs">
                <div>
                  <span className="text-muted-foreground">Selected Component:</span>
                  <p className="font-semibold text-foreground mt-0.5 truncate">
                    {selectedPart ? `${selectedPart.partNumber || selectedPart.code} — ${selectedPart.name}` : 'Not selected'}
                  </p>
                </div>

                <div>
                  <span className="text-muted-foreground">Supplier / Manufacturing Plant:</span>
                  <p className="font-semibold text-foreground mt-0.5 truncate">
                    {selectedSupplier?.name || 'Associated with component'}
                  </p>
                </div>

                <div>
                  <span className="text-muted-foreground">Category:</span>
                  <p className="font-medium text-foreground mt-0.5 truncate">
                    {selectedRiskType || 'Quality Non-Conformity'}
                  </p>
                </div>

                <div>
                  <span className="text-muted-foreground">Mitigation Status:</span>
                  <div className="mt-1">
                    {mitigationText?.trim() ? (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                        Plan Defined
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px]">
                        Pending Action Plan
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-border/40">
                  <Button
                    type="button"
                    onClick={form.handleSubmit(onSubmit)}
                    disabled={createMutation.isPending}
                    className="w-full font-bold shadow-sm"
                  >
                    <Save className="mr-1.5 h-4 w-4" />
                    {createMutation.isPending ? 'Saving...' : 'Register Risk Entry'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

